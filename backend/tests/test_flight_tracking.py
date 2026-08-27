from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.integrations.notifications.sms_client import sms_gateway
from app.models.enums import DriverStatus, LegStatus, UserRole, VehicleCategory
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.driver import DriverCreate
from app.schemas.flight import FlightWaitTimeRequest
from app.schemas.vehicle import VehicleCreate
from app.services.booking_service import BookingService
from app.services.dispatch_service import DispatchService
from app.services.driver_service import DriverService
from app.services.flight_service import FlightTrackingService
from app.services.vehicle_service import VehicleService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_flight_lookup_mock_provider():
    # 1. QF401 (Delayed +45m)
    qf = await FlightTrackingService.lookup_flight("QF401")
    assert qf.flight_number == "QF401"
    assert qf.airline == "Qantas"
    assert qf.status == "DELAYED"
    assert qf.delay_minutes == 45
    assert "Terminal 1" in qf.terminal

    # 2. EK406 (Landed On Time)
    ek = await FlightTrackingService.lookup_flight("EK406")
    assert ek.flight_number == "EK406"
    assert ek.airline == "Emirates"
    assert ek.status == "LANDED"
    assert ek.delay_minutes == 0

    # 3. CX105 (Cancelled)
    cx = await FlightTrackingService.lookup_flight("CX105")
    assert cx.status == "CANCELLED"


@pytest.mark.asyncio
async def test_automated_flight_delay_rescheduling_and_driver_alert(
    db_session: AsyncSession,
    dispatcher_user: User
):
    now = datetime.now(timezone.utc).replace(hour=10, minute=0, second=0, microsecond=0)
    sms_gateway.sent_sms.clear()

    # 1. Setup Driver & Vehicle
    driver = await DriverService.create_driver(
        db_session,
        DriverCreate(
            full_name="Mark Webber",
            phone="+61422334455",
            email="mark@aero-driver.com",
            license_number="LIC-MW-02",
            status=DriverStatus.AVAILABLE
        )
    )
    vehicle = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.SEDAN_PREMIUM,
            make="Genesis",
            model="G90",
            year=2024,
            color="Black",
            registration_plate="MW-02-VIC",
            passenger_capacity=3,
            luggage_capacity=3
        )
    )

    # 2. Create Airport Booking for QF401 (Initial pickup at 14:00)
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Aero Passenger",
            customer_email="aero@corporate.com",
            customer_phone="+61400112233",
            total_fare=220.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Melbourne Airport Terminal 1",
                    dropoff_address="Crown Towers, Southbank",
                    pickup_datetime=now.replace(hour=14, minute=0),
                    is_airport_pickup=True,
                    airline="Qantas",
                    flight_number="QF401",
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM
                )
            ]
        )
    )
    leg_id = booking.legs[0].id

    # Allocate driver
    await DispatchService.allocate_leg_to_driver(
        db_session, leg_id, driver.id, vehicle.id, allocation_cost=120.0
    )

    # 3. Synchronize Flight Status
    sync_resp = await FlightTrackingService.sync_leg_flight_status(
        db_session, leg_id, actor=dispatcher_user
    )

    assert sync_resp.schedule_adjusted is True
    assert sync_resp.delay_minutes == 45
    assert sync_resp.new_pickup_datetime > sync_resp.old_pickup_datetime

    # 4. Verify Driver Alerted via SMS
    driver_alerts = [s for s in sms_gateway.sent_sms if s["to"] == "+61422334455"]
    assert len(driver_alerts) == 1
    assert "QF401 delayed +45m" in driver_alerts[0]["body"]

    # 5. Verify Leg updated in database
    reloaded_leg = await db_session.get(booking.legs[0].__class__, leg_id)
    assert reloaded_leg.flight_delay_minutes == 45
    assert reloaded_leg.flight_status == "DELAYED"
    assert "Terminal 1" in reloaded_leg.flight_terminal


@pytest.mark.asyncio
async def test_active_airport_legs_polling_cron(db_session: AsyncSession):
    now = datetime.now(timezone.utc)

    # Create 2 airport legs within upcoming 24h
    b1 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Emirates Guest",
            customer_email="ek@guest.com",
            customer_phone="+61433001122",
            total_fare=300.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Melbourne Airport T2",
                    dropoff_address="Grand Hyatt Melbourne",
                    pickup_datetime=now + timedelta(hours=5),
                    is_airport_pickup=True,
                    flight_number="EK406"
                )
            ]
        )
    )
    b2 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Virgin Guest",
            customer_email="va@guest.com",
            customer_phone="+61433002233",
            total_fare=250.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Melbourne Airport T3",
                    dropoff_address="Park Hyatt Melbourne",
                    pickup_datetime=now + timedelta(hours=8),
                    is_airport_pickup=True,
                    flight_number="VA820"
                )
            ]
        )
    )

    # Trigger Polling Engine
    results = await FlightTrackingService.poll_all_active_airport_legs(db_session)
    assert len(results) >= 2
    f_nums = [r.flight_number for r in results]
    assert "EK406" in f_nums
    assert "VA820" in f_nums


def test_complimentary_and_billable_wait_time_calculations():
    now = datetime(2026, 10, 15, 14, 0, tzinfo=timezone.utc)

    # --- Scenario 1: Airport Pickup with 45m wait (Within 60 min free window) ---
    req_airport_free = FlightWaitTimeRequest(
        arrived_at=now,
        passenger_boarded_at=now + timedelta(minutes=45),
        is_airport_pickup=True,
        flight_actual_arrival=now,
        hourly_wait_rate=90.0  # $1.50/min
    )
    res1 = FlightTrackingService.calculate_wait_time(req_airport_free)
    assert res1.complimentary_minutes == 60
    assert res1.total_wait_minutes == 45
    assert res1.billable_wait_minutes == 0
    assert res1.wait_time_charge == 0.0

    # --- Scenario 2: Airport Pickup with 90m wait (30m billable) ---
    req_airport_billable = FlightWaitTimeRequest(
        arrived_at=now,
        passenger_boarded_at=now + timedelta(minutes=90),
        is_airport_pickup=True,
        flight_actual_arrival=now,
        hourly_wait_rate=90.0  # $1.50/min
    )
    res2 = FlightTrackingService.calculate_wait_time(req_airport_billable)
    assert res2.total_wait_minutes == 90
    assert res2.billable_wait_minutes == 30
    assert res2.wait_time_charge == 45.0  # 30 * $1.50 = $45.00

    # --- Scenario 3: Standard City Pickup with 10m wait (Within 15 min free window) ---
    req_city_free = FlightWaitTimeRequest(
        arrived_at=now,
        passenger_boarded_at=now + timedelta(minutes=10),
        is_airport_pickup=False,
        hourly_wait_rate=90.0
    )
    res3 = FlightTrackingService.calculate_wait_time(req_city_free)
    assert res3.complimentary_minutes == 15
    assert res3.total_wait_minutes == 10
    assert res3.billable_wait_minutes == 0
    assert res3.wait_time_charge == 0.0

    # --- Scenario 4: Standard City Pickup with 45m wait (30m billable) ---
    req_city_billable = FlightWaitTimeRequest(
        arrived_at=now,
        passenger_boarded_at=now + timedelta(minutes=45),
        is_airport_pickup=False,
        hourly_wait_rate=90.0
    )
    res4 = FlightTrackingService.calculate_wait_time(req_city_billable)
    assert res4.total_wait_minutes == 45
    assert res4.billable_wait_minutes == 30
    assert res4.wait_time_charge == 45.0


@pytest.mark.asyncio
async def test_flight_api_endpoints_and_rbac(
    client: AsyncClient,
    dispatcher_user: User
):
    disp_headers = auth_header(dispatcher_user)

    # 1. Flight lookup
    lookup_resp = await client.get("/api/v1/flights/lookup?flight_number=EK406", headers=disp_headers)
    assert lookup_resp.status_code == 200
    assert lookup_resp.json()["airline"] == "Emirates"

    # 2. Wait time calculator endpoint (Publicly callable)
    calc_payload = {
        "arrived_at": "2026-10-15T14:00:00Z",
        "passenger_boarded_at": "2026-10-15T15:30:00Z",
        "is_airport_pickup": True,
        "hourly_wait_rate": 90.0
    }
    calc_resp = await client.post("/api/v1/flights/calculate-wait-time", json=calc_payload)
    assert calc_resp.status_code == 200
    assert calc_resp.json()["billable_wait_minutes"] == 30
    assert calc_resp.json()["wait_time_charge"] == 45.0

    # 3. Unauthenticated lookup blocked (401)
    assert (await client.get("/api/v1/flights/lookup?flight_number=EK406")).status_code == 401
