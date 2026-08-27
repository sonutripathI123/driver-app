from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.customer import Customer
from app.models.enums import DriverStatus, InvoiceStatus, LegStatus, UserRole, VehicleCategory
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.accounting import (
    DriverPayoutBatchCreate,
    FIFOPaymentAllocationRequest,
)
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.driver import DriverCreate
from app.schemas.vehicle import VehicleCreate
from app.services.accounting_service import (
    AccountingService,
    calculate_australian_gst,
)
from app.services.booking_service import BookingService
from app.services.dispatch_service import DispatchService
from app.services.driver_service import DriverService
from app.services.vehicle_service import VehicleService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_australian_gst_10pct_calculation_and_invoice_generation(
    db_session: AsyncSession,
    accountant_user: User
):
    # Test 1/11th GST Helper Rule
    subtotal, gst = calculate_australian_gst(550.0)
    assert gst == 50.0
    assert subtotal == 500.0

    now = datetime.now(timezone.utc)

    # 1. Create a Master Booking with $550 Total Fare
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Rio Tinto Executive",
            customer_email="corporate@riotinto.com",
            customer_phone="+61499112233",
            total_fare=550.0,
            legs=[
                BookingLegCreate(
                    leg_number=1,
                    pickup_address="120 Collins St, Melbourne",
                    dropoff_address="Melbourne Airport Terminal 1",
                    pickup_datetime=now + timedelta(days=2),
                    is_airport_pickup=True,
                    vehicle_category=VehicleCategory.SEDAN_PREMIUM
                )
            ]
        )
    )

    # 2. Generate Tax Invoice
    invoice = await AccountingService.generate_invoice_for_booking(
        db_session, booking.id, due_days=30, actor=accountant_user
    )

    assert invoice.invoice_number.startswith("INV-")
    assert invoice.total_inc_gst == 550.0
    assert invoice.gst_amount == 50.0
    assert invoice.subtotal_ex_gst == 500.0
    assert invoice.amount_paid == 0.0
    assert invoice.balance_due == 550.0
    assert invoice.status == InvoiceStatus.ISSUED
    assert len(invoice.line_items) == 1
    assert "Airport Meet & Greet Included" in invoice.line_items[0].description
    assert invoice.line_items[0].gst_amount == 50.0


@pytest.mark.asyncio
async def test_oldest_invoice_first_fifo_debt_allocation(
    db_session: AsyncSession,
    accountant_user: User
):
    now = datetime.now(timezone.utc)

    # 1. Create Corporate Customer
    customer = Customer(
        full_name="BHP Corporate Fleet",
        email="fleet@bhp.com",
        phone="+61380009999",
        company_name="BHP Group Limited"
    )
    db_session.add(customer)
    await db_session.flush()

    # 2. Create 3 Open Invoices (Different dates)
    # Inv 1: $330.00 (Oldest - 30 days ago)
    inv1 = Invoice(
        invoice_number="INV-2026-0101",
        customer_id=customer.id,
        status=InvoiceStatus.ISSUED,
        issue_date=now - timedelta(days=30),
        due_date=now - timedelta(days=16),
        subtotal_ex_gst=300.0,
        gst_amount=30.0,
        total_inc_gst=330.0,
        amount_paid=0.0,
        balance_due=330.0
    )
    # Inv 2: $440.00 (15 days ago)
    inv2 = Invoice(
        invoice_number="INV-2026-0102",
        customer_id=customer.id,
        status=InvoiceStatus.ISSUED,
        issue_date=now - timedelta(days=15),
        due_date=now - timedelta(days=1),
        subtotal_ex_gst=400.0,
        gst_amount=40.0,
        total_inc_gst=440.0,
        amount_paid=0.0,
        balance_due=440.0
    )
    # Inv 3: $550.00 (Today)
    inv3 = Invoice(
        invoice_number="INV-2026-0103",
        customer_id=customer.id,
        status=InvoiceStatus.ISSUED,
        issue_date=now,
        due_date=now + timedelta(days=14),
        subtotal_ex_gst=500.0,
        gst_amount=50.0,
        total_inc_gst=550.0,
        amount_paid=0.0,
        balance_due=550.0
    )
    db_session.add_all([inv1, inv2, inv3])
    await db_session.commit()

    # Total Outstanding Debt = $330 + $440 + $550 = $1,320.00
    # Customer sends lump-sum remittance of $600.00 via Bank Transfer
    alloc_req = FIFOPaymentAllocationRequest(
        customer_id=customer.id,
        payment_amount=600.0,
        payment_method="BANK_TRANSFER",
        reference_number="EFT-BHP-88392",
        notes="Monthly fleet remittance"
    )

    alloc_res = await AccountingService.allocate_fifo_payment(
        db_session, alloc_req, actor=accountant_user
    )

    assert alloc_res.total_payment_amount == 600.0
    assert alloc_res.total_allocated == 600.0
    assert alloc_res.unallocated_credit == 0.0
    assert len(alloc_res.allocations) == 2

    # Verification of Sequential FIFO Allocation:
    # 1st Invoice (Oldest): Allocated $330.00 -> Cleared to $0.00 (PAID)
    a1 = alloc_res.allocations[0]
    assert a1.invoice_number == "INV-2026-0101"
    assert a1.allocated_amount == 330.0
    assert a1.new_balance == 0.0
    assert a1.status == InvoiceStatus.PAID

    # 2nd Invoice: Allocated remaining $270.00 ($600 - $330) -> Balance remaining $170.00 ($440 - $270)
    a2 = alloc_res.allocations[1]
    assert a2.invoice_number == "INV-2026-0102"
    assert a2.allocated_amount == 270.0
    assert a2.new_balance == 170.0
    assert a2.status == InvoiceStatus.PARTIALLY_PAID

    # 3rd Invoice: Untouched ($550 balance due)
    reloaded_inv3 = await AccountingService.get_invoice_by_id(db_session, inv3.id)
    assert reloaded_inv3.balance_due == 550.0
    assert reloaded_inv3.status == InvoiceStatus.ISSUED


@pytest.mark.asyncio
async def test_driver_rcti_payout_batch_generator(
    db_session: AsyncSession,
    accountant_user: User
):
    now = datetime.now(timezone.utc)

    # 1. Create Driver and Vehicle
    vehicle = await VehicleService.create_vehicle(
        db_session,
        VehicleCreate(
            category=VehicleCategory.SEDAN_PREMIUM,
            make="McLaren",
            model="GT",
            year=2024,
            color="Papaya Orange",
            registration_plate="DR-03-VIC",
            passenger_capacity=2,
            luggage_capacity=2
        )
    )
    driver = await DriverService.create_driver(
        db_session,
        DriverCreate(
            full_name="Daniel Ricciardo",
            phone="+61433221100",
            email="daniel@honeybadger.com",
            license_number="LIC-DR-03",
            status=DriverStatus.AVAILABLE,
            default_vehicle_id=vehicle.id
        )
    )

    # 2. Create 2 completed trips assigned to Daniel
    # Trip 1: $120 driver payout
    b1 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Passenger 1",
            customer_email="p1@test.com",
            customer_phone="+61400111222",
            total_fare=220.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Albert Park", dropoff_address="Southbank", pickup_datetime=now)]
        )
    )
    leg1_id = b1.legs[0].id
    await DispatchService.allocate_leg_to_driver(db_session, leg1_id, driver.id, vehicle.id, allocation_cost=120.0)
    await BookingService.update_leg_status(db_session, b1.id, leg1_id, LegStatus.COMPLETED)

    # Trip 2: $180 driver payout
    b2 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Passenger 2",
            customer_email="p2@test.com",
            customer_phone="+61400222333",
            total_fare=320.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Crown Towers", dropoff_address="Yarra Valley", pickup_datetime=now)]
        )
    )
    leg2_id = b2.legs[0].id
    await DispatchService.allocate_leg_to_driver(db_session, leg2_id, driver.id, vehicle.id, allocation_cost=180.0)
    await BookingService.update_leg_status(db_session, b2.id, leg2_id, LegStatus.COMPLETED)

    # 3. Generate Driver RCTI Payout Batch with GST Registration (+10%)
    batch_req = DriverPayoutBatchCreate(
        driver_id=driver.id,
        period_start=now - timedelta(days=7),
        period_end=now + timedelta(days=1),
        gst_registered=True,
        notes="Weekly Chauffeur Payout"
    )
    batch = await AccountingService.generate_driver_payout_batch(
        db_session, batch_req, actor=accountant_user
    )

    assert batch.batch_number.startswith("RCTI-")
    assert batch.total_legs_count == 2
    assert batch.gross_payout_amount == 300.0  # $120 + $180
    assert batch.gst_credit_amount == 30.0  # 10% of $300
    assert batch.net_disbursed_amount == 330.0
    assert "RCTI-LIC-DR-03" in batch.rcti_reference

    # 4. Verify legs marked settled
    reloaded_leg1 = await db_session.get(b1.legs[0].__class__, leg1_id)
    assert reloaded_leg1.settled_at is not None
    assert f"Settled in Batch {batch.batch_number}" in reloaded_leg1.settlement_notes


@pytest.mark.asyncio
async def test_tax_summary_bas_reporting(
    db_session: AsyncSession,
    accountant_user: User
):
    now = datetime.now(timezone.utc)

    # Create Paid Invoice: $1,100 ($1,000 subtotal + $100 GST)
    inv = Invoice(
        invoice_number="INV-2026-9999",
        customer_id="cust-123",
        status=InvoiceStatus.PAID,
        issue_date=now,
        due_date=now,
        subtotal_ex_gst=1000.0,
        gst_amount=100.0,
        total_inc_gst=1100.0,
        amount_paid=1100.0,
        balance_due=0.0
    )
    db_session.add(inv)
    await db_session.commit()

    report = await AccountingService.get_tax_summary_report(
        db_session,
        period_label="2026-Q3",
        date_from=now - timedelta(days=1),
        date_to=now + timedelta(days=1)
    )

    assert report.gross_sales_inc_gst >= 1100.0
    assert report.gst_collected_10pct >= 100.0
    assert report.net_sales_ex_gst >= 1000.0


@pytest.mark.asyncio
async def test_invoice_api_endpoints_and_rbac(
    client: AsyncClient,
    db_session: AsyncSession,
    accountant_user: User,
    driver_user: User
):
    now = datetime.now(timezone.utc)
    acc_headers = auth_header(accountant_user)
    driver_headers = auth_header(driver_user)

    # 1. Create booking to generate invoice
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Corporate Client",
            customer_email="corp@client.com",
            customer_phone="+61400998877",
            total_fare=440.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Melbourne CBD", dropoff_address="St Kilda", pickup_datetime=now)]
        )
    )

    # 2. Staff generate invoice
    gen_resp = await client.post(f"/api/v1/invoices/generate-from-booking/{booking.id}", headers=acc_headers)
    assert gen_resp.status_code == 200
    inv_data = gen_resp.json()
    assert inv_data["total_inc_gst"] == 440.0
    assert inv_data["gst_amount"] == 40.0
    invoice_id = inv_data["id"]

    # 3. List Invoices
    list_resp = await client.get("/api/v1/invoices/", headers=acc_headers)
    assert list_resp.status_code == 200
    assert list_resp.json()["total_count"] >= 1

    # 4. Void Invoice (Accountant only)
    void_resp = await client.post(f"/api/v1/invoices/{invoice_id}/void?reason=Test+Void", headers=acc_headers)
    assert void_resp.status_code == 200
    assert void_resp.json()["status"] == "VOID"

    # 5. RBAC Protection: Driver blocked from generating invoices (403)
    blocked_resp = await client.post(f"/api/v1/invoices/generate-from-booking/{booking.id}", headers=driver_headers)
    assert blocked_resp.status_code == 403
