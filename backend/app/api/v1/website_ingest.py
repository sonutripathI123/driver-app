"""
Public endpoint the business websites call to push a booking or quote request
straight into the dashboard.

There is no login on a website's server, so this route is protected by a shared
secret (WEBSITE_INGEST_TOKEN) sent in the X-Website-Token header or a ?token=
query parameter, compared with hmac.compare_digest. Empty secret => the route is
switched off and refuses everything, so an unconfigured deployment can't have
bookings injected into it.
"""
import hmac
import logging
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.rbac import require_staff
from app.schemas.website_ingest import WebsiteBookingIngest, WebsiteBookingIngestResult
from app.services.website_ingest_service import WebsiteIngestService

router = APIRouter(prefix="/website", tags=["Website Ingest"])
logger = logging.getLogger("website_ingest")


async def _bg_ingest_form(payload: Any, website: Optional[str]) -> None:
    """Create the quote booking off the request path so the website's webhook
    gets an instant 200 (Elementor's webhook times out after a few seconds and
    would otherwise flag an error even though the booking was created)."""
    async with AsyncSessionLocal() as db:
        try:
            await WebsiteIngestService.ingest_form(db, payload, website=website)
        except Exception:
            logger.exception("Website form ingest failed for payload from %s", website)


async def _bg_ingest_chbs(payload: Any) -> None:
    """Create a real booking from a CHBS order off the request path, so the
    caller (the partner's insert_order integration) gets an instant 200."""
    async with AsyncSessionLocal() as db:
        try:
            await WebsiteIngestService.ingest_chbs(db, payload)
        except Exception:
            logger.exception("CHBS booking ingest failed")


def _check_token(supplied: Optional[str]) -> None:
    expected = (settings.WEBSITE_INGEST_TOKEN or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Website ingest is not enabled. Set WEBSITE_INGEST_TOKEN to switch it on.",
        )
    if not supplied or not hmac.compare_digest(supplied.strip(), expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid website token.")


@router.post("/booking", response_model=WebsiteBookingIngestResult)
async def ingest_website_booking(
    payload: WebsiteBookingIngest,
    token: Optional[str] = Query(None, description="Shared secret, if not sent as a header"),
    x_website_token: Optional[str] = Header(None, alias="X-Website-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a booking (or quote request) from a website form submission.

    Not behind the JWT — the website has no login — so it is protected by the
    WEBSITE_INGEST_TOKEN shared secret. Re-posting the same external_reference
    returns the existing booking rather than creating a duplicate.
    """
    _check_token(x_website_token or token)

    booking, duplicate = await WebsiteIngestService.ingest(db, payload)
    return WebsiteBookingIngestResult(
        status="duplicate" if duplicate else ("quote" if payload.is_quote_request else "created"),
        booking_number=booking.booking_number,
        total_fare=booking.total_fare,
        duplicate=duplicate,
    )


@router.post("/form")
async def ingest_website_form(
    request: Request,
    background_tasks: BackgroundTasks,
    website: Optional[str] = Query(None, description="Which site this came from"),
    token: Optional[str] = Query(None),
    x_website_token: Optional[str] = Header(None, alias="X-Website-Token"),
):
    """
    Lenient intake for a raw website/Elementor form (a *quote enquiry*).

    Accepts JSON or url-encoded/multipart form data in whatever shape the form
    plugin sends. Fields are extracted best-effort and the full raw payload is
    kept in the booking notes, so nothing the customer entered is lost. The
    customer is NOT auto-notified — the team quotes them first. Point Elementor
    Pro's Webhook action at this URL with ?token=... in the URL.

    Responds 200 immediately and creates the booking in the background, so the
    website's webhook never times out.
    """
    _check_token(x_website_token or token)

    payload: Any
    ctype = (request.headers.get("content-type") or "").lower()
    if "application/json" in ctype:
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Body was not valid JSON.")
    else:
        form = await request.form()
        payload = {k: str(v) for k, v in form.multi_items()} if hasattr(form, "multi_items") else dict(form)

    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty form payload.")

    background_tasks.add_task(_bg_ingest_form, payload, website)
    return {"status": "received"}


@router.post("/chbs-booking")
async def ingest_chbs_booking(
    request: Request,
    background_tasks: BackgroundTasks,
    token: Optional[str] = Query(None),
    x_website_token: Optional[str] = Header(None, alias="X-Website-Token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Real confirmed booking from a Chauffeur Booking System (CHBS) order — the
    exact JSON the site posts to the partner's insert_order. Creates a
    dispatchable booking on the Operate Board (customer not re-notified).

    The caller sends the SAME body it sends to insert_order, plus our token.
    Responds 200 immediately; the booking is created in the background.
    """
    _check_token(x_website_token or token)
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Body was not valid JSON.")
    if not isinstance(payload, dict) or not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty or invalid CHBS payload.")

    background_tasks.add_task(_bg_ingest_chbs, payload)
    return {"status": "received"}


@router.get("/status")
async def website_ingest_status(_=Depends(require_staff)):
    """Whether website ingest is wired up. Access: Staff."""
    configured = bool((settings.WEBSITE_INGEST_TOKEN or "").strip())
    return {
        "configured": configured,
        "endpoint": f"{settings.PUBLIC_APP_URL}{settings.API_V1_STR}/website/booking",
        "detail": (
            "Website ingest is enabled. Point each website's booking/quote form at the endpoint "
            "with the X-Website-Token header."
            if configured else
            "Website ingest is off. Set WEBSITE_INGEST_TOKEN on the API service, then have each "
            "website POST its bookings to the endpoint with that token."
        ),
    }
