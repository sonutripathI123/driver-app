import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  AlertCircle,
  Clock,
  Send,
  Phone,
  Mail,
  Car,
  Plane,
} from 'lucide-react';
import { zohoCalendarApi } from '../services/api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface ZohoEvent {
  uid?: string;
  title: string;
  location: string;
  date: string; // YYYY-MM-DD (Melbourne)
  time: string; // e.g. "8:00 pm"
  start: string;
  all_day: boolean;
  pickup?: string | null;
  dropoff?: string | null;
  phone?: string | null;
  email?: string | null;
  vehicle?: string | null;
  flight?: string | null;
  name?: string | null;
}

const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const CalendarPage: React.FC = () => {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<ZohoEvent[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>(() => localDateKey(new Date()));
  const [dispatchingUid, setDispatchingUid] = useState<string | null>(null);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const retryRef = useRef(0);

  // The 42-cell grid starting on the Sunday on/before the 1st.
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

  const rangeStart = localDateKey(cells[0]);
  const rangeEnd = localDateKey(cells[cells.length - 1]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await zohoCalendarApi.getEvents(rangeStart, rangeEnd);
      setConfigured(res.configured);
      setEvents(res.events || []);
      if (res.warming) {
        setWarming(true);
        if (retryRef.current < 8) {
          retryRef.current += 1;
          setTimeout(load, 6000); // feed still downloading; retry shortly
        }
      } else {
        setWarming(false);
        retryRef.current = 0;
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not load the calendar.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  const byDay = useMemo(() => {
    const map = new Map<string, ZohoEvent[]>();
    for (const e of events) {
      const arr = map.get(e.date) || [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [events]);

  const todayKey = localDateKey(new Date());
  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const monthCount = useMemo(
    () =>
      cells.reduce((n, d) => {
        if (d.getMonth() !== cursor.getMonth()) return n;
        return n + (byDay.get(localDateKey(d))?.length || 0);
      }, 0),
    [cells, byDay, cursor]
  );

  const handleDispatch = async (ev: ZohoEvent) => {
    if (!ev.uid) return;
    setDispatchingUid(ev.uid);
    setDispatchMsg(null);
    try {
      const r = await zohoCalendarApi.dispatch(ev.uid);
      setDispatchMsg(
        r.status === 'duplicate'
          ? `ℹ️ Ye job pehle se Operate Board pe hai (${r.booking_number}). Wahan jaake driver allocate karo.`
          : `✅ ${r.booking_number} ban gayi — ab "Live Operate Board" pe jaake driver allocate karo.`
      );
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setDispatchMsg(typeof d === 'string' ? d : 'Dispatch banane me dikkat aayi, dobara try karo.');
    } finally {
      setDispatchingUid(null);
    }
  };

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
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
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
            <h1 className="text-xl font-black text-white">Bookings Calendar</h1>
            <p className="text-xs text-slate-400 font-medium">
              Saari bookings (har channel) — {monthCount} is month
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#121824] text-white border border-[#1E2738] hover:bg-[#1A2233] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {dispatchMsg && (
        <div className="rounded-xl border border-[#1E2738] bg-[#0B111C] text-slate-200 px-4 py-2.5 text-sm font-semibold">
          {dispatchMsg}
        </div>
      )}

      {!configured && !loading && (
        <div className="rounded-xl border border-amber-700 bg-[#2A1f12] text-amber-200 px-4 py-3 text-sm font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Zoho calendar connected nahi hai. Server ke .env me ZOHO_ICAL_URL set karo.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-700 bg-rose-950/50 text-rose-200 px-4 py-3 text-sm font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {warming && (
        <div className="rounded-xl border border-[#1E2738] bg-[#0B111C] text-slate-300 px-4 py-2.5 text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> Calendar pehli baar load ho raha hai (~30s)… apne-aap aa jayega.
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between bg-[#06090F] border border-[#1E2738] rounded-xl px-3 py-2.5">
        <button onClick={goPrev} className="p-2 rounded-lg text-white hover:bg-[#121824] transition-colors" aria-label="Previous month">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-base font-black text-white tracking-wide">{monthLabel}</h2>
          <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] hover:opacity-90 transition">
            Today
          </button>
        </div>
        <button onClick={goNext} className="p-2 rounded-lg text-white hover:bg-[#121824] transition-colors" aria-label="Next month">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-[#06090F] border border-[#1E2738] rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#1E2738]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-[10px] font-black tracking-wider text-slate-400 uppercase">
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
                className={`min-h-[92px] text-left p-1.5 border-b border-r border-[#141C2B] align-top transition-colors ${
                  inMonth ? 'bg-[#06090F]' : 'bg-[#040609] opacity-50'
                } ${isSelected ? 'ring-2 ring-inset ring-[#DFCAA8]' : 'hover:bg-[#0B111C]'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
                    isToday ? 'bg-[#FAF6F0] text-[#0A0E1A]' : inMonth ? 'text-slate-200' : 'text-slate-600'
                  }`}>
                    {d.getDate()}
                  </span>
                  {entries.length > 0 && <span className="text-[9px] font-black text-slate-500">{entries.length}</span>}
                </div>
                <div className="space-y-1">
                  {shown.map((e, idx) => (
                    <div
                      key={e.uid || idx}
                      className="px-1.5 py-0.5 rounded border text-[9px] font-bold truncate bg-[#121A2D] text-sky-200 border-sky-800"
                      title={`${e.time} ${e.title}`}
                    >
                      {e.time ? `${e.time} · ` : ''}{e.title}
                    </div>
                  ))}
                  {extra > 0 && <div className="text-[9px] font-black text-slate-400 px-1">+{extra} more</div>}
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
          <p className="text-sm text-slate-400 font-medium">Is din koi booking nahi.</p>
        ) : (
          <div className="space-y-2.5">
            {selectedEntries.map((e, idx) => (
              <div key={e.uid || idx} className="bg-[#0B111C] border border-[#1E2738] rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-black text-[#DFCAA8]">
                      <Clock className="w-3.5 h-3.5 shrink-0" /> {e.time || 'All day'}
                    </div>
                    <div className="text-sm font-bold text-white break-words mt-1">{e.title}</div>
                  </div>
                  {e.uid && (
                    <button
                      onClick={() => handleDispatch(e)}
                      disabled={dispatchingUid === e.uid}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] text-xs font-black hover:opacity-90 disabled:opacity-50"
                      title="Is job ko dispatch-ready booking banao"
                    >
                      <Send className="w-3.5 h-3.5" /> {dispatchingUid === e.uid ? 'Creating…' : 'Dispatch'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-300">
                  {(e.pickup || e.dropoff) && (
                    <div className="sm:col-span-2 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#DFCAA8] shrink-0 mt-0.5" />
                      <span className="break-words">{e.pickup || '—'} ➔ {e.dropoff || '—'}</span>
                    </div>
                  )}
                  {e.name && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Name:</span>
                      <span className="text-white font-semibold break-words">{e.name}</span>
                    </div>
                  )}
                  {e.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" /> <span className="break-words">{e.phone}</span>
                    </div>
                  )}
                  {e.email && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" /> <span className="break-words truncate">{e.email}</span>
                    </div>
                  )}
                  {e.vehicle && (
                    <div className="flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-slate-500 shrink-0" /> <span className="break-words">{e.vehicle}</span>
                    </div>
                  )}
                  {e.flight && (
                    <div className="flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5 text-slate-500 shrink-0" /> <span className="break-words">{e.flight}</span>
                    </div>
                  )}
                  {e.location && !e.pickup && !e.dropoff && (
                    <div className="sm:col-span-2 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="break-words">{e.location}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
