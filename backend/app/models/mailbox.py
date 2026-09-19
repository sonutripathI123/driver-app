import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Mailbox(Base):
    """
    A business email account the operator connects for the email-to-booking
    workflow. Each is polled over IMAP for new enquiries and used over SMTP to
    reply, so it stores both, plus the password encrypted at rest (see
    app.core.crypto). The password is never returned by the API.
    """
    __tablename__ = "mailboxes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    email_address: Mapped[str] = mapped_column(String(320), nullable=False, index=True)

    # IMAP (incoming)
    imap_host: Mapped[str] = mapped_column(String(255), nullable=False)
    imap_port: Mapped[int] = mapped_column(Integer, default=993, nullable=False)

    # SMTP (outgoing / replies)
    smtp_host: Mapped[str] = mapped_column(String(255), nullable=False)
    smtp_port: Mapped[int] = mapped_column(Integer, default=587, nullable=False)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Login for both IMAP and SMTP (usually the full email address).
    username: Mapped[str] = mapped_column(String(320), nullable=False)
    # Fernet-encrypted; decrypted only in-process when connecting.
    encrypted_password: Mapped[str] = mapped_column(String(1024), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Highest IMAP UID already ingested, so a poll only fetches newer mail and
    # never re-imports the existing inbox.
    last_uid: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_polled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_poll_error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )
