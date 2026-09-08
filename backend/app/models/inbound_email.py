import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InboundEmail(Base):
    """
    A reply that arrived at the business mailbox.

    The Email Hub's inbox tab used to be four threads hardcoded into the
    frontend — invented people at real company domains (riotinto.com, bhp.com)
    — held in the operator's browser storage. Replying to one sent a genuine
    email to an address nobody at this business had ever corresponded with.

    Rows here are written by the inbound webhook, which an email provider
    calls when mail arrives for the configured domain. Nothing is ever
    fabricated: an empty table means no mail has arrived, and the UI says so.
    """
    __tablename__ = "inbound_emails"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )

    # Deduplication key. Providers retry a webhook they think failed, and a
    # duplicated customer reply in the inbox reads as two separate requests.
    provider_message_id: Mapped[Optional[str]] = mapped_column(
        String(512),
        nullable=True,
        index=True
    )
    provider: Mapped[str] = mapped_column(String(50), default="unknown", nullable=False)

    sender_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recipient_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True)

    subject: Mapped[Optional[str]] = mapped_column(String(998), nullable=True)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Resolved from the subject line where a booking number appears in it, so
    # a reply can be read next to the job it is about.
    booking_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    booking_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # UNREAD | READ | ACTION_NEEDED | REPLIED
    status: Mapped[str] = mapped_column(String(30), default="UNREAD", nullable=False, index=True)

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False
    )


Index("ix_inbound_emails_status_received", InboundEmail.status, InboundEmail.received_at)
