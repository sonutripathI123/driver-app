from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import (
    BookingSource,
    BookingStatus,
    DriverStatus,
    LegStatus,
    PaymentStatus,
    VehicleCategory,
)
from app.models.partner import Partner
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.dispatch import (
    AllocateDriverRequest,
    OffloadPartnerRequest,
    SettleLegRequest,
)
from app.schemas.driver import DriverCreate
from app.schemas.vehicle import VehicleCreate
from app.services.booking_service import BookingService
from app.services.dispatch_service import DispatchService
from app.services.driver_service import DriverService
from app.services.vehicle_service import VehicleService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_driver_and_vehicle_conflict_detection(db_session: AsyncSession):
    now = datetime(2026, 9, 20, 10, 0, tzinfo=timezone.utc)

    # 1. Create Driver & Vehicle
    driver = await DriverService.create_driver(
        db_session,
        DriverCreate(
            full_name="Charles Leclerc",
            phone="+61433112233",
            email="charles@ferrari-racing.com",
            license_number="LIC-CL-16",
            status=DriverStatus.AVAILABLE
        )
    )
    vehicle = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.SEDAN_PREMIUM,
            make="Mercedes-Benz",
            model="E-Class E300",
            year=2024,
            color="Obsidian Black",
            registration_plate="CL-16-VIC",
            passenger_capacity=3,
            luggage_capacity=3
        )
    )

    # 2. Create Booking 1 (Leg at 10:00, 60 mins duration)
    b1 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="John Doe",
            customer_email="john@doe.com",
            customer_phone="+61400111222",
            total_fare=200.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="100 Collins St, Melbourne",
                    dropoff_address="Melbourne Airport",
                    pickup_datetime=now,
                    duration_minutes=60,
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM
                )
            ]
        )
    )
    leg1_id = b1.legs[0].id

    # Allocate Leg 1 to Charles & Mercedes -> SUCCEEDS
    allocated_leg1 = await DispatchService.allocate_leg_to_driver(
        db_session, leg1_id, driver.id, vehicle.id, allocation_cost=120.0
    )
    assert allocated_leg1.status == LegStatus.ALLOCATED

    # 3. Create Booking 2 (Leg at 10:30 - Overlaps with Leg 1!)
    b2 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Jane Doe",
            customer_email="jane@doe.com",
            customer_phone="+61400333444",
            total_fare=250.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Crown Melbourne",
                    dropoff_address="St Kilda",
                    pickup_datetime=now + timedelta(minutes=30),  # 10:30
                    duration_minutes=45,
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM
                )
            ]
        )
    )
    leg2_id = b2.legs[0].id

    # 4. Attempt to allocate Leg 2 to Charles -> REJECTED (Time Conflict!)
    with pytest.raises(Exception) as exc_info:
        await DispatchService.allocate_leg_to_driver(
            db_session, leg2_id, driver.id, vehicle.id, allocation_cost=140.0
        )
    assert "Time conflict" in str(exc_info.value)

    # 5. Create Booking 3 (Leg at 14:00 - Non-overlapping) -> SUCCEEDS
    b3 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Sam Smith",
            customer_email="sam@smith.com",
            customer_phone="+61400555666",
            total_fare=300.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Park Hyatt Melbourne",
                    dropoff_address="Yarra Valley",
                    pickup_datetime=now + timedelta(hours=4),  # 14:00
                    duration_minutes=60,
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM
                )
            ]
        )
    )
    leg3_id = b3.legs[0].id
    allocated_leg3 = await DispatchService.allocate_leg_to_driver(
        db_session, leg3_id, driver.id, vehicle.id, allocation_cost=180.0
    )
    assert allocated_leg3.status == LegStatus.ALLOCATED


@pytest.mark.asyncio
async def test_add_allocate_settle_lifecycle(
    db_session: AsyncSession,
    dispatcher_user: User,
    accountant_user: User
):
    now = datetime.now(timezone.utc)

    # Setup driver & vehicle
    driver = await DriverService.create_driver(
        db_session,
        DriverCreate(
            full_name="Oscar Piastri",
            phone="+61444555666",
            email="oscar@mclaren-racing.com",
            license_number="LIC-OP-81",
            status=DriverStatus.AVAILABLE
        )
    )
    vehicle = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.SEDAN_EXECUTIVE,
            make="BMW",
            model="7 Series",
            year=2024,
            color="Black",
            registration_plate="OP-81-VIC",
            passenger_capacity=3,
            luggage_capacity=3
        )
    )

    # 1. ADD: Booking created
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Zak Brown",
            customer_email="zak@mclaren-racing.com",
            customer_phone="+61499887711",
            total_fare=400.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Albert Park Grand Prix Circuit",
                    dropoff_address="Tullamarine Airport",
                    pickup_datetime=now + timedelta(days=2),
                    vehicle_category=VehicleCategory.SEDAN_EXECUTIVE
                )
            ]
        )
    )
    booking.paid_amount = 400.0
    booking.payment_status = PaymentStatus.PAID_IN_FULL
    leg_id = booking.legs[0].id

    # 2. ALLOCATE: Dispatcher allocates Oscar & BMW
    leg_alloc = await DispatchService.allocate_leg_to_driver(
        db_session,
        leg_id=leg_id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        allocation_cost=250.0,
        notes="VIP McLaren team principal transfer",
        actor=dispatcher_user
    )
    assert leg_alloc.status == LegStatus.ALLOCATED
    assert leg_alloc.allocation_cost == 250.0

    # DISPATCH
    leg_disp = await DispatchService.dispatch_leg(db_session, leg_id, actor=dispatcher_user)
    assert leg_disp.status == LegStatus.DISPATCHED

    # TRIP EXECUTION: EN_ROUTE -> ARRIVED -> PICKED_UP -> COMPLETED
    await BookingService.update_leg_status(db_session, booking.id, leg_id, LegStatus.COMPLETED)

    # 3. SETTLE: Accountant settles driver payout
    leg_settled = await DispatchService.settle_leg(
        db_session,
        leg_id=leg_id,
        allocation_cost=250.0,
        settlement_notes="Trip executed on time, approved for monthly payout batch.",
        actor=accountant_user
    )
    assert leg_settled.settled_at is not None
    assert leg_settled.allocation_cost == 250.0

    # Master booking automatically closed
    b_closed = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b_closed.status == BookingStatus.FINANCIALLY_CLOSED


@pytest.mark.asyncio
async def test_partner_offload_lane_and_margin(db_session: AsyncSession):
    now = datetime.now(timezone.utc)

    # 1. Register Partner
    partner = Partner(
        company_name="Sydney Elite Chauffeurs Pty Ltd",
        contact_name="Mark Webber",
        email="ops@sydneyelite.com.au",
        phone="+61299887766",
        abn="12345678901",
        commission_rate=15.0,
        city="Sydney"
    )
    db_session.add(partner)
    await db_session.commit()
    await db_session.refresh(partner)

    # 2. Create Booking in Sydney
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Daniel Ricciardo",
            customer_email="daniel@honeybadger-racing.com",
            customer_phone="+61433009988",
            total_fare=350.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="Sydney Airport Terminal 1",
                    dropoff_address="Park Hyatt Sydney, The Rocks",
                    pickup_datetime=now + timedelta(days=5),
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM
                )
            ]
        )
    )
    leg_id = booking.legs[0].id

    # 3. Offload to Partner @ $220 Payout
    leg_offloaded = await DispatchService.offload_leg_to_partner(
        db_session,
        leg_id=leg_id,
        partner_id=partner.id,
        partner_payout_amount=220.0,
        partner_reference="SYD-JOB-9921",
        notes="Affiliate partner transfer in Sydney"
    )
    assert leg_offloaded.status == LegStatus.ALLOCATED
    assert leg_offloaded.partner_id == partner.id
    assert leg_offloaded.partner_payout_amount == 220.0
    assert leg_offloaded.driver_id is None

    # 4. Check Operate Board margin
    board = await DispatchService.get_operate_board(db_session)
    item = next(i for i in board.legs if i.id == leg_id)
    assert item.partner_name == "Sydney Elite Chauffeurs Pty Ltd"
    assert item.customer_fare_share == 350.0
    assert item.partner_payout_amount == 220.0
    assert item.net_margin == 130.0  # $350 - $220 = $130 margin!


@pytest.mark.asyncio
async def test_dispatch_api_endpoints_and_rbac(
    client: AsyncClient,
    db_session: AsyncSession,
    dispatcher_user: User,
    customer_user: User
):
    disp_headers = auth_header(dispatcher_user)
    cust_headers = auth_header(customer_user)

    now = datetime.now(timezone.utc)
    # 1. Create booking
    b_resp = await client.post(
        "/api/v1/bookings/",
        json={
            "customer_name": "Valtteri Bottas",
            "customer_email": "valtteri@stake-racing.com",
            "customer_phone": "+61400223344",
            "total_fare": 250.0,
            "legs": [
                {
                    "leg_number": 1,
                    "pickup_address": "Crown Towers Melbourne",
                    "dropoff_address": "Yarra Valley Wineries",
                    "pickup_datetime": (now + timedelta(days=3)).isoformat()
                }
            ]
        }
    )
    assert b_resp.status_code == 201
    booking_id = b_resp.json()["id"]
    leg_id = b_resp.json()["legs"][0]["id"]

    # 2. Query Operate Board
    board_resp = await client.get("/api/v1/dispatch/board", headers=disp_headers)
    assert board_resp.status_code == 200
    assert board_resp.json()["summary"]["total_legs"] >= 1

    # 3. Customer blocked from dispatch board (403 Forbidden)
    assert (await client.get("/api/v1/dispatch/board", headers=cust_headers)).status_code == 403

    # 4. Check available drivers endpoint
    dt_query = (now + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    avail_resp = await client.get(
        f"/api/v1/dispatch/available-drivers?pickup_datetime={dt_query}",
        headers=disp_headers
    )
    assert avail_resp.status_code == 200
    assert isinstance(avail_resp.json(), list)


@pytest.mark.asyncio
async def test_partner_management_crud_and_rbac(
    client: AsyncClient,
    ops_user: User,
    dispatcher_user: User,
    customer_user: User
):
    ops_headers = auth_header(ops_user)
    disp_headers = auth_header(dispatcher_user)
    cust_headers = auth_header(customer_user)

    # 1. Ops creates affiliate partner
    partner_payload = {
        "company_name": "Brisbane Chauffeur Direct",
        "contact_name": "Craig Lowndes",
        "email": "craig@brisbanechauffeurs.com.au",
        "phone": "+61733001122",
        "abn": "98765432109",
        "commission_rate": 18.0,
        "city": "Brisbane",
        "notes": "Premium partner for QLD operations"
    }
    create_resp = await client.post("/api/v1/partners/", json=partner_payload, headers=ops_headers)
    assert create_resp.status_code == 201
    partner_id = create_resp.json()["id"]

    # 2. Dispatcher can view partners
    list_resp = await client.get("/api/v1/partners/", headers=disp_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # 3. Customer CANNOT access partner endpoints
    assert (await client.get("/api/v1/partners/", headers=cust_headers)).status_code == 403
    assert (await client.post("/api/v1/partners/", json=partner_payload, headers=cust_headers)).status_code == 403

    # 4. Ops updates partner details
    update_resp = await client.patch(
        f"/api/v1/partners/{partner_id}",
        json={"commission_rate": 16.5, "notes": "Renegotiated commission rate"},
        headers=ops_headers
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["commission_rate"] == 16.5

