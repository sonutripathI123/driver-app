import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail, Phone, MapPin, CalendarClock, Car, Globe, Trash2, RefreshCw,
  AlertCircle, ChevronDown, ChevronUp, Inbox,
} from 'lucide-react';
import { enquiriesApi } from '../services/api';
import { Enquiry } from '../types';

const STATUS_STYLE: Record<Enquiry['status'], string> = {
  NEW: 'bg-[#DFCAA8] text-[#0A0E1A] border-[#DFCAA8]',
  REVIEWED: 'bg-[#121A2D] text-sky-300 border-sky-700',
  QUOTED: 'bg-[#121A2D] text-emerald-300 border-emerald-700',
  ARCHIVED: 'bg-[#121A2D] text-slate-400 border-slate-700',
};
const NEXT_STATUS: Record<Enquiry['status'], Enquiry['status'] | null> = {
  NEW: 'REVIEWED',
  REVIEWED: 'QUOTED',
  QUOTED: 'ARCHIVED',
  ARCHIVED: null,
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const EnquiriesPage: React.FC = () => {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await enquiriesApi.list({ limit: 300 });
      setEnquiries(res.enquiries || []);
      setError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEnquiries([]);
      setError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Enquiries unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const websites = useMemo(
    () => Array.from(new Set(enquiries.map((e) => e.website).filter(Boolean))) as string[],
    [enquiries]
  );

  const visible = enquiries.filter(
    (e) => (!website || e.website === website) && (!statusFilter || e.status === statusFilter)
  );

  const changeStatus = async (e: Enquiry, next: Enquiry['status']) => {
    setBusyId(e.id);
    try {
      const updated = await enquiriesApi.setStatus(e.id, next);
      setEnquiries((prev) => prev.map((x) => (x.id === e.id ? updated : x)));
    } catch {
      // non-fatal; the list re-syncs on the next poll
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (e: Enquiry) => {
    if (!window.confirm(`Delete this enquiry from ${e.customer_name}? This cannot be undone.`)) return;
    setBusyId(e.id);
    try {
      await enquiriesApi.remove(e.id);
      setEnquiries((prev) => prev.filter((x) => x.id !== e.id));
    } finally {
      setBusyId(null);
    }
  };

  const newCount = enquiries.filter((e) => e.status === 'NEW').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-5 sm:p-6 text-[#0A0E1A]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#06090F] border border-[#DFCAA8] flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5 text-[#DFCAA8]" />
          </div>
          <div>
            <h1 className="text-lg font-black">Quote Requests & Enquiries</h1>
            <p className="text-xs font-semibold opacity-70">
              Price enquiries from your websites. These are NOT bookings and never go to the Operate Board —
              quote the customer, then confirm a real booking separately.
            </p>
          </div>
          <button
            onClick={load}
            className="ml-auto px-3.5 py-2 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black flex items-center gap-1.5 hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 mr-1">Website</span>
        {['', ...websites].map((w) => (
          <button
            key={w || 'all'}
            onClick={() => setWebsite(w)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              website === w
                ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black border-[#DFCAA8]'
                : 'bg-[#06090F] text-white border-[#1E2738] hover:bg-[#121A2D]'
            }`}
          >
            {w || 'All sites'}
          </button>
        ))}
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 ml-3 mr-1">Status</span>
        {['', 'NEW', 'REVIEWED', 'QUOTED', 'ARCHIVED'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              statusFilter === s
                ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black border-[#DFCAA8]'
                : 'bg-[#06090F] text-white border-[#1E2738] hover:bg-[#121A2D]'
            }`}
          >
            {s || 'All'}{s === 'NEW' && newCount > 0 ? ` (${newCount})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-[#2A1214] border border-red-500 p-4 flex items-center gap-2.5 text-white">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs font-bold">{error}</span>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {visible.map((e) => {
          const isOpen = expandedId === e.id;
          const next = NEXT_STATUS[e.status];
          return (
            <div key={e.id} className="rounded-2xl bg-[#0D1322] border border-[#1F2E4D] p-4 sm:p-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black">{e.customer_name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${STATUS_STYLE[e.status]}`}>
                      {e.status}
                    </span>
                    {e.website && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#121A2D] border border-[#1F2E4D] text-slate-300 flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {e.website}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-300 font-semibold">
                    {e.customer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{e.customer_phone}</span>}
                    {e.customer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{e.customer_email}</span>}
                    {e.service_type && <span className="flex items-center gap-1"><Car className="w-3 h-3" />{e.service_type}{e.vehicle_category ? ` · ${e.vehicle_category}` : ''}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-white font-semibold">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#DFCAA8]" />{e.pickup_address || '—'} ➔ {e.dropoff_address || '—'}</span>
                    <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3 text-[#DFCAA8]" />{fmtDate(e.pickup_datetime)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {next && (
                    <button
                      onClick={() => changeStatus(e, next)}
                      disabled={busyId === e.id}
                      className="px-3 py-1.5 rounded-xl bg-[#121A2D] border border-[#DFCAA8] text-white text-[11px] font-black hover:bg-[#DFCAA8] hover:text-[#0A0E1A] disabled:opacity-50 transition-colors"
                    >
                      Mark {next.charAt(0) + next.slice(1).toLowerCase()}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : e.id)}
                    className="p-2 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-slate-300 hover:text-white transition-colors"
                    title="Details"
                  >
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => remove(e)}
                    disabled={busyId === e.id}
                    className="p-2 rounded-xl bg-[#06090F] border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors"
                    title="Delete enquiry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-[#1F2E4D]">
                  <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Full submission</p>
                  <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-words bg-[#06090F] rounded-xl p-3 border border-[#1F2E4D]">
                    {e.notes || '(no extra details)'}
                  </pre>
                  <p className="text-[10px] text-slate-500 font-semibold mt-2">Received {fmtDate(e.created_at)}</p>
                </div>
              )}
            </div>
          );
        })}

        {!loading && visible.length === 0 && !error && (
          <div className="rounded-2xl bg-[#0D1322] border border-[#1F2E4D] p-8 text-center">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-black text-white">No enquiries yet.</p>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Quote requests from your website forms will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnquiriesPage;
