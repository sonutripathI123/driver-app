import pytest
from httpx import AsyncClient
from app.models.enums import UserRole
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_health_endpoints(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

    api_response = await client.get("/api/health")
    assert api_response.status_code == 200
    assert api_response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_register_customer_success(client: AsyncClient):
    payload = {
        "email": "newcustomer@example.com",
        "password": "SecurePassword123!",
        "full_name": "Jane Chauffeur",
        "phone": "+61412345678"
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "newcustomer@example.com"
    assert data["user"]["role"] == UserRole.CUSTOMER.value


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, customer_user: User):
    payload = {
        "email": customer_user.email,
        "password": "AnotherPassword123!",
        "full_name": "Duplicate User"
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, customer_user: User):
    payload = {
        "email": customer_user.email,
        "password": "Password123!"
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["id"] == customer_user.id


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, customer_user: User):
    payload = {
        "email": customer_user.email,
        "password": "WrongPassword!"
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_deactivated_user(client: AsyncClient, inactive_user: User):
    payload = {
        "email": inactive_user.email,
        "password": "Password123!"
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 403
    assert "deactivated" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user_profile(client: AsyncClient, admin_user: User):
    headers = auth_header(admin_user)
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == admin_user.id
    assert data["role"] == UserRole.ADMIN.value


@pytest.mark.asyncio
async def test_get_current_user_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401  # HTTPBearer returns 401 Unauthorized when missing credentials



@pytest.mark.asyncio
async def test_refresh_token_endpoint(client: AsyncClient, driver_user: User):
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": driver_user.email, "password": "Password123!"}
    )
    tokens = login_resp.json()
    refresh_token = tokens["refresh_token"]

    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens


@pytest.mark.asyncio
async def test_change_password_flow(client: AsyncClient, customer_user: User):
    headers = auth_header(customer_user)

    # 1. Change password with correct current password
    resp = await client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "Password123!", "new_password": "NewBrandPassword999!"}
    )
    assert resp.status_code == 200

    # 2. Login with old password fails
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"email": customer_user.email, "password": "Password123!"}
    )
    assert old_login.status_code == 401

    # 3. Login with new password succeeds
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"email": customer_user.email, "password": "NewBrandPassword999!"}
    )
    assert new_login.status_code == 200
