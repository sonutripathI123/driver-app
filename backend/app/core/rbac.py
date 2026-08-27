from typing import Callable, List, Sequence
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models.enums import UserRole
from app.models.user import User

# HTTP Bearer token extractor
security_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Validates JWT token and fetches current user from database.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "access":
            raise credentials_exception
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, Exception):
        raise credentials_exception

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensures user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    return current_user


def require_roles(allowed_roles: Sequence[UserRole]) -> Callable:
    """
    Dependency factory to enforce Role-Based Access Control (RBAC).
    """
    async def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires one of the following roles: {[r.value for r in allowed_roles]}"
            )
        return current_user

    return role_checker


# Predefined Role Guards
require_admin = require_roles([UserRole.ADMIN])

require_ops = require_roles([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER
])

require_dispatcher = require_roles([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.DISPATCHER
])

require_accountant = require_roles([
    UserRole.ADMIN,
    UserRole.ACCOUNTANT
])

require_driver = require_roles([
    UserRole.ADMIN,
    UserRole.DRIVER
])

require_staff = require_roles([
    UserRole.ADMIN,
    UserRole.OPERATIONS_MANAGER,
    UserRole.DISPATCHER,
    UserRole.ACCOUNTANT
])


def verify_self_or_roles(
    target_user_id: str,
    current_user: User,
    allowed_roles: Sequence[UserRole] = (UserRole.ADMIN, UserRole.OPERATIONS_MANAGER)
) -> bool:
    """
    Allows action if current_user is the target user itself OR has privileged role.
    """
    if current_user.id == target_user_id:
        return True
    if current_user.role in allowed_roles:
        return True
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Cannot access or modify another user's resources"
    )
