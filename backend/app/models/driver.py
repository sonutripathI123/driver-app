import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import DriverStatus

if TYPE_CHECKING:
    from app.models.booking_leg import BookingLeg
    from app.models.user import User
    from app.models.vehicle import Vehicle


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Driver(Base):
    """
    Chauffeur Driver Profile.
    Tracks licenses, status, earnings allocations, and assigned legs.
    """
    __tablename__ = "drivers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
        index=True
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    phone: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True
    )
    license_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )
    license_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    accreditation_number: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    status: Mapped[DriverStatus] = mapped_column(
        SQLEnum(DriverStatus, name="driver_status_enum", native_enum=False),
        default=DriverStatus.AVAILABLE,
        nullable=False,
        index=True
    )
    rating: Mapped[float] = mapped_column(
        Float,
        default=5.0,
        nullable=False
    )
    default_vehicle_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("vehicles.id", ondelete="SET NULL"),
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
    # GPS Location and Metrics
    current_lat: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    current_lng: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    location_updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_trips_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
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
    default_vehicle: Mapped[Optional["Vehicle"]] = relationship(
        "Vehicle",
        foreign_keys=[default_vehicle_id],
        lazy="selectin"
    )
    legs: Mapped[List["BookingLeg"]] = relationship(
        "BookingLeg",
        back_populates="driver"
    )

    def __repr__(self) -> str:
        return f"<Driver(id={self.id}, name={self.full_name}, status={self.status})>"
