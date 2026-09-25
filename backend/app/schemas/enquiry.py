from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class EnquiryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    website: Optional[str] = None
    service_type: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    pickup_address: Optional[str] = None
    dropoff_address: Optional[str] = None
    pickup_datetime: Optional[datetime] = None
    vehicle_category: Optional[str] = None
    passenger_count: int
    luggage_count: int
    is_airport_pickup: bool
    flight_number: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime


class EnquiryStatusUpdate(BaseModel):
    status: Literal["NEW", "REVIEWED", "QUOTED", "ARCHIVED"] = Field(
        ..., description="Triage state for this enquiry"
    )


class EnquiryListResponse(BaseModel):
    total: int
    enquiries: list[EnquiryRead]
