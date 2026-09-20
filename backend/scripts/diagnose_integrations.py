"""
Production readiness diagnostic.

Run on the server to confirm every key and integration is actually configured
and working, WITHOUT sending real messages or exposing secrets:

    cd /var/www/driver-app/backend && PYTHONPATH=. ./venv/bin/python scripts/diagnose_integrations.py

Secrets are shown masked (set / not set + last 4 chars). Where safe, the check
validates the credential for real (SMTP login, Twilio account fetch, DB query,
flight lookup) without sending anything to a customer.
"""
import asyncio
import os
import smtplib
import ssl
import sys

import httpx

from app.core.config import settings

OK = "[ OK ]"
WARN = "[WARN]"
FAIL = "[FAIL]"
INFO = "[info]"

# The VAPID public key the frontend hardcodes (utils/notificationSound.ts).
FRONTEND_VAPID_PUBLIC = "BC83SPc-2FsmI9kDBZWw_JiVvYLhGONl_In6RaUZDwpgWF-JPhjiB9qh3Cn8YgN5VWwVMOFYCGi26mExGvTwyqY"

COMMITTED_JWT_DEFAULT = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"


def mask(value):
    if not value:
        return "(not set)"
    v = str(value)
    return f"set (...{v[-4:]}, len {len(v)})"


def line(status, label, detail=""):
    print(f"{status}  {label:<34} {detail}")


def header(title):
    print("\n" + "=" * 68)
    print(f"  {title}")
    print("=" * 68)


def check_core():
    header("CORE / SECURITY")
    line(INFO, "ENVIRONMENT", settings.ENVIRONMENT)
    line(WARN if settings.DEBUG else OK, "DEBUG", str(settings.DEBUG) + ("  <- turn off in prod" if settings.DEBUG else ""))
    if settings.JWT_SECRET_KEY == COMMITTED_JWT_DEFAULT:
        line(FAIL, "JWT_SECRET_KEY", "STILL the committed default - MUST override in .env")
    else:
        line(OK, "JWT_SECRET_KEY", mask(settings.JWT_SECRET_KEY))
    line(INFO, "CORS_ORIGINS", str(settings.CORS_ORIGINS))
    line(
        FAIL if settings.STRIPE_ALLOW_MOCK else OK,
        "STRIPE_ALLOW_MOCK",
        str(settings.STRIPE_ALLOW_MOCK) + ("  <- MUST be False in prod" if settings.STRIPE_ALLOW_MOCK else ""),
    )


async def check_db():
    header("DATABASE")
    try:
        from sqlalchemy import func, select
        from app.core.database import AsyncSessionLocal
        from app.models.user import User
        from app.models.booking import Booking
        from app.models.mailbox import Mailbox
        async with AsyncSessionLocal() as db:
            users = await db.scalar(select(func.count()).select_from(User))
            bookings = await db.scalar(select(func.count()).select_from(Booking))
            line(OK, "Connection", "select ok")
            line(INFO, "Users / Bookings", f"{users} users, {bookings} bookings")
            # Mailboxes + last poll error
            mbs = (await db.execute(select(Mailbox))).scalars().all()
            if not mbs:
                line(INFO, "Mailboxes", "none connected yet")
            for mb in mbs:
                err = mb.last_poll_error
                line(OK if not err else WARN, f"Mailbox {mb.label}", err or "no poll error")
    except Exception as exc:
        line(FAIL, "Database", f"{type(exc).__name__}: {exc}")


def check_email():
    header("EMAIL (outbound)")
    from app.integrations.notifications.email_client import email_gateway
    provider = email_gateway._configured_provider()
    if not provider:
        line(FAIL, "Provider", email_gateway._missing_config_reason())
        return
    line(OK, "Provider selected", provider)
    if provider == "smtp":
        line(INFO, "SMTP host", f"{settings.SMTP_HOST}:{settings.SMTP_PORT} (TLS={settings.SMTP_USE_TLS})")
        line(INFO, "SMTP user", settings.SMTP_USERNAME)
        try:
            if settings.SMTP_USE_TLS:
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
                    s.starttls(context=ssl.create_default_context())
                    s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            else:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15,
                                      context=ssl.create_default_context()) as s:
                    s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            line(OK, "SMTP login", "authenticated (no email sent)")
        except Exception as exc:
            line(FAIL, "SMTP login", f"{type(exc).__name__}: {exc}")
    elif provider == "resend":
        line(INFO, "RESEND_API_KEY", mask(settings.RESEND_API_KEY))
    elif provider == "brevo":
        line(INFO, "BREVO_API_KEY", mask(settings.BREVO_API_KEY))


def check_twilio():
    header("SMS / WHATSAPP (Twilio)")
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone = os.getenv("TWILIO_FROM_PHONE")
    wa_from = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886 (sandbox default)")
    line(INFO if sid else FAIL, "TWILIO_ACCOUNT_SID", mask(sid) + ("" if (sid or "").startswith("AC") or not sid else "  <- must start with AC"))
    line(INFO if token else FAIL, "TWILIO_AUTH_TOKEN", mask(token))
    line(INFO if from_phone else WARN, "TWILIO_FROM_PHONE", from_phone or "(not set - SMS disabled)")
    line(INFO, "TWILIO_WHATSAPP_FROM", wa_from)
    if not (sid and token):
        line(FAIL, "Twilio", "credentials incomplete - SMS/WhatsApp will simulate, not send")
        return
    try:
        resp = httpx.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}.json",
            auth=(sid, token), timeout=15.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            line(OK, "Twilio credentials", f"valid - account '{data.get('friendly_name', '')}' status={data.get('status')}")
        else:
            line(FAIL, "Twilio credentials", f"HTTP {resp.status_code}: {resp.text[:120]}")
    except Exception as exc:
        line(FAIL, "Twilio credentials", f"{type(exc).__name__}: {exc}")


def check_flight():
    header("FLIGHT TRACKING")
    from app.integrations.flights import flight_provider_status, get_flight_provider
    line(INFO, "FLIGHT_PROVIDER", settings.FLIGHT_PROVIDER)
    line(INFO, "AERODATABOX_API_KEY", mask(settings.AERODATABOX_API_KEY))
    provider = get_flight_provider()
    if provider is None:
        line(FAIL, "Provider", flight_provider_status())
        return
    line(OK, "Provider", type(provider).__name__)
    try:
        data = asyncio.run(provider.get_flight_status("QF400"))
        if data:
            line(OK, "Live lookup (QF400)", f"{data.airline or '?'} status={data.status}")
        else:
            err = getattr(provider, "last_error", None)
            line(WARN, "Live lookup (QF400)", err or "no data for QF400 right now (provider reachable)")
    except Exception as exc:
        line(WARN, "Live lookup", f"{type(exc).__name__}: {exc}")


def check_maps():
    header("MAPS / FARE ROUTING")
    key = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
    if not key or str(key).startswith("AIzaSyPlaceholder"):
        line(FAIL, "GOOGLE_MAPS_API_KEY", "(not set) - quote distances/fares fall back to a ROUGH ESTIMATE, not real routing")
        return
    line(OK, "GOOGLE_MAPS_API_KEY", mask(key))
    try:
        resp = httpx.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params={"origin": "Melbourne Airport", "destination": "Melbourne CBD", "key": key, "mode": "driving"},
            timeout=15.0,
        )
        st = resp.json().get("status")
        line(OK if st == "OK" else FAIL, "Directions API", f"status={st}")
    except Exception as exc:
        line(FAIL, "Directions API", f"{type(exc).__name__}: {exc}")


def check_webpush():
    header("BROWSER / WEB PUSH (VAPID)")
    try:
        import pywebpush  # noqa: F401
        line(OK, "pywebpush", "installed")
    except ImportError:
        line(FAIL, "pywebpush", "NOT installed - push cannot be delivered")
    pub = settings.VAPID_PUBLIC_KEY
    priv = settings.VAPID_PRIVATE_KEY
    line(OK if pub else FAIL, "VAPID_PUBLIC_KEY", mask(pub))
    line(OK if priv else FAIL, "VAPID_PRIVATE_KEY", mask(priv))
    if pub == FRONTEND_VAPID_PUBLIC:
        line(OK, "Frontend/backend VAPID match", "public key matches the frontend - push keypair is consistent")
    else:
        line(FAIL, "Frontend/backend VAPID match",
             "backend VAPID_PUBLIC_KEY does NOT match the key hardcoded in the frontend - push WILL FAIL. "
             "Either keep the committed default on the server, or rebuild the frontend with the new public key.")
    line(INFO, "VAPID_CLAIMS_EMAIL", settings.VAPID_CLAIMS_EMAIL)
    line(INFO, "Note", "subscriptions are in-memory; every backend restart clears them until devices re-enable push")


def check_stripe():
    header("PAYMENTS (Stripe) - optional")
    from app.integrations.stripe_client import stripe_gateway
    line(INFO, "STRIPE_SECRET_KEY", mask(settings.STRIPE_SECRET_KEY))
    line(INFO, "STRIPE_WEBHOOK_SECRET", mask(settings.STRIPE_WEBHOOK_SECRET))
    if stripe_gateway.is_live:
        line(OK, "Mode", "LIVE - real charges/refunds/signed webhooks")
    else:
        line(WARN, "Mode", "not configured - checkout/refund return 503, unsigned webhooks refused (honest, no fabrication)")


def check_tokens():
    header("PUBLIC-ENDPOINT TOKENS")
    line(OK if settings.AUTOMATIONS_CRON_TOKEN else WARN, "AUTOMATIONS_CRON_TOKEN",
         mask(settings.AUTOMATIONS_CRON_TOKEN) if settings.AUTOMATIONS_CRON_TOKEN else "(empty - cron automation OFF)")
    line(OK if settings.INBOUND_EMAIL_TOKEN else INFO, "INBOUND_EMAIL_TOKEN",
         mask(settings.INBOUND_EMAIL_TOKEN) if settings.INBOUND_EMAIL_TOKEN else "(empty - inbound webhook OFF)")
    line(OK if settings.DRIVER_SIGNUP_TOKEN else WARN, "DRIVER_SIGNUP_TOKEN",
         mask(settings.DRIVER_SIGNUP_TOKEN) if settings.DRIVER_SIGNUP_TOKEN else "(empty - driver self-signup OFF)")
    line(OK if settings.MAILBOX_ENCRYPTION_KEY else INFO, "MAILBOX_ENCRYPTION_KEY",
         mask(settings.MAILBOX_ENCRYPTION_KEY) if settings.MAILBOX_ENCRYPTION_KEY else "(empty - derived from JWT_SECRET_KEY)")


def main():
    print("\nOPAL CHAUFFEURS - INTEGRATION DIAGNOSTIC")
    check_core()
    asyncio.run(check_db())
    check_email()
    check_twilio()
    check_maps()
    check_flight()
    check_webpush()
    check_stripe()
    check_tokens()
    print("\nDone. [FAIL] = must fix before handover, [WARN] = feature off/attention, [info]/[ OK ] = fine.\n")


if __name__ == "__main__":
    main()
