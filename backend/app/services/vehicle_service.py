from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.enums import VehicleCategory
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


class VehicleService:
    @staticmethod
    async def get_by_id(db: AsyncSession, vehicle_id: str) -> Optional[Vehicle]:
        """Get vehicle by unique ID."""
        stmt = select(Vehicle).where(Vehicle.id == vehicle_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_plate(db: AsyncSession, plate: str) -> Optional[Vehicle]:
        """Get vehicle by registration plate."""
        norm_plate = plate.strip().upper().replace(" ", "")
        stmt = select(Vehicle).where(Vehicle.registration_plate == norm_plate)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_vehicles(
        db: AsyncSession,
        category: Optional[VehicleCategory] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Vehicle]:
        """List fleet vehicles with filters."""
        query = select(Vehicle)
        if category:
            query = query.where(Vehicle.category == category)
        if is_active is not None:
            query = query.where(Vehicle.is_active == is_active)
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    Vehicle.registration_plate.ilike(pattern),
                    Vehicle.make.ilike(pattern),
                    Vehicle.model.ilike(pattern),
                    Vehicle.color.ilike(pattern)
                )
            )
        query = query.offset(skip).limit(limit).order_by(Vehicle.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create_vehicle(
        db: AsyncSession,
        vehicle_in: VehicleCreate
    ) -> Vehicle:
        """Create a new fleet vehicle."""
        norm_plate = vehicle_in.registration_plate.strip().upper().replace(" ", "")
        existing = await VehicleService.get_by_plate(db, norm_plate)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A vehicle with registration plate '{norm_plate}' already exists."
            )

        vehicle = Vehicle(
            category=vehicle_in.category,
            make=vehicle_in.make.strip(),
            model=vehicle_in.model.strip(),
            year=vehicle_in.year,
            color=vehicle_in.color.strip() if vehicle_in.color else None,
            registration_plate=norm_plate,
            passenger_capacity=vehicle_in.passenger_capacity,
            luggage_capacity=vehicle_in.luggage_capacity,
            is_active=vehicle_in.is_active,
            insurance_expiry=vehicle_in.insurance_expiry,
            rego_expiry=vehicle_in.rego_expiry
        )
        db.add(vehicle)
        await db.commit()
        await db.refresh(vehicle)
        return vehicle

    @staticmethod
    async def update_vehicle(
        db: AsyncSession,
        vehicle_id: str,
        vehicle_update: VehicleUpdate
    ) -> Vehicle:
        """Update vehicle details."""
        vehicle = await VehicleService.get_by_id(db, vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found"
            )

        if vehicle_update.registration_plate is not None:
            norm_plate = vehicle_update.registration_plate.strip().upper().replace(" ", "")
            if norm_plate != vehicle.registration_plate:
                existing = await VehicleService.get_by_plate(db, norm_plate)
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Registration plate '{norm_plate}' is already in use."
                    )
                vehicle.registration_plate = norm_plate

        if vehicle_update.category is not None:
            vehicle.category = vehicle_update.category
        if vehicle_update.make is not None:
            vehicle.make = vehicle_update.make.strip()
        if vehicle_update.model is not None:
            vehicle.model = vehicle_update.model.strip()
        if vehicle_update.year is not None:
            vehicle.year = vehicle_update.year
        if vehicle_update.color is not None:
            vehicle.color = vehicle_update.color.strip() if vehicle_update.color else None
        if vehicle_update.passenger_capacity is not None:
            vehicle.passenger_capacity = vehicle_update.passenger_capacity
        if vehicle_update.luggage_capacity is not None:
            vehicle.luggage_capacity = vehicle_update.luggage_capacity
        if vehicle_update.is_active is not None:
            vehicle.is_active = vehicle_update.is_active
        if vehicle_update.insurance_expiry is not None:
            vehicle.insurance_expiry = vehicle_update.insurance_expiry
        if vehicle_update.rego_expiry is not None:
            vehicle.rego_expiry = vehicle_update.rego_expiry

        await db.commit()
        await db.refresh(vehicle)
        return vehicle

    @staticmethod
    async def deactivate_vehicle(db: AsyncSession, vehicle_id: str) -> Vehicle:
        """Deactivate a vehicle."""
        vehicle = await VehicleService.get_by_id(db, vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found"
            )
        vehicle.is_active = False
        await db.commit()
        await db.refresh(vehicle)
        return vehicle
