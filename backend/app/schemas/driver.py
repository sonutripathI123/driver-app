from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.enums import DriverStatus
from app.schemas.vehicle import VehicleRead


class DriverBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., min_length=6, max_length=50)
    email: EmailStr
    license_number: str = Field(..., min_length=3, max_length=50)
    license_expiry: Optional[datetime] = None
    accreditation_number: Optional[str] = Field(None, max_length=50)
    status: DriverStatus = DriverStatus.AVAILABLE
    rating: float = Field(5.0, ge=1.0, le=5.0)
    default_vehicle_id: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class DriverCreate(DriverBase):
    user_id: Optional[str] = None
    create_user_account: bool = True
    password: Optional[str] = Field(None, min_length=8, max_length=128)


class DriverUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, min_length=6, max_length=50)
    email: Optional[EmailStr] = None
    license_number: Optional[str] = Field(None, min_length=3, max_length=50)
    license_expiry: Optional[datetime] = None
    accreditation_number: Optional[str] = Field(None, max_length=50)
    status: Optional[DriverStatus] = None
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    default_vehicle_id: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class DriverStatusUpdate(BaseModel):
    status: DriverStatus


class DriverRead(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
    default_vehicle: Optional[VehicleRead] = None
    created_at: datetime
    updated_at: datetime
