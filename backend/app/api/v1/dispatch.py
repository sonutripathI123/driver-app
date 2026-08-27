from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import (
    get_current_active_user,
    require_accountant,
    require_dispatcher,
    require_ops,
    require_staff,
)
from app.models.enums import LegStatus, VehicleCategory
from app.models.user import User
from app.schemas.booking import BookingLegRead
from app.schemas.dispatch import (
    AllocateDriverRequest,
    DriverAvailabilityResponse,
    OffloadPartnerRequest,
    OperateBoardResponse,
    SettleLegRequest,
)
from app.services.dispatch_service import DispatchService

router = APIRouter(prefix="/dispatch", tags=["Operations & Dispatch Board"])


@router.get("/board", response_model=OperateBoardResponse, dependencies=[Depends(require_staff)])
async def get_operate_board(
    target_date: Optional[date] = Query(None, description="Target single date filter (YYYY-MM-DD)"),
    date_from: Optional[datetime] = Query(None, description="Range start datetime"),
    date_to: Optional[datetime] = Query(None, description="Range end datetime"),
    vehicle_category: Optional[VehicleCategory] = Query(None, description="Filter by vehicle class"),
    status_filter: Optional[LegStatus] = Query(None, alias="status", description="Filter by leg operational status"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get live Dispatch Operate Board with summary metrics and journey timeline.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER, ACCOUNTANT)
    """
    return await DispatchService.get_operate_board(
        db=db,
        target_date=target_date,
        date_from=date_from,
        date_to=date_to,
        vehicle_category=vehicle_category,
        status_filter=status_filter
    )


@router.get("/available-drivers", response_model=List[DriverAvailabilityResponse], dependencies=[Depends(require_dispatcher)])
async def get_available_drivers(
    pickup_datetime: datetime = Query(..., description="Job pickup timestamp"),
    duration_minutes: Optional[int] = Query(60, description="Estimated duration in minutes"),
    vehicle_category: Optional[VehicleCategory] = Query(None, description="Required vehicle category"),
    db: AsyncSession = Depends(get_db)
):
    """
    Check drivers availability and evaluate time conflicts for a target pickup window.
    Access: Staff
    """
    return await DispatchService.get_available_drivers_for_leg(
        db=db,
        pickup_datetime=pickup_datetime,
        duration_minutes=duration_minutes,
        vehicle_category=vehicle_category
    )


@router.post("/legs/{leg_id}/allocate", response_model=BookingLegRead, dependencies=[Depends(require_dispatcher)])
async def allocate_leg_driver(
    leg_id: str,
    payload: AllocateDriverRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Step 2: ALLOCATE leg to Driver + Vehicle + Driver Payout amount.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await DispatchService.allocate_leg_to_driver(
        db=db,
        leg_id=leg_id,
        driver_id=payload.driver_id,
        vehicle_id=payload.vehicle_id,
        allocation_cost=payload.allocation_cost,
        notes=payload.notes,
        actor=current_user
    )


@router.post("/legs/{leg_id}/offload", response_model=BookingLegRead, dependencies=[Depends(require_dispatcher)])
async def offload_leg_to_partner(
    leg_id: str,
    payload: OffloadPartnerRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Partner Offload Lane: Assigns leg to external affiliate partner.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await DispatchService.offload_leg_to_partner(
        db=db,
        leg_id=leg_id,
        partner_id=payload.partner_id,
        partner_payout_amount=payload.partner_payout_amount,
        partner_reference=payload.partner_reference,
        notes=payload.notes,
        actor=current_user
    )


@router.post("/legs/{leg_id}/unallocate", response_model=BookingLegRead, dependencies=[Depends(require_dispatcher)])
async def unallocate_leg(
    leg_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Revert leg back to UNALLOCATED / PENDING status.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await DispatchService.unallocate_leg(
        db=db,
        leg_id=leg_id,
        actor=current_user
    )


@router.post("/legs/{leg_id}/dispatch", response_model=BookingLegRead, dependencies=[Depends(require_dispatcher)])
async def dispatch_leg(
    leg_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatch job to allocated driver or partner.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await DispatchService.dispatch_leg(
        db=db,
        leg_id=leg_id,
        actor=current_user
    )


@router.post("/legs/{leg_id}/settle", response_model=BookingLegRead, dependencies=[Depends(require_accountant)])
async def settle_leg_payout(
    leg_id: str,
    payload: SettleLegRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Step 3: SETTLE completed leg payout for driver/partner accounting statements.
    Access: ADMIN, ACCOUNTANT
    """
    return await DispatchService.settle_leg(
        db=db,
        leg_id=leg_id,
        allocation_cost=payload.allocation_cost,
        settlement_notes=payload.settlement_notes,
        actor=current_user
    )
