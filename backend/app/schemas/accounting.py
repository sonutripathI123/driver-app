from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.enums import InvoiceStatus, PayoutBatchStatus


class InvoiceLineItemBase(BaseModel):
    description: str = Field(..., min_length=2, max_length=255)
    quantity: int = Field(1, ge=1)
    unit_price_ex_gst: float = Field(..., ge=0.0)
    gst_amount: float = Field(..., ge=0.0)
    total_inc_gst: float = Field(..., ge=0.0)


class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass


class InvoiceLineItemRead(InvoiceLineItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_number: str
    booking_id: Optional[str] = None
    customer_id: str
    status: InvoiceStatus
    issue_date: datetime
    due_date: datetime
    subtotal_ex_gst: float
    gst_amount: float
    total_inc_gst: float
    amount_paid: float
    balance_due: float
    currency: str
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    line_items: List[InvoiceLineItemRead] = []
    created_at: datetime
    updated_at: datetime


class InvoiceListResponse(BaseModel):
    invoices: List[InvoiceRead]
    total_count: int
    total_outstanding_balance: float


class FIFOAllocationItem(BaseModel):
    invoice_id: str
    invoice_number: str
    allocated_amount: float
    previous_balance: float
    new_balance: float
    status: InvoiceStatus


class FIFOPaymentAllocationRequest(BaseModel):
    customer_id: str = Field(..., description="Customer / Corporate Account ID")
    payment_amount: float = Field(..., gt=0.0, description="Total lump-sum payment received")
    payment_method: str = Field("BANK_TRANSFER", description="Payment method: BANK_TRANSFER, CREDIT_CARD, CASH")
    reference_number: Optional[str] = Field(None, description="Bank remittance / transaction reference")
    notes: Optional[str] = None


class FIFOPaymentAllocationResponse(BaseModel):
    customer_id: str
    total_payment_amount: float
    total_allocated: float
    unallocated_credit: float
    allocations: List[FIFOAllocationItem]


class DriverPayoutBatchCreate(BaseModel):
    driver_id: str = Field(..., description="Target driver ID")
    period_start: datetime
    period_end: datetime
    gst_registered: bool = Field(False, description="Whether driver is registered for GST (adds 10% GST to RCTI)")
    notes: Optional[str] = None


class DriverPayoutBatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    batch_number: str
    driver_id: str
    status: PayoutBatchStatus
    period_start: datetime
    period_end: datetime
    total_legs_count: int
    gross_payout_amount: float
    gst_credit_amount: float
    withholding_tax_amount: float
    net_disbursed_amount: float
    rcti_reference: Optional[str] = None
    notes: Optional[str] = None
    disbursed_at: Optional[datetime] = None
    created_at: datetime


class TaxSummaryBASReport(BaseModel):
    period_label: str
    gross_sales_inc_gst: float
    gst_collected_10pct: float
    net_sales_ex_gst: float
    driver_payouts_total: float
    net_operating_margin: float
