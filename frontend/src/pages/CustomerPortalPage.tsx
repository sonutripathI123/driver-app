import React, { useEffect, useState } from 'react';
import { customerPortalApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoaderCircle, LogOut, CalendarDays, MapPin, AlertCircle, Car, Plus, CheckCircle2, X } from 'lucide-react';

const VEHICLE_OPTIONS = [
  { value: 'SEDAN_EXECUTIVE', label: 'Executive Sedan' },
  { value: 'SEDAN_PREMIUM', label: 'Premium Sedan' },
  { value: 'SUV_PREMIUM', label: 'Luxury SUV' },
  { value: 'PEOPLE_MOVER', label: 'People Mover / Van' },
  { value: 'MINIBUS', label: 'Minibus / Sprinter' },
];

const EMPTY_FORM = {
  pickup_address: '',
  dropoff_address: '',
  pickup_date: '',
  pickup_time: '',
  vehicle_category: 'SEDAN_PREMIUM',
  passenger_count: 1,
  luggage_count: 0,
  is_airport_pickup: false,
  flight_number: '',
};

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

  // Re-book form (Phase 2)
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<{ total_fare: number; currency: string; distance_km?: number } | null>(null);
  const [booking, setBooking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ booking_number: string; total_fare: number } | null>(null);

  const pickupIso = () => (form.pickup_date && form.pickup_time ? `${form.pickup_date}T${form.pickup_time}:00` : '');
  const payload = () => ({
    pickup_address: form.pickup_address.trim(),
    dropoff_address: form.dropoff_address.trim(),
    pickup_datetime: new Date(pickupIso()).toISOString(),
    vehicle_category: form.vehicle_category,
    passenger_count: Number(form.passenger_count) || 1,
    luggage_count: Number(form.luggage_count) || 0,
    is_airport_pickup: form.is_airport_pickup,
    flight_number: form.flight_number.trim() || undefined,
  });
  const formReady = form.pickup_address.trim() && form.dropoff_address.trim() && form.pickup_date && form.pickup_time;

  const getQuote = async () => {
    if (!formReady) return;
    setQuoting(true);
    setFormError(null);
    setQuote(null);
    try {
      const q = await customerPortalApi.quote(payload());
      setQuote(q);
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Could not price this trip. Check the addresses.');
    } finally {
      setQuoting(false);
    }
  };

  const confirmBooking = async () => {
    if (!formReady) return;
    setBooking(true);
    setFormError(null);
    try {
      const res = await customerPortalApi.book(payload());
      setBooked({ booking_number: res.booking_number, total_fare: res.total_fare });
      setForm({ ...EMPTY_FORM });
      setQuote(null);
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Could not create the booking.');
    } finally {
      setBooking(false);
    }
  };

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

      </div>

      {/* Floating "Book a new trip" button */}
      {!formOpen && !booked && (
        <button
          onClick={() => { setFormOpen(true); setFormError(null); setQuote(null); }}
          className="fixed bottom-5 right-5 px-5 py-3 rounded-2xl bg-[#DFCAA8] hover:bg-[#C2A16B] text-[#0A0E1A] font-black text-sm flex items-center gap-2 shadow-2xl"
        >
          <Plus className="w-5 h-5" /> Book a new trip
        </button>
      )}

      {/* Booking success */}
      {booked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#0D1322] border border-[#1F2E4D] rounded-3xl p-6 text-center space-y-3">
            <CheckCircle2 className="w-11 h-11 text-emerald-400 mx-auto" />
            <h3 className="text-base font-black text-white">Booking received</h3>
            <p className="text-xs font-semibold text-slate-300">
              Reference <span className="font-mono text-[#DFCAA8]">{booked.booking_number}</span> · ${booked.total_fare.toFixed(2)} AUD.
              We'll confirm the details with you shortly.
            </p>
            <button onClick={() => setBooked(null)} className="mt-1 px-5 py-2.5 rounded-xl bg-[#DFCAA8] text-[#0A0E1A] font-black text-xs">Done</button>
          </div>
        </div>
      )}

      {/* Re-book form */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0D1322] border border-[#1F2E4D] rounded-3xl p-5 sm:p-6 space-y-3 my-6">
            <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
              <h3 className="text-base font-black text-white">Book a new trip</h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white"><X className="w-4 h-4" /></button>
            </div>

            <label className="text-[10px] uppercase font-black text-slate-300 block">Pickup location</label>
            <input className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.pickup_address} onChange={(e) => { setForm({ ...form, pickup_address: e.target.value }); setQuote(null); }} placeholder="Pickup address" />
            <label className="text-[10px] uppercase font-black text-slate-300 block">Drop-off location</label>
            <input className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.dropoff_address} onChange={(e) => { setForm({ ...form, dropoff_address: e.target.value }); setQuote(null); }} placeholder="Destination address" />

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-300 block">Date</label>
                <input type="date" className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.pickup_date} onChange={(e) => { setForm({ ...form, pickup_date: e.target.value }); setQuote(null); }} />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-slate-300 block">Time</label>
                <input type="time" className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.pickup_time} onChange={(e) => { setForm({ ...form, pickup_time: e.target.value }); setQuote(null); }} />
              </div>
            </div>

            <label className="text-[10px] uppercase font-black text-slate-300 block">Vehicle</label>
            <select className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.vehicle_category} onChange={(e) => { setForm({ ...form, vehicle_category: e.target.value }); setQuote(null); }}>
              {VEHICLE_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-300 block">Passengers</label>
                <input type="number" min={1} className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.passenger_count} onChange={(e) => setForm({ ...form, passenger_count: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-slate-300 block">Bags</label>
                <input type="number" min={0} className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.luggage_count} onChange={(e) => setForm({ ...form, luggage_count: Number(e.target.value) })} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <input type="checkbox" checked={form.is_airport_pickup} onChange={(e) => { setForm({ ...form, is_airport_pickup: e.target.checked }); setQuote(null); }} />
              Airport transfer
            </label>
            {form.is_airport_pickup && (
              <input className="w-full px-3 py-2.5 rounded-xl bg-[#121A2D] border border-[#1F2E4D] text-white text-sm" value={form.flight_number} onChange={(e) => setForm({ ...form, flight_number: e.target.value })} placeholder="Flight number (e.g. QF400)" />
            )}

            {quote && (
              <div className="p-3 rounded-xl bg-[#121A2D] border border-[#DFCAA8] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Estimated fare{quote.distance_km ? ` · ~${quote.distance_km} km` : ''}</span>
                <span className="text-lg font-black font-mono text-white">${quote.total_fare.toFixed(2)} AUD</span>
              </div>
            )}
            {formError && <p className="text-[11px] font-black text-rose-300">{formError}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={getQuote} disabled={!formReady || quoting} className="flex-1 py-2.5 rounded-xl bg-[#121A2D] border border-[#DFCAA8] text-white font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                {quoting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null} See price
              </button>
              <button onClick={confirmBooking} disabled={!formReady || booking} className="flex-1 py-2.5 rounded-xl bg-[#DFCAA8] hover:bg-[#C2A16B] text-[#0A0E1A] font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                {booking ? <LoaderCircle className="w-4 h-4 animate-spin" /> : null} Confirm booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
