from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_ops, require_staff
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
        return {"configured": False, "warming": False, "events": []}
    try:
        events = await ZohoCalendarService.events_in_range(start, end)
        # First load after a restart downloads a large feed in the background;
        # tell the client to retry shortly instead of showing an empty month.
        warming = not ZohoCalendarService.has_cache()
        return {"configured": True, "warming": warming, "events": events}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not read the Zoho calendar feed: {exc}",
        )


@router.post("/dispatch", dependencies=[Depends(require_ops)])
async def zoho_calendar_dispatch(
    uid: str = Query(..., description="The calendar event UID to turn into a booking"),
    db: AsyncSession = Depends(get_db),
):
    """Turn ONE calendar job into a dispatch-ready DRAFT booking on the Operate
    Board (on demand). Idempotent — re-dispatching returns the existing one."""
    if not ZohoCalendarService.configured():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zoho calendar is not connected.")
    try:
        return await ZohoCalendarService.import_event(db, uid)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not create the booking: {exc}",
        )
