"""
Delete endpoints for the admin cleanup buttons.

Deleting operational records has data-integrity consequences (a booking owns
legs, payments, notifications and an invoice; a client is referenced by both),
so these pin the safe semantics: a booking delete takes its invoices with it,
a client delete is blocked while bookings/invoices still reference it, and a
notification delete is a plain leaf removal.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.models.booking import Booking
from app.models.invoice import Invoice
from app.models.notification import Notification
from app.models.user import User
from tests.conftest import auth_header


async def _make_booking_with_invoice(client: AsyncClient, h: dict) -> dict:
    veh = await client.post("/api/v1/vehicles/", headers=h, json={
        "category": "PEOPLE_MOVER", "make": "Mercedes-Benz", "model": "V-Class",
        "year": 2024, "registration_plate": "DEL-1", "passenger_capacity": 7, "luggage_capacity": 6,
    })
    vehicle_id = veh.json()["id"]
    drv = await client.post("/api/v1/drivers/", headers=h, json={
        "full_name": "Del Chauffeur", "phone": "+61400999888",
        "email": "del.driver@corp.example.com", "license_number": "DEL-LIC-1",
        "default_vehicle_id": vehicle_id, "create_user_account": False,
    })
    driver_id = drv.json()["id"]
    bk = await client.post("/api/v1/bookings/", headers=h, json={
        "customer_name": "Delete Test Client", "customer_email": "delclient@corp.example.com",
        "customer_phone": "+61411000222", "passenger_name": "Del Passenger", "total_fare": 440.0,
        "legs": [{
            "leg_number": 1, "pickup_address": "Melbourne Airport T2",
            "dropoff_address": "Crown Towers", "pickup_datetime": "2026-12-01T10:00:00Z",
            "vehicle_category": "PEOPLE_MOVER",
        }],
    })
    booking = bk.json()
    leg_id = booking["legs"][0]["id"]
    await client.post(f"/api/v1/dispatch/legs/{leg_id}/allocate", headers=h,
                      json={"driver_id": driver_id, "vehicle_id": vehicle_id, "allocation_cost": 120.0})
    inv = await client.post(f"/api/v1/invoices/generate-from-booking/{booking['id']}", headers=h)
    return {"booking": booking, "invoice_id": inv.json()["id"]}


@pytest.mark.asyncio
async def test_delete_notification(client: AsyncClient, admin_user: User, db_session):
    h = auth_header(admin_user)
    # A booking creates notifications; grab one and delete it.
    await _make_booking_with_invoice(client, h)
    notif_id = (await db_session.execute(select(Notification.id).limit(1))).scalar_one()

    resp = await client.delete(f"/api/v1/notifications/{notif_id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"
    assert await db_session.get(Notification, notif_id) is None

    # Deleting again is a clean 404, not a crash.
    assert (await client.delete(f"/api/v1/notifications/{notif_id}", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_delete_customer_blocked_while_it_has_bookings(client: AsyncClient, admin_user: User, db_session):
    h = auth_header(admin_user)
    made = await _make_booking_with_invoice(client, h)
    customer_id = made["booking"]["customer_id"]

    resp = await client.delete(f"/api/v1/customers/{customer_id}", headers=h)
    assert resp.status_code == 409
    assert "Delete those first" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_customer_ok_when_it_has_nothing(client: AsyncClient, admin_user: User):
    h = auth_header(admin_user)
    created = await client.post("/api/v1/customers/", headers=h, json={
        "full_name": "Lonely Client", "email": "lonely@corp.example.com", "phone": "+61400123123",
    })
    customer_id = created.json()["id"]
    resp = await client.delete(f"/api/v1/customers/{customer_id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"


@pytest.mark.asyncio
async def test_delete_booking_takes_its_invoice_and_legs(client: AsyncClient, admin_user: User, db_session):
    h = auth_header(admin_user)
    made = await _make_booking_with_invoice(client, h)
    booking_id = made["booking"]["id"]
    invoice_id = made["invoice_id"]

    resp = await client.delete(f"/api/v1/bookings/{booking_id}", headers=h)
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"

    # Booking gone, its invoice gone (not orphaned), notifications gone.
    assert await db_session.get(Booking, booking_id) is None
    assert await db_session.get(Invoice, invoice_id) is None
    leftover_notifs = await db_session.scalar(
        select(func.count()).select_from(Notification).where(Notification.booking_id == booking_id)
    )
    assert leftover_notifs == 0

    # And now the client can be deleted, since nothing references it.
    customer_id = made["booking"]["customer_id"]
    assert (await client.delete(f"/api/v1/customers/{customer_id}", headers=h)).status_code == 200


@pytest.mark.asyncio
async def test_delete_requires_admin(client: AsyncClient, dispatcher_user: User):
    """A dispatcher must not be able to delete bookings or clients."""
    h = auth_header(dispatcher_user)
    assert (await client.delete("/api/v1/bookings/does-not-exist", headers=h)).status_code == 403
    assert (await client.delete("/api/v1/customers/does-not-exist", headers=h)).status_code == 403
