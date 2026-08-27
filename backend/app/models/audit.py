import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import AuditAction

if TYPE_CHECKING:
    from app.models.booking import Booking


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    """
    Complete Audit Trail for all system events, state changes, price updates, and allocations.
    """
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    booking_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    entity_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )
    action: Mapped[AuditAction] = mapped_column(
        SQLEnum(AuditAction, name="audit_action_enum", native_enum=False),
        nullable=False,
        index=True
    )
    actor_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
        index=True
    )
    actor_role: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    actor_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    old_values: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    new_values: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
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
        back_populates="audit_logs"
    )

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, entity={self.entity_type}:{self.entity_id}, action={self.action})>"
