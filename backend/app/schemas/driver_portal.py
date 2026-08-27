from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import DriverStatus, LegStatus, VehicleCategory
from app.schemas.vehicle import VehicleRead


class DriverLocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")


class DriverShiftStatusUpdate(BaseModel):
    status: DriverStatus = Field(..., description="Target driver operational status: AVAILABLE, OFF_DUTY, ON_TRIP")


class DriverJobItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: str
    booking_number: str
    leg_number: int
    status: LegStatus
    pickup_datetime: datetime
    pickup_address: str
    dropoff_address: str
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    vehicle_category: VehicleCategory
    vehicle_plate: Optional[str] = None
    vehicle_name: Optional[str] = None
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    passenger_count: Optional[int] = None
    luggage_count: Optional[int] = None
    flight_number: Optional[str] = None
    pickup_notes: Optional[str] = None
    special_instructions: Optional[str] = None
    allocation_payout: float = Field(..., description="Driver guaranteed payout for this trip leg")
    allocated_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    en_route_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    settled_at: Optional[datetime] = None


class DriverPortalProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    phone: str
    license_number: str
    accreditation_number: Optional[str] = None
    status: DriverStatus
    rating: float
    completed_trips_count: int
    default_vehicle: Optional[VehicleRead] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    location_updated_at: Optional[datetime] = None


class DriverEarningsSummary(BaseModel):
    total_completed_trips: int
    total_earnings: float
    pending_payout_amount: float
    settled_payout_amount: float
    jobs: List[DriverJobItem]
