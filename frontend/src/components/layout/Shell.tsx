import React, { useState } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { Header } from './Header';

interface ShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ activeTab, onTabChange, children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen max-w-[100vw] w-full bg-[#F8FAFC] text-slate-900 flex overflow-x-hidden">
      {/* Navigation Sidebar (Desktop + Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Viewport Content */}
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto bg-[#F8FAFC]">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
