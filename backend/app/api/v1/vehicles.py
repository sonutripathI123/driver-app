from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import require_admin, require_ops, require_staff
from app.models.enums import VehicleCategory
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["Fleet Vehicles"])


@router.get("/", response_model=List[VehicleRead], dependencies=[Depends(require_staff)])
async def list_vehicles(
    category: Optional[VehicleCategory] = Query(None, description="Filter by vehicle category"),
    is_active: Optional[bool] = Query(None, description="Filter by active state"),
    search: Optional[str] = Query(None, description="Search make, model, plate, color"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    List fleet vehicles.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER, ACCOUNTANT)
    """
    return await VehicleService.list_vehicles(
        db=db,
        category=category,
        is_active=is_active,
        search=search,
        skip=skip,
        limit=limit
    )


@router.post("/", response_model=VehicleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_ops)])
async def create_vehicle(
    vehicle_in: VehicleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new fleet vehicle.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await VehicleService.create_vehicle(
        db=db,
        vehicle_in=vehicle_in
    )


@router.get("/{vehicle_id}", response_model=VehicleRead, dependencies=[Depends(require_staff)])
async def get_vehicle(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get vehicle details.
    Access: Staff
    """
    vehicle = await VehicleService.get_by_id(db, vehicle_id)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found"
        )
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleRead, dependencies=[Depends(require_ops)])
async def update_vehicle(
    vehicle_id: str,
    vehicle_update: VehicleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update vehicle information.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await VehicleService.update_vehicle(
        db=db,
        vehicle_id=vehicle_id,
        vehicle_update=vehicle_update
    )


@router.delete("/{vehicle_id}", response_model=VehicleRead, dependencies=[Depends(require_admin)])
async def deactivate_vehicle(
    vehicle_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate a vehicle.
    Access: ADMIN only
    """
    return await VehicleService.deactivate_vehicle(
        db=db,
        vehicle_id=vehicle_id
    )
