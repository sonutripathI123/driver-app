"""
Reversible encryption for secrets that must be read back and used, not merely
verified — specifically the IMAP/SMTP passwords of the mailboxes the operator
connects. Login passwords are still one-way hashed (see security.py); this is
only for credentials the server has to replay to a third-party mail server.

The key comes from MAILBOX_ENCRYPTION_KEY when set (a urlsafe base64 Fernet
key), otherwise it is derived deterministically from JWT_SECRET_KEY so the
feature works without extra setup. Either way the key lives in the environment,
never in the database, so a database dump alone does not reveal the passwords.
"""
import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    configured = (getattr(settings, "MAILBOX_ENCRYPTION_KEY", "") or "").strip()
    if configured:
        # Must be a valid 32-byte urlsafe-base64 Fernet key.
        return Fernet(configured.encode())
    # Derive a stable Fernet key from the JWT secret. Note: rotating
    # JWT_SECRET_KEY makes existing encrypted mailbox passwords unreadable, and
    # the operator would re-enter them — set MAILBOX_ENCRYPTION_KEY explicitly
    # to decouple the two.
    digest = hashlib.sha256(settings.JWT_SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret for storage. Returns a token string."""
    return _fernet().encrypt((plaintext or "").encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    """
    Decrypt a stored secret. Returns "" if the token is empty or cannot be
    decrypted (e.g. the key changed), so a bad row never crashes a poll.
    """
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""
