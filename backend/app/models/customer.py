import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.user import User


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Customer(Base):
    """
    Central CRM Client Record.
    Every customer has a single client record tracking their booking and payment history.
    """
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    company_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    is_vip: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    total_bookings: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    total_spent: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
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

    # Relationships
    user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[user_id],
        lazy="selectin"
    )
    bookings: Mapped[List["Booking"]] = relationship(
        "Booking",
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="Booking.created_at.desc()"
    )

    def __repr__(self) -> str:
        return f"<Customer(id={self.id}, name={self.full_name}, email={self.email}, phone={self.phone})>"
