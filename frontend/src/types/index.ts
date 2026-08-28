export type UserRole = 'ADMIN' | 'OPERATIONS_MANAGER' | 'DISPATCHER' | 'ACCOUNTANT' | 'DRIVER' | 'CUSTOMER';

export type VehicleCategory = 'SEDAN_EXECUTIVE' | 'SEDAN_PREMIUM' | 'SUV_PREMIUM' | 'PEOPLE_MOVER' | 'MINIBUS';

export type BookingStatus =
  | 'DRAFT'
  | 'QUOTED'
  | 'VERIFICATION_REQUIRED'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'ALLOCATED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'FINANCIALLY_CLOSED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export type LegStatus =
  | 'PENDING'
  | 'ALLOCATED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'UNPAID'
  | 'PARTIAL_DEPOSIT'
  | 'PAID_IN_FULL'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'FAILED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company_name?: string;
  is_vip: boolean;
  total_bookings_count: number;
  total_spend: number;
}

export interface Driver {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  license_number?: string;
  status: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY' | 'SUSPENDED';
  rating: number;
  completed_trips_count?: number;
  total_trips_completed?: number;
  payout_rate_pct?: number;
  current_lat?: number;
  current_lng?: number;
}

export interface Vehicle {
  id: string;
  category: VehicleCategory;
  make: string;
  model: string;
  year: number;
  registration_plate: string;
  passenger_capacity: number;
  luggage_capacity: number;
  is_active: boolean;
  status?: string;
}

export interface Partner {
  id: string;
  company_name: string;
  contact_person?: string;
  contact_name?: string;
  email: string;
  phone: string;
  city?: string;
  abn?: string;
  accreditation_number?: string;
  commission_rate?: number;
  is_active: boolean;
  is_compliance_verified?: boolean;
  is_compliant?: boolean;
  public_liability_expiry?: string;
  insurance_expiry?: string;
  insurance_policy_number?: string;
}

export interface PartnerJobOffer {
  id: string;
  partner_id: string;
  partner_name: string;
  leg_id: string;
  offered_payout: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  expires_at: string;
  notes?: string;
}

export interface BookingLeg {
  id: string;
  booking_id: string;
  leg_number: number;
  status: LegStatus;
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  is_airport_pickup: boolean;
  flight_number?: string;
  flight_delay_minutes: number;
  wait_time_minutes: number;
  wait_time_charge: number;
  vehicle_category: VehicleCategory;
  driver_id?: string;
  driver_name?: string;
  vehicle_id?: string;
  vehicle_plate?: string;
  partner_id?: string;
  partner_name?: string;
  allocation_cost: number;
  partner_payout_amount: number;
  fare_share?: number;
  pickup_notes?: string;
  passenger_notes?: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  source: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  currency: string;
  total_fare: number;
  deposit_required: number;
  paid_amount: number;
  balance_amount: number;
  passenger_name: string;
  passenger_email?: string;
  passenger_phone: string;
  created_at: string;
  legs: BookingLeg[];
}

export interface ExecutiveDashboardSummary {
  date_from: string;
  date_to: string;
  gross_revenue_inc_gst: number;
  net_revenue_ex_gst: number;
  gst_collected_10pct: number;
  total_driver_costs: number;
  total_partner_costs: number;
  total_direct_costs: number;
  gross_profit: number;
  gross_profit_margin_pct: number;
  total_bookings: number;
  completed_trips_count: number;
  cancelled_trips_count: number;
  cancellation_rate_pct: number;
  average_booking_value: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  booking_id?: string;
  customer_name?: string;
  issue_date: string;
  due_date: string;
  total_amount?: number;
  total_inc_gst: number;
  subtotal?: number;
  subtotal_ex_gst: number;
  gst_amount: number;
  amount_paid: number;
  balance_due: number;
  currency?: string;
  paid_at?: string;
  line_items?: any[];
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';
}

export interface TripProfitItem {
  booking_id: string;
  booking_number: string;
  passenger_name: string;
  route_summary: string;
  pickup_datetime: string;
  vehicle_category: string;
  gross_customer_fare: number;
  net_revenue_ex_gst: number;
  driver_payout: number;
  partner_payout: number;
  total_direct_cost: number;
  gross_profit: number;
  margin_percentage: number;
  is_low_margin: boolean;
  is_negative_margin: boolean;
}

export interface TripProfitabilityReport {
  date_from: string;
  date_to: string;
  total_trips: number;
  total_revenue_ex_gst: number;
  total_direct_costs: number;
  total_gross_profit: number;
  average_margin_pct: number;
  low_margin_trips_count: number;
  negative_margin_trips_count: number;
  trips: TripProfitItem[];
}

export interface VehicleUtilizationItem {
  vehicle_id: string;
  make_model: string;
  registration_plate: string;
  category: string;
  status: string;
  total_trips: number;
  total_distance_km: number;
  total_revenue_generated: number;
  estimated_trip_hours: number;
  utilization_rate_pct: number;
}

export interface VehicleUtilizationReport {
  date_from: string;
  date_to: string;
  total_fleet_vehicles: number;
  total_fleet_distance_km: number;
  average_fleet_utilization_pct: number;
  vehicles: VehicleUtilizationItem[];
}

export interface DriverPerformanceKPIItem {
  driver_id: string;
  full_name: string;
  phone: string;
  rating: number;
  total_trips_completed: number;
  total_earnings: number;
  on_time_arrival_rate_pct: number;
  assigned_trips_count: number;
}

export interface TaxSummaryBASReport {
  period_label: string;
  gross_sales_inc_gst: number;
  gst_collected_10pct: number;
  net_sales_ex_gst: number;
  driver_payouts_total: number;
  net_operating_margin: number;
}

export interface ManagerNotificationSettings {
  manager_phone: string;
  manager_email: string;
  whatsapp_enabled: boolean;
  sms_enabled: boolean;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  browser_push_enabled: boolean;
  alert_on_new_booking: boolean;
  alert_on_driver_allocation: boolean;
  alert_on_driver_rejection: boolean;
  alert_on_unassigned_urgent: boolean;
  alert_on_trip_milestones: boolean;
  alert_on_flight_delay: boolean;
  alert_on_payment_received: boolean;
}

export interface NotificationItem {
  id: string;
  booking_id?: string;
  recipient: string;
  channel: string;
  template_name: string;
  subject?: string;
  content: string;
  status: string;
  error_message?: string;
  created_at: string;
}
