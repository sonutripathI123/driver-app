import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import (
    BookingSource,
    BookingStatus,
    PaymentStatus,
    VerificationStatus,
)

if TYPE_CHECKING:
    from app.models.audit import AuditLog
    from app.models.booking_leg import BookingLeg
    from app.models.customer import Customer
    from app.models.notification import Notification
    from app.models.payment import PaymentTransaction
    from app.models.user import User


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Booking(Base):
    """
    CENTRAL MASTER BOOKING RECORD.
    ONE BOOKING -> ONE RECORD -> ONE SOURCE OF TRUTH.
    Every leg, payment, allocation, notification, flight check, invoice, and payout links to this record.
    """
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    booking_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    source: Mapped[BookingSource] = mapped_column(
        SQLEnum(BookingSource, name="booking_source_enum", native_enum=False),
        default=BookingSource.WEBSITE,
        nullable=False,
        index=True
    )
    status: Mapped[BookingStatus] = mapped_column(
        SQLEnum(BookingStatus, name="booking_status_enum", native_enum=False),
        default=BookingStatus.DRAFT,
        nullable=False,
        index=True
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus, name="payment_status_enum", native_enum=False),
        default=PaymentStatus.UNPAID,
        nullable=False,
        index=True
    )
    verification_status: Mapped[VerificationStatus] = mapped_column(
        SQLEnum(VerificationStatus, name="verification_status_enum", native_enum=False),
        default=VerificationStatus.NOT_REQUIRED,
        nullable=False,
        index=True
    )
    fare_type: Mapped[str] = mapped_column(
        String(50),
        default="STANDARD",
        nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        default="AUD",
        nullable=False
    )
    total_fare: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    deposit_required: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    deposit_percentage: Mapped[float] = mapped_column(
        Float,
        default=100.0,
        nullable=False
    )
    paid_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    balance_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    pricing_breakdown: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )
    flight_tracking_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    passenger_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    passenger_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    passenger_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    passenger_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )
    luggage_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )
    special_instructions: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    internal_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    created_by_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
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
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    balance_reminders_sent: Mapped[Optional[List[str]]] = mapped_column(
        JSON,
        default=list,
        nullable=True
    )
    driver_handover_sent: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    customer_reminder_12_24h_sent: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    # Relationships
    customer: Mapped["Customer"] = relationship(
        "Customer",
        back_populates="bookings",
        lazy="selectin"
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_id],
        lazy="selectin"
    )
    legs: Mapped[List["BookingLeg"]] = relationship(
        "BookingLeg",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingLeg.leg_number",
        lazy="selectin"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="AuditLog.created_at.desc()",
        lazy="selectin"
    )
    payments: Mapped[List["PaymentTransaction"]] = relationship(
        "PaymentTransaction",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="PaymentTransaction.created_at.desc()",
        lazy="selectin"
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="Notification.created_at.desc()",
        lazy="selectin"
    )

    def calculate_balance(self) -> float:
        """Calculates and updates remaining balance."""
        self.balance_amount = max(0.0, round(self.total_fare - self.paid_amount, 2))
        return self.balance_amount

    def __repr__(self) -> str:
        return f"<Booking(id={self.id}, number={self.booking_number}, status={self.status}, total={self.total_fare})>"

