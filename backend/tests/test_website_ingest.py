"""
Website ingest endpoint: a token-gated public route that turns a website form
submission into a real booking, with idempotency on external_reference.
"""
import pytest
from httpx import AsyncClient

from app.core.config import settings


PAYLOAD = {
    "website": "opalchauffeurs.com.au",
    "external_reference": "WEB-1001",
    "customer_name": "Web Client",
    "customer_email": "webclient@corp.example.com",
    "customer_phone": "+61400555000",
    "pickup_address": "Melbourne CBD",
    "dropoff_address": "Melbourne Airport T2",
    "pickup_datetime": "2026-10-01T09:00:00+00:00",
    "vehicle_category": "SEDAN_PREMIUM",
    "passenger_count": 2,
    "luggage_count": 2,
    "total_fare": 189.0,
    "amount_paid": 189.0,
}


@pytest.mark.asyncio
async def test_ingest_disabled_without_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "")
    r = await client.post("/api/v1/website/booking", json=PAYLOAD)
    assert r.status_code == 503, r.text


@pytest.mark.asyncio
async def test_ingest_rejects_bad_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    r = await client.post("/api/v1/website/booking?token=wrong", json=PAYLOAD)
    assert r.status_code == 401, r.text


@pytest.mark.asyncio
async def test_ingest_creates_and_is_idempotent(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")

    r1 = await client.post(
        "/api/v1/website/booking", json=PAYLOAD, headers={"X-Website-Token": "s3cret"}
    )
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert body1["status"] == "created"
    assert body1["duplicate"] is False
    assert body1["total_fare"] == 189.0
    booking_number = body1["booking_number"]

    # Same external_reference again -> the existing booking, no duplicate.
    r2 = await client.post(
        "/api/v1/website/booking", json=PAYLOAD, headers={"X-Website-Token": "s3cret"}
    )
    assert r2.status_code == 200, r2.text
    body2 = r2.json()
    assert body2["duplicate"] is True
    assert body2["booking_number"] == booking_number


@pytest.mark.asyncio
async def test_quote_request_flagged(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    payload = dict(PAYLOAD, external_reference="WEB-2002", is_quote_request=True)
    r = await client.post(
        "/api/v1/website/booking", json=payload, headers={"X-Website-Token": "s3cret"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "quote"


# ---------------------------------------------------------------- lenient /form (Elementor)

ELEMENTOR_JSON = {
    "form_name": "Get a Quote",
    "fields": {
        "name": {"value": "Jane Doe"},
        "email": {"value": "jane@corp.example.com"},
        "phone": {"value": "+61400111222"},
        "pickuplocations": {"value": "Melbourne CBD"},
        "dropofflocation": {"value": "Avalon Airport"},
        "message": {"value": "Van for 5 people, 3 bags"},
    },
}


# Elementor's real webhook keys fields by their LABEL, and its date picker sends
# a month-name date. This is the exact shape seen from corporatecarsmelbourne.
ELEMENTOR_LABEL_PAYLOAD = {
    "Service": "Wedding Car",
    "Pick-up Location": "Melbourne VIC, Australia",
    "Drop-Off Location": "Melbourne Airport (MEL), Australia",
    "Date": "September 23, 2026",
    "Time": "10:00 pm",
    "Vehicle Type": "Business SUV",
    "First Name": "Sonu",
    "Last Name": "Tripathi",
    "Email": "sonutripathi9305@gmail.com",
    "Phone Number": "919305365420",
    "Special Instructions": "No",
    "form_name": "get a quote form",
}


@pytest.mark.asyncio
async def test_form_endpoint_returns_received_fast(client: AsyncClient, monkeypatch):
    """The endpoint responds 200 immediately and schedules a background task
    (so the website webhook never times out)."""
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    captured = {}

    async def fake_bg(payload, website):
        captured["payload"] = payload
        captured["website"] = website

    import app.api.v1.website_ingest as wi
    monkeypatch.setattr(wi, "_bg_ingest_form", fake_bg)

    r = await client.post(
        "/api/v1/website/form?website=corporatecarsmelbourne.com.au&token=s3cret",
        json=ELEMENTOR_LABEL_PAYLOAD,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "received"
    assert captured["website"] == "corporatecarsmelbourne.com.au"
    assert captured["payload"]["Email"] == "sonutripathi9305@gmail.com"


@pytest.mark.asyncio
async def test_form_rejects_bad_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    r = await client.post("/api/v1/website/form?token=nope", json=ELEMENTOR_JSON)
    assert r.status_code == 401, r.text


# ---- service-level: a form submission becomes an ENQUIRY, never a booking

@pytest.mark.asyncio
async def test_ingest_form_creates_enquiry_not_booking(db_session):
    from sqlalchemy import func, select
    from app.models.booking import Booking
    from app.services.website_ingest_service import WebsiteIngestService

    enq, dup = await WebsiteIngestService.ingest_form(
        db_session, ELEMENTOR_LABEL_PAYLOAD, website="corporatecarsmelbourne.com.au"
    )
    assert dup is False
    assert enq.customer_name == "Sonu Tripathi"
    assert enq.status == "NEW"
    assert enq.website == "corporatecarsmelbourne.com.au"
    assert enq.service_type == "Wedding Car"
    assert enq.vehicle_category == "Business SUV"
    assert enq.pickup_datetime.strftime("%Y-%m-%d %H:%M") == "2026-09-23 22:00"
    assert "Melbourne VIC" in enq.pickup_address
    assert "Melbourne Airport" in enq.dropoff_address

    # It must NOT have created a booking (nothing reaches the Operate Board).
    booking_count = await db_session.scalar(select(func.count()).select_from(Booking))
    assert booking_count == 0

    # Re-ingesting the identical payload is deduped.
    _, dup2 = await WebsiteIngestService.ingest_form(db_session, ELEMENTOR_LABEL_PAYLOAD)
    assert dup2 is True


@pytest.mark.asyncio
async def test_ingest_form_elementor_nested_and_urlencoded(db_session):
    from app.services.website_ingest_service import WebsiteIngestService
    e1, _ = await WebsiteIngestService.ingest_form(db_session, ELEMENTOR_JSON)
    assert "Jane" in e1.customer_name
    assert e1.status == "NEW"

    e2, _ = await WebsiteIngestService.ingest_form(db_session, {
        "your-name": "Bob Smith", "email": "bob@corp.example.com",
        "mobile": "+61400999888", "pickup": "Southbank",
        "destination": "Melbourne Airport", "message": "ASAP",
    })
    assert e2.customer_name == "Bob Smith"
    assert e2.pickup_address == "Southbank"


@pytest.mark.asyncio
async def test_enquiries_api_list_status_delete(client: AsyncClient, admin_user, db_session):
    from tests.conftest import auth_header
    from app.services.website_ingest_service import WebsiteIngestService

    enq, _ = await WebsiteIngestService.ingest_form(
        db_session, ELEMENTOR_LABEL_PAYLOAD, website="corporatecarsmelbourne.com.au"
    )
    h = auth_header(admin_user)

    r = await client.get("/api/v1/enquiries/", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    assert any(e["customer_name"] == "Sonu Tripathi" for e in body["enquiries"])

    r2 = await client.patch(f"/api/v1/enquiries/{enq.id}", headers=h, json={"status": "REVIEWED"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "REVIEWED"

    r3 = await client.delete(f"/api/v1/enquiries/{enq.id}", headers=h)
    assert r3.status_code == 200, r3.text
