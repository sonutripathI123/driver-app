from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import BookingStatus, VehicleCategory
from app.models.user import User
from app.schemas.pricing import QuoteAcceptRequest, QuoteRequest
from app.services.pricing_service import PricingEngine
from app.services.quote_service import QuoteService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_airport_to_city_all_inclusive_rule(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    quote_in = QuoteRequest(
        pickup_address="Melbourne Airport (MEL), Terminal 2",
        dropoff_address="Collins St, Melbourne CBD VIC 3000",
        pickup_datetime=now + timedelta(days=10)
    )

    quote = await QuoteService.create_quote(db_session, quote_in)

    assert quote.is_all_inclusive is True
    assert len(quote.options) == 5

    # Check Sedan Premium All-Inclusive breakdown
    sedan_opt = next(o for o in quote.options if o.vehicle_category == VehicleCategory.SEDAN_PREMIUM)
    assert sedan_opt.total_fare == 130.0
    assert sedan_opt.pricing_breakdown["fare_type"] == "AIRPORT_ALL_INCLUSIVE"
    assert sedan_opt.pricing_breakdown["tolls_included"] is True
    assert sedan_opt.pricing_breakdown["tolls_added_separately"] == 0.0  # NOT double charged!

    # Check SUV All-Inclusive breakdown
    suv_opt = next(o for o in quote.options if o.vehicle_category == VehicleCategory.SUV_PREMIUM)
    assert suv_opt.total_fare == 160.0
    assert suv_opt.pricing_breakdown["tolls_included"] is True


@pytest.mark.asyncio
async def test_banded_pricing_and_deadhead(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    # Regional trip ~ 75km
    quote_in = QuoteRequest(
        pickup_address="100 Collins St, Melbourne CBD",
        dropoff_address="Regional Town Geelong VIC",
        pickup_datetime=now + timedelta(days=14)
    )

    quote = await QuoteService.create_quote(db_session, quote_in)
    sedan_opt = next(o for o in quote.options if o.vehicle_category == VehicleCategory.SEDAN_PREMIUM)

    # 75km trip has deadhead charge for (75 - 50) = 25km @ $2.00/km = $50.00
    assert sedan_opt.pricing_breakdown["deadhead_km"] == 25.0
    assert sedan_opt.pricing_breakdown["deadhead_cost"] == 50.0
    assert sedan_opt.pricing_breakdown["tier1_km"] == 25.0
    assert sedan_opt.pricing_breakdown["tier2_km"] == 50.0
    assert sedan_opt.total_fare > 250.0


@pytest.mark.asyncio
async def test_late_night_surcharge(db_session: AsyncSession):
    # Daytime pickup at 14:00
    dt_day = datetime(2026, 9, 15, 14, 0, tzinfo=timezone.utc)
    quote_day = await QuoteService.create_quote(
        db_session,
        QuoteRequest(
            pickup_address="100 Collins St, Melbourne",
            dropoff_address="500 Chapel St, South Yarra",
            pickup_datetime=dt_day
        )
    )
    opt_day = next(o for o in quote_day.options if o.vehicle_category == VehicleCategory.SEDAN_PREMIUM)

    # Late Night pickup at 23:45
    dt_night = datetime(2026, 9, 15, 23, 45, tzinfo=timezone.utc)
    quote_night = await QuoteService.create_quote(
        db_session,
        QuoteRequest(
            pickup_address="100 Collins St, Melbourne",
            dropoff_address="500 Chapel St, South Yarra",
            pickup_datetime=dt_night
        )
    )
    opt_night = next(o for o in quote_night.options if o.vehicle_category == VehicleCategory.SEDAN_PREMIUM)

    assert opt_night.total_fare > opt_day.total_fare
    assert opt_night.pricing_breakdown["surcharge_amount"] > 0
    assert "Late Night" in opt_night.pricing_breakdown["surcharge_label"]


@pytest.mark.asyncio
async def test_instant_booking_eligibility_and_verification_gate(db_session: AsyncSession):
    now = datetime.now(timezone.utc)

    # 1. Standard Sedan with pickup in 5 days -> INSTANT_BOOKING, no verification
    q1 = await QuoteService.create_quote(
        db_session,
        QuoteRequest(
            pickup_address="Collins St, Melbourne",
            dropoff_address="Toorak Rd, Toorak",
            pickup_datetime=now + timedelta(days=5)
        )
    )
    opt_sedan = next(o for o in q1.options if o.vehicle_category == VehicleCategory.SEDAN_PREMIUM)
    assert opt_sedan.eligibility == "INSTANT_BOOKING"
    assert opt_sedan.requires_verification is False

    # 2. Minibus -> Always ENQUIRY_REQUIRED
    opt_minibus = next(o for o in q1.options if o.vehicle_category == VehicleCategory.MINIBUS)
    assert opt_minibus.eligibility == "ENQUIRY_REQUIRED"

    # 3. Short notice (< 12 hours) -> requires_verification is True
    q_short = await QuoteService.create_quote(
        db_session,
        QuoteRequest(
            pickup_address="Collins St, Melbourne",
            dropoff_address="Toorak Rd, Toorak",
            pickup_datetime=now + timedelta(hours=6)
        )
    )
    opt_short = next(o for o in q_short.options if o.vehicle_category == VehicleCategory.SEDAN_PREMIUM)
    assert opt_short.requires_verification is True


@pytest.mark.asyncio
async def test_quote_acceptance_converts_to_master_booking(db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    quote = await QuoteService.create_quote(
        db_session,
        QuoteRequest(
            pickup_address="Grand Hyatt Melbourne",
            dropoff_address="Melbourne Airport (MEL)",
            pickup_datetime=now + timedelta(days=10)
        )
    )

    accept_in = QuoteAcceptRequest(
        vehicle_category=VehicleCategory.SEDAN_EXECUTIVE,
        customer_name="Elon Musk",
        customer_email="elon@spacex.corp",
        customer_phone="+61499112233",
        company_name="SpaceX",
        special_instructions="Flight leaves at 2PM, require luggage assistance."
    )

    booking = await QuoteService.accept_quote(db_session, quote.quote_id, accept_in)

    assert booking.id is not None
    assert booking.booking_number.startswith("CCM-")
    assert booking.total_fare == 165.0  # Executive Airport All-Inclusive
    assert booking.status == BookingStatus.QUOTED
    assert booking.customer.full_name == "Elon Musk"
    assert len(booking.legs) == 1
    assert booking.legs[0].allocation_cost > 0.0


@pytest.mark.asyncio
async def test_quote_api_flow(client: AsyncClient):
    now = datetime.now(timezone.utc)
    payload = {
        "pickup_address": "Crown Towers Melbourne",
        "dropoff_address": "Melbourne Airport (MEL)",
        "pickup_datetime": (now + timedelta(days=8)).isoformat(),
        "passenger_count": 2,
        "luggage_count": 2
    }

    # 1. Generate Quote
    resp = await client.post("/api/v1/quotes/instant", json=payload)
    assert resp.status_code == 200
    q_data = resp.json()
    q_id = q_data["quote_id"]
    assert len(q_data["options"]) == 5

    # 2. Get Quote Details
    get_resp = await client.get(f"/api/v1/quotes/{q_id}")
    assert get_resp.status_code == 200

    # 3. Accept Quote
    accept_payload = {
        "vehicle_category": "SEDAN_PREMIUM",
        "customer_name": "Satya Nadella",
        "customer_email": "satya@microsoft.corp",
        "customer_phone": "+61488112233",
        "company_name": "Microsoft"
    }
    accept_resp = await client.post(f"/api/v1/quotes/{q_id}/accept", json=accept_payload)
    assert accept_resp.status_code == 201
    created_booking = accept_resp.json()
    assert created_booking["booking_number"].startswith("CCM-")
    assert created_booking["total_fare"] == 130.0
