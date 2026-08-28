import React, { useState } from 'react';
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

export const App: React.FC = () => {
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

  return (
    <AuthProvider>
      <Shell activeTab={activeTab} onTabChange={setActiveTab}>
        {renderActivePage()}
      </Shell>
    </AuthProvider>
  );
};

export default App;
