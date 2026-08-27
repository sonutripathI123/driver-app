from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password
from app.models.driver import Driver
from app.models.enums import DriverStatus, UserRole
from app.models.user import User
from app.schemas.driver import DriverCreate, DriverUpdate


class DriverService:
    @staticmethod
    async def get_by_id(db: AsyncSession, driver_id: str) -> Optional[Driver]:
        """Fetch driver by unique ID."""
        stmt = select(Driver).where(Driver.id == driver_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_user_id(db: AsyncSession, user_id: str) -> Optional[Driver]:
        """Fetch driver profile linked to a system User ID."""
        stmt = select(Driver).where(Driver.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_license(db: AsyncSession, license_number: str) -> Optional[Driver]:
        """Fetch driver by driver license number."""
        norm_lic = license_number.strip().upper()
        stmt = select(Driver).where(Driver.license_number == norm_lic)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_drivers(
        db: AsyncSession,
        status_filter: Optional[DriverStatus] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Driver]:
        """List drivers with filters."""
        query = select(Driver)
        if status_filter:
            query = query.where(Driver.status == status_filter)
        if is_active is not None:
            query = query.where(Driver.is_active == is_active)
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    Driver.full_name.ilike(pattern),
                    Driver.email.ilike(pattern),
                    Driver.phone.ilike(pattern),
                    Driver.license_number.ilike(pattern)
                )
            )
        query = query.offset(skip).limit(limit).order_by(Driver.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create_driver(
        db: AsyncSession,
        driver_in: DriverCreate
    ) -> Driver:
        """Creates a driver record, with optional automatic user login account creation."""
        norm_email = driver_in.email.strip().lower()
        norm_lic = driver_in.license_number.strip().upper()

        # Check existing license
        existing_lic = await DriverService.get_by_license(db, norm_lic)
        if existing_lic:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Driver with license '{norm_lic}' already exists."
            )

        user_id = driver_in.user_id
        if not user_id and driver_in.create_user_account:
            # Check if user already exists
            user_stmt = select(User).where(User.email == norm_email)
            user_res = await db.execute(user_stmt)
            existing_user = user_res.scalar_one_or_none()

            if existing_user:
                if existing_user.role != UserRole.DRIVER:
                    existing_user.role = UserRole.DRIVER
                user_id = existing_user.id
            else:
                raw_password = driver_in.password or "DriverInitialPass123!"
                new_user = User(
                    email=norm_email,
                    hashed_password=hash_password(raw_password),
                    full_name=driver_in.full_name.strip(),
                    phone=driver_in.phone.strip(),
                    role=UserRole.DRIVER,
                    is_active=True,
                    is_verified=True
                )
                db.add(new_user)
                await db.flush()
                user_id = new_user.id

        driver = Driver(
            user_id=user_id,
            full_name=driver_in.full_name.strip(),
            phone=driver_in.phone.strip(),
            email=norm_email,
            license_number=norm_lic,
            license_expiry=driver_in.license_expiry,
            accreditation_number=driver_in.accreditation_number.strip() if driver_in.accreditation_number else None,
            status=driver_in.status,
            rating=driver_in.rating,
            default_vehicle_id=driver_in.default_vehicle_id,
            is_active=driver_in.is_active,
            notes=driver_in.notes
        )
        db.add(driver)
        await db.commit()
        await db.refresh(driver)
        return driver

    @staticmethod
    async def update_driver(
        db: AsyncSession,
        driver_id: str,
        driver_update: DriverUpdate
    ) -> Driver:
        """Update driver profile details."""
        driver = await DriverService.get_by_id(db, driver_id)
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Driver not found"
            )

        if driver_update.license_number is not None:
            norm_lic = driver_update.license_number.strip().upper()
            if norm_lic != driver.license_number:
                existing = await DriverService.get_by_license(db, norm_lic)
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"License '{norm_lic}' is already registered."
                    )
                driver.license_number = norm_lic

        if driver_update.full_name is not None:
            driver.full_name = driver_update.full_name.strip()
        if driver_update.phone is not None:
            driver.phone = driver_update.phone.strip()
        if driver_update.email is not None:
            driver.email = driver_update.email.strip().lower()
        if driver_update.license_expiry is not None:
            driver.license_expiry = driver_update.license_expiry
        if driver_update.accreditation_number is not None:
            driver.accreditation_number = driver_update.accreditation_number.strip() if driver_update.accreditation_number else None
        if driver_update.status is not None:
            driver.status = driver_update.status
        if driver_update.rating is not None:
            driver.rating = driver_update.rating
        if driver_update.default_vehicle_id is not None:
            driver.default_vehicle_id = driver_update.default_vehicle_id
        if driver_update.is_active is not None:
            driver.is_active = driver_update.is_active
        if driver_update.notes is not None:
            driver.notes = driver_update.notes

        await db.commit()
        await db.refresh(driver)
        return driver

    @staticmethod
    async def update_status(
        db: AsyncSession,
        driver_id: str,
        new_status: DriverStatus
    ) -> Driver:
        """Update driver availability status."""
        driver = await DriverService.get_by_id(db, driver_id)
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Driver not found"
            )
        driver.status = new_status
        await db.commit()
        await db.refresh(driver)
        return driver
