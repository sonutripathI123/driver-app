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
