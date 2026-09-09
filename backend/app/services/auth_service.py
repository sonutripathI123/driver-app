from datetime import datetime, timezone
import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate, UserRead


class AuthService:
    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        email: str,
        password: str
    ) -> User:
        """Authenticates a user with email and password."""
        normalized_email = email.strip().lower()
        stmt = select(User).where(User.email == normalized_email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated"
            )

        # Update last login timestamp
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def register_user(
        db: AsyncSession,
        user_in: UserCreate,
        allowed_role: UserRole = UserRole.CUSTOMER
    ) -> User:
        """Registers a new user."""
        normalized_email = user_in.email.strip().lower()
        stmt = select(User).where(User.email == normalized_email)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email already exists."
            )

        new_user = User(
            email=normalized_email,
            hashed_password=hash_password(user_in.password),
            full_name=user_in.full_name.strip(),
            phone=user_in.phone.strip() if user_in.phone else None,
            role=allowed_role,
            is_active=True,
            is_verified=False
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

    @staticmethod
    def create_tokens_for_user(user: User) -> TokenResponse:
        """Generates access and refresh tokens for user."""
        access_token = create_access_token(
            subject=user.id,
            role=user.role.value,
            email=user.email
        )
        refresh_token = create_refresh_token(
            subject=user.id,
            role=user.role.value,
            email=user.email
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserRead.model_validate(user)
        )

    @staticmethod
    async def refresh_tokens(
        db: AsyncSession,
        refresh_token: str
    ) -> TokenResponse:
        """Refreshes tokens using a valid refresh token."""
        try:
            payload = decode_token(refresh_token)
            user_id = payload.get("sub")
            token_type = payload.get("type")

            if not user_id or token_type != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired"
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate refresh token"
            )

        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )

        return AuthService.create_tokens_for_user(user)

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user: User,
        current_password: str,
        new_password: str
    ) -> User:
        """Changes password for an authenticated user."""
        if not verify_password(current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password verification failed"
            )

        user.hashed_password = hash_password(new_password)
        await db.commit()
        await db.refresh(user)
        return user

    # The password that shipped as the committed default. A deploy that never
    # set DEFAULT_ADMIN_PASSWORD was reachable by anyone who read the repo, so
    # this exact value is refused as a seed password and rotated away from.
    _WEAK_SEED_PASSWORD = "AdminSecurePassword123!"

    @staticmethod
    async def seed_default_admin(db: AsyncSession) -> User | None:
        """
        Ensure a usable administrator exists, without ever leaving one behind
        that has a password published in source control.

        - No DEFAULT_ADMIN_PASSWORD set, or the known-weak committed value:
          nothing is seeded, and a warning is logged. The platform still has
          any real admin accounts that were created normally.
        - A strong DEFAULT_ADMIN_PASSWORD set: the seed admin is created with
          it, or — if the account already exists with a different (e.g. the
          old weak) password — rotated to it on this boot. That gives a
          one-step remediation: set the env var, redeploy.
        """
        import logging

        logger = logging.getLogger("uvicorn.error")
        normalized_email = settings.DEFAULT_ADMIN_EMAIL.strip().lower()
        configured = (settings.DEFAULT_ADMIN_PASSWORD or "").strip()

        stmt = select(User).where(User.email == normalized_email)
        result = await db.execute(stmt)
        admin = result.scalar_one_or_none()

        if not configured or configured == AuthService._WEAK_SEED_PASSWORD:
            if admin and verify_password(AuthService._WEAK_SEED_PASSWORD, admin.hashed_password):
                logger.warning(
                    "[SECURITY] The seed admin %s still has the password committed to the "
                    "repository. Set a strong DEFAULT_ADMIN_PASSWORD and redeploy to rotate it, "
                    "or delete the account.",
                    normalized_email,
                )
            elif not admin:
                logger.warning(
                    "[Startup] No DEFAULT_ADMIN_PASSWORD set; skipping seed admin. "
                    "Create an administrator explicitly."
                )
            return admin

        if not admin:
            admin = User(
                email=normalized_email,
                hashed_password=hash_password(configured),
                full_name=settings.DEFAULT_ADMIN_NAME,
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
            logger.info("[Startup] Seeded administrator %s.", normalized_email)
            return admin

        # Account exists: rotate it onto the configured password if it is not
        # already there. This is what clears the exposed weak credential.
        if not verify_password(configured, admin.hashed_password):
            admin.hashed_password = hash_password(configured)
            await db.commit()
            await db.refresh(admin)
            logger.warning("[SECURITY] Rotated the seed admin %s onto the configured password.", normalized_email)
        return admin
