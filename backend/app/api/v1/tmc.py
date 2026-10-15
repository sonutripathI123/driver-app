from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rbac import require_ops, require_staff
from app.services.tmc_service import TMCService

router = APIRouter(prefix="/tmc", tags=["TrackMyChauffeur Connector"])


@router.get("/status", dependencies=[Depends(require_staff)])
async def tmc_status():
    """Whether the (read-only) TrackMyChauffeur connector is configured."""
    return {"configured": TMCService.configured()}


@router.get("/fleet-locations", dependencies=[Depends(require_staff)])
async def tmc_fleet_locations():
    """Live driver GPS positions from TrackMyChauffeur (read-only).

    Returns {configured, count, drivers:[{driver_id,name,lat,lng,heading,updated_at}]}.
    An empty list means no driver is currently sharing a location.
    """
    if not TMCService.configured():
        return {"configured": False, "count": 0, "drivers": []}
    try:
        drivers = await TMCService.fetch_active_locations()
        return {"configured": True, "count": len(drivers), "drivers": drivers}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not read live fleet locations: {exc}",
        )


@router.post("/sync-drivers", dependencies=[Depends(require_ops)])
async def tmc_sync_drivers(db: AsyncSession = Depends(get_db)):
    """Pull the driver roster from the live TrackMyChauffeur app into this one.

    Read-only against TMC. Creates drivers that are not here yet and leaves
    already-imported drivers untouched, so manual corrections are preserved.
    Access: ADMIN, OPERATIONS_MANAGER.
    """
    if not TMCService.configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TrackMyChauffeur connector is not configured. Set TMC_USERNAME and TMC_PASSWORD in .env.",
        )
    try:
        return await TMCService.sync_drivers(db)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not sync from TrackMyChauffeur: {exc}",
        )


@router.post("/sync-bookings", dependencies=[Depends(require_ops)])
async def tmc_sync_bookings(db: AsyncSession = Depends(get_db)):
    """Import upcoming non-Zoho TrackMyChauffeur bookings as dispatch-ready DRAFT
    bookings. Read-only against TMC. Skips Zoho-origin rows (this app imports
    those from Zoho directly), rows already imported, and rows matching an
    existing booking by phone + pickup time. No SMS is sent.
    Access: ADMIN, OPERATIONS_MANAGER.
    """
    if not TMCService.configured():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TrackMyChauffeur connector is not configured. Set TMC_USERNAME and TMC_PASSWORD in .env.",
        )
    try:
        return await TMCService.sync_bookings(db)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not sync bookings from TrackMyChauffeur: {exc}",
        )
