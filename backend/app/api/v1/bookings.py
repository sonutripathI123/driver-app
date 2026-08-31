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

# In-memory fast live sync cache for real-time mobile driver <-> desktop admin panel sync
_LIVE_TRIP_CACHE = {
    "booking_number": "CCM-2026-9901",
    "status": "EN_ROUTE",
    "passenger_name": "Sahil Tripathi",
    "passenger_phone": "+91 6386154107",
    "driver_name": "Sonu Tripathi (Live Driver)",
    "driver_phone": "+91 9305365420",
    "pickup_address": "Crown Towers, 8 Whiteman St, Southbank VIC 3006",
    "dropoff_address": "Melbourne Airport Terminal 2 (Tullamarine)",
    "pickup_time": "Today, 18:30 AEST",
    "flight_number": "QF400",
    "driver_payout": 170.0,
    "last_updated": ""
}


@router.get("/live-sync")
async def get_live_trip_sync():
    """Real-time trip status query for cross-device mobile driver <-> desktop admin sync."""
    return _LIVE_TRIP_CACHE


@router.post("/live-sync")
async def update_live_trip_sync(payload: dict):
    """Real-time trip status update from Mobile Driver App."""
    from datetime import datetime
    new_status = payload.get("status", _LIVE_TRIP_CACHE["status"])
    _LIVE_TRIP_CACHE["status"] = new_status
    _LIVE_TRIP_CACHE["last_updated"] = datetime.now().isoformat()
    return _LIVE_TRIP_CACHE


@router.post("/live-sync/reset")
async def reset_live_trip_sync():
    """Reset live trip status back to EN_ROUTE for fresh testing."""
    from datetime import datetime
    _LIVE_TRIP_CACHE["status"] = "EN_ROUTE"
    _LIVE_TRIP_CACHE["last_updated"] = datetime.now().isoformat()
    return _LIVE_TRIP_CACHE


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


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def ingest_external_website_webhook(
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Universal Ingestion Webhook for external websites (WordPress Elementor, Contact Form 7, WPForms, etc.).
    Automatically parses multi-site form submissions from:
    - https://corporatecarsmelbourne.com.au/
    - https://melbourneairportchauffeurservice.com.au/
    - https://www.opalchauffeurs.com.au/
    """
    from datetime import datetime, timedelta
    from app.schemas.booking import BookingCreate, BookingLegCreate
    from app.models.enums import BookingSource, VehicleCategory

    # Extract raw fields (supports flat JSON, Elementor form structure, and nested fields)
    raw = payload
    form_data = payload.get("fields", payload.get("form_fields", payload.get("data", payload)))
    
    # Helper to extract value from diverse form naming conventions
    def extract_val(keys: list, default: str = "") -> str:
        for k in keys:
            if isinstance(form_data, dict):
                v = form_data.get(k)
                if isinstance(v, dict) and "value" in v:
                    return str(v["value"]).strip()
                if v is not None:
                    return str(v).strip()
            if isinstance(raw, dict):
                v = raw.get(k)
                if v is not None:
                    return str(v).strip()
        return default

    passenger_name = extract_val(["name", "passenger_name", "customer_name", "your-name", "first_name", "full_name"], "VIP Passenger")
    passenger_phone = extract_val(["phone", "passenger_phone", "customer_phone", "your-tel", "mobile", "contact_number"], "+61 400 000 000")
    passenger_email = extract_val(["email", "passenger_email", "customer_email", "your-email"], "concierge@crownchauffeurs.com.au")
    pickup_address = extract_val(["pickup", "pickup_address", "from", "origin", "pickup_location"], "Melbourne CBD")
    dropoff_address = extract_val(["dropoff", "dropoff_address", "to", "destination", "dropoff_location"], "Melbourne Airport Terminal 2")
    pickup_date = extract_val(["date", "pickup_date", "journey_date", "service_date"], datetime.now().strftime("%Y-%m-%d"))
    pickup_time = extract_val(["time", "pickup_time", "journey_time"], "09:00")
    flight_number = extract_val(["flight", "flight_number", "flight_no", "flight_details"], "")
    vehicle_raw = extract_val(["vehicle", "vehicle_category", "car_type", "car_model", "fleet_type"], "SEDAN_PREMIUM").upper()
    source_url = extract_val(["source", "site_url", "referrer", "website", "url"], "WEBSITE").lower()

    # Determine origin source
    if "corporatecarsmelbourne" in source_url:
        booking_source = BookingSource.WEBSITE
    elif "melbourneairport" in source_url:
        booking_source = BookingSource.WEBSITE
    elif "opalchauffeurs" in source_url:
        booking_source = BookingSource.WEBSITE
    else:
        booking_source = BookingSource.WEBSITE

    # Map vehicle category
    if "EXECUTIVE" in vehicle_raw or "S-CLASS" in vehicle_raw or "BMW" in vehicle_raw:
        category = VehicleCategory.SEDAN_EXECUTIVE
    elif "SUV" in vehicle_raw or "Q7" in vehicle_raw:
        category = VehicleCategory.SUV_PREMIUM
    elif "VAN" in vehicle_raw or "V-CLASS" in vehicle_raw or "PEOPLE" in vehicle_raw:
        category = VehicleCategory.PEOPLE_MOVER
    elif "SPRINTER" in vehicle_raw or "MINIBUS" in vehicle_raw or "BUS" in vehicle_raw:
        category = VehicleCategory.MINIBUS
    else:
        category = VehicleCategory.SEDAN_PREMIUM

    # Calculate ISO pickup datetime
    try:
        dt_str = f"{pickup_date} {pickup_time}"
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
    except Exception:
        dt = datetime.now() + timedelta(hours=3)

    is_airport = bool(flight_number) or "airport" in pickup_address.lower() or "airport" in dropoff_address.lower()

    booking_in = BookingCreate(
        source=booking_source,
        currency="AUD",
        total_fare=440.0 if category == VehicleCategory.SEDAN_EXECUTIVE else 360.0,
        deposit_required=440.0 if category == VehicleCategory.SEDAN_EXECUTIVE else 360.0,
        paid_amount=0.0,
        customer_name=passenger_name,
        customer_phone=passenger_phone,
        customer_email=passenger_email,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address=pickup_address,
                dropoff_address=dropoff_address,
                pickup_datetime=dt,
                is_airport_pickup=is_airport,
                flight_number=flight_number if flight_number else None,
                vehicle_category=category
            )
        ]
    )

    created = await BookingService.create_booking(db=db, booking_in=booking_in)
    return {
        "status": "success",
        "message": "Booking received and ingested into Master Operations Hub",
        "booking_number": created.booking_number,
        "booking_id": created.id,
        "passenger": passenger_name,
        "pickup_datetime": dt.isoformat()
    }


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
