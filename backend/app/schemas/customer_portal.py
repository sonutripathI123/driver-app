from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class CustomerSetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, description="Setup token from the first-booking link")
    password: str = Field(..., min_length=8, max_length=128)


class CustomerSetPasswordResponse(BaseModel):
    status: str
    email: str
    message: str


class CustomerBookingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_number: str
    status: str
    payment_status: Optional[str] = None
    total_fare: float
    currency: str = "AUD"
    passenger_name: Optional[str] = None
    pickup_datetime: Optional[datetime] = None
    pickup_address: Optional[str] = None
    dropoff_address: Optional[str] = None
    created_at: Optional[datetime] = None


class CustomerQuoteRequest(BaseModel):
    pickup_address: str = Field(..., min_length=3, max_length=500)
    dropoff_address: str = Field(..., min_length=3, max_length=500)
    pickup_datetime: datetime
    vehicle_category: str = "SEDAN_PREMIUM"
    passenger_count: int = Field(1, ge=1, le=50)
    luggage_count: int = Field(0, ge=0, le=50)
    is_airport_pickup: bool = False
    flight_number: Optional[str] = None


class CustomerQuoteResponse(BaseModel):
    total_fare: float
    currency: str = "AUD"
    distance_km: Optional[float] = None
    vehicle_category: str


class CustomerBookResponse(BaseModel):
    booking_number: str
    total_fare: float
    currency: str = "AUD"
    status: str
    message: str


class CustomerPortalProfile(BaseModel):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    is_vip: bool = False
    total_bookings: int = 0
    completed_trips: int = 0
    upcoming_trips: int = 0
    total_spent: float = 0.0
    outstanding_balance: float = 0.0
