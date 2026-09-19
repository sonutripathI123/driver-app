"""
Public driver self-signup link.

A shareable link lets a driver register themselves; the secret token in the
link is the only thing standing between the public form and account creation,
so these pin: off by default, wrong token refused, a valid application creates
a working driver with a portal login, and the staff link endpoint only hands
out the URL when signup is enabled.
"""
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.models.user import User
from tests.conftest import auth_header

TOKEN = "signup-secret-123"

APPLICATION = {
    "full_name": "Self Signup Driver",
    "phone": "+61400777333",
    "email": "self.signup@corp.example.com",
    "license_number": "SELF-LIC-1",
    "password": "DriverChosenPass1!",
}


@pytest.mark.asyncio
async def test_apply_is_off_until_token_configured(client: AsyncClient):
    original = settings.DRIVER_SIGNUP_TOKEN
    settings.DRIVER_SIGNUP_TOKEN = ""
    try:
        resp = await client.post("/api/v1/drivers/apply", json=APPLICATION)
        assert resp.status_code == 503
    finally:
        settings.DRIVER_SIGNUP_TOKEN = original


@pytest.mark.asyncio
async def test_apply_rejects_wrong_token(client: AsyncClient):
    original = settings.DRIVER_SIGNUP_TOKEN
    settings.DRIVER_SIGNUP_TOKEN = TOKEN
    try:
        assert (await client.post("/api/v1/drivers/apply", json=APPLICATION)).status_code == 401
        assert (await client.post("/api/v1/drivers/apply?token=nope", json=APPLICATION)).status_code == 401
    finally:
        settings.DRIVER_SIGNUP_TOKEN = original


@pytest.mark.asyncio
async def test_apply_creates_driver_with_working_login(client: AsyncClient):
    original = settings.DRIVER_SIGNUP_TOKEN
    settings.DRIVER_SIGNUP_TOKEN = TOKEN
    try:
        resp = await client.post(f"/api/v1/drivers/apply?token={TOKEN}", json=APPLICATION)
        assert resp.status_code == 201, resp.text
        assert resp.json()["status"] == "registered"

        # The applicant can immediately sign in with the password they chose.
        login = await client.post("/api/v1/auth/login", json={
            "email": APPLICATION["email"], "password": APPLICATION["password"],
        })
        assert login.status_code == 200
        assert login.json()["user"]["role"] == "DRIVER"
    finally:
        settings.DRIVER_SIGNUP_TOKEN = original


@pytest.mark.asyncio
async def test_applied_driver_appears_in_staff_roster(client: AsyncClient, ops_user: User):
    original = settings.DRIVER_SIGNUP_TOKEN
    settings.DRIVER_SIGNUP_TOKEN = TOKEN
    try:
        app2 = {**APPLICATION, "email": "roster.driver@corp.example.com", "license_number": "SELF-LIC-2"}
        assert (await client.post(f"/api/v1/drivers/apply?token={TOKEN}", json=app2)).status_code == 201

        roster = await client.get("/api/v1/drivers/", headers=auth_header(ops_user))
        assert roster.status_code == 200
        emails = [d["email"] for d in roster.json()]
        assert "roster.driver@corp.example.com" in emails
    finally:
        settings.DRIVER_SIGNUP_TOKEN = original


@pytest.mark.asyncio
async def test_duplicate_licence_on_apply_is_refused(client: AsyncClient):
    original = settings.DRIVER_SIGNUP_TOKEN
    settings.DRIVER_SIGNUP_TOKEN = TOKEN
    try:
        first = {**APPLICATION, "email": "dup1@corp.example.com", "license_number": "DUP-LIC"}
        second = {**APPLICATION, "email": "dup2@corp.example.com", "license_number": "DUP-LIC"}
        assert (await client.post(f"/api/v1/drivers/apply?token={TOKEN}", json=first)).status_code == 201
        clash = await client.post(f"/api/v1/drivers/apply?token={TOKEN}", json=second)
        assert clash.status_code == 400
        assert "already exists" in clash.json()["detail"]
    finally:
        settings.DRIVER_SIGNUP_TOKEN = original


@pytest.mark.asyncio
async def test_duplicate_email_on_apply_is_refused_cleanly(client: AsyncClient):
    """Re-applying with the same email (already a driver) must be a 400, not a 500."""
    original = settings.DRIVER_SIGNUP_TOKEN
    settings.DRIVER_SIGNUP_TOKEN = TOKEN
    try:
        first = {**APPLICATION, "email": "dupemail@corp.example.com", "license_number": "EMAIL-LIC-1"}
        second = {**APPLICATION, "email": "dupemail@corp.example.com", "license_number": "EMAIL-LIC-2"}
        assert (await client.post(f"/api/v1/drivers/apply?token={TOKEN}", json=first)).status_code == 201
        clash = await client.post(f"/api/v1/drivers/apply?token={TOKEN}", json=second)
        assert clash.status_code == 400
        assert "already registered" in clash.json()["detail"]
    finally:
        settings.DRIVER_SIGNUP_TOKEN = original


@pytest.mark.asyncio
async def test_signup_link_endpoint(client: AsyncClient, ops_user: User):
    h = auth_header(ops_user)
    original = settings.DRIVER_SIGNUP_TOKEN

    settings.DRIVER_SIGNUP_TOKEN = ""
    off = await client.get("/api/v1/drivers/signup-link", headers=h)
    assert off.status_code == 200 and off.json()["enabled"] is False and off.json()["url"] is None

    settings.DRIVER_SIGNUP_TOKEN = TOKEN
    try:
        on = await client.get("/api/v1/drivers/signup-link", headers=h)
        body = on.json()
        assert body["enabled"] is True
        assert body["url"] == f"/apply?token={TOKEN}"
    finally:
        settings.DRIVER_SIGNUP_TOKEN = original


@pytest.mark.asyncio
async def test_signup_link_is_staff_only(client: AsyncClient, driver_user: User):
    """A driver must not be able to read the signup link."""
    resp = await client.get("/api/v1/drivers/signup-link", headers=auth_header(driver_user))
    assert resp.status_code == 403
