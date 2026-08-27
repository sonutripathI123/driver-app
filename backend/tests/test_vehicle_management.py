import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import VehicleCategory
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleUpdate
from app.services.vehicle_service import VehicleService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_vehicle_service_crud_and_uniqueness(db_session: AsyncSession):
    # 1. Create vehicle
    v1 = VehicleCreate(
        category=VehicleCategory.SEDAN_EXECUTIVE,
        make="BMW",
        model="7 Series 740i",
        year=2024,
        color="Mineral White",
        registration_plate="EXEC-77",
        passenger_capacity=3,
        luggage_capacity=3
    )
    saved_v1 = await VehicleService.create_vehicle(db_session, v1)
    assert saved_v1.id is not None
    assert saved_v1.registration_plate == "EXEC-77"

    # 2. Duplicate plate is rejected
    with pytest.raises(Exception) as exc_info:
        await VehicleService.create_vehicle(db_session, v1)
    assert "already exists" in str(exc_info.value)

    # 3. Update vehicle
    updated = await VehicleService.update_vehicle(
        db_session,
        saved_v1.id,
        VehicleUpdate(color="Sapphire Black", luggage_capacity=4)
    )
    assert updated.color == "Sapphire Black"
    assert updated.luggage_capacity == 4

    # 4. Deactivate vehicle
    deactivated = await VehicleService.deactivate_vehicle(db_session, saved_v1.id)
    assert deactivated.is_active is False


@pytest.mark.asyncio
async def test_vehicle_api_and_rbac(
    client: AsyncClient,
    admin_user: User,
    ops_user: User,
    dispatcher_user: User,
    driver_user: User,
    customer_user: User
):
    admin_headers = auth_header(admin_user)
    ops_headers = auth_header(ops_user)
    dispatcher_headers = auth_header(dispatcher_user)
    driver_headers = auth_header(driver_user)
    customer_headers = auth_header(customer_user)

    # 1. Ops can create vehicle
    payload = {
        "category": VehicleCategory.PEOPLE_MOVER.value,
        "make": "Mercedes-Benz",
        "model": "V-Class V300d",
        "year": 2024,
        "color=" : "Black",
        "color": "Obsidian Black",
        "registration_plate": "VAN-99",
        "passenger_capacity": 7,
        "luggage_capacity": 7
    }
    resp = await client.post("/api/v1/vehicles/", json=payload, headers=ops_headers)
    assert resp.status_code == 201
    veh_id = resp.json()["id"]

    # 2. Dispatcher can view vehicles
    list_resp = await client.get("/api/v1/vehicles/", headers=dispatcher_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 3. Dispatcher CANNOT create or update vehicles
    assert (await client.post("/api/v1/vehicles/", json=payload, headers=dispatcher_headers)).status_code == 403

    # 4. Driver and Customer CANNOT access vehicles endpoint
    assert (await client.get("/api/v1/vehicles/", headers=driver_headers)).status_code == 403
    assert (await client.get("/api/v1/vehicles/", headers=customer_headers)).status_code == 403

    # 5. Admin can deactivate vehicle
    del_resp = await client.delete(f"/api/v1/vehicles/{veh_id}", headers=admin_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["is_active"] is False
