from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import (
    get_current_active_user,
    require_dispatcher,
    require_ops,
    require_staff,
)
from app.models.enums import BookingSource, BookingStatus, LegStatus, PaymentStatus, UserRole
from app.models.user import User
from app.schemas.booking import (
    BookingCancelRequest,
    BookingCreate,
    BookingLegRead,
    BookingListResponse,
    BookingRead,
    BookingStatusTransitionRequest,
    BookingUpdate,
    LegStatusUpdateRequest,
)
from app.services.booking_service import BookingService

router = APIRouter(prefix="/bookings", tags=["Booking Management"])


@router.post("/", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_in: BookingCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new Master Booking with 1..N journey legs.
    ONE BOOKING -> ONE RECORD -> ONE SOURCE OF TRUTH.
    """
    return await BookingService.create_booking(
        db=db,
        booking_in=booking_in
    )


@router.get("/", response_model=BookingListResponse, dependencies=[Depends(require_staff)])
async def list_bookings(
    status_filter: Optional[BookingStatus] = Query(None, alias="status", description="Filter by booking status"),
    payment_status: Optional[PaymentStatus] = Query(None, description="Filter by payment status"),
    source: Optional[BookingSource] = Query(None, description="Filter by origination source"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    search: Optional[str] = Query(None, description="Search booking number, passenger, email, phone"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    List master bookings with pagination and filters.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER, ACCOUNTANT)
    """
    bookings, total = await BookingService.list_bookings(
        db=db,
        status_filter=status_filter,
        payment_status=payment_status,
        source=source,
        customer_id=customer_id,
        search=search,
        skip=skip,
        limit=limit
    )
    return BookingListResponse(
        total=total,
        page_count=len(bookings),
        bookings=[BookingRead.model_validate(b) for b in bookings]
    )


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking_details(
    booking_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Master Booking record by ID.
    Access: Staff or the customer owner.
    """
    booking = await BookingService.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found."
        )

    # Customer user access check
    if current_user.role == UserRole.CUSTOMER:
        if booking.customer.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this booking."
            )

    return booking


@router.get("/number/{booking_number}", response_model=BookingRead)
async def get_booking_by_number(
    booking_number: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lookup Master Booking by booking number (e.g. CCM-10001).
    """
    booking = await BookingService.get_booking_by_number(db, booking_number)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with number '{booking_number}' was not found."
        )

    if current_user.role == UserRole.CUSTOMER:
        if booking.customer.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this booking."
            )

    return booking


@router.patch("/{booking_id}", response_model=BookingRead, dependencies=[Depends(require_ops)])
async def update_booking_details(
    booking_id: str,
    booking_update: BookingUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update Master Booking details with audit trail.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await BookingService.update_booking(
        db=db,
        booking_id=booking_id,
        booking_update=booking_update,
        actor=current_user
    )


@router.post("/{booking_id}/transition", response_model=BookingRead, dependencies=[Depends(require_ops)])
async def transition_booking_status(
    booking_id: str,
    payload: BookingStatusTransitionRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Transition central booking status through validated state machine.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await BookingService.transition_status(
        db=db,
        booking_id=booking_id,
        target_status=payload.target_status,
        actor=current_user,
        reason=payload.reason
    )


@router.post("/{booking_id}/cancel", response_model=BookingRead, dependencies=[Depends(require_ops)])
async def cancel_booking(
    booking_id: str,
    payload: BookingCancelRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel booking, set cancellation reason/timestamp, and cancel pending legs.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await BookingService.cancel_booking(
        db=db,
        booking_id=booking_id,
        reason=payload.reason,
        actor=current_user
    )


@router.patch("/{booking_id}/legs/{leg_id}/status", response_model=BookingLegRead)
async def update_booking_leg_status(
    booking_id: str,
    leg_id: str,
    payload: LegStatusUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update individual journey leg operational status (EN_ROUTE, ARRIVED, PICKED_UP, COMPLETED).
    Access: Staff (ADMIN, OPS, DISPATCHER) or assigned Driver.
    """
    leg = await BookingService.update_leg_status(
        db=db,
        booking_id=booking_id,
        leg_id=leg_id,
        target_status=payload.status,
        actor=current_user
    )
    return leg
