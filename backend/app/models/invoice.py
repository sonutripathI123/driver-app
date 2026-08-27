import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import InvoiceStatus

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.customer import Customer
    from app.models.payment import PaymentTransaction


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Invoice(Base):
    """
    Official Tax Invoice.
    Enforces Australian GST (10%) compliance, unique sequential sequence (INV-YYYY-XXXX),
    and balance tracking.
    """
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    invoice_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    booking_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    customer_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        SQLEnum(InvoiceStatus, name="invoice_status_enum", native_enum=False),
        default=InvoiceStatus.ISSUED,
        nullable=False,
        index=True
    )
    issue_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    subtotal_ex_gst: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    gst_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    total_inc_gst: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    amount_paid: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    balance_due: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(10),
        default="AUD",
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    pdf_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
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
    booking: Mapped[Optional["Booking"]] = relationship(
        "Booking",
        lazy="selectin"
    )
    customer: Mapped["Customer"] = relationship(
        "Customer",
        lazy="selectin"
    )
    line_items: Mapped[List["InvoiceLineItem"]] = relationship(
        "InvoiceLineItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    payments: Mapped[List["PaymentTransaction"]] = relationship(
        "PaymentTransaction",
        back_populates="invoice",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Invoice(number={self.invoice_number}, total=${self.total_inc_gst}, status={self.status})>"


class InvoiceLineItem(Base):
    """
    Detailed Line Item breakdown within an Official Tax Invoice.
    """
    __tablename__ = "invoice_line_items"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    invoice_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )
    unit_price_ex_gst: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    gst_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    total_inc_gst: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )

    # Relationships
    invoice: Mapped["Invoice"] = relationship(
        "Invoice",
        back_populates="line_items"
    )
