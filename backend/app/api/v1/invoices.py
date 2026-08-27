from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import get_current_active_user, require_accountant, require_staff
from app.models.enums import InvoiceStatus
from app.models.user import User
from app.schemas.accounting import (
    FIFOPaymentAllocationRequest,
    FIFOPaymentAllocationResponse,
    InvoiceListResponse,
    InvoiceRead,
)
from app.services.accounting_service import AccountingService

router = APIRouter(prefix="/invoices", tags=["Invoicing & Tax (GST)"])


@router.post("/generate-from-booking/{booking_id}", response_model=InvoiceRead, dependencies=[Depends(require_staff)])
async def generate_invoice_for_booking(
    booking_id: str,
    due_days: int = Query(14, ge=0, le=90),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate an official Australian Tax Invoice (INV-YYYY-XXXX) for a master booking.
    Calculates 1/11th GST breakdown and itemizes journey legs.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER, ACCOUNTANT)
    """
    return await AccountingService.generate_invoice_for_booking(
        db=db, booking_id=booking_id, due_days=due_days, actor=current_user
    )


@router.get("/", response_model=InvoiceListResponse, dependencies=[Depends(require_staff)])
async def list_tax_invoices(
    status_filter: Optional[InvoiceStatus] = Query(None, alias="status"),
    customer_id: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    List tax invoices with debt filtering and total outstanding balance.
    Access: Staff
    """
    return await AccountingService.list_invoices(
        db=db,
        status_filter=status_filter,
        customer_id=customer_id,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit
    )


@router.get("/{invoice_id}", response_model=InvoiceRead, dependencies=[Depends(require_staff)])
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed tax invoice with line items and linked payment ledger transactions.
    Access: Staff
    """
    return await AccountingService.get_invoice_by_id(db=db, invoice_id=invoice_id)


@router.post("/{invoice_id}/void", response_model=InvoiceRead, dependencies=[Depends(require_accountant)])
async def void_invoice(
    invoice_id: str,
    reason: str = Query(..., min_length=3),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Void an issued tax invoice.
    Access: Accountant / Admin only
    """
    return await AccountingService.void_invoice(db=db, invoice_id=invoice_id, reason=reason, actor=current_user)


@router.post("/fifo-payment-allocation", response_model=FIFOPaymentAllocationResponse, dependencies=[Depends(require_accountant)])
async def allocate_fifo_payment(
    payload: FIFOPaymentAllocationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    OLDEST-INVOICE-FIRST (FIFO) Debt Allocation Engine:
    Allocates a lump sum remittance sequentially from the oldest unpaid invoice balance.
    Access: Accountant / Admin only
    """
    return await AccountingService.allocate_fifo_payment(db=db, req=payload, actor=current_user)
