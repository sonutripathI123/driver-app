"""
Ingestion of replies delivered by the email provider's inbound webhook.

Providers disagree on payload shape, so the parsing is deliberately tolerant:
Brevo's inbound parsing posts `{"items": [...]}` with capitalised keys,
SendGrid posts form fields, and a plain integration may post one flat object.
Anything that yields a sender address and some body text is accepted; anything
that does not is rejected loudly rather than stored as a blank thread.
"""
import html as html_module
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.inbound_email import InboundEmail

# Booking numbers as issued by BookingService, e.g. CCM-10004.
BOOKING_REF_PATTERN = re.compile(r"\b([A-Z]{2,5}-\d{4,8})\b")

EMAIL_IN_TEXT = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def _first(source: Dict[str, Any], *keys: str) -> Optional[Any]:
    """First non-empty value among several spellings of the same field."""
    for key in keys:
        value = source.get(key)
        if value not in (None, "", [], {}):
            return value
    return None


def _split_address(raw: Any) -> Tuple[Optional[str], Optional[str]]:
    """
    Pull an address and display name out of whatever the provider sent.

    Handles "Jane Doe <jane@x.com>", a bare address, Brevo's
    {"Address": ..., "Name": ...} and a list of those.
    """
    if raw is None:
        return None, None
    if isinstance(raw, list):
        return _split_address(raw[0]) if raw else (None, None)
    if isinstance(raw, dict):
        address = _first(raw, "Address", "address", "Email", "email")
        name = _first(raw, "Name", "name")
        return (str(address).strip().lower() if address else None, str(name).strip() if name else None)

    text = str(raw).strip()
    match = EMAIL_IN_TEXT.search(text)
    if not match:
        return None, text or None
    address = match.group(0).lower()
    name = text.replace(f"<{match.group(0)}>", "").replace(match.group(0), "").strip(' "\'<>')
    return address, name or None


def _parse_received_at(raw: Any) -> datetime:
    if raw:
        text = str(raw).strip().replace("Z", "+00:00")
        for candidate in (text, text.split(" (")[0]):
            try:
                parsed = datetime.fromisoformat(candidate)
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return datetime.now(timezone.utc)


def extract_items(payload: Any) -> List[Dict[str, Any]]:
    """One webhook call can carry several messages."""
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("items", "Items", "messages", "emails"):
            block = payload.get(key)
            if isinstance(block, list):
                return [item for item in block if isinstance(item, dict)]
        return [payload] if payload else []
    return []


class InboundEmailService:

    @staticmethod
    async def _resolve_booking(db: AsyncSession, *texts: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        """Match a booking number appearing in the subject or body."""
        seen: List[str] = []
        for text in texts:
            if text:
                seen.extend(BOOKING_REF_PATTERN.findall(text.upper()))
        for reference in seen:
            res = await db.execute(select(Booking).where(Booking.booking_number == reference))
            booking = res.scalar_one_or_none()
            if booking:
                return booking.id, booking.booking_number
        return None, None

    @staticmethod
    async def ingest_item(db: AsyncSession, item: Dict[str, Any], provider: str) -> Optional[InboundEmail]:
        """
        Store one inbound message. Returns None when it is a duplicate of one
        already stored, so a provider retry does not double up the inbox.
        """
        sender_email, sender_name = _split_address(
            _first(item, "From", "from", "sender", "Sender", "from_email", "envelope_from")
        )
        if not sender_email:
            raise ValueError("No sender address in the inbound payload.")

        recipient_email, _ = _split_address(_first(item, "To", "to", "recipient", "Recipient", "envelope_to"))

        subject = _first(item, "Subject", "subject") or "(no subject)"
        body_text = _first(item, "RawTextBody", "text", "TextBody", "body_text", "plain", "RawText")
        body_html = _first(item, "RawHtmlBody", "html", "HtmlBody", "body_html")

        if not body_text and body_html:
            # Entities have to be decoded before whitespace is collapsed,
            # otherwise a customer's reply reads as "Please&nbsp;call" in the
            # inbox. Block-level tags become line breaks so paragraphs survive.
            body_text = re.sub(r"<(br|/p|/div|/tr|/li)[^>]*>", "\n", str(body_html), flags=re.I)
            body_text = re.sub(r"<[^>]*>", " ", body_text)
            body_text = html_module.unescape(body_text)
            # Non-breaking spaces arrive as U+00A0, which \s does not match.
            body_text = body_text.replace(" ", " ")
            body_text = re.sub(r"[^\S\n]+", " ", body_text)
            body_text = re.sub(r"\n\s*\n+", "\n\n", body_text)
            body_text = "\n".join(line.strip() for line in body_text.split("\n")).strip()

        message_id = _first(item, "MessageId", "message_id", "Uuid", "uuid", "id")
        message_id = str(message_id) if message_id else None

        if message_id:
            existing = await db.execute(
                select(InboundEmail).where(InboundEmail.provider_message_id == message_id)
            )
            if existing.scalar_one_or_none():
                return None

        booking_id, booking_number = await InboundEmailService._resolve_booking(
            db, str(subject), str(body_text or "")
        )

        record = InboundEmail(
            provider_message_id=message_id,
            provider=provider,
            sender_email=sender_email,
            sender_name=sender_name,
            recipient_email=recipient_email,
            subject=str(subject)[:998],
            body_text=str(body_text) if body_text else None,
            body_html=str(body_html) if body_html else None,
            booking_id=booking_id,
            booking_number=booking_number,
            status="UNREAD",
            received_at=_parse_received_at(_first(item, "SentAtDate", "Date", "date", "received_at", "timestamp")),
        )
        db.add(record)
        return record

    @staticmethod
    async def ingest_payload(db: AsyncSession, payload: Any, provider: str) -> Dict[str, int]:
        items = extract_items(payload)
        if not items:
            raise ValueError("The inbound payload contained no messages.")

        stored = 0
        duplicates = 0
        rejected = 0
        for item in items:
            try:
                record = await InboundEmailService.ingest_item(db, item, provider)
            except ValueError:
                rejected += 1
                continue
            if record is None:
                duplicates += 1
            else:
                stored += 1

        if rejected and not stored and not duplicates:
            # Answer a payload we could make nothing of with a 400, so the
            # misconfiguration shows up in the provider's own webhook log
            # instead of looking like a successful delivery.
            await db.rollback()
            raise ValueError(
                f"None of the {rejected} message(s) in the payload had a usable sender address."
            )

        await db.commit()
        return {
            "received": len(items),
            "stored": stored,
            "duplicates": duplicates,
            "rejected": rejected,
        }
