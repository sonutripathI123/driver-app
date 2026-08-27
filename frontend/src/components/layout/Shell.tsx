import React from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { Header } from './Header';

interface ShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ activeTab, onTabChange, children }) => {
  return (
    <div className="relative min-h-screen bg-[#0A0E1A] text-slate-100 flex overflow-hidden">
      {/* Fixed Left Navigation Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />

      {/* Main Viewport Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-[#0A0E1A]">
        <Header />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
