import csv
import io
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking
from app.models.booking_leg import BookingLeg
from app.models.driver import Driver
from app.models.enums import BookingStatus, LegStatus
from app.models.payment import PaymentTransaction
from app.models.vehicle import Vehicle
from app.schemas.analytics import (
    DriverPerformanceKPIItem,
    DriverPerformanceReport,
    ExecutiveDashboardSummary,
    TripProfitItem,
    TripProfitabilityReport,
    VehicleUtilizationItem,
    VehicleUtilizationReport,
)
from app.services.accounting_service import calculate_australian_gst


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AnalyticsService:
    @staticmethod
    async def get_executive_dashboard(
        db: AsyncSession,
        date_from: datetime,
        date_to: datetime
    ) -> ExecutiveDashboardSummary:
        """
        Computes high-level Executive Financial & Operational KPIs across selected timeframe.
        Enforces 10% Australian GST breakdown and Net Margin tracking.
        """
        from_utc = ensure_utc(date_from)
        to_utc = ensure_utc(date_to)

        # 1. Fetch bookings in date window
        stmt = (
            select(Booking)
            .where(
                Booking.created_at >= from_utc,
                Booking.created_at <= to_utc
            )
            .options(selectinload(Booking.legs))
        )
        res = await db.execute(stmt)
        bookings = list(res.scalars().all())

        total_bookings = len(bookings)
        valid_bookings = [b for b in bookings if b.status != BookingStatus.CANCELLED]
        cancelled_bookings = [b for b in bookings if b.status == BookingStatus.CANCELLED]

        gross_revenue = sum(b.total_fare for b in valid_bookings)
        net_revenue, gst_collected = calculate_australian_gst(gross_revenue)

        # 2. Fetch all completed/active journey legs in timeframe
        leg_stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.pickup_datetime >= from_utc,
                BookingLeg.pickup_datetime <= to_utc
            )
        )
        leg_res = await db.execute(leg_stmt)
        legs = list(leg_res.scalars().all())

        completed_trips = [l for l in legs if l.status == LegStatus.COMPLETED]
        cancelled_trips = [l for l in legs if l.status == LegStatus.CANCELLED]

        driver_costs = sum(l.allocation_cost for l in completed_trips if l.driver_id)
        partner_costs = sum(l.partner_payout_amount for l in completed_trips if l.partner_id)
        total_direct_costs = round(driver_costs + partner_costs, 2)

        gross_profit = round(net_revenue - total_direct_costs, 2)
        margin_pct = round((gross_profit / max(1.0, net_revenue)) * 100.0, 2) if net_revenue > 0 else 0.0

        cancellation_rate = round((len(cancelled_trips) / max(1, len(legs))) * 100.0, 2) if legs else 0.0
        abv = round(gross_revenue / max(1, len(valid_bookings)), 2) if valid_bookings else 0.0

        return ExecutiveDashboardSummary(
            date_from=date_from,
            date_to=date_to,
            gross_revenue_inc_gst=round(gross_revenue, 2),
            net_revenue_ex_gst=round(net_revenue, 2),
            gst_collected_10pct=round(gst_collected, 2),
            total_driver_costs=round(driver_costs, 2),
            total_partner_costs=round(partner_costs, 2),
            total_direct_costs=total_direct_costs,
            gross_profit=gross_profit,
            gross_profit_margin_pct=margin_pct,
            total_bookings=total_bookings,
            completed_trips_count=len(completed_trips),
            cancelled_trips_count=len(cancelled_trips),
            cancellation_rate_pct=cancellation_rate,
            average_booking_value=abv
        )

    @staticmethod
    async def get_trip_profitability(
        db: AsyncSession,
        date_from: datetime,
        date_to: datetime,
        low_margin_threshold: float = 25.0
    ) -> TripProfitabilityReport:
        """
        Analyzes individual journey leg financial performance, flagging low and negative margin trips.
        """
        from_utc = ensure_utc(date_from)
        to_utc = ensure_utc(date_to)

        stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.pickup_datetime >= from_utc,
                BookingLeg.pickup_datetime <= to_utc,
                BookingLeg.status != LegStatus.CANCELLED
            )
            .options(selectinload(BookingLeg.booking))
            .order_by(desc(BookingLeg.pickup_datetime))
        )
        res = await db.execute(stmt)
        legs = list(res.scalars().all())

        items: List[TripProfitItem] = []
        total_rev_ex_gst = 0.0
        total_costs = 0.0
        low_margin_count = 0
        neg_margin_count = 0

        for leg in legs:
            b_total = leg.booking.total_fare if leg.booking else 0.0
            legs_count = max(1, len(leg.booking.legs) if leg.booking and leg.booking.legs else 1)
            leg_gross = round(b_total / legs_count, 2)
            leg_ex_gst, _ = calculate_australian_gst(leg_gross)

            direct_cost = round(leg.allocation_cost + leg.partner_payout_amount, 2)
            profit = round(leg_ex_gst - direct_cost, 2)
            margin = round((profit / max(1.0, leg_ex_gst)) * 100.0, 2) if leg_ex_gst > 0 else 0.0

            is_low = margin < low_margin_threshold
            is_neg = profit < 0.0

            if is_low:
                low_margin_count += 1
            if is_neg:
                neg_margin_count += 1

            total_rev_ex_gst += leg_ex_gst
            total_costs += direct_cost

            items.append(
                TripProfitItem(
                    booking_id=leg.booking_id,
                    booking_number=leg.booking.booking_number if leg.booking else "UNKNOWN",
                    leg_id=leg.id,
                    leg_number=leg.leg_number,
                    pickup_address=leg.pickup_address,
                    dropoff_address=leg.dropoff_address,
                    pickup_datetime=leg.pickup_datetime,
                    vehicle_category=leg.vehicle_category.value,
                    status=leg.status.value,
                    customer_fare_inc_gst=leg_gross,
                    customer_fare_ex_gst=leg_ex_gst,
                    driver_allocation_cost=leg.allocation_cost,
                    partner_payout_amount=leg.partner_payout_amount,
                    direct_cost=direct_cost,
                    gross_profit=profit,
                    margin_pct=margin,
                    is_low_margin=is_low,
                    is_negative_margin=is_neg
                )
            )

        total_gross_profit = round(total_rev_ex_gst - total_costs, 2)
        avg_margin = round((total_gross_profit / max(1.0, total_rev_ex_gst)) * 100.0, 2) if total_rev_ex_gst > 0 else 0.0

        return TripProfitabilityReport(
            date_from=date_from,
            date_to=date_to,
            total_trips=len(items),
            total_revenue_ex_gst=round(total_rev_ex_gst, 2),
            total_direct_costs=round(total_costs, 2),
            total_gross_profit=total_gross_profit,
            average_margin_pct=avg_margin,
            low_margin_trips_count=low_margin_count,
            negative_margin_trips_count=neg_margin_count,
            trips=items
        )

    @staticmethod
    async def get_vehicle_utilization(
        db: AsyncSession,
        date_from: datetime,
        date_to: datetime
    ) -> VehicleUtilizationReport:
        """
        Calculates vehicle fleet productivity, completed kilometers, revenue share, and utilization rate.
        """
        from_utc = ensure_utc(date_from)
        to_utc = ensure_utc(date_to)

        v_stmt = select(Vehicle).order_by(Vehicle.make.asc())
        v_res = await db.execute(v_stmt)
        vehicles = list(v_res.scalars().all())

        leg_stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.pickup_datetime >= from_utc,
                BookingLeg.pickup_datetime <= to_utc,
                BookingLeg.status == LegStatus.COMPLETED,
                BookingLeg.vehicle_id.isnot(None)
            )
            .options(selectinload(BookingLeg.booking))
        )
        l_res = await db.execute(leg_stmt)
        completed_legs = list(l_res.scalars().all())

        # Days in period for utilization denominator
        total_days = max(1.0, (to_utc - from_utc).total_seconds() / 86400.0)
        available_hours_per_vehicle = total_days * 10.0  # standard 10-hr operational availability

        items: List[VehicleUtilizationItem] = []
        fleet_trips = 0
        fleet_km = 0.0
        fleet_rev = 0.0

        for v in vehicles:
            v_legs = [l for l in completed_legs if l.vehicle_id == v.id]
            v_count = len(v_legs)
            v_km = sum(l.distance_km or 25.0 for l in v_legs)  # default 25km if unset
            v_duration_mins = sum(l.duration_minutes or 45 for l in v_legs)
            v_trip_hours = round(v_duration_mins / 60.0, 2)

            v_rev = 0.0
            for l in v_legs:
                b_fare = l.booking.total_fare if l.booking else 0.0
                legs_cnt = max(1, len(l.booking.legs) if l.booking and l.booking.legs else 1)
                v_rev += round(b_fare / legs_cnt, 2)

            utilization_pct = round((v_trip_hours / max(1.0, available_hours_per_vehicle)) * 100.0, 2)
            utilization_pct = min(100.0, utilization_pct)

            fleet_trips += v_count
            fleet_km += v_km
            fleet_rev += v_rev

            items.append(
                VehicleUtilizationItem(
                    vehicle_id=v.id,
                    make_model=f"{v.make} {v.model}",
                    registration_plate=v.registration_plate,
                    category=v.category.value,
                    status="ACTIVE" if v.is_active else "INACTIVE",
                    total_trips=v_count,
                    total_distance_km=round(v_km, 2),
                    total_revenue_generated=round(v_rev, 2),
                    estimated_trip_hours=v_trip_hours,
                    utilization_rate_pct=utilization_pct
                )
            )

        return VehicleUtilizationReport(
            date_from=date_from,
            date_to=date_to,
            total_vehicles=len(vehicles),
            fleet_total_trips=fleet_trips,
            fleet_total_distance_km=round(fleet_km, 2),
            fleet_total_revenue=round(fleet_rev, 2),
            vehicles=items
        )

    @staticmethod
    async def get_driver_kpis(
        db: AsyncSession,
        date_from: datetime,
        date_to: datetime
    ) -> DriverPerformanceReport:
        """
        Generates Chauffeur performance KPI scorecards including on-time arrival %, earnings, and ratings.
        """
        from_utc = ensure_utc(date_from)
        to_utc = ensure_utc(date_to)

        d_stmt = select(Driver).order_by(Driver.full_name.asc())
        d_res = await db.execute(d_stmt)
        drivers = list(d_res.scalars().all())

        leg_stmt = (
            select(BookingLeg)
            .where(
                BookingLeg.pickup_datetime >= from_utc,
                BookingLeg.pickup_datetime <= to_utc,
                BookingLeg.driver_id.isnot(None)
            )
        )
        l_res = await db.execute(leg_stmt)
        assigned_legs = list(l_res.scalars().all())

        items: List[DriverPerformanceKPIItem] = []
        total_completed_count = 0
        on_time_rates_sum = 0.0

        for d in drivers:
            d_legs = [l for l in assigned_legs if l.driver_id == d.id]
            d_completed = [l for l in d_legs if l.status == LegStatus.COMPLETED]

            d_earnings = sum(l.allocation_cost for l in d_completed)

            # On-time rate: arrived_at <= pickup_datetime
            on_time_count = 0
            for l in d_completed:
                if l.arrived_at and l.pickup_datetime:
                    if ensure_utc(l.arrived_at) <= ensure_utc(l.pickup_datetime):
                        on_time_count += 1
                else:
                    # If arrived_at not captured, assume compliant
                    on_time_count += 1

            on_time_rate = round((on_time_count / max(1, len(d_completed))) * 100.0, 2) if d_completed else 100.0

            total_completed_count += len(d_completed)
            on_time_rates_sum += on_time_rate

            items.append(
                DriverPerformanceKPIItem(
                    driver_id=d.id,
                    full_name=d.full_name,
                    phone=d.phone,
                    rating=d.rating,
                    total_trips_completed=len(d_completed),
                    total_earnings=round(d_earnings, 2),
                    on_time_arrival_rate_pct=on_time_rate,
                    assigned_trips_count=len(d_legs)
                )
            )

        avg_on_time = round(on_time_rates_sum / max(1, len(drivers)), 2) if drivers else 100.0

        return DriverPerformanceReport(
            date_from=date_from,
            date_to=date_to,
            total_drivers=len(drivers),
            total_completed_trips=total_completed_count,
            average_on_time_rate_pct=avg_on_time,
            drivers=items
        )

    @staticmethod
    async def export_trip_profitability_csv(
        db: AsyncSession,
        date_from: datetime,
        date_to: datetime
    ) -> str:
        """
        Generates RFC 4180 compliant CSV stream for Trip Profitability analysis.
        """
        report = await AnalyticsService.get_trip_profitability(db, date_from, date_to)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Booking Number",
            "Leg Number",
            "Pickup DateTime",
            "Pickup Address",
            "Dropoff Address",
            "Vehicle Category",
            "Status",
            "Customer Fare Inc GST ($)",
            "Customer Fare Ex GST ($)",
            "Driver Cost ($)",
            "Partner Payout ($)",
            "Total Direct Cost ($)",
            "Gross Profit ($)",
            "Margin (%)",
            "Low Margin Alert",
            "Negative Margin Alert"
        ])

        for t in report.trips:
            writer.writerow([
                t.booking_number,
                t.leg_number,
                t.pickup_datetime.isoformat(),
                t.pickup_address,
                t.dropoff_address,
                t.vehicle_category,
                t.status,
                f"{t.customer_fare_inc_gst:.2f}",
                f"{t.customer_fare_ex_gst:.2f}",
                f"{t.driver_allocation_cost:.2f}",
                f"{t.partner_payout_amount:.2f}",
                f"{t.direct_cost:.2f}",
                f"{t.gross_profit:.2f}",
                f"{t.margin_pct:.2f}%",
                "YES" if t.is_low_margin else "NO",
                "YES" if t.is_negative_margin else "NO"
            ])

        return output.getvalue()

    @staticmethod
    async def export_financial_ledger_csv(
        db: AsyncSession,
        date_from: datetime,
        date_to: datetime
    ) -> str:
        """
        Generates Financial Transactions & Payments Ledger CSV.
        """
        from_utc = ensure_utc(date_from)
        to_utc = ensure_utc(date_to)

        stmt = (
            select(PaymentTransaction)
            .where(
                PaymentTransaction.created_at >= from_utc,
                PaymentTransaction.created_at <= to_utc
            )
            .order_by(desc(PaymentTransaction.created_at))
        )
        res = await db.execute(stmt)
        txs = list(res.scalars().all())

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Transaction ID",
            "Date",
            "Booking ID",
            "Customer ID",
            "Invoice ID",
            "Amount ($)",
            "Currency",
            "Payment Type",
            "Payment Method",
            "Status",
            "Reference Number",
            "Notes"
        ])

        for tx in txs:
            writer.writerow([
                tx.id,
                tx.created_at.isoformat(),
                tx.booking_id or "",
                tx.customer_id or "",
                tx.invoice_id or "",
                f"{tx.amount:.2f}",
                tx.currency,
                tx.payment_type,
                tx.payment_method,
                tx.status,
                tx.reference_number or "",
                tx.notes or ""
            ])

        return output.getvalue()
