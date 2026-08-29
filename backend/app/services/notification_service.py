import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.notifications.email_client import email_gateway
from app.integrations.notifications.sms_client import sms_gateway
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.notification import Notification
from app.schemas.notification import ManagerNotificationSettings


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_customer_contact(booking: Booking) -> Tuple[str, Optional[str], Optional[str]]:
    """Helper to safely extract client contact information from booking and customer relations."""
    try:
        cust = booking.customer
    except Exception:
        cust = None

    name = (cust.full_name if cust else None) or booking.passenger_name or "Valued Client"
    email = (cust.email if cust else None) or booking.passenger_email
    phone = (cust.phone if cust else None) or booking.passenger_phone
    return name, email, phone


# In-Memory singleton for Manager Alert settings (can also be saved in database)
MANAGER_SETTINGS = ManagerNotificationSettings(
    manager_phone="+919305365420",
    manager_email="owner@chauffeurplatform.com",
    whatsapp_enabled=True,
    sms_enabled=True,
    browser_push_enabled=True,
    alert_on_new_booking=True,
    alert_on_driver_allocation=True,
    alert_on_driver_rejection=True,
    alert_on_unassigned_urgent=True,
    alert_on_trip_milestones=True,
    alert_on_flight_delay=True,
    alert_on_payment_received=True
)


class NotificationService:
    """
    Central notification dispatcher managing dual ops/customer alerts,
    automated transactional communications, delivery outbox logging,
    and REAL-TIME MANAGER MOBILE NOTIFICATIONS.
    """

    OPS_EMAIL = "ops@chauffeurplatform.com"
    OPS_PHONE = "+61400112233"

    @staticmethod
    def get_manager_settings() -> ManagerNotificationSettings:
        return MANAGER_SETTINGS

    @staticmethod
    def update_manager_settings(new_settings: ManagerNotificationSettings) -> ManagerNotificationSettings:
        global MANAGER_SETTINGS
        MANAGER_SETTINGS = new_settings
        return MANAGER_SETTINGS

    @staticmethod
    async def record_and_dispatch_email(
        db: AsyncSession,
        recipient: str,
        template_name: str,
        subject: str,
        html_content: str,
        booking_id: Optional[str] = None
    ) -> Notification:
        """Sends an email and records it in the notifications outbox."""
        dispatch_res = await email_gateway.send_email(
            to_email=recipient,
            subject=subject,
            html_content=html_content
        )
        notif = Notification(
            id=str(uuid.uuid4()),
            booking_id=booking_id,
            recipient=recipient,
            channel="EMAIL",
            template_name=template_name,
            subject=subject,
            content=html_content,
            status=dispatch_res.get("status", "SENT").upper(),
            external_message_id=dispatch_res.get("message_id")
        )
        db.add(notif)
        return notif

    @staticmethod
    async def record_and_dispatch_sms(
        db: AsyncSession,
        recipient_phone: str,
        template_name: str,
        message: str,
        booking_id: Optional[str] = None,
        channel: str = "SMS"
    ) -> Notification:
        """Sends an SMS or WhatsApp message and records it in the notifications outbox."""
        dispatch_res = await sms_gateway.send_sms(
            to_phone=recipient_phone,
            message=message
        )
        notif = Notification(
            id=str(uuid.uuid4()),
            booking_id=booking_id,
            recipient=recipient_phone,
            channel=channel.upper(),
            template_name=template_name,
            subject=None,
            content=message,
            status=dispatch_res.get("status", "SENT").upper(),
            external_message_id=dispatch_res.get("message_id")
        )
        db.add(notif)
        return notif

    @staticmethod
    async def dispatch_manager_mobile_alert(
        db: AsyncSession,
        event_type: str,
        title: str,
        message: str,
        booking_id: Optional[str] = None,
        urgency: str = "NORMAL"
    ) -> Optional[Notification]:
        """
        Dispatches real-time alerts directly to the Business Owner / Manager Mobile Phone
        via SMS, WhatsApp, and Web Push whenever bookings, dispatches, or milestones change.
        """
        settings = NotificationService.get_manager_settings()
        
        # Check event toggle
        if event_type == "NEW_BOOKING" and not settings.alert_on_new_booking:
            return None
        if event_type == "DRIVER_ALLOCATED" and not settings.alert_on_driver_allocation:
            return None
        if event_type == "UNASSIGNED_URGENT" and not settings.alert_on_unassigned_urgent:
            return None
        if event_type in ("EN_ROUTE", "ARRIVED", "PICKED_UP", "COMPLETED") and not settings.alert_on_trip_milestones:
            return None
        if event_type == "FLIGHT_DELAY" and not settings.alert_on_flight_delay:
            return None
        if event_type == "PAYMENT_RECEIVED" and not settings.alert_on_payment_received:
            return None

        # Build clean formatted mobile message
        prefix = "🚨 [URGENT DISPATCH]" if urgency == "HIGH" else "🔔 [CHAUFFEUR OPS]"
        mobile_msg = f"{prefix} {title}\n{message}\nTime: {utc_now().strftime('%H:%M AEST')}"

        channel = "WHATSAPP" if settings.whatsapp_enabled else "SMS"
        
        # Dispatch WhatsApp/SMS
        if settings.whatsapp_enabled:
            dispatch_res = await sms_gateway.send_whatsapp(settings.manager_phone, mobile_msg)
            notif = Notification(
                id=str(uuid.uuid4()),
                booking_id=booking_id,
                recipient=settings.manager_phone,
                channel="WHATSAPP",
                template_name=f"MANAGER_{event_type}",
                subject=title,
                content=mobile_msg,
                status=dispatch_res.get("status", "SENT").upper(),
                external_message_id=dispatch_res.get("message_id")
            )
            db.add(notif)
        else:
            notif = await NotificationService.record_and_dispatch_sms(
                db=db,
                recipient_phone=settings.manager_phone,
                template_name=f"MANAGER_{event_type}",
                message=mobile_msg,
                booking_id=booking_id,
                channel="SMS"
            )

        # Dispatch Telegram Bot (if token configured)
        if settings.telegram_bot_token and settings.telegram_chat_id:
            await sms_gateway.send_telegram(
                settings.telegram_bot_token,
                settings.telegram_chat_id,
                f"<b>{prefix} {title}</b>\n\n{message}"
            )

        return notif

    @staticmethod
    async def send_dual_booking_created_alert(
        db: AsyncSession,
        booking: Booking
    ) -> List[Notification]:
        """Dispatches immediate notification to both Ops team and Customer on booking confirmation."""
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)

        # 1. Customer Confirmation SMS
        if cust_phone:
            sms_body = f"Crown Chauffeur: Booking #{booking.booking_number} confirmed for {cust_name}. Total: ${booking.total_fare:.2f} AUD. Thank you for choosing us."
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, "BOOKING_CONFIRMED_SMS", sms_body, booking.id
            )
            notifs.append(n_sms)

        # 2. Customer Confirmation Email
        if cust_email:
            subj = f"Booking Confirmation #{booking.booking_number} — Crown Chauffeurs"
            html = f"""
            <h2>Your Chauffeur Booking is Confirmed</h2>
            <p>Dear {cust_name},</p>
            <p>Thank you for booking with Crown Chauffeurs. Your booking reference is <strong>#{booking.booking_number}</strong>.</p>
            <p><strong>Total Fare:</strong> ${booking.total_fare:.2f} AUD (Inc GST)<br/>
            <strong>Paid:</strong> ${booking.paid_amount:.2f} AUD<br/>
            <strong>Balance Due:</strong> ${booking.balance_amount:.2f} AUD</p>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, "BOOKING_CONFIRMED_EMAIL", subj, html, booking.id
            )
            notifs.append(n_email)

        # 3. Ops Team Email Alert
        ops_subj = f"OPS ALERT: New Booking #{booking.booking_number} ({cust_name})"
        ops_html = f"<p>New Booking #{booking.booking_number} received from {cust_name}. Fare: ${booking.total_fare:.2f} AUD</p>"
        n_ops = await NotificationService.record_and_dispatch_email(
            db, "ops@crownchauffeurs.com.au", "BOOKING_CREATED_OPS_EMAIL", ops_subj, ops_html, booking.id
        )
        notifs.append(n_ops)

        # 4. Dispatches Real-Time Mobile Alert directly to the Manager's Phone
        pickup_addr = booking.legs[0].pickup_address if booking.legs else "Location"
        manager_alert = await NotificationService.dispatch_manager_mobile_alert(
            db=db,
            event_type="NEW_BOOKING",
            title=f"New Booking #{booking.booking_number}",
            message=f"Passenger: {cust_name} ({booking.passenger_phone or cust_phone})\nRoute: {pickup_addr}\nFare: ${booking.total_fare:.2f} AUD (Paid: ${booking.paid_amount:.2f})",
            booking_id=booking.id
        )
        if manager_alert:
            notifs.append(manager_alert)

        return notifs

    @staticmethod
    async def send_balance_reminder(
        db: AsyncSession,
        booking: Booking,
        milestone: str  # "7_DAYS", "5_DAYS", "3_DAYS"
    ) -> List[Notification]:
        """Dispatches automated balance chasing SMS and Email."""
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)

        first_leg = booking.legs[0] if booking.legs else None
        pickup_str = first_leg.pickup_datetime.strftime("%d %b %Y %H:%M") if first_leg else "Upcoming"

        sms_text = f"Crown Chauffeur Reminder: A balance of ${booking.balance_amount:.2f} AUD is pending for your upcoming booking #{booking.booking_number} on {pickup_str}. Please settle online."
        if cust_phone:
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, f"BALANCE_REMINDER_{milestone}_SMS", sms_text, booking.id
            )
            notifs.append(n_sms)

        if cust_email:
            subj = f"Payment Reminder: Outstanding Balance Due ({milestone}) for Booking #{booking.booking_number}"
            html = f"""
            <h3>Upcoming Chauffeur Booking Balance Reminder</h3>
            <p>Dear {cust_name},</p>
            <p>This is a friendly reminder that a balance of <strong>${booking.balance_amount:.2f} AUD</strong> remains outstanding for booking <strong>#{booking.booking_number}</strong>.</p>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, f"BALANCE_REMINDER_{milestone}_EMAIL", subj, html, booking.id
            )
            notifs.append(n_email)

        return notifs

    @staticmethod
    async def send_pre_trip_handover_package(
        db: AsyncSession,
        booking: Booking,
        leg: BookingLeg
    ) -> List[Notification]:
        """Dispatches 2-hour pre-trip handover package with driver and vehicle details."""
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)
        driver = leg.driver
        vehicle = leg.vehicle
        partner = leg.partner

        pickup_str = leg.pickup_datetime.strftime("%H:%M")

        if driver and vehicle:
            chauffeur_info = f"{driver.full_name} (Phone: {driver.phone})"
            veh_info = f"{vehicle.color} {vehicle.make} {vehicle.model} (Plate: {vehicle.registration_plate})"
        elif partner:
            chauffeur_info = f"Partner Chauffeur from {partner.company_name} (Contact: {partner.phone})"
            veh_info = f"Premium Executive Vehicle ({leg.vehicle_category.value})"
        else:
            chauffeur_info = "Your dedicated chauffeur"
            veh_info = f"Executive Vehicle ({leg.vehicle_category.value})"

        if cust_phone:
            sms_text = f"Crown Chauffeur Update: Your chauffeur for today's pickup at {pickup_str} is {chauffeur_info}. Vehicle: {veh_info}."
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, "HANDOVER_CUSTOMER_SMS", sms_text, booking.id
            )
            notifs.append(n_sms)

        if cust_email:
            subj = f"Your Chauffeur Details for Today's Journey #{booking.booking_number}"
            html = f"""
            <h3>Your Chauffeur Has Been Dispatched</h3>
            <p>Dear {cust_name},</p>
            <p>Your vehicle and chauffeur details for your transfer today at <strong>{pickup_str}</strong>:</p>
            <ul>
                <li><strong>Chauffeur:</strong> {chauffeur_info}</li>
                <li><strong>Vehicle:</strong> {veh_info}</li>
                <li><strong>Pickup:</strong> {leg.pickup_address}</li>
                <li><strong>Dropoff:</strong> {leg.dropoff_address}</li>
            </ul>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, "HANDOVER_CUSTOMER_EMAIL", subj, html, booking.id
            )
            notifs.append(n_email)

        # Driver Handover (if internal driver)
        if driver and driver.phone:
            drv_sms = f"Crown Chauffeur Job: Pickup {booking.passenger_name or cust_name} ({booking.passenger_phone or cust_phone}) at {pickup_str} @ {leg.pickup_address} -> {leg.dropoff_address}."
            if leg.pickup_notes:
                drv_sms += f" Notes: {leg.pickup_notes}"
            n_drv = await NotificationService.record_and_dispatch_sms(
                db, driver.phone, "HANDOVER_DRIVER_SMS", drv_sms, booking.id
            )
            notifs.append(n_drv)

        return notifs

    @staticmethod
    async def send_customer_pre_trip_confirmation_reminder(
        db: AsyncSession,
        booking: Booking,
        leg: BookingLeg,
        scheduled_window_label: str = "12-24h"
    ) -> List[Notification]:
        """
        Dispatches automated 12-24h pre-trip booking confirmation reminder to the customer.
        - Bookings midnight to 8am: Dispatched at 10am on the day prior.
        - Bookings 8am to midnight: Dispatched at 2pm on the day prior.
        """
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)
        pickup_str = leg.pickup_datetime.strftime("%A, %d %B %Y at %I:%M %p")
        pickup_date_only = leg.pickup_datetime.strftime("%d %b %Y")

        if cust_phone:
            sms_text = (
                f"Crown Chauffeurs Reconfirmation: Your upcoming booking #{booking.booking_number} "
                f"is confirmed for {pickup_str}. Pickup: {leg.pickup_address}. "
                f"Dedicated chauffeur details will be dispatched 2 hours prior to pickup."
            )
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, "PRE_TRIP_CONFIRMATION_REMINDER_SMS", sms_text, booking.id
            )
            notifs.append(n_sms)

        if cust_email:
            subj = f"Booking Reconfirmation: Your Journey on {pickup_date_only} #{booking.booking_number} — Crown Chauffeurs"
            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; border: 1px solid #334155;">
                <div style="border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px;">
                    <span style="color: #fbbf24; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Crown Chauffeurs Melbourne</span>
                    <h2 style="color: #ffffff; margin: 8px 0 0 0; font-size: 22px;">Upcoming Journey Reconfirmation</h2>
                </div>
                <p>Dear <strong>{cust_name}</strong>,</p>
                <p style="color: #cbd5e1; line-height: 1.6;">
                    This is an automated reconfirmation for your upcoming chauffeur service scheduled with Crown Chauffeurs.
                </p>
                <div style="background-color: #1e293b; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
                    <p style="margin: 0 0 10px 0;"><strong>Booking Reference:</strong> <span style="color: #fbbf24; font-family: monospace;">#{booking.booking_number}</span></p>
                    <p style="margin: 0 0 10px 0;"><strong>Scheduled Pickup:</strong> <span style="color: #38bdf8;">{pickup_str}</span></p>
                    <p style="margin: 0 0 10px 0;"><strong>Pickup Location:</strong> {leg.pickup_address}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Destination:</strong> {leg.dropoff_address}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Vehicle Category:</strong> {leg.vehicle_category.value if hasattr(leg.vehicle_category, 'value') else leg.vehicle_category}</p>
                    {f'<p style="margin: 0 0 10px 0; color: #a78bfa;"><strong>Airport Flight:</strong> {leg.flight_number} (Live Radar Tracked)</p>' if leg.flight_number else ''}
                    <p style="margin: 0;"><strong>Payment Status:</strong> <span style="color: #4ade80;">PAID / CONFIRMED</span></p>
                </div>
                <div style="background-color: #064e3b; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0; color: #a7f3d0; font-size: 13px;">
                        <strong>Next Step:</strong> Your allocated chauffeur's direct contact details and vehicle registration plate will be dispatched to you <strong>2 hours prior to pickup</strong>.
                    </p>
                </div>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px;">
                    24/7 Operations Desk: +61 400 112 233 | concierge@crownchauffeurs.com.au
                </p>
            </div>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, "PRE_TRIP_CONFIRMATION_REMINDER_EMAIL", subj, html, booking.id
            )
            notifs.append(n_email)

        # Dispatches Real-Time Mobile Alert directly to the Manager's Phone
        mgr_alert = await NotificationService.dispatch_manager_mobile_alert(
            db=db,
            event_type="CUSTOMER_CONFIRMATION_REMINDER",
            title=f"12-24h Reconfirmation Dispatched #{booking.booking_number}",
            message=f"Passenger: {cust_name}\nScheduled Pickup: {pickup_str}\nRule: {scheduled_window_label} Scheduled Dispatch",
            booking_id=booking.id
        )
        if mgr_alert:
            notifs.append(mgr_alert)

        return notifs

    @staticmethod
    async def send_cancellation_circuit_alert(
        db: AsyncSession,
        booking: Booking,
        reason: Optional[str] = None
    ) -> List[Notification]:
        """Dispatches cancellation circuit breaker alert to customer and Ops team."""
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)

        if cust_email:
            subj = f"Cancellation Notice — Booking #{booking.booking_number}"
            html = f"""
            <h2>Booking Cancellation Confirmed</h2>
            <p>Dear {cust_name},</p>
            <p>Your booking <strong>#{booking.booking_number}</strong> has been cancelled.</p>
            <p><strong>Reason:</strong> {reason or 'Requested by client'}</p>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, "CUSTOMER_CANCELLATION", subj, html, booking.id
            )
            notifs.append(n_email)

        # Dispatch Ops Cancellation Email
        ops_subj = f"OPS ALERT: Booking #{booking.booking_number} CANCELLED"
        ops_html = f"<p>Booking #{booking.booking_number} for {cust_name} has been cancelled. Reason: {reason or 'Requested by client'}</p>"
        n_ops = await NotificationService.record_and_dispatch_email(
            db, "ops@crownchauffeurs.com.au", "OPS_CANCELLATION", ops_subj, ops_html, booking.id
        )
        notifs.append(n_ops)

        # Dispatches Manager Mobile Cancellation Alert
        mgr_notif = await NotificationService.dispatch_manager_mobile_alert(
            db=db,
            event_type="BOOKING_CANCELLED",
            title=f"Booking #{booking.booking_number} CANCELLED",
            message=f"Passenger: {cust_name}\nReason: {reason or 'Requested by client'}",
            booking_id=booking.id,
            urgency="HIGH"
        )
        if mgr_notif:
            notifs.append(mgr_notif)

        return notifs
