import logging
import uuid
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailGateway:
    """
    Outbound email dispatcher.

    Sends through the Resend HTTP API when RESEND_API_KEY is configured. With no
    key, or when Resend refuses the message, it records the attempt and reports
    that nothing was delivered — it must never claim success for an email that
    was not actually sent.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.RESEND_API_KEY
        self.api_url = settings.RESEND_API_URL
        self.sent_emails = []  # In-memory record, used by tests and the sandbox path

    def _default_sender(self) -> str:
        name = settings.EMAIL_FROM_NAME.strip()
        address = settings.EMAIL_FROM_ADDRESS.strip()
        return f"{name} <{address}>" if name else address

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

        Returns a dict whose `status` is "SENT" only when the provider accepted
        the message. Otherwise it is "SANDBOX_SIMULATED" and `failure_reason`
        explains why, so the operator is not left guessing.
        """
        sender = from_email or self._default_sender()
        msg_id = f"msg_em_{uuid.uuid4().hex[:12]}"
        failure_reason: Optional[str] = None

        if self.api_key:
            payload: Dict[str, Any] = {
                "from": sender,
                "to": [to_email],
                "subject": subject,
                "html": html_content,
            }
            if text_content:
                payload["text"] = text_content
            if settings.EMAIL_REPLY_TO.strip():
                payload["reply_to"] = settings.EMAIL_REPLY_TO.strip()

            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        self.api_url,
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        timeout=15.0,
                    )
                if resp.status_code in (200, 201, 202):
                    provider_id = ""
                    try:
                        provider_id = (resp.json() or {}).get("id", "")
                    except Exception:
                        pass
                    logger.info(f"[LIVE EMAIL SENT VIA RESEND] id={provider_id or msg_id} to={to_email}")
                    return {
                        "status": "SENT",
                        "message_id": provider_id or msg_id,
                        "recipient": to_email,
                        "provider": "RESEND_LIVE",
                    }
                failure_reason = f"Resend HTTP {resp.status_code}: {resp.text[:300]}"
                logger.error(f"[RESEND EMAIL ERROR] {failure_reason}")
            except Exception as ex:
                failure_reason = f"Resend request failed: {ex}"
                logger.error(f"[RESEND EXCEPTION] {failure_reason}")
        else:
            failure_reason = (
                "RESEND_API_KEY is not configured, so the email was recorded but not delivered."
            )

        record = {
            "message_id": msg_id,
            "to": to_email,
            "from": sender,
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
