from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_ops, require_staff
from app.models.enquiry import Enquiry
from app.schemas.enquiry import EnquiryListResponse, EnquiryRead, EnquiryStatusUpdate

router = APIRouter(prefix="/enquiries", tags=["Website Enquiries"])


@router.get("/", response_model=EnquiryListResponse, dependencies=[Depends(require_staff)])
async def list_enquiries(
    website: Optional[str] = Query(None, description="Filter to one website"),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """
    Website price enquiries, newest first. These are NOT bookings — the team
    quotes them; a real booking is created separately. Access: Staff.
    """
    stmt = select(Enquiry)
    if website:
        stmt = stmt.where(Enquiry.website == website)
    if status_filter:
        stmt = stmt.where(Enquiry.status == status_filter)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (
        await db.execute(stmt.order_by(Enquiry.created_at.desc()).limit(limit))
    ).scalars().all()
    return EnquiryListResponse(total=total, enquiries=list(rows))


@router.patch("/{enquiry_id}", response_model=EnquiryRead, dependencies=[Depends(require_staff)])
async def update_enquiry_status(
    enquiry_id: str, payload: EnquiryStatusUpdate, db: AsyncSession = Depends(get_db)
):
    """Move an enquiry through NEW → REVIEWED → QUOTED → ARCHIVED. Access: Staff."""
    enq = await db.get(Enquiry, enquiry_id)
    if not enq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enquiry not found.")
    enq.status = payload.status
    await db.commit()
    await db.refresh(enq)
    return enq


@router.delete("/{enquiry_id}", status_code=status.HTTP_200_OK, dependencies=[Depends(require_ops)])
async def delete_enquiry(enquiry_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an enquiry. Access: ADMIN, OPS."""
    enq = await db.get(Enquiry, enquiry_id)
    if not enq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enquiry not found.")
    await db.delete(enq)
    await db.commit()
    return {"deleted": enquiry_id}
