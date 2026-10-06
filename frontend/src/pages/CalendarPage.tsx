import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  MapPin,
  User,
  Car,
} from 'lucide-react';
import { bookingsApi } from '../services/api';
import type { Booking, BookingStatus } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Status → chip colour. Completed/closed are calm; active trips are bright.
const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-700/60 text-slate-200 border-slate-500',
  QUOTED: 'bg-slate-700/60 text-slate-200 border-slate-500',
  VERIFICATION_REQUIRED: 'bg-amber-900/50 text-amber-200 border-amber-600',
  PAYMENT_PENDING: 'bg-amber-900/50 text-amber-200 border-amber-600',
  CONFIRMED: 'bg-sky-900/50 text-sky-200 border-sky-600',
  ALLOCATED: 'bg-indigo-900/50 text-indigo-200 border-indigo-600',
  DISPATCHED: 'bg-violet-900/50 text-violet-200 border-violet-600',
  EN_ROUTE: 'bg-blue-900/50 text-blue-200 border-blue-500',
  ARRIVED: 'bg-cyan-900/50 text-cyan-200 border-cyan-500',
  PICKED_UP: 'bg-teal-900/50 text-teal-200 border-teal-500',
  COMPLETED: 'bg-emerald-900/50 text-emerald-200 border-emerald-600',
  FINANCIALLY_CLOSED: 'bg-emerald-950/60 text-emerald-300 border-emerald-700',
  CANCELLED: 'bg-rose-950/60 text-rose-300 border-rose-700 line-through opacity-80',
  REFUND_PENDING: 'bg-rose-900/50 text-rose-200 border-rose-600',
};

const statusStyle = (s: BookingStatus | string) =>
  STATUS_STYLE[s] || 'bg-slate-700/60 text-slate-200 border-slate-500';

const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
};

interface CalEntry {
  booking: Booking;
  when: Date;
}

export const CalendarPage: React.FC = () => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>(() => localDateKey(new Date()));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // 200 is the server's max page size; the calendar filters client-side by month.
      const res = await bookingsApi.list(undefined, 200);
      setBookings(res.bookings || []);
    } catch (e: any) {
      // A 422 detail is an array of objects, not a string — never hand a non-string
      // to React or the whole page unmounts (React error #31). Coerce safely.
      const detail = e?.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg).filter(Boolean).join('; ')
          : e?.message;
      setError(msg || 'Could not load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Map every booking to its first leg's pickup date, grouped by local day.
  const byDay = useMemo(() => {
    const map = new Map<string, CalEntry[]>();
    for (const b of bookings) {
      const leg = b.legs && b.legs.length ? b.legs[0] : null;
      if (!leg || !leg.pickup_datetime) continue;
      const when = new Date(leg.pickup_datetime);
      if (isNaN(when.getTime())) continue;
      const key = localDateKey(when);
      const arr = map.get(key) || [];
      arr.push({ booking: b, when });
      map.set(key, arr);
    }
    // Sort each day's entries by time.
    for (const arr of map.values()) arr.sort((a, b) => a.when.getTime() - b.when.getTime());
    return map;
  }, [bookings]);

  // Build the 6-week grid (always 42 cells) starting on the Sunday on/before
  // the first of the month.
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const todayKey = localDateKey(new Date());
  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const monthBookingCount = useMemo(
    () =>
      cells.reduce((n, d) => {
        if (d.getMonth() !== cursor.getMonth()) return n;
        return n + (byDay.get(localDateKey(d))?.length || 0);
      }, 0),
    [cells, byDay, cursor]
  );

  const goPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(localDateKey(now));
  };

  const selectedEntries = byDay.get(selectedKey) || [];
  const selectedLabel = (() => {
    const [y, m, d] = selectedKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#FAF6F0] border border-[#DFCAA8] flex items-center justify-center text-[#0A0E1A] shadow">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Booking Calendar</h1>
            <p className="text-xs text-slate-400 font-medium">
              Har booking apni pickup date pe — {monthBookingCount} booking{monthBookingCount === 1 ? '' : 's'} is month
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#121824] text-white border border-[#1E2738] hover:bg-[#1A2233] transition-colors"
            title="Open Google Calendar"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Google Calendar
          </a>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#121824] text-white border border-[#1E2738] hover:bg-[#1A2233] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between bg-[#06090F] border border-[#1E2738] rounded-xl px-3 py-2.5">
        <button
          onClick={goPrev}
          className="p-2 rounded-lg text-white hover:bg-[#121824] transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-base font-black text-white tracking-wide">{monthLabel}</h2>
          <button
            onClick={goToday}
            className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] hover:opacity-90 transition"
          >
            Today
          </button>
        </div>
        <button
          onClick={goNext}
          className="p-2 rounded-lg text-white hover:bg-[#121824] transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-700 bg-rose-950/50 text-rose-200 px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="bg-[#06090F] border border-[#1E2738] rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#1E2738]">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-2 py-2 text-center text-[10px] font-black tracking-wider text-slate-400 uppercase"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const key = localDateKey(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const entries = byDay.get(key) || [];
            const shown = entries.slice(0, 3);
            const extra = entries.length - shown.length;
            return (
              <button
                key={i}
                onClick={() => setSelectedKey(key)}
                className={`min-h-[96px] text-left p-1.5 border-b border-r border-[#141C2B] align-top transition-colors ${
                  inMonth ? 'bg-[#06090F]' : 'bg-[#040609] opacity-50'
                } ${isSelected ? 'ring-2 ring-inset ring-[#DFCAA8]' : 'hover:bg-[#0B111C]'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
                      isToday
                        ? 'bg-[#FAF6F0] text-[#0A0E1A]'
                        : inMonth
                        ? 'text-slate-200'
                        : 'text-slate-600'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {entries.length > 0 && (
                    <span className="text-[9px] font-black text-slate-500">{entries.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {shown.map((e) => (
                    <div
                      key={e.booking.id}
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-bold truncate ${statusStyle(
                        e.booking.status
                      )}`}
                      title={`${e.booking.booking_number} — ${e.booking.passenger_name}`}
                    >
                      {fmtTime(e.booking.legs[0].pickup_datetime)} · {e.booking.passenger_name}
                    </div>
                  ))}
                  {extra > 0 && (
                    <div className="text-[9px] font-black text-slate-400 px-1">+{extra} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected-day detail */}
      <div className="bg-[#06090F] border border-[#1E2738] rounded-xl p-4">
        <h3 className="text-sm font-black text-white mb-3">{selectedLabel}</h3>
        {selectedEntries.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium">Is din koi booking nahi hai.</p>
        ) : (
          <div className="space-y-2.5">
            {selectedEntries.map((e) => {
              const b = e.booking;
              const leg = b.legs[0];
              return (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-[#0B111C] border border-[#1E2738] rounded-lg px-3 py-2.5"
                >
                  <div className="shrink-0 w-20 text-sm font-black text-[#DFCAA8]">
                    {fmtTime(leg.pickup_datetime)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{b.passenger_name}</span>
                      <span className="text-[10px] font-mono text-slate-500">#{b.booking_number}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="truncate">
                        {leg.pickup_address} → {leg.dropoff_address}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Car className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{leg.vehicle_category}</span>
                      {leg.driver_name && <span>· {leg.driver_name}</span>}
                      <span>· {b.currency} {b.total_fare?.toFixed(2)}</span>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 self-start px-2 py-1 rounded border text-[10px] font-black ${statusStyle(
                      b.status
                    )}`}
                  >
                    {String(b.status).replace(/_/g, ' ')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
