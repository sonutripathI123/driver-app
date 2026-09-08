import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Shell } from './components/layout/Shell';
import { NavTab } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { BookingsOperatePage } from './pages/BookingsOperatePage';
import { QuoteBookingPage } from './pages/QuoteBookingPage';
import { DriverPortalPage } from './pages/DriverPortalPage';
import { FlightRadarPage } from './pages/FlightRadarPage';
import { NotificationsHubPage } from './pages/NotificationsHubPage';
import { InvoicingTaxPage } from './pages/InvoicingTaxPage';
import { AnalyticsProfitPage } from './pages/AnalyticsProfitPage';
import { PartnersFleetPage } from './pages/PartnersFleetPage';
import { ClientsCustomersPage } from './pages/ClientsCustomersPage';
import { EmailCommunicationsHubPage } from './pages/EmailCommunicationsHubPage';
import { LoginPage } from './pages/LoginPage';
import { dispatchApi } from './services/api';
import { triggerNativeNotification } from './utils/notificationSound';

const BootSplash: React.FC = () => (
  <div className="min-h-screen bg-[#06090F] text-white flex flex-col items-center justify-center gap-3">
    <LoaderCircle className="w-7 h-7 text-[#DFCAA8] animate-spin" />
    <p className="text-xs font-mono uppercase tracking-widest text-white opacity-80">
      Restoring secure session…
    </p>
  </div>
);

const MILESTONE_LABELS: Record<string, string> = {
  EN_ROUTE: '🚗 Chauffeur En Route to Pickup',
  ARRIVED: '📍 Chauffeur Arrived at Pickup',
  PICKED_UP: '👤 Passenger On Board',
  COMPLETED: '🎉 Trip Successfully Completed',
};

/**
 * Background watcher: notifies when any chauffeur advances any trip.
 *
 * Polls the dispatch live-activity feed, which reads the real leg timestamps.
 * The previous version tracked a single global status for one hardcoded
 * booking, so a second concurrent trip produced no alert at all — and it
 * could not tell a genuine change from another user's.
 */
const useLiveTripWatcher = (enabled: boolean) => {
  // Server time from the previous poll, so events are never missed or repeated
  // because of clock differences between the browser and the API.
  const sinceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      sinceRef.current = null;
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await dispatchApi.getLiveActivity(sinceRef.current ?? undefined);
        if (cancelled) return;

        // The first poll establishes a baseline; announcing history on load
        // would chime for trips that finished hours ago.
        if (sinceRef.current) {
          for (const event of [...data.events].reverse()) {
            const passenger = event.passenger_name ? ` (${event.passenger_name})` : '';

            if (event.kind === 'FLIGHT') {
              // A flight slipping is not a chauffeur milestone; without this it
              // announced itself as "Trip Milestone: ALLOCATED".
              // Named distinctly: `cancelled` above is the effect's cleanup flag.
              const flightCancelled = ['CANCELLED', 'CANCELED'].includes(
                (event.flight_status || '').toUpperCase()
              );
              const title = flightCancelled
                ? `🛑 Flight ${event.flight_number} CANCELLED`
                : `✈️ Flight ${event.flight_number} delayed ${event.flight_delay_minutes}m`;
              const body = flightCancelled
                ? `${event.booking_number}${passenger} needs rebooking — the pickup was not moved automatically.`
                : `${event.booking_number}${passenger} pickup rescheduled. Chauffeur and passenger notified.`;
              triggerNativeNotification(title, body);
              continue;
            }

            const title = MILESTONE_LABELS[event.status] || `🚗 Trip Milestone: ${event.status}`;
            const who = event.driver_name || 'the assigned chauffeur';
            triggerNativeNotification(title, `${event.booking_number}${passenger} updated by ${who}.`);
          }
        }
        sinceRef.current = data.server_time;
      } catch {
        // Auth and network failures are handled by the API interceptor.
      }
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);
};

const AuthenticatedApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActiveTab} />;
      case 'operate':
        return <BookingsOperatePage />;
      case 'quotes':
        return <QuoteBookingPage />;
      case 'driver-portal':
        return <DriverPortalPage />;
      case 'clients':
        return <ClientsCustomersPage />;
      case 'notifications':
        return <NotificationsHubPage />;
      case 'email-hub':
        return <EmailCommunicationsHubPage />;
      case 'flights':
        return <FlightRadarPage />;
      case 'invoicing':
        return <InvoicingTaxPage />;
      case 'analytics':
        return <AnalyticsProfitPage />;
      case 'partners-fleet':
        return <PartnersFleetPage />;
      default:
        return <DashboardPage onNavigate={setActiveTab} />;
    }
  };

  return (
    <Shell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderActivePage()}
    </Shell>
  );
};

// Opened straight from a WhatsApp/SMS dispatch link (/driver or ?view=driver).
const isDirectDriverLink =
  window.location.pathname.includes('/driver') || window.location.search.includes('view=driver');

const AppRoutes: React.FC = () => {
  const { isAuthenticated, isBootstrapping, currentRole } = useAuth();

  // Staff only: the live feed is a staff endpoint, so polling it as a
  // chauffeur would just 403 every interval.
  useLiveTripWatcher(isAuthenticated && currentRole !== 'DRIVER');

  if (isBootstrapping) return <BootSplash />;
  if (!isAuthenticated) return <LoginPage />;

  // Chauffeurs only ever get the mobile portal. Without this a driver signing
  // in landed on the admin dashboard, which then 403s on every staff endpoint.
  const isDriver = currentRole === 'DRIVER';

  if (isDriver || isDirectDriverLink) {
    return (
      <div className="min-h-screen bg-[#070B14] text-slate-100 p-3 sm:p-6 flex flex-col justify-start">
        <DriverPortalPage />
      </div>
    );
  }

  return <AuthenticatedApp />;
};

export const App: React.FC = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
