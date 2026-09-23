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
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import require_staff
from app.schemas.website_ingest import WebsiteBookingIngest, WebsiteBookingIngestResult
from app.services.website_ingest_service import WebsiteIngestService

router = APIRouter(prefix="/website", tags=["Website Ingest"])


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
    expected = (settings.WEBSITE_INGEST_TOKEN or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Website ingest is not enabled. Set WEBSITE_INGEST_TOKEN to switch it on.",
        )

    supplied = (x_website_token or token or "").strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid website token.",
        )

    booking, duplicate = await WebsiteIngestService.ingest(db, payload)
    return WebsiteBookingIngestResult(
        status="duplicate" if duplicate else ("quote" if payload.is_quote_request else "created"),
        booking_number=booking.booking_number,
        total_fare=booking.total_fare,
        duplicate=duplicate,
    )


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
