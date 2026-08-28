from datetime import datetime
from typing import List, Optional
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
    channel: str = Field("SMS", description="Delivery channel: SMS, WHATSAPP, or EMAIL")
    subject: Optional[str] = Field(None, description="Email subject line (required for email)")
    message: str = Field(..., min_length=2, description="Notification message body")


class AutomationRunSummary(BaseModel):
    milestone_7d_count: int = 0
    milestone_5d_count: int = 0
    milestone_3d_count: int = 0
    overdue_escalations: int = 0
    driver_handovers_count: int = 0
    total_processed: int = 0


class ManagerNotificationSettings(BaseModel):
    manager_phone: str = "+61400000000"
    manager_email: str = "owner@chauffeurplatform.com"
    whatsapp_enabled: bool = True
    sms_enabled: bool = True
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    browser_push_enabled: bool = True
    
    # Event Triggers
    alert_on_new_booking: bool = True
    alert_on_driver_allocation: bool = True
    alert_on_driver_rejection: bool = True
    alert_on_unassigned_urgent: bool = True
    alert_on_trip_milestones: bool = True  # En Route, Arrived, Picked Up, Completed
    alert_on_flight_delay: bool = True
    alert_on_payment_received: bool = True


class TestMobilePingRequest(BaseModel):
    channel: str = Field("SMS", description="SMS, WHATSAPP, TELEGRAM, or BROWSER_PUSH")
    target_phone: Optional[str] = None
    custom_message: Optional[str] = None
