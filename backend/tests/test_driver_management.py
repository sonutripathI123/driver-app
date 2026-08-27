import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import DriverStatus, UserRole
from app.models.user import User
from app.schemas.driver import DriverCreate, DriverUpdate
from app.services.driver_service import DriverService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_driver_service_creation_with_user_account(db_session: AsyncSession):
    driver_in = DriverCreate(
        full_name="Lewis Hamilton",
        phone="+61433001122",
        email="lewis@mercedes-f1.com",
        license_number="LIC-LH-44",
        status=DriverStatus.AVAILABLE,
        rating=5.0,
        create_user_account=True,
        password="SuperDriverPass123!"
    )
    saved_driver = await DriverService.create_driver(db_session, driver_in)
    assert saved_driver.id is not None
    assert saved_driver.user_id is not None
    assert saved_driver.user.role == UserRole.DRIVER
    assert saved_driver.user.email == "lewis@mercedes-f1.com"

    # Duplicate license is rejected
    with pytest.raises(Exception) as exc_info:
        await DriverService.create_driver(db_session, driver_in)
    assert "already exists" in str(exc_info.value)


@pytest.mark.asyncio
async def test_driver_api_and_privacy_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    ops_user: User,
    dispatcher_user: User,
    customer_user: User
):
    admin_headers = auth_header(admin_user)
    ops_headers = auth_header(ops_user)
    dispatcher_headers = auth_header(dispatcher_user)
    customer_headers = auth_header(customer_user)

    # 1. Ops creates Driver A (with user account)
    payload_a = {
        "full_name": "Driver Alpha",
        "phone": "+61400111222",
        "email": "alpha@drivers.com",
        "license_number=" : "LIC-ALPHA",
        "license_number": "LIC-ALPHA",
        "status": DriverStatus.AVAILABLE.value,
        "rating": 4.9,
        "create_user_account": True,
        "password": "DriverPassword123!"
    }
    resp_a = await client.post("/api/v1/drivers/", json=payload_a, headers=ops_headers)
    assert resp_a.status_code == 201
    driver_a = resp_a.json()
    driver_a_id = driver_a["id"]

    # 2. Ops creates Driver B (with user account)
    payload_b = {
        "full_name": "Driver Beta",
        "phone": "+61400333444",
        "email": "beta@drivers.com",
        "license_number": "LIC-BETA",
        "status": DriverStatus.AVAILABLE.value,
        "rating": 4.8,
        "create_user_account": True,
        "password": "DriverPassword123!"
    }
    resp_b = await client.post("/api/v1/drivers/", json=payload_b, headers=ops_headers)
    assert resp_b.status_code == 201
    driver_b = resp_b.json()
    driver_b_id = driver_b["id"]

    # 3. Log in as Driver Alpha to get auth token
    login_a = await client.post(
        "/api/v1/auth/login",
        json={"email": "alpha@drivers.com", "password": "DriverPassword123!"}
    )
    assert login_a.status_code == 200
    token_a = login_a.json()["access_token"]
    driver_a_headers = {"Authorization": f"Bearer {token_a}"}

    # 4. Driver Alpha CAN access own profile and status
    self_resp = await client.get(f"/api/v1/drivers/{driver_a_id}", headers=driver_a_headers)
    assert self_resp.status_code == 200
    assert self_resp.json()["email"] == "alpha@drivers.com"

    status_resp = await client.patch(
        f"/api/v1/drivers/{driver_a_id}/status",
        json={"status": DriverStatus.ON_TRIP.value},
        headers=driver_a_headers
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == DriverStatus.ON_TRIP.value

    # 5. PRIVACY ISOLATION: Driver Alpha CANNOT access Driver Beta's profile or update Beta's status!
    assert (await client.get(f"/api/v1/drivers/{driver_b_id}", headers=driver_a_headers)).status_code == 403
    assert (await client.patch(f"/api/v1/drivers/{driver_b_id}/status", json={"status": DriverStatus.OFF_DUTY.value}, headers=driver_a_headers)).status_code == 403

    # 6. Dispatcher can view all drivers and update status
    list_resp = await client.get("/api/v1/drivers/", headers=dispatcher_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 2

    # 7. Customer is completely blocked from driver endpoints
    assert (await client.get("/api/v1/drivers/", headers=customer_headers)).status_code == 403
