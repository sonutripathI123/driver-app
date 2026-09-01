import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Shield,
  Sparkles,
  ExternalLink,
  Menu
} from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { user } = useAuth();
  const [timeStr, setTimeStr] = useState('');

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
          href="https://www.opalchauffeurs.com.au/"
          target="_blank"
          rel="noreferrer"
          className="hidden xl:flex items-center gap-1.5 text-xs text-amber-400/90 hover:text-amber-300 transition-colors font-medium"
        >
          <span>opalchauffeurs.com.au</span>
          <ExternalLink className="w-3 h-3 text-amber-400" />
        </a>
      </div>

      {/* Right: Engine Badge, Locked Master Admin Badge, Notifications */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Engine Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#121A2D] border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm shadow-amber-500/10">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span>FastAPI 2.0</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">ACTIVE</span>
        </div>

        {/* Permanent Master Admin Locked Indicator */}
        <div className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 rounded-xl border border-amber-500/50 text-amber-400 bg-amber-500/10 text-xs font-bold shadow-sm shadow-amber-500/10">
          <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Admin</span>
          <span className="hidden md:inline px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
            FULL ACCESS
          </span>
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
