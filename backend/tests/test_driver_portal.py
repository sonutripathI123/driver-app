from datetime import datetime, timedelta, timezone
from typing import Tuple
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.integrations.notifications.sms_client import sms_gateway
from app.models.driver import Driver
from app.models.enums import BookingStatus, DriverStatus, LegStatus, UserRole, VehicleCategory
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.driver import DriverCreate
from app.schemas.user import UserCreate
from app.schemas.vehicle import VehicleCreate
from app.services.booking_service import BookingService
from app.services.dispatch_service import DispatchService
from app.services.driver_service import DriverService
from app.services.user_service import UserService
from app.services.vehicle_service import VehicleService
from tests.conftest import auth_header


async def create_test_driver_account(db_session: AsyncSession) -> Tuple[User, Driver, Vehicle]:
    """Creates a Driver user account and associated Driver entity."""
    user = await UserService.create_user(
        db_session,
        UserCreate(
            email="carlos@driver-app.com",
            full_name="Carlos Sainz",
            password="DriverSecurePassword123!",
            role=UserRole.DRIVER
        )
    )
    vehicle = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.SEDAN_PREMIUM,
            make="Audi",
            model="A8 L",
            year=2024,
            color="Mythos Black",
            registration_plate="CS-55-VIC",
            passenger_capacity=3,
            luggage_capacity=3
        )
    )
    driver = await DriverService.create_driver(
        db_session,
        DriverCreate(
            user_id=user.id,
            full_name=user.full_name,
            phone="+61455555555",
            email=user.email,
            license_number="LIC-CS-55",
            status=DriverStatus.AVAILABLE,
            default_vehicle_id=vehicle.id
        )
    )
    return user, driver, vehicle


@pytest.mark.asyncio
async def test_driver_portal_profile_and_status_toggle(
    client: AsyncClient,
    db_session: AsyncSession
):
    user, driver, vehicle = await create_test_driver_account(db_session)
    headers = auth_header(user)

    # 1. View profile
    me_resp = await client.get("/api/v1/driver-portal/me", headers=headers)
    assert me_resp.status_code == 200
    data = me_resp.json()
    assert data["full_name"] == "Carlos Sainz"
    assert data["status"] == "AVAILABLE"
    assert data["default_vehicle"]["registration_plate"] == "CS-55-VIC"

    # 2. Toggle Shift Status to OFF_DUTY
    status_resp = await client.patch(
        "/api/v1/driver-portal/status",
        json={"status": "OFF_DUTY"},
        headers=headers
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "OFF_DUTY"

    # 3. Update GPS Telemetry Location
    loc_resp = await client.post(
        "/api/v1/driver-portal/location",
        json={"lat": -37.8136, "lng": 144.9631},
        headers=headers
    )
    assert loc_resp.status_code == 200
    assert loc_resp.json()["current_lat"] == -37.8136
    assert loc_resp.json()["current_lng"] == 144.9631
    assert loc_resp.json()["location_updated_at"] is not None


@pytest.mark.asyncio
async def test_driver_job_manifest_and_privacy_shielding(
    client: AsyncClient,
    db_session: AsyncSession
):
    user, driver, vehicle = await create_test_driver_account(db_session)
    headers = auth_header(user)
    now = datetime.now(timezone.utc)

    # Create Booking ($500 total customer fare, $220 driver payout)
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="VIP Executive",
            customer_email="executive@corporate.com",
            customer_phone="+61400888999",
            passenger_name="Sir Jackie Stewart",
            passenger_phone="+61400123987",
            total_fare=500.0,
            special_instructions="Cold sparkling water requested in vehicle",
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Park Hyatt Melbourne",
                    dropoff_address="Melbourne Jet Base",
                    pickup_datetime=now + timedelta(hours=3),
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM,
                    pickup_notes="Meet passenger at main hotel lobby."
                )
            ]
        )
    )
    leg_id = booking.legs[0].id

    # Allocate to Carlos @ $220 Payout
    await DispatchService.allocate_leg_to_driver(
        db_session, leg_id, driver.id, vehicle.id, allocation_cost=220.0
    )

    # Driver fetches manifest
    manifest_resp = await client.get("/api/v1/driver-portal/jobs", headers=headers)
    assert manifest_resp.status_code == 200
    jobs = manifest_resp.json()
    assert len(jobs) >= 1

    job = next(j for j in jobs if j["id"] == leg_id)
    # Passenger and trip details MUST be visible
    assert job["passenger_name"] == "Sir Jackie Stewart"
    assert job["passenger_phone"] == "+61400123987"
    assert job["pickup_address"] == "Park Hyatt Melbourne"
    assert job["allocation_payout"] == 220.0  # Driver payout is visible
    assert job["pickup_notes"] == "Meet passenger at main hotel lobby."
    assert job["special_instructions"] == "Cold sparkling water requested in vehicle"

    # Privacy Check: Customer total billing ($500.0) is NOT present in job item schema
    assert "total_fare" not in job
    assert "customer_fare" not in job
    assert "net_margin" not in job


@pytest.mark.asyncio
async def test_one_tap_trip_stepper_flow(
    client: AsyncClient,
    db_session: AsyncSession
):
    user, driver, vehicle = await create_test_driver_account(db_session)
    headers = auth_header(user)
    now = datetime.now(timezone.utc)
    sms_gateway.sent_sms.clear()

    # Setup booking
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Toto Wolff",
            customer_email="toto@mercedes-f1.com",
            customer_phone="+61411009988",
            total_fare=350.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Crown Towers, 8 Whiteman St",
                    dropoff_address="Tullamarine Airport",
                    pickup_datetime=now + timedelta(hours=1),
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM
                )
            ]
        )
    )
    leg_id = booking.legs[0].id
    await DispatchService.allocate_leg_to_driver(
        db_session, leg_id, driver.id, vehicle.id, allocation_cost=180.0
    )

    # STEP 1: Driver taps EN-ROUTE
    en_route_resp = await client.post(f"/api/v1/driver-portal/jobs/{leg_id}/en-route", headers=headers)
    assert en_route_resp.status_code == 200
    assert en_route_resp.json()["status"] == "EN_ROUTE"

    # Verify Driver status automatically set to ON_TRIP
    me = (await client.get("/api/v1/driver-portal/me", headers=headers)).json()
    assert me["status"] == "ON_TRIP"

    # STEP 2: Driver taps ARRIVED
    arrived_resp = await client.post(f"/api/v1/driver-portal/jobs/{leg_id}/arrived", headers=headers)
    assert arrived_resp.status_code == 200
    assert arrived_resp.json()["status"] == "ARRIVED"

    # Verify Arrival SMS sent to passenger
    arr_sms = [s for s in sms_gateway.sent_sms if s["to"] == "+61411009988" and "has arrived" in s["body"]]
    assert len(arr_sms) == 1
    assert "Carlos Sainz" in arr_sms[0]["body"]
    assert "CS-55-VIC" in arr_sms[0]["body"]

    # STEP 3: Driver taps PICKED-UP
    pu_resp = await client.post(f"/api/v1/driver-portal/jobs/{leg_id}/picked-up", headers=headers)
    assert pu_resp.status_code == 200
    assert pu_resp.json()["status"] == "PICKED_UP"

    # STEP 4: Driver taps COMPLETE
    comp_resp = await client.post(f"/api/v1/driver-portal/jobs/{leg_id}/complete", headers=headers)
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "COMPLETED"

    # Verify Driver completed count incremented & status returned to AVAILABLE
    me_after = (await client.get("/api/v1/driver-portal/me", headers=headers)).json()
    assert me_after["status"] == "AVAILABLE"
    assert me_after["completed_trips_count"] >= 1

    # Master booking auto-completed
    reloaded_b = await BookingService.get_booking_by_id(db_session, booking.id)
    assert reloaded_b.status == BookingStatus.COMPLETED


@pytest.mark.asyncio
async def test_driver_earnings_and_settlement_statement(
    client: AsyncClient,
    db_session: AsyncSession,
    accountant_user: User
):
    user, driver, vehicle = await create_test_driver_account(db_session)
    headers = auth_header(user)
    now = datetime.now(timezone.utc)

    # Create 2 completed trips
    # Trip 1: $150 payout
    b1 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Client A",
            customer_email="a@test.com",
            customer_phone="+61400111111",
            total_fare=250.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="100 Collins St", dropoff_address="Melbourne Airport", pickup_datetime=now)]
        )
    )
    leg1_id = b1.legs[0].id
    await DispatchService.allocate_leg_to_driver(db_session, leg1_id, driver.id, vehicle.id, allocation_cost=150.0)
    await BookingService.update_leg_status(db_session, b1.id, leg1_id, LegStatus.COMPLETED)
    # Settle Trip 1
    await DispatchService.settle_leg(db_session, leg1_id, allocation_cost=150.0, actor=accountant_user)

    # Trip 2: $200 payout (Unsettled / Pending)
    b2 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Client B",
            customer_email="b@test.com",
            customer_phone="+61400222222",
            total_fare=350.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Crown Towers", dropoff_address="St Kilda", pickup_datetime=now)]
        )
    )
    leg2_id = b2.legs[0].id
    await DispatchService.allocate_leg_to_driver(db_session, leg2_id, driver.id, vehicle.id, allocation_cost=200.0)
    await BookingService.update_leg_status(db_session, b2.id, leg2_id, LegStatus.COMPLETED)

    # Driver queries earnings statement
    earn_resp = await client.get("/api/v1/driver-portal/earnings", headers=headers)
    assert earn_resp.status_code == 200
    data = earn_resp.json()
    assert data["total_completed_trips"] >= 2
    assert data["total_earnings"] >= 350.0
    assert data["settled_payout_amount"] >= 150.0
    assert data["pending_payout_amount"] >= 200.0


@pytest.mark.asyncio
async def test_driver_portal_rbac_security(
    client: AsyncClient,
    customer_user: User
):
    cust_headers = auth_header(customer_user)

    # Customer user blocked from driver portal (403 Forbidden)
    assert (await client.get("/api/v1/driver-portal/me", headers=cust_headers)).status_code == 403
    assert (await client.get("/api/v1/driver-portal/jobs", headers=cust_headers)).status_code == 403
    assert (await client.get("/api/v1/driver-portal/earnings", headers=cust_headers)).status_code == 403

    # Unauthenticated user blocked (401 Unauthorized)
    assert (await client.get("/api/v1/driver-portal/me")).status_code == 401
