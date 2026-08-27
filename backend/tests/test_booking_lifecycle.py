from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import (
    BookingSource,
    BookingStatus,
    LegStatus,
    PaymentStatus,
    UserRole,
    VehicleCategory,
)
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.services.booking_service import BookingService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_booking_number_generation_sequence(db_session: AsyncSession):
    num1 = await BookingService.generate_booking_number(db_session)
    assert num1 == "CCM-10001"

    # Create dummy booking to increment count
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Bruce Wayne",
        customer_email="bruce@wayne.com",
        customer_phone="+61400111222",
        source=BookingSource.WEBSITE,
        total_fare=200.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="100 Gotham St",
                dropoff_address="200 Gotham St",
                pickup_datetime=now + timedelta(days=1),
                vehicle_category=VehicleCategory.SEDAN_PREMIUM
            )
        ]
    )
    b1 = await BookingService.create_booking(db_session, b_in)
    assert b1.booking_number == "CCM-10001"

    num2 = await BookingService.generate_booking_number(db_session)
    assert num2 == "CCM-10002"


@pytest.mark.asyncio
async def test_multi_leg_journey_deposit_and_balance(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Clark Kent",
        customer_email="clark@dailyplanet.com",
        customer_phone="+61433221144",
        source=BookingSource.BOOKING_WIDGET,
        fare_type="AIRPORT_ALL_INCLUSIVE",
        total_fare=500.0,
        deposit_percentage=20.0,  # 20% deposit rule
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="Daily Planet, Metropolis",
                dropoff_address="Metropolis International Airport",
                pickup_datetime=now + timedelta(days=3),
                allocation_cost=150.0,
                is_airport_pickup=False
            ),
            BookingLegCreate(
                leg_number=2,
                pickup_address="Metropolis International Airport",
                dropoff_address="Daily Planet, Metropolis",
                pickup_datetime=now + timedelta(days=7),
                allocation_cost=150.0,
                is_airport_pickup=True,
                airline="Metropolis Air",
                flight_number="MA101"
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)

    assert booking.id is not None
    assert booking.total_fare == 500.0
    assert booking.deposit_required == 100.0  # 20% of 500
    assert booking.deposit_percentage == 20.0
    assert booking.balance_amount == 500.0
    assert booking.paid_amount == 0.0
    assert len(booking.legs) == 2
    assert booking.legs[0].leg_number == 1
    assert booking.legs[1].leg_number == 2
    assert booking.legs[1].flight_number == "MA101"


@pytest.mark.asyncio
async def test_strict_state_machine_transitions(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Diana Prince",
        customer_email="diana@themyscira.gov",
        customer_phone="+61455667799",
        total_fare=350.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="Embassy of Themyscira",
                dropoff_address="Grand Hotel",
                pickup_datetime=now + timedelta(days=2)
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)
    assert booking.status == BookingStatus.DRAFT

    # 1. Illegal transition DRAFT -> COMPLETED is rejected with 400
    with pytest.raises(Exception) as exc_info:
        await BookingService.transition_status(db_session, booking.id, BookingStatus.COMPLETED)
    assert "Illegal status transition" in str(exc_info.value)

    # 2. Valid transition DRAFT -> QUOTED -> CONFIRMED -> ALLOCATED -> DISPATCHED
    t1 = await BookingService.transition_status(db_session, booking.id, BookingStatus.QUOTED)
    assert t1.status == BookingStatus.QUOTED

    t2 = await BookingService.transition_status(db_session, booking.id, BookingStatus.CONFIRMED)
    assert t2.status == BookingStatus.CONFIRMED

    t3 = await BookingService.transition_status(db_session, booking.id, BookingStatus.ALLOCATED)
    assert t3.status == BookingStatus.ALLOCATED

    # Verify audit logs captured all state transitions
    loaded = await BookingService.get_booking_by_id(db_session, booking.id)
    assert len(loaded.audit_logs) == 4  # 1 create + 3 status changes


@pytest.mark.asyncio
async def test_cancellation_and_refund_flagging(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Barry Allen",
        customer_email="barry@star-labs.com",
        customer_phone="+61499887766",
        total_fare=250.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="Central City",
                dropoff_address="Keystone City",
                pickup_datetime=now + timedelta(days=1)
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)
    booking.paid_amount = 250.0  # Simulate customer had paid in full

    cancelled = await BookingService.cancel_booking(
        db_session,
        booking.id,
        reason="Customer flight was cancelled by airline"
    )

    assert cancelled.status == BookingStatus.CANCELLED
    assert cancelled.cancelled_at is not None
    assert cancelled.cancellation_reason == "Customer flight was cancelled by airline"
    assert cancelled.legs[0].status == LegStatus.CANCELLED
    assert cancelled.payment_status == PaymentStatus.REFUND_PENDING  # Flagged for refund processing!


@pytest.mark.asyncio
async def test_leg_status_progression_auto_completes_booking(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Hal Jordan",
        customer_email="hal@ferris-aircraft.com",
        customer_phone="+61411223399",
        total_fare=400.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="Ferris Air Hangar",
                dropoff_address="Coast City Airport",
                pickup_datetime=now + timedelta(hours=3)
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)
    leg_id = booking.legs[0].id

    # 1. Driver En Route
    await BookingService.update_leg_status(db_session, booking.id, leg_id, LegStatus.EN_ROUTE)
    b1 = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b1.status == BookingStatus.EN_ROUTE
    assert b1.legs[0].en_route_at is not None

    # 2. Driver Arrived
    await BookingService.update_leg_status(db_session, booking.id, leg_id, LegStatus.ARRIVED)
    b2 = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b2.status == BookingStatus.ARRIVED
    assert b2.legs[0].arrived_at is not None

    # 3. Passenger Picked Up
    await BookingService.update_leg_status(db_session, booking.id, leg_id, LegStatus.PICKED_UP)
    b3 = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b3.status == BookingStatus.PICKED_UP

    # 4. Trip Completed -> Automatically completes Master Booking!
    await BookingService.update_leg_status(db_session, booking.id, leg_id, LegStatus.COMPLETED)
    b4 = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b4.status == BookingStatus.COMPLETED
    assert b4.legs[0].completed_at is not None


@pytest.mark.asyncio
async def test_booking_api_endpoints_and_rbac(
    client: AsyncClient,
    admin_user: User,
    ops_user: User,
    dispatcher_user: User,
    customer_user: User
):
    admin_headers = auth_header(admin_user)
    ops_headers = auth_header(ops_user)
    disp_headers = auth_header(dispatcher_user)

    now = datetime.now(timezone.utc)
    # 1. Create booking via API
    payload = {
        "customer_name": "Arthur Curry",
        "customer_email": "arthur@atlantis.ocean",
        "customer_phone": "+61477112233",
        "source": "WEBSITE",
        "total_fare": 600.0,
        "deposit_percentage": 20.0,
        "legs": [
            {
                "leg_number": 1,
                "pickup_address": "Port of Melbourne",
                "dropoff_address": "Crown Towers Melbourne",
                "pickup_datetime": (now + timedelta(days=2)).isoformat(),
                "vehicle_category": "SEDAN_EXECUTIVE",
                "allocation_cost": 200.0
            }
        ]
    }
    resp = await client.post("/api/v1/bookings/", json=payload)
    assert resp.status_code == 201
    booking_data = resp.json()
    b_id = booking_data["id"]
    b_num = booking_data["booking_number"]
    assert b_num.startswith("CCM-")
    assert booking_data["total_fare"] == 600.0
    assert booking_data["deposit_required"] == 120.0

    # 2. Staff can list bookings
    list_resp = await client.get("/api/v1/bookings/", headers=disp_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] >= 1

    # 3. Lookup by booking number
    num_resp = await client.get(f"/api/v1/bookings/number/{b_num}", headers=ops_headers)
    assert num_resp.status_code == 200
    assert num_resp.json()["id"] == b_id

    # 4. Ops transitions status to QUOTED
    trans_resp = await client.post(
        f"/api/v1/bookings/{b_id}/transition",
        json={"target_status": "QUOTED", "reason": "Custom pricing approved"},
        headers=ops_headers
    )
    assert trans_resp.status_code == 200
    assert trans_resp.json()["status"] == "QUOTED"

    # 5. Ops cancels booking
    cancel_resp = await client.post(
        f"/api/v1/bookings/{b_id}/cancel",
        json={"reason": "Customer changed travel plans"},
        headers=ops_headers
    )
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"
