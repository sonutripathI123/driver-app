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
import { bookingsApi } from './services/api';
import { triggerNativeNotification } from './utils/notificationSound';

const BootSplash: React.FC = () => (
  <div className="min-h-screen bg-[#06090F] text-white flex flex-col items-center justify-center gap-3">
    <LoaderCircle className="w-7 h-7 text-[#DFCAA8] animate-spin" />
    <p className="text-xs font-mono uppercase tracking-widest text-white opacity-80">
      Restoring secure session…
    </p>
  </div>
);

/** Background watcher: chimes and pops a notification when a chauffeur advances a trip. */
const useLiveTripWatcher = (enabled: boolean) => {
  const lastKnownStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastKnownStatusRef.current = null;
      return;
    }

    const checkLiveEvents = async () => {
      try {
        const syncData = await bookingsApi.getLiveSync();
        const currentStatus = syncData?.status;
        if (currentStatus && lastKnownStatusRef.current && lastKnownStatusRef.current !== currentStatus) {
          const statusLabels: Record<string, string> = {
            ARRIVED: '📍 Chauffeur Arrived at Pickup',
            PICKED_UP: '👤 Passenger On Board',
            COMPLETED: '🎉 Trip Successfully Completed',
            EN_ROUTE: '🚗 Chauffeur En Route to Pickup',
          };
          const title = statusLabels[currentStatus] || `🚗 Trip Milestone: ${currentStatus}`;
          const passenger = syncData?.passenger_name || 'passenger';
          const driver = syncData?.driver_name || 'the assigned chauffeur';
          const ref = syncData?.booking_number || 'booking';
          triggerNativeNotification(title, `${ref} (${passenger}) updated by ${driver}.`);
        }
        lastKnownStatusRef.current = currentStatus || null;
      } catch {
        // Transient network/auth errors are handled by the API interceptor.
      }
    };

    checkLiveEvents();
    const interval = setInterval(checkLiveEvents, 5000);
    return () => clearInterval(interval);
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
  const { isAuthenticated, isBootstrapping } = useAuth();

  useLiveTripWatcher(isAuthenticated);

  if (isBootstrapping) return <BootSplash />;
  if (!isAuthenticated) return <LoginPage />;

  if (isDirectDriverLink) {
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
