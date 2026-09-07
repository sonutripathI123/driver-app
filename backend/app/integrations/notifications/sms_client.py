import logging
import os
import urllib.parse
import uuid
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger(__name__)


class SMSGateway:
    """
    SMS & WhatsApp notification dispatcher supporting:
    1. Real Twilio SMS & WhatsApp API (when credentials are provided)
    2. Direct Telegram Bot Webhook API (100% free instant mobile delivery)
    3. Direct WhatsApp Click-to-Chat URI generator
    4. Deterministic dev/sandbox fallback with delivery simulation logging
    """

    def __init__(self):
        self.twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_phone = os.getenv("TWILIO_FROM_PHONE")
        self.twilio_whatsapp_from = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
        self.sent_sms = []

    async def send_sms(
        self,
        to_phone: str,
        message: str,
        from_phone: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dispatches a cellular SMS. If Twilio credentials exist, transmits over telecom network;
        otherwise logs in sandbox outbox.
        """
        clean_phone = to_phone.strip().replace(" ", "").replace("-", "")
        if not clean_phone.startswith("+"):
            clean_phone = f"+{clean_phone}"

        msg_id = f"SM_{uuid.uuid4().hex[:16]}"
        failure_reason: Optional[str] = None

        # If live Twilio credentials configured
        if self.twilio_account_sid and self.twilio_auth_token and self.twilio_phone:
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_account_sid}/Messages.json"
                auth = (self.twilio_account_sid, self.twilio_auth_token)
                data = {
                    "From": from_phone or self.twilio_phone,
                    "To": clean_phone,
                    "Body": message
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, data=data, auth=auth, timeout=10.0)
                    if resp.status_code in (200, 201):
                        res_json = resp.json()
                        logger.info(f"[LIVE SMS SENT VIA TWILIO] SID: {res_json.get('sid')} to {clean_phone}")
                        return {
                            "status": "SENT",
                            "message_id": res_json.get("sid", msg_id),
                            "recipient": clean_phone,
                            "provider": "TWILIO_LIVE"
                        }
                    else:
                        failure_reason = f"Twilio SMS HTTP {resp.status_code}: {resp.text[:300]}"
                        logger.error(f"[TWILIO SMS ERROR] {failure_reason}")
            except Exception as ex:
                failure_reason = f"Twilio SMS request failed: {ex}"
                logger.error(f"[TWILIO EXCEPTION] {failure_reason}")
        else:
            failure_reason = "Twilio SMS credentials are not configured."

        # Dev/Sandbox recording
        record = {
            "message_id": msg_id,
            "to": clean_phone,
            "from": from_phone or "CrownChauffeur",
            "body": message,
            "status": "SANDBOX_SIMULATED"
        }
        self.sent_sms.append(record)
        logger.info(f"[SMS SANDBOX] To: {clean_phone} | Msg: '{message}' | SID: {msg_id}")
        return {
            "status": "SANDBOX_SIMULATED",
            "message_id": msg_id,
            "recipient": clean_phone,
            "failure_reason": failure_reason,
            "provider": "SANDBOX_GATEWAY"
        }

    async def send_whatsapp(
        self,
        to_phone: str,
        message: str
    ) -> Dict[str, Any]:
        """
        Dispatches a WhatsApp message. If Twilio/Meta WhatsApp credentials exist, transmits;
        otherwise provides deep-link for instant 1-tap browser dispatch.
        """
        clean_phone = to_phone.strip().replace(" ", "").replace("-", "").replace("+", "")
        formatted_phone = f"+{clean_phone}"

        msg_id = f"WA_{uuid.uuid4().hex[:16]}"
        whatsapp_url = f"https://api.whatsapp.com/send?phone={clean_phone}&text={urllib.parse.quote(message)}"

        # If live Twilio WhatsApp configured
        failure_reason: Optional[str] = None
        if self.twilio_account_sid and self.twilio_auth_token:
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_account_sid}/Messages.json"
                auth = (self.twilio_account_sid, self.twilio_auth_token)
                data = {
                    "From": self.twilio_whatsapp_from,
                    "To": f"whatsapp:{formatted_phone}",
                    "Body": message
                }
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, data=data, auth=auth, timeout=10.0)
                    if resp.status_code in (200, 201):
                        res_json = resp.json()
                        logger.info(f"[LIVE WHATSAPP SENT] SID: {res_json.get('sid')} to {formatted_phone}")
                        return {
                            "status": "SENT",
                            "message_id": res_json.get("sid", msg_id),
                            "recipient": formatted_phone,
                            "whatsapp_url": whatsapp_url,
                            "provider": "TWILIO_WHATSAPP_LIVE"
                        }
                    # A rejection here used to fall straight through, leaving
                    # a SANDBOX_SIMULATED result with no way to learn why.
                    failure_reason = f"Twilio WhatsApp HTTP {resp.status_code}: {resp.text[:300]}"
                    logger.error(f"[TWILIO WHATSAPP ERROR] {failure_reason}")
            except Exception as ex:
                failure_reason = f"Twilio WhatsApp request failed: {ex}"
                logger.error(f"[WHATSAPP DISPATCH ERROR] {failure_reason}")
        else:
            failure_reason = "Twilio credentials are not configured."

        return {
            "status": "SANDBOX_SIMULATED",
            "message_id": msg_id,
            "recipient": formatted_phone,
            "failure_reason": failure_reason,
            "whatsapp_url": whatsapp_url,
            "provider": "SANDBOX_GATEWAY"
        }

    async def send_telegram(
        self,
        bot_token: str,
        chat_id: str,
        message: str
    ) -> Dict[str, Any]:
        """
        Dispatches 100% Free live instant push alert directly to Telegram app on mobile/desktop.
        """
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=10.0)
                if resp.status_code == 200:
                    logger.info(f"[LIVE TELEGRAM ALERT SENT] Chat ID: {chat_id}")
                    return {"status": "SENT", "provider": "TELEGRAM_LIVE"}
                else:
                    logger.error(f"[TELEGRAM ERROR] Status {resp.status_code}: {resp.text}")
        except Exception as ex:
            logger.error(f"[TELEGRAM DISPATCH EXCEPTION] {str(ex)}")
        return {"status": "FAILED", "provider": "TELEGRAM_LIVE"}


sms_gateway = SMSGateway()

