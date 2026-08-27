import pytest
from httpx import AsyncClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_owasp_security_headers_present(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200

    # Verify OWASP Security Headers
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("X-XSS-Protection") == "1; mode=block"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "default-src" in resp.headers.get("Content-Security-Policy", "")


from tests.conftest import auth_header
from app.models.user import User


@pytest.mark.asyncio
async def test_rate_limiting_middleware_headers(client: AsyncClient, admin_user: User):
    resp = await client.get("/api/v1/auth/me", headers=auth_header(admin_user))
    assert resp.status_code == 200

    # Verify rate limit telemetry headers
    assert "X-RateLimit-Limit" in resp.headers
    assert "X-RateLimit-Remaining" in resp.headers


@pytest.mark.asyncio
async def test_cors_options_preflight_headers(client: AsyncClient):
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type"
    }
    resp = await client.options("/api/v1/auth/login", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


@pytest.mark.asyncio
async def test_auth_rate_limiting_brute_force_protection(client: AsyncClient):
    # Temporarily set lower limit to test 429 threshold quickly
    original_limit = settings.AUTH_RATE_LIMIT_PER_MINUTE
    settings.AUTH_RATE_LIMIT_PER_MINUTE = 5

    try:
        payload = {"email": "attacker@bruteforce.com", "password": "wrongpassword"}
        hit_429 = False

        for _ in range(8):
            resp = await client.post("/api/v1/auth/login", json=payload)
            if resp.status_code == 429:
                hit_429 = True
                assert "Rate limit exceeded" in resp.json()["detail"]
                assert "Retry-After" in resp.headers
                break

        assert hit_429 is True
    finally:
        settings.AUTH_RATE_LIMIT_PER_MINUTE = original_limit


@pytest.mark.asyncio
async def test_production_health_check(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "version" in data
