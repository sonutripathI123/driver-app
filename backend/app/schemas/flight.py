from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class FlightLookupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    flight_number: str
    airline: str
    origin_airport: str
    destination_airport: str
    terminal: Optional[str] = None
    scheduled_arrival: datetime
    estimated_arrival: datetime
    actual_arrival: Optional[datetime] = None
    status: str
    delay_minutes: int


class FlightSyncLegResponse(BaseModel):
    leg_id: str
    booking_id: str
    booking_number: str
    flight_number: str
    airline: Optional[str] = None
    terminal: Optional[str] = None
    flight_status: str
    delay_minutes: int
    old_pickup_datetime: datetime
    new_pickup_datetime: datetime
    schedule_adjusted: bool
    notes: str


class FlightWaitTimeRequest(BaseModel):
    arrived_at: datetime = Field(..., description="Timestamp when chauffeur arrived at pickup location")
    passenger_boarded_at: datetime = Field(..., description="Timestamp when passenger met chauffeur / boarded")
    is_airport_pickup: bool = Field(True, description="True for airport pickup (60 min free), False for standard (15 min free)")
    flight_actual_arrival: Optional[datetime] = Field(None, description="Actual aircraft touchdown timestamp (wheels down)")
    hourly_wait_rate: float = Field(90.0, ge=0.0, description="Chauffeur hourly wait rate in AUD ($1.50/min)")


class FlightWaitTimeResponse(BaseModel):
    is_airport_pickup: bool
    complimentary_minutes: int
    total_wait_minutes: int
    billable_wait_minutes: int
    wait_time_rate_per_min: float
    wait_time_charge: float
