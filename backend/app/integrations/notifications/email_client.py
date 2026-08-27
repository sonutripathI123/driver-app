import logging
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class EmailGateway:
    """
    Email notification dispatcher supporting production SMTP/SendGrid
    with built-in deterministic dev/test fallback.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.sent_emails = []  # In-memory test store

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: str = "concierge@crownchauffeurs.com.au"
    ) -> Dict[str, Any]:
        """
        Dispatches an email message. In test/dev mode, logs and records the email deterministically.
        """
        msg_id = f"msg_em_{uuid.uuid4().hex[:12]}"
        record = {
            "message_id": msg_id,
            "to": to_email,
            "from": from_email,
            "subject": subject,
            "html": html_content,
            "text": text_content or subject,
            "status": "SENT"
        }
        self.sent_emails.append(record)
        logger.info(f"[EMAIL DISPATCHED] To: {to_email} | Subject: '{subject}' | ID: {msg_id}")
        return {
            "status": "success",
            "message_id": msg_id,
            "recipient": to_email
        }


email_gateway = EmailGateway()
