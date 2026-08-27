from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import PaymentStatus


class CreateCheckoutSessionRequest(BaseModel):
    booking_id: str
    payment_type: str = Field("DEPOSIT", description="DEPOSIT, FULL, or BALANCE")
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutSessionResponse(BaseModel):
    session_id: str
    checkout_url: str
    amount: float
    currency: str
    payment_type: str


class ManualPaymentCreate(BaseModel):
    booking_id: str
    amount: float = Field(..., gt=0.0, description="Payment amount in AUD")
    payment_method: str = Field("BANK_TRANSFER", description="BANK_TRANSFER, CASH, CREDIT_CARD")
    payment_type: str = Field("MANUAL", description="DEPOSIT, FULL, BALANCE, MANUAL")
    reference_number: Optional[str] = Field(None, description="External transaction ID or receipt #")
    notes: Optional[str] = None


class RefundRequest(BaseModel):
    amount: Optional[float] = Field(None, gt=0.0, description="Refund amount. If omitted, full paid balance is refunded.")
    reason: str = Field(..., min_length=3, description="Cancellation / refund rationale")


class PaymentTransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: str
    customer_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    stripe_charge_id: Optional[str] = None
    amount: float
    currency: str
    payment_type: str
    payment_method: str
    status: str
    receipt_url: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class PaymentSummaryResponse(BaseModel):
    booking_id: str
    booking_number: str
    total_fare: float
    paid_amount: float
    balance_amount: float
    payment_status: PaymentStatus
    transactions: List[PaymentTransactionRead]
