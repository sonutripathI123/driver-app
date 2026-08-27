import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerCreate
from app.services.customer_service import CustomerService
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_returning_customer_detection_and_deduplication(db_session: AsyncSession):
    # 1. Create first customer record
    c1 = CustomerCreate(
        full_name="Jonathan Wick",
        email="john.wick@continental.com",
        phone="+61411000111",
        company_name="Continental Hotel",
        notes="Requires discrete service."
    )
    saved_c1 = await CustomerService.find_or_create_customer(db_session, c1)
    assert saved_c1.id is not None
    assert saved_c1.total_bookings == 0

    # 2. Detect returning customer by email
    is_ret, found, match_type = await CustomerService.detect_returning_customer(
        db_session, email="john.wick@continental.com"
    )
    assert is_ret is True
    assert found.id == saved_c1.id
    assert match_type == "email"

    # 3. Detect returning customer by phone
    is_ret_phone, found_phone, match_type_phone = await CustomerService.detect_returning_customer(
        db_session, phone="+61411000111"
    )
    assert is_ret_phone is True
    assert found_phone.id == saved_c1.id
    assert match_type_phone == "phone"

    # 4. Attempt to create customer with same email -> Reuses same record!
    c2 = CustomerCreate(
        full_name="John Wick",
        email="JOHN.WICK@CONTINENTAL.COM",  # Case insensitive
        phone="+61499999999",
        company_name="Continental High Table"
    )
    deduped = await CustomerService.find_or_create_customer(db_session, c2)
    assert deduped.id == saved_c1.id  # Same master CRM record!


@pytest.mark.asyncio
async def test_customer_metrics_and_vip_promotion(db_session: AsyncSession):
    c = Customer(
        full_name="Bruce Wayne",
        email="bruce@wayne.corp",
        phone="+61422334455",
        total_bookings=0,
        total_spent=0.0,
        is_vip=False
    )
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)

    # Add 1 booking worth $6,000 (exceeds $5,000 VIP threshold)
    updated = await CustomerService.update_metrics(
        db_session,
        customer_id=c.id,
        add_booking_count=1,
        add_spent_amount=6000.0
    )
    assert updated.total_bookings == 1
    assert updated.total_spent == 6000.0
    assert updated.is_vip is True  # Automatically promoted to VIP!


@pytest.mark.asyncio
async def test_customer_api_crud_and_rbac(
    client: AsyncClient,
    admin_user: User,
    ops_user: User,
    driver_user: User,
    customer_user: User
):
    admin_headers = auth_header(admin_user)
    ops_headers = auth_header(ops_user)
    driver_headers = auth_header(driver_user)
    customer_headers = auth_header(customer_user)

    # 1. Ops can create customer via API
    payload = {
        "full_name": "Tony Stark",
        "email": "tony@starkindustries.com",
        "phone": "+61455667788",
        "company_name": "Stark Industries",
        "is_vip": True
    }
    resp = await client.post("/api/v1/customers/", json=payload, headers=ops_headers)
    assert resp.status_code == 201
    created = resp.json()
    cust_id = created["id"]
    assert created["full_name"] == "Tony Stark"
    assert created["is_vip"] is True

    # 2. Lookup endpoint finds returning customer
    lookup_resp = await client.get(
        f"/api/v1/customers/lookup?email=tony@starkindustries.com",
        headers=ops_headers
    )
    assert lookup_resp.status_code == 200
    lookup_data = lookup_resp.json()
    assert lookup_data["is_returning"] is True
    assert lookup_data["customer"]["id"] == cust_id

    # 3. List customers with search
    list_resp = await client.get("/api/v1/customers/?search=stark", headers=ops_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1

    # 4. Update customer
    patch_resp = await client.patch(
        f"/api/v1/customers/{cust_id}",
        json={"company_name": "Avengers Facility"},
        headers=ops_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["company_name"] == "Avengers Facility"

    # 5. RBAC: Driver and Customer are forbidden from accessing customer CRM list
    assert (await client.get("/api/v1/customers/", headers=driver_headers)).status_code == 403
    assert (await client.get("/api/v1/customers/", headers=customer_headers)).status_code == 403
