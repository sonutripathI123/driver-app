import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export const MelbourneClock: React.FC = () => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

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

      const dateFormatter = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      setTimeStr(timeFormatter.format(now));
      setDateStr(dateFormatter.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner">
      <div className="p-1 rounded-md bg-amber-500/10 text-amber-400">
        <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" style={{ animationDuration: '60s' }} />
      </div>
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-bold text-slate-100">{timeStr}</span>
          <span className="text-[10px] font-semibold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">AEST</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">{dateStr} • Melbourne</span>
      </div>
    </div>
  );
};
