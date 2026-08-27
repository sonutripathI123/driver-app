from datetime import timedelta
import jwt
import pytest
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hashing():
    raw = "MySuperSecret123!"
    hashed = hash_password(raw)

    assert hashed != raw
    assert hashed.startswith("$2b$")
    assert verify_password(raw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_access_token_lifecycle():
    user_id = "user-uuid-1234"
    role = "ADMIN"
    email = "admin@example.com"

    token = create_access_token(
        subject=user_id,
        role=role,
        email=email,
        expires_delta=timedelta(minutes=15)
    )

    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["role"] == role
    assert payload["email"] == email
    assert payload["type"] == "access"
    assert payload["exp"] > payload["iat"]


def test_refresh_token_lifecycle():
    user_id = "user-uuid-5678"
    role = "DRIVER"
    email = "driver@example.com"

    token = create_refresh_token(
        subject=user_id,
        role=role,
        email=email,
        expires_delta=timedelta(days=7)
    )

    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["role"] == role
    assert payload["email"] == email
    assert payload["type"] == "refresh"


def test_expired_token():
    token = create_access_token(
        subject="expired-user",
        role="CUSTOMER",
        email="expired@test.com",
        expires_delta=timedelta(seconds=-10)
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token)


def test_tampered_token():
    token = create_access_token(
        subject="valid-user",
        role="CUSTOMER",
        email="valid@test.com"
    )

    tampered = token[:-5] + "XXXXX"
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(tampered)
