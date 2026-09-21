from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_ops, require_staff
from app.models.inbound_email import InboundEmail
from app.schemas.inbound_email import InboundEmailRead
from app.schemas.mailbox import (
    MailboxCreate,
    MailboxPollResult,
    MailboxRead,
    MailboxReplyRequest,
    MailboxTestResult,
    MailboxUpdate,
)
from app.schemas.notification import NotificationRead
from app.services.mailbox_service import MailboxService

router = APIRouter(prefix="/mailboxes", tags=["Email Workflow Mailboxes"])


@router.get("/", response_model=List[MailboxRead], dependencies=[Depends(require_staff)])
async def list_mailboxes(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Connected mailboxes (passwords never returned). Access: Staff."""
    return await MailboxService.list_mailboxes(db, active_only=active_only)


@router.post("/", response_model=MailboxRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_ops)])
async def create_mailbox(payload: MailboxCreate, db: AsyncSession = Depends(get_db)):
    """Connect a new mailbox. The password is stored encrypted. Access: ADMIN, OPS."""
    return await MailboxService.create(db, payload)


@router.patch("/{mailbox_id}", response_model=MailboxRead, dependencies=[Depends(require_ops)])
async def update_mailbox(mailbox_id: str, payload: MailboxUpdate, db: AsyncSession = Depends(get_db)):
    """Update a mailbox. Omit password to keep the stored one. Access: ADMIN, OPS."""
    return await MailboxService.update(db, mailbox_id, payload)


@router.delete("/{mailbox_id}", status_code=status.HTTP_200_OK, dependencies=[Depends(require_ops)])
async def delete_mailbox(mailbox_id: str, db: AsyncSession = Depends(get_db)):
    """Disconnect a mailbox. Access: ADMIN, OPS."""
    label = await MailboxService.delete(db, mailbox_id)
    return {"status": "deleted", "mailbox_id": mailbox_id, "label": label}


@router.post("/{mailbox_id}/test", response_model=MailboxTestResult, dependencies=[Depends(require_ops)])
async def test_mailbox(mailbox_id: str, db: AsyncSession = Depends(get_db)):
    """Verify IMAP and SMTP login for a mailbox. Access: ADMIN, OPS."""
    imap_ok, smtp_ok, detail = await MailboxService.test_connection(db, mailbox_id)
    return MailboxTestResult(imap_ok=imap_ok, smtp_ok=smtp_ok, detail=detail)


@router.post("/poll-all", response_model=List[MailboxPollResult], dependencies=[Depends(require_staff)])
async def poll_all_mailboxes(db: AsyncSession = Depends(get_db)):
    """Fetch new mail for every active mailbox now. Access: Staff."""
    return await MailboxService.poll_all(db)


@router.post("/{mailbox_id}/poll", response_model=MailboxPollResult, dependencies=[Depends(require_staff)])
async def poll_one_mailbox(mailbox_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch new mail for one mailbox now. Access: Staff."""
    mb = await MailboxService.get(db, mailbox_id)
    return await MailboxService.poll_mailbox(db, mb)


@router.get("/{mailbox_id}/inbound", response_model=List[InboundEmailRead], dependencies=[Depends(require_staff)])
async def list_mailbox_inbound(
    mailbox_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Received messages for one mailbox, newest first. Access: Staff."""
    await MailboxService.get(db, mailbox_id)  # 404 if missing
    stmt = select(InboundEmail).where(InboundEmail.mailbox_id == mailbox_id)
    if status_filter:
        stmt = stmt.where(InboundEmail.status == status_filter.upper())
    stmt = stmt.order_by(desc(InboundEmail.received_at)).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


@router.post("/{mailbox_id}/inbound/{inbound_id}/draft-reply", dependencies=[Depends(require_ops)])
async def draft_ai_reply(mailbox_id: str, inbound_id: str, db: AsyncSession = Depends(get_db)):
    """
    Draft a reply to this enquiry with the Claude API, for the operator to review
    and edit before sending. Returns {subject, message, to_email}. 503 if no
    ANTHROPIC_API_KEY is configured — never a fabricated reply. Access: ADMIN, OPS.
    """
    return await MailboxService.draft_reply(db, mailbox_id, inbound_id)


@router.post("/{mailbox_id}/reply", response_model=NotificationRead, dependencies=[Depends(require_ops)])
async def reply_from_mailbox(mailbox_id: str, payload: MailboxReplyRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a reply (quote, code, confirmation) from this mailbox's own address.
    The status on the returned record says whether SMTP accepted it.
    Access: ADMIN, OPS.
    """
    return await MailboxService.send_reply(
        db,
        mailbox_id=mailbox_id,
        to_email=str(payload.to_email),
        subject=payload.subject,
        message=payload.message,
        booking_id=payload.booking_id,
        inbound_id=payload.inbound_id,
    )
