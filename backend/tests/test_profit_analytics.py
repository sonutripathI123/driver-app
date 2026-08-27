from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import DriverStatus, LegStatus, UserRole, VehicleCategory
from app.models.payment import PaymentTransaction
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.driver import DriverCreate
from app.schemas.partner import PartnerCreate
from app.schemas.vehicle import VehicleCreate
from app.services.analytics_service import AnalyticsService
from app.services.booking_service import BookingService
from app.services.dispatch_service import DispatchService
from app.services.driver_service import DriverService
from app.services.partner_service import PartnerService
from app.services.vehicle_service import VehicleService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_executive_dashboard_summary_metrics(
    db_session: AsyncSession
):
    now = datetime.now(timezone.utc)

    # 1. Create Driver and Vehicle
    veh = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.SEDAN_PREMIUM,
            make="Mercedes-Benz",
            model="S-Class",
            year=2024,
            registration_plate="EXEC-01-VIC"
        )
    )
    drv = await DriverService.create_driver(
        db_session,
        DriverCreate(
            full_name="Sebastian Vettel",
            phone="+61411000111",
            email="seb@f1.com",
            license_number="LIC-SV-05",
            status=DriverStatus.AVAILABLE
        )
    )

    # 2. Create Booking 1: $550 Gross total ($500 Ex GST, $50 GST)
    b1 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Goldman Sachs",
            customer_email="corporate@gs.com",
            customer_phone="+61400111222",
            total_fare=550.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Collins St", dropoff_address="Airport", pickup_datetime=now)]
        )
    )
    leg1 = b1.legs[0]
    await DispatchService.allocate_leg_to_driver(db_session, leg1.id, drv.id, veh.id, allocation_cost=180.0)
    await BookingService.update_leg_status(db_session, b1.id, leg1.id, LegStatus.COMPLETED)

    # 3. Create Booking 2: $440 Gross total ($400 Ex GST, $40 GST)
    b2 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Macquarie Bank",
            customer_email="corp@macquarie.com",
            customer_phone="+61400333444",
            total_fare=440.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Southbank", dropoff_address="Portsea", pickup_datetime=now)]
        )
    )
    leg2 = b2.legs[0]
    # Partner offload: $170 payout
    partner = await PartnerService.create_partner(
        db_session,
        PartnerCreate(
            company_name="Peninsula Chauffeurs",
            contact_name="Mark Webber",
            email="mark@peninsula.com.au",
            phone="+61422000222",
            insurance_expiry=now + timedelta(days=90)
        )
    )
    await DispatchService.offload_leg_to_partner(db_session, leg2.id, partner.id, partner_payout_amount=170.0)
    await BookingService.update_leg_status(db_session, b2.id, leg2.id, LegStatus.COMPLETED)

    # Total Gross Revenue = $550 + $440 = $990.00
    # Net Revenue Ex GST = $900.00, GST Collected = $90.00
    # Direct Costs = $180 (Driver) + $170 (Partner) = $350.00
    # Gross Profit = $900 - $350 = $550.00
    # Margin % = (550 / 900) * 100 = 61.11%

    summary = await AnalyticsService.get_executive_dashboard(
        db_session,
        date_from=now - timedelta(days=1),
        date_to=now + timedelta(days=1)
    )

    assert summary.gross_revenue_inc_gst >= 990.0
    assert summary.net_revenue_ex_gst >= 900.0
    assert summary.gst_collected_10pct >= 90.0
    assert summary.total_direct_costs >= 350.0
    assert summary.gross_profit >= 550.0
    assert summary.completed_trips_count >= 2
    assert summary.gross_profit_margin_pct >= 50.0


@pytest.mark.asyncio
async def test_trip_profitability_and_margin_alerts(
    db_session: AsyncSession
):
    now = datetime.now(timezone.utc)

    # 1. High Margin Trip ($330 fare, $80 driver cost) -> ~73% margin
    b1 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="High Margin Client",
            customer_email="hm@client.com",
            customer_phone="+61400000001",
            total_fare=330.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="120 Collins St", dropoff_address="Melbourne Airport", pickup_datetime=now)]
        )
    )
    b1.legs[0].allocation_cost = 80.0

    # 2. Low Margin Trip ($110 fare, $85 cost) -> Fare Ex GST = $100. Profit = $15 (15% margin < 25% threshold)
    b2 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Low Margin Client",
            customer_email="lm@client.com",
            customer_phone="+61400000002",
            total_fare=110.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Crown Towers", dropoff_address="St Kilda Beach", pickup_datetime=now)]
        )
    )
    b2.legs[0].allocation_cost = 85.0

    await db_session.commit()

    report = await AnalyticsService.get_trip_profitability(
        db_session,
        date_from=now - timedelta(days=1),
        date_to=now + timedelta(days=1),
        low_margin_threshold=25.0
    )

    assert report.total_trips >= 2
    assert report.low_margin_trips_count >= 1

    # Verify individual trip margin calculations
    low_trip = next((t for t in report.trips if t.booking_id == b2.id), None)
    assert low_trip is not None
    assert low_trip.is_low_margin is True
    assert low_trip.gross_profit == 15.0


@pytest.mark.asyncio
async def test_vehicle_fleet_roi_and_utilization_rates(
    db_session: AsyncSession
):
    now = datetime.now(timezone.utc)

    veh = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.PEOPLE_MOVER,
            make="Mercedes-Benz",
            model="V-Class",
            year=2024,
            registration_plate="V-FLEET-88"
        )
    )

    b = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="VIP Delegation",
            customer_email="vip@delegation.com",
            customer_phone="+61499999999",
            total_fare=660.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Convention Centre", dropoff_address="Yarra Valley", pickup_datetime=now)]
        )
    )
    leg = b.legs[0]
    leg.vehicle_id = veh.id
    leg.status = LegStatus.COMPLETED
    leg.distance_km = 65.0
    leg.duration_minutes = 75
    leg.completed_at = now
    await db_session.commit()

    report = await AnalyticsService.get_vehicle_utilization(
        db_session,
        date_from=now - timedelta(days=1),
        date_to=now + timedelta(days=1)
    )

    assert report.total_vehicles >= 1
    target_v = next((v for v in report.vehicles if v.vehicle_id == veh.id), None)
    assert target_v is not None
    assert target_v.total_trips == 1
    assert target_v.total_distance_km == 65.0
    assert target_v.total_revenue_generated == 660.0
    assert target_v.estimated_trip_hours == 1.25


@pytest.mark.asyncio
async def test_driver_performance_kpi_scorecards(
    db_session: AsyncSession
):
    now = datetime.now(timezone.utc)

    drv = await DriverService.create_driver(
        db_session,
        DriverCreate(
            full_name="Fernando Alonso",
            phone="+61433000333",
            email="fernando@aston.com",
            license_number="LIC-FA-14",
            status=DriverStatus.AVAILABLE
        )
    )

    b = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Grand Prix Guest",
            customer_email="gp@guest.com",
            customer_phone="+61400111333",
            total_fare=220.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Albert Park", dropoff_address="Crown", pickup_datetime=now)]
        )
    )
    leg = b.legs[0]
    leg.driver_id = drv.id
    leg.allocation_cost = 110.0
    leg.status = LegStatus.COMPLETED
    leg.arrived_at = now - timedelta(minutes=5)  # Arrived 5 mins early -> on-time
    leg.completed_at = now + timedelta(minutes=25)
    await db_session.commit()

    report = await AnalyticsService.get_driver_kpis(
        db_session,
        date_from=now - timedelta(days=1),
        date_to=now + timedelta(days=1)
    )

    assert report.total_drivers >= 1
    target_d = next((d for d in report.drivers if d.driver_id == drv.id), None)
    assert target_d is not None
    assert target_d.total_trips_completed == 1
    assert target_d.total_earnings == 110.0
    assert target_d.on_time_arrival_rate_pct == 100.0


@pytest.mark.asyncio
async def test_csv_export_streaming_endpoints(
    client: AsyncClient,
    db_session: AsyncSession,
    ops_user: User,
    accountant_user: User
):
    now = datetime.now(timezone.utc)
    ops_headers = auth_header(ops_user)
    acc_headers = auth_header(accountant_user)

    # 1. Test Trip Profitability CSV
    resp1 = await client.get("/api/v1/analytics/export/trip-profitability.csv", headers=ops_headers)
    assert resp1.status_code == 200
    assert resp1.headers["content-type"].startswith("text/csv")
    csv_text = resp1.text
    assert "Booking Number,Leg Number,Pickup DateTime" in csv_text
    assert "Gross Profit ($)" in csv_text

    # 2. Test Financial Ledger CSV
    resp2 = await client.get("/api/v1/analytics/export/financial-ledger.csv", headers=acc_headers)
    assert resp2.status_code == 200
    assert resp2.headers["content-type"].startswith("text/csv")
    ledger_text = resp2.text
    assert "Transaction ID,Date,Booking ID" in ledger_text


@pytest.mark.asyncio
async def test_analytics_rbac_security(
    client: AsyncClient,
    driver_user: User,
    customer_user: User,
    ops_user: User
):
    ops_headers = auth_header(ops_user)
    driver_headers = auth_header(driver_user)
    customer_headers = auth_header(customer_user)

    # Ops allowed
    resp_ops = await client.get("/api/v1/analytics/dashboard-summary", headers=ops_headers)
    assert resp_ops.status_code == 200

    # Driver blocked (403)
    resp_driver = await client.get("/api/v1/analytics/dashboard-summary", headers=driver_headers)
    assert resp_driver.status_code == 403

    # Customer blocked (403)
    resp_cust = await client.get("/api/v1/analytics/dashboard-summary", headers=customer_headers)
    assert resp_cust.status_code == 403
