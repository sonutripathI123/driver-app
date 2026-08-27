from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.models.enums import (
    BookingSource,
    BookingStatus,
    LegStatus,
    PaymentStatus,
    VehicleCategory,
    VerificationStatus,
)
from app.schemas.customer import CustomerRead
from app.schemas.driver import DriverRead
from app.schemas.vehicle import VehicleRead


class BookingLegCreate(BaseModel):
    leg_number: int = Field(1, ge=1)
    pickup_address: str = Field(..., min_length=3, max_length=500)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_address: str = Field(..., min_length=3, max_length=500)
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    pickup_datetime: datetime
    distance_km: Optional[float] = Field(None, ge=0.0)
    duration_minutes: Optional[int] = Field(None, ge=0)
    vehicle_category: VehicleCategory = VehicleCategory.SEDAN_PREMIUM
    allocation_cost: float = Field(0.0, ge=0.0)  # Driver payout base
    is_airport_pickup: bool = False
    airline: Optional[str] = None
    flight_number: Optional[str] = None
    pickup_notes: Optional[str] = None


class BookingLegUpdate(BaseModel):
    pickup_address: Optional[str] = Field(None, min_length=3, max_length=500)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_address: Optional[str] = Field(None, min_length=3, max_length=500)
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    pickup_datetime: Optional[datetime] = None
    distance_km: Optional[float] = Field(None, ge=0.0)
    duration_minutes: Optional[int] = Field(None, ge=0)
    vehicle_category: Optional[VehicleCategory] = None
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    partner_id: Optional[str] = None
    allocation_cost: Optional[float] = Field(None, ge=0.0)
    is_airport_pickup: Optional[bool] = None
    airline: Optional[str] = None
    flight_number: Optional[str] = None
    pickup_notes: Optional[str] = None


class BookingLegRead(BookingLegCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: str
    status: LegStatus
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    partner_id: Optional[str] = None
    driver: Optional[DriverRead] = None
    vehicle: Optional[VehicleRead] = None
    allocated_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    en_route_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BookingCreate(BaseModel):
    # Customer reference or creation details
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    customer_phone: Optional[str] = None
    company_name: Optional[str] = None

    source: BookingSource = BookingSource.WEBSITE
    fare_type: str = "STANDARD"
    currency: str = "AUD"
    total_fare: float = Field(..., ge=0.0)
    deposit_percentage: float = Field(100.0, ge=0.0, le=100.0)
    deposit_required: Optional[float] = Field(None, ge=0.0)
    pricing_breakdown: Optional[Dict[str, Any]] = None
    flight_tracking_enabled: bool = False

    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    passenger_email: Optional[EmailStr] = None
    passenger_count: int = Field(1, ge=1, le=100)
    luggage_count: int = Field(1, ge=0, le=100)
    special_instructions: Optional[str] = None
    internal_notes: Optional[str] = None

    legs: List[BookingLegCreate] = Field(..., min_length=1)

    @field_validator("legs")
    @classmethod
    def validate_legs_order(cls, legs: List[BookingLegCreate]) -> List[BookingLegCreate]:
        for i, leg in enumerate(legs):
            leg.leg_number = i + 1
        return legs


class BookingUpdate(BaseModel):
    source: Optional[BookingSource] = None
    fare_type: Optional[str] = None
    total_fare: Optional[float] = Field(None, ge=0.0)
    deposit_required: Optional[float] = Field(None, ge=0.0)
    deposit_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)
    pricing_breakdown: Optional[Dict[str, Any]] = None
    flight_tracking_enabled: Optional[bool] = None
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    passenger_email: Optional[EmailStr] = None
    passenger_count: Optional[int] = Field(None, ge=1, le=100)
    luggage_count: Optional[int] = Field(None, ge=0, le=100)
    special_instructions: Optional[str] = None
    internal_notes: Optional[str] = None


class BookingStatusTransitionRequest(BaseModel):
    target_status: BookingStatus
    reason: Optional[str] = None


class BookingCancelRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000)


class LegStatusUpdateRequest(BaseModel):
    status: LegStatus


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_number: str
    customer_id: str
    source: BookingSource
    status: BookingStatus
    payment_status: PaymentStatus
    verification_status: VerificationStatus
    fare_type: str
    currency: str
    total_fare: float
    deposit_required: float
    deposit_percentage: float
    paid_amount: float
    balance_amount: float
    pricing_breakdown: Optional[Dict[str, Any]] = None
    flight_tracking_enabled: bool
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    passenger_email: Optional[str] = None
    passenger_count: int
    luggage_count: int
    special_instructions: Optional[str] = None
    internal_notes: Optional[str] = None
    created_by_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    customer: Optional[CustomerRead] = None
    legs: List[BookingLegRead] = []


class BookingListResponse(BaseModel):
    total: int
    page_count: int
    bookings: List[BookingRead]
