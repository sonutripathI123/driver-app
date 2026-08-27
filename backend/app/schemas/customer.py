from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=50)
    company_name: Optional[str] = Field(None, max_length=255)
    is_vip: bool = False
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    user_id: Optional[str] = None


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=6, max_length=50)
    company_name: Optional[str] = Field(None, max_length=255)
    is_vip: Optional[bool] = None
    notes: Optional[str] = None


class CustomerRead(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
    total_bookings: int
    total_spent: float
    created_at: datetime
    updated_at: datetime


class CustomerLookupResponse(BaseModel):
    is_returning: bool
    customer: Optional[CustomerRead] = None
    match_type: Optional[str] = None  # "email", "phone", or "both"
