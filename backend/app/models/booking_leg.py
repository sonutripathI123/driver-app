import uuid
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.enums import LegStatus, VehicleCategory

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.driver import Driver
    from app.models.partner import Partner
    from app.models.vehicle import Vehicle


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class BookingLeg(Base):
    """
    Individual Journey Leg belonging to a Master Booking.
    Supports single journeys, return journeys, and multi-stop itineraries.
    Every leg has independent allocation, dispatching, and operational statuses while remaining
    bound to the parent Master Booking.
    """
    __tablename__ = "booking_legs"

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
    leg_number: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )
    status: Mapped[LegStatus] = mapped_column(
        SQLEnum(LegStatus, name="leg_status_enum", native_enum=False),
        default=LegStatus.PENDING,
        nullable=False,
        index=True
    )
    pickup_address: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    pickup_lat: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    pickup_lng: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    dropoff_address: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    dropoff_lat: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    dropoff_lng: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    pickup_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
    distance_km: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    duration_minutes: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    vehicle_category: Mapped[VehicleCategory] = mapped_column(
        SQLEnum(VehicleCategory, name="leg_vehicle_category_enum", native_enum=False),
        default=VehicleCategory.SEDAN_PREMIUM,
        nullable=False
    )
    driver_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("drivers.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    vehicle_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    partner_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("partners.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    partner_payout_amount: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    partner_reference: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    # ALLOCATION COST: Driver payout base (Strictly separated from customer fare)
    allocation_cost: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    settled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    settlement_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    is_airport_pickup: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    airline: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    flight_number: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    flight_scheduled_arrival: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    flight_actual_arrival: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    flight_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    flight_terminal: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    flight_delay_minutes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    wait_time_minutes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    wait_time_charge: Mapped[float] = mapped_column(
        Float,
        default=0.0,
        nullable=False
    )
    pickup_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Operational Lifecycle Timestamps
    allocated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    dispatched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    en_route_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    arrived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    picked_up_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
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
    booking: Mapped["Booking"] = relationship(
        "Booking",
        back_populates="legs"
    )
    driver: Mapped[Optional["Driver"]] = relationship(
        "Driver",
        back_populates="legs",
        lazy="selectin"
    )
    vehicle: Mapped[Optional["Vehicle"]] = relationship(
        "Vehicle",
        back_populates="legs",
        lazy="selectin"
    )
    partner: Mapped[Optional["Partner"]] = relationship(
        "Partner",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<BookingLeg(id={self.id}, leg_num={self.leg_number}, status={self.status}, pickup={self.pickup_datetime})>"
