from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import get_current_active_user, require_driver
from app.models.enums import DriverStatus, LegStatus
from app.models.user import User
from app.schemas.driver_portal import (
    DriverEarningsSummary,
    DriverJobItem,
    DriverLocationUpdate,
    DriverPortalProfile,
    DriverShiftStatusUpdate,
)
from app.services.driver_portal_service import DriverPortalService

router = APIRouter(prefix="/driver-portal", tags=["Driver Mobile Web App & Portal"])


@router.get("/me", response_model=DriverPortalProfile, dependencies=[Depends(require_driver)])
async def get_my_driver_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get authenticated driver's profile, assigned vehicle, and shift availability.
    Access: DRIVER role only
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    return driver


@router.patch("/status", response_model=DriverPortalProfile, dependencies=[Depends(require_driver)])
async def update_shift_status(
    payload: DriverShiftStatusUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Toggle driver shift availability (AVAILABLE, OFF_DUTY, ON_TRIP).
    Access: DRIVER role only
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    return await DriverPortalService.update_shift_status(db, driver.id, payload.status)


@router.post("/location", response_model=DriverPortalProfile, dependencies=[Depends(require_driver)])
async def update_gps_location(
    payload: DriverLocationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update live GPS coordinates for telemetry and dispatch tracking.
    Access: DRIVER role only
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    return await DriverPortalService.update_gps_location(db, driver.id, payload.lat, payload.lng)


@router.get("/jobs", response_model=List[DriverJobItem], dependencies=[Depends(require_driver)])
async def get_my_jobs_manifest(
    filter_mode: str = Query("ALL", alias="filter", description="Manifest filter: TODAY, UPCOMING, COMPLETED, ALL"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get authenticated driver's job manifest with privacy shielding (customer fare hidden).
    Access: DRIVER role only
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    return await DriverPortalService.get_driver_manifest(db, driver.id, filter_mode=filter_mode)


# --- One-Tap Trip Stepper Endpoints ---

@router.post("/jobs/{leg_id}/en-route", response_model=DriverJobItem, dependencies=[Depends(require_driver)])
async def trip_step_en_route(
    leg_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trip Stepper Step 1: Chauffeur is EN_ROUTE to pickup location.
    Automatically sets Driver status to ON_TRIP.
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    leg = await DriverPortalService.step_trip_status(db, driver.id, leg_id, LegStatus.EN_ROUTE, actor=current_user)
    jobs = await DriverPortalService.get_driver_manifest(db, driver.id, filter_mode="ALL")
    return next(j for j in jobs if j.id == leg.id)


@router.post("/jobs/{leg_id}/arrived", response_model=DriverJobItem, dependencies=[Depends(require_driver)])
async def trip_step_arrived(
    leg_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trip Stepper Step 2: Chauffeur has ARRIVED at pickup.
    Sends automatic SMS arrival alert to client.
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    leg = await DriverPortalService.step_trip_status(db, driver.id, leg_id, LegStatus.ARRIVED, actor=current_user)
    jobs = await DriverPortalService.get_driver_manifest(db, driver.id, filter_mode="ALL")
    return next(j for j in jobs if j.id == leg.id)


@router.post("/jobs/{leg_id}/picked-up", response_model=DriverJobItem, dependencies=[Depends(require_driver)])
async def trip_step_picked_up(
    leg_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trip Stepper Step 3: Passenger on board (PICKED_UP).
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    leg = await DriverPortalService.step_trip_status(db, driver.id, leg_id, LegStatus.PICKED_UP, actor=current_user)
    jobs = await DriverPortalService.get_driver_manifest(db, driver.id, filter_mode="ALL")
    return next(j for j in jobs if j.id == leg.id)


@router.post("/jobs/{leg_id}/complete", response_model=DriverJobItem, dependencies=[Depends(require_driver)])
async def trip_step_complete(
    leg_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trip Stepper Step 4: Journey safely COMPLETED at dropoff.
    Auto-increments driver completed trips and sets Driver status back to AVAILABLE.
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    leg = await DriverPortalService.step_trip_status(db, driver.id, leg_id, LegStatus.COMPLETED, actor=current_user)
    jobs = await DriverPortalService.get_driver_manifest(db, driver.id, filter_mode="ALL")
    return next(j for j in jobs if j.id == leg.id)


@router.get("/earnings", response_model=DriverEarningsSummary, dependencies=[Depends(require_driver)])
async def get_my_earnings(
    date_from: Optional[datetime] = Query(None, description="Start date filter"),
    date_to: Optional[datetime] = Query(None, description="End date filter"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get driver's completed trips statement, settled payouts, and pending earnings.
    Access: DRIVER role only
    """
    driver = await DriverPortalService.get_driver_by_user(db, current_user)
    return await DriverPortalService.get_driver_earnings_summary(db, driver.id, date_from, date_to)
