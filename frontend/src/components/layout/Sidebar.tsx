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
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'operate'
  | 'quotes'
  | 'driver-portal'
  | 'flights'
  | 'notifications'
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
        { id: 'operate', label: 'Live Operate Board', icon: CalendarDays, badge: 'Live', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        { id: 'quotes', label: 'Instant 3D Quoting', icon: Compass, badge: '3D UI', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
      ],
    },
    {
      title: 'OPERATIONS & DISPATCH',
      items: [
        { id: 'driver-portal', label: 'Driver Mobile PWA', icon: Smartphone, badge: 'App', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
        { id: 'notifications', label: 'Mobile Alert Hub', icon: Bell, badge: 'Pings', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        { id: 'flights', label: 'Airport Flight Radar', icon: Plane, badge: 'Radar', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
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
    <div className="flex flex-col h-full bg-[#0D1322] border-r border-[#1F2E4D] select-none">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between border-b border-[#1F2E4D]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider text-slate-100 uppercase">
              OPAL CHAUFFEURS
            </h1>
            <p className="text-[10px] text-amber-400/90 font-mono tracking-widest uppercase">
              OPERATIONS PLATFORM
            </p>
          </div>
        </div>

        {/* Mobile Close Button */}
        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg bg-[#162036] text-slate-400 hover:text-slate-100 hover:bg-[#1E2C4A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Menu Groups */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <h3 className="px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 font-bold'
                        : 'text-slate-300 hover:text-slate-100 hover:bg-[#162036]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-slate-950' : 'text-amber-400/80 group-hover:text-amber-300'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${
                          isActive
                            ? 'bg-slate-950 text-amber-400 border-amber-400/40'
                            : item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
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

      {/* User Footer Profile */}
      <div className="p-4 border-t border-[#1F2E4D] bg-[#0A0E1A]">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-[#121A2D] border border-[#1F2E4D]">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
            {user?.full_name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{user?.full_name || 'Sonu Tripathi (Director)'}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@opalchauffeurs.com.au'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer with Backdrop Blur */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Touch Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
