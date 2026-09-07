import React, { useEffect, useState } from 'react';
import { bookingsApi, driverPortalApi, fleetApi } from '../services/api';
import { Booking, BookingLeg, Driver } from '../types';
import confetti from 'canvas-confetti';
import {
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  Plane,
  Car,
  DollarSign,
  Shield,
  Radio,
  Users,
  ChevronRight,
  ExternalLink,
  LogOut,
  Calendar,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface DriverTripItem {
  id: string;
  bookingNumber: string;
  tripType: string;
  passengerName: string;
  passengerPhone: string;
  paxCount: number;
  luggageCount: number;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  dropoffAddress: string;
  isAirport: boolean;
  flightNumber?: string;
  flightStatus?: string;
  driverPayout: number;
  status: 'ALLOCATED' | 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED';
  notes?: string;
  /** Unformatted pickup timestamp, kept so trips can be ordered. */
  pickupDatetimeRaw: string;
}

interface ChauffeurProfileItem {
  id: string;
  name: string;
  plate: string;
  vehicle: string;
  phone: string;
  email?: string;
  license?: string;
  rating: number;
}

/** Statuses that mean the chauffeur has a job in hand right now. */
const IN_HAND: DriverTripItem['status'][] = ['ALLOCATED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'PICKED_UP'];

const MELBOURNE = 'Australia/Melbourne';

/** Every leg status needs its own label: falling through to "COMPLETED" told
 *  a chauffeur their trip was finished before they had even set off. */
const STATUS_LABELS: Record<DriverTripItem['status'], string> = {
  ALLOCATED: 'ASSIGNED TO YOU',
  DISPATCHED: 'READY TO START',
  EN_ROUTE: 'EN ROUTE (On The Way)',
  ARRIVED: 'ARRIVED AT PICKUP',
  PICKED_UP: 'ON BOARD (Driving To Dropoff)',
  COMPLETED: 'COMPLETED ✓',
};

const formatPickupDate = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(iso));

const formatPickupTime = (iso: string) =>
  `${new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))} AEST`;

/** Maps the API's DriverJobItem onto the shape this screen renders. */
const toTripItem = (job: any): DriverTripItem => ({
  id: job.id,
  bookingNumber: job.booking_number,
  tripType: job.flight_number
    ? 'AIRPORT VIP CHAUFFEUR TRANSFER'
    : `${String(job.vehicle_category || 'CHAUFFEUR').replace(/_/g, ' ')} TRANSFER`,
  passengerName: job.passenger_name || 'VIP Passenger',
  passengerPhone: job.passenger_phone || '',
  paxCount: job.passenger_count ?? 1,
  luggageCount: job.luggage_count ?? 0,
  pickupDate: formatPickupDate(job.pickup_datetime),
  pickupTime: formatPickupTime(job.pickup_datetime),
  pickupAddress: job.pickup_address,
  dropoffAddress: job.dropoff_address,
  isAirport: !!job.flight_number,
  flightNumber: job.flight_number || undefined,
  driverPayout: job.allocation_payout ?? 0,
  status: job.status,
  notes: job.pickup_notes || job.special_instructions || undefined,
  pickupDatetimeRaw: job.pickup_datetime,
});

export const DriverPortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'UPCOMING' | 'HISTORY'>('ACTIVE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<ChauffeurProfileItem | null>(null);
  const [trips, setTrips] = useState<DriverTripItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStepping, setIsStepping] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadManifest = async () => {
    try {
      const [me, jobs] = await Promise.all([
        driverPortalApi.getProfile(),
        driverPortalApi.getManifest('ALL'),
      ]);
      const jobList = Array.isArray(jobs) ? jobs : [];
      // The plate that matters is the one on the job in hand; a driver's
      // "default vehicle" is often unset because allocation is per leg.
      const jobVehicle = jobList.find((j: any) => IN_HAND.includes(j.status) && j.vehicle_plate);
      const vehicle = me?.default_vehicle;
      setProfile({
        id: me.id,
        name: me.full_name,
        plate: jobVehicle?.vehicle_plate || vehicle?.registration_plate || 'No vehicle assigned',
        vehicle:
          jobVehicle?.vehicle_name ||
          (vehicle ? `${vehicle.make} ${vehicle.model}` : 'Awaiting vehicle allocation'),
        phone: me.phone,
        email: me.email,
        license: me.license_number,
        rating: me.rating ?? 0,
      });
      setTrips(jobList.map(toTripItem));
      setLoadError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setLoadError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Manifest unavailable (HTTP ${err.response.status}).`
            : 'No connection. Your manifest may be out of date.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Poll so a dispatcher's allocation shows up without the driver reloading.
  useEffect(() => {
    loadManifest();
    const interval = setInterval(loadManifest, 15000);
    return () => clearInterval(interval);
  }, []);

  const currentDriver: ChauffeurProfileItem =
    profile ?? { id: '', name: 'Chauffeur', plate: '—', vehicle: '—', phone: '', rating: 0 };

  const byPickupAsc = (a: DriverTripItem, b: DriverTripItem) =>
    new Date(a.pickupDatetimeRaw).getTime() - new Date(b.pickupDatetimeRaw).getTime();

  const inHand = trips.filter((t) => IN_HAND.includes(t.status)).sort(byPickupAsc);
  const activeTrip: DriverTripItem | null =
    inHand.find((t) => t.status !== 'ALLOCATED') ?? inHand[0] ?? null;
  const upcomingTrips = inHand.filter((t) => t.id !== activeTrip?.id);
  const historyTrips = trips
    .filter((t) => t.status === 'COMPLETED')
    .sort((a, b) => -byPickupAsc(a, b));

  // Step Status Handler: the server is the source of truth, so only reflect a
  // milestone in the UI once the API has actually accepted it. Showing
  // "Completed" for a tap the backend never received would be worse than an error.
  const handleUpdateStatus = async (nextStatus: 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED') => {
    if (!activeTrip || isStepping) return;
    setIsStepping(true);
    try {
      await driverPortalApi.stepLegStatus(activeTrip.id, nextStatus);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      showToast(`⚠️ Could not update: ${typeof detail === 'string' ? detail : 'no connection. Try again.'}`);
      setIsStepping(false);
      return;
    }

    setTrips((prev) => prev.map((t) => (t.id === activeTrip.id ? { ...t, status: nextStatus } : t)));

    // Keeps the legacy admin chime working until live-sync moves onto the DB.
    try {
      await bookingsApi.updateLiveSync(nextStatus);
    } catch {
      /* the chime is best-effort; the trip status above already persisted */
    }

    if (nextStatus === 'EN_ROUTE') {
      showToast('🚗 Status: EN ROUTE — dispatcher notified.');
    } else if (nextStatus === 'ARRIVED') {
      showToast(`📍 Status: ARRIVED — passenger notified you are at ${activeTrip.pickupAddress}.`);
    } else if (nextStatus === 'PICKED_UP') {
      showToast(`👤 PASSENGER ON BOARD — en route to ${activeTrip.dropoffAddress}.`);
    } else if (nextStatus === 'COMPLETED') {
      showToast(`🎉 TRIP COMPLETED! +$${activeTrip.driverPayout.toFixed(2)} AUD added to your earnings.`);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#fbbf24', '#10b981', '#06b6d4'] });
    }

    setIsStepping(false);
    loadManifest();
  };


  // Open Google Maps Directions
  const handleOpenMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const totalEarningsToday = historyTrips.reduce((acc, t) => acc + t.driverPayout, 0);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-12">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 sm:right-8 z-50 max-w-md bg-[#121A2D] border-2 border-amber-400 text-amber-300 p-3.5 rounded-2xl shadow-2xl shadow-amber-500/20 text-xs font-bold flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 animate-pulse text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>
      )}

      {/* 1. Driver Profile Header (Ultra-Clean, NO admin clutter) */}
      <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between gap-3 shadow-lg text-white">
        <div className="flex items-center gap-3">
          {/* Driver Avatar */}
          <div className="w-11 h-11 rounded-2xl bg-[#06090F] border border-[#DFCAA8] text-white font-black text-base flex items-center justify-center shadow-md shrink-0">
            {currentDriver.name.charAt(0)}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white">{currentDriver.name}</h2>
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#121A2D] text-white border border-[#DFCAA8]"
              >
                ● {activeTrip ? 'Active Trip' : 'On Duty'}
              </span>
            </div>
            <p className="text-[11px] text-white font-mono mt-0.5 truncate max-w-[240px] sm:max-w-none">
              🚘 Reg: <strong className="text-white">{currentDriver.plate}</strong> • {currentDriver.vehicle}
            </p>
          </div>
        </div>

        {/* Live Duty Pill */}
        <span className="px-3 py-1.5 rounded-xl bg-[#121A2D] border border-[#DFCAA8] text-white text-xs font-bold hidden sm:inline-block">
          🟢 Connected Live
        </span>
      </div>

      {/* Manifest status: a chauffeur must never be left guessing whether
          the screen is current. */}
      {isLoading && (
        <div className="p-3.5 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] flex items-center gap-2.5 text-white">
          <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          <span className="text-xs font-bold">Loading your manifest…</span>
        </div>
      )}

      {loadError && !isLoading && (
        <div role="alert" className="p-3.5 rounded-2xl bg-[#2A1214] border border-red-500 flex flex-col sm:flex-row sm:items-center gap-2.5 text-white">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="text-xs font-bold break-words">{loadError}</span>
          </div>
          <button
            onClick={() => { setIsLoading(true); loadManifest(); }}
            className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Top 3 Navigation Tabs (Active & Today | Upcoming | History) */}
      <div className="flex p-1.5 bg-[#0D1322] rounded-2xl border border-[#1F2E4D] gap-1 shadow-inner">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'ACTIVE'
              ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
              : 'text-white hover:text-[#DFCAA8]'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Active & Today</span>
          {activeTrip && (
            <span className="w-2 h-2 rounded-full bg-[#0A0E1A] animate-ping ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('UPCOMING')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'UPCOMING'
              ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
              : 'text-white hover:text-[#DFCAA8]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Upcoming ({upcomingTrips.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'HISTORY'
              ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
              : 'text-white hover:text-[#DFCAA8]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>History & Earnings ({historyTrips.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACTIVE & TODAY TRIP MANIFEST                                       */}
      {/* ========================================================================= */}
      {activeTab === 'ACTIVE' && activeTrip && (
        <div className="space-y-4 animate-in fade-in duration-200 text-white">
          <div className="p-5 sm:p-7 rounded-3xl bg-[#121A2D] border border-[#DFCAA8]/40 shadow-2xl space-y-6">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-black text-white text-sm">{activeTrip.bookingNumber}</span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#0D1322] text-white text-[10px] font-bold tracking-wider uppercase border border-slate-700">
                  {activeTrip.tripType}
                </span>
              </div>

              {/* Dynamic Live Status Badge */}
              <span
                className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide flex items-center gap-1.5 bg-[#0D1322] text-white border border-[#DFCAA8]"
              >
                ● {STATUS_LABELS[activeTrip.status] ?? activeTrip.status}
              </span>
            </div>

            {/* Passenger Row + Call Button */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">{activeTrip.passengerName}</h3>
                <p className="text-xs text-white mt-0.5">
                  {activeTrip.paxCount} Passengers • {activeTrip.luggageCount} Suitcases • {activeTrip.passengerPhone}
                </p>
              </div>

              {/* Direct Call Button (Phone Call Trigger) */}
              <a
                href={`tel:${activeTrip.passengerPhone}`}
                className="px-5 py-2.5 rounded-2xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs flex items-center gap-2 shadow-lg transition-all"
              >
                <Phone className="w-4 h-4 text-white" />
                <span>Call</span>
              </a>
            </div>

            {/* Journey Details List */}
            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-3.5 text-xs text-white">
              {/* Pickup Time */}
              <div className="flex items-start gap-3 text-white">
                <Clock className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-white block">Pickup Date & Time</span>
                  <span className="font-bold text-white text-sm">
                    {activeTrip.pickupDate}, {activeTrip.pickupTime}
                  </span>
                </div>
              </div>

              {/* Pickup Address */}
              <div className="flex items-start gap-3 text-white">
                <MapPin className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-white block">Pickup Location</span>
                  <span className="font-semibold text-white leading-relaxed block">
                    {activeTrip.pickupAddress}
                  </span>
                </div>
              </div>

              {/* Destination Address */}
              <div className="flex items-start gap-3 text-white">
                <MapPin className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-white block">Destination Dropoff</span>
                  <span className="font-semibold text-white leading-relaxed block">
                    {activeTrip.dropoffAddress}
                  </span>
                </div>
              </div>

              {/* Flight Information */}
              {activeTrip.isAirport && (
                <div className="p-3.5 rounded-xl bg-[#121A2D] border border-slate-700 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2 text-white">
                    <Plane className="w-4 h-4 shrink-0 text-white" />
                    <span className="font-bold font-mono">Flight: {activeTrip.flightNumber}</span>
                  </div>
                  {activeTrip.flightStatus && (
                    <span className="px-2.5 py-0.5 rounded bg-[#0D1322] text-white border border-slate-700 text-[10px] font-bold">
                      Status: {activeTrip.flightStatus}
                    </span>
                  )}
                </div>
              )}

              {/* Driver Payout & Instructions */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-white">
                <span className="text-white">Guaranteed Driver Payout:</span>
                <span className="font-mono font-black text-white text-sm">
                  ${activeTrip.driverPayout.toFixed(2)} AUD
                </span>
              </div>
            </div>

            {/* Navigation Button */}
            <button
              onClick={() => handleOpenMaps(activeTrip.pickupAddress)}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#0D1322] hover:bg-[#162036] border border-[#DFCAA8] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Navigation className="w-4 h-4 text-white" />
              <span>Open in Google Maps / Navigation ➔</span>
            </button>

            {/* Live Trip Action Progression Stepper (Sequential Live Sync With Admin) */}
            <div className="pt-4 border-t border-[#1F2E4D] space-y-3 text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-white tracking-wider">
                  Live Trip Stepper (Step-by-Step Sync with Admin)
                </span>
                <span className="text-[10px] text-white font-mono font-bold">
                  Current: {activeTrip.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Step 1: En Route */}
                <button
                  onClick={() => handleUpdateStatus('EN_ROUTE')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'EN_ROUTE'
                      ? 'bg-white text-[#0A0E1A] shadow-lg ring-2 ring-white font-black'
                      : 'bg-[#0D1322] text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  1. En Route 🚗
                </button>

                {/* Step 2: Arrived */}
                <button
                  onClick={() => handleUpdateStatus('ARRIVED')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'ARRIVED'
                      ? 'bg-white text-[#0A0E1A] shadow-lg ring-2 ring-white font-black'
                      : 'bg-[#0D1322] text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  2. Arrived 📍
                </button>

                {/* Step 3: On Board */}
                <button
                  onClick={() => handleUpdateStatus('PICKED_UP')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'PICKED_UP'
                      ? 'bg-white text-[#0A0E1A] shadow-lg ring-2 ring-white font-black'
                      : 'bg-[#0D1322] text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  3. On Board 👤
                </button>

                {/* Step 4: Complete Trip */}
                <button
                  onClick={() => handleUpdateStatus('COMPLETED')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'COMPLETED'
                      ? 'bg-white text-[#0A0E1A] shadow-lg font-black'
                      : 'bg-[#0D1322] text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  4. Complete ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: UPCOMING SCHEDULED TRIPS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'ACTIVE' && !activeTrip && !isLoading && (
        <div className="p-8 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] text-center space-y-3 text-white">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#06090F] border border-[#DFCAA8] flex items-center justify-center">
            <Car className="w-7 h-7 text-[#DFCAA8]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white">No trip assigned right now</h3>
            <p className="text-xs font-bold text-slate-300 max-w-sm mx-auto">
              When dispatch allocates a job to you it will appear here automatically —
              no need to refresh. Check “Upcoming” for jobs later today.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'UPCOMING' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-white">
          {upcomingTrips.map((trip) => (
            <div
              key={trip.id}
              className="p-5 rounded-3xl bg-[#121A2D] border border-[#1F2E4D] space-y-3 shadow-md text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="font-mono font-bold text-white text-sm">{trip.bookingNumber}</span>
                <span className="font-mono font-bold text-white text-xs">+${trip.driverPayout.toFixed(2)} AUD</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm">{trip.passengerName}</h4>
                  <p className="text-xs text-white">{trip.paxCount} Pax • {trip.tripType}</p>
                </div>
                <a
                  href={`tel:${trip.passengerPhone}`}
                  className="p-2 rounded-xl bg-[#0D1322] border border-slate-700 text-white hover:text-[#DFCAA8]"
                >
                  <Phone className="w-4 h-4 text-white" />
                </a>
              </div>

              <div className="text-xs text-white space-y-1">
                <p>⏰ <strong>Scheduled:</strong> {trip.pickupDate} at {trip.pickupTime}</p>
                <p>📍 <strong>Pickup:</strong> {trip.pickupAddress}</p>
                <p>🏁 <strong>Dropoff:</strong> {trip.dropoffAddress}</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleOpenMaps(trip.pickupAddress)}
                  className="px-4 py-1.5 rounded-xl bg-[#0D1322] border border-[#DFCAA8] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 text-white" />
                  <span>Preview Route on Map</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HISTORY & EARNINGS BREAKDOWN                                       */}
      {/* ========================================================================= */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-white">
          {/* Earnings Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1 text-white">
              <span className="text-[10px] uppercase font-bold text-white">Total Today's Earnings</span>
              <div className="text-2xl font-black font-mono text-white">
                ${totalEarningsToday.toFixed(2)} AUD
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1 text-white">
              <span className="text-[10px] uppercase font-bold text-white">Trips Completed Today</span>
              <div className="text-2xl font-black font-mono text-white">
                {historyTrips.length} Rides
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1 text-white">
              <span className="text-[10px] uppercase font-bold text-white">Driver Performance</span>
              <div className="text-2xl font-black font-mono text-white">
                ⭐ {currentDriver.rating} Rating
              </div>
            </div>
          </div>

          {/* Past Trips List */}
          <div className="space-y-3">
            {historyTrips.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white"
              >
                <div className="space-y-1 text-white">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{t.bookingNumber}</span>
                    <span className="text-white font-bold font-mono">+${t.driverPayout.toFixed(2)} AUD</span>
                    <span className="px-2 py-0.2 rounded bg-[#121A2D] text-white text-[10px] border border-slate-700">
                      COMPLETED ✓
                    </span>
                  </div>
                  <p className="text-white font-bold">{t.passengerName} • {t.pickupTime}</p>
                  <p className="text-white text-[11px]">{t.pickupAddress} ➔ {t.dropoffAddress}</p>
                </div>

                <span className="text-[10px] text-white font-mono">Paid to Chauffeur</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
