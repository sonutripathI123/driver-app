from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.rbac import require_accountant, require_ops
from app.schemas.analytics import (
    DriverPerformanceReport,
    ExecutiveDashboardSummary,
    TripProfitabilityReport,
    VehicleUtilizationReport,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Profit Analytics & Executive Reporting"])


def default_start_date() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30)


def default_end_date() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=1)


@router.get("/dashboard-summary", response_model=ExecutiveDashboardSummary, dependencies=[Depends(require_ops)])
async def get_dashboard_summary(
    date_from: Optional[datetime] = Query(None, description="Start date (defaults to 30 days ago)"),
    date_to: Optional[datetime] = Query(None, description="End date (defaults to today + 1 day)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Executive Financial & Operational Dashboard metrics:
    Gross revenue, net revenue ex GST, direct costs, gross profit, margin %, ABV, cancellation rate.
    Access: ADMIN, OPERATIONS_MANAGER, ACCOUNTANT
    """
    d_from = date_from or default_start_date()
    d_to = date_to or default_end_date()
    return await AnalyticsService.get_executive_dashboard(db, d_from, d_to)


@router.get("/trip-profitability", response_model=TripProfitabilityReport, dependencies=[Depends(require_ops)])
async def get_trip_profitability(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    low_margin_threshold: float = Query(25.0, ge=0.0, le=100.0, description="Threshold percentage to flag low margin"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get itemized per-trip financial profitability and margin breakdown with low/negative margin alerts.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, ACCOUNTANT)
    """
    d_from = date_from or default_start_date()
    d_to = date_to or default_end_date()
    return await AnalyticsService.get_trip_profitability(db, d_from, d_to, low_margin_threshold=low_margin_threshold)


@router.get("/vehicle-utilization", response_model=VehicleUtilizationReport, dependencies=[Depends(require_ops)])
async def get_vehicle_utilization(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Vehicle Fleet ROI and Utilization Rates (% trip hours vs operational availability).
    Access: Staff (ADMIN, OPERATIONS_MANAGER)
    """
    d_from = date_from or default_start_date()
    d_to = date_to or default_end_date()
    return await AnalyticsService.get_vehicle_utilization(db, d_from, d_to)


@router.get("/driver-kpis", response_model=DriverPerformanceReport, dependencies=[Depends(require_ops)])
async def get_driver_kpis(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Chauffeur Driver KPI Scorecards: On-time arrival rate %, completed journeys, and total driver earnings.
    Access: Staff (ADMIN, OPERATIONS_MANAGER, ACCOUNTANT)
    """
    d_from = date_from or default_start_date()
    d_to = date_to or default_end_date()
    return await AnalyticsService.get_driver_kpis(db, d_from, d_to)


@router.get("/export/trip-profitability.csv", dependencies=[Depends(require_ops)])
async def export_trip_profitability_csv(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Download RFC 4180 CSV export of Trip Profitability analysis.
    Access: Staff
    """
    d_from = date_from or default_start_date()
    d_to = date_to or default_end_date()
    csv_data = await AnalyticsService.export_trip_profitability_csv(db, d_from, d_to)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=trip_profitability_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )


@router.get("/export/financial-ledger.csv", dependencies=[Depends(require_accountant)])
async def export_financial_ledger_csv(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Download RFC 4180 CSV export of Complete Financial & Payment Transaction Ledger.
    Access: Accountant / Admin only
    """
    d_from = date_from or default_start_date()
    d_to = date_to or default_end_date()
    csv_data = await AnalyticsService.export_financial_ledger_csv(db, d_from, d_to)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=financial_ledger_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"}
    )
