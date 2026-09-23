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
