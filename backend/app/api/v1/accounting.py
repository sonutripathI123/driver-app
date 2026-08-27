from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import get_current_active_user, require_accountant
from app.models.payout_batch import DriverPayoutBatch
from app.models.user import User
from app.schemas.accounting import (
    DriverPayoutBatchCreate,
    DriverPayoutBatchRead,
    TaxSummaryBASReport,
)
from app.services.accounting_service import AccountingService

router = APIRouter(prefix="/accounting", tags=["Accounting, Payouts & BAS Reports"])


@router.post("/driver-payout-batches", response_model=DriverPayoutBatchRead, dependencies=[Depends(require_accountant)])
async def create_driver_payout_batch(
    payload: DriverPayoutBatchCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate Driver Recipient Created Tax Invoice (RCTI) Payout Batch for settled legs.
    Access: Accountant / Admin only
    """
    return await AccountingService.generate_driver_payout_batch(db=db, req=payload, actor=current_user)


@router.get("/driver-payout-batches", response_model=List[DriverPayoutBatchRead], dependencies=[Depends(require_accountant)])
async def list_driver_payout_batches(
    driver_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    List driver RCTI payout batches.
    Access: Accountant / Admin only
    """
    stmt = select(DriverPayoutBatch)
    if driver_id:
        stmt = stmt.where(DriverPayoutBatch.driver_id == driver_id)
    stmt = stmt.order_by(desc(DriverPayoutBatch.created_at)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.get("/tax-summary", response_model=TaxSummaryBASReport, dependencies=[Depends(require_accountant)])
async def get_bas_tax_summary(
    period_label: str = Query("2026-Q3 (Jul - Sep)", description="Reporting period label"),
    date_from: datetime = Query(..., description="Start of tax reporting window"),
    date_to: datetime = Query(..., description="End of tax reporting window"),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate Australian Business Activity Statement (BAS) Tax Summary report:
    Total Sales (Inc GST), 10% GST Collected, Net Sales (Ex GST), Driver Payouts, Net Margin.
    Access: Accountant / Admin only
    """
    return await AccountingService.get_tax_summary_report(
        db=db, period_label=period_label, date_from=date_from, date_to=date_to
    )
