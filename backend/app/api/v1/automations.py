import hmac
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.rbac import require_ops
from app.schemas.notification import AutomationRunSummary
from app.services.automation_service import AutomationService
from app.services.flight_service import FlightTrackingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/automations", tags=["Automations & Scheduled Jobs"])


async def _run_every_automation(db: AsyncSession) -> AutomationRunSummary:
    """Runs each scheduled job and merges the counts."""
    # Poll inbound flights first. Nothing else calls this, so without it a delay
    # is only ever noticed when a dispatcher opens a booking and syncs it by
    # hand — by which time the passenger has already landed.
    try:
        synced = await FlightTrackingService.poll_all_active_airport_legs(db=db)
        if synced:
            logger.info(f"[CRON FLIGHTS] synced {len(synced)} airport legs")
    except Exception as ex:
        # A flight provider outage must not stop the payment and handover jobs.
        logger.error(f"[CRON FLIGHTS] polling failed: {ex}")

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


@router.get("/cron/run", response_model=AutomationRunSummary)
async def run_automations_from_scheduler(
    token: Optional[str] = Query(None, description="Shared secret; prefer the X-Cron-Token header"),
    x_cron_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Scheduler entry point for the automation run.

    A GET with a shared secret, because the platform has no internal scheduler
    and free uptime monitors generally only issue GET requests. Each job keeps
    its own persisted sent-markers, so calling this repeatedly will not
    re-send a reminder.

    Pass the secret as the X-Cron-Token header where the scheduler supports
    custom headers; ?token= is accepted for those that do not, at the cost of
    the secret appearing in request logs.
    """
    expected = settings.AUTOMATIONS_CRON_TOKEN.strip()
    if not expected:
        # Never run unauthenticated just because the secret is unset.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTOMATIONS_CRON_TOKEN is not configured, so scheduled runs are disabled."
        )

    supplied = (x_cron_token or token or "").strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing cron token."
        )

    summary = await _run_every_automation(db)
    logger.info(f"[CRON AUTOMATIONS] processed={summary.total_processed}")
    return summary


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
    return await _run_every_automation(db)
