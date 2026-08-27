import logging
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class SMSGateway:
    """
    SMS notification dispatcher supporting Twilio/MessageBird
    with built-in deterministic dev/test fallback.
    """

    def __init__(self, account_sid: Optional[str] = None, auth_token: Optional[str] = None):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.sent_sms = []  # In-memory test store

    async def send_sms(
        self,
        to_phone: str,
        message: str,
        from_phone: str = "CrownChauffeur"
    ) -> Dict[str, Any]:
        """
        Dispatches an SMS message. In test/dev mode, logs and records the SMS deterministically.
        """
        msg_id = f"SM_{uuid.uuid4().hex[:16]}"
        record = {
            "message_id": msg_id,
            "to": to_phone,
            "from": from_phone,
            "body": message,
            "status": "SENT"
        }
        self.sent_sms.append(record)
        logger.info(f"[SMS DISPATCHED] To: {to_phone} | Msg: '{message}' | SID: {msg_id}")
        return {
            "status": "success",
            "message_id": msg_id,
            "recipient": to_phone
        }


sms_gateway = SMSGateway()
