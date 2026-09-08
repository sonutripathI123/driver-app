from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class InboundEmailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    sender_email: str
    sender_name: Optional[str] = None
    recipient_email: Optional[str] = None
    subject: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    booking_id: Optional[str] = None
    booking_number: Optional[str] = None
    status: str
    received_at: datetime


class InboundEmailStatusUpdate(BaseModel):
    status: Literal["UNREAD", "READ", "ACTION_NEEDED", "REPLIED"] = Field(
        ..., description="New triage state for the thread"
    )


class InboundWebhookResult(BaseModel):
    received: int
    stored: int
    duplicates: int
    rejected: int


class InboundMailboxStatus(BaseModel):
    """Whether inbound mail is wired up, so the UI can stop guessing."""
    configured: bool
    webhook_path: str
    total_messages: int
    unread_count: int
    detail: str
