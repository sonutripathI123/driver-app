import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.customer import Customer
    from app.models.invoice import Invoice


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PaymentTransaction(Base):
    """
    Financial ledger recording every payment, deposit, balance settlement, and refund.
    Guarantees ONE BOOKING -> ONE RECORD -> ONE SOURCE OF TRUTH.
    """
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    booking_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    customer_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    invoice_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    stripe_session_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True
    )
    stripe_payment_intent_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True
    )
    stripe_charge_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    amount: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        default="AUD",
        nullable=False
    )
    payment_type: Mapped[str] = mapped_column(
        String(50),
        default="DEPOSIT",
        nullable=False  # "DEPOSIT", "FULL", "BALANCE", "MANUAL", "REFUND"
    )
    payment_method: Mapped[str] = mapped_column(
        String(50),
        default="STRIPE_CHECKOUT",
        nullable=False  # "STRIPE_CHECKOUT", "CREDIT_CARD", "BANK_TRANSFER", "CASH"
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False  # "PENDING", "COMPLETED", "FAILED", "REFUNDED"
    )
    receipt_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    reference_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    extra_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
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

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="payments")
    customer: Mapped[Optional["Customer"]] = relationship("Customer")
    invoice: Mapped[Optional["Invoice"]] = relationship("Invoice", back_populates="payments")
