import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Compass,
  Smartphone,
  Plane,
  ReceiptText,
  TrendingUp,
  Users,
  Car,
  Bell,
  UserCheck,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'operate'
  | 'quotes'
  | 'driver-portal'
  | 'clients'
  | 'notifications'
  | 'flights'
  | 'invoicing'
  | 'analytics'
  | 'partners-fleet';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { user } = useAuth();

  const sections: {
    title: string;
    items: {
      id: NavTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string;
      badgeColor?: string;
    }[];
  }[] = [
    {
      title: 'INTELLIGENCE & FLEET',
      items: [
        { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard },
        { id: 'operate', label: 'Live Operate Board', icon: CalendarDays, badge: 'Live', badgeColor: 'bg-[#FAF6F0] text-[#0A0E1A] border-[#E6D8C3]' },
        { id: 'quotes', label: 'Instant 3D Quoting', icon: Compass, badge: '3D UI', badgeColor: 'bg-[#FAF6F0] text-[#0A0E1A] border-[#E6D8C3]' },
      ],
    },
    {
      title: 'OPERATIONS & DISPATCH',
      items: [
        { id: 'driver-portal', label: 'Driver Mobile PWA', icon: Smartphone, badge: 'App', badgeColor: 'bg-[#FAF6F0] text-[#0A0E1A] border-[#E6D8C3]' },
        { id: 'clients', label: 'Client & Customer Details', icon: UserCheck, badge: 'Clients', badgeColor: 'bg-[#FAF6F0] text-[#0A0E1A] border-[#E6D8C3]' },
        { id: 'notifications', label: 'Mobile Alert Hub', icon: Bell, badge: 'Pings', badgeColor: 'bg-[#FAF6F0] text-[#0A0E1A] border-[#E6D8C3]' },
        { id: 'flights', label: 'Airport Flight Radar', icon: Plane, badge: 'Radar', badgeColor: 'bg-[#FAF6F0] text-[#0A0E1A] border-[#E6D8C3]' },
        { id: 'partners-fleet', label: 'Partner Network & Fleet', icon: Users },
      ],
    },
    {
      title: 'BUSINESS & ACCOUNTING',
      items: [
        { id: 'invoicing', label: 'GST Invoicing & Remittance', icon: ReceiptText },
        { id: 'analytics', label: 'Profit Analytics & Reports', icon: TrendingUp },
      ],
    },
  ];

  const handleSelect = (id: NavTab) => {
    onTabChange(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#06090F] border-r border-[#1E2738] select-none">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between border-b border-[#1E2738] bg-[#06090F]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] border border-[#DFCAA8] flex items-center justify-center text-[#0A0E1A] shadow-md">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider text-white uppercase">
              ADMIN DASHBOARD
            </h1>
            <p className="text-[10px] text-[#DFCAA8] font-mono tracking-widest uppercase font-bold">
              OPAL CHAUFFEURS AUSTRALIA
            </p>
          </div>
        </div>

        {/* Mobile Close Button */}
        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg bg-[#121824] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Menu Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <h3 className="px-3 text-[10px] font-black tracking-wider text-slate-400 uppercase">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all group ${
                      isActive
                        ? 'bg-[#FAF6F0] text-[#0A0E1A] shadow-lg border border-[#DFCAA8] font-black scale-[1.01]'
                        : 'text-slate-300 hover:text-white hover:bg-[#121824]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-[#0A0E1A]' : 'text-[#DFCAA8] group-hover:text-white'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${
                          isActive
                            ? 'bg-[#06090F] text-[#FAF6F0] border-[#DFCAA8]'
                            : item.badgeColor || 'bg-[#FAF6F0] text-[#0A0E1A] border-[#E6D8C3]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-[#1E2738] bg-[#06090F]">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] shadow-md">
          <div className="w-8 h-8 rounded-lg bg-[#06090F] border border-[#DFCAA8] flex items-center justify-center text-[#DFCAA8] font-black text-xs">
            ST
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-[#0A0E1A] truncate">
              Sonu Tripathi (Director)
            </p>
            <p className="text-[10px] text-slate-600 font-mono truncate font-bold">
              admin@opalchauffeurs.com.au
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 h-screen sticky top-0 shrink-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden animate-in fade-in"
          onClick={onCloseMobile}
        >
          <div
            className="w-72 h-full bg-[#06090F] shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
