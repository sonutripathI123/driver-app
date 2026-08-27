import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import PayoutBatchStatus

if TYPE_CHECKING:
    from app.models.driver import Driver


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DriverPayoutBatch(Base):
    """
    Driver Recipient Created Tax Invoice (RCTI) & Payout Batch.
    Aggregates completed & settled journey legs within a payment period.
    """
    __tablename__ = "driver_payout_batches"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    batch_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    driver_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("drivers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    status: Mapped[PayoutBatchStatus] = mapped_column(
        SQLEnum(PayoutBatchStatus, name="payout_batch_status_enum", native_enum=False),
        default=PayoutBatchStatus.DRAFT,
        nullable=False,
        index=True
    )
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    total_legs_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    gross_payout_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    gst_credit_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    withholding_tax_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    net_disbursed_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    rcti_reference: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    disbursed_at: Mapped[Optional[datetime]] = mapped_column(
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
    driver: Mapped["Driver"] = relationship(
        "Driver",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<DriverPayoutBatch(number={self.batch_number}, driver_id={self.driver_id}, net=${self.net_disbursed_amount})>"
