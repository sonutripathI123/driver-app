import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.booking_leg import BookingLeg
    from app.models.partner import Partner


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PartnerJobOffer(Base):
    """
    Automated or manual job offer broadcasted to an Affiliate / Subcontractor Partner
    with time-bounded acceptance window (e.g. 15-minute countdown).
    """
    __tablename__ = "partner_job_offers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    leg_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("booking_legs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    partner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    offered_payout: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
        index=True  # "PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    responded_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    # Relationships
    leg: Mapped["BookingLeg"] = relationship(
        "BookingLeg",
        lazy="selectin"
    )
    partner: Mapped["Partner"] = relationship(
        "Partner",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<PartnerJobOffer(id={self.id}, leg_id={self.leg_id}, partner_id={self.partner_id}, status={self.status})>"
