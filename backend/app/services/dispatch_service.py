import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
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
    PaymentStatus,
    VehicleCategory,
)
from app.models.partner import Partner
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.dispatch import (
    DriverAvailabilityResponse,
    OperateBoardLegItem,
    OperateBoardResponse,
    OperateBoardSummary,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class DispatchService:
    @staticmethod
    async def check_driver_conflicts(
        db: AsyncSession,
        driver_id: str,
        pickup_datetime: datetime,
        duration_minutes: Optional[int] = None,
        exclude_leg_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Conflict Detection Engine:
        Verifies driver availability and prevents overlapping bookings within safety buffer.
        """
        driver = await db.get(Driver, driver_id)
        if not driver:
            return True, "Driver not found."

        if driver.status == DriverStatus.SUSPENDED:
            return True, f"Driver {driver.full_name} is currently SUSPENDED."

        dur = duration_minutes or 60
        safe_pickup = ensure_utc(pickup_datetime)
        window_start = safe_pickup - timedelta(minutes=45)
        window_end = safe_pickup + timedelta(minutes=dur + 45)

        # Check existing active legs for this driver in time window
        stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.driver_id == driver_id,
                BookingLeg.status.notin_([LegStatus.CANCELLED, LegStatus.COMPLETED]),
                BookingLeg.pickup_datetime >= window_start,
                BookingLeg.pickup_datetime <= window_end
            )
        )
        if exclude_leg_id:
            stmt = stmt.where(BookingLeg.id != exclude_leg_id)

        res = await db.execute(stmt)
        conflicts = list(res.scalars().all())
        if conflicts:
            conflict_leg = conflicts[0]
            conf_time = conflict_leg.pickup_datetime.strftime('%Y-%m-%d %H:%M')
            return True, f"Time conflict: Driver {driver.full_name} is already assigned to Leg #{conflict_leg.leg_number} at {conf_time}."

        return False, None

    @staticmethod
    async def check_vehicle_conflicts(
        db: AsyncSession,
        vehicle_id: str,
        pickup_datetime: datetime,
        duration_minutes: Optional[int] = None,
        exclude_leg_id: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Verifies vehicle availability and prevents fleet double-booking.
        """
        vehicle = await db.get(Vehicle, vehicle_id)
        if not vehicle:
            return True, "Vehicle not found."

        if not vehicle.is_active:
            return True, f"Vehicle {vehicle.registration_plate} is INACTIVE / under maintenance."

        dur = duration_minutes or 60
        safe_pickup = ensure_utc(pickup_datetime)
        window_start = safe_pickup - timedelta(minutes=30)
        window_end = safe_pickup + timedelta(minutes=dur + 30)

        stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.vehicle_id == vehicle_id,
                BookingLeg.status.notin_([LegStatus.CANCELLED, LegStatus.COMPLETED]),
                BookingLeg.pickup_datetime >= window_start,
                BookingLeg.pickup_datetime <= window_end
            )
        )
        if exclude_leg_id:
            stmt = stmt.where(BookingLeg.id != exclude_leg_id)

        res = await db.execute(stmt)
        conflicts = list(res.scalars().all())
        if conflicts:
            conflict_leg = conflicts[0]
            conf_time = conflict_leg.pickup_datetime.strftime('%Y-%m-%d %H:%M')
            return True, f"Vehicle conflict: {vehicle.registration_plate} is already assigned to Leg #{conflict_leg.leg_number} at {conf_time}."

        return False, None

    @staticmethod
    async def allocate_leg_to_driver(
        db: AsyncSession,
        leg_id: str,
        driver_id: str,
        vehicle_id: str,
        allocation_cost: float,
        notes: Optional[str] = None,
        actor: Optional[User] = None
    ) -> BookingLeg:
        """
        Step 2 of Lifecycle: ALLOCATE leg to Driver + Vehicle + Payout Rate.
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.id == leg_id)
            .options(
                selectinload(BookingLeg.booking).selectinload(Booking.legs),
                selectinload(BookingLeg.driver),
                selectinload(BookingLeg.vehicle)
            )
        )
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking leg not found.")

        # 1. Run Conflict Checks
        has_driver_conf, driver_msg = await DispatchService.check_driver_conflicts(
            db, driver_id, leg.pickup_datetime, leg.duration_minutes, exclude_leg_id=leg.id
        )
        if has_driver_conf:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=driver_msg)

        has_veh_conf, veh_msg = await DispatchService.check_vehicle_conflicts(
            db, vehicle_id, leg.pickup_datetime, leg.duration_minutes, exclude_leg_id=leg.id
        )
        if has_veh_conf:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=veh_msg)

        # 2. Assign Allocation
        old_driver = leg.driver_id
        old_vehicle = leg.vehicle_id

        leg.driver_id = driver_id
        leg.vehicle_id = vehicle_id
        leg.partner_id = None
        leg.partner_payout_amount = 0.0
        leg.allocation_cost = round(allocation_cost, 2)
        leg.status = LegStatus.ALLOCATED
        leg.allocated_at = utc_now()
        if notes:
            leg.pickup_notes = f"{leg.pickup_notes}\n{notes}" if leg.pickup_notes else notes

        # 3. Synchronize Master Booking Status
        booking = leg.booking
        all_allocated = all(l.status != LegStatus.PENDING for l in booking.legs)
        if all_allocated and booking.status in (BookingStatus.DRAFT, BookingStatus.QUOTED, BookingStatus.CONFIRMED):
            booking.status = BookingStatus.ALLOCATED

        # 4. Record Audit Log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="BookingLeg",
            entity_id=leg.id,
            action=AuditAction.ALLOCATION,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "DISPATCHER",
            actor_email=actor.email if actor else "dispatch@operations",
            old_values={"driver_id": old_driver, "vehicle_id": old_vehicle, "status": LegStatus.PENDING.value},
            new_values={
                "driver_id": driver_id,
                "vehicle_id": vehicle_id,
                "allocation_cost": leg.allocation_cost,
                "status": LegStatus.ALLOCATED.value
            },
            reason=f"Allocated to driver {driver_id} with vehicle {vehicle_id} @ ${allocation_cost:.2f} payout"
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(leg)
        return leg

    @staticmethod
    async def offload_leg_to_partner(
        db: AsyncSession,
        leg_id: str,
        partner_id: str,
        partner_payout_amount: float,
        partner_reference: Optional[str] = None,
        notes: Optional[str] = None,
        actor: Optional[User] = None
    ) -> BookingLeg:
        """
        Partner Offload Lane: Assigns leg to external partner affiliate.
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.id == leg_id)
            .options(
                selectinload(BookingLeg.booking).selectinload(Booking.legs),
                selectinload(BookingLeg.partner)
            )
        )
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking leg not found.")

        partner = await db.get(Partner, partner_id)
        if not partner or not partner.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Active partner not found.")

        leg.partner_id = partner_id
        leg.partner_payout_amount = round(partner_payout_amount, 2)
        leg.partner_reference = partner_reference
        leg.driver_id = None
        leg.vehicle_id = None
        leg.allocation_cost = 0.0
        leg.status = LegStatus.ALLOCATED
        leg.allocated_at = utc_now()
        if notes:
            leg.pickup_notes = f"{leg.pickup_notes}\n[Partner Offload]: {notes}" if leg.pickup_notes else f"[Partner Offload]: {notes}"

        # Synchronize Master Booking Status
        booking = leg.booking
        all_allocated = all(l.status != LegStatus.PENDING for l in booking.legs)
        if all_allocated and booking.status in (BookingStatus.DRAFT, BookingStatus.QUOTED, BookingStatus.CONFIRMED):
            booking.status = BookingStatus.ALLOCATED

        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="BookingLeg",
            entity_id=leg.id,
            action=AuditAction.ALLOCATION,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "DISPATCHER",
            actor_email=actor.email if actor else "dispatch@operations",
            new_values={
                "partner_id": partner_id,
                "partner_name": partner.company_name,
                "partner_payout_amount": partner_payout_amount,
                "partner_reference": partner_reference
            },
            reason=f"Offloaded to affiliate partner {partner.company_name} @ ${partner_payout_amount:.2f}"
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(leg)
        return leg

    @staticmethod
    async def unallocate_leg(
        db: AsyncSession,
        leg_id: str,
        actor: Optional[User] = None
    ) -> BookingLeg:
        """
        Reverts leg back to UNALLOCATED / PENDING status.
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.id == leg_id)
            .options(
                selectinload(BookingLeg.booking),
                selectinload(BookingLeg.driver),
                selectinload(BookingLeg.vehicle),
                selectinload(BookingLeg.partner)
            )
        )
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking leg not found.")

        leg.driver_id = None
        leg.vehicle_id = None
        leg.partner_id = None
        leg.status = LegStatus.PENDING
        leg.allocated_at = None

        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=leg.booking.id,
            entity_type="BookingLeg",
            entity_id=leg.id,
            action=AuditAction.ALLOCATION,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "DISPATCHER",
            actor_email=actor.email if actor else "dispatch@operations",
            reason="Unallocated leg; returned to unassigned dispatch pool."
        )
        leg.booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(leg)
        return leg

    @staticmethod
    async def dispatch_leg(
        db: AsyncSession,
        leg_id: str,
        actor: Optional[User] = None
    ) -> BookingLeg:
        """
        Dispatches allocated job to driver / partner.
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.id == leg_id)
            .options(
                selectinload(BookingLeg.booking),
                selectinload(BookingLeg.driver),
                selectinload(BookingLeg.vehicle),
                selectinload(BookingLeg.partner)
            )
        )
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking leg not found.")

        if not leg.driver_id and not leg.partner_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot dispatch an unallocated leg. Please allocate a driver or partner first."
            )

        leg.status = LegStatus.DISPATCHED
        leg.dispatched_at = utc_now()

        booking = leg.booking
        booking.status = BookingStatus.DISPATCHED

        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="BookingLeg",
            entity_id=leg.id,
            action=AuditAction.STATUS_CHANGE,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "DISPATCHER",
            actor_email=actor.email if actor else "dispatch@operations",
            new_values={"status": LegStatus.DISPATCHED.value},
            reason=f"Leg #{leg.leg_number} dispatched to {'Driver ' + leg.driver.full_name if leg.driver else 'Partner'}"
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(leg)
        return leg

    @staticmethod
    async def settle_leg(
        db: AsyncSession,
        leg_id: str,
        allocation_cost: Optional[float] = None,
        settlement_notes: Optional[str] = None,
        actor: Optional[User] = None
    ) -> BookingLeg:
        """
        Step 3 of Lifecycle: SETTLE completed leg payout for accounting statements.
        """
        stmt = (
            select(BookingLeg)
            .where(BookingLeg.id == leg_id)
            .options(
                selectinload(BookingLeg.booking).selectinload(Booking.legs),
                selectinload(BookingLeg.driver)
            )
        )
        res = await db.execute(stmt)
        leg = res.scalar_one_or_none()
        if not leg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking leg not found.")

        if leg.status != LegStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot settle leg in '{leg.status.value}' state. Leg must be COMPLETED before settlement."
            )

        if allocation_cost is not None:
            leg.allocation_cost = round(allocation_cost, 2)
        leg.settled_at = utc_now()
        leg.settlement_notes = settlement_notes

        # If all legs in booking are completed and fully paid, financially close master booking
        booking = leg.booking
        all_completed = all(l.status == LegStatus.COMPLETED for l in booking.legs)
        all_settled = all(l.settled_at is not None for l in booking.legs)

        if all_completed and all_settled and booking.payment_status == PaymentStatus.PAID_IN_FULL:
            booking.status = BookingStatus.FINANCIALLY_CLOSED

        audit = AuditLog(
            id=str(uuid.uuid4()),
            booking_id=booking.id,
            entity_type="BookingLeg",
            entity_id=leg.id,
            action=AuditAction.UPDATE,
            actor_id=actor.id if actor else None,
            actor_role=actor.role.value if actor else "ACCOUNTANT",
            actor_email=actor.email if actor else "finance@operations",
            new_values={
                "settled_at": leg.settled_at.isoformat(),
                "final_allocation_cost": leg.allocation_cost,
                "settlement_notes": settlement_notes
            },
            reason=f"Leg #{leg.leg_number} settled at ${leg.allocation_cost:.2f} payout."
        )
        booking.audit_logs.append(audit)

        await db.commit()
        await db.refresh(leg)
        return leg

    @staticmethod
    async def get_operate_board(
        db: AsyncSession,
        target_date: Optional[date] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        vehicle_category: Optional[VehicleCategory] = None,
        status_filter: Optional[LegStatus] = None
    ) -> OperateBoardResponse:
        """
        Fetches the aggregated real-time Dispatch Operate Board.
        """
        stmt = (
            select(BookingLeg)
            .options(
                selectinload(BookingLeg.booking).selectinload(Booking.customer),
                selectinload(BookingLeg.booking).selectinload(Booking.legs),
                selectinload(BookingLeg.driver),
                selectinload(BookingLeg.vehicle),
                selectinload(BookingLeg.partner)
            )
            .order_by(BookingLeg.pickup_datetime.asc())
        )

        if target_date:
            dt_start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
            dt_end = datetime.combine(target_date, datetime.max.time(), tzinfo=timezone.utc)
            stmt = stmt.where(BookingLeg.pickup_datetime >= dt_start, BookingLeg.pickup_datetime <= dt_end)
        elif date_from and date_to:
            stmt = stmt.where(BookingLeg.pickup_datetime >= date_from, BookingLeg.pickup_datetime <= date_to)

        if vehicle_category:
            stmt = stmt.where(BookingLeg.vehicle_category == vehicle_category)
        if status_filter:
            stmt = stmt.where(BookingLeg.status == status_filter)

        res = await db.execute(stmt)
        legs = list(res.scalars().all())

        items: List[OperateBoardLegItem] = []
        summary = OperateBoardSummary(
            total_legs=len(legs),
            pending_unallocated=0,
            allocated=0,
            dispatched=0,
            en_route=0,
            arrived=0,
            picked_up=0,
            completed=0,
            partner_offloaded=0
        )

        for leg in legs:
            # Update summary counts
            if leg.status == LegStatus.PENDING:
                summary.pending_unallocated += 1
            elif leg.status == LegStatus.ALLOCATED:
                summary.allocated += 1
            elif leg.status == LegStatus.DISPATCHED:
                summary.dispatched += 1
            elif leg.status == LegStatus.EN_ROUTE:
                summary.en_route += 1
            elif leg.status == LegStatus.ARRIVED:
                summary.arrived += 1
            elif leg.status == LegStatus.PICKED_UP:
                summary.picked_up += 1
            elif leg.status == LegStatus.COMPLETED:
                summary.completed += 1

            if leg.partner_id:
                summary.partner_offloaded += 1

            # Financial margin calculations
            booking = leg.booking
            legs_count = max(1, len(booking.legs)) if booking else 1
            fare_share = round((booking.total_fare if booking else 0.0) / legs_count, 2)
            cost = leg.partner_payout_amount if leg.partner_id else leg.allocation_cost
            net_margin = round(fare_share - cost, 2)

            cust = booking.customer if booking else None
            veh = leg.vehicle
            drv = leg.driver
            ptnr = leg.partner

            item = OperateBoardLegItem(
                id=leg.id,
                booking_id=booking.id if booking else "",
                booking_number=booking.booking_number if booking else "",
                leg_number=leg.leg_number,
                status=leg.status,
                booking_status=booking.status if booking else BookingStatus.DRAFT,
                pickup_datetime=leg.pickup_datetime,
                pickup_address=leg.pickup_address,
                dropoff_address=leg.dropoff_address,
                distance_km=leg.distance_km,
                duration_minutes=leg.duration_minutes,
                vehicle_category=leg.vehicle_category,
                passenger_name=booking.passenger_name if booking else None,
                passenger_phone=booking.passenger_phone if booking else None,
                customer_name=cust.full_name if cust else None,
                flight_number=leg.flight_number,
                driver_id=drv.id if drv else None,
                driver_name=drv.full_name if drv else None,
                driver_phone=drv.phone if drv else None,
                vehicle_id=veh.id if veh else None,
                vehicle_plate=veh.registration_plate if veh else None,
                vehicle_name=f"{veh.make} {veh.model}" if veh else None,
                partner_id=ptnr.id if ptnr else None,
                partner_name=ptnr.company_name if ptnr else None,
                allocation_cost=leg.allocation_cost,
                partner_payout_amount=leg.partner_payout_amount,
                customer_fare_share=fare_share,
                net_margin=net_margin,
                settled_at=leg.settled_at
            )
            items.append(item)

        return OperateBoardResponse(
            target_date=target_date.isoformat() if target_date else None,
            summary=summary,
            legs=items
        )

    @staticmethod
    async def get_available_drivers_for_leg(
        db: AsyncSession,
        pickup_datetime: datetime,
        duration_minutes: Optional[int] = None,
        vehicle_category: Optional[VehicleCategory] = None
    ) -> List[DriverAvailabilityResponse]:
        """
        Evaluates driver availability and conflict status for an upcoming job.
        """
        stmt = (
            select(Driver)
            .where(Driver.status != DriverStatus.SUSPENDED)
            .options(selectinload(Driver.default_vehicle))
            .order_by(Driver.rating.desc())
        )
        res = await db.execute(stmt)
        drivers = list(res.scalars().all())

        results: List[DriverAvailabilityResponse] = []
        for drv in drivers:
            has_conf, conf_msg = await DispatchService.check_driver_conflicts(
                db, drv.id, pickup_datetime, duration_minutes
            )
            veh = drv.default_vehicle
            results.append(
                DriverAvailabilityResponse(
                    driver_id=drv.id,
                    driver_name=drv.full_name,
                    status=drv.status.value,
                    rating=drv.rating,
                    is_available=not has_conf,
                    conflict_reason=conf_msg if has_conf else None,
                    assigned_vehicle_id=veh.id if veh else None,
                    assigned_vehicle_plate=veh.registration_plate if veh else None
                )
            )

        return results
