import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.stripe_client import stripe_gateway
from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.enums import AuditAction, BookingStatus, PaymentStatus
from app.models.payment import PaymentTransaction
from app.models.user import User
from app.schemas.payment import (
    CheckoutSessionResponse,
    CreateCheckoutSessionRequest,
    ManualPaymentCreate,
    PaymentSummaryResponse,
    PaymentTransactionRead,
    RefundRequest,
)
from app.services.booking_service import BookingService
from app.services.customer_service import CustomerService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PaymentService:
    @staticmethod
    async def create_checkout_session(
        db: AsyncSession,
        req: CreateCheckoutSessionRequest,
        actor: Optional[User] = None
    ) -> CheckoutSessionResponse:
        """
        Generates a Stripe Checkout Session for full fare, deposit, or balance.
        """
        booking = await BookingService.get_booking_by_id(db, req.booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        # Calculate exact amount to charge
        payment_type = req.payment_type.upper()
        if payment_type == "DEPOSIT":
            amount = booking.deposit_required
        elif payment_type == "BALANCE":
            amount = booking.balance_amount
        elif payment_type == "FULL":
            amount = booking.total_fare
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid payment_type '{req.payment_type}'. Must be DEPOSIT, FULL, or BALANCE."
            )

        if amount <= 0.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amount to charge for {payment_type} is $0.00. No payment required."
            )

        # Create Stripe Checkout Session
        customer_email = booking.passenger_email or (booking.customer.email if booking.customer else "customer@example.com")
        session_info = await stripe_gateway.create_checkout_session(
            booking_id=booking.id,
            booking_number=booking.booking_number,
            customer_email=customer_email,
            amount=amount,
            currency=booking.currency,
            payment_type=payment_type,
            success_url=req.success_url,
            cancel_url=req.cancel_url
        )

        # Log pending transaction in payment ledger
        tx_id = str(uuid.uuid4())
        tx = PaymentTransaction(
            id=tx_id,
            booking_id=booking.id,
            customer_id=booking.customer_id,
            stripe_session_id=session_info["session_id"],
            stripe_payment_intent_id=session_info.get("payment_intent_id"),
            amount=amount,
            currency=booking.currency,
            payment_type=payment_type,
            payment_method="STRIPE_CHECKOUT",
            status="PENDING",
            extra_data={"checkout_url": session_info["checkout_url"]}
        )
        db.add(tx)
        await db.commit()

        return CheckoutSessionResponse(
            session_id=session_info["session_id"],
            checkout_url=session_info["checkout_url"],
            amount=amount,
            currency=booking.currency,
            payment_type=payment_type
        )

    @staticmethod
    async def handle_webhook_event(
        db: AsyncSession,
        payload_bytes: bytes,
        sig_header: Optional[str]
    ) -> Dict[str, Any]:
        """
        Verifies Stripe cryptographic signatures and reconciles payments into the Master Booking.
        Guarantees IDEMPOTENCY to prevent double-crediting.
        """
        event = stripe_gateway.verify_webhook_event(payload_bytes, sig_header)
        event_type = event.get("type", "")
        data_object = event.get("data", {}).get("object", {})

        if event_type == "checkout.session.completed":
            session_id = data_object.get("id")
            payment_intent_id = data_object.get("payment_intent")
            metadata = data_object.get("metadata", {})
            booking_id = metadata.get("booking_id")
            payment_type = metadata.get("payment_type", "DEPOSIT")
            amount_total = data_object.get("amount_total", 0) / 100.0  # Convert cents to dollars

            # 1. Lookup existing transaction
            stmt = select(PaymentTransaction).where(PaymentTransaction.stripe_session_id == session_id)
            res = await db.execute(stmt)
            tx = res.scalar_one_or_none()

            # IDEMPOTENCY PROTECTION: If already processed, ignore safely
            if tx and tx.status == "COMPLETED":
                return {"status": "already_processed", "transaction_id": tx.id}

            if not tx:
                tx = PaymentTransaction(
                    id=str(uuid.uuid4()),
                    booking_id=booking_id,
                    stripe_session_id=session_id,
                    stripe_payment_intent_id=payment_intent_id,
                    amount=amount_total,
                    currency=data_object.get("currency", "aud").upper(),
                    payment_type=payment_type,
                    payment_method="STRIPE_CHECKOUT",
                    status="COMPLETED"
                )
                db.add(tx)
            else:
                tx.status = "COMPLETED"
                if payment_intent_id:
                    tx.stripe_payment_intent_id = payment_intent_id

            # 2. Reconcile Master Booking
            booking = await BookingService.get_booking_by_id(db, booking_id or (tx.booking_id if tx else None))
            if not booking:
                await db.commit()
                return {"status": "error", "message": f"Booking {booking_id} not found."}

            old_paid = booking.paid_amount
            booking.paid_amount = round(booking.paid_amount + tx.amount, 2)
            booking.calculate_balance()

            if booking.balance_amount <= 0.0:
                booking.payment_status = PaymentStatus.PAID_IN_FULL
            else:
                booking.payment_status = PaymentStatus.PARTIAL_DEPOSIT

            # Auto-confirm booking if in pre-payment stage
            if booking.status in (BookingStatus.DRAFT, BookingStatus.QUOTED, BookingStatus.PAYMENT_PENDING):
                booking.status = BookingStatus.CONFIRMED

            # Update customer lifetime stats
            if booking.customer_id:
                await CustomerService.update_metrics(
                    db,
                    customer_id=booking.customer_id,
                    add_spent_amount=tx.amount
                )

            # Record Audit Trail
            audit = AuditLog(
                id=str(uuid.uuid4()),
                booking_id=booking.id,
                entity_type="Booking",
                entity_id=booking.id,
                action=AuditAction.PAYMENT,
                actor_role="STRIPE_WEBHOOK",
                actor_email="stripe@gateway.system",
                old_values={"paid_amount": old_paid, "payment_status": "UNPAID"},
                new_values={
                    "paid_amount": booking.paid_amount,
                    "balance_amount": booking.balance_amount,
                    "payment_status": booking.payment_status.value,
                    "status": booking.status.value,
                    "transaction_id": tx.id
                },
                reason=f"Stripe Checkout completed: ${tx.amount:.2f} AUD ({tx.payment_type})"
            )
            booking.audit_logs.append(audit)

            await db.commit()
            return {"status": "success", "booking_number": booking.booking_number, "paid_amount": booking.paid_amount}

        elif event_type == "payment_intent.payment_failed":
            intent_id = data_object.get("id")
            stmt = select(PaymentTransaction).where(PaymentTransaction.stripe_payment_intent_id == intent_id)
            res = await db.execute(stmt)
            tx = res.scalar_one_or_none()
            if tx:
                tx.status = "FAILED"
                await db.commit()
            return {"status": "payment_failed_recorded"}

        return {"status": "ignored", "event_type": event_type}

    @staticmethod
    async def record_manual_payment(
        db: AsyncSession,
        manual_in: ManualPaymentCreate,
        actor: Optional[User] = None
    ) -> PaymentTransaction:
        """
        Allows staff to record manual payments (Bank Transfer, Cash, Card Terminal) with full audit log.
        """
        booking = await BookingService.get_booking_by_id(db, manual_in.booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        amount = round(manual_in.amount, 2)
        tx_id = str(uuid.uuid4())
        tx = PaymentTransaction(
            id=tx_id,
            booking_id=booking.id,
            customer_id=booking.customer_id,
            amount=amount,
            currency=booking.currency,
            payment_type=manual_in.payment_type,
            payment_method=manual_in.payment_method,
            status="COMPLETED",
            reference_number=manual_in.reference_number,
            notes=manual_in.notes
        )
        db.add(tx)

        # Update Master Booking
        old_paid = booking.paid_amount
        booking.paid_amount = round(booking.paid_amount + amount, 2)
        booking.calculate_balance()

        if booking.balance_amount <= 0.0:
            booking.payment_status = PaymentStatus.PAID_IN_FULL
        else:
            booking.payment_status = PaymentStatus.PARTIAL_DEPOSIT

        if booking.status in (BookingStatus.DRAFT, BookingStatus.QUOTED, BookingStatus.PAYMENT_PENDING):
            booking.status = BookingStatus.CONFIRMED

        # Update customer stats
        if booking.customer_id:
            await CustomerService.update_metrics(
                db,
                customer_id=booking.customer_id,
                add_spent_amount=amount
            )

        # Audit Log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="PaymentTransaction",
            entity_id=tx_id,
            action=AuditAction.PAYMENT,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "STAFF",
            actor_email=actor.email if actor else "manual@operations",
            old_values={"paid_amount": old_paid},
            new_values={
                "paid_amount": booking.paid_amount,
                "balance_amount": booking.balance_amount,
                "payment_status": booking.payment_status.value,
                "payment_method": manual_in.payment_method,
                "reference_number": manual_in.reference_number
            },
            reason=f"Manual payment received: ${amount:.2f} AUD via {manual_in.payment_method}"
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(tx)
        return tx

    @staticmethod
    async def process_refund(
        db: AsyncSession,
        booking_id: str,
        refund_in: RefundRequest,
        actor: Optional[User] = None
    ) -> PaymentTransaction:
        """
        Executes a full or partial refund, updates Stripe and the Master Booking record.
        """
        booking = await BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        if booking.paid_amount <= 0.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No paid funds available to refund on this booking."
            )

        refund_amount = round(refund_in.amount or booking.paid_amount, 2)
        if refund_amount > booking.paid_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund amount (${refund_amount:.2f}) exceeds total paid amount (${booking.paid_amount:.2f})."
            )

        # Find latest completed Stripe transaction with payment_intent if applicable
        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.booking_id == booking_id,
                PaymentTransaction.status == "COMPLETED",
                PaymentTransaction.stripe_payment_intent_id != None
            )
            .order_by(PaymentTransaction.created_at.desc())
        )
        res = await db.execute(stmt)
        stripe_tx = res.scalars().first()

        # Call Stripe Refund Gateway
        intent_id = stripe_tx.stripe_payment_intent_id if stripe_tx else None
        refund_res = await stripe_gateway.create_refund(
            payment_intent_id=intent_id,
            amount=refund_amount,
            reason="requested_by_customer"
        )

        # Record Refund Transaction in Ledger
        tx_id = str(uuid.uuid4())
        refund_tx = PaymentTransaction(
            id=tx_id,
            booking_id=booking.id,
            customer_id=booking.customer_id,
            stripe_payment_intent_id=intent_id,
            amount=-refund_amount,  # Negative for refund entry
            currency=booking.currency,
            payment_type="REFUND",
            payment_method="STRIPE_REFUND" if intent_id else "MANUAL_REFUND",
            status="REFUNDED",
            notes=refund_in.reason.strip(),
            extra_data=refund_res
        )
        db.add(refund_tx)

        # Update Master Booking Paid & Balance
        booking.paid_amount = round(booking.paid_amount - refund_amount, 2)
        booking.calculate_balance()

        if booking.paid_amount <= 0.0:
            booking.payment_status = PaymentStatus.REFUNDED
            if booking.status == BookingStatus.REFUND_PENDING or booking.status == BookingStatus.CANCELLED:
                booking.status = BookingStatus.REFUNDED
        else:
            booking.payment_status = PaymentStatus.PARTIALLY_REFUNDED


        # Audit Log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="PaymentTransaction",
            entity_id=tx_id,
            action=AuditAction.REFUND,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "STAFF",
            actor_email=actor.email if actor else "finance@operations",
            new_values={
                "refund_amount": refund_amount,
                "remaining_paid": booking.paid_amount,
                "payment_status": booking.payment_status.value,
                "booking_status": booking.status.value
            },
            reason=f"Refund processed: ${refund_amount:.2f} AUD. Reason: {refund_in.reason}"
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(refund_tx)
        return refund_tx

    @staticmethod
    async def get_booking_payments(
        db: AsyncSession,
        booking_id: str
    ) -> PaymentSummaryResponse:
        """
        Retrieves all payment transactions and financial summary for a booking.
        """
        booking = await BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        stmt = (
            select(PaymentTransaction)
            .where(PaymentTransaction.booking_id == booking_id)
            .order_by(PaymentTransaction.created_at.desc())
        )
        res = await db.execute(stmt)
        txs = list(res.scalars().all())

        return PaymentSummaryResponse(
            booking_id=booking.id,
            booking_number=booking.booking_number,
            total_fare=booking.total_fare,
            paid_amount=booking.paid_amount,
            balance_amount=booking.balance_amount,
            payment_status=booking.payment_status,
            transactions=[PaymentTransactionRead.model_validate(t) for t in txs]
        )
