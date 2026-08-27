from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import get_current_active_user, require_dispatcher, require_staff
from app.models.user import User
from app.schemas.flight import (
    FlightLookupResponse,
    FlightSyncLegResponse,
    FlightWaitTimeRequest,
    FlightWaitTimeResponse,
)
from app.services.flight_service import FlightTrackingService

router = APIRouter(prefix="/flights", tags=["Flight Tracking & Airport Automation"])


@router.get("/lookup", response_model=FlightLookupResponse, dependencies=[Depends(require_staff)])
async def lookup_flight_status(
    flight_number: str = Query(..., description="Flight code, e.g. QF401, EK406"),
    flight_date: Optional[date] = Query(None, description="Flight scheduled date (YYYY-MM-DD)")
):
    """
    Query real-time flight status, arrival airport, and delay estimates.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER, ACCOUNTANT)
    """
    return await FlightTrackingService.lookup_flight(flight_number=flight_number, flight_date=flight_date)


@router.post("/legs/{leg_id}/sync", response_model=FlightSyncLegResponse, dependencies=[Depends(require_dispatcher)])
async def sync_leg_flight(
    leg_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Force synchronize flight arrival status for a specific booking leg.
    Auto-reschedules pickup time if flight is delayed by >=15 minutes.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await FlightTrackingService.sync_leg_flight_status(db=db, leg_id=leg_id, actor=current_user)


@router.post("/poll-active", response_model=List[FlightSyncLegResponse], dependencies=[Depends(require_dispatcher)])
async def poll_active_airport_flights(
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger automated flight tracking cron engine across all active airport pickups.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await FlightTrackingService.poll_all_active_airport_legs(db=db)


@router.post("/calculate-wait-time", response_model=FlightWaitTimeResponse)
async def calculate_wait_time_charges(
    payload: FlightWaitTimeRequest
):
    """
    Calculate complimentary vs billable meet & greet wait-time:
    - Airport: 60 minutes free
    - Standard/City: 15 minutes free
    Access: Public / Driver / Staff
    """
    return FlightTrackingService.calculate_wait_time(payload)
