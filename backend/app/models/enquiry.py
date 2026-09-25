import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Enquiry(Base):
    """
    A price/quote enquiry submitted through a website form.

    These are NOT bookings: someone is only asking for a price. They must never
    reach the Operate Board or be dispatchable — the team quotes them, and a real
    booking is created separately (by email confirmation / the driver-offer app).
    So a website form submission lands here, not in the bookings table.
    """
    __tablename__ = "enquiries"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True
    )
    # Which website it came from, and a de-duplication key (site reference or a
    # hash of the payload) so a double-fired webhook is not stored twice.
    website: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    dedup_key: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)

    service_type: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_email: Mapped[Optional[str]] = mapped_column(String(320), nullable=True, index=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    pickup_address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dropoff_address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    pickup_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    vehicle_category: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    passenger_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    luggage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_airport_pickup: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flight_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # NEW -> REVIEWED -> QUOTED -> ARCHIVED. Triage only; never dispatchable.
    status: Mapped[str] = mapped_column(String(20), default="NEW", nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<Enquiry(id={self.id}, name={self.customer_name}, status={self.status})>"
