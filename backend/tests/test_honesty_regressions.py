"""
Regression cover for a class of bug this platform was full of: reporting
something that had not happened.

Each test here pins one place where the code used to invent data, claim a
delivery it had not made, or leave an endpoint open while its docstring said
otherwise. They are grouped in one file because they share a cause rather
than a feature area.
"""
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.models.user import User
from tests.conftest import auth_header


# --- endpoints whose docstrings promised auth they did not have -------

@pytest.mark.parametrize(
    "method,path",
    [
        # Spends a request from the metered flight-data plan on every call.
        ("GET", "/api/v1/flights/lookup?flight_number=EK406"),
        # Returned the manager's mobile, email and any Telegram bot token.
        ("GET", "/api/v1/notifications/manager-settings"),
        # Takes an arbitrary target_phone and sends SMS/WhatsApp on the
        # business's account.
        ("POST", "/api/v1/notifications/test-mobile-ping"),
        # Anyone who registered here started receiving dispatch alerts.
        ("POST", "/api/v1/notifications/webpush-subscription"),
    ],
)
@pytest.mark.asyncio
async def test_sensitive_endpoints_reject_anonymous_callers(
    client: AsyncClient, method: str, path: str
):
    resp = await (client.get(path) if method == "GET" else client.post(path, json={}))
    assert resp.status_code == 401, f"{method} {path} answered {resp.status_code} without a token"


@pytest.mark.asyncio
async def test_manager_settings_still_readable_by_staff(client: AsyncClient, ops_user: User):
    resp = await client.get("/api/v1/notifications/manager-settings", headers=auth_header(ops_user))
    assert resp.status_code == 200
    assert "manager_phone" in resp.json()


# --- the flight provider must refuse rather than invent ---------------

@pytest.mark.asyncio
async def test_flight_lookup_refuses_when_no_provider_configured(
    client: AsyncClient, dispatcher_user: User
):
    """
    A hardcoded timetable used to answer here and was presented to operators
    as live tracking. With no provider configured the API must say so.
    """
    resp = await client.get(
        "/api/v1/flights/lookup?flight_number=EK406", headers=auth_header(dispatcher_user)
    )
    assert resp.status_code == 503
    assert "AERODATABOX_API_KEY" in resp.json()["detail"]


# --- the tax invoice must identify its buyer --------------------------

@pytest.mark.asyncio
async def test_tax_invoice_carries_buyer_and_journey(client: AsyncClient, admin_user: User):
    """
    InvoiceRead exposed no buyer, so the document fell back to rendering
    "Private VIP Client" — which fails the ATO requirement to identify the
    recipient above $1,000, and is useless to the client's accounts payable.
    """
    h = auth_header(admin_user)

    veh = await client.post("/api/v1/vehicles/", headers=h, json={
        "category": "PEOPLE_MOVER", "make": "Mercedes-Benz", "model": "V-Class",
        "year": 2024, "registration_plate": "INV-TEST-1",
        "passenger_capacity": 7, "luggage_capacity": 6,
    })
    assert veh.status_code == 201
    vehicle_id = veh.json()["id"]

    drv = await client.post("/api/v1/drivers/", headers=h, json={
        "full_name": "Invoice Test Chauffeur", "phone": "+61400555666",
        "email": "invoice.driver@corp.example.com", "license_number": "INV-LIC-1",
        "default_vehicle_id": vehicle_id, "create_user_account": False,
    })
    assert drv.status_code == 201
    driver_id = drv.json()["id"]

    bk = await client.post("/api/v1/bookings/", headers=h, json={
        "customer_name": "Buyer Holdings Pty Ltd",
        "customer_email": "ap@buyerholdings.example.com",
        "customer_phone": "+61411777888",
        "passenger_name": "Named Passenger",
        "total_fare": 640.0,
        "legs": [{
            "leg_number": 1,
            "pickup_address": "Melbourne Airport Terminal 2",
            "dropoff_address": "Crown Towers, Southbank",
            "pickup_datetime": "2026-11-20T10:30:00Z",
            "is_airport_pickup": True,
            "flight_number": "EK408",
            "vehicle_category": "PEOPLE_MOVER",
        }],
    })
    assert bk.status_code == 201
    booking = bk.json()
    leg_id = booking["legs"][0]["id"]

    alloc = await client.post(
        f"/api/v1/dispatch/legs/{leg_id}/allocate", headers=h,
        json={"driver_id": driver_id, "vehicle_id": vehicle_id, "allocation_cost": 180.0},
    )
    assert alloc.status_code == 200

    gen = await client.post(
        f"/api/v1/invoices/generate-from-booking/{booking['id']}", headers=h
    )
    assert gen.status_code == 200
    invoice_id = gen.json()["id"]

    inv = (await client.get(f"/api/v1/invoices/{invoice_id}", headers=h)).json()

    assert inv["customer_name"] == "Buyer Holdings Pty Ltd"
    assert inv["customer_email"] == "ap@buyerholdings.example.com"
    assert inv["customer_phone"] == "+61411777888"
    assert inv["booking_number"] == booking["booking_number"]
    assert inv["passenger_name"] == "Named Passenger"
    assert "Crown Towers" in inv["route_summary"]
    assert inv["journey_datetime"] is not None
    assert inv["driver_name"] == "Invoice Test Chauffeur"
    assert inv["vehicle_plate"] == "INV-TEST-1"
    assert inv["flight_number"] == "EK408"

    # GST is one eleventh of the gross, not ten percent of it.
    assert abs(inv["gst_amount"] - 640.0 / 11) < 0.01

    # The list view fed the invoice table and had the same gap.
    listing = (await client.get("/api/v1/invoices/", headers=h)).json()
    rows = listing if isinstance(listing, list) else listing["invoices"]
    assert rows and rows[0]["customer_name"] == "Buyer Holdings Pty Ltd"

    # BAS is cash basis: nothing is declared until the money arrives.
    bas = (await client.get(
        "/api/v1/accounting/tax-summary", headers=h,
        params={"date_from": "2026-01-01", "date_to": "2026-12-31"},
    )).json()
    assert abs(bas["gross_sales_inc_gst"]) < 0.01
    assert "cash basis" in bas["period_label"].lower()


# --- a message that was not sent must not be recorded as sent ---------

@pytest.mark.asyncio
async def test_unconfigured_sms_is_recorded_as_simulated_with_a_reason(
    client: AsyncClient, admin_user: User
):
    """
    The SMS gateway used to return success unconditionally, so the outbox
    showed delivered messages nobody received.
    """
    h = auth_header(admin_user)
    resp = await client.post("/api/v1/notifications/test-mobile-ping", headers=h, json={
        "channel": "SMS", "target_phone": "+61400000000", "custom_message": "regression probe",
    })
    assert resp.status_code == 200
    notif = resp.json()
    assert notif["status"] == "SANDBOX_SIMULATED"
    assert notif["error_message"], "a message that was not sent must record why"


# --- the inbound mailbox ----------------------------------------------

@pytest.mark.asyncio
async def test_inbound_webhook_is_off_until_a_token_is_configured(client: AsyncClient):
    original = settings.INBOUND_EMAIL_TOKEN
    settings.INBOUND_EMAIL_TOKEN = ""
    try:
        resp = await client.post("/api/v1/notifications/inbound/webhook",
                                 json={"From": "a@corp.example.com", "text": "hi"})
        assert resp.status_code == 503
    finally:
        settings.INBOUND_EMAIL_TOKEN = original


@pytest.mark.asyncio
async def test_inbound_webhook_requires_the_right_token(client: AsyncClient):
    original = settings.INBOUND_EMAIL_TOKEN
    settings.INBOUND_EMAIL_TOKEN = "regression-token"
    try:
        bad = await client.post(
            "/api/v1/notifications/inbound/webhook",
            headers={"X-Inbound-Token": "not-it"},
            json={"From": "a@corp.example.com", "text": "hi"},
        )
        assert bad.status_code == 401
    finally:
        settings.INBOUND_EMAIL_TOKEN = original


@pytest.mark.asyncio
async def test_inbound_reply_is_stored_deduplicated_and_linked_to_its_booking(
    client: AsyncClient, admin_user: User
):
    h = auth_header(admin_user)
    original = settings.INBOUND_EMAIL_TOKEN
    settings.INBOUND_EMAIL_TOKEN = "regression-token"
    try:
        bk = await client.post("/api/v1/bookings/", headers=h, json={
            "customer_name": "Inbox Buyer", "customer_email": "inbox@corp.example.com",
            "customer_phone": "+61411222333", "total_fare": 300.0,
            "legs": [{
                "leg_number": 1,
                "pickup_address": "Melbourne Airport T2",
                "dropoff_address": "Grand Hyatt Melbourne",
                "pickup_datetime": "2026-11-21T09:00:00Z",
            }],
        })
        assert bk.status_code == 201
        booking_number = bk.json()["booking_number"]

        payload = {"items": [{
            "Uuid": "regression-msg-1",
            "From": {"Address": "Client@Corp.Example.com", "Name": "A Client"},
            "To": [{"Address": settings.OPS_EMAIL}],
            "Subject": f"Re: transfer {booking_number}",
            "RawHtmlBody": "<p>Please add a&nbsp;booster seat.</p>",
        }]}
        headers = {"X-Inbound-Token": "regression-token"}

        first = await client.post("/api/v1/notifications/inbound/webhook",
                                  headers=headers, json=payload)
        assert first.status_code == 200
        assert first.json() == {"received": 1, "stored": 1, "duplicates": 0, "rejected": 0}

        # A provider retry must not duplicate the customer's reply.
        again = await client.post("/api/v1/notifications/inbound/webhook",
                                  headers=headers, json=payload)
        assert again.json()["duplicates"] == 1
        assert again.json()["stored"] == 0

        threads = (await client.get("/api/v1/notifications/inbound", headers=h)).json()
        assert len(threads) == 1
        thread = threads[0]
        assert thread["sender_email"] == "client@corp.example.com"
        assert thread["booking_number"] == booking_number
        assert thread["status"] == "UNREAD"
        # Entities decoded, so the reply is readable rather than "a&nbsp;booster".
        assert thread["body_text"] == "Please add a booster seat."

        patched = await client.patch(
            f"/api/v1/notifications/inbound/{thread['id']}", headers=h, json={"status": "READ"}
        )
        assert patched.status_code == 200
        assert patched.json()["status"] == "READ"

        status = (await client.get("/api/v1/notifications/inbound/status", headers=h)).json()
        assert status["configured"] is True
        assert status["unread_count"] == 0
    finally:
        settings.INBOUND_EMAIL_TOKEN = original


@pytest.mark.asyncio
async def test_inbound_payload_with_no_usable_sender_is_rejected(client: AsyncClient):
    """A 400 puts the misconfiguration in the provider's own webhook log."""
    original = settings.INBOUND_EMAIL_TOKEN
    settings.INBOUND_EMAIL_TOKEN = "regression-token"
    try:
        resp = await client.post(
            "/api/v1/notifications/inbound/webhook",
            headers={"X-Inbound-Token": "regression-token"},
            json={"items": [{"Subject": "no sender here"}]},
        )
        assert resp.status_code == 400
    finally:
        settings.INBOUND_EMAIL_TOKEN = original


# --- fleet records must not be invented -------------------------------

@pytest.mark.asyncio
async def test_vehicle_category_the_ui_used_to_offer_is_rejected(
    client: AsyncClient, admin_user: User
):
    """The Add Vehicle form offered FIRST_CLASS, which is not in the enum."""
    resp = await client.post("/api/v1/vehicles/", headers=auth_header(admin_user), json={
        "category": "FIRST_CLASS", "make": "Mercedes-Benz", "model": "S-Class",
        "year": 2024, "registration_plate": "BADCAT1",
        "passenger_capacity": 4, "luggage_capacity": 2,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_licence_number_is_refused_with_a_reason(
    client: AsyncClient, admin_user: User
):
    """
    The Add Driver form filled a blank licence field with "VIC-DA-88", so a
    second driver onboarded that way collided with the first.
    """
    h = auth_header(admin_user)
    body = {
        "full_name": "First Chauffeur", "phone": "+61400111000",
        "email": "first.chauffeur@corp.example.com", "license_number": "SHARED-LIC",
        "create_user_account": False,
    }
    assert (await client.post("/api/v1/drivers/", headers=h, json=body)).status_code == 201

    body.update({
        "full_name": "Second Chauffeur", "phone": "+61400111001",
        "email": "second.chauffeur@corp.example.com",
    })
    clash = await client.post("/api/v1/drivers/", headers=h, json=body)
    assert clash.status_code == 400
    assert "already exists" in clash.json()["detail"]


@pytest.mark.asyncio
async def test_lapsed_insurance_fails_the_partner_compliance_gate(
    client: AsyncClient, admin_user: User
):
    """
    Partner cards used to read a single is_compliance_verified flag, so an
    operator could offload a job to a partner whose cover had expired.
    """
    h = auth_header(admin_user)
    created = await client.post("/api/v1/partners/", headers=h, json={
        "company_name": "Lapsed Cover Co", "contact_name": "Pat Partner",
        "email": "ops@lapsed.example.com", "phone": "+61399990000",
        "commission_rate": 15.0, "city": "Sydney",
        "insurance_expiry": "2020-01-01T00:00:00Z",
        "is_compliance_verified": True,
    })
    assert created.status_code == 201

    check = await client.get(
        f"/api/v1/partners/{created.json()['id']}/compliance-check", headers=h
    )
    assert check.status_code == 200
    assert check.json()["is_compliant"] is False
    assert check.json()["reasons"]
