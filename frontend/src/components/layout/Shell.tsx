import React, { useState } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { Header } from './Header';
import { LayoutDashboard, CalendarDays, Smartphone, UserCheck, ReceiptText } from 'lucide-react';

interface ShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ activeTab, onTabChange, children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mobileNavItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'operate', label: 'Operate', icon: CalendarDays },
    { id: 'driver-portal', label: 'Driver App', icon: Smartphone },
    { id: 'clients', label: 'Clients', icon: UserCheck },
    { id: 'invoicing', label: 'Invoices', icon: ReceiptText },
  ];

  return (
    <div className="relative min-h-screen max-w-[100vw] w-full bg-[#06090F] text-slate-100 flex overflow-x-hidden">
      {/* Navigation Sidebar (Desktop + Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Viewport Content */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto bg-[#06090F]">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        
        {/* Main Content Area with Bottom Padding for Mobile Nav Dock */}
        <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 min-w-0 overflow-x-hidden pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          📱 NATIVE LUXURY MOBILE BOTTOM NAVIGATION DOCK (Phones & iPads)
      ───────────────────────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#06090F]/95 backdrop-blur-xl border-t border-[#1E2738] px-2 py-1.5 flex items-center justify-around shadow-[0_-5px_25px_rgba(0,0,0,0.7)]">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-90 ${
                isActive
                  ? 'bg-[#FAF6F0] text-[#0A0E1A] shadow-md border border-[#DFCAA8] scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#0A0E1A]' : 'text-[#DFCAA8]'}`} />
              <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'font-black text-[#0A0E1A]' : 'font-semibold text-slate-300'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
