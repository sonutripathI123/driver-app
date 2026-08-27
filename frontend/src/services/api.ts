import axios from 'axios';
import {
  Booking,
  Customer,
  Driver,
  DriverPerformanceKPIItem,
  ExecutiveDashboardSummary,
  Invoice,
  LegStatus,
  Partner,
  PartnerJobOffer,
  TaxSummaryBASReport,
  TripProfitabilityReport,
  Vehicle,
  VehicleUtilizationReport,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/v1`
  : '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('chauffeur_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- API Service Methods ---

export const bookingsApi = {
  list: async (status?: string) => {
    const res = await apiClient.get<{ bookings: Booking[]; total_count: number }>(`/bookings/`, {
      params: { status },
    });
    return res.data;
  },
  getById: async (id: string) => {
    const res = await apiClient.get<Booking>(`/bookings/${id}`);
    return res.data;
  },
  create: async (data: any) => {
    const res = await apiClient.post<Booking>(`/bookings/`, data);
    return res.data;
  },
  updateLegStatus: async (bookingId: string, legId: string, status: LegStatus) => {
    const res = await apiClient.post<Booking>(`/bookings/${bookingId}/legs/${legId}/status`, {
      status,
    });
    return res.data;
  },
};

export const dispatchApi = {
  getOperateBoard: async (date?: string) => {
    const res = await apiClient.get(`/dispatch/operate-board`, { params: { target_date: date } });
    return res.data;
  },
  getDriverAvailability: async (pickupTime: string, durationMinutes = 90) => {
    const res = await apiClient.get<{ available_drivers: Driver[]; busy_drivers: any[] }>(
      `/dispatch/driver-availability`,
      { params: { pickup_datetime: pickupTime, duration_minutes: durationMinutes } }
    );
    return res.data;
  },
  allocateDriver: async (legId: string, driverId: string, vehicleId: string, allocationCost: number) => {
    const res = await apiClient.post(`/dispatch/legs/${legId}/allocate-driver`, {
      driver_id: driverId,
      vehicle_id: vehicleId,
      allocation_cost: allocationCost,
    });
    return res.data;
  },
  offloadPartner: async (legId: string, partnerId: string, partnerPayout: number, partnerRef?: string) => {
    const res = await apiClient.post(`/dispatch/legs/${legId}/offload-partner`, {
      partner_id: partnerId,
      partner_payout_amount: partnerPayout,
      partner_reference: partnerRef,
    });
    return res.data;
  },
};

export const pricingApi = {
  calculateQuote: async (payload: any) => {
    const res = await apiClient.post(`/quotes/calculate`, payload);
    return res.data;
  },
};

export const driverPortalApi = {
  getManifest: async () => {
    const res = await apiClient.get(`/driver-portal/manifest`);
    return res.data;
  },
  updateShiftStatus: async (status: string) => {
    const res = await apiClient.post(`/driver-portal/shift-status`, { status });
    return res.data;
  },
  updateLocation: async (lat: number, lng: number, heading?: number, speed?: number) => {
    const res = await apiClient.post(`/driver-portal/location`, {
      latitude: lat,
      longitude: lng,
      heading,
      speed_kmh: speed,
    });
    return res.data;
  },
  stepLegStatus: async (legId: string, status: string) => {
    const res = await apiClient.post(`/driver-portal/legs/${legId}/step-status`, {
      target_status: status,
    });
    return res.data;
  },
  getEarnings: async () => {
    const res = await apiClient.get(`/driver-portal/earnings`);
    return res.data;
  },
};

export const flightsApi = {
  lookup: async (flightNumber: string, date?: string) => {
    const res = await apiClient.get(`/flights/lookup/${flightNumber}`, { params: { date } });
    return res.data;
  },
  syncLeg: async (legId: string) => {
    const res = await apiClient.post(`/flights/sync-leg/${legId}`);
    return res.data;
  },
  calculateWaitTime: async (payload: any) => {
    const res = await apiClient.post(`/flights/calculate-wait-time`, payload);
    return res.data;
  },
};

export const invoicesApi = {
  list: async (status?: string) => {
    const res = await apiClient.get<{ invoices: Invoice[]; total_count: number; total_outstanding_balance: number }>(
      `/invoices/`,
      { params: { status } }
    );
    return res.data;
  },
  generateFromBooking: async (bookingId: string) => {
    const res = await apiClient.post<Invoice>(`/invoices/generate-from-booking/${bookingId}`);
    return res.data;
  },
  allocateFIFO: async (payload: { customer_id: string; payment_amount: number; payment_method: string; reference_number?: string; notes?: string }) => {
    const res = await apiClient.post(`/invoices/fifo-payment-allocation`, payload);
    return res.data;
  },
  getTaxSummary: async (dateFrom: string, dateTo: string) => {
    const res = await apiClient.get<TaxSummaryBASReport>(`/accounting/tax-summary`, {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return res.data;
  },
  createDriverPayoutBatch: async (payload: any) => {
    const res = await apiClient.post(`/accounting/driver-payout-batches`, payload);
    return res.data;
  },
};

export const partnersApi = {
  list: async () => {
    const res = await apiClient.get<Partner[]>(`/partners/`);
    return res.data;
  },
  create: async (data: any) => {
    const res = await apiClient.post<Partner>(`/partners/`, data);
    return res.data;
  },
  checkCompliance: async (partnerId: string) => {
    const res = await apiClient.get(`/partners/${partnerId}/compliance-check`);
    return res.data;
  },
  broadcastOffer: async (payload: any) => {
    const res = await apiClient.post<PartnerJobOffer>(`/partners/offers`, payload);
    return res.data;
  },
  acceptOffer: async (offerId: string, partnerRef?: string) => {
    const res = await apiClient.post<PartnerJobOffer>(`/partners/offers/${offerId}/accept`, null, {
      params: { partner_reference: partnerRef },
    });
    return res.data;
  },
};

export const analyticsApi = {
  getDashboardSummary: async (dateFrom?: string, dateTo?: string) => {
    const res = await apiClient.get<ExecutiveDashboardSummary>(`/analytics/dashboard-summary`, {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return res.data;
  },
  getTripProfitability: async (dateFrom?: string, dateTo?: string) => {
    const res = await apiClient.get<TripProfitabilityReport>(`/analytics/trip-profitability`, {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return res.data;
  },
  getVehicleUtilization: async (dateFrom?: string, dateTo?: string) => {
    const res = await apiClient.get<VehicleUtilizationReport>(`/analytics/vehicle-utilization`, {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return res.data;
  },
  getDriverKPIs: async (dateFrom?: string, dateTo?: string) => {
    const res = await apiClient.get<{ drivers: DriverPerformanceKPIItem[] }>(`/analytics/driver-kpis`, {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    return res.data;
  },
};

export const fleetApi = {
  getDrivers: async () => {
    const res = await apiClient.get<Driver[]>(`/drivers/`);
    return res.data;
  },
  getVehicles: async () => {
    const res = await apiClient.get<Vehicle[]>(`/vehicles/`);
    return res.data;
  },
};
