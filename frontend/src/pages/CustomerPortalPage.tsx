import React, { useEffect, useState } from 'react';
import { customerPortalApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoaderCircle, LogOut, CalendarDays, MapPin, AlertCircle, Car } from 'lucide-react';

interface CustomerProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  company_name?: string | null;
  is_vip: boolean;
  total_bookings: number;
  completed_trips: number;
  upcoming_trips: number;
  total_spent: number;
  outstanding_balance: number;
}

interface CustomerBooking {
  id: string;
  booking_number: string;
  status: string;
  payment_status?: string | null;
  total_fare: number;
  currency: string;
  passenger_name?: string | null;
  pickup_datetime?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  created_at?: string | null;
}

const MELB = 'Australia/Melbourne';
const fmt = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-AU', { timeZone: MELB, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)) + ' AEST'
    : '—';

const ACTIVE = ['CONFIRMED', 'ALLOCATED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'PICKED_UP'];

export const CustomerPortalPage: React.FC = () => {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [p, b] = await Promise.all([customerPortalApi.getProfile(), customerPortalApi.getBookings()]);
      setProfile(p);
      setBookings(Array.isArray(b) ? b : []);
      setError(null);
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Could not load your bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusColor = (s: string) =>
    s === 'COMPLETED' ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
      : ACTIVE.includes(s) ? 'bg-[#E0F2FE] text-[#0A0E1A] border-[#7DD3FC]'
        : s === 'CANCELLED' ? 'bg-rose-100 text-rose-900 border-rose-300'
          : 'bg-amber-100 text-amber-900 border-amber-300';

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-100 p-3 sm:p-6">
      <div className="w-full max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D]">
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-widest text-[#DFCAA8] uppercase">Opal Chauffeurs · Customer Portal</div>
            <h1 className="text-base sm:text-lg font-black text-white truncate">
              Welcome{profile ? `, ${profile.full_name}` : ''}
            </h1>
          </div>
          <button onClick={logout} title="Sign out" className="shrink-0 p-2 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="p-6 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] flex items-center gap-2.5">
            <LoaderCircle className="w-5 h-5 text-[#DFCAA8] animate-spin" />
            <span className="text-xs font-bold">Loading your bookings…</span>
          </div>
        )}

        {error && !loading && (
          <div className="p-4 rounded-2xl bg-[#2A1214] border border-rose-500 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        )}

        {/* Summary */}
        {profile && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Total Bookings', value: profile.total_bookings },
              { label: 'Completed', value: profile.completed_trips },
              { label: 'Upcoming', value: profile.upcoming_trips },
              { label: 'Total Spent', value: `$${profile.total_spent.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-[#0D1322] border border-[#1F2E4D] text-center">
                <div className="text-[9px] uppercase font-black text-slate-300 tracking-wider">{s.label}</div>
                <div className="text-base sm:text-lg font-black font-mono text-white mt-0.5">{s.value}</div>
              </div>
            ))}
            {profile.outstanding_balance > 0 && (
              <div className="col-span-2 sm:col-span-4 p-3 rounded-xl bg-[#2A1f12] border border-amber-700 text-amber-200 text-xs font-bold">
                Outstanding balance: ${profile.outstanding_balance.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
              </div>
            )}
          </div>
        )}

        {/* Bookings */}
        {!loading && (
          <div className="space-y-3">
            <h2 className="text-xs font-black text-white uppercase tracking-wider">Your Bookings</h2>
            {bookings.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] text-center">
                <Car className="w-8 h-8 text-[#DFCAA8] mx-auto mb-2" />
                <p className="text-sm font-black text-white">No bookings yet</p>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">Your trips will show here once they are booked.</p>
              </div>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-[#1F2E4D] pb-2">
                    <span className="font-mono font-black text-white text-sm">{b.booking_number}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusColor(b.status)}`}>{b.status}</span>
                  </div>
                  <div className="text-xs text-slate-200 space-y-1">
                    <p className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-[#DFCAA8]" /> {fmt(b.pickup_datetime)}</p>
                    <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#DFCAA8] mt-0.5 shrink-0" /> {b.pickup_address || '—'} ➔ {b.dropoff_address || '—'}</p>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#1F2E4D] text-xs">
                    <span className="text-slate-300 font-bold">{b.passenger_name || 'You'}</span>
                    <span className="font-mono font-black text-white">${b.total_fare.toFixed(2)} {b.currency}{b.payment_status ? ` · ${b.payment_status}` : ''}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <p className="text-[10px] text-slate-500 text-center font-semibold pt-2">
          Need a new trip? Reply to your booking email or call us — direct re-booking from here is coming soon.
        </p>
      </div>
    </div>
  );
};
