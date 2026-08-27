import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.customer import Customer
from app.models.driver import Driver
from app.models.enums import (
    AuditAction,
    BookingStatus,
    InvoiceStatus,
    LegStatus,
    PaymentStatus,
    PayoutBatchStatus,
)
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.payment import PaymentTransaction
from app.models.payout_batch import DriverPayoutBatch
from app.models.user import User
from app.schemas.accounting import (
    DriverPayoutBatchCreate,
    FIFOAllocationItem,
    FIFOPaymentAllocationRequest,
    FIFOPaymentAllocationResponse,
    InvoiceListResponse,
    InvoiceRead,
    TaxSummaryBASReport,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def calculate_australian_gst(gross_amount: float) -> Tuple[float, float]:
    """
    Australian 1/11th GST Calculation:
    Total Inc GST = Gross
    GST Component = round(Gross / 11.0, 2)
    Subtotal Ex GST = Gross - GST Component
    """
    gst = round(gross_amount / 11.0, 2)
    subtotal = round(gross_amount - gst, 2)
    return subtotal, gst


class AccountingService:
    @staticmethod
    async def generate_invoice_number(db: AsyncSession) -> str:
        """Generates sequential tax invoice number: INV-YYYY-XXXX."""
        year = utc_now().year
        stmt = select(func.count(Invoice.id)).where(Invoice.invoice_number.like(f"INV-{year}-%"))
        res = await db.execute(stmt)
        count = res.scalar_one() or 0
        return f"INV-{year}-{count + 1:04d}"

    @staticmethod
    async def generate_rcti_number(db: AsyncSession) -> str:
        """Generates sequential driver RCTI payout number: RCTI-YYYY-XXXX."""
        year = utc_now().year
        stmt = select(func.count(DriverPayoutBatch.id)).where(DriverPayoutBatch.batch_number.like(f"RCTI-{year}-%"))
        res = await db.execute(stmt)
        count = res.scalar_one() or 0
        return f"RCTI-{year}-{count + 1:04d}"

    @staticmethod
    async def generate_invoice_for_booking(
        db: AsyncSession,
        booking_id: str,
        due_days: int = 14,
        actor: Optional[User] = None
    ) -> Invoice:
        """
        Creates an Official Australian Tax Invoice for a master booking.
        Enforces 10% GST breakdown and line item itemization.
        """
        # Check existing invoice
        stmt = (
            select(Invoice)
            .where(Invoice.booking_id == booking_id)
            .options(selectinload(Invoice.line_items), selectinload(Invoice.payments))
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing

        booking_stmt = (
            select(Booking)
            .where(Booking.id == booking_id)
            .options(
                selectinload(Booking.customer),
                selectinload(Booking.legs),
                selectinload(Booking.payments)
            )
        )
        b_res = await db.execute(booking_stmt)
        booking = b_res.scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")

        customer_id = booking.customer_id
        if not customer_id:
            # Look up or create Customer entity if passenger only
            c_stmt = select(Customer).where(Customer.email == (booking.passenger_email or "guest@chauffeur.com"))
            c_res = await db.execute(c_stmt)
            cust = c_res.scalar_one_or_none()
            if not cust:
                cust = Customer(
                    full_name=booking.passenger_name or "Guest Client",
                    email=booking.passenger_email or "guest@chauffeur.com",
                    phone=booking.passenger_phone or "+61400000000"
                )
                db.add(cust)
                await db.flush()
            customer_id = cust.id
            booking.customer_id = customer_id

        inv_num = await AccountingService.generate_invoice_number(db)
        now = utc_now()
        due_date = now + timedelta(days=due_days)

        gross = booking.total_fare
        subtotal, gst = calculate_australian_gst(gross)
        amount_paid = booking.paid_amount
        balance_due = max(0.0, round(gross - amount_paid, 2))

        inv_status = InvoiceStatus.PAID if balance_due <= 0.001 else (
            InvoiceStatus.PARTIALLY_PAID if amount_paid > 0 else InvoiceStatus.ISSUED
        )

        invoice = Invoice(
            id=str(uuid.uuid4()),
            invoice_number=inv_num,
            booking_id=booking.id,
            customer_id=customer_id,
            status=inv_status,
            issue_date=now,
            due_date=due_date,
            subtotal_ex_gst=subtotal,
            gst_amount=gst,
            total_inc_gst=gross,
            amount_paid=amount_paid,
            balance_due=balance_due,
            currency="AUD",
            paid_at=now if inv_status == InvoiceStatus.PAID else None
        )

        # Line Items
        for leg in booking.legs:
            leg_gross = round(gross / max(1, len(booking.legs)), 2)
            l_sub, l_gst = calculate_australian_gst(leg_gross)
            desc_text = f"Chauffeur Transfer: {leg.pickup_address} → {leg.dropoff_address} ({leg.vehicle_category.value})"
            if leg.is_airport_pickup:
                desc_text += " [Airport Meet & Greet Included]"

            line = InvoiceLineItem(
                id=str(uuid.uuid4()),
                invoice_id=invoice.id,
                description=desc_text,
                quantity=1,
                unit_price_ex_gst=l_sub,
                gst_amount=l_gst,
                total_inc_gst=leg_gross
            )
            invoice.line_items.append(line)

            # Excess Wait Time Line Item if applicable
            if leg.wait_time_charge > 0:
                w_sub, w_gst = calculate_australian_gst(leg.wait_time_charge)
                w_line = InvoiceLineItem(
                    id=str(uuid.uuid4()),
                    invoice_id=invoice.id,
                    description=f"Additional Wait Time ({leg.wait_time_minutes} mins)",
                    quantity=1,
                    unit_price_ex_gst=w_sub,
                    gst_amount=w_gst,
                    total_inc_gst=leg.wait_time_charge
                )
                invoice.line_items.append(w_line)

        # Link existing booking payments to this invoice
        for p in booking.payments:
            p.invoice_id = invoice.id

        db.add(invoice)
        await db.commit()
        await db.refresh(invoice)
        return invoice

    @staticmethod
    async def list_invoices(
        db: AsyncSession,
        status_filter: Optional[InvoiceStatus] = None,
        customer_id: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50
    ) -> InvoiceListResponse:
        """Queries tax invoices with filters and outstanding debt summation."""
        stmt = select(Invoice).options(selectinload(Invoice.line_items), selectinload(Invoice.payments))

        if status_filter:
            stmt = stmt.where(Invoice.status == status_filter)
        if customer_id:
            stmt = stmt.where(Invoice.customer_id == customer_id)
        if date_from and date_to:
            stmt = stmt.where(Invoice.issue_date >= date_from, Invoice.issue_date <= date_to)

        stmt = stmt.order_by(desc(Invoice.issue_date))
        res = await db.execute(stmt.offset(skip).limit(limit))
        invoices = list(res.scalars().all())

        # Total outstanding balance query
        bal_stmt = select(func.coalesce(func.sum(Invoice.balance_due), 0.0)).where(
            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE])
        )
        if customer_id:
            bal_stmt = bal_stmt.where(Invoice.customer_id == customer_id)
        bal_res = await db.execute(bal_stmt)
        total_balance = float(bal_res.scalar_one() or 0.0)

        return InvoiceListResponse(
            invoices=invoices,
            total_count=len(invoices),
            total_outstanding_balance=round(total_balance, 2)
        )

    @staticmethod
    async def get_invoice_by_id(db: AsyncSession, invoice_id: str) -> Invoice:
        """Retrieves invoice by ID."""
        stmt = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(
                selectinload(Invoice.line_items),
                selectinload(Invoice.payments),
                selectinload(Invoice.customer),
                selectinload(Invoice.booking)
            )
        )
        res = await db.execute(stmt)
        inv = res.scalar_one_or_none()
        if not inv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")
        return inv

    @staticmethod
    async def void_invoice(
        db: AsyncSession,
        invoice_id: str,
        reason: str,
        actor: Optional[User] = None
    ) -> Invoice:
        """Voids an issued tax invoice."""
        inv = await AccountingService.get_invoice_by_id(db, invoice_id)
        if inv.status == InvoiceStatus.PAID:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot void a fully paid invoice. Process a refund or credit note instead."
            )

        inv.status = InvoiceStatus.VOID
        inv.notes = f"{inv.notes or ''} [VOIDED: {reason}]".strip()
        await db.commit()
        await db.refresh(inv)
        return inv

    @staticmethod
    async def allocate_fifo_payment(
        db: AsyncSession,
        req: FIFOPaymentAllocationRequest,
        actor: Optional[User] = None
    ) -> FIFOPaymentAllocationResponse:
        """
        OLDEST-INVOICE-FIRST (FIFO) Debt Allocation Engine:
        Sorts unpaid invoices by issue_date ASC and sequentially clears balances.
        """
        stmt = (
            select(Invoice)
            .where(
                Invoice.customer_id == req.customer_id,
                Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
                Invoice.balance_due > 0.0
            )
            .options(selectinload(Invoice.booking))
            .order_by(Invoice.issue_date.asc())
        )
        res = await db.execute(stmt)
        open_invoices = list(res.scalars().all())

        remaining_payment = req.payment_amount
        total_allocated = 0.0
        allocations: List[FIFOAllocationItem] = []
        now = utc_now()

        for inv in open_invoices:
            if remaining_payment <= 0.001:
                break

            prev_balance = inv.balance_due
            alloc_amount = min(remaining_payment, prev_balance)
            alloc_amount = round(alloc_amount, 2)

            inv.amount_paid = round(inv.amount_paid + alloc_amount, 2)
            inv.balance_due = max(0.0, round(prev_balance - alloc_amount, 2))

            if inv.balance_due <= 0.001:
                inv.status = InvoiceStatus.PAID
                inv.paid_at = now
            else:
                inv.status = InvoiceStatus.PARTIALLY_PAID

            # Record Payment Transaction in ledger
            tx = PaymentTransaction(
                id=str(uuid.uuid4()),
                booking_id=inv.booking_id or "",
                customer_id=req.customer_id,
                invoice_id=inv.id,
                amount=alloc_amount,
                currency=inv.currency,
                payment_type="FIFO_BALANCE_ALLOCATION",
                payment_method=req.payment_method,
                status="COMPLETED",
                reference_number=req.reference_number,
                notes=f"FIFO Payment allocated from total ${req.payment_amount:.2f}"
            )
            db.add(tx)

            # Synchronize linked master booking if present
            if inv.booking:
                b = inv.booking
                b.paid_amount = round(b.paid_amount + alloc_amount, 2)
                b.balance_amount = max(0.0, round(b.total_fare - b.paid_amount, 2))
                if b.balance_amount <= 0.001:
                    b.payment_status = PaymentStatus.PAID_IN_FULL
                else:
                    b.payment_status = PaymentStatus.PARTIAL_DEPOSIT

            remaining_payment = round(remaining_payment - alloc_amount, 2)
            total_allocated = round(total_allocated + alloc_amount, 2)

            allocations.append(
                FIFOAllocationItem(
                    invoice_id=inv.id,
                    invoice_number=inv.invoice_number,
                    allocated_amount=alloc_amount,
                    previous_balance=prev_balance,
                    new_balance=inv.balance_due,
                    status=inv.status
                )
            )

        await db.commit()

        return FIFOPaymentAllocationResponse(
            customer_id=req.customer_id,
            total_payment_amount=req.payment_amount,
            total_allocated=total_allocated,
            unallocated_credit=max(0.0, remaining_payment),
            allocations=allocations
        )

    @staticmethod
    async def generate_driver_payout_batch(
        db: AsyncSession,
        req: DriverPayoutBatchCreate,
        actor: Optional[User] = None
    ) -> DriverPayoutBatch:
        """
        Creates Driver RCTI (Recipient Created Tax Invoice) Payout Batch.
        Batches completed & settled legs, calculating gross, GST credits, and net payout.
        """
        driver = await db.get(Driver, req.driver_id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found.")

        stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.driver_id == req.driver_id,
                BookingLeg.status == LegStatus.COMPLETED
            )
        )
        res = await db.execute(stmt)
        all_completed_legs = list(res.scalars().all())

        start_utc = ensure_utc(req.period_start)
        end_utc = ensure_utc(req.period_end)

        legs = [
            l for l in all_completed_legs
            if l.completed_at and start_utc <= ensure_utc(l.completed_at) <= end_utc
        ]

        if not legs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No completed trip legs found for this driver within the specified pay period."
            )

        gross_payout = sum(leg.allocation_cost for leg in legs)
        gst_credit = round(gross_payout * 0.10, 2) if req.gst_registered else 0.0
        withholding = 0.0  # Optional PAYG withholding
        net_disbursed = round(gross_payout + gst_credit - withholding, 2)

        batch_num = await AccountingService.generate_rcti_number(db)
        now = utc_now()

        batch = DriverPayoutBatch(
            id=str(uuid.uuid4()),
            batch_number=batch_num,
            driver_id=req.driver_id,
            status=PayoutBatchStatus.APPROVED,
            period_start=req.period_start,
            period_end=req.period_end,
            total_legs_count=len(legs),
            gross_payout_amount=round(gross_payout, 2),
            gst_credit_amount=gst_credit,
            withholding_tax_amount=withholding,
            net_disbursed_amount=net_disbursed,
            rcti_reference=f"RCTI-{driver.license_number}-{batch_num}",
            notes=req.notes,
            disbursed_at=now
        )

        # Mark legs as settled
        for leg in legs:
            leg.settled_at = now
            leg.settlement_notes = f"Settled in Batch {batch_num}"

        db.add(batch)
        await db.commit()
        await db.refresh(batch)
        return batch

    @staticmethod
    async def get_tax_summary_report(
        db: AsyncSession,
        period_label: str,
        date_from: datetime,
        date_to: datetime
    ) -> TaxSummaryBASReport:
        """
        Generates Australian Business Activity Statement (BAS) GST Summary.
        """
        # Sum paid sales invoices
        sales_stmt = select(Invoice).where(
            Invoice.status.in_([InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID])
        )
        sales_res = await db.execute(sales_stmt)
        all_invoices = list(sales_res.scalars().all())

        from_utc = ensure_utc(date_from)
        to_utc = ensure_utc(date_to)

        filtered_invoices = [
            inv for inv in all_invoices
            if from_utc <= ensure_utc(inv.issue_date) <= to_utc
        ]
        gross_sales = sum(inv.total_inc_gst for inv in filtered_invoices)
        subtotal_sales, gst_collected = calculate_australian_gst(gross_sales)

        # Sum driver payouts
        payout_stmt = select(DriverPayoutBatch).where(
            DriverPayoutBatch.status.in_([PayoutBatchStatus.APPROVED, PayoutBatchStatus.DISBURSED])
        )
        payout_res = await db.execute(payout_stmt)
        all_payouts = list(payout_res.scalars().all())

        filtered_payouts = [
            p for p in all_payouts
            if from_utc <= ensure_utc(p.period_start) and ensure_utc(p.period_end) <= to_utc
        ]
        driver_payouts = sum(p.net_disbursed_amount for p in filtered_payouts)

        net_margin = round(subtotal_sales - driver_payouts, 2)

        return TaxSummaryBASReport(
            period_label=period_label,
            gross_sales_inc_gst=round(gross_sales, 2),
            gst_collected_10pct=gst_collected,
            net_sales_ex_gst=subtotal_sales,
            driver_payouts_total=round(driver_payouts, 2),
            net_operating_margin=net_margin
        )
