import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Shield,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Menu
} from 'lucide-react';
import { UserRole } from '../../types';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { user, currentRole, switchRole } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeFormatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setTimeStr(timeFormatter.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    ADMIN: { label: 'Admin (Full Access)', color: 'border-amber-500/50 text-amber-400 bg-amber-500/10' },
    OPERATIONS_MANAGER: { label: 'Operations Lead', color: 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' },
    DISPATCHER: { label: 'Live Dispatcher', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' },
    ACCOUNTANT: { label: 'Accountant (BAS/GST)', color: 'border-purple-500/50 text-purple-400 bg-purple-500/10' },
    DRIVER: { label: 'Driver Portal View', color: 'border-blue-500/50 text-blue-400 bg-blue-500/10' },
    CUSTOMER: { label: 'Corporate Client', color: 'border-rose-500/50 text-rose-400 bg-rose-500/10' },
  };

  return (
    <header className="sticky top-0 z-30 h-16 md:h-18 w-full bg-[#0A0E1A]/90 backdrop-blur-md border-b border-[#1F2E4D] px-4 md:px-8 flex items-center justify-between">
      {/* Left: Mobile Hamburger & Melbourne Telemetry */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-slate-300 hover:text-amber-400 transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Live AEST Clock Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121A2D] border border-[#1F2E4D] text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse shrink-0" />
          <span className="hidden sm:inline font-semibold text-slate-200">Melbourne Hub</span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="font-mono text-slate-300 font-bold text-[11px] md:text-xs">{timeStr} AEST</span>
        </div>

        <a
          href="https://crownchauffeurs.com.au"
          target="_blank"
          rel="noreferrer"
          className="hidden xl:flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors"
        >
          <span>crownchauffeurs.com.au</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Right: Engine Badge, Role Switcher, Notifications */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Engine Status Badge (Desktop only on small screens) */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121A2D] border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm shadow-amber-500/10">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span>FastAPI 2.0</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">ACTIVE</span>
        </div>

        {/* Dynamic RBAC Persona Switcher */}
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${roleLabels[currentRole].color}`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span className="max-w-[70px] sm:max-w-none truncate">{roleLabels[currentRole].label.split(' ')[0]}</span>
            <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Role Dropdown */}
          {roleDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <p className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1.5">Switch RBAC Persona</p>
              {(Object.keys(roleLabels) as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    switchRole(r);
                    setRoleDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                    currentRole === r
                      ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30'
                      : 'text-slate-300 hover:bg-[#162036] hover:text-white'
                  }`}
                >
                  <span>{roleLabels[r].label.split(' ')[0]}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{r.toLowerCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Icon */}
        <button className="relative p-2 md:p-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md shadow-amber-500/40">
            3
          </span>
        </button>
      </div>
    </header>
  );
};
