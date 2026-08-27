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
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'operate'
  | 'quotes'
  | 'driver-portal'
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
        { id: 'operate', label: 'Live Operate Board', icon: CalendarDays, badge: 'Live', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
        { id: 'quotes', label: 'Instant 3D Quoting', icon: Compass, badge: '3D UI', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
      ],
    },
    {
      title: 'OPERATIONS & DISPATCH',
      items: [
        { id: 'driver-portal', label: 'Driver Mobile PWA', icon: Smartphone, badge: 'App', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
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
      <div className="h-16 md:h-18 px-5 flex items-center justify-between border-b border-[#1F2E4D]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#162036] border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
            <Car className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold tracking-tight text-slate-100">CROWN CHAUFFEURS</span>
              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono text-[9px] font-bold">AI</span>
            </div>
            <span className="text-[11px] text-slate-400">Chauffeur Intelligence</span>
          </div>
        </div>

        {/* Mobile Close Button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#162036] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {sections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {sec.title}
            </p>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#162036]/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User / Persona Footer Card */}
      <div className="p-3 border-t border-[#1F2E4D]">
        <div className="p-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
              {user.full_name.charAt(0)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-slate-100 truncate">{user.full_name.split(' ')[0]}</span>
              <span className="text-[10px] text-slate-400 truncate">Melbourne Hub</span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            ACTIVE
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex w-64 min-w-[16rem] h-screen sticky top-0 flex-col z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop blur */}
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          />
          {/* Drawer container */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
