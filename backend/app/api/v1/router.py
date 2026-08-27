from fastapi import APIRouter, Depends
from app.api.v1.accounting import router as accounting_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.automations import router as automations_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.customers import router as customers_router
from app.api.v1.dispatch import router as dispatch_router
from app.api.v1.driver_portal import router as driver_portal_router
from app.api.v1.drivers import router as drivers_router
from app.api.v1.flights import router as flights_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.partners import router as partners_router
from app.api.v1.payments import router as payments_router
from app.api.v1.pricing import router as pricing_router
from app.api.v1.quotes import router as quotes_router
from app.api.v1.users import router as users_router
from app.api.v1.vehicles import router as vehicles_router
from app.core.rbac import (
    get_current_active_user,
    require_accountant,
    require_admin,
    require_dispatcher,
    require_driver,
    require_ops,
)
from app.models.user import User

api_router = APIRouter()

# Mount feature sub-routers
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(customers_router)
api_router.include_router(vehicles_router)
api_router.include_router(drivers_router)
api_router.include_router(partners_router)
api_router.include_router(bookings_router)
api_router.include_router(quotes_router)
api_router.include_router(pricing_router)
api_router.include_router(payments_router)
api_router.include_router(dispatch_router)
api_router.include_router(notifications_router)
api_router.include_router(automations_router)
api_router.include_router(driver_portal_router)
api_router.include_router(flights_router)
api_router.include_router(invoices_router)
api_router.include_router(accounting_router)
api_router.include_router(analytics_router)


# RBAC Role Test / Verification Endpoints
@api_router.get("/rbac-test/admin-only", dependencies=[Depends(require_admin)])
async def test_admin_only(current_user: User = Depends(get_current_active_user)):
    return {"status": "access_granted", "role": current_user.role, "user_id": current_user.id}


@api_router.get("/rbac-test/ops-or-admin", dependencies=[Depends(require_ops)])
async def test_ops_or_admin(current_user: User = Depends(get_current_active_user)):
    return {"status": "access_granted", "role": current_user.role, "user_id": current_user.id}


@api_router.get("/rbac-test/dispatcher-or-higher", dependencies=[Depends(require_dispatcher)])
async def test_dispatcher(current_user: User = Depends(get_current_active_user)):
    return {"status": "access_granted", "role": current_user.role, "user_id": current_user.id}


@api_router.get("/rbac-test/accountant-or-admin", dependencies=[Depends(require_accountant)])
async def test_accountant(current_user: User = Depends(get_current_active_user)):
    return {"status": "access_granted", "role": current_user.role, "user_id": current_user.id}


@api_router.get("/rbac-test/driver-or-admin", dependencies=[Depends(require_driver)])
async def test_driver(current_user: User = Depends(get_current_active_user)):
    return {"status": "access_granted", "role": current_user.role, "user_id": current_user.id}
