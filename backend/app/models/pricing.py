import uuid
from datetime import datetime, time, timezone
from typing import Any, Dict, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.enums import VehicleCategory


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PricingRule(Base):
    """
    Configurable vehicle class pricing parameters.
    """
    __tablename__ = "pricing_rules"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    vehicle_category: Mapped[VehicleCategory] = mapped_column(
        SQLEnum(VehicleCategory, name="pricing_vehicle_category_enum", native_enum=False),
        unique=True,
        nullable=False,
        index=True
    )
    base_fee: Mapped[float] = mapped_column(
        Float,
        default=50.0,
        nullable=False
    )
    minimum_fare: Mapped[float] = mapped_column(
        Float,
        default=75.0,
        nullable=False
    )
    per_km_tier1: Mapped[float] = mapped_column(
        Float,
        default=3.50,
        nullable=False
    )
    tier1_threshold_km: Mapped[float] = mapped_column(
        Float,
        default=25.0,
        nullable=False
    )
    per_km_tier2: Mapped[float] = mapped_column(
        Float,
        default=3.00,
        nullable=False
    )
    per_minute_rate: Mapped[float] = mapped_column(
        Float,
        default=0.80,
        nullable=False
    )
    airport_access_fee: Mapped[float] = mapped_column(
        Float,
        default=25.0,
        nullable=False
    )
    deadhead_rate_per_km: Mapped[float] = mapped_column(
        Float,
        default=2.00,
        nullable=False
    )
    deadhead_threshold_km: Mapped[float] = mapped_column(
        Float,
        default=50.0,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
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


class AirportRouteRule(Base):
    """
    Fixed/All-Inclusive Route Rules (e.g. Melbourne Airport <-> Melbourne CBD).
    Ensures tolls are included in all-inclusive fares and not double-charged.
    """
    __tablename__ = "airport_route_rules"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    route_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    origin_keyword: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )
    destination_keyword: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )
    vehicle_category: Mapped[VehicleCategory] = mapped_column(
        SQLEnum(VehicleCategory, name="route_vehicle_category_enum", native_enum=False),
        nullable=False
    )
    all_inclusive_fare: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    tolls_included: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    airport_fee_included: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )


class SurchargeRule(Base):
    """
    Event windows, late-night, and holiday uplifts.
    """
    __tablename__ = "surcharge_rules"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    surcharge_type: Mapped[str] = mapped_column(
        String(20),  # "PERCENTAGE" or "FIXED"
        default="PERCENTAGE",
        nullable=False
    )
    amount: Mapped[float] = mapped_column(
        Float,
        nullable=False  # e.g. 20.0 for 20%, or 50.0 for $50 fixed
    )
    # Time of day window (e.g. 23:00 to 05:00 for late night)
    start_time: Mapped[Optional[time]] = mapped_column(
        Time,
        nullable=True
    )
    end_time: Mapped[Optional[time]] = mapped_column(
        Time,
        nullable=True
    )
    # Calendar date window (e.g. New Year's Eve / Grand Prix)
    start_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )


class Quote(Base):
    """
    Saved quote records for instant quotes and enquiry conversions.
    """
    __tablename__ = "quotes"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True
    )
    quote_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    customer_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True
    )
    pickup_address: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    dropoff_address: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    pickup_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    distance_km: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    quote_options: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False  # Stores vehicle category options and pricing breakdowns
    )
    is_all_inclusive: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )
