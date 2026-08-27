from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ExecutiveDashboardSummary(BaseModel):
    date_from: datetime
    date_to: datetime
    gross_revenue_inc_gst: float
    net_revenue_ex_gst: float
    gst_collected_10pct: float
    total_driver_costs: float
    total_partner_costs: float
    total_direct_costs: float
    gross_profit: float
    gross_profit_margin_pct: float
    total_bookings: int
    completed_trips_count: int
    cancelled_trips_count: int
    cancellation_rate_pct: float
    average_booking_value: float


class TripProfitItem(BaseModel):
    booking_id: str
    booking_number: str
    leg_id: str
    leg_number: int
    pickup_address: str
    dropoff_address: str
    pickup_datetime: datetime
    vehicle_category: str
    status: str
    customer_fare_inc_gst: float
    customer_fare_ex_gst: float
    driver_allocation_cost: float
    partner_payout_amount: float
    direct_cost: float
    gross_profit: float
    margin_pct: float
    is_low_margin: bool  # margin < 25%
    is_negative_margin: bool  # profit < 0


class TripProfitabilityReport(BaseModel):
    date_from: datetime
    date_to: datetime
    total_trips: int
    total_revenue_ex_gst: float
    total_direct_costs: float
    total_gross_profit: float
    average_margin_pct: float
    low_margin_trips_count: int
    negative_margin_trips_count: int
    trips: List[TripProfitItem]


class VehicleUtilizationItem(BaseModel):
    vehicle_id: str
    make_model: str
    registration_plate: str
    category: str
    status: str
    total_trips: int
    total_distance_km: float
    total_revenue_generated: float
    estimated_trip_hours: float
    utilization_rate_pct: float


class VehicleUtilizationReport(BaseModel):
    date_from: datetime
    date_to: datetime
    total_vehicles: int
    fleet_total_trips: int
    fleet_total_distance_km: float
    fleet_total_revenue: float
    vehicles: List[VehicleUtilizationItem]


class DriverPerformanceKPIItem(BaseModel):
    driver_id: str
    full_name: str
    phone: str
    rating: float
    total_trips_completed: int
    total_earnings: float
    on_time_arrival_rate_pct: float
    assigned_trips_count: int


class DriverPerformanceReport(BaseModel):
    date_from: datetime
    date_to: datetime
    total_drivers: int
    total_completed_trips: int
    average_on_time_rate_pct: float
    drivers: List[DriverPerformanceKPIItem]
