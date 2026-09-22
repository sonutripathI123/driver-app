from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import get_current_active_user, require_customer, require_ops
from app.models.user import User
from app.schemas.customer_portal import (
    CustomerBookingItem,
    CustomerPortalProfile,
    CustomerSetPasswordRequest,
    CustomerSetPasswordResponse,
)
from app.services.customer_portal_service import CustomerPortalService

router = APIRouter(prefix="/customer-portal", tags=["Customer Portal"])


@router.post("/set-password", response_model=CustomerSetPasswordResponse)
async def set_password(payload: CustomerSetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Public: activate a customer's portal login from the first-booking link.
    The token proves which customer this is; the customer chooses their password.
    """
    customer = await CustomerPortalService.set_password(db, payload.token, payload.password)
    return CustomerSetPasswordResponse(
        status="ready",
        email=customer.email,
        message="Your password is set. Sign in with your email and this password.",
    )


@router.get("/me", response_model=CustomerPortalProfile, dependencies=[Depends(require_customer)])
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """The signed-in customer's own profile and booking totals."""
    customer = await CustomerPortalService.get_customer_by_user(db, current_user)
    return await CustomerPortalService.get_profile(db, customer)


@router.get("/bookings", response_model=List[CustomerBookingItem], dependencies=[Depends(require_customer)])
async def get_my_bookings(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """The signed-in customer's own bookings, newest first."""
    customer = await CustomerPortalService.get_customer_by_user(db, current_user)
    return await CustomerPortalService.get_bookings(db, customer)


@router.get("/setup-link/{customer_id}", dependencies=[Depends(require_ops)])
async def get_setup_link(customer_id: str):
    """Staff: (re)generate the customer's set-password link to share manually."""
    return {"url": CustomerPortalService.setup_link(customer_id)}
