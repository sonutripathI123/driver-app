"""
Connected mailboxes for the email-to-booking workflow.

The network calls (IMAP poll, SMTP test/reply) are monkeypatched so the tests
never touch a real mail server; what is pinned is the API surface, the
password never leaving the server, encryption at rest, reply recording, and
per-mailbox inbound tagging.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.crypto import decrypt_secret
from app.models.mailbox import Mailbox
from app.models.user import User
from app.services import mailbox_service
from app.services.mailbox_service import MailboxService
from tests.conftest import auth_header

NEW_MAILBOX = {
    "label": "Corporate enquiries",
    "email_address": "corporate@opalchauffeurs.example",
    "imap_host": "imap.example.com",
    "imap_port": 993,
    "smtp_host": "smtp.example.com",
    "smtp_port": 587,
    "smtp_use_tls": True,
    "username": "corporate@opalchauffeurs.example",
    "password": "MailboxAppPw123!",
}


async def _create(client, h, **overrides):
    body = {**NEW_MAILBOX, **overrides}
    return await client.post("/api/v1/mailboxes/", headers=h, json=body)


@pytest.mark.asyncio
async def test_create_mailbox_never_returns_password_and_encrypts_it(client: AsyncClient, admin_user: User, db_session):
    h = auth_header(admin_user)
    resp = await _create(client, h)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "password" not in body and "encrypted_password" not in body
    assert body["label"] == "Corporate enquiries"

    mb = await db_session.get(Mailbox, body["id"])
    assert mb.encrypted_password and mb.encrypted_password != "MailboxAppPw123!"
    assert decrypt_secret(mb.encrypted_password) == "MailboxAppPw123!"


@pytest.mark.asyncio
async def test_update_keeps_password_unless_provided(client: AsyncClient, admin_user: User, db_session):
    h = auth_header(admin_user)
    mid = (await _create(client, h)).json()["id"]

    # Update label only — password must remain.
    await client.patch(f"/api/v1/mailboxes/{mid}", headers=h, json={"label": "Renamed"})
    mb = await db_session.get(Mailbox, mid)
    await db_session.refresh(mb)
    assert decrypt_secret(mb.encrypted_password) == "MailboxAppPw123!"

    # Now change the password.
    await client.patch(f"/api/v1/mailboxes/{mid}", headers=h, json={"password": "NewAppPw456!"})
    mb = await db_session.get(Mailbox, mid)
    await db_session.refresh(mb)
    assert decrypt_secret(mb.encrypted_password) == "NewAppPw456!"


@pytest.mark.asyncio
async def test_list_and_delete(client: AsyncClient, admin_user: User):
    h = auth_header(admin_user)
    mid = (await _create(client, h)).json()["id"]
    listing = await client.get("/api/v1/mailboxes/", headers=h)
    assert any(m["id"] == mid for m in listing.json())
    assert (await client.delete(f"/api/v1/mailboxes/{mid}", headers=h)).status_code == 200
    listing2 = await client.get("/api/v1/mailboxes/", headers=h)
    assert all(m["id"] != mid for m in listing2.json())


@pytest.mark.asyncio
async def test_connection_test_uses_stored_creds(client: AsyncClient, admin_user: User, monkeypatch):
    h = auth_header(admin_user)
    mid = (await _create(client, h)).json()["id"]

    seen = {}

    def fake_test(mb_data):
        seen.update(mb_data)
        return True, True, "Both IMAP and SMTP connected."

    monkeypatch.setattr(MailboxService, "_test_blocking", staticmethod(fake_test))
    resp = await client.post(f"/api/v1/mailboxes/{mid}/test", headers=h)
    assert resp.status_code == 200
    assert resp.json() == {"imap_ok": True, "smtp_ok": True, "detail": "Both IMAP and SMTP connected."}
    # The decrypted password is what gets handed to the connector, not the token.
    assert seen["password"] == "MailboxAppPw123!"


@pytest.mark.asyncio
async def test_reply_records_sent_and_marks_thread(client: AsyncClient, admin_user: User, db_session, monkeypatch):
    h = auth_header(admin_user)
    mid = (await _create(client, h)).json()["id"]

    # Seed an inbound thread on this mailbox.
    from app.models.inbound_email import InboundEmail
    thread = InboundEmail(
        provider="imap", mailbox_id=mid, sender_email="client@corp.example.com",
        subject="Quote please", body_text="Need a quote", status="UNREAD",
    )
    db_session.add(thread)
    await db_session.commit()
    await db_session.refresh(thread)

    monkeypatch.setattr(MailboxService, "_send_blocking", staticmethod(lambda *a, **k: None))
    resp = await client.post(f"/api/v1/mailboxes/{mid}/reply", headers=h, json={
        "to_email": "client@corp.example.com",
        "subject": "Re: Quote please",
        "message": "Here is your quote code: OPAL-500.",
        "inbound_id": thread.id,
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "SENT"

    await db_session.refresh(thread)
    assert thread.status == "REPLIED"


@pytest.mark.asyncio
async def test_reply_failure_is_recorded_not_hidden(client: AsyncClient, admin_user: User, monkeypatch):
    h = auth_header(admin_user)
    mid = (await _create(client, h)).json()["id"]
    monkeypatch.setattr(MailboxService, "_send_blocking", staticmethod(lambda *a, **k: "SMTP 535 auth failed"))
    resp = await client.post(f"/api/v1/mailboxes/{mid}/reply", headers=h, json={
        "to_email": "client@corp.example.com", "subject": "Re: x", "message": "hi",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "FAILED"
    assert "535" in resp.json()["error_message"]


@pytest.mark.asyncio
async def test_inbound_is_tagged_and_filtered_by_mailbox(client: AsyncClient, admin_user: User, db_session, monkeypatch):
    h = auth_header(admin_user)
    mid = (await _create(client, h)).json()["id"]
    mb = await db_session.get(Mailbox, mid)

    # Simulate a poll that finds one new message (bypass real IMAP).
    def fake_fetch(mb_data, last_uid):
        return ([{
            "MessageId": "poll-1", "From": "Jane <jane@corp.example.com>",
            "Subject": "Airport transfer quote", "text": "How much to the airport?", "html": "",
            "Date": "",
        }], 42, None)

    monkeypatch.setattr(MailboxService, "_fetch_new_blocking", staticmethod(fake_fetch))
    # last_uid must be non-None so it isn't treated as the baseline run.
    mb.last_uid = 1
    await db_session.commit()

    result = await MailboxService.poll_mailbox(db_session, mb)
    assert result["stored"] == 1

    listing = await client.get(f"/api/v1/mailboxes/{mid}/inbound", headers=h)
    assert listing.status_code == 200
    rows = listing.json()
    assert len(rows) == 1
    assert rows[0]["sender_email"] == "jane@corp.example.com"


@pytest.mark.asyncio
async def test_mailbox_writes_require_ops(client: AsyncClient, dispatcher_user: User):
    h = auth_header(dispatcher_user)
    assert (await _create(client, h)).status_code == 403
    assert (await client.delete("/api/v1/mailboxes/x", headers=h)).status_code == 403
