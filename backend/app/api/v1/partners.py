from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import get_current_active_user, require_accountant, require_dispatcher, require_ops, require_staff
from app.models.partner import Partner
from app.models.partner_offer import PartnerJobOffer
from app.models.partner_payout import PartnerPayoutBatch
from app.models.user import User
from app.schemas.partner import (
    PartnerComplianceCheckResponse,
    PartnerCreate,
    PartnerJobOfferCreate,
    PartnerJobOfferRead,
    PartnerPayoutBatchCreate,
    PartnerPayoutBatchRead,
    PartnerRead,
    PartnerUpdate,
)
from app.services.partner_service import PartnerService

router = APIRouter(prefix="/partners", tags=["Affiliate & Partner Network"])


@router.get("/", response_model=List[PartnerRead], dependencies=[Depends(require_staff)])
async def list_partners(
    is_active: Optional[bool] = Query(None, description="Filter active partners"),
    search: Optional[str] = Query(None, description="Search company, contact, or email"),
    db: AsyncSession = Depends(get_db)
):
    """
    List registered subcontractor / affiliate partners.
    Access: Staff
    """
    stmt = select(Partner)
    if is_active is not None:
        stmt = stmt.where(Partner.is_active == is_active)
    if search:
        pat = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                Partner.company_name.ilike(pat),
                Partner.contact_name.ilike(pat),
                Partner.email.ilike(pat)
            )
        )
    stmt = stmt.order_by(Partner.company_name.asc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/", response_model=PartnerRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_ops)])
async def create_partner(
    payload: PartnerCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new affiliate partner with compliance records.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await PartnerService.create_partner(db, payload)


@router.get("/{partner_id}", response_model=PartnerRead, dependencies=[Depends(require_staff)])
async def get_partner(
    partner_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get affiliate partner details by ID.
    Access: Staff
    """
    partner = await db.get(Partner, partner_id)
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found.")
    return partner


@router.patch("/{partner_id}", response_model=PartnerRead, dependencies=[Depends(require_ops)])
async def update_partner(
    partner_id: str,
    payload: PartnerUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update affiliate partner details and compliance data.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await PartnerService.update_partner(db, partner_id, payload)


@router.get("/{partner_id}/compliance-check", response_model=PartnerComplianceCheckResponse, dependencies=[Depends(require_dispatcher)])
async def check_partner_compliance(
    partner_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify partner insurance policy and commercial accreditation validity.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await PartnerService.check_compliance(db, partner_id)


# --- Partner Job Offers Engine (15-min countdown window) ---

@router.post("/offers", response_model=PartnerJobOfferRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_dispatcher)])
async def broadcast_partner_job_offer(
    payload: PartnerJobOfferCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Broadcast a time-bounded job offer to an affiliate partner.
    Validates margin guard and partner compliance.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER)
    """
    return await PartnerService.broadcast_job_offer(db, payload, actor=current_user)


@router.post("/offers/{offer_id}/accept", response_model=PartnerJobOfferRead)
async def accept_partner_job_offer(
    offer_id: str,
    partner_reference: Optional[str] = Query(None, description="Partner's internal job reference number"),
    db: AsyncSession = Depends(get_db)
):
    """
    Partner accepts a broadcasted job offer before expiry.
    Automatically assigns and offloads the booking leg.
    Access: Partner / Staff
    """
    return await PartnerService.accept_job_offer(db, offer_id, partner_reference=partner_reference)


@router.post("/offers/{offer_id}/decline", response_model=PartnerJobOfferRead)
async def decline_partner_job_offer(
    offer_id: str,
    reason: Optional[str] = Query(None, description="Reason for declining offer"),
    db: AsyncSession = Depends(get_db)
):
    """
    Partner declines the job offer.
    Access: Partner / Staff
    """
    return await PartnerService.decline_job_offer(db, offer_id, reason=reason)


@router.post("/offers/expire-stale", response_model=dict, dependencies=[Depends(require_dispatcher)])
async def expire_stale_job_offers(
    db: AsyncSession = Depends(get_db)
):
    """
    Background job: Mark pending offers past their expiry deadline as EXPIRED.
    Access: Dispatcher / System Cron
    """
    count = await PartnerService.expire_stale_offers(db)
    return {"status": "success", "expired_offers_count": count}


# --- Partner Settlement & RCTI Batches ---

@router.post("/settlements/batches", response_model=PartnerPayoutBatchRead, dependencies=[Depends(require_accountant)])
async def create_partner_settlement_batch(
    payload: PartnerPayoutBatchCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate Subcontractor Partner Settlement RCTI Batch.
    Access: Accountant / Admin only
    """
    return await PartnerService.generate_partner_payout_batch(db, payload, actor=current_user)


@router.get("/settlements/batches", response_model=List[PartnerPayoutBatchRead], dependencies=[Depends(require_accountant)])
async def list_partner_settlement_batches(
    partner_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    List partner settlement RCTI batches.
    Access: Accountant / Admin only
    """
    stmt = select(PartnerPayoutBatch)
    if partner_id:
        stmt = stmt.where(PartnerPayoutBatch.partner_id == partner_id)
    stmt = stmt.order_by(desc(PartnerPayoutBatch.created_at)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())
