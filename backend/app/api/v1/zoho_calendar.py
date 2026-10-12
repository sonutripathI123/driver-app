from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.rbac import require_staff
from app.services.zoho_calendar_service import ZohoCalendarService

router = APIRouter(prefix="/zoho-calendar", tags=["Zoho Calendar"])


@router.get("/events", dependencies=[Depends(require_staff)])
async def zoho_calendar_events(
    start: str = Query(..., description="Range start, YYYY-MM-DD (Melbourne, inclusive)"),
    end: str = Query(..., description="Range end, YYYY-MM-DD (Melbourne, inclusive)"),
):
    """Bookings from the connected Zoho calendar (all channels) within a date
    range. Read-only, server-side; the calendar is never made public."""
    if not ZohoCalendarService.configured():
        return {"configured": False, "events": []}
    try:
        events = await ZohoCalendarService.events_in_range(start, end)
        return {"configured": True, "events": events}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not read the Zoho calendar feed: {exc}",
        )
