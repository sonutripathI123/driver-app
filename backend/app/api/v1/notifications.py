import hmac
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import get_current_active_user, require_ops, require_staff
from app.models.inbound_email import InboundEmail
from app.models.notification import Notification
from app.models.user import User
from app.schemas.inbound_email import (
    InboundEmailRead,
    InboundEmailStatusUpdate,
    InboundMailboxStatus,
    InboundWebhookResult,
)
from app.schemas.notification import (
    ManagerNotificationSettings,
    NotificationRead,
    SendDirectMessageRequest,
    TestMobilePingRequest,
)
from app.services.inbound_email_service import InboundEmailService
from app.services.notification_service import NotificationService

from app.integrations.notifications.webpush_client import webpush_gateway

router = APIRouter(prefix="/notifications", tags=["Notifications & Outbox"])


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Returns the VAPID Public Key for browser push registration."""
    return {"public_key": webpush_gateway.get_public_key()}


@router.post("/webpush-subscription", dependencies=[Depends(require_staff)])
async def register_webpush_subscription(subscription: dict):
    """
    Registers a browser push subscription for background OS notifications.
    Access: Staff

    Was open: anyone who posted a subscription here would have started
    receiving the business's dispatch alerts on their own device.
    """
    success = webpush_gateway.register_subscription(subscription)
    return {"status": "registered" if success else "failed"}


@router.get("/manager-settings", response_model=ManagerNotificationSettings, dependencies=[Depends(require_staff)])
async def get_manager_notification_settings(
    db: AsyncSession = Depends(get_db)
):
    """
    Get current Business Owner / Manager Mobile Alert Settings.
    Access: Staff

    Was open, so an anonymous request returned the manager's mobile number
    and email address along with any Telegram bot token stored here.
    """
    return await NotificationService.load_manager_settings(db)


@router.post("/manager-settings", response_model=ManagerNotificationSettings)
async def update_manager_notification_settings(
    settings: ManagerNotificationSettings,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update Manager Mobile Alert settings (Phone, WhatsApp, Telegram, Event Filters)."""
    return await NotificationService.save_manager_settings(db, settings, current_user.email)


@router.post("/test-mobile-ping", response_model=NotificationRead, dependencies=[Depends(require_staff)])
async def send_test_mobile_ping(
    payload: TestMobilePingRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Sends an immediate test alert to the Manager's mobile phone to verify SMS/WhatsApp connectivity.
    Access: Staff

    This was open to the internet and takes an arbitrary target_phone, so
    anyone who knew the URL could make the platform send SMS and WhatsApp
    messages to any number in the world on the business's account.
    """
    mgr = await NotificationService.load_manager_settings(db)
    target_phone = payload.target_phone or mgr.manager_phone
    msg_body = payload.custom_message or "🚨 [TEST ALERT] Opal Chauffeurs Mobile Dispatch system is connected! All booking & driver updates will be sent here in real-time."

    notif = await NotificationService.record_and_dispatch_sms(
        db=db,
        recipient_phone=target_phone,
        template_name="TEST_MOBILE_PING",
        message=msg_body,
        channel=payload.channel.upper()
    )
    await db.commit()
    await db.refresh(notif)
    return notif


@router.get("/", response_model=List[NotificationRead], dependencies=[Depends(require_staff)])
async def list_notifications(
    booking_id: Optional[str] = Query(None, description="Filter by booking ID"),
    recipient: Optional[str] = Query(None, description="Filter by recipient email or phone"),
    channel: Optional[str] = Query(None, description="Filter by channel: EMAIL, SMS, WHATSAPP"),
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
    elif payload.channel.upper() in ("SMS", "WHATSAPP"):
        notif = await NotificationService.record_and_dispatch_sms(
            db=db,
            recipient_phone=payload.recipient,
            template_name="DIRECT_CUSTOM_SMS",
            message=payload.message,
            booking_id=payload.booking_id,
            channel=payload.channel.upper()
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported channel '{payload.channel}'. Use EMAIL, SMS, or WHATSAPP."
        )

    await db.commit()
    await db.refresh(notif)
    return notif


# --- Inbound mailbox -------------------------------------------------
#
# The Email Hub's inbox was four fabricated threads held in the operator's
# browser. These endpoints back it with mail the provider actually delivered.


WEBHOOK_PATH = "/api/v1/notifications/inbound/webhook"


@router.post("/inbound/webhook", response_model=InboundWebhookResult)
async def receive_inbound_email(
    request: Request,
    token: Optional[str] = Query(None, description="Shared secret, if not sent as a header"),
    x_inbound_token: Optional[str] = Header(None, alias="X-Inbound-Token"),
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint the email provider calls when a reply arrives.

    Not behind the JWT — the provider has no login — so it is protected by a
    shared secret in the X-Inbound-Token header or a ?token= query parameter.
    Unset means inbound is off and the endpoint refuses everything, so an
    unconfigured deployment cannot have messages injected into its inbox.
    """
    expected = (settings.INBOUND_EMAIL_TOKEN or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inbound email is not enabled. Set INBOUND_EMAIL_TOKEN to switch it on."
        )

    supplied = (x_inbound_token or token or "").strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid inbound token."
        )

    try:
        payload: Any = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inbound payload was not valid JSON."
        )

    provider = (request.headers.get("user-agent") or "unknown").split("/")[0][:50]
    try:
        return await InboundEmailService.ingest_payload(db, payload, provider)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/inbound/status", response_model=InboundMailboxStatus, dependencies=[Depends(require_staff)])
async def inbound_mailbox_status(db: AsyncSession = Depends(get_db)):
    """
    Whether inbound mail is wired up, and how much has arrived.
    Access: Staff
    """
    configured = bool((settings.INBOUND_EMAIL_TOKEN or "").strip())

    total = await db.scalar(select(func.count()).select_from(InboundEmail)) or 0
    unread = await db.scalar(
        select(func.count()).select_from(InboundEmail).where(InboundEmail.status == "UNREAD")
    ) or 0

    if configured:
        detail = "Inbound mail is enabled. Replies appear here as the provider delivers them."
    else:
        detail = (
            "Inbound mail is not connected. Set INBOUND_EMAIL_TOKEN on the API service, then point your "
            "email provider's inbound parsing webhook at this path. Until then this inbox stays empty — "
            "replies from clients go to your normal mailbox."
        )

    return InboundMailboxStatus(
        configured=configured,
        webhook_path=WEBHOOK_PATH,
        total_messages=int(total),
        unread_count=int(unread),
        detail=detail,
    )


@router.get("/inbound", response_model=List[InboundEmailRead], dependencies=[Depends(require_staff)])
async def list_inbound_emails(
    status_filter: Optional[str] = Query(None, alias="status", description="UNREAD, READ, ACTION_NEEDED or REPLIED"),
    booking_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """
    Replies received at the business mailbox, newest first.
    Access: Staff
    """
    stmt = select(InboundEmail)
    if status_filter:
        stmt = stmt.where(InboundEmail.status == status_filter.upper())
    if booking_id:
        stmt = stmt.where(InboundEmail.booking_id == booking_id)
    stmt = stmt.order_by(desc(InboundEmail.received_at)).limit(limit)
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.patch("/inbound/{inbound_id}", response_model=InboundEmailRead, dependencies=[Depends(require_staff)])
async def update_inbound_email_status(
    inbound_id: str,
    payload: InboundEmailStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Triage a thread: mark it read, needing action, or replied.
    Access: Staff
    """
    record = await db.get(InboundEmail, inbound_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inbound message not found.")
    record.status = payload.status
    await db.commit()
    await db.refresh(record)
    return record
