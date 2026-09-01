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
    <header className="sticky top-0 z-30 h-16 md:h-18 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shadow-sm">
      {/* Left: Mobile Hamburger & Melbourne Telemetry */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-[#F8FAFC] border border-slate-200 text-slate-700 hover:text-slate-950 transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Live AEST Clock Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F8FAFC] border border-slate-200 text-xs shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#C2A16B] shadow-sm shadow-[#C2A16B]/50 animate-pulse shrink-0" />
          <span className="hidden sm:inline font-bold text-slate-800">Melbourne Hub</span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="font-mono text-slate-900 font-bold text-[11px] md:text-xs">{timeStr} AEST</span>
        </div>

        <a
          href="https://www.opalchauffeurs.com.au/"
          target="_blank"
          rel="noreferrer"
          className="hidden xl:flex items-center gap-1.5 text-xs text-[#7B6035] hover:text-slate-900 transition-colors font-bold"
        >
          <span>opalchauffeurs.com.au</span>
          <ExternalLink className="w-3 h-3 text-[#C2A16B]" />
        </a>
      </div>

      {/* Right: Engine Badge, Locked Master Admin Badge, Notifications */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Opal Cloud Engine Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF8F5] border border-[#DFCAA8] text-slate-800 text-xs font-bold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#C2A16B] animate-spin" style={{ animationDuration: '8s' }} />
          <span>Opal Cloud Engine</span>
          <span className="px-1.5 py-0.2 rounded bg-[#DFCAA8]/30 text-[#7B6035] text-[10px] font-mono font-black">LIVE</span>
        </div>

        {/* Permanent Master Admin Locked Indicator */}
        <div className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 rounded-xl border border-[#DFCAA8] text-slate-900 bg-[#DFCAA8]/20 text-xs font-bold shadow-sm">
          <Shield className="w-3.5 h-3.5 text-[#7B6035] shrink-0" />
          <span className="font-black">Admin</span>
          <span className="hidden md:inline px-1.5 py-0.2 rounded bg-[#DFCAA8]/40 text-[#534023] text-[10px] font-mono font-black">
            FULL ACCESS
          </span>
        </div>

        {/* Notifications Icon */}
        <button className="relative p-2 md:p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-slate-700 hover:text-slate-950 hover:border-[#DFCAA8] transition-colors shadow-sm">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C2A16B] text-white font-black text-[10px] flex items-center justify-center shadow-md">
            3
          </span>
        </button>
      </div>
    </header>
  );
};
