from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import BookingStatus, LegStatus, VehicleCategory


class AllocateDriverRequest(BaseModel):
    driver_id: str = Field(..., description="Assigned chauffeur driver ID")
    vehicle_id: str = Field(..., description="Assigned fleet vehicle ID")
    allocation_cost: float = Field(..., ge=0.0, description="Driver payout amount for this leg")
    notes: Optional[str] = None


class OffloadPartnerRequest(BaseModel):
    partner_id: str = Field(..., description="Affiliate partner ID")
    partner_payout_amount: float = Field(..., ge=0.0, description="Agreed payout cost to partner")
    partner_reference: Optional[str] = Field(None, description="Partner confirmation/job reference number")
    notes: Optional[str] = None


class SettleLegRequest(BaseModel):
    allocation_cost: Optional[float] = Field(None, ge=0.0, description="Final adjusted payout amount")
    settlement_notes: Optional[str] = None


class OperateBoardLegItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: str
    booking_number: str
    leg_number: int
    status: LegStatus
    booking_status: BookingStatus
    pickup_datetime: datetime
    pickup_address: str
    dropoff_address: str
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None
    vehicle_category: VehicleCategory
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    customer_name: Optional[str] = None
    flight_number: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_name: Optional[str] = None
    partner_id: Optional[str] = None
    partner_name: Optional[str] = None
    allocation_cost: float
    partner_payout_amount: float
    customer_fare_share: float
    net_margin: float
    settled_at: Optional[datetime] = None


class OperateBoardSummary(BaseModel):
    total_legs: int
    pending_unallocated: int
    allocated: int
    dispatched: int
    en_route: int
    arrived: int
    picked_up: int
    completed: int
    partner_offloaded: int


class OperateBoardResponse(BaseModel):
    target_date: Optional[str] = None
    summary: OperateBoardSummary
    legs: List[OperateBoardLegItem]


class DriverAvailabilityResponse(BaseModel):
    driver_id: str
    driver_name: str
    status: str
    rating: float
    is_available: bool
    conflict_reason: Optional[str] = None
    assigned_vehicle_id: Optional[str] = None
    assigned_vehicle_plate: Optional[str] = None
