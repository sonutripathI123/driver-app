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
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] shadow-inner text-white">
      <div className="p-1 rounded-md bg-[#121A2D] text-white">
        <Clock className="w-3.5 h-3.5 animate-spin text-white" style={{ animationDuration: '60s' }} />
      </div>
      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-black text-white">{timeStr}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#121A2D] text-white border border-[#DFCAA8]">AEST</span>
        </div>
        <span className="text-[10px] text-white font-bold">{dateStr} • Melbourne</span>
      </div>
    </div>
  );
};
