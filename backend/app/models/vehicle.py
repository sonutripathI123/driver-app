import uuid
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import VehicleCategory

if TYPE_CHECKING:
    from app.models.booking_leg import BookingLeg
    from app.models.driver import Driver


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Vehicle(Base):
    """
    Fleet Vehicle Record.
    """
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    category: Mapped[VehicleCategory] = mapped_column(
        SQLEnum(VehicleCategory, name="vehicle_category_enum", native_enum=False),
        nullable=False,
        index=True
    )
    make: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    color: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    registration_plate: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True
    )
    passenger_capacity: Mapped[int] = mapped_column(
        Integer,
        default=4,
        nullable=False
    )
    luggage_capacity: Mapped[int] = mapped_column(
        Integer,
        default=2,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    insurance_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    rego_expiry: Mapped[Optional[datetime]] = mapped_column(
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
    legs: Mapped[List["BookingLeg"]] = relationship(
        "BookingLeg",
        back_populates="vehicle"
    )

    def __repr__(self) -> str:
        return f"<Vehicle(id={self.id}, rego={self.registration_plate}, model={self.make} {self.model})>"
