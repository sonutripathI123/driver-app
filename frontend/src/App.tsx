import React, { useEffect, useRef, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
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
import { bookingsApi } from './services/api';
import { triggerNativeNotification, playNotificationChime } from './utils/notificationSound';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const lastKnownStatusRef = useRef<string | null>(null);

  // Background automated real-time event watcher (Chime sound + Native Pop-up without pressing any buttons!)
  useEffect(() => {
    const checkLiveEvents = async () => {
      try {
        const syncData = await bookingsApi.getLiveSync();
        const currentStatus = syncData?.status;
        if (currentStatus && lastKnownStatusRef.current && lastKnownStatusRef.current !== currentStatus) {
          // Status has changed by driver! Trigger automated sound & notification
          const statusLabels: Record<string, string> = {
            ARRIVED: '📍 Chauffeur Arrived at Pickup (Crown Towers)',
            PICKED_UP: '👤 Passenger On Board (Driving to Melbourne Airport)',
            COMPLETED: '🎉 Trip Successfully Completed! ($460 AUD Settled)',
            EN_ROUTE: '🚗 Chauffeur En Route to Pickup',
          };
          const title = statusLabels[currentStatus] || `🚗 Trip Milestone: ${currentStatus}`;
          const body = `Booking #CCM-2026-9901 (Sahil Tripathi) updated by Chauffeur Sonu Tripathi.`;
          
          triggerNativeNotification(title, body);
        }
        lastKnownStatusRef.current = currentStatus || 'EN_ROUTE';
      } catch (e) {}
    };

    checkLiveEvents();
    const interval = setInterval(checkLiveEvents, 2000);
    return () => clearInterval(interval);
  }, []);

  // Check if opened directly by a driver via WhatsApp/SMS link (e.g. /driver or ?view=driver)
  const isDirectDriverLink =
    window.location.pathname.includes('/driver') || window.location.search.includes('view=driver');

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
      case 'notifications':
        return <NotificationsHubPage />;
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

  if (isDirectDriverLink) {
    return (
      <AuthProvider>
        <div className="min-h-screen bg-[#070B14] text-slate-100 p-3 sm:p-6 flex flex-col justify-start">
          <DriverPortalPage />
        </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Shell activeTab={activeTab} onTabChange={setActiveTab}>
        {renderActivePage()}
      </Shell>
    </AuthProvider>
  );
};

export default App;
