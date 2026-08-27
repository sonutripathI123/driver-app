from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import require_ops, require_staff
from app.models.notification import Notification
from app.schemas.notification import NotificationRead, SendDirectMessageRequest
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications & Outbox"])


@router.get("/", response_model=List[NotificationRead], dependencies=[Depends(require_staff)])
async def list_notifications(
    booking_id: Optional[str] = Query(None, description="Filter by booking ID"),
    recipient: Optional[str] = Query(None, description="Filter by recipient email or phone"),
    channel: Optional[str] = Query(None, description="Filter by channel: EMAIL, SMS"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: SENT, FAILED"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    List transactional and operational notifications with delivery logs.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, DISPATCHER, ACCOUNTANT)
    """
    stmt = select(Notification)
    if booking_id:
        stmt = stmt.where(Notification.booking_id == booking_id)
    if recipient:
        stmt = stmt.where(Notification.recipient.ilike(f"%{recipient.strip()}%"))
    if channel:
        stmt = stmt.where(Notification.channel == channel.upper())
    if status_filter:
        stmt = stmt.where(Notification.status == status_filter.upper())

    stmt = stmt.order_by(desc(Notification.created_at)).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("/send-direct", response_model=NotificationRead, dependencies=[Depends(require_ops)])
async def send_direct_message(
    payload: SendDirectMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatch an ad-hoc custom Email or SMS message to a customer or driver.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    if payload.channel.upper() == "EMAIL":
        if not payload.subject:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subject is required for EMAIL notifications."
            )
        notif = await NotificationService.record_and_dispatch_email(
            db=db,
            recipient=payload.recipient,
            template_name="DIRECT_CUSTOM_EMAIL",
            subject=payload.subject,
            html_content=f"<p>{payload.message}</p>",
            booking_id=payload.booking_id
        )
    elif payload.channel.upper() == "SMS":
        notif = await NotificationService.record_and_dispatch_sms(
            db=db,
            recipient_phone=payload.recipient,
            template_name="DIRECT_CUSTOM_SMS",
            message=payload.message,
            booking_id=payload.booking_id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported channel '{payload.channel}'. Use EMAIL or SMS."
        )

    await db.commit()
    await db.refresh(notif)
    return notif
