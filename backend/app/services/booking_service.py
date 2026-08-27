import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.customer import Customer
from app.models.enums import (
    AuditAction,
    BookingSource,
    BookingStatus,
    LegStatus,
    PaymentStatus,
    UserRole,
    VerificationStatus,
)
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingLegCreate,
    BookingLegUpdate,
    BookingUpdate,
)
from app.schemas.customer import CustomerCreate
from app.services.customer_service import CustomerService
from app.services.notification_service import NotificationService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# State Machine: Allowed transitions from each BookingStatus
VALID_BOOKING_TRANSITIONS: Dict[BookingStatus, Set[BookingStatus]] = {
    BookingStatus.DRAFT: {
        BookingStatus.ENQUIRY,
        BookingStatus.QUOTED,
        BookingStatus.CANCELLED,
    },
    BookingStatus.ENQUIRY: {
        BookingStatus.QUOTED,
        BookingStatus.CANCELLED,
    },
    BookingStatus.QUOTED: {
        BookingStatus.VERIFICATION_REQUIRED,
        BookingStatus.PAYMENT_PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
    },
    BookingStatus.VERIFICATION_REQUIRED: {
        BookingStatus.PAYMENT_PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
    },
    BookingStatus.PAYMENT_PENDING: {
        BookingStatus.CONFIRMED,
        BookingStatus.PAYMENT_PENDING,
        BookingStatus.CANCELLED,
    },
    BookingStatus.CONFIRMED: {
        BookingStatus.ALLOCATED,
        BookingStatus.CANCELLED,
        BookingStatus.REFUND_PENDING,
    },
    BookingStatus.ALLOCATED: {
        BookingStatus.DISPATCHED,
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
        BookingStatus.REFUND_PENDING,
    },
    BookingStatus.DISPATCHED: {
        BookingStatus.EN_ROUTE,
        BookingStatus.ALLOCATED,
        BookingStatus.CANCELLED,
        BookingStatus.REFUND_PENDING,
    },
    BookingStatus.EN_ROUTE: {
        BookingStatus.ARRIVED,
        BookingStatus.CANCELLED,
    },
    BookingStatus.ARRIVED: {
        BookingStatus.PICKED_UP,
        BookingStatus.CANCELLED,
    },
    BookingStatus.PICKED_UP: {
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
    },
    BookingStatus.COMPLETED: {
        BookingStatus.FINANCIALLY_CLOSED,
        BookingStatus.REFUND_PENDING,
    },
    BookingStatus.REFUND_PENDING: {
        BookingStatus.REFUNDED,
        BookingStatus.CONFIRMED,
        BookingStatus.COMPLETED,
    },
    BookingStatus.REFUNDED: set(),
    BookingStatus.CANCELLED: {
        BookingStatus.REFUND_PENDING,
    },
    BookingStatus.FINANCIALLY_CLOSED: set(),
}


class BookingService:
    @staticmethod
    async def generate_booking_number(db: AsyncSession) -> str:
        """
        Generates sequential collision-free booking numbers: e.g. CCM-10001, CCM-10002.
        """
        stmt = select(func.count(Booking.id))
        result = await db.execute(stmt)
        count = result.scalar_one() or 0
        next_num = 10001 + count

        # Ensure uniqueness in case of deleted records
        while True:
            candidate = f"CCM-{next_num}"
            existing = await db.execute(select(Booking).where(Booking.booking_number == candidate))
            if not existing.scalar_one_or_none():
                return candidate
            next_num += 1

    @staticmethod
    async def create_booking(
        db: AsyncSession,
        booking_in: BookingCreate,
        actor: Optional[User] = None
    ) -> Booking:
        """
        Creates Master Booking and all attached journey legs.
        Guarantees ONE BOOKING -> ONE RECORD -> ONE SOURCE OF TRUTH.
        """
        # 1. Resolve Customer CRM record
        customer: Optional[Customer] = None
        if booking_in.customer_id:
            customer = await CustomerService.get_by_id(db, booking_in.customer_id)
            if not customer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified customer ID was not found."
                )
        elif booking_in.customer_email and booking_in.customer_phone and booking_in.customer_name:
            customer = await CustomerService.find_or_create_customer(
                db,
                CustomerCreate(
                    full_name=booking_in.customer_name,
                    email=booking_in.customer_email,
                    phone=booking_in.customer_phone,
                    company_name=booking_in.company_name
                )
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either customer_id or full customer details (name, email, phone) must be provided."
            )

        # 2. Deposit & Balance Calculations
        total = round(booking_in.total_fare, 2)
        pct = booking_in.deposit_percentage
        if booking_in.deposit_required is not None:
            deposit_req = round(booking_in.deposit_required, 2)
        else:
            deposit_req = round(total * (pct / 100.0), 2)

        booking_number = await BookingService.generate_booking_number(db)
        booking_id = str(uuid.uuid4())

        # 3. Create Master Booking Instance
        booking = Booking(
            id=booking_id,
            booking_number=booking_number,
            customer_id=customer.id,
            source=booking_in.source,
            status=BookingStatus.DRAFT,
            payment_status=PaymentStatus.UNPAID,
            verification_status=VerificationStatus.NOT_REQUIRED,
            fare_type=booking_in.fare_type,
            currency=booking_in.currency,
            total_fare=total,
            deposit_required=deposit_req,
            deposit_percentage=pct,
            paid_amount=0.0,
            balance_amount=total,
            pricing_breakdown=booking_in.pricing_breakdown,
            flight_tracking_enabled=booking_in.flight_tracking_enabled,
            passenger_name=booking_in.passenger_name or customer.full_name,
            passenger_phone=booking_in.passenger_phone or customer.phone,
            passenger_email=booking_in.passenger_email or customer.email,
            passenger_count=booking_in.passenger_count,
            luggage_count=booking_in.luggage_count,
            special_instructions=booking_in.special_instructions,
            internal_notes=booking_in.internal_notes,
            created_by_id=actor.id if actor else None
        )

        # 4. Attach Journey Legs
        legs: List[BookingLeg] = []
        for i, leg_in in enumerate(booking_in.legs):
            leg = BookingLeg(
                id=str(uuid.uuid4()),
                booking_id=booking_id,
                leg_number=i + 1,
                status=LegStatus.PENDING,
                pickup_address=leg_in.pickup_address.strip(),
                pickup_lat=leg_in.pickup_lat,
                pickup_lng=leg_in.pickup_lng,
                dropoff_address=leg_in.dropoff_address.strip(),
                dropoff_lat=leg_in.dropoff_lat,
                dropoff_lng=leg_in.dropoff_lng,
                pickup_datetime=leg_in.pickup_datetime,
                distance_km=leg_in.distance_km,
                duration_minutes=leg_in.duration_minutes,
                vehicle_category=leg_in.vehicle_category,
                allocation_cost=round(leg_in.allocation_cost, 2),
                is_airport_pickup=leg_in.is_airport_pickup,
                airline=leg_in.airline.strip() if leg_in.airline else None,
                flight_number=leg_in.flight_number.strip().upper() if leg_in.flight_number else None,
                pickup_notes=leg_in.pickup_notes
            )
            legs.append(leg)

        booking.legs = legs

        # 5. Create Audit Trail Entry
        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking_id,
            entity_type="Booking",
            entity_id=booking_id,
            action=AuditAction.CREATE,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "SYSTEM",
            actor_email=actor.email if actor else "system@automation",
            new_values={
                "booking_number": booking_number,
                "total_fare": total,
                "legs_count": len(legs),
                "customer_id": customer.id
            },
            reason="Initial booking creation"
        )
        booking.audit_logs.append(audit)

        db.add(booking)
        await NotificationService.send_dual_booking_created_alert(db, booking)
        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def get_booking_by_id(db: AsyncSession, booking_id: str) -> Optional[Booking]:
        """Fetch booking by primary key with legs and customer."""
        stmt = (
            select(Booking)
            .where(Booking.id == booking_id)
            .options(
                selectinload(Booking.legs).selectinload(BookingLeg.driver),
                selectinload(Booking.legs).selectinload(BookingLeg.vehicle),
                selectinload(Booking.customer),
                selectinload(Booking.audit_logs)
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_booking_by_number(db: AsyncSession, booking_number: str) -> Optional[Booking]:
        """Fetch booking by unique booking number (e.g. CCM-10001)."""
        stmt = (
            select(Booking)
            .where(Booking.booking_number == booking_number.strip().upper())
            .options(
                selectinload(Booking.legs).selectinload(BookingLeg.driver),
                selectinload(Booking.legs).selectinload(BookingLeg.vehicle),
                selectinload(Booking.customer),
                selectinload(Booking.audit_logs)
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_bookings(
        db: AsyncSession,
        status_filter: Optional[BookingStatus] = None,
        payment_status: Optional[PaymentStatus] = None,
        source: Optional[BookingSource] = None,
        customer_id: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> Tuple[List[Booking], int]:
        """List bookings with count and filtering."""
        query = (
            select(Booking)
            .options(
                selectinload(Booking.legs),
                selectinload(Booking.customer)
            )
        )
        count_query = select(func.count(Booking.id))

        if status_filter:
            query = query.where(Booking.status == status_filter)
            count_query = count_query.where(Booking.status == status_filter)
        if payment_status:
            query = query.where(Booking.payment_status == payment_status)
            count_query = count_query.where(Booking.payment_status == payment_status)
        if source:
            query = query.where(Booking.source == source)
            count_query = count_query.where(Booking.source == source)
        if customer_id:
            query = query.where(Booking.customer_id == customer_id)
            count_query = count_query.where(Booking.customer_id == customer_id)
        if search:
            pattern = f"%{search.strip().lower()}%"
            search_clause = or_(
                Booking.booking_number.ilike(pattern),
                Booking.passenger_name.ilike(pattern),
                Booking.passenger_email.ilike(pattern),
                Booking.passenger_phone.ilike(pattern)
            )
            query = query.where(search_clause)
            count_query = count_query.where(search_clause)

        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        query = query.offset(skip).limit(limit).order_by(Booking.created_at.desc())
        result = await db.execute(query)
        bookings = list(result.scalars().all())
        return bookings, total

    @staticmethod
    async def update_booking(
        db: AsyncSession,
        booking_id: str,
        booking_update: BookingUpdate,
        actor: Optional[User] = None
    ) -> Booking:
        """Updates booking fields with audit trail logging."""
        booking = await BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        old_values = {}
        new_values = {}

        if booking_update.total_fare is not None:
            old_values["total_fare"] = booking.total_fare
            booking.total_fare = round(booking_update.total_fare, 2)
            booking.calculate_balance()
            new_values["total_fare"] = booking.total_fare
            new_values["balance_amount"] = booking.balance_amount

        if booking_update.deposit_required is not None:
            booking.deposit_required = round(booking_update.deposit_required, 2)
        if booking_update.deposit_percentage is not None:
            booking.deposit_percentage = booking_update.deposit_percentage
        if booking_update.pricing_breakdown is not None:
            booking.pricing_breakdown = booking_update.pricing_breakdown
        if booking_update.passenger_name is not None:
            booking.passenger_name = booking_update.passenger_name.strip()
        if booking_update.passenger_phone is not None:
            booking.passenger_phone = booking_update.passenger_phone.strip()
        if booking_update.passenger_email is not None:
            booking.passenger_email = booking_update.passenger_email.strip().lower()
        if booking_update.passenger_count is not None:
            booking.passenger_count = booking_update.passenger_count
        if booking_update.luggage_count is not None:
            booking.luggage_count = booking_update.luggage_count
        if booking_update.special_instructions is not None:
            booking.special_instructions = booking_update.special_instructions
        if booking_update.internal_notes is not None:
            booking.internal_notes = booking_update.internal_notes
        if booking_update.flight_tracking_enabled is not None:
            booking.flight_tracking_enabled = booking_update.flight_tracking_enabled

        if new_values:
            audit = AuditLog(
                id=str(uuid.uuid4()),
                booking_id=booking.id,
                entity_type="Booking",
                entity_id=booking.id,
                action=AuditAction.UPDATE,
                actor_id=actor.id if actor else None,
                actor_role=actor.role.value if actor else "SYSTEM",
                actor_email=actor.email if actor else "system@automation",
                old_values=old_values,
                new_values=new_values,
                reason="Booking details updated"
            )
            booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def transition_status(
        db: AsyncSession,
        booking_id: str,
        target_status: BookingStatus,
        actor: Optional[User] = None,
        reason: Optional[str] = None
    ) -> Booking:
        """
        Executes controlled state machine transition with strict validation.
        """
        booking = await BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        current_status = booking.status
        if current_status == target_status:
            return booking  # Idempotent

        allowed = VALID_BOOKING_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Illegal status transition: cannot change status from '{current_status.value}' to '{target_status.value}'."
            )

        # Apply state transition
        booking.status = target_status

        # If transitioning to CONFIRMED, update customer stats
        if target_status == BookingStatus.CONFIRMED:
            await CustomerService.update_metrics(
                db,
                customer_id=booking.customer_id,
                add_booking_count=1,
                add_spent_amount=booking.total_fare
            )

        # Audit log transition
        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="Booking",
            entity_id=booking.id,
            action=AuditAction.STATUS_CHANGE,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "SYSTEM",
            actor_email=actor.email if actor else "system@automation",
            old_values={"status": current_status.value},
            new_values={"status": target_status.value},
            reason=reason or f"Status transitioned to {target_status.value}"
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def cancel_booking(
        db: AsyncSession,
        booking_id: str,
        reason: str,
        actor: Optional[User] = None
    ) -> Booking:
        """
        Cancels a master booking and all pending journey legs.
        Sets cancellation metadata and flags refund if payment was already made.
        """
        booking = await BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        if booking.status in (BookingStatus.CANCELLED, BookingStatus.REFUNDED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Booking is already in {booking.status.value} state."
            )

        old_status = booking.status
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = utc_now()
        booking.cancellation_reason = reason.strip()

        # Cancel all uncompleted legs
        for leg in booking.legs:
            if leg.status != LegStatus.COMPLETED:
                leg.status = LegStatus.CANCELLED

        # Flag for refund if payment was collected
        if booking.paid_amount > 0:
            booking.payment_status = PaymentStatus.REFUND_PENDING

        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="Booking",
            entity_id=booking.id,
            action=AuditAction.CANCELLATION,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "SYSTEM",
            actor_email=actor.email if actor else "system@automation",
            old_values={"status": old_status.value},
            new_values={
                "status": BookingStatus.CANCELLED.value,
                "cancelled_at": booking.cancelled_at.isoformat(),
                "payment_status": booking.payment_status.value
            },
            reason=reason.strip()
        )
        booking.audit_logs.append(audit)
        await NotificationService.send_cancellation_circuit_alert(db, booking, reason=reason.strip())

        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def update_leg_status(
        db: AsyncSession,
        booking_id: str,
        leg_id: str,
        target_status: LegStatus,
        actor: Optional[User] = None
    ) -> BookingLeg:
        """
        Updates individual journey leg operational status and syncs timestamps.
        If all legs are completed, automatically advances master booking to COMPLETED.
        """
        booking = await BookingService.get_booking_by_id(db, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found."
            )

        target_leg: Optional[BookingLeg] = None
        for leg in booking.legs:
            if leg.id == leg_id:
                target_leg = leg
                break

        if not target_leg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Leg not found on this booking."
            )

        old_status = target_leg.status
        target_leg.status = target_status
        now = utc_now()

        if target_status == LegStatus.EN_ROUTE:
            target_leg.en_route_at = now
            if booking.status not in (BookingStatus.EN_ROUTE, BookingStatus.ARRIVED, BookingStatus.PICKED_UP, BookingStatus.COMPLETED):
                booking.status = BookingStatus.EN_ROUTE
        elif target_status == LegStatus.ARRIVED:
            target_leg.arrived_at = now
            booking.status = BookingStatus.ARRIVED
        elif target_status == LegStatus.PICKED_UP:
            target_leg.picked_up_at = now
            booking.status = BookingStatus.PICKED_UP
        elif target_status == LegStatus.COMPLETED:
            target_leg.completed_at = now

        # Check if all legs are now completed
        all_completed = all(l.status == LegStatus.COMPLETED for l in booking.legs)
        if all_completed and booking.status != BookingStatus.COMPLETED:
            booking.status = BookingStatus.COMPLETED

        # Audit log leg status update
        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="BookingLeg",
            entity_id=target_leg.id,
            action=AuditAction.STATUS_CHANGE,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "SYSTEM",
            actor_email=actor.email if actor else "system@automation",
            old_values={"leg_number": target_leg.leg_number, "status": old_status.value},
            new_values={"leg_number": target_leg.leg_number, "status": target_status.value},
            reason=f"Leg #{target_leg.leg_number} status updated to {target_status.value}"
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(target_leg)
        return target_leg
