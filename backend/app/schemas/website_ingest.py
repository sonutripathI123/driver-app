from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class WebsiteBookingIngest(BaseModel):
    """A booking or quote-request pushed from one of the business websites."""
    website: Optional[str] = Field(None, max_length=120, description="Which site it came from, e.g. opalchauffeurs.com.au")
    external_reference: Optional[str] = Field(None, max_length=120, description="The site's own booking id, used to avoid duplicates")
    is_quote_request: bool = Field(False, description="True = enquiry only (comes in unpaid for the team to quote)")

    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_email: EmailStr
    # Required: the dashboard files every booking against a customer CRM record
    # keyed on name+email+phone, so a website form must collect the phone too.
    customer_phone: str = Field(..., min_length=3, max_length=50)

    pickup_address: str = Field(..., min_length=3, max_length=500)
    dropoff_address: str = Field(..., min_length=3, max_length=500)
    pickup_datetime: datetime
    vehicle_category: str = "SEDAN_PREMIUM"
    passenger_count: int = Field(1, ge=1, le=100)
    luggage_count: int = Field(0, ge=0, le=100)
    is_airport_pickup: bool = False
    flight_number: Optional[str] = None

    total_fare: Optional[float] = Field(None, ge=0.0, description="Fare charged on the site; if omitted the dashboard prices it")
    amount_paid: Optional[float] = Field(None, ge=0.0, description="Amount already paid on the site")
    notes: Optional[str] = Field(None, max_length=2000)


class WebsiteBookingIngestResult(BaseModel):
    status: str
    booking_number: str
    total_fare: float
    duplicate: bool = False
