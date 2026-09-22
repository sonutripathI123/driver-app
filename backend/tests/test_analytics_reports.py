"""
The analytics report endpoints must not 500 once any booking (leg) exists.
Regression: trip-profitability and vehicle-utilization accessed booking.legs
without eager-loading it, which raised an async lazy-load error (500) as soon
as a single leg was present.
"""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_reports_do_not_500_with_a_booking(client: AsyncClient, admin_user: User):
    h = auth_header(admin_user)
    now = datetime.now(timezone.utc)
    bk = await client.post("/api/v1/bookings/", headers=h, json={
        "customer_name": "Report Client", "customer_email": "report@corp.example.com",
        "customer_phone": "+61400333000", "total_fare": 300.0,
        "legs": [{
            "leg_number": 1, "pickup_address": "Melbourne CBD", "dropoff_address": "Melbourne Airport T2",
            "pickup_datetime": (now + timedelta(days=2)).isoformat(), "vehicle_category": "SEDAN_PREMIUM",
        }],
    })
    assert bk.status_code == 201, bk.text

    for path in (
        "/api/v1/analytics/trip-profitability",
        "/api/v1/analytics/vehicle-utilization",
        "/api/v1/analytics/driver-kpis",
        "/api/v1/analytics/dashboard-summary",
    ):
        r = await client.get(path, headers=h)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text}"

    # CSV exports must also work.
    for path in (
        "/api/v1/analytics/export/trip-profitability.csv",
        "/api/v1/analytics/export/financial-ledger.csv",
    ):
        r = await client.get(path, headers=h)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text}"
