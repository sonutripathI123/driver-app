from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class TokenPayload(BaseModel):
    sub: str
    role: str
    email: str
    type: str
    iat: int
    exp: int
