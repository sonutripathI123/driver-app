from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import require_ops
from app.schemas.notification import AutomationRunSummary
from app.services.automation_service import AutomationService

router = APIRouter(prefix="/automations", tags=["Automations & Scheduled Jobs"])


@router.post("/run-balance-chase", response_model=AutomationRunSummary, dependencies=[Depends(require_ops)])
async def trigger_balance_chasing_job(
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger 7/5/3-day automated balance chasing engine.
    Dispatches reminder emails and SMS messages to customers with outstanding balances.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await AutomationService.process_balance_chasing(db=db)


@router.post("/run-pre-trip-handover", response_model=AutomationRunSummary, dependencies=[Depends(require_ops)])
async def trigger_pre_trip_handover_job(
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger 2-hour pre-trip driver handover engine.
    Dispatches chauffeur/vehicle info to customers and passenger details to assigned drivers.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await AutomationService.process_pre_trip_handovers(db=db)
