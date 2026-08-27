from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import get_current_active_user
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticate user and return JWT access and refresh tokens.
    """
    user = await AuthService.authenticate_user(
        db=db,
        email=credentials.email,
        password=credentials.password
    )
    return AuthService.create_tokens_for_user(user)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new customer account and return JWT tokens.
    """
    # Public self-registration always defaults to CUSTOMER role
    user = await AuthService.register_user(
        db=db,
        user_in=user_in,
        allowed_role=UserRole.CUSTOMER
    )
    return AuthService.create_tokens_for_user(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Exchange a valid refresh token for a fresh access and refresh token pair.
    """
    return await AuthService.refresh_tokens(
        db=db,
        refresh_token=payload.refresh_token
    )


@router.get("/me", response_model=UserRead)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get profile information of the currently authenticated user.
    """
    return current_user


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Change password for the currently logged-in user.
    """
    await AuthService.change_password(
        db=db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password
    )
    return {"message": "Password changed successfully."}
