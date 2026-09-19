"""
Connected mailboxes for the email-to-booking workflow.

Each mailbox is polled over IMAP for new enquiries (stored as inbound_emails
tagged with the mailbox) and used over SMTP to reply from the same address the
client wrote to. Passwords are encrypted at rest and only decrypted in-process
when a connection is opened.

imaplib/smtplib are blocking, so the network calls run in a worker thread and
never stall the event loop.
"""
import asyncio
import email
import imaplib
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret, encrypt_secret
from app.models.mailbox import Mailbox
from app.models.notification import Notification
from app.schemas.mailbox import MailboxCreate, MailboxUpdate
from app.services.inbound_email_service import InboundEmailService


def _hdr(raw: Optional[str]) -> str:
    try:
        return str(make_header(decode_header(raw))) if raw else ""
    except Exception:
        return raw or ""


def _extract_body(msg: email.message.Message) -> Tuple[str, str]:
    text = html = ""
    if msg.is_multipart():
        for part in msg.walk():
            if "attachment" in str(part.get("Content-Disposition") or ""):
                continue
            try:
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                decoded = payload.decode(part.get_content_charset() or "utf-8", "replace")
            except Exception:
                continue
            ctype = part.get_content_type()
            if ctype == "text/plain" and not text:
                text = decoded
            elif ctype == "text/html" and not html:
                html = decoded
    else:
        try:
            payload = msg.get_payload(decode=True)
            decoded = payload.decode(msg.get_content_charset() or "utf-8", "replace") if payload else ""
        except Exception:
            decoded = ""
        if msg.get_content_type() == "text/html":
            html = decoded
        else:
            text = decoded
    return text, html


class MailboxService:

    # ------------------------------------------------------------------ CRUD

    @staticmethod
    async def list_mailboxes(db: AsyncSession, active_only: bool = False) -> List[Mailbox]:
        stmt = select(Mailbox)
        if active_only:
            stmt = stmt.where(Mailbox.is_active.is_(True))
        stmt = stmt.order_by(Mailbox.label.asc())
        return list((await db.execute(stmt)).scalars().all())

    @staticmethod
    async def get(db: AsyncSession, mailbox_id: str) -> Mailbox:
        mb = await db.get(Mailbox, mailbox_id)
        if not mb:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mailbox not found.")
        return mb

    @staticmethod
    async def create(db: AsyncSession, payload: MailboxCreate) -> Mailbox:
        mb = Mailbox(
            label=payload.label.strip(),
            email_address=str(payload.email_address).strip().lower(),
            imap_host=payload.imap_host.strip(),
            imap_port=payload.imap_port,
            smtp_host=payload.smtp_host.strip(),
            smtp_port=payload.smtp_port,
            smtp_use_tls=payload.smtp_use_tls,
            username=payload.username.strip(),
            encrypted_password=encrypt_secret(payload.password),
            is_active=payload.is_active,
        )
        db.add(mb)
        await db.commit()
        await db.refresh(mb)
        return mb

    @staticmethod
    async def update(db: AsyncSession, mailbox_id: str, payload: MailboxUpdate) -> Mailbox:
        mb = await MailboxService.get(db, mailbox_id)
        data = payload.model_dump(exclude_unset=True)
        password = data.pop("password", None)
        for key, value in data.items():
            if key == "email_address" and value:
                value = str(value).strip().lower()
            elif isinstance(value, str):
                value = value.strip()
            setattr(mb, key, value)
        if password:
            mb.encrypted_password = encrypt_secret(password)
        await db.commit()
        await db.refresh(mb)
        return mb

    @staticmethod
    async def delete(db: AsyncSession, mailbox_id: str) -> str:
        mb = await MailboxService.get(db, mailbox_id)
        label = mb.label
        await db.delete(mb)
        await db.commit()
        return label

    # ------------------------------------------------------------------ connectivity

    @staticmethod
    def _test_blocking(mb_data: Dict[str, Any]) -> Tuple[bool, bool, str]:
        imap_ok = smtp_ok = False
        notes: List[str] = []
        # IMAP
        try:
            M = imaplib.IMAP4_SSL(mb_data["imap_host"], mb_data["imap_port"])
            M.login(mb_data["username"], mb_data["password"])
            M.select("INBOX")
            M.logout()
            imap_ok = True
        except Exception as exc:
            notes.append(f"IMAP: {exc}")
        # SMTP
        try:
            if mb_data["smtp_use_tls"]:
                with smtplib.SMTP(mb_data["smtp_host"], mb_data["smtp_port"], timeout=15) as s:
                    s.starttls(context=ssl.create_default_context())
                    s.login(mb_data["username"], mb_data["password"])
            else:
                with smtplib.SMTP_SSL(mb_data["smtp_host"], mb_data["smtp_port"], timeout=15,
                                      context=ssl.create_default_context()) as s:
                    s.login(mb_data["username"], mb_data["password"])
            smtp_ok = True
        except Exception as exc:
            notes.append(f"SMTP: {exc}")
        detail = "Both IMAP and SMTP connected." if (imap_ok and smtp_ok) else " | ".join(notes)
        return imap_ok, smtp_ok, detail

    @staticmethod
    async def test_connection(db: AsyncSession, mailbox_id: str) -> Tuple[bool, bool, str]:
        mb = await MailboxService.get(db, mailbox_id)
        mb_data = {
            "imap_host": mb.imap_host, "imap_port": mb.imap_port,
            "smtp_host": mb.smtp_host, "smtp_port": mb.smtp_port, "smtp_use_tls": mb.smtp_use_tls,
            "username": mb.username, "password": decrypt_secret(mb.encrypted_password),
        }
        return await asyncio.to_thread(MailboxService._test_blocking, mb_data)

    # ------------------------------------------------------------------ polling

    @staticmethod
    def _fetch_new_blocking(mb_data: Dict[str, Any], last_uid: Optional[int]) -> Tuple[List[Dict[str, Any]], int, Optional[str]]:
        """Return (parsed items, max_uid_seen, error)."""
        try:
            M = imaplib.IMAP4_SSL(mb_data["imap_host"], mb_data["imap_port"])
            M.login(mb_data["username"], mb_data["password"])
            M.select("INBOX")
            typ, data = M.uid("search", None, "ALL")
            uids = [int(x) for x in data[0].split()] if data and data[0] else []
            if not uids:
                M.logout()
                return [], (last_uid or 0), None
            if last_uid is None:
                # First poll: baseline to newest, do not backfill the inbox.
                mx = max(uids)
                M.logout()
                return [], mx, "BASELINE"
            new = sorted(u for u in uids if u > last_uid)
            items: List[Dict[str, Any]] = []
            mx = last_uid
            for uid in new:
                typ, md = M.uid("fetch", str(uid), "(BODY.PEEK[])")
                mx = max(mx, uid)
                if not md or not md[0]:
                    continue
                msg = email.message_from_bytes(md[0][1])
                name, addr = parseaddr(msg.get("From", ""))
                text, html = _extract_body(msg)
                items.append({
                    "MessageId": msg.get("Message-ID", f"imap-{mb_data['id']}-{uid}"),
                    "From": f"{_hdr(name)} <{addr}>" if name else addr,
                    "Subject": _hdr(msg.get("Subject", "")),
                    "text": text,
                    "html": html,
                    "Date": msg.get("Date", ""),
                })
            M.logout()
            return items, mx, None
        except Exception as exc:
            return [], (last_uid or 0), str(exc)

    @staticmethod
    async def poll_mailbox(db: AsyncSession, mb: Mailbox) -> Dict[str, Any]:
        mb_data = {
            "id": mb.id, "imap_host": mb.imap_host, "imap_port": mb.imap_port,
            "username": mb.username, "password": decrypt_secret(mb.encrypted_password),
        }
        items, max_uid, error = await asyncio.to_thread(MailboxService._fetch_new_blocking, mb_data, mb.last_uid)

        mb.last_polled_at = datetime.now(timezone.utc)
        stored = duplicates = 0

        if error == "BASELINE":
            mb.last_uid = max_uid
            mb.last_poll_error = None
            await db.commit()
            return {"mailbox_id": mb.id, "label": mb.label, "stored": 0, "duplicates": 0, "error": None}

        if error:
            mb.last_poll_error = error[:500]
            await db.commit()
            return {"mailbox_id": mb.id, "label": mb.label, "stored": 0, "duplicates": 0, "error": error}

        for item in items:
            try:
                rec = await InboundEmailService.ingest_item(db, item, provider="imap", mailbox_id=mb.id)
                if rec is None:
                    duplicates += 1
                else:
                    stored += 1
            except ValueError:
                pass
        mb.last_uid = max_uid
        mb.last_poll_error = None
        await db.commit()
        return {"mailbox_id": mb.id, "label": mb.label, "stored": stored, "duplicates": duplicates, "error": None}

    @staticmethod
    async def poll_all(db: AsyncSession) -> List[Dict[str, Any]]:
        results = []
        for mb in await MailboxService.list_mailboxes(db, active_only=True):
            results.append(await MailboxService.poll_mailbox(db, mb))
        return results

    # ------------------------------------------------------------------ reply

    @staticmethod
    def _send_blocking(mb_data: Dict[str, Any], to_email: str, subject: str, html_body: str, text_body: str) -> Optional[str]:
        """Send via the mailbox's SMTP. Returns an error string, or None on success."""
        try:
            msg = EmailMessage()
            msg["From"] = formataddr((mb_data["label"], mb_data["email_address"]))
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.set_content(text_body)
            msg.add_alternative(html_body, subtype="html")
            if mb_data["smtp_use_tls"]:
                with smtplib.SMTP(mb_data["smtp_host"], mb_data["smtp_port"], timeout=20) as s:
                    s.starttls(context=ssl.create_default_context())
                    s.login(mb_data["username"], mb_data["password"])
                    s.send_message(msg)
            else:
                with smtplib.SMTP_SSL(mb_data["smtp_host"], mb_data["smtp_port"], timeout=20,
                                      context=ssl.create_default_context()) as s:
                    s.login(mb_data["username"], mb_data["password"])
                    s.send_message(msg)
            return None
        except Exception as exc:
            return str(exc)

    @staticmethod
    async def send_reply(
        db: AsyncSession, mailbox_id: str, to_email: str, subject: str, message: str,
        booking_id: Optional[str] = None, inbound_id: Optional[str] = None,
    ) -> Notification:
        mb = await MailboxService.get(db, mailbox_id)
        html_body = "<p>" + message.replace("\n", "<br>") + "</p>"
        mb_data = {
            "label": mb.label, "email_address": mb.email_address,
            "smtp_host": mb.smtp_host, "smtp_port": mb.smtp_port, "smtp_use_tls": mb.smtp_use_tls,
            "username": mb.username, "password": decrypt_secret(mb.encrypted_password),
        }
        error = await asyncio.to_thread(
            MailboxService._send_blocking, mb_data, to_email, subject, html_body, message
        )

        notif = Notification(
            id=str(uuid.uuid4()),
            booking_id=booking_id,
            recipient=to_email,
            channel="EMAIL",
            template_name="MAILBOX_REPLY",
            subject=subject,
            content=message,
            status="SENT" if error is None else "FAILED",
            error_message=error,
        )
        db.add(notif)

        # Mark the thread replied so the operator sees it is handled.
        if inbound_id and error is None:
            from app.models.inbound_email import InboundEmail
            thread = await db.get(InboundEmail, inbound_id)
            if thread:
                thread.status = "REPLIED"

        await db.commit()
        await db.refresh(notif)
        return notif
