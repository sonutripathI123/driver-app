import pytest
from httpx import AsyncClient
from app.models.enums import UserRole
from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_admin_full_access(
    client: AsyncClient,
    admin_user: User
):
    headers = auth_header(admin_user)

    # Admin has access to all test endpoints
    r1 = await client.get("/api/v1/rbac-test/admin-only", headers=headers)
    assert r1.status_code == 200

    r2 = await client.get("/api/v1/rbac-test/ops-or-admin", headers=headers)
    assert r2.status_code == 200

    r3 = await client.get("/api/v1/rbac-test/dispatcher-or-higher", headers=headers)
    assert r3.status_code == 200

    r4 = await client.get("/api/v1/rbac-test/accountant-or-admin", headers=headers)
    assert r4.status_code == 200

    r5 = await client.get("/api/v1/rbac-test/driver-or-admin", headers=headers)
    assert r5.status_code == 200

    # Admin can list users and create users
    r6 = await client.get("/api/v1/users/", headers=headers)
    assert r6.status_code == 200

    r7 = await client.post(
        "/api/v1/users/",
        headers=headers,
        json={
            "email": "createdbyadmin@test.com",
            "password": "Password123!",
            "full_name": "Created User",
            "role": UserRole.DISPATCHER.value
        }
    )
    assert r7.status_code == 201


@pytest.mark.asyncio
async def test_ops_manager_permissions(
    client: AsyncClient,
    ops_user: User
):
    headers = auth_header(ops_user)

    # Ops can access ops and dispatcher endpoints
    r_ops = await client.get("/api/v1/rbac-test/ops-or-admin", headers=headers)
    assert r_ops.status_code == 200

    r_disp = await client.get("/api/v1/rbac-test/dispatcher-or-higher", headers=headers)
    assert r_disp.status_code == 200

    r_users = await client.get("/api/v1/users/", headers=headers)
    assert r_users.status_code == 200

    # Ops CANNOT access admin-only or accountant-only
    r_admin = await client.get("/api/v1/rbac-test/admin-only", headers=headers)
    assert r_admin.status_code == 403

    r_acc = await client.get("/api/v1/rbac-test/accountant-or-admin", headers=headers)
    assert r_acc.status_code == 403

    # Ops CANNOT create new staff users via /users/ endpoint
    r_create = await client.post(
        "/api/v1/users/",
        headers=headers,
        json={
            "email": "ops_attempt@test.com",
            "password": "Password123!",
            "full_name": "Attempt User",
            "role": UserRole.DRIVER.value
        }
    )
    assert r_create.status_code == 403


@pytest.mark.asyncio
async def test_dispatcher_permissions(
    client: AsyncClient,
    dispatcher_user: User
):
    headers = auth_header(dispatcher_user)

    # Dispatcher can access dispatcher endpoint
    r_disp = await client.get("/api/v1/rbac-test/dispatcher-or-higher", headers=headers)
    assert r_disp.status_code == 200

    # Dispatcher CANNOT access ops-only, admin-only, or accountant-only
    r_ops = await client.get("/api/v1/rbac-test/ops-or-admin", headers=headers)
    assert r_ops.status_code == 403

    r_admin = await client.get("/api/v1/rbac-test/admin-only", headers=headers)
    assert r_admin.status_code == 403

    r_acc = await client.get("/api/v1/rbac-test/accountant-or-admin", headers=headers)
    assert r_acc.status_code == 403

    r_users = await client.get("/api/v1/users/", headers=headers)
    assert r_users.status_code == 403


@pytest.mark.asyncio
async def test_accountant_permissions(
    client: AsyncClient,
    accountant_user: User
):
    headers = auth_header(accountant_user)

    # Accountant can access accountant-or-admin endpoint
    r_acc = await client.get("/api/v1/rbac-test/accountant-or-admin", headers=headers)
    assert r_acc.status_code == 200

    # Accountant CANNOT access dispatcher, ops, or admin
    r_disp = await client.get("/api/v1/rbac-test/dispatcher-or-higher", headers=headers)
    assert r_disp.status_code == 403

    r_ops = await client.get("/api/v1/rbac-test/ops-or-admin", headers=headers)
    assert r_ops.status_code == 403

    r_admin = await client.get("/api/v1/rbac-test/admin-only", headers=headers)
    assert r_admin.status_code == 403


@pytest.mark.asyncio
async def test_driver_permissions_isolation(
    client: AsyncClient,
    driver_user: User,
    customer_user: User
):
    headers = auth_header(driver_user)

    # Driver can access driver endpoint
    r_drv = await client.get("/api/v1/rbac-test/driver-or-admin", headers=headers)
    assert r_drv.status_code == 200

    # Driver CANNOT access ops, dispatch, accountant, or admin
    assert (await client.get("/api/v1/rbac-test/admin-only", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/rbac-test/ops-or-admin", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/rbac-test/dispatcher-or-higher", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/rbac-test/accountant-or-admin", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/users/", headers=headers)).status_code == 403

    # Driver CAN access own profile via /users/{id}
    r_self = await client.get(f"/api/v1/users/{driver_user.id}", headers=headers)
    assert r_self.status_code == 200

    # Driver CANNOT access other user's profile
    r_other = await client.get(f"/api/v1/users/{customer_user.id}", headers=headers)
    assert r_other.status_code == 403


@pytest.mark.asyncio
async def test_customer_permissions(
    client: AsyncClient,
    customer_user: User
):
    headers = auth_header(customer_user)

    # Customer is blocked from all internal endpoints
    assert (await client.get("/api/v1/rbac-test/admin-only", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/rbac-test/ops-or-admin", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/rbac-test/dispatcher-or-higher", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/rbac-test/accountant-or-admin", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/rbac-test/driver-or-admin", headers=headers)).status_code == 403
    assert (await client.get("/api/v1/users/", headers=headers)).status_code == 403
