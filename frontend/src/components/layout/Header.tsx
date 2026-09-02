import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Shield,
  Sparkles,
  ExternalLink,
  Menu,
  Download,
  Smartphone,
  X
} from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { user } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

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

  // PWA Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if on iOS Safari
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      setShowInstallBtn(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBtn(false);
      }
      setDeferredPrompt(null);
    } else {
      // Show iOS modal guide
      setShowIosModal(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 md:h-18 w-full bg-[#06090F]/95 backdrop-blur-md border-b border-[#1E2738] px-4 md:px-8 flex items-center justify-between">
        {/* Left: Mobile Hamburger & Melbourne Telemetry */}
        <div className="flex items-center gap-3">
          {/* Mobile Hamburger Button */}
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#EBDDC8] transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Live AEST Clock Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF6F0] border border-[#E6D8C3] text-xs shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#C2A16B] shadow-sm shadow-[#C2A16B]/50 animate-pulse shrink-0" />
            <span className="hidden sm:inline font-bold text-[#0A0E1A]">Melbourne Hub</span>
            <span className="hidden sm:inline text-slate-400">|</span>
            <span className="font-mono text-[#0A0E1A] font-extrabold text-[11px] md:text-xs">{timeStr} AEST</span>
          </div>

          <a
            href="https://www.opalchauffeurs.com.au/"
            target="_blank"
            rel="noreferrer"
            className="hidden xl:flex items-center gap-1.5 text-xs text-[#DFCAA8] hover:text-white transition-colors font-bold"
          >
            <span>opalchauffeurs.com.au</span>
            <ExternalLink className="w-3 h-3 text-[#DFCAA8]" />
          </a>
        </div>

        {/* Right: PWA Install, Engine Badge, Admin Badge, Notifications */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* PWA 1-Click Install Button */}
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A] hover:bg-[#EBDDC8] text-xs font-black shadow-sm transition-all active:scale-95"
            title="Install as Standalone Mobile / Desktop App"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#0A0E1A]" />
            <span className="hidden sm:inline">Install App</span>
            <span className="px-1 py-0.2 rounded bg-[#06090F] text-[#FAF6F0] text-[9px] font-mono font-bold">PWA</span>
          </button>

          {/* Opal Cloud Engine Status Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-bold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#C2A16B] animate-spin" style={{ animationDuration: '8s' }} />
            <span className="font-bold">Opal Cloud Engine</span>
            <span className="px-1.5 py-0.2 rounded bg-[#06090F] text-[#FAF6F0] text-[10px] font-mono font-black">LIVE</span>
          </div>

          {/* Permanent Master Admin Locked Indicator */}
          <div className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 rounded-xl border border-[#DFCAA8] text-[#0A0E1A] bg-[#DFCAA8] text-xs font-black shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#0A0E1A] shrink-0" />
            <span>Admin</span>
            <span className="hidden md:inline px-1.5 py-0.2 rounded bg-[#06090F] text-[#FAF6F0] text-[10px] font-mono font-black">
              FULL ACCESS
            </span>
          </div>

          {/* Notifications Icon */}
          <button className="relative p-2 md:p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#EBDDC8] transition-colors shadow-sm">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#06090F] text-[#FAF6F0] border border-[#DFCAA8] font-black text-[10px] flex items-center justify-center shadow-md">
              3
            </span>
          </button>
        </div>
      </header>

      {/* iOS Safari Home Screen Modal Guide */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-[#0A0E1A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6D8C3]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#0A0E1A]" />
                <h3 className="font-black text-base">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1 rounded-lg bg-[#E6D8C3] hover:bg-slate-300 text-[#0A0E1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-800">
              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#E6D8C3]">
                <span className="w-6 h-6 rounded-full bg-[#06090F] text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                <p>Safari browser me neeche <strong>Share Button (⎋ / [ ↑ ])</strong> par tap karein.</p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#E6D8C3]">
                <span className="w-6 h-6 rounded-full bg-[#06090F] text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                <p>Menu me scroll karke <strong>"Add to Home Screen" (+ 📲)</strong> select karein.</p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#E6D8C3]">
                <span className="w-6 h-6 rounded-full bg-[#06090F] text-white flex items-center justify-center font-bold text-xs shrink-0">3</span>
                <p>Top-right me <strong>"Add"</strong> par click karein. Yeh direct standalone app ban jayegi!</p>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#06090F] text-white font-black text-xs shadow-md"
            >
              Samajh Gaya (Got it!)
            </button>
          </div>
        </div>
      )}
    </>
  );
};
