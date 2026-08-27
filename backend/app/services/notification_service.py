import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.notifications.email_client import email_gateway
from app.integrations.notifications.sms_client import sms_gateway
from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.notification import Notification


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


class NotificationService:
    """
    Central notification dispatcher managing dual ops/customer alerts,
    automated transactional communications, and delivery outbox logging.
    """

    OPS_EMAIL = "ops@crownchauffeurs.com.au"
    OPS_PHONE = "+61390001111"

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
        booking_id: Optional[str] = None
    ) -> Notification:
        """Sends an SMS and records it in the notifications outbox."""
        dispatch_res = await sms_gateway.send_sms(
            to_phone=recipient_phone,
            message=message
        )
        notif = Notification(
            id=str(uuid.uuid4()),
            booking_id=booking_id,
            recipient=recipient_phone,
            channel="SMS",
            template_name=template_name,
            subject=None,
            content=message,
            status=dispatch_res.get("status", "SENT").upper(),
            external_message_id=dispatch_res.get("message_id")
        )
        db.add(notif)
        return notif

    @staticmethod
    async def send_dual_booking_created_alert(
        db: AsyncSession,
        booking: Booking
    ) -> List[Notification]:
        """
        DUAL ALERT: Dispatches confirmation to Customer and new-job alert to Ops team.
        """
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)
        first_leg = booking.legs[0] if booking.legs else None
        pickup_str = first_leg.pickup_datetime.strftime('%d %b %Y at %I:%M %p') if first_leg else "TBD"

        if cust_email:
            subj = f"Booking Confirmation #{booking.booking_number} — Crown Chauffeur Melbourne"
            html = f"""
            <h2>Thank you for your reservation with Crown Chauffeur Melbourne</h2>
            <p>Dear {cust_name},</p>
            <p>Your chauffeur booking <strong>#{booking.booking_number}</strong> has been received and logged in our system.</p>
            <ul>
                <li><strong>Pickup Date & Time:</strong> {pickup_str}</li>
                <li><strong>Pickup Address:</strong> {first_leg.pickup_address if first_leg else 'N/A'}</li>
                <li><strong>Dropoff Address:</strong> {first_leg.dropoff_address if first_leg else 'N/A'}</li>
                <li><strong>Total Fare:</strong> ${booking.total_fare:.2f} {booking.currency}</li>
                <li><strong>Paid Amount:</strong> ${booking.paid_amount:.2f} {booking.currency}</li>
                <li><strong>Balance Due:</strong> ${booking.balance_amount:.2f} {booking.currency}</li>
            </ul>
            <p>Our dispatch team will assign your dedicated chauffeur prior to your journey.</p>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, "CUSTOMER_BOOKING_CONFIRMATION", subj, html, booking.id
            )
            notifs.append(n_email)

        if cust_phone:
            sms_text = f"Crown Chauffeur: Booking #{booking.booking_number} confirmed for {pickup_str}. Total: ${booking.total_fare:.2f}. Thank you!"
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, "CUSTOMER_BOOKING_SMS", sms_text, booking.id
            )
            notifs.append(n_sms)

        # 2. Dual Ops Alert
        ops_subj = f"[OPS ALERT] New Booking #{booking.booking_number} created (${booking.total_fare:.2f})"
        ops_html = f"""
        <h3>New Master Booking Logged</h3>
        <p><strong>Booking Number:</strong> {booking.booking_number}</p>
        <p><strong>Customer:</strong> {cust_name} ({cust_email or 'N/A'} / {cust_phone or 'N/A'})</p>
        <p><strong>Pickup Time:</strong> {pickup_str}</p>
        <p><strong>Fare:</strong> ${booking.total_fare:.2f} | <strong>Status:</strong> {booking.status.value}</p>
        """
        n_ops = await NotificationService.record_and_dispatch_email(
            db, NotificationService.OPS_EMAIL, "OPS_NEW_BOOKING_ALERT", ops_subj, ops_html, booking.id
        )
        notifs.append(n_ops)

        return notifs

    @staticmethod
    async def send_balance_reminder(
        db: AsyncSession,
        booking: Booking,
        milestone: str  # "7_DAYS", "5_DAYS", "3_DAYS"
    ) -> List[Notification]:
        """
        Dispatches 7/5/3-day balance reminder with hosted payment link.
        """
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)
        first_leg = booking.legs[0] if booking.legs else None
        pickup_str = first_leg.pickup_datetime.strftime('%d %b %Y at %I:%M %p') if first_leg else "TBD"

        urgency_label = {
            "7_DAYS": "Reminder: Upcoming Journey Balance Due",
            "5_DAYS": "Action Required: Outstanding Balance for Chauffeur Booking",
            "3_DAYS": "URGENT: Final Notice for Booking Balance Settlement"
        }.get(milestone, "Balance Payment Reminder")

        if cust_email:
            subj = f"{urgency_label} — #{booking.booking_number}"
            html = f"""
            <h2>{urgency_label}</h2>
            <p>Dear {cust_name},</p>
            <p>This is a reminder regarding your upcoming luxury transfer on <strong>{pickup_str}</strong>.</p>
            <p><strong>Outstanding Balance:</strong> ${booking.balance_amount:.2f} {booking.currency}</p>
            <p>Please settle the outstanding balance securely via credit card before your scheduled pickup.</p>
            <p><a href="https://pay.crownchauffeurs.com.au/checkout/{booking.id}" style="background:#1a1a1a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Pay Balance Now (${booking.balance_amount:.2f})</a></p>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, f"BALANCE_REMINDER_{milestone}", subj, html, booking.id
            )
            notifs.append(n_email)

        if cust_phone and milestone in ("5_DAYS", "3_DAYS"):
            sms_text = f"Crown Chauffeur: Balance reminder for Booking #{booking.booking_number}. Remaining: ${booking.balance_amount:.2f} due for trip on {pickup_str}."
            n_sms = await NotificationService.record_and_dispatch_sms(
                db, cust_phone, f"BALANCE_SMS_{milestone}", sms_text, booking.id
            )
            notifs.append(n_sms)

        return notifs

    @staticmethod
    async def send_driver_handover_package(
        db: AsyncSession,
        leg: BookingLeg
    ) -> List[Notification]:
        """
        2-HOUR PRE-TRIP HANDOVER:
        Dispatches chauffeur contact and vehicle plate to customer,
        and passenger details & notes to driver.
        """
        notifs = []
        booking = leg.booking
        driver = leg.driver
        vehicle = leg.vehicle
        partner = leg.partner

        cust_name, cust_email, cust_phone = get_customer_contact(booking)
        pickup_str = leg.pickup_datetime.strftime('%I:%M %p')

        # 1. Customer Handover
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

        # 2. Driver Handover (if internal driver)
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
    async def send_cancellation_circuit_alert(
        db: AsyncSession,
        booking: Booking,
        reason: Optional[str] = None
    ) -> List[Notification]:
        """
        Dispatches cancellation circuit breaker alert to customer and Ops team.
        """
        notifs = []
        cust_name, cust_email, cust_phone = get_customer_contact(booking)

        if cust_email:
            subj = f"Cancellation Notice — Booking #{booking.booking_number}"
            html = f"""
            <h2>Booking Cancellation Confirmed</h2>
            <p>Dear {cust_name},</p>
            <p>Your booking <strong>#{booking.booking_number}</strong> has been cancelled.</p>
            <p><strong>Reason:</strong> {reason or 'Requested by client'}</p>
            <p>If a refund is applicable under our cancellation policy, our accounting team will process it within 2-3 business days.</p>
            """
            n_email = await NotificationService.record_and_dispatch_email(
                db, cust_email, "CUSTOMER_CANCELLATION", subj, html, booking.id
            )
            notifs.append(n_email)

        # Ops alert
        ops_subj = f"[OPS ALERT] Booking #{booking.booking_number} CANCELLED"
        ops_html = f"<p>Booking #{booking.booking_number} for {cust_name} has been cancelled. Reason: {reason}</p>"
        n_ops = await NotificationService.record_and_dispatch_email(
            db, NotificationService.OPS_EMAIL, "OPS_CANCELLATION_ALERT", ops_subj, ops_html, booking.id
        )
        notifs.append(n_ops)

        return notifs
