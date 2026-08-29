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


@router.post("/run-pre-trip-confirmation-reminders", response_model=AutomationRunSummary, dependencies=[Depends(require_ops)])
async def trigger_pre_trip_confirmation_reminders_job(
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger automated 12-24 hour pre-trip booking confirmation reminder engine.
    - Midnight to 8am trips: Sent at 10am on the day prior.
    - 8am to Midnight trips: Sent at 2pm on the day prior.
    Access: ADMIN, OPERATIONS_MANAGER
    """
    return await AutomationService.process_pre_trip_confirmation_reminders(db=db)


@router.post("/run-all-automations", response_model=AutomationRunSummary, dependencies=[Depends(require_ops)])
async def trigger_all_automations_job(
    db: AsyncSession = Depends(get_db)
):
    """
    Runs all scheduled autonomous jobs:
    1. 7/5/3-day balance chasing
    2. 12-24h customer pre-trip confirmation reminders (10am / 2pm schedule)
    3. 2-hour chauffeur handover packages
    Access: ADMIN, OPERATIONS_MANAGER
    """
    s1 = await AutomationService.process_balance_chasing(db=db)
    s2 = await AutomationService.process_pre_trip_confirmation_reminders(db=db)
    s3 = await AutomationService.process_pre_trip_handovers(db=db)

    return AutomationRunSummary(
        milestone_7d_count=s1.milestone_7d_count,
        milestone_5d_count=s1.milestone_5d_count,
        milestone_3d_count=s1.milestone_3d_count,
        overdue_escalations=s1.overdue_escalations,
        confirmation_reminders_count=s2.confirmation_reminders_count,
        driver_handovers_count=s3.driver_handovers_count,
        total_processed=s1.total_processed + s2.total_processed + s3.total_processed
    )
