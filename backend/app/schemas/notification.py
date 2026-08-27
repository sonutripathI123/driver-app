from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: Optional[str] = None
    recipient: str
    channel: str
    template_name: str
    subject: Optional[str] = None
    content: str
    status: str
    error_message: Optional[str] = None
    external_message_id: Optional[str] = None
    created_at: datetime


class SendDirectMessageRequest(BaseModel):
    booking_id: Optional[str] = Field(None, description="Related Booking ID if applicable")
    recipient: str = Field(..., description="Recipient email address or phone number")
    channel: str = Field("EMAIL", description="Delivery channel: EMAIL or SMS")
    subject: Optional[str] = Field(None, description="Email subject line (required for email)")
    message: str = Field(..., min_length=2, description="Notification message body")


class AutomationRunSummary(BaseModel):
    milestone_7d_count: int = 0
    milestone_5d_count: int = 0
    milestone_3d_count: int = 0
    overdue_escalations: int = 0
    driver_handovers_count: int = 0
    total_processed: int = 0
