from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import VehicleCategory


class VehicleBase(BaseModel):
    category: VehicleCategory = VehicleCategory.SEDAN_PREMIUM
    make: str = Field(..., min_length=2, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    year: int = Field(..., ge=2015, le=2030)
    color: Optional[str] = Field(None, max_length=50)
    registration_plate: str = Field(..., min_length=2, max_length=20)
    passenger_capacity: int = Field(4, ge=1, le=60)
    luggage_capacity: int = Field(2, ge=0, le=60)
    is_active: bool = True
    insurance_expiry: Optional[datetime] = None
    rego_expiry: Optional[datetime] = None


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    category: Optional[VehicleCategory] = None
    make: Optional[str] = Field(None, min_length=2, max_length=100)
    model: Optional[str] = Field(None, min_length=1, max_length=100)
    year: Optional[int] = Field(None, ge=2015, le=2030)
    color: Optional[str] = Field(None, max_length=50)
    registration_plate: Optional[str] = Field(None, min_length=2, max_length=20)
    passenger_capacity: Optional[int] = Field(None, ge=1, le=60)
    luggage_capacity: Optional[int] = Field(None, ge=0, le=60)
    is_active: Optional[bool] = None
    insurance_expiry: Optional[datetime] = None
    rego_expiry: Optional[datetime] = None


class VehicleRead(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
