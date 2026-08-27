import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Partner(Base):
    """
    Subcontractor / Affiliate Partner registry for offloaded jobs in partner networks.
    Tracks compliance documents, insurance policies, and settlement matrices.
    """
    __tablename__ = "partners"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    company_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    contact_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
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
    abn: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    commission_rate: Mapped[float] = mapped_column(
        Float,
        default=15.0,  # e.g. 15% standard affiliate commission
        nullable=False
    )
    city: Mapped[Optional[str]] = mapped_column(
        String(100),
        default="Melbourne",
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    # Compliance & Regulatory Verification
    insurance_policy_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    insurance_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    accreditation_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    accreditation_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    is_compliance_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
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

    def __repr__(self) -> str:
        return f"<Partner(id={self.id}, company={self.company_name}, contact={self.contact_name})>"
