import asyncio
import logging
import smtplib
import ssl
import uuid
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any, Dict, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Transports this gateway can actually deliver through.
RESEND = "resend"
BREVO = "brevo"
SMTP = "smtp"


class EmailGateway:
    """
    Outbound email dispatcher with a selectable provider.

    settings.EMAIL_PROVIDER picks the transport ("resend", "brevo", "smtp"), or
    "auto" to use whichever one has credentials. When nothing is configured, or
    the provider refuses the message, the attempt is recorded and reported as
    undelivered — it must never claim success for an email that was not sent.
    """

    def __init__(self, api_key: Optional[str] = None):
        # Retained for the older constructor signature used by tests.
        self.api_key = api_key
        self.sent_emails = []  # In-memory record for tests and the undelivered path

    # ------------------------------------------------------------------ helpers

    def _sender_parts(self, from_email: Optional[str]) -> Tuple[str, str]:
        """Returns (display_name, address) for the configured or supplied sender."""
        if from_email:
            return "", from_email.strip()
        return settings.EMAIL_FROM_NAME.strip(), settings.EMAIL_FROM_ADDRESS.strip()

    def _configured_provider(self) -> Optional[str]:
        """Which transport to use, or None when nothing is usable."""
        choice = (settings.EMAIL_PROVIDER or "auto").strip().lower()

        available = {
            RESEND: bool(settings.RESEND_API_KEY),
            BREVO: bool(settings.BREVO_API_KEY),
            SMTP: bool(settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD),
        }

        if choice in available:
            # An explicit choice is honoured only if it can actually send;
            # silently falling back to another provider would change the
            # envelope sender without the operator knowing.
            return choice if available[choice] else None

        if choice not in ("auto", ""):
            # A misspelt provider must surface, not quietly resolve to whichever
            # transport happens to have a key.
            return None

        for name in (RESEND, BREVO, SMTP):
            if available[name]:
                return name
        return None

    def _missing_config_reason(self) -> str:
        choice = (settings.EMAIL_PROVIDER or "auto").strip().lower()
        if choice == RESEND:
            return "EMAIL_PROVIDER is 'resend' but RESEND_API_KEY is not set."
        if choice == BREVO:
            return "EMAIL_PROVIDER is 'brevo' but BREVO_API_KEY is not set."
        if choice == SMTP:
            return (
                "EMAIL_PROVIDER is 'smtp' but SMTP_HOST, SMTP_USERNAME or "
                "SMTP_PASSWORD is not set."
            )
        if choice not in ("auto", ""):
            return (
                f"EMAIL_PROVIDER '{choice}' is not recognised. "
                "Use 'resend', 'brevo', 'smtp' or 'auto'."
            )
        return (
            "No email provider is configured. Set RESEND_API_KEY, BREVO_API_KEY, "
            "or the SMTP_* settings."
        )

    # ---------------------------------------------------------------- providers

    async def _send_via_resend(
        self, name: str, address: str, to_email: str, subject: str,
        html_content: str, text_content: Optional[str]
    ) -> Tuple[Optional[str], Optional[str]]:
        """Returns (provider_message_id, failure_reason)."""
        payload: Dict[str, Any] = {
            "from": formataddr((name, address)) if name else address,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        if text_content:
            payload["text"] = text_content
        if settings.EMAIL_REPLY_TO.strip():
            payload["reply_to"] = settings.EMAIL_REPLY_TO.strip()

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.RESEND_API_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=15.0,
            )
        if resp.status_code in (200, 201, 202):
            try:
                return (resp.json() or {}).get("id"), None
            except Exception:
                return None, None
        return None, f"Resend HTTP {resp.status_code}: {resp.text[:300]}"

    async def _send_via_brevo(
        self, name: str, address: str, to_email: str, subject: str,
        html_content: str, text_content: Optional[str]
    ) -> Tuple[Optional[str], Optional[str]]:
        payload: Dict[str, Any] = {
            "sender": {"email": address, **({"name": name} if name else {})},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }
        if text_content:
            payload["textContent"] = text_content
        if settings.EMAIL_REPLY_TO.strip():
            payload["replyTo"] = {"email": settings.EMAIL_REPLY_TO.strip()}

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.BREVO_API_URL,
                json=payload,
                headers={
                    "api-key": settings.BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                timeout=15.0,
            )
        if resp.status_code in (200, 201, 202):
            try:
                return (resp.json() or {}).get("messageId"), None
            except Exception:
                return None, None
        return None, f"Brevo HTTP {resp.status_code}: {resp.text[:300]}"

    def _smtp_send_blocking(
        self, name: str, address: str, to_email: str, subject: str,
        html_content: str, text_content: Optional[str]
    ) -> None:
        msg = EmailMessage()
        msg["From"] = formataddr((name, address)) if name else address
        msg["To"] = to_email
        msg["Subject"] = subject
        if settings.EMAIL_REPLY_TO.strip():
            msg["Reply-To"] = settings.EMAIL_REPLY_TO.strip()
        msg.set_content(text_content or "This message requires an HTML capable mail client.")
        msg.add_alternative(html_content, subtype="html")

        if settings.SMTP_USE_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP_SSL(
                settings.SMTP_HOST, settings.SMTP_PORT,
                timeout=20, context=ssl.create_default_context()
            ) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)

    async def _send_via_smtp(
        self, name: str, address: str, to_email: str, subject: str,
        html_content: str, text_content: Optional[str]
    ) -> Tuple[Optional[str], Optional[str]]:
        # smtplib is blocking, so keep it off the event loop.
        await asyncio.to_thread(
            self._smtp_send_blocking, name, address, to_email, subject, html_content, text_content
        )
        return None, None

    # ------------------------------------------------------------------- public

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dispatches an email.

        `status` is "SENT" only when a provider accepted the message. Otherwise
        it is "SANDBOX_SIMULATED" and `failure_reason` says why, so the operator
        is never left guessing whether an email went out.
        """
        name, address = self._sender_parts(from_email)
        msg_id = f"msg_em_{uuid.uuid4().hex[:12]}"
        provider = self._configured_provider()
        failure_reason: Optional[str] = None

        if provider:
            senders = {
                RESEND: self._send_via_resend,
                BREVO: self._send_via_brevo,
                SMTP: self._send_via_smtp,
            }
            try:
                provider_id, failure_reason = await senders[provider](
                    name, address, to_email, subject, html_content, text_content
                )
                if not failure_reason:
                    logger.info(
                        f"[LIVE EMAIL SENT VIA {provider.upper()}] "
                        f"id={provider_id or msg_id} to={to_email}"
                    )
                    return {
                        "status": "SENT",
                        "message_id": provider_id or msg_id,
                        "recipient": to_email,
                        "provider": f"{provider.upper()}_LIVE",
                    }
                logger.error(f"[EMAIL {provider.upper()} ERROR] {failure_reason}")
            except Exception as ex:
                failure_reason = f"{provider} request failed: {ex}"
                logger.error(f"[EMAIL {provider.upper()} EXCEPTION] {failure_reason}")
        else:
            failure_reason = self._missing_config_reason()

        record = {
            "message_id": msg_id,
            "to": to_email,
            "from": address,
            "subject": subject,
            "html": html_content,
            "text": text_content or subject,
            "status": "SANDBOX_SIMULATED",
            "failure_reason": failure_reason,
        }
        self.sent_emails.append(record)
        logger.info(f"[EMAIL NOT DELIVERED] To: {to_email} | Subject: '{subject}' | {failure_reason}")
        return {
            "status": "SANDBOX_SIMULATED",
            "message_id": msg_id,
            "recipient": to_email,
            "failure_reason": failure_reason,
            "provider": "SANDBOX_GATEWAY",
        }


email_gateway = EmailGateway()
