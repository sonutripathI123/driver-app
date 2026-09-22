"""
Customer self-service portal: first-booking set-password link activates a login
(role CUSTOMER), after which the customer signs in and sees only their own data.
"""
import pytest
from httpx import AsyncClient

from app.core.security import create_customer_setup_token
from app.models.customer import Customer


@pytest.mark.asyncio
async def test_set_password_then_login_and_see_own_profile(client: AsyncClient, db_session):
    cust = Customer(full_name="Jane Client", email="jane.client@corp.example.com", phone="+61400111000")
    db_session.add(cust)
    await db_session.commit()
    await db_session.refresh(cust)

    token = create_customer_setup_token(cust.id)
    r = await client.post("/api/v1/customer-portal/set-password", json={"token": token, "password": "CustomerPw1!"})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "jane.client@corp.example.com"

    login = await client.post("/api/v1/auth/login", json={
        "email": "jane.client@corp.example.com", "password": "CustomerPw1!",
    })
    assert login.status_code == 200, login.text
    assert login.json()["user"]["role"] == "CUSTOMER"
    tok = login.json()["access_token"]

    me = await client.get("/api/v1/customer-portal/me", headers={"Authorization": f"Bearer {tok}"})
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["email"] == "jane.client@corp.example.com"
    assert body["total_bookings"] == 0

    bookings = await client.get("/api/v1/customer-portal/bookings", headers={"Authorization": f"Bearer {tok}"})
    assert bookings.status_code == 200
    assert bookings.json() == []


@pytest.mark.asyncio
async def test_customer_can_rebook_and_it_appears(client: AsyncClient, db_session):
    from datetime import datetime, timedelta, timezone

    cust = Customer(full_name="Rebook Client", email="rebook@corp.example.com", phone="+61400222000")
    db_session.add(cust)
    await db_session.commit()
    await db_session.refresh(cust)
    token = create_customer_setup_token(cust.id)
    await client.post("/api/v1/customer-portal/set-password", json={"token": token, "password": "CustomerPw1!"})
    login = await client.post("/api/v1/auth/login", json={"email": "rebook@corp.example.com", "password": "CustomerPw1!"})
    h = {"Authorization": f"Bearer {login.json()['access_token']}"}

    when = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    body = {
        "pickup_address": "Melbourne CBD", "dropoff_address": "Melbourne Airport T2",
        "pickup_datetime": when, "vehicle_category": "SEDAN_PREMIUM", "passenger_count": 2,
    }
    r = await client.post("/api/v1/customer-portal/book", headers=h, json=body)
    assert r.status_code == 200, r.text
    assert r.json()["booking_number"]
    assert r.json()["total_fare"] > 0

    listing = await client.get("/api/v1/customer-portal/bookings", headers=h)
    assert len(listing.json()) == 1
    assert listing.json()[0]["booking_number"] == r.json()["booking_number"]


@pytest.mark.asyncio
async def test_set_password_rejects_bad_token(client: AsyncClient):
    r = await client.post("/api/v1/customer-portal/set-password", json={
        "token": "clearly-not-a-valid-jwt-token", "password": "CustomerPw1!",
    })
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_customer_portal_requires_auth(client: AsyncClient):
    assert (await client.get("/api/v1/customer-portal/me")).status_code in (401, 403)
