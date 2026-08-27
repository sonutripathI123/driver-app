from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import LegStatus, UserRole, VehicleCategory
from app.models.partner import Partner
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingLegCreate
from app.schemas.partner import (
    PartnerCreate,
    PartnerJobOfferCreate,
    PartnerPayoutBatchCreate,
)
from app.services.booking_service import BookingService
from app.services.partner_service import PartnerService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_partner_compliance_check_and_insurance_gate(
    db_session: AsyncSession,
    dispatcher_user: User
):
    now = datetime.now(timezone.utc)

    # 1. Compliant Partner (Valid Insurance)
    p_valid = await PartnerService.create_partner(
        db_session,
        PartnerCreate(
            company_name="Prestige Chauffeur Melbourne",
            contact_name="James Bond",
            email="james@prestige.com.au",
            phone="+61411223344",
            abn="12345678901",
            insurance_policy_number="POL-VIC-9988",
            insurance_expiry=now + timedelta(days=90),
            accreditation_number="ACC-9988",
            accreditation_expiry=now + timedelta(days=120)
        )
    )

    comp_valid = await PartnerService.check_compliance(db_session, p_valid.id)
    assert comp_valid.is_compliant is True
    assert comp_valid.insurance_valid is True

    # 2. Non-Compliant Partner (Expired Insurance)
    p_expired = await PartnerService.create_partner(
        db_session,
        PartnerCreate(
            company_name="Lapsed Limousines",
            contact_name="Arthur Dent",
            email="arthur@lapsed.com.au",
            phone="+61499887766",
            insurance_policy_number="POL-EXP-001",
            insurance_expiry=now - timedelta(days=5)
        )
    )

    comp_expired = await PartnerService.check_compliance(db_session, p_expired.id)
    assert comp_expired.is_compliant is False
    assert comp_expired.insurance_valid is False
    assert any("expired" in r for r in comp_expired.reasons)

    # 3. Create Booking Leg
    b = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Client Test",
            customer_email="test@client.com",
            customer_phone="+61400000000",
            total_fare=350.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Melbourne CBD", dropoff_address="Mornington", pickup_datetime=now + timedelta(days=1))]
        )
    )
    leg_id = b.legs[0].id

    # Attempt to broadcast offer to non-compliant partner -> MUST Fail (400)
    with pytest.raises(Exception) as exc:
        await PartnerService.broadcast_job_offer(
            db_session,
            PartnerJobOfferCreate(
                leg_id=leg_id,
                partner_id=p_expired.id,
                offered_payout=200.0
            ),
            actor=dispatcher_user
        )
    assert "Cannot offload to partner" in str(exc.value)


@pytest.mark.asyncio
async def test_partner_job_offer_acceptance_and_auto_offload(
    db_session: AsyncSession,
    dispatcher_user: User
):
    now = datetime.now(timezone.utc)

    # 1. Compliant Partner
    partner = await PartnerService.create_partner(
        db_session,
        PartnerCreate(
            company_name="Executive Transfers Sydney",
            contact_name="Bruce Wayne",
            email="bruce@wayne-enterprises.com",
            phone="+61400999888",
            insurance_expiry=now + timedelta(days=60)
        )
    )

    # 2. Booking ($400 Total Fare)
    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Corporate VIP",
            customer_email="vip@corp.com",
            customer_phone="+61400111222",
            total_fare=400.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Crown Towers", dropoff_address="Avalon Airport", pickup_datetime=now + timedelta(days=2))]
        )
    )
    leg_id = booking.legs[0].id

    # 3. Broadcast Job Offer for $260.00 (Margin = $140.00)
    offer = await PartnerService.broadcast_job_offer(
        db_session,
        PartnerJobOfferCreate(
            leg_id=leg_id,
            partner_id=partner.id,
            offered_payout=260.0,
            expiry_minutes=15
        ),
        actor=dispatcher_user
    )

    assert offer.status == "PENDING"
    assert offer.offered_payout == 260.0

    # 4. Partner Accepts Offer
    accepted_offer = await PartnerService.accept_job_offer(
        db_session,
        offer.id,
        partner_reference="WAYNE-TRANSFER-77"
    )

    assert accepted_offer.status == "ACCEPTED"
    assert accepted_offer.responded_at is not None

    # 5. Verify Leg Offloaded
    reloaded_leg = await db_session.get(booking.legs[0].__class__, leg_id)
    assert reloaded_leg.partner_id == partner.id
    assert reloaded_leg.partner_payout_amount == 260.0
    assert reloaded_leg.partner_reference == "WAYNE-TRANSFER-77"


@pytest.mark.asyncio
async def test_partner_job_offer_expiration_and_margin_guard(
    db_session: AsyncSession,
    dispatcher_user: User
):
    now = datetime.now(timezone.utc)

    partner = await PartnerService.create_partner(
        db_session,
        PartnerCreate(
            company_name="Affiliate Express",
            contact_name="Clark Kent",
            email="clark@dailyplanet.com",
            phone="+61455555555",
            insurance_expiry=now + timedelta(days=60)
        )
    )

    booking = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Metropolis Guest",
            customer_email="metro@guest.com",
            customer_phone="+61400555444",
            total_fare=200.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="City", dropoff_address="Airport", pickup_datetime=now + timedelta(days=1))]
        )
    )
    leg_id = booking.legs[0].id

    # 1. Negative Margin Guard ($300 offered payout > $200 customer fare)
    with pytest.raises(Exception) as exc:
        await PartnerService.broadcast_job_offer(
            db_session,
            PartnerJobOfferCreate(
                leg_id=leg_id,
                partner_id=partner.id,
                offered_payout=300.0
            ),
            actor=dispatcher_user
        )
    assert "Negative margin guard" in str(exc.value)

    # 2. Expiry test
    valid_offer = await PartnerService.broadcast_job_offer(
        db_session,
        PartnerJobOfferCreate(
            leg_id=leg_id,
            partner_id=partner.id,
            offered_payout=150.0,
            expiry_minutes=15
        ),
        actor=dispatcher_user
    )
    # Manually backdate expiry to test cron
    valid_offer.expires_at = now - timedelta(minutes=5)
    await db_session.commit()

    expired_count = await PartnerService.expire_stale_offers(db_session)
    assert expired_count >= 1

    # Accepting expired offer must raise 400
    with pytest.raises(Exception) as exc_exp:
        await PartnerService.accept_job_offer(db_session, valid_offer.id)
    assert "Offer is no longer active" in str(exc_exp.value) or "expired" in str(exc_exp.value)


@pytest.mark.asyncio
async def test_partner_rcti_settlement_batch_generation(
    db_session: AsyncSession,
    accountant_user: User
):
    now = datetime.now(timezone.utc)

    partner = await PartnerService.create_partner(
        db_session,
        PartnerCreate(
            company_name="Apex Chauffeured Fleet",
            contact_name="Lewis Hamilton",
            email="lewis@apex-fleet.com",
            phone="+61444001122",
            abn="99887766554",
            insurance_expiry=now + timedelta(days=90)
        )
    )

    # Create 2 completed offloaded trips
    b1 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Client 1",
            customer_email="c1@test.com",
            customer_phone="+61400111000",
            total_fare=350.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="Melbourne CBD", dropoff_address="Geelong", pickup_datetime=now)]
        )
    )
    leg1 = b1.legs[0]
    leg1.partner_id = partner.id
    leg1.partner_payout_amount = 250.0
    leg1.status = LegStatus.COMPLETED
    leg1.completed_at = now

    b2 = await BookingService.create_booking(
        db_session,
        BookingCreate(
            customer_name="Client 2",
            customer_email="c2@test.com",
            customer_phone="+61400222000",
            total_fare=450.0,
            legs=[BookingLegCreate(leg_number=1, pickup_address="South Yarra", dropoff_address="Sorrento", pickup_datetime=now)]
        )
    )
    leg2 = b2.legs[0]
    leg2.partner_id = partner.id
    leg2.partner_payout_amount = 300.0
    leg2.status = LegStatus.COMPLETED
    leg2.completed_at = now

    await db_session.commit()

    # Generate Partner RCTI Payout Batch
    batch_req = PartnerPayoutBatchCreate(
        partner_id=partner.id,
        period_start=now - timedelta(days=7),
        period_end=now + timedelta(days=1),
        notes="Affiliate monthly payout"
    )
    batch = await PartnerService.generate_partner_payout_batch(
        db_session, batch_req, actor=accountant_user
    )

    assert batch.batch_number.startswith("PARTNER-RCTI-")
    assert batch.total_legs_count == 2
    assert batch.gross_payout_amount == 550.0  # $250 + $300
    assert batch.gst_amount == 55.0  # 10% GST on subcontract invoice
    assert batch.net_disbursed_amount == 605.0
    assert "99887766554" in batch.rcti_reference

    # Verify legs marked settled
    reloaded_leg1 = await db_session.get(b1.legs[0].__class__, leg1.id)
    assert reloaded_leg1.settled_at is not None
    assert f"Settled in Partner Batch {batch.batch_number}" in reloaded_leg1.settlement_notes


@pytest.mark.asyncio
async def test_partner_api_endpoints_and_rbac(
    client: AsyncClient,
    db_session: AsyncSession,
    ops_user: User,
    dispatcher_user: User,
    driver_user: User
):
    now = datetime.now(timezone.utc)
    ops_headers = auth_header(ops_user)
    disp_headers = auth_header(dispatcher_user)
    driver_headers = auth_header(driver_user)

    # 1. Create Partner (Ops / Admin only)
    create_payload = {
        "company_name": "Skyline Chauffeurs",
        "contact_name": "Rachel Zane",
        "email": "rachel@skyline.com.au",
        "phone": "+61411998877",
        "abn": "55443322110",
        "commission_rate": 12.5,
        "insurance_policy_number": "POL-SKY-01",
        "insurance_expiry": (now + timedelta(days=60)).isoformat()
    }
    p_resp = await client.post("/api/v1/partners/", json=create_payload, headers=ops_headers)
    assert p_resp.status_code == 201
    partner_id = p_resp.json()["id"]

    # 2. Compliance Check endpoint
    comp_resp = await client.get(f"/api/v1/partners/{partner_id}/compliance-check", headers=disp_headers)
    assert comp_resp.status_code == 200
    assert comp_resp.json()["is_compliant"] is True

    # 3. RBAC: Driver blocked from creating partners (403)
    blocked_resp = await client.post("/api/v1/partners/", json=create_payload, headers=driver_headers)
    assert blocked_resp.status_code == 403
