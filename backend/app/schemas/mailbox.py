from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class MailboxBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=120, description="Friendly name, e.g. 'Corporate enquiries'")
    email_address: EmailStr
    imap_host: str = Field(..., min_length=3, max_length=255)
    imap_port: int = Field(993, ge=1, le=65535)
    smtp_host: str = Field(..., min_length=3, max_length=255)
    smtp_port: int = Field(587, ge=1, le=65535)
    smtp_use_tls: bool = True
    username: str = Field(..., min_length=1, max_length=320, description="Usually the full email address")
    is_active: bool = True
    booking_form_url: Optional[str] = Field(None, max_length=500, description="This website's public booking-form link, sent to the customer in a reply")


class MailboxCreate(MailboxBase):
    password: str = Field(..., min_length=1, max_length=512, description="Mailbox / app password (stored encrypted)")


class MailboxUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=120)
    email_address: Optional[EmailStr] = None
    imap_host: Optional[str] = Field(None, min_length=3, max_length=255)
    imap_port: Optional[int] = Field(None, ge=1, le=65535)
    smtp_host: Optional[str] = Field(None, min_length=3, max_length=255)
    smtp_port: Optional[int] = Field(None, ge=1, le=65535)
    smtp_use_tls: Optional[bool] = None
    username: Optional[str] = Field(None, min_length=1, max_length=320)
    is_active: Optional[bool] = None
    booking_form_url: Optional[str] = Field(None, max_length=500)
    # Provide only to change it; omitted leaves the stored password untouched.
    password: Optional[str] = Field(None, min_length=1, max_length=512)


class MailboxRead(BaseModel):
    """Never includes the password."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    email_address: str
    imap_host: str
    imap_port: int
    smtp_host: str
    smtp_port: int
    smtp_use_tls: bool
    username: str
    is_active: bool
    booking_form_url: Optional[str] = None
    last_polled_at: Optional[datetime] = None
    last_poll_error: Optional[str] = None
    created_at: datetime


class MailboxTestResult(BaseModel):
    imap_ok: bool
    smtp_ok: bool
    detail: str


class MailboxPollResult(BaseModel):
    mailbox_id: str
    label: str
    stored: int
    duplicates: int
    error: Optional[str] = None


class MailboxReplyRequest(BaseModel):
    to_email: EmailStr
    subject: str = Field(..., min_length=1, max_length=998)
    message: str = Field(..., min_length=1)
    booking_id: Optional[str] = None
    inbound_id: Optional[str] = Field(None, description="Thread to mark REPLIED after sending")
