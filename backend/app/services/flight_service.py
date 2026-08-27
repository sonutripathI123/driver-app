import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.flights import get_flight_provider
from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.enums import AuditAction, LegStatus
from app.models.user import User
from app.schemas.flight import (
    FlightLookupResponse,
    FlightSyncLegResponse,
    FlightWaitTimeRequest,
    FlightWaitTimeResponse,
)
from app.services.notification_service import NotificationService


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class FlightTrackingService:
    """
    Live flight tracking synchronization, automated pickup rescheduling on delays,
    and complimentary meet & greet wait-time calculator.
    """

    @staticmethod
    async def lookup_flight(
        flight_number: str,
        flight_date: Optional[date] = None
    ) -> FlightLookupResponse:
        """Queries live flight provider for current flight status."""
        provider = get_flight_provider()
        data = await provider.get_flight_status(flight_number, flight_date)
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Flight details not found for '{flight_number}'."
            )
        return FlightLookupResponse(
            flight_number=data.flight_number,
            airline=data.airline,
            origin_airport=data.origin_airport,
            destination_airport=data.destination_airport,
            terminal=data.terminal,
            scheduled_arrival=data.scheduled_arrival,
            estimated_arrival=data.estimated_arrival,
            actual_arrival=data.actual_arrival,
            status=data.status,
            delay_minutes=data.delay_minutes
        )

    @staticmethod
    async def sync_leg_flight_status(
        db: AsyncSession,
        leg_id: str,
        actor: Optional[User] = None
    ) -> FlightSyncLegResponse:
        """
        Synchronizes a booking leg with real-time flight tracking data.
        If delayed by >15 minutes, automatically reschedules pickup time and alerts driver & Ops.
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.id == leg_id)
            .options(
                selectinload(BookingLeg.booking),
                selectinload(BookingLeg.driver),
                selectinload(BookingLeg.vehicle)
            )
        )
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking leg not found.")

        if not leg.flight_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Leg does not have a flight number assigned."
            )

        provider = get_flight_provider()
        flight_data = await provider.get_flight_status(
            leg.flight_number,
            leg.pickup_datetime.date()
        )
        if not flight_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Live flight data unavailable for '{leg.flight_number}'."
            )

        old_pickup = ensure_utc(leg.pickup_datetime)
        new_pickup = old_pickup
        schedule_adjusted = False
        notes = f"Flight status: {flight_data.status}."

        # Update flight metadata
        leg.airline = flight_data.airline
        leg.flight_terminal = flight_data.terminal
        leg.flight_scheduled_arrival = flight_data.scheduled_arrival
        leg.flight_actual_arrival = flight_data.actual_arrival or flight_data.estimated_arrival
        leg.flight_status = flight_data.status
        leg.flight_delay_minutes = flight_data.delay_minutes

        # Automated Delay Handling: If delayed by >= 15 mins, adjust pickup time
        if flight_data.delay_minutes >= 15:
            # Add standard buffer: 30 minutes after new estimated landing
            landing_time = ensure_utc(flight_data.estimated_arrival)
            buffer_mins = 45 if "Terminal 2" in (flight_data.terminal or "") else 30
            new_pickup = landing_time + timedelta(minutes=buffer_mins)
            leg.pickup_datetime = new_pickup
            schedule_adjusted = True
            notes += f" Delayed by {flight_data.delay_minutes}m. Pickup rescheduled to {new_pickup.strftime('%I:%M %p')}."

            # Alert Driver via SMS if assigned
            if leg.driver and leg.driver.phone:
                sms_msg = f"Crown Chauffeur Alert: Flight {leg.flight_number} delayed +{flight_data.delay_minutes}m. New pickup: {new_pickup.strftime('%I:%M %p')} at {leg.flight_terminal or 'Airport'}."
                await NotificationService.record_and_dispatch_sms(
                    db, leg.driver.phone, "FLIGHT_DELAY_DRIVER_SMS", sms_msg, leg.booking_id
                )

        # Critical Cancellation Handling
        if flight_data.status == "CANCELLED":
            notes += " FLIGHT CANCELLED by airline."
            ops_alert = f"[CRITICAL OPS ALERT] Inbound Flight {leg.flight_number} for Booking #{leg.booking.booking_number} is CANCELLED."
            await NotificationService.record_and_dispatch_email(
                db, NotificationService.OPS_EMAIL, "FLIGHT_CANCELLED_OPS_ALERT", ops_alert, ops_alert, leg.booking_id
            )

        if schedule_adjusted:
            audit = AuditLog(
                id=str(uuid.uuid4()),
                booking_id=leg.booking_id,
                entity_type="BookingLeg",
                entity_id=leg.id,
                action=AuditAction.UPDATE,
                actor_id=actor.id if actor else None,
                actor_role=actor.role.value if actor else "FLIGHT_BOT",
                actor_email=actor.email if actor else "flight-tracking@system",
                old_values={"pickup_datetime": old_pickup.isoformat()},
                new_values={
                    "pickup_datetime": new_pickup.isoformat(),
                    "flight_delay_minutes": flight_data.delay_minutes,
                    "flight_status": flight_data.status
                },
                reason=f"Automated flight schedule adjustment (+{flight_data.delay_minutes}m delay)"
            )
            leg.booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(leg)

        return FlightSyncLegResponse(
            leg_id=leg.id,
            booking_id=leg.booking.id,
            booking_number=leg.booking.booking_number,
            flight_number=leg.flight_number,
            airline=leg.airline,
            terminal=leg.flight_terminal,
            flight_status=leg.flight_status,
            delay_minutes=leg.flight_delay_minutes,
            old_pickup_datetime=old_pickup,
            new_pickup_datetime=new_pickup,
            schedule_adjusted=schedule_adjusted,
            notes=notes
        )

    @staticmethod
    async def poll_all_active_airport_legs(
        db: AsyncSession
    ) -> List[FlightSyncLegResponse]:
        """
        Automated cron engine: Scans upcoming airport arrivals and syncs live flight statuses.
        """
        now = utc_now()
        horizon = now + timedelta(hours=24)

        stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.is_airport_pickup == True,  # noqa: E712
                BookingLeg.flight_number != None,
                BookingLeg.status.notin_([LegStatus.CANCELLED, LegStatus.COMPLETED]),
                BookingLeg.pickup_datetime >= now - timedelta(hours=2),
                BookingLeg.pickup_datetime <= horizon
            )
        )
        res = await db.execute(stmt)
        legs = list(res.scalars().all())

        results: List[FlightSyncLegResponse] = []
        for leg in legs:
            try:
                sync_res = await FlightTrackingService.sync_leg_flight_status(db, leg.id)
                results.append(sync_res)
            except Exception:
                continue

        return results

    @staticmethod
    def calculate_wait_time(
        req: FlightWaitTimeRequest
    ) -> FlightWaitTimeResponse:
        """
        Calculates complimentary vs billable wait time:
        - Airport: 60 minutes free from aircraft touchdown (wheels down) or chauffeur arrival
        - Standard: 15 minutes free from chauffeur arrival
        """
        arrived = ensure_utc(req.arrived_at)
        boarded = ensure_utc(req.passenger_boarded_at)

        if req.is_airport_pickup:
            complimentary_mins = 60
            # Wait time starts when aircraft touches down or chauffeur arrives (whichever is later)
            if req.flight_actual_arrival:
                touchdown = ensure_utc(req.flight_actual_arrival)
                wait_start = max(arrived, touchdown)
            else:
                wait_start = arrived
        else:
            complimentary_mins = 15
            wait_start = arrived

        total_wait_secs = max(0, (boarded - wait_start).total_seconds())
        total_wait_mins = int(total_wait_secs / 60)
        billable_mins = max(0, total_wait_mins - complimentary_mins)

        rate_per_min = round(req.hourly_wait_rate / 60.0, 2)
        charge = round(billable_mins * rate_per_min, 2)

        return FlightWaitTimeResponse(
            is_airport_pickup=req.is_airport_pickup,
            complimentary_minutes=complimentary_mins,
            total_wait_minutes=total_wait_mins,
            billable_wait_minutes=billable_mins,
            wait_time_rate_per_min=rate_per_min,
            wait_time_charge=charge
        )
