import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.booking import Booking


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Notification(Base):
    """
    Audit and delivery outbox for all Customer and Operations notifications (Email, SMS, System).
    """
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    booking_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    recipient: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    channel: Mapped[str] = mapped_column(
        String(20),
        default="EMAIL",
        nullable=False  # "EMAIL", "SMS", "IN_APP"
    )
    template_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )
    subject: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="SENT",
        nullable=False  # "SENT", "FAILED", "PENDING"
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    external_message_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        index=True
    )

    # Relationships
    booking: Mapped[Optional["Booking"]] = relationship(
        "Booking",
        back_populates="notifications"
    )

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, channel={self.channel}, recipient={self.recipient}, template={self.template_name})>"
