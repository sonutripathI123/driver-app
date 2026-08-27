import json
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import BookingSource, BookingStatus, PaymentStatus, UserRole, VehicleCategory
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.payment import CreateCheckoutSessionRequest, ManualPaymentCreate, RefundRequest
from app.services.booking_service import BookingService
from app.services.payment_service import PaymentService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_create_checkout_session_deposit_and_full(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Bruce Wayne",
        customer_email="bruce@wayne-enterprises.com",
        customer_phone="+61400111222",
        source=BookingSource.WEBSITE,
        total_fare=500.0,
        deposit_percentage=20.0,  # $100 deposit
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="100 Gotham St",
                dropoff_address="200 Gotham St",
                pickup_datetime=now + timedelta(days=10),
                vehicle_category=VehicleCategory.SEDAN_EXECUTIVE
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)
    assert booking.deposit_required == 100.0

    # 1. Create Deposit Checkout Session ($100)
    dep_session = await PaymentService.create_checkout_session(
        db_session,
        CreateCheckoutSessionRequest(
            booking_id=booking.id,
            payment_type="DEPOSIT"
        )
    )
    assert dep_session.amount == 100.0
    assert dep_session.payment_type == "DEPOSIT"
    assert "checkout.stripe.com" in dep_session.checkout_url

    # 2. Create Full Payment Checkout Session ($500)
    full_session = await PaymentService.create_checkout_session(
        db_session,
        CreateCheckoutSessionRequest(
            booking_id=booking.id,
            payment_type="FULL"
        )
    )
    assert full_session.amount == 500.0
    assert full_session.payment_type == "FULL"


@pytest.mark.asyncio
async def test_stripe_webhook_reconciliation_and_idempotency(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Tony Stark",
        customer_email="tony@starkindustries.com",
        customer_phone="+61433998877",
        total_fare=600.0,
        deposit_percentage=20.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="Stark Tower",
                dropoff_address="Malibu Mansion",
                pickup_datetime=now + timedelta(days=12)
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)

    # 1. Create checkout session for 20% deposit ($120)
    dep_session = await PaymentService.create_checkout_session(
        db_session,
        CreateCheckoutSessionRequest(
            booking_id=booking.id,
            payment_type="DEPOSIT"
        )
    )

    # 2. Simulate Stripe Webhook payload for checkout.session.completed
    webhook_payload = {
        "id": "evt_test_webhook_123",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": dep_session.session_id,
                "payment_intent": "pi_test_tony_123",
                "amount_total": 12000,  # $120.00 in cents
                "currency": "aud",
                "metadata": {
                    "booking_id": booking.id,
                    "booking_number": booking.booking_number,
                    "payment_type": "DEPOSIT"
                }
            }
        }
    }
    raw_body = json.dumps(webhook_payload).encode("utf-8")

    # 3. Process Webhook
    res = await PaymentService.handle_webhook_event(db_session, raw_body, sig_header=None)
    assert res["status"] == "success"

    # Verify Master Booking updated
    reloaded = await BookingService.get_booking_by_id(db_session, booking.id)
    assert reloaded.paid_amount == 120.0
    assert reloaded.balance_amount == 480.0
    assert reloaded.payment_status == PaymentStatus.PARTIAL_DEPOSIT
    assert reloaded.status == BookingStatus.CONFIRMED  # Automatically confirmed upon deposit!

    # 4. IDEMPOTENCY CHECK: Resend same webhook event
    res_dup = await PaymentService.handle_webhook_event(db_session, raw_body, sig_header=None)
    assert res_dup["status"] == "already_processed"

    # Booking must NOT be credited twice!
    reloaded_dup = await BookingService.get_booking_by_id(db_session, booking.id)
    assert reloaded_dup.paid_amount == 120.0  # Still $120, not $240!


@pytest.mark.asyncio
async def test_balance_settlement_and_full_payment(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Peter Parker",
        customer_email="peter@dailybugle.com",
        customer_phone="+61422113344",
        total_fare=300.0,
        deposit_percentage=20.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="Queens, NY",
                dropoff_address="JFK Airport",
                pickup_datetime=now + timedelta(days=5)
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)

    # 1. Pay $60 deposit (20%)
    dep_session = await PaymentService.create_checkout_session(
        db_session,
        CreateCheckoutSessionRequest(booking_id=booking.id, payment_type="DEPOSIT")
    )
    payload_dep = {
        "id": "evt_dep",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": dep_session.session_id,
                "amount_total": 6000,
                "currency": "aud",
                "metadata": {"booking_id": booking.id, "payment_type": "DEPOSIT"}
            }
        }
    }
    await PaymentService.handle_webhook_event(db_session, json.dumps(payload_dep).encode(), None)

    # 2. Pay remaining $240 balance
    bal_session = await PaymentService.create_checkout_session(
        db_session,
        CreateCheckoutSessionRequest(booking_id=booking.id, payment_type="BALANCE")
    )
    assert bal_session.amount == 240.0

    payload_bal = {
        "id": "evt_bal",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": bal_session.session_id,
                "amount_total": 24000,
                "currency": "aud",
                "metadata": {"booking_id": booking.id, "payment_type": "BALANCE"}
            }
        }
    }
    await PaymentService.handle_webhook_event(db_session, json.dumps(payload_bal).encode(), None)

    # Verify booking fully paid
    reloaded = await BookingService.get_booking_by_id(db_session, booking.id)
    assert reloaded.paid_amount == 300.0
    assert reloaded.balance_amount == 0.0
    assert reloaded.payment_status == PaymentStatus.PAID_IN_FULL


@pytest.mark.asyncio
async def test_manual_payment_and_refund_flow(
    db_session: AsyncSession,
    accountant_user: User
):
    now = datetime.now(timezone.utc)
    b_in = BookingCreate(
        customer_name="Steve Rogers",
        customer_email="steve@avengers.org",
        customer_phone="+61477889900",
        total_fare=400.0,
        legs=[
            BookingLegCreate(
                leg_number=1,
                pickup_address="Brooklyn, NY",
                dropoff_address="Manhattan, NY",
                pickup_datetime=now + timedelta(days=3)
            )
        ]
    )
    booking = await BookingService.create_booking(db_session, b_in)

    # 1. Staff records manual bank transfer of $400
    tx = await PaymentService.record_manual_payment(
        db_session,
        ManualPaymentCreate(
            booking_id=booking.id,
            amount=400.0,
            payment_method="BANK_TRANSFER",
            reference_number="EFT-883921",
            notes="Direct deposit confirmed by accountant"
        ),
        actor=accountant_user
    )
    assert tx.amount == 400.0
    assert tx.status == "COMPLETED"

    b_paid = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b_paid.paid_amount == 400.0
    assert b_paid.payment_status == PaymentStatus.PAID_IN_FULL

    # 2. Process partial refund of $150
    refund1 = await PaymentService.process_refund(
        db_session,
        booking.id,
        RefundRequest(amount=150.0, reason="Customer reduced vehicle duration"),
        actor=accountant_user
    )
    assert refund1.amount == -150.0

    b_ref1 = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b_ref1.paid_amount == 250.0
    assert b_ref1.balance_amount == 150.0
    assert b_ref1.payment_status == PaymentStatus.PARTIALLY_REFUNDED

    # 3. Process remaining full refund of $250
    refund2 = await PaymentService.process_refund(
        db_session,
        booking.id,
        RefundRequest(amount=250.0, reason="Customer cancelled remainder of journey"),
        actor=accountant_user
    )
    assert refund2.amount == -250.0

    b_ref2 = await BookingService.get_booking_by_id(db_session, booking.id)
    assert b_ref2.paid_amount == 0.0
    assert b_ref2.payment_status == PaymentStatus.REFUNDED



@pytest.mark.asyncio
async def test_payments_api_endpoints_and_rbac(
    client: AsyncClient,
    accountant_user: User,
    ops_user: User,
    customer_user: User
):
    acc_headers = auth_header(accountant_user)
    ops_headers = auth_header(ops_user)
    cust_headers = auth_header(customer_user)

    now = datetime.now(timezone.utc)
    # 1. Create booking
    b_payload = {
        "customer_name": "Natasha Romanoff",
        "customer_email": "natasha@shield.gov",
        "customer_phone": "+61411223388",
        "source": "WEBSITE",
        "total_fare": 350.0,
        "deposit_percentage": 20.0,
        "legs": [
            {
                "leg_number": 1,
                "pickup_address": "Melbourne CBD",
                "dropoff_address": "Tullamarine Airport",
                "pickup_datetime": (now + timedelta(days=4)).isoformat()
            }
        ]
    }
    b_resp = await client.post("/api/v1/bookings/", json=b_payload)
    assert b_resp.status_code == 201
    booking_id = b_resp.json()["id"]

    # 2. Public / App generates checkout session
    cs_resp = await client.post(
        "/api/v1/payments/checkout-session",
        json={"booking_id": booking_id, "payment_type": "DEPOSIT"}
    )
    assert cs_resp.status_code == 200
    assert cs_resp.json()["amount"] == 70.0  # 20% of 350

    # 3. Ops records manual payment
    man_resp = await client.post(
        "/api/v1/payments/manual",
        json={"booking_id": booking_id, "amount": 350.0, "payment_method": "CASH"},
        headers=ops_headers
    )
    assert man_resp.status_code == 201

    # 4. Customer CANNOT record manual payment (403 Forbidden)
    assert (await client.post(
        "/api/v1/payments/manual",
        json={"booking_id": booking_id, "amount": 50.0, "payment_method": "CASH"},
        headers=cust_headers
    )).status_code == 403

    # 5. Get payment ledger summary
    summary_resp = await client.get(f"/api/v1/payments/bookings/{booking_id}", headers=ops_headers)
    assert summary_resp.status_code == 200
    assert summary_resp.json()["paid_amount"] == 350.0
    assert len(summary_resp.json()["transactions"]) >= 2  # 1 pending checkout + 1 manual cash
