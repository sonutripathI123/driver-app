import uuid
from datetime import date, datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.driver import Driver
from app.models.enums import (
    AuditAction,
    BookingStatus,
    DriverStatus,
    LegStatus,
)
from app.models.user import User
from app.schemas.driver_portal import (
    DriverEarningsSummary,
    DriverJobItem,
    DriverPortalProfile,
)
from app.services.notification_service import NotificationService, get_customer_contact


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DriverPortalService:
    @staticmethod
    async def get_driver_by_user(db: AsyncSession, user: User) -> Driver:
        """Resolves authenticated Driver entity from the current User account."""
        stmt = (
            select(Driver)
            .where(or_(Driver.user_id == user.id, Driver.email == user.email))
            .options(selectinload(Driver.default_vehicle))
        )
        res = await db.execute(stmt)
        driver = res.scalar_one_or_none()
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Driver profile not found for the authenticated user."
            )
        if driver.user_id != user.id:
            driver.user_id = user.id
            await db.commit()
            await db.refresh(driver)
        return driver

    @staticmethod
    async def update_shift_status(
        db: AsyncSession,
        driver_id: str,
        new_status: DriverStatus
    ) -> Driver:
        """Toggles driver shift availability (AVAILABLE, OFF_DUTY, ON_TRIP)."""
        driver = await db.get(Driver, driver_id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found.")

        driver.status = new_status
        await db.commit()
        await db.refresh(driver)
        return driver

    @staticmethod
    async def update_gps_location(
        db: AsyncSession,
        driver_id: str,
        lat: float,
        lng: float
    ) -> Driver:
        """Updates live GPS telemetry coordinates for driver fleet tracking."""
        driver = await db.get(Driver, driver_id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found.")

        driver.current_lat = lat
        driver.current_lng = lng
        driver.location_updated_at = utc_now()
        await db.commit()
        await db.refresh(driver)
        return driver

    @staticmethod
    async def get_driver_manifest(
        db: AsyncSession,
        driver_id: str,
        filter_mode: str = "ALL"  # "TODAY", "UPCOMING", "COMPLETED", "ALL"
    ) -> List[DriverJobItem]:
        """
        Retrieves driver's assigned jobs with strict privacy shielding.
        Company revenue and customer margins are completely hidden from the driver.
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.driver_id == driver_id)
            .options(
                selectinload(BookingLeg.booking).selectinload(Booking.customer),
                selectinload(BookingLeg.vehicle)
            )
            .order_by(BookingLeg.pickup_datetime.asc())
        )

        now = utc_now()
        today_start = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
        today_end = datetime.combine(now.date(), datetime.max.time(), tzinfo=timezone.utc)

        if filter_mode.upper() == "TODAY":
            stmt = stmt.where(
                BookingLeg.pickup_datetime >= today_start,
                BookingLeg.pickup_datetime <= today_end
            )
        elif filter_mode.upper() == "UPCOMING":
            stmt = stmt.where(
                BookingLeg.status.in_([LegStatus.PENDING, LegStatus.ALLOCATED, LegStatus.DISPATCHED, LegStatus.EN_ROUTE, LegStatus.ARRIVED, LegStatus.PICKED_UP]),
                BookingLeg.pickup_datetime >= today_start
            )
        elif filter_mode.upper() == "COMPLETED":
            stmt = stmt.where(BookingLeg.status == LegStatus.COMPLETED)

        res = await db.execute(stmt)
        legs = list(res.scalars().all())

        items: List[DriverJobItem] = []
        for leg in legs:
            b = leg.booking
            cust_name, cust_email, cust_phone = get_customer_contact(b) if b else ("Client", None, None)
            veh = leg.vehicle

            items.append(
                DriverJobItem(
                    id=leg.id,
                    booking_id=b.id if b else "",
                    booking_number=b.booking_number if b else "",
                    leg_number=leg.leg_number,
                    status=leg.status,
                    pickup_datetime=leg.pickup_datetime,
                    pickup_address=leg.pickup_address,
                    dropoff_address=leg.dropoff_address,
                    distance_km=leg.distance_km,
                    duration_minutes=leg.duration_minutes,
                    vehicle_category=leg.vehicle_category,
                    vehicle_plate=veh.registration_plate if veh else None,
                    vehicle_name=f"{veh.make} {veh.model}" if veh else None,
                    passenger_name=b.passenger_name if b else cust_name,
                    passenger_phone=b.passenger_phone if b else cust_phone,
                    passenger_count=b.passenger_count if b else 1,
                    luggage_count=b.luggage_count if b else 0,
                    flight_number=leg.flight_number,
                    pickup_notes=leg.pickup_notes,
                    special_instructions=b.special_instructions if b else None,
                    allocation_payout=leg.allocation_cost,
                    allocated_at=leg.allocated_at,
                    dispatched_at=leg.dispatched_at,
                    en_route_at=leg.en_route_at,
                    arrived_at=leg.arrived_at,
                    picked_up_at=leg.picked_up_at,
                    completed_at=leg.completed_at,
                    settled_at=leg.settled_at
                )
            )

        return items

    @staticmethod
    async def step_trip_status(
        db: AsyncSession,
        driver_id: str,
        leg_id: str,
        target_status: LegStatus,
        actor: Optional[User] = None
    ) -> BookingLeg:
        """
        One-Tap Sequential Trip Stepper:
        EN_ROUTE -> ARRIVED -> PICKED_UP -> COMPLETED
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.id == leg_id, BookingLeg.driver_id == driver_id)
            .options(
                selectinload(BookingLeg.booking).selectinload(Booking.legs),
                selectinload(BookingLeg.booking).selectinload(Booking.customer),
                selectinload(BookingLeg.driver),
                selectinload(BookingLeg.vehicle)
            )
        )
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job leg not found or not assigned to you."
            )

        curr = leg.status
        booking = leg.booking
        driver = leg.driver
        now = utc_now()

        if target_status == LegStatus.EN_ROUTE:
            if curr not in (LegStatus.ALLOCATED, LegStatus.DISPATCHED):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot start 'EN_ROUTE' from state '{curr.value}'."
                )
            leg.status = LegStatus.EN_ROUTE
            leg.en_route_at = now
            if driver:
                driver.status = DriverStatus.ON_TRIP
            if booking:
                booking.status = BookingStatus.EN_ROUTE

        elif target_status == LegStatus.ARRIVED:
            if curr != LegStatus.EN_ROUTE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark 'ARRIVED' from state '{curr.value}'. Trip must be EN_ROUTE first."
                )
            leg.status = LegStatus.ARRIVED
            leg.arrived_at = now
            if booking:
                booking.status = BookingStatus.ARRIVED
                # Send arrival notification to passenger/customer
                cust_name, _, cust_phone = get_customer_contact(booking)
                if cust_phone:
                    veh_info = f"{leg.vehicle.color} {leg.vehicle.make} (Plate: {leg.vehicle.registration_plate})" if leg.vehicle else "Chauffeur Vehicle"
                    msg = f"Crown Chauffeur: Your chauffeur {driver.full_name if driver else ''} has arrived at {leg.pickup_address}. Vehicle: {veh_info}."
                    await NotificationService.record_and_dispatch_sms(
                        db, cust_phone, "CHAUFFEUR_ARRIVED_SMS", msg, booking.id
                    )

        elif target_status == LegStatus.PICKED_UP:
            if curr != LegStatus.ARRIVED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark 'PICKED_UP' from state '{curr.value}'. Chauffeur must be ARRIVED first."
                )
            leg.status = LegStatus.PICKED_UP
            leg.picked_up_at = now
            if booking:
                booking.status = BookingStatus.PICKED_UP

        elif target_status == LegStatus.COMPLETED:
            if curr != LegStatus.PICKED_UP:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot mark 'COMPLETED' from state '{curr.value}'. Passenger must be PICKED_UP first."
                )
            leg.status = LegStatus.COMPLETED
            leg.completed_at = now
            if driver:
                driver.completed_trips_count += 1
                driver.status = DriverStatus.AVAILABLE

            # Check if all legs in master booking are finished
            if booking:
                all_done = all(l.status == LegStatus.COMPLETED for l in booking.legs)
                if all_done:
                    booking.status = BookingStatus.COMPLETED

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported trip transition to '{target_status.value}'."
            )

        # Audit Log
        if booking:
            audit = AuditLog(
                id=str(uuid.uuid4()),
                booking_id=booking.id,
                entity_type="BookingLeg",
                entity_id=leg.id,
                action=AuditAction.STATUS_CHANGE,
                actor_id=actor.id if actor else None,
                actor_role="DRIVER",
                actor_email=actor.email if actor else (driver.email if driver else "driver@app"),
                old_values={"status": curr.value},
                new_values={"status": leg.status.value},
                reason=f"Driver stepped trip to {leg.status.value}"
            )
            booking.audit_logs.append(audit)

            # Dispatch Real-Time Mobile Alert to Manager's Phone
            drv_title = f"Chauffeur Update: {target_status.value} — #{booking.booking_number}"
            drv_body = f"Chauffeur: {driver.full_name if driver else 'Chauffeur'}\nPassenger: {booking.passenger_name}\nLocation: {leg.pickup_address} -> {leg.dropoff_address}"
            await NotificationService.dispatch_manager_mobile_alert(
                db=db,
                event_type=target_status.value,
                title=drv_title,
                message=drv_body,
                booking_id=booking.id
            )

        await db.commit()
        await db.refresh(leg)
        return leg

    @staticmethod
    async def get_driver_earnings_summary(
        db: AsyncSession,
        driver_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> DriverEarningsSummary:
        """Aggregates completed trip earnings and settlement status for driver statement."""
        stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.driver_id == driver_id,
                BookingLeg.status == LegStatus.COMPLETED
            )
            .options(
                selectinload(BookingLeg.booking).selectinload(Booking.customer),
                selectinload(BookingLeg.vehicle)
            )
            .order_by(desc(BookingLeg.completed_at))
        )

        if date_from and date_to:
            stmt = stmt.where(BookingLeg.completed_at >= date_from, BookingLeg.completed_at <= date_to)

        res = await db.execute(stmt)
        legs = list(res.scalars().all())

        total_earnings = 0.0
        pending_payout = 0.0
        settled_payout = 0.0
        items: List[DriverJobItem] = []

        for leg in legs:
            b = leg.booking
            payout = leg.allocation_cost
            total_earnings += payout
            if leg.settled_at:
                settled_payout += payout
            else:
                pending_payout += payout

            cust_name, _, cust_phone = get_customer_contact(b) if b else ("Client", None, None)
            veh = leg.vehicle

            items.append(
                DriverJobItem(
                    id=leg.id,
                    booking_id=b.id if b else "",
                    booking_number=b.booking_number if b else "",
                    leg_number=leg.leg_number,
                    status=leg.status,
                    pickup_datetime=leg.pickup_datetime,
                    pickup_address=leg.pickup_address,
                    dropoff_address=leg.dropoff_address,
                    distance_km=leg.distance_km,
                    duration_minutes=leg.duration_minutes,
                    vehicle_category=leg.vehicle_category,
                    vehicle_plate=veh.registration_plate if veh else None,
                    vehicle_name=f"{veh.make} {veh.model}" if veh else None,
                    passenger_name=b.passenger_name if b else cust_name,
                    passenger_phone=b.passenger_phone if b else cust_phone,
                    allocation_payout=payout,
                    completed_at=leg.completed_at,
                    settled_at=leg.settled_at
                )
            )

        return DriverEarningsSummary(
            total_completed_trips=len(legs),
            total_earnings=round(total_earnings, 2),
            pending_payout_amount=round(pending_payout, 2),
            settled_payout_amount=round(settled_payout, 2),
            jobs=items
        )
