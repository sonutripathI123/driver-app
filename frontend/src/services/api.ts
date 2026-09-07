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
  User,
  Vehicle,
  VehicleUtilizationReport,
  ManagerNotificationSettings,
  NotificationItem,
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

// On an expired/invalid token, clear the session so the app falls back to the
// login screen instead of silently rendering empty data.
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';
    if ((status === 401 || status === 403) && !url.includes('/auth/login')) {
      localStorage.removeItem('chauffeur_access_token');
      localStorage.removeItem('chauffeur_refresh_token');
      localStorage.removeItem('chauffeur_user');
      window.dispatchEvent(new Event('chauffeur:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// --- API Service Methods ---

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post<LoginResponse>(`/auth/login`, { email, password });
    return res.data;
  },
  me: async () => {
    const res = await apiClient.get<User>(`/auth/me`);
    return res.data;
  },
  refresh: async (refreshToken: string) => {
    const res = await apiClient.post<LoginResponse>(`/auth/refresh`, { refresh_token: refreshToken });
    return res.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiClient.post(`/auth/change-password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
};

export const bookingsApi = {
  list: async (status?: string) => {
    const res = await apiClient.get<{ bookings: Booking[]; total: number; page_count: number }>(`/bookings/`, {
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
    const res = await apiClient.patch<Booking>(`/bookings/${bookingId}/legs/${legId}/status`, {
      status,
    });
    return res.data;
  },
  getLiveSync: async () => {
    const res = await apiClient.get<any>(`/bookings/live-sync`);
    return res.data;
  },
  updateLiveSync: async (status: string) => {
    const res = await apiClient.post<any>(`/bookings/live-sync`, { status });
    return res.data;
  },
  resetLiveSync: async () => {
    const res = await apiClient.post<any>(`/bookings/live-sync/reset`);
    return res.data;
  },
};

export const dispatchApi = {
  getOperateBoard: async (date?: string) => {
    const res = await apiClient.get(`/dispatch/board`, { params: { target_date: date } });
    return res.data;
  },
  getDriverAvailability: async (pickupTime: string, durationMinutes = 90) => {
    const res = await apiClient.get<DriverAvailabilityItem[]>(
      `/dispatch/available-drivers`,
      { params: { pickup_datetime: pickupTime, duration_minutes: durationMinutes } }
    );
    return res.data;
  },
  allocateDriver: async (legId: string, driverId: string, vehicleId: string, allocationCost: number) => {
    const res = await apiClient.post(`/dispatch/legs/${legId}/allocate`, {
      driver_id: driverId,
      vehicle_id: vehicleId,
      allocation_cost: allocationCost,
    });
    return res.data;
  },
  offloadPartner: async (legId: string, partnerId: string, partnerPayout: number, partnerRef?: string) => {
    const res = await apiClient.post(`/dispatch/legs/${legId}/offload`, {
      partner_id: partnerId,
      partner_payout_amount: partnerPayout,
      partner_reference: partnerRef,
    });
    return res.data;
  },
};

export const pricingApi = {
  calculateQuote: async (payload: any) => {
    const res = await apiClient.post(`/quotes/instant`, payload);
    return res.data;
  },
};

// The backend exposes one endpoint per trip milestone rather than a generic
// status setter, so map the app's status names onto those routes.
const DRIVER_STEP_ENDPOINTS: Record<string, string> = {
  EN_ROUTE: 'en-route',
  ARRIVED: 'arrived',
  PICKED_UP: 'picked-up',
  COMPLETED: 'complete',
};

export interface DriverAvailabilityItem {
  driver_id: string;
  full_name: string;
  status: string;
  is_available: boolean;
  conflict_reason?: string | null;
}

export const driverPortalApi = {
  getProfile: async () => {
    const res = await apiClient.get(`/driver-portal/me`);
    return res.data;
  },
  getManifest: async (filterMode: 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'ALL' = 'ALL') => {
    const res = await apiClient.get(`/driver-portal/jobs`, { params: { filter: filterMode } });
    return res.data;
  },
  updateShiftStatus: async (status: string) => {
    const res = await apiClient.patch(`/driver-portal/status`, { status });
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
    const step = DRIVER_STEP_ENDPOINTS[status];
    if (!step) throw new Error(`Unsupported driver trip step: ${status}`);
    const res = await apiClient.post(`/driver-portal/jobs/${legId}/${step}`);
    return res.data;
  },
  getEarnings: async () => {
    const res = await apiClient.get(`/driver-portal/earnings`);
    return res.data;
  },
};

export const flightsApi = {
  lookup: async (flightNumber: string, flightDate?: string) => {
    const res = await apiClient.get(`/flights/lookup`, {
      params: { flight_number: flightNumber, flight_date: flightDate },
    });
    return res.data;
  },
  syncLeg: async (legId: string) => {
    const res = await apiClient.post(`/flights/legs/${legId}/sync`);
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

export const notificationsApi = {
  getManagerSettings: async () => {
    const res = await apiClient.get<ManagerNotificationSettings>(`/notifications/manager-settings`);
    return res.data;
  },
  updateManagerSettings: async (settings: ManagerNotificationSettings) => {
    const res = await apiClient.post<ManagerNotificationSettings>(`/notifications/manager-settings`, settings);
    return res.data;
  },
  sendTestPing: async (payload: { channel: string; target_phone?: string; custom_message?: string }) => {
    const res = await apiClient.post<NotificationItem>(`/notifications/test-mobile-ping`, payload);
    return res.data;
  },
  getNotificationLogs: async (limit = 50) => {
    const res = await apiClient.get<NotificationItem[]>(`/notifications/`, { params: { limit } });
    return res.data;
  },
};

export const automationsApi = {
  runBalanceChase: async () => {
    const res = await apiClient.post(`/automations/run-balance-chase`);
    return res.data;
  },
  runPreTripConfirmationReminders: async () => {
    const res = await apiClient.post(`/automations/run-pre-trip-confirmation-reminders`);
    return res.data;
  },
  runPreTripHandover: async () => {
    const res = await apiClient.post(`/automations/run-pre-trip-handover`);
    return res.data;
  },
  runAllAutomations: async () => {
    const res = await apiClient.post(`/automations/run-all-automations`);
    return res.data;
  },
};

