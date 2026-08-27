from datetime import datetime, time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.enums import VehicleCategory


class PricingRuleBase(BaseModel):
    vehicle_category: VehicleCategory
    base_fee: float = Field(..., ge=0.0)
    minimum_fare: float = Field(..., ge=0.0)
    per_km_tier1: float = Field(..., ge=0.0)
    tier1_threshold_km: float = Field(25.0, ge=1.0)
    per_km_tier2: float = Field(..., ge=0.0)
    per_minute_rate: float = Field(0.80, ge=0.0)
    airport_access_fee: float = Field(25.0, ge=0.0)
    deadhead_rate_per_km: float = Field(2.00, ge=0.0)
    deadhead_threshold_km: float = Field(50.0, ge=0.0)
    is_active: bool = True


class PricingRuleCreate(PricingRuleBase):
    pass


class PricingRuleUpdate(BaseModel):
    base_fee: Optional[float] = Field(None, ge=0.0)
    minimum_fare: Optional[float] = Field(None, ge=0.0)
    per_km_tier1: Optional[float] = Field(None, ge=0.0)
    tier1_threshold_km: Optional[float] = Field(None, ge=1.0)
    per_km_tier2: Optional[float] = Field(None, ge=0.0)
    per_minute_rate: Optional[float] = Field(None, ge=0.0)
    airport_access_fee: Optional[float] = Field(None, ge=0.0)
    deadhead_rate_per_km: Optional[float] = Field(None, ge=0.0)
    deadhead_threshold_km: Optional[float] = Field(None, ge=0.0)
    is_active: Optional[bool] = None


class PricingRuleRead(PricingRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class AirportRouteRuleBase(BaseModel):
    route_name: str
    origin_keyword: str
    destination_keyword: str
    vehicle_category: VehicleCategory
    all_inclusive_fare: float = Field(..., ge=0.0)
    tolls_included: bool = True
    airport_fee_included: bool = True
    is_active: bool = True


class AirportRouteRuleCreate(AirportRouteRuleBase):
    pass


class AirportRouteRuleRead(AirportRouteRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class SurchargeRuleBase(BaseModel):
    name: str
    surcharge_type: str = "PERCENTAGE"  # "PERCENTAGE" or "FIXED"
    amount: float = Field(..., ge=0.0)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool = True


class SurchargeRuleCreate(SurchargeRuleBase):
    pass


class SurchargeRuleRead(SurchargeRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class QuoteRequest(BaseModel):
    pickup_address: str = Field(..., min_length=3)
    dropoff_address: str = Field(..., min_length=3)
    pickup_datetime: datetime
    passenger_count: int = Field(1, ge=1, le=100)
    luggage_count: int = Field(1, ge=0, le=100)
    is_return: bool = False
    return_datetime: Optional[datetime] = None
    flight_number: Optional[str] = None
    airline: Optional[str] = None


class QuoteOption(BaseModel):
    vehicle_category: VehicleCategory
    vehicle_name: str
    passenger_capacity: int
    luggage_capacity: int
    total_fare: float
    deposit_required: float
    deposit_percentage: float
    pricing_breakdown: Dict[str, Any]
    eligibility: str  # "INSTANT_BOOKING" or "ENQUIRY_REQUIRED"
    requires_verification: bool
    allocation_cost_estimate: float


class QuoteResponse(BaseModel):
    quote_id: str
    quote_number: str
    pickup_address: str
    dropoff_address: str
    pickup_datetime: datetime
    distance_km: float
    duration_minutes: int
    is_all_inclusive: bool
    options: List[QuoteOption]
    expires_at: datetime


class QuoteAcceptRequest(BaseModel):
    vehicle_category: VehicleCategory
    customer_name: str = Field(..., min_length=2)
    customer_email: EmailStr
    customer_phone: str = Field(..., min_length=6)
    company_name: Optional[str] = None
    passenger_name: Optional[str] = None
    passenger_phone: Optional[str] = None
    special_instructions: Optional[str] = None
