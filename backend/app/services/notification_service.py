import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.integrations.notifications.email_client import email_gateway
from app.integrations.notifications.sms_client import sms_gateway
from app.integrations.notifications.webpush_client import webpush_gateway
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
    manager_phone=settings.MANAGER_PHONE,
    manager_email=settings.MANAGER_EMAIL,
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

    OPS_EMAIL = settings.OPS_EMAIL
    OPS_PHONE = settings.CONCIERGE_PHONE

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
            error_message=dispatch_res.get("failure_reason"),
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
        # The channel has to pick the transport: this previously always called
        # send_sms(), so a WHATSAPP request went out as an SMS and was then
        # recorded as WhatsApp.
        if channel.upper() == "WHATSAPP":
            dispatch_res = await sms_gateway.send_whatsapp(
                to_phone=recipient_phone,
                message=message
            )
        else:
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
            # Without this, a message the gateway refused was indistinguishable
            # from one it delivered apart from the status string.
            error_message=dispatch_res.get("failure_reason"),
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
        mgr = NotificationService.get_manager_settings()
        
        # Check event toggle
        if event_type == "NEW_BOOKING" and not mgr.alert_on_new_booking:
            return None
        if event_type == "DRIVER_ALLOCATED" and not mgr.alert_on_driver_allocation:
            return None
        if event_type == "UNASSIGNED_URGENT" and not mgr.alert_on_unassigned_urgent:
            return None
        if event_type in ("EN_ROUTE", "ARRIVED", "PICKED_UP", "COMPLETED") and not mgr.alert_on_trip_milestones:
            return None
        if event_type == "FLIGHT_DELAY" and not mgr.alert_on_flight_delay:
            return None
        if event_type == "PAYMENT_RECEIVED" and not mgr.alert_on_payment_received:
            return None

        # Build clean formatted mobile message
        prefix = "🚨 [URGENT DISPATCH]" if urgency == "HIGH" else "🔔 [CHAUFFEUR OPS]"
        mobile_msg = f"{prefix} {title}\n{message}\nTime: {utc_now().strftime('%H:%M AEST')}"

        channel = "WHATSAPP" if mgr.whatsapp_enabled else "SMS"
        
        # Dispatch WhatsApp/SMS
        if mgr.whatsapp_enabled:
            dispatch_res = await sms_gateway.send_whatsapp(mgr.manager_phone, mobile_msg)
            notif = Notification(
                id=str(uuid.uuid4()),
                booking_id=booking_id,
                recipient=mgr.manager_phone,
                channel="WHATSAPP",
                template_name=f"MANAGER_{event_type}",
                subject=title,
                content=mobile_msg,
                status=dispatch_res.get("status", "SENT").upper(),
                error_message=dispatch_res.get("failure_reason"),
                external_message_id=dispatch_res.get("message_id")
            )
            db.add(notif)
        else:
            notif = await NotificationService.record_and_dispatch_sms(
                db=db,
                recipient_phone=mgr.manager_phone,
                template_name=f"MANAGER_{event_type}",
                message=mobile_msg,
                booking_id=booking_id,
                channel="SMS"
            )

        # Email the same alert. Unlike SMS/WhatsApp this needs no telco account,
        # so it is the one manager channel that works today.
        if mgr.manager_email_enabled and mgr.manager_email:
            rows: List[Tuple[str, str]] = []
            for line in message.split("\n"):
                line = line.strip()
                if not line:
                    continue
                if ": " in line:
                    label, _, value = line.partition(": ")
                    rows.append((label.strip(), value.strip()))
                else:
                    rows.append(("", line))
            rows.append(("Time", utc_now().strftime("%d %b %Y at %H:%M UTC")))

            await NotificationService.record_and_dispatch_email(
                db,
                mgr.manager_email,
                f"MANAGER_{event_type}_EMAIL",
                f"{'URGENT — ' if urgency == 'HIGH' else ''}{title}",
                NotificationService.build_branded_email(
                    heading=title,
                    intro="Operations alert from the dispatch platform.",
                    rows=rows,
                ),
                booking_id,
            )

        # Dispatch Telegram Bot (if token configured)
        if mgr.telegram_bot_token and mgr.telegram_chat_id:
            tg_res = await sms_gateway.send_telegram(
                mgr.telegram_bot_token,
                mgr.telegram_chat_id,
                f"<b>{prefix} {title}</b>\n\n{message}"
            )
            # Telegram sends were previously not recorded at all, so a failure
            # left no trace in the outbox.
            db.add(Notification(
                id=str(uuid.uuid4()),
                booking_id=booking_id,
                recipient=f"telegram:{mgr.telegram_chat_id}",
                channel="TELEGRAM",
                template_name=f"MANAGER_{event_type}",
                subject=title,
                content=mobile_msg,
                status=tg_res.get("status", "SENT").upper(),
                error_message=tg_res.get("failure_reason"),
            ))

        # Dispatch OS-level Background Web Push (Delivers even when browser is closed)
        if mgr.browser_push_enabled:
            webpush_gateway.send_push_to_all(
                title=f"{prefix} {title}",
                body=message.replace('\n', ' • '),
                url="/operate"
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
            sms_body = f"Opal Chauffeurs: Booking #{booking.booking_number} confirmed for {cust_name}. Total: ${booking.total_fare:.2f} AUD. Thank you for choosing us."
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, "BOOKING_CONFIRMED_SMS", sms_body, booking.id
            )
            notifs.append(n_sms)

        # 2. Customer Confirmation Email
        if cust_email:
            subj = f"Booking Confirmation #{booking.booking_number} — Opal Chauffeurs"
            html = f"""
            <h2>Your Chauffeur Booking is Confirmed</h2>
            <p>Dear {cust_name},</p>
            <p>Thank you for booking with Opal Chauffeurs. Your booking reference is <strong>#{booking.booking_number}</strong>.</p>
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
            db, settings.OPS_EMAIL, "BOOKING_CREATED_OPS_EMAIL", ops_subj, ops_html, booking.id
        )
        notifs.append(n_ops)

        # 4. Dispatches Real-Time Mobile Alert directly to the Manager's Phone
        pickup_addr = booking.legs[0].pickup_address if booking.legs else "Location"
        dropoff_addr = booking.legs[0].dropoff_address if booking.legs else "Destination"
        pickup_dt = booking.legs[0].pickup_datetime if booking.legs else None
        pickup_time_str = pickup_dt.strftime("%d %b %Y at %I:%M %p AEST") if pickup_dt else "Scheduled Time"

        manager_alert = await NotificationService.dispatch_manager_mobile_alert(
            db=db,
            event_type="NEW_BOOKING",
            title=f"New Booking #{booking.booking_number}",
            message=f"Passenger: {cust_name} ({booking.passenger_phone or cust_phone})\n📅 Pickup: {pickup_time_str}\n📍 Route: {pickup_addr} ➔ {dropoff_addr}\n💰 Fare: ${booking.total_fare:.2f} AUD (Paid: ${booking.paid_amount:.2f})\n🚘 Vehicle: {booking.legs[0].vehicle_category if booking.legs else 'SEDAN'}",
            booking_id=booking.id
        )
        if manager_alert:
            notifs.append(manager_alert)

        return notifs

    @staticmethod
    def build_branded_email(
        heading: str,
        intro: str,
        rows: List[Tuple[str, str]],
        total_label: Optional[str] = None,
        total_value: Optional[str] = None,
        footer_note: Optional[str] = None
    ) -> str:
        """
        Wraps content in the Opal house style, using table layout and inline
        styles so it survives Outlook and Gmail.
        """
        row_html = "".join(
            f'<tr>'
            f'<td style="padding:9px 0;border-bottom:1px solid #E6D8C3;color:#5C5347;font-size:12px;'
            f'letter-spacing:.06em;text-transform:uppercase;font-weight:700;width:42%">{label}</td>'
            f'<td style="padding:9px 0;border-bottom:1px solid #E6D8C3;color:#0A0E1A;font-size:14px;'
            f'font-weight:700">{value}</td></tr>'
            for label, value in rows
        )

        total_html = ""
        if total_label and total_value:
            total_html = (
                '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                'style="margin-top:12px;background:#0A0E1A;border-radius:9px;"><tr>'
                f'<td style="padding:14px 16px;color:#DFCAA8;font-size:11px;font-weight:800;'
                f'letter-spacing:.13em;">{total_label}</td>'
                f'<td align="right" style="padding:14px 16px;color:#FFFFFF;font-size:19px;'
                f'font-weight:800;">{total_value}</td>'
                '</tr></table>'
            )

        note_html = ""
        if footer_note:
            note_html = (
                '<tr><td style="padding:8px 30px 30px;">'
                '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                'style="background:#FFFFFF;border:1px solid #E6D8C3;border-radius:9px;">'
                f'<tr><td style="padding:15px 17px;color:#4A4235;font-size:13px;line-height:1.6;">'
                f'{footer_note}</td></tr></table></td></tr>'
            )

        return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#EFE8DE;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE8DE;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FAF6F0;border:1px solid #DFCAA8;border-radius:14px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
  <tr><td style="background:#0A0E1A;padding:26px 30px;">
    <div style="color:#FFFFFF;font-size:19px;font-weight:800;letter-spacing:.11em;">OPAL CHAUFFEURS</div>
    <div style="color:#DFCAA8;font-size:10px;font-weight:700;letter-spacing:.22em;margin-top:5px;">AUSTRALIA &nbsp;&middot;&nbsp; MELBOURNE HUB</div>
  </td></tr>
  <tr><td style="height:3px;background:#C2A16B;"></td></tr>
  <tr><td style="padding:30px 30px 8px;">
    <h1 style="margin:0 0 8px;color:#0A0E1A;font-size:22px;font-weight:800;line-height:1.3;">{heading}</h1>
    <p style="margin:0;color:#4A4235;font-size:14px;line-height:1.65;">{intro}</p>
  </td></tr>
  <tr><td style="padding:22px 30px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{row_html}</table>
    {total_html}
  </td></tr>
  {note_html}
  <tr><td style="background:#0A0E1A;padding:22px 30px;">
    <div style="color:#FFFFFF;font-size:12px;font-weight:700;">{settings.COMPANY_NAME}</div>
    <div style="color:#DFCAA8;font-size:11px;margin-top:5px;line-height:1.7;">
      ABN {settings.COMPANY_ABN} &nbsp;&middot;&nbsp; {settings.OPS_EMAIL} &nbsp;&middot;&nbsp; {settings.CONCIERGE_PHONE}<br>
      {settings.COMPANY_WEBSITE}
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

    @staticmethod
    async def send_trip_completed_receipt(
        db: AsyncSession,
        booking: Booking,
        leg: BookingLeg
    ) -> List[Notification]:
        """
        Post-trip summary to the passenger with the ATO GST split.

        Completion previously only alerted the manager, so a client heard
        nothing once their journey finished.
        """
        notifs: List[Notification] = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)

        gst = round(booking.total_fare / 11, 2)
        ex_gst = round(booking.total_fare - gst, 2)
        completed_at = leg.completed_at or utc_now()

        if cust_email:
            vehicle = "Chauffeur vehicle"
            try:
                if leg.vehicle:
                    vehicle = f"{leg.vehicle.make} {leg.vehicle.model} ({leg.vehicle.registration_plate})"
            except Exception:
                pass

            rows: List[Tuple[str, str]] = [
                ("Booking reference", f"#{booking.booking_number}"),
                ("Passenger", cust_name),
                ("Completed", completed_at.strftime("%d %B %Y at %I:%M %p")),
                ("Pickup", leg.pickup_address),
                ("Destination", leg.dropoff_address),
                ("Vehicle", vehicle),
                ("Subtotal (ex GST)", f"${ex_gst:,.2f} AUD"),
                ("GST (1/11th)", f"${gst:,.2f} AUD"),
            ]
            if booking.balance_amount and booking.balance_amount > 0:
                rows.append(("Balance outstanding", f"${booking.balance_amount:,.2f} AUD"))

            html = NotificationService.build_branded_email(
                heading="Thank you for travelling with us",
                intro=(
                    f"Dear {cust_name}, your journey is complete. A summary of the transfer "
                    f"is below for your records."
                ),
                rows=rows,
                total_label="TOTAL INC GST",
                total_value=f"${booking.total_fare:,.2f} AUD",
                footer_note=(
                    f"A formal tax invoice is available on request. For anything at all, reply to "
                    f"this email or call <strong style='color:#0A0E1A;'>{settings.CONCIERGE_PHONE}</strong>."
                ),
            )
            notifs.append(await NotificationService.record_and_dispatch_email(
                db, cust_email,
                "TRIP_COMPLETED_RECEIPT",
                f"Trip complete — #{booking.booking_number} | Opal Chauffeurs",
                html, booking.id
            ))

        if cust_phone:
            sms = (
                f"Opal Chauffeurs: Thank you, {cust_name}. Trip #{booking.booking_number} is complete. "
                f"Total ${booking.total_fare:,.2f} AUD inc GST."
            )
            notifs.append(await NotificationService.record_and_dispatch_sms(
                db, cust_phone, "TRIP_COMPLETED_SMS", sms, booking.id
            ))

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

        sms_text = f"Opal Chauffeurs Reminder: A balance of ${booking.balance_amount:.2f} AUD is pending for your upcoming booking #{booking.booking_number} on {pickup_str}. Please settle online."
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
            sms_text = f"Opal Chauffeurs Update: Your chauffeur for today's pickup at {pickup_str} is {chauffeur_info}. Vehicle: {veh_info}."
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
            drv_sms = f"Opal Chauffeurs Job: Pickup {booking.passenger_name or cust_name} ({booking.passenger_phone or cust_phone}) at {pickup_str} @ {leg.pickup_address} -> {leg.dropoff_address}."
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
                f"Opal Chauffeurs Reconfirmation: Your upcoming booking #{booking.booking_number} "
                f"is confirmed for {pickup_str}. Pickup: {leg.pickup_address}. "
                f"Dedicated chauffeur details will be dispatched 2 hours prior to pickup."
            )
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, "PRE_TRIP_CONFIRMATION_REMINDER_SMS", sms_text, booking.id
            )
            notifs.append(n_sms)

        if cust_email:
            subj = f"Booking Reconfirmation: Your Journey on {pickup_date_only} #{booking.booking_number} — Opal Chauffeurs"
            html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 16px; border: 1px solid #334155;">
                <div style="border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px;">
                    <span style="color: #fbbf24; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Opal Chauffeurs Melbourne</span>
                    <h2 style="color: #ffffff; margin: 8px 0 0 0; font-size: 22px;">Upcoming Journey Reconfirmation</h2>
                </div>
                <p>Dear <strong>{cust_name}</strong>,</p>
                <p style="color: #cbd5e1; line-height: 1.6;">
                    This is an automated reconfirmation for your upcoming chauffeur service scheduled with Opal Chauffeurs.
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
                    24/7 Operations Desk: {settings.CONCIERGE_PHONE} | {settings.OPS_EMAIL}
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
            db, settings.OPS_EMAIL, "OPS_CANCELLATION", ops_subj, ops_html, booking.id
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
