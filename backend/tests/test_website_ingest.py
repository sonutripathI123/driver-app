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


@pytest.mark.asyncio
async def test_form_elementor_json_creates_quote(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    r = await client.post(
        "/api/v1/website/form?website=corporatecarsmelbourne.com.au&token=s3cret",
        json=ELEMENTOR_JSON,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "quote"
    assert body["total_fare"] == 0.0
    # Same payload again -> deduped.
    r2 = await client.post(
        "/api/v1/website/form?token=s3cret", json=ELEMENTOR_JSON
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["duplicate"] is True


@pytest.mark.asyncio
async def test_form_urlencoded_creates_quote(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    r = await client.post(
        "/api/v1/website/form?token=s3cret",
        data={
            "your-name": "Bob Smith",
            "email": "bob@corp.example.com",
            "mobile": "+61400999888",
            "pickup": "Southbank",
            "destination": "Melbourne Airport",
            "message": "ASAP",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "quote"


@pytest.mark.asyncio
async def test_form_rejects_bad_token(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    r = await client.post("/api/v1/website/form?token=nope", json=ELEMENTOR_JSON)
    assert r.status_code == 401, r.text


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
async def test_form_label_keys_map_name_date_time(client: AsyncClient, admin_user, monkeypatch):
    from tests.conftest import auth_header
    monkeypatch.setattr(settings, "WEBSITE_INGEST_TOKEN", "s3cret")
    r = await client.post("/api/v1/website/form?token=s3cret", json=ELEMENTOR_LABEL_PAYLOAD)
    assert r.status_code == 200, r.text
    num = r.json()["booking_number"]

    # Pull it back and check the pickup datetime + full name mapped correctly.
    lst = await client.get("/api/v1/bookings/", headers=auth_header(admin_user))
    assert lst.status_code == 200, lst.text
    bk = next(b for b in lst.json()["bookings"] if b["booking_number"] == num)
    assert bk["passenger_name"] == "Sonu Tripathi"
    leg = bk["legs"][0]
    assert leg["pickup_datetime"].startswith("2026-09-23T22:00"), leg["pickup_datetime"]
    assert "Melbourne VIC" in leg["pickup_address"]
