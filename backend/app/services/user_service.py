from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
        """Gets user by unique ID."""
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
        """Gets user by email address."""
        normalized_email = email.strip().lower()
        stmt = select(User).where(User.email == normalized_email)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_users(
        db: AsyncSession,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """Lists users with optional filtering."""
        query = select(User)
        if role:
            query = query.where(User.role == role)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        if search:
            search_pattern = f"%{search.strip().lower()}%"
            query = query.where(
                (User.email.ilike(search_pattern)) |
                (User.full_name.ilike(search_pattern)) |
                (User.phone.ilike(search_pattern))
            )

        query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create_user(
        db: AsyncSession,
        user_in: UserCreate
    ) -> User:
        """Admin creates a new user with any specified role."""
        normalized_email = user_in.email.strip().lower()
        existing = await UserService.get_by_email(db, normalized_email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists."
            )

        user = User(
            email=normalized_email,
            hashed_password=hash_password(user_in.password),
            full_name=user_in.full_name.strip(),
            phone=user_in.phone.strip() if user_in.phone else None,
            role=user_in.role,
            is_active=True,
            is_verified=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def update_user(
        db: AsyncSession,
        user_id: str,
        user_update: UserUpdate
    ) -> User:
        """Updates user profile information and permissions."""
        user = await UserService.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        if user_update.email is not None:
            normalized_email = user_update.email.strip().lower()
            if normalized_email != user.email:
                existing = await UserService.get_by_email(db, normalized_email)
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email is already taken by another account."
                    )
                user.email = normalized_email

        if user_update.full_name is not None:
            user.full_name = user_update.full_name.strip()
        if user_update.phone is not None:
            user.phone = user_update.phone.strip() if user_update.phone else None
        if user_update.role is not None:
            user.role = user_update.role
        if user_update.is_active is not None:
            user.is_active = user_update.is_active
        if user_update.is_verified is not None:
            user.is_verified = user_update.is_verified

        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def deactivate_user(db: AsyncSession, user_id: str) -> User:
        """Deactivates a user account."""
        user = await UserService.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        user.is_active = False
        await db.commit()
        await db.refresh(user)
        return user
