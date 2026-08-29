from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.enums import BookingStatus, PaymentStatus
from app.schemas.notification import AutomationRunSummary
from app.services.notification_service import NotificationService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AutomationService:
    """
    Automated job runner executing:
    1. 7/5/3-day balance chasing engine with idempotency tracking
    2. 12-24 hour pre-trip customer confirmation reminders:
       - Midnight to 8am trips: Sent at 10am on the day prior.
       - 8am to Midnight trips: Sent at 2pm on the day prior.
    3. 2-hour pre-trip driver handover package dispatching
    4. Cancellation circuit breaker protection
    """

    @staticmethod
    async def process_pre_trip_confirmation_reminders(
        db: AsyncSession,
        reference_now: Optional[datetime] = None
    ) -> AutomationRunSummary:
        """
        Scans bookings due in 12-24 hours and dispatches automated customer confirmation reminders:
        - Bookings due Midnight (00:00) to 8:00 AM: Notification scheduled for 10:00 AM on the day prior.
        - Bookings due 8:00 AM to Midnight (23:59): Notification scheduled for 2:00 PM (14:00) on the day prior.
        """
        now = ensure_utc(reference_now or utc_now())
        summary = AutomationRunSummary()

        stmt = (
            select(Booking)
            .where(
                Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.FINANCIALLY_CLOSED]),
                Booking.customer_reminder_12_24h_sent == False  # noqa: E712
            )
            .options(
                selectinload(Booking.customer),
                selectinload(Booking.legs)
            )
        )
        res = await db.execute(stmt)
        bookings = list(res.scalars().all())

        for booking in bookings:
            if not booking.legs:
                continue

            first_leg = booking.legs[0]
            pickup_dt = ensure_utc(first_leg.pickup_datetime)

            # If pickup is already in the past, skip
            if pickup_dt <= now:
                continue

            pickup_hour = pickup_dt.hour
            pickup_date = pickup_dt.date()

            # Rule 1: Midnight till 8am (0 <= pickup_hour < 8)
            # Notification time: 10:00 AM on the day prior
            if 0 <= pickup_hour < 8:
                day_prior = pickup_date - timedelta(days=1)
                trigger_time = datetime(day_prior.year, day_prior.month, day_prior.day, 10, 0, 0, tzinfo=timezone.utc)
                if trigger_time <= now < pickup_dt:
                    await NotificationService.send_customer_pre_trip_confirmation_reminder(
                        db, booking, first_leg, scheduled_window_label="Midnight-8am (10am Pre-Trip)"
                    )
                    booking.customer_reminder_12_24h_sent = True
                    summary.confirmation_reminders_count += 1
                    summary.total_processed += 1

            # Rule 2: 8am till Midnight (8 <= pickup_hour <= 23)
            # Notification time: 2:00 PM (14:00) on the day prior
            else:
                day_prior = pickup_date - timedelta(days=1)
                trigger_time = datetime(day_prior.year, day_prior.month, day_prior.day, 14, 0, 0, tzinfo=timezone.utc)
                if trigger_time <= now < pickup_dt:
                    await NotificationService.send_customer_pre_trip_confirmation_reminder(
                        db, booking, first_leg, scheduled_window_label="8am-Midnight (2pm Pre-Trip)"
                    )
                    booking.customer_reminder_12_24h_sent = True
                    summary.confirmation_reminders_count += 1
                    summary.total_processed += 1

        await db.commit()
        return summary

    @staticmethod
    async def process_balance_chasing(
        db: AsyncSession,
        reference_now: Optional[datetime] = None
    ) -> AutomationRunSummary:
        """
        Scans bookings with outstanding balance and dispatches milestone payment reminders.
        """
        now = ensure_utc(reference_now or utc_now())
        summary = AutomationRunSummary()

        # Query active bookings with outstanding balance
        stmt = (
            select(Booking)
            .where(
                Booking.status.notin_([BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.FINANCIALLY_CLOSED]),
                Booking.balance_amount > 0.0
            )
            .options(
                selectinload(Booking.legs),
                selectinload(Booking.customer)
            )
        )
        res = await db.execute(stmt)
        bookings = list(res.scalars().all())

        for booking in bookings:
            if not booking.legs:
                continue

            first_leg = booking.legs[0]
            pickup_time = ensure_utc(first_leg.pickup_datetime)
            time_diff = pickup_time - now
            hours_until_pickup = time_diff.total_seconds() / 3600.0

            sent_reminders = list(booking.balance_reminders_sent or [])
            summary.total_processed += 1

            # Milestone 3 Days (<= 72 hours)
            if 0 < hours_until_pickup <= 72.0:
                if "3_DAYS" not in sent_reminders:
                    await NotificationService.send_balance_reminder(db, booking, "3_DAYS")
                    sent_reminders.append("3_DAYS")
                    booking.balance_reminders_sent = sent_reminders
                    summary.milestone_3d_count += 1

            # Milestone 5 Days (<= 120 hours)
            elif 72.0 < hours_until_pickup <= 120.0:
                if "5_DAYS" not in sent_reminders:
                    await NotificationService.send_balance_reminder(db, booking, "5_DAYS")
                    sent_reminders.append("5_DAYS")
                    booking.balance_reminders_sent = sent_reminders
                    summary.milestone_5d_count += 1

            # Milestone 7 Days (<= 168 hours)
            elif 120.0 < hours_until_pickup <= 168.0:
                if "7_DAYS" not in sent_reminders:
                    await NotificationService.send_balance_reminder(db, booking, "7_DAYS")
                    sent_reminders.append("7_DAYS")
                    booking.balance_reminders_sent = sent_reminders
                    summary.milestone_7d_count += 1

            # Critical Overdue Escalation (<= 24 hours & unpaid)
            if 0 < hours_until_pickup <= 24.0 and booking.payment_status != PaymentStatus.OVERDUE:
                booking.payment_status = PaymentStatus.OVERDUE
                summary.overdue_escalations += 1

        await db.commit()
        return summary

    @staticmethod
    async def process_pre_trip_handovers(
        db: AsyncSession,
        reference_now: Optional[datetime] = None
    ) -> AutomationRunSummary:
        """
        Scans bookings scheduled within 2 hours and dispatches Chauffeur Handover packages.
        """
        now = ensure_utc(reference_now or utc_now())
        summary = AutomationRunSummary()

        stmt = (
            select(Booking)
            .where(
                Booking.status.in_([BookingStatus.ALLOCATED, BookingStatus.DISPATCHED]),
                Booking.driver_handover_sent == False  # noqa: E712
            )
            .options(
                selectinload(Booking.customer),
                selectinload(Booking.legs).selectinload(BookingLeg.driver),
                selectinload(Booking.legs).selectinload(BookingLeg.vehicle),
                selectinload(Booking.legs).selectinload(BookingLeg.partner)
            )
        )
        res = await db.execute(stmt)
        bookings = list(res.scalars().all())

        for booking in bookings:
            if not booking.legs:
                continue

            first_leg = booking.legs[0]
            pickup_time = ensure_utc(first_leg.pickup_datetime)
            hours_until_pickup = (pickup_time - now).total_seconds() / 3600.0

            # Handover window: within 2.5 hours before pickup (and not in past)
            if -0.25 <= hours_until_pickup <= 2.5:
                # Must have an assigned driver or partner
                if first_leg.driver_id or first_leg.partner_id:
                    await NotificationService.send_pre_trip_handover_package(db, booking, first_leg)
                    booking.driver_handover_sent = True
                    summary.driver_handovers_count += 1
                    summary.total_processed += 1

        await db.commit()
        return summary
