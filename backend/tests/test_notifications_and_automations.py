from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.integrations.notifications.email_client import email_gateway
from app.integrations.notifications.sms_client import sms_gateway
from app.models.enums import (
    BookingStatus,
    DriverStatus,
    PaymentStatus,
    VehicleCategory,
)
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.driver import DriverCreate
from app.schemas.vehicle import VehicleCreate
from app.services.automation_service import AutomationService
from app.services.booking_service import BookingService
from app.services.dispatch_service import DispatchService
from app.services.driver_service import DriverService
from app.services.vehicle_service import VehicleService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_dual_ops_and_customer_notifications_on_booking(db_session: AsyncSession):
    now = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)
    email_gateway.sent_emails.clear()
    sms_gateway.sent_sms.clear()

    # 1. Create a booking
    b_in = BookingCreate(
        customer_name="George Russell",
        customer_email="george@mercedes-racing.com",
        customer_phone="+61411223344",
        total_fare=320.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="120 Collins St, Melbourne",
                dropoff_address="Melbourne Airport Terminal 2",
                pickup_datetime=now + timedelta(days=4),
                vehicle_category=VehicleCategory.SEDAN_EXECUTIVE
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)

    # 2. Verify Customer & Ops emails dispatched
    customer_emails = [e for e in email_gateway.sent_emails if e["to"] == "george@mercedes-racing.com"]
    ops_emails = [e for e in email_gateway.sent_emails if e["to"] == "ops@crownchauffeurs.com.au"]
    customer_sms = [s for s in sms_gateway.sent_sms if s["to"] == "+61411223344"]

    assert len(customer_emails) == 1
    assert booking.booking_number in customer_emails[0]["subject"]
    assert len(ops_emails) == 1
    assert "OPS ALERT" in ops_emails[0]["subject"]
    assert len(customer_sms) == 1
    assert booking.booking_number in customer_sms[0]["body"]


@pytest.mark.asyncio
async def test_automated_7_5_3_balance_chasing(db_session: AsyncSession):
    base_time = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)
    pickup_time = base_time + timedelta(days=6)  # Pickup in 6 days (144h)

    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Lewis Hamilton",
            customer_email="lewis@ferrari-racing.com",
            customer_phone="+61499001122",
            total_fare=500.0,
            deposit_required=100.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Crown Towers, Melbourne",
                    dropoff_address="Avalon Airport",
                    pickup_datetime=pickup_time,
                    vehicle_category=VehicleCategory.SEDAN_EXECUTIVE
                )
            ]
        )
    )
    # Customer paid deposit, remaining balance = $400
    booking.paid_amount = 100.0
    booking.balance_amount = 400.0
    booking.status = BookingStatus.CONFIRMED
    booking.payment_status = PaymentStatus.PARTIAL_DEPOSIT
    await db_session.commit()

    email_gateway.sent_emails.clear()

    # --- TEST 1: At 6 days out (144h) -> Triggers 7-Day Milestone Reminder ---
    res_7d = await AutomationService.process_balance_chasing(db_session, reference_now=base_time)
    assert res_7d.milestone_7d_count == 1
    assert len([e for e in email_gateway.sent_emails if "7_DAYS" in e["subject"] or "Balance Due" in e["subject"]]) >= 1

    # Idempotency check: running again at same time must NOT re-send
    res_7d_dup = await AutomationService.process_balance_chasing(db_session, reference_now=base_time)
    assert res_7d_dup.milestone_7d_count == 0

    # --- TEST 2: Advance time to 4 days before pickup (96h) -> Triggers 5-Day Milestone ---
    time_4d = pickup_time - timedelta(days=4)
    res_5d = await AutomationService.process_balance_chasing(db_session, reference_now=time_4d)
    assert res_5d.milestone_5d_count == 1

    # --- TEST 3: Advance time to 2 days before pickup (48h) -> Triggers 3-Day Urgent Notice ---
    time_2d = pickup_time - timedelta(days=2)
    res_3d = await AutomationService.process_balance_chasing(db_session, reference_now=time_2d)
    assert res_3d.milestone_3d_count == 1

    # --- TEST 4: Advance time to 12 hours before pickup (Unpaid) -> Flags OVERDUE ---
    time_12h = pickup_time - timedelta(hours=12)
    res_overdue = await AutomationService.process_balance_chasing(db_session, reference_now=time_12h)
    assert res_overdue.overdue_escalations == 1

    reloaded = await BookingService.get_booking_by_id(db_session, booking.id)
    assert reloaded.payment_status == PaymentStatus.OVERDUE
    assert set(reloaded.balance_reminders_sent) == {"7_DAYS", "5_DAYS", "3_DAYS"}


@pytest.mark.asyncio
async def test_2_hour_pre_trip_driver_handover(db_session: AsyncSession):
    now = datetime(2026, 10, 5, 14, 0, tzinfo=timezone.utc)
    pickup_time = now + timedelta(hours=1, minutes=30)  # Scheduled in 1.5 hours

    # 1. Setup Driver & Vehicle
    driver = await DriverService.create_driver(
        db_session,
        DriverCreate(
            full_name="Fernando Alonso",
            phone="+61433778899",
            email="fernando@astonmartin-racing.com",
            license_number="LIC-FA-14",
            status=DriverStatus.AVAILABLE
        )
    )
    vehicle = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.SEDAN_PREMIUM,
            make="Mercedes-Benz",
            model="S-Class S450",
            year=2024,
            color="Silver",
            registration_plate="FA-14-VIC",
            passenger_capacity=3,
            luggage_capacity=3
        )
    )

    # 2. Create Booking and Allocate Driver
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Aston Client",
            customer_email="client@aston.com",
            customer_phone="+61412345678",
            total_fare=280.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Grand Hyatt Melbourne",
                    dropoff_address="Essendon Airport",
                    pickup_datetime=pickup_time,
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM,
                    pickup_notes="Flight departing at 17:00, passenger has 2 large bags"
                )
            ]
        )
    )
    leg_id = booking.legs[0].id
    await DispatchService.allocate_leg_to_driver(
        db_session, leg_id, driver.id, vehicle.id, allocation_cost=150.0
    )

    email_gateway.sent_emails.clear()
    sms_gateway.sent_sms.clear()

    # 3. Trigger Pre-Trip Handover Engine
    handover_res = await AutomationService.process_pre_trip_handovers(db_session, reference_now=now)
    assert handover_res.driver_handovers_count == 1

    # Verify Customer SMS contains Chauffeur Name and Vehicle Plate
    cust_sms = [s for s in sms_gateway.sent_sms if s["to"] == "+61412345678"]
    assert len(cust_sms) == 1
    assert "Fernando Alonso" in cust_sms[0]["body"]
    assert "FA-14-VIC" in cust_sms[0]["body"]

    # Verify Driver SMS contains Passenger Notes
    drv_sms = [s for s in sms_gateway.sent_sms if s["to"] == "+61433778899"]
    assert len(drv_sms) == 1
    assert "2 large bags" in drv_sms[0]["body"]

    # Handover flag must be set
    reloaded = await BookingService.get_booking_by_id(db_session, booking.id)
    assert reloaded.driver_handover_sent is True

    # Rerunning should not duplicate handover
    handover_res_dup = await AutomationService.process_pre_trip_handovers(db_session, reference_now=now)
    assert handover_res_dup.driver_handovers_count == 0


@pytest.mark.asyncio
async def test_cancellation_circuit_breaker(db_session: AsyncSession):
    now = datetime(2026, 10, 20, 10, 0, tzinfo=timezone.utc)
    email_gateway.sent_emails.clear()

    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Max Verstappen",
            customer_email="max@redbull-racing.com",
            customer_phone="+61499112233",
            total_fare=600.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Albert Park Circuit",
                    dropoff_address="Melbourne Tullamarine",
                    pickup_datetime=now + timedelta(days=2),
                    vehicle_category=VehicleCategory.SEDAN_EXECUTIVE
                )
            ]
        )
    )
    booking.balance_amount = 600.0

    # Cancel booking
    await BookingService.cancel_booking(db_session, booking.id, reason="Customer schedule changed")

    # Cancellation notices sent to customer & ops
    assert len([e for e in email_gateway.sent_emails if "Cancellation Notice" in e["subject"]]) == 1
    assert len([e for e in email_gateway.sent_emails if "CANCELLED" in e["subject"]]) == 1

    # Circuit breaker: Balance chasing MUST skip this cancelled booking!
    balance_res = await AutomationService.process_balance_chasing(db_session, reference_now=now)
    assert balance_res.milestone_3d_count == 0
    assert balance_res.milestone_5d_count == 0
    assert balance_res.milestone_7d_count == 0


@pytest.mark.asyncio
async def test_notifications_api_and_direct_messaging(
    client: AsyncClient,
    ops_user: User,
    customer_user: User
):
    ops_headers = auth_header(ops_user)
    cust_headers = auth_header(customer_user)

    # 1. Staff sends direct custom SMS
    sms_payload = {
        "recipient": "+61411998877",
        "channel": "SMS",
        "message": "Crown Chauffeur Concierge: Your vehicle is arriving at Terminal 1."
    }
    sms_resp = await client.post("/api/v1/notifications/send-direct", json=sms_payload, headers=ops_headers)
    assert sms_resp.status_code == 200
    assert sms_resp.json()["channel"] == "SMS"

    # 2. Staff sends direct custom Email
    email_payload = {
        "recipient": "vip@corporate-client.com",
        "channel": "EMAIL",
        "subject": "Private Jet Chauffeur Arrival Notification",
        "message": "Your chauffeur has arrived at the Melbourne Jet Base."
    }
    email_resp = await client.post("/api/v1/notifications/send-direct", json=email_payload, headers=ops_headers)
    assert email_resp.status_code == 200
    assert email_resp.json()["channel"] == "EMAIL"

    # 3. Query Notifications Outbox
    list_resp = await client.get("/api/v1/notifications/", headers=ops_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 2

    # 4. Trigger automations via API
    chase_resp = await client.post("/api/v1/automations/run-balance-chase", headers=ops_headers)
    assert chase_resp.status_code == 200

    handover_resp = await client.post("/api/v1/automations/run-pre-trip-handover", headers=ops_headers)
    assert handover_resp.status_code == 200

    # 5. Customer blocked from outbox log (403 Forbidden)
    assert (await client.get("/api/v1/notifications/", headers=cust_headers)).status_code == 403
