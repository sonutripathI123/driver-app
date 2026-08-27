from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
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
    DriverCreate,
    DriverRead,
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
