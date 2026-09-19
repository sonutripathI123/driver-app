import hmac
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import (
    get_current_active_user,
    require_dispatcher,
    require_ops,
    require_staff,
)
from app.models.enums import DriverStatus, UserRole
from app.models.user import User
from app.schemas.driver import (
    DriverApplication,
    DriverCreate,
    DriverRead,
    DriverSignupLinkResponse,
    DriverStatusUpdate,
    DriverUpdate,
)
from app.services.driver_service import DriverService

router = APIRouter(prefix="/drivers", tags=["Driver Management"])


@router.get("/", response_model=List[DriverRead], dependencies=[Depends(require_dispatcher)])
async def list_drivers(
    status_filter: Optional[DriverStatus] = Query(None, alias="status", description="Filter by availability status"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search name, email, phone, license"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    List chauffeur drivers.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await DriverService.list_drivers(
        db=db,
        status_filter=status_filter,
        is_active=is_active,
        search=search,
        skip=skip,
        limit=limit
    )


@router.post("/", response_model=DriverRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_ops)])
async def create_driver(
    driver_in: DriverCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new driver profile with license validation and optional system user login.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await DriverService.create_driver(
        db=db,
        driver_in=driver_in
    )


@router.get("/signup-link", response_model=DriverSignupLinkResponse, dependencies=[Depends(require_ops)])
async def get_driver_signup_link():
    """
    The shareable self-signup link for drivers, if enabled.

    Returns a relative path with the secret token; the frontend prefixes its
    own origin. Staff-only, since the token is what protects the public form.
    Access: ADMIN, OPERATIONS_MANAGER.
    """
    token = (settings.DRIVER_SIGNUP_TOKEN or "").strip()
    if not token:
        return DriverSignupLinkResponse(
            enabled=False,
            url=None,
            detail="Driver self-signup is off. Set DRIVER_SIGNUP_TOKEN to enable the link.",
        )
    return DriverSignupLinkResponse(
        enabled=True,
        url=f"/apply?token={token}",
        detail="Share this link with a driver. They fill the form and appear in the roster.",
    )


@router.post("/apply", response_model=dict, status_code=status.HTTP_201_CREATED)
async def driver_self_apply(
    payload: DriverApplication,
    token: Optional[str] = Query(None, description="Signup token from the shared link"),
    x_signup_token: Optional[str] = Header(None, alias="X-Signup-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Public driver self-registration from the shared link.

    Not behind the JWT (the applicant has no login yet), so it is gated by the
    signup token carried in the link. With DRIVER_SIGNUP_TOKEN unset the
    endpoint refuses everything, so driver accounts cannot be created without
    the link. Creates an active driver with a portal login using the password
    the applicant chose; a vehicle is assigned later by staff.
    """
    expected = (settings.DRIVER_SIGNUP_TOKEN or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Driver self-signup is not enabled.",
        )
    supplied = (x_signup_token or token or "").strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing signup link token.")

    from datetime import datetime, timezone

    note = (payload.notes or "").strip()
    stamp = datetime.now(timezone.utc).strftime("%d %b %Y")
    signup_note = f"Self-registered via signup link on {stamp}." + (f" {note}" if note else "")

    driver_in = DriverCreate(
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        email=payload.email,
        license_number=payload.license_number.strip(),
        accreditation_number=(payload.accreditation_number or None),
        status=DriverStatus.OFF_DUTY,
        rating=5.0,
        is_active=True,
        notes=signup_note,
        create_user_account=True,
        password=payload.password,
    )
    driver = await DriverService.create_driver(db, driver_in)
    # Public response: confirm only, do not leak the roster record.
    return {
        "status": "registered",
        "message": "You are on the roster. Sign in to the driver app with your email and the password you just set.",
        "full_name": driver.full_name,
    }


@router.get("/{driver_id}", response_model=DriverRead)
async def get_driver(
    driver_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get driver details.
    Access: Staff or Driver themselves
    """
    driver = await DriverService.get_by_id(db, driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )

    # If driver user, verify they are only accessing their own profile
    if current_user.role == UserRole.DRIVER:
        if driver.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Drivers cannot access other drivers' profiles."
            )
    elif current_user.role not in (UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.DISPATCHER, UserRole.ACCOUNTANT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )

    return driver


@router.delete("/{driver_id}", status_code=status.HTTP_200_OK, dependencies=[Depends(require_ops)])
async def delete_driver(
    driver_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Remove a driver from the roster (and their portal login).
    Refused with 409 while the driver has a live trip in hand.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    name = await DriverService.delete_driver(db, driver_id)
    return {"status": "deleted", "driver_id": driver_id, "full_name": name}


@router.patch("/{driver_id}", response_model=DriverRead, dependencies=[Depends(require_ops)])
async def update_driver(
    driver_id: str,
    driver_update: DriverUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update driver profile, licensing, rating, or vehicle assignment.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await DriverService.update_driver(
        db=db,
        driver_id=driver_id,
        driver_update=driver_update
    )


@router.patch("/{driver_id}/status", response_model=DriverRead)
async def update_driver_status(
    driver_id: str,
    status_payload: DriverStatusUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update driver availability status (e.g. AVAILABLE, ON_TRIP, OFF_DUTY).
    Access: Dispatchers, Ops, Admins, OR Driver themselves updating own status.
    """
    driver = await DriverService.get_by_id(db, driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found"
        )

    if current_user.role == UserRole.DRIVER:
        if driver.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Drivers cannot update another driver's status."
            )
    elif current_user.role not in (UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.DISPATCHER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )

    return await DriverService.update_status(
        db=db,
        driver_id=driver_id,
        new_status=status_payload.status
    )
