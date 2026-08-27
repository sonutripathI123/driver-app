from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.enums import PayoutBatchStatus


class PartnerBase(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    contact_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    phone: str = Field(..., min_length=6, max_length=50)
    abn: Optional[str] = Field(None, max_length=50)
    commission_rate: float = Field(15.0, ge=0.0, le=100.0)
    city: Optional[str] = "Melbourne"
    is_active: bool = True
    insurance_policy_number: Optional[str] = None
    insurance_expiry: Optional[datetime] = None
    accreditation_number: Optional[str] = None
    accreditation_expiry: Optional[datetime] = None
    is_compliance_verified: bool = True
    notes: Optional[str] = None


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    company_name: Optional[str] = Field(None, min_length=2, max_length=255)
    contact_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=6, max_length=50)
    abn: Optional[str] = None
    commission_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    city: Optional[str] = None
    is_active: Optional[bool] = None
    insurance_policy_number: Optional[str] = None
    insurance_expiry: Optional[datetime] = None
    accreditation_number: Optional[str] = None
    accreditation_expiry: Optional[datetime] = None
    is_compliance_verified: Optional[bool] = None
    notes: Optional[str] = None


class PartnerRead(PartnerBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class PartnerComplianceCheckResponse(BaseModel):
    partner_id: str
    company_name: str
    is_compliant: bool
    insurance_valid: bool
    insurance_expiry: Optional[datetime] = None
    accreditation_valid: bool
    accreditation_expiry: Optional[datetime] = None
    is_active: bool
    reasons: List[str] = []


class PartnerJobOfferCreate(BaseModel):
    leg_id: str = Field(..., description="Booking leg ID to offload")
    partner_id: str = Field(..., description="Target partner ID")
    offered_payout: float = Field(..., gt=0.0, description="Agreed subcontractor payout fare")
    expiry_minutes: int = Field(15, ge=1, le=1440, description="Time window for partner acceptance (default 15 mins)")
    notes: Optional[str] = None


class PartnerJobOfferRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    leg_id: str
    partner_id: str
    offered_payout: float
    status: str
    expires_at: datetime
    responded_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime


class PartnerPayoutBatchCreate(BaseModel):
    partner_id: str = Field(..., description="Partner ID")
    period_start: datetime
    period_end: datetime
    notes: Optional[str] = None


class PartnerPayoutBatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    batch_number: str
    partner_id: str
    status: PayoutBatchStatus
    period_start: datetime
    period_end: datetime
    total_legs_count: int
    gross_payout_amount: float
    gst_amount: float
    net_disbursed_amount: float
    rcti_reference: Optional[str] = None
    notes: Optional[str] = None
    disbursed_at: Optional[datetime] = None
    created_at: datetime
