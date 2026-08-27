from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import (
    get_current_active_user,
    require_admin,
    require_ops,
    verify_self_or_roles,
)
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("/", response_model=List[UserRead], dependencies=[Depends(require_ops)])
async def list_all_users(
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search query across name, email, phone"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    List users with filtering.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await UserService.list_users(
        db=db,
        role=role,
        is_active=is_active,
        search=search,
        skip=skip,
        limit=limit
    )


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_user_by_admin(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user with any assigned role (Admin, Ops, Dispatcher, Driver, Accountant).
    Access: ADMIN only
    """
    return await UserService.create_user(
        db=db,
        user_in=user_in
    )


@router.get("/{user_id}", response_model=UserRead)
async def get_user_details(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user profile by ID.
    Access: ADMIN, OPERATIONS_MANAGER, or the user themselves.
    """
    verify_self_or_roles(
        target_user_id=user_id,
        current_user=current_user,
        allowed_roles=[UserRole.ADMIN, UserRole.OPERATIONS_MANAGER]
    )

    user = await UserService.get_by_id(db, user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.patch("/{user_id}", response_model=UserRead, dependencies=[Depends(require_admin)])
async def update_user_by_admin(
    user_id: str,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update user profile, status, and role.
    Access: ADMIN only
    """
    return await UserService.update_user(
        db=db,
        user_id=user_id,
        user_update=user_update
    )


@router.delete("/{user_id}", response_model=UserRead, dependencies=[Depends(require_admin)])
async def deactivate_user_by_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate a user account.
    Access: ADMIN only
    """
    return await UserService.deactivate_user(
        db=db,
        user_id=user_id
    )
