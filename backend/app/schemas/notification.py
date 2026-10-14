from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.core.config import settings


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    booking_id: Optional[str] = None
    recipient: str
    from_address: Optional[str] = None
    mailbox_id: Optional[str] = None
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
    confirmation_reminders_count: int = 0
    total_processed: int = 0


class ManagerNotificationSettings(BaseModel):
    manager_phone: str = settings.MANAGER_PHONE
    manager_email: str = settings.MANAGER_EMAIL
    # Telco channels are OFF by default: WhatsApp needs a Twilio WhatsApp API the
    # business does not have, and manager SMS to an international (+91) number is
    # the main avoidable Twilio cost. Manager alerts instead land in-app (Mobile
    # Alert Hub) and by email — both free. Flip these on in Manager Settings only
    # once a cost-effective channel is in place.
    whatsapp_enabled: bool = False
    sms_enabled: bool = False
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    browser_push_enabled: bool = True
    # Email is the only manager channel that needs no telco account, so it is
    # on by default.
    manager_email_enabled: bool = True
    
    # Event Triggers (which events alert the MANAGER).
    # New bookings still notify the manager; but allocation, in-trip milestones
    # and flight delays do NOT — on those the driver and/or customer are informed
    # directly instead, so the manager inbox stays quiet.
    alert_on_new_booking: bool = True
    alert_on_driver_allocation: bool = False
    alert_on_driver_rejection: bool = True
    alert_on_unassigned_urgent: bool = True
    alert_on_trip_milestones: bool = False  # En Route, Arrived, Picked Up, Completed
    alert_on_flight_delay: bool = False
    alert_on_payment_received: bool = True


class TestMobilePingRequest(BaseModel):
    channel: str = Field("SMS", description="SMS, WHATSAPP, TELEGRAM, or BROWSER_PUSH")
    target_phone: Optional[str] = None
    custom_message: Optional[str] = None
