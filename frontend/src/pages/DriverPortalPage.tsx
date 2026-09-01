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
  status: 'ALLOCATED' | 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED';
  notes?: string;
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

const DEFAULT_DRIVERS: ChauffeurProfileItem[] = [
  { id: 'drv-sonu', name: 'Sonu Tripathi (Live Driver)', plate: 'ST-9305-VIC', vehicle: 'Mercedes-Benz S-Class S450 (Obsidian Black)', phone: '+61 432 000 718', email: 'sonu@opalchauffeurs.com.au', license: 'VIC-DA-9305', rating: 5.0 },
  { id: 'drv-01', name: 'Marcus Vance', plate: 'AURA-01', vehicle: 'Mercedes S-Class S450', phone: '+61 411 998 877', email: 'marcus@opalchauffeurs.com.au', license: 'VIC-DA-0112', rating: 4.98 },
  { id: 'drv-02', name: 'Daniel Ricciardo', plate: 'DR-03-VIC', vehicle: 'BMW 740i Executive', phone: '+61 433 221 100', email: 'daniel@opalchauffeurs.com.au', license: 'VIC-DA-0344', rating: 4.99 },
  { id: 'drv-03', name: 'Fernando Alonso', plate: 'FA-14-VIC', vehicle: 'Mercedes S-Class S450', phone: '+61 433 778 899', email: 'fernando@opalchauffeurs.com.au', license: 'VIC-DA-1499', rating: 4.96 },
  { id: 'drv-04', name: 'Lewis Hamilton', plate: 'LH-44-VIC', vehicle: 'Mercedes V-Class Luxury Van', phone: '+61 499 001 122', email: 'lewis@opalchauffeurs.com.au', license: 'VIC-DA-4401', rating: 4.99 },
];

export const DriverPortalPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'UPCOMING' | 'HISTORY'>('ACTIVE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Default to Sonu Tripathi
  const currentDriver = DEFAULT_DRIVERS[0];

  // Active Trip State (Live synced with Sahil Tripathi booking)
  const [activeTrip, setActiveTrip] = useState<DriverTripItem>({
    id: 'leg-sahil',
    bookingNumber: 'CCM-2026-9901',
    tripType: 'AIRPORT VIP CHAUFFEUR TRANSFER',
    passengerName: 'Sahil Tripathi',
    passengerPhone: '+91 6386154107',
    paxCount: 2,
    luggageCount: 2,
    pickupDate: 'Today, 31 Aug 2026',
    pickupTime: '18:30 AEST',
    pickupAddress: 'Crown Towers, 8 Whiteman St, Southbank VIC 3006',
    dropoffAddress: 'Melbourne Airport (MEL), Terminal 2 International',
    isAirport: true,
    flightNumber: 'QF400 (Qantas Airways)',
    flightStatus: 'ON_TIME',
    driverPayout: 170.0,
    status: 'EN_ROUTE',
    notes: 'VIP Client. Cold bottled water and luggage assistance required.',
  });

  // Fetch initial live status on page load & poll server
  useEffect(() => {
    const fetchServerSync = async () => {
      try {
        const syncData = await bookingsApi.getLiveSync();
        if (syncData?.status) {
          setActiveTrip((prev) => ({ ...prev, status: syncData.status }));
          localStorage.setItem('crown_active_trip_status', syncData.status);
        }
      } catch (e) {
        const localStatus = localStorage.getItem('crown_active_trip_status') as any;
        if (localStatus) {
          setActiveTrip((prev) => ({ ...prev, status: localStatus }));
        }
      }
    };

    fetchServerSync();
    const interval = setInterval(fetchServerSync, 1500);

    const handleStorageChange = () => {
      const live = localStorage.getItem('crown_active_trip_status') as any;
      if (live && live !== activeTrip.status) {
        setActiveTrip((prev) => ({ ...prev, status: live }));
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Upcoming Trips
  const [upcomingTrips, setUpcomingTrips] = useState<DriverTripItem[]>([
    {
      id: 'leg-02',
      bookingNumber: 'CCM-2026-0882',
      tripType: 'CORPORATE EXECUTIVE CHARTER',
      passengerName: 'Rio Tinto Mining Delegation',
      passengerPhone: '+61 499 888 777',
      paxCount: 4,
      luggageCount: 4,
      pickupDate: 'Tomorrow, 1 Sept 2026',
      pickupTime: '09:00 AEST',
      pickupAddress: 'Crown Towers, 8 Whiteman St, Southbank VIC 3006',
      dropoffAddress: 'Yarra Valley Estate, Coldstream',
      isAirport: false,
      driverPayout: 210.0,
      status: 'ALLOCATED',
      notes: 'Executive group transfer. Vehicle pre-cooled required.',
    },
    {
      id: 'leg-03',
      bookingNumber: 'CCM-2026-0885',
      tripType: 'AIRPORT IN-BOUND ARRIVAL',
      passengerName: 'Dr. Arthur Pendelton',
      passengerPhone: '+61 499 111 444',
      paxCount: 1,
      luggageCount: 2,
      pickupDate: 'Tomorrow, 1 Sept 2026',
      pickupTime: '13:00 AEST',
      pickupAddress: 'Melbourne Airport Terminal 2 Arrivals Gate 11',
      dropoffAddress: 'The Langham Melbourne, 1 Southgate Ave',
      isAirport: true,
      flightNumber: 'CX135 (Cathay Pacific)',
      flightStatus: 'SCHEDULED',
      driverPayout: 155.0,
      status: 'ALLOCATED',
      notes: 'Meet and Greet with iPad Nameboard: "Dr. Arthur Pendelton".',
    },
  ]);

  // History Trips
  const [historyTrips, setHistoryTrips] = useState<DriverTripItem[]>([
    {
      id: 'leg-04',
      bookingNumber: 'CCM-2026-0879',
      tripType: 'EXECUTIVE SEDAN TRANSFER',
      passengerName: 'Dr. Sophia Sterling',
      passengerPhone: '+61 422 334 455',
      paxCount: 1,
      luggageCount: 1,
      pickupDate: 'Today, 31 Aug 2026',
      pickupTime: '11:15 AEST',
      pickupAddress: 'Grand Hyatt Melbourne, 123 Collins St',
      dropoffAddress: 'Essendon Airport Jet Base',
      isAirport: true,
      driverPayout: 140.0,
      status: 'COMPLETED',
    },
    {
      id: 'leg-05',
      bookingNumber: 'CCM-2026-0878',
      tripType: 'DOMESTIC AIRPORT TRANSFER',
      passengerName: 'David Warner',
      passengerPhone: '+61 411 222 333',
      paxCount: 1,
      luggageCount: 2,
      pickupDate: 'Today, 31 Aug 2026',
      pickupTime: '08:45 AEST',
      pickupAddress: 'Park Hyatt Melbourne, 1 Parliament Square',
      dropoffAddress: 'Melbourne Airport Terminal 4',
      isAirport: true,
      driverPayout: 160.0,
      status: 'COMPLETED',
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Step Status Handler (Syncs with Central Server + Admin Dashboard)
  const handleUpdateStatus = async (nextStatus: 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED') => {
    setActiveTrip((prev) => ({ ...prev, status: nextStatus }));

    localStorage.setItem('crown_active_trip_status', nextStatus);
    window.dispatchEvent(new Event('storage'));

    try {
      await bookingsApi.updateLiveSync(nextStatus);
    } catch (e) {
      console.log('Central backend sync', e);
    }

    if (nextStatus === 'EN_ROUTE') {
      showToast('🚗 Status: EN ROUTE — Dispatcher & Passenger notified!');
    } else if (nextStatus === 'ARRIVED') {
      showToast('📍 Status: ARRIVED AT PICKUP — Passenger notified of your arrival outside Crown Towers!');
    } else if (nextStatus === 'PICKED_UP') {
      showToast('👤 Status: PASSENGER ON BOARD — En route to Melbourne Airport Terminal 2.');
    } else if (nextStatus === 'COMPLETED') {
      showToast(`🎉 TRIP COMPLETED! +$${activeTrip.driverPayout.toFixed(2)} AUD credited to your earnings.`);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#10b981', '#06b6d4'],
      });

      setHistoryTrips((prev) => [{ ...activeTrip, status: 'COMPLETED' }, ...prev]);
    }

    try {
      await driverPortalApi.stepLegStatus(activeTrip.id, nextStatus);
    } catch (e) {}
  };

  // Open Google Maps Directions
  const handleOpenMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const totalEarningsToday = historyTrips.reduce((acc, t) => acc + t.driverPayout, 0) + (activeTrip.status === 'COMPLETED' ? activeTrip.driverPayout : 0);

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
      <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          {/* Driver Avatar */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-base flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            {currentDriver.name.charAt(0)}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-100">{currentDriver.name}</h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  activeTrip.status === 'EN_ROUTE' || activeTrip.status === 'PICKED_UP'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                ● {activeTrip.status === 'COMPLETED' ? 'On Duty' : 'Active Trip'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-[240px] sm:max-w-none">
              🚘 Reg: <strong className="text-amber-400">{currentDriver.plate}</strong> • {currentDriver.vehicle}
            </p>
          </div>
        </div>

        {/* Live Duty Pill */}
        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hidden sm:inline-block">
          🟢 Connected Live
        </span>
      </div>

      {/* 2. Top 3 Navigation Tabs (Active & Today | Upcoming | History) */}
      <div className="flex p-1.5 bg-[#0D1322] rounded-2xl border border-[#1F2E4D] gap-1 shadow-inner">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'ACTIVE'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Active & Today</span>
          {activeTrip.status !== 'COMPLETED' && (
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('UPCOMING')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'UPCOMING'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Upcoming ({upcomingTrips.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'HISTORY'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>History & Earnings ({historyTrips.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACTIVE & TODAY TRIP MANIFEST                                       */}
      {/* ========================================================================= */}
      {activeTab === 'ACTIVE' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-5 sm:p-7 rounded-3xl bg-[#121A2D] border border-amber-500/30 shadow-2xl space-y-6">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-black text-amber-400 text-sm">{activeTrip.bookingNumber}</span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold tracking-wider uppercase">
                  {activeTrip.tripType}
                </span>
              </div>

              {/* Dynamic Live Status Badge */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${
                  activeTrip.status === 'EN_ROUTE'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 animate-pulse'
                    : activeTrip.status === 'ARRIVED'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 ring-1 ring-purple-400/50'
                    : activeTrip.status === 'PICKED_UP'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                ● {activeTrip.status === 'EN_ROUTE'
                  ? 'EN ROUTE (On The Way)'
                  : activeTrip.status === 'ARRIVED'
                  ? 'ARRIVED AT PICKUP'
                  : activeTrip.status === 'PICKED_UP'
                  ? 'ON BOARD (Driving To Airport)'
                  : 'COMPLETED ✓'}
              </span>
            </div>

            {/* Passenger Row + Call Button */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-100">{activeTrip.passengerName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeTrip.paxCount} Passengers • {activeTrip.luggageCount} Suitcases • {activeTrip.passengerPhone}
                </p>
              </div>

              {/* Direct Call Button (Phone Call Trigger) */}
              <a
                href={`tel:${activeTrip.passengerPhone}`}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/30 hover:scale-105 transition-all"
              >
                <Phone className="w-4 h-4 fill-slate-950" />
                <span>Call</span>
              </a>
            </div>

            {/* Journey Details List */}
            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-3.5 text-xs">
              {/* Pickup Time */}
              <div className="flex items-start gap-3 text-slate-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pickup Date & Time</span>
                  <span className="font-bold text-slate-100 text-sm">
                    {activeTrip.pickupDate}, {activeTrip.pickupTime}
                  </span>
                </div>
              </div>

              {/* Pickup Address */}
              <div className="flex items-start gap-3 text-slate-300">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pickup Location</span>
                  <span className="font-semibold text-slate-200 leading-relaxed block">
                    {activeTrip.pickupAddress}
                  </span>
                </div>
              </div>

              {/* Destination Address */}
              <div className="flex items-start gap-3 text-slate-300">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Destination Dropoff</span>
                  <span className="font-semibold text-slate-200 leading-relaxed block">
                    {activeTrip.dropoffAddress}
                  </span>
                </div>
              </div>

              {/* Flight Information */}
              {activeTrip.isAirport && (
                <div className="p-3.5 rounded-xl bg-[#121A2D] border border-cyan-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Plane className="w-4 h-4 shrink-0" />
                    <span className="font-bold font-mono">Flight: {activeTrip.flightNumber}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    Status: {activeTrip.flightStatus}
                  </span>
                </div>
              )}

              {/* Driver Payout & Instructions */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Guaranteed Driver Payout:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  ${activeTrip.driverPayout.toFixed(2)} AUD
                </span>
              </div>
            </div>

            {/* Navigation Button */}
            <button
              onClick={() => handleOpenMaps(activeTrip.pickupAddress)}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#0D1322] hover:bg-[#162036] border border-[#1F2E4D] hover:border-cyan-400/60 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Navigation className="w-4 h-4" />
              <span>Open in Google Maps / Navigation ➔</span>
            </button>

            {/* Live Trip Action Progression Stepper (Sequential Live Sync With Admin) */}
            <div className="pt-4 border-t border-[#1F2E4D] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  Live Trip Stepper (Step-by-Step Sync with Admin)
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  Current: {activeTrip.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Step 1: En Route */}
                <button
                  onClick={() => handleUpdateStatus('EN_ROUTE')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'EN_ROUTE'
                      ? 'bg-blue-500 text-slate-950 shadow-lg shadow-blue-500/40 ring-2 ring-blue-300 font-black'
                      : 'bg-[#0D1322] text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  1. En Route 🚗
                </button>

                {/* Step 2: Arrived */}
                <button
                  onClick={() => handleUpdateStatus('ARRIVED')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'ARRIVED'
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40 ring-2 ring-purple-300 font-black'
                      : 'bg-[#0D1322] text-slate-300 hover:bg-purple-950/40 border border-slate-800'
                  }`}
                >
                  2. Arrived 📍
                </button>

                {/* Step 3: On Board */}
                <button
                  onClick={() => handleUpdateStatus('PICKED_UP')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'PICKED_UP'
                      ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-300 font-black'
                      : 'bg-[#0D1322] text-slate-300 hover:bg-cyan-950/40 border border-slate-800'
                  }`}
                >
                  3. On Board 👤
                </button>

                {/* Step 4: Complete Trip */}
                <button
                  onClick={() => handleUpdateStatus('COMPLETED')}
                  className={`py-3 px-3 rounded-xl text-xs font-bold transition-all ${
                    activeTrip.status === 'COMPLETED'
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40 font-black'
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
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
      {activeTab === 'UPCOMING' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {upcomingTrips.map((trip) => (
            <div
              key={trip.id}
              className="p-5 rounded-3xl bg-[#121A2D] border border-[#1F2E4D] hover:border-amber-500/40 transition-all space-y-3 shadow-md"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="font-mono font-bold text-amber-400 text-sm">{trip.bookingNumber}</span>
                <span className="font-mono font-bold text-emerald-400 text-xs">+${trip.driverPayout.toFixed(2)} AUD</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">{trip.passengerName}</h4>
                  <p className="text-xs text-slate-400">{trip.paxCount} Pax • {trip.tripType}</p>
                </div>
                <a
                  href={`tel:${trip.passengerPhone}`}
                  className="p-2 rounded-xl bg-[#0D1322] border border-slate-700 text-amber-400 hover:text-amber-300"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <p>⏰ <strong>Scheduled:</strong> {trip.pickupDate} at {trip.pickupTime}</p>
                <p>📍 <strong>Pickup:</strong> {trip.pickupAddress}</p>
                <p>🏁 <strong>Dropoff:</strong> {trip.dropoffAddress}</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleOpenMaps(trip.pickupAddress)}
                  className="px-4 py-1.5 rounded-xl bg-[#0D1322] border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5" />
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
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Earnings Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Today's Earnings</span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                ${totalEarningsToday.toFixed(2)} AUD
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Trips Completed Today</span>
              <div className="text-2xl font-black font-mono text-cyan-300">
                {historyTrips.length} Rides
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Driver Performance</span>
              <div className="text-2xl font-black font-mono text-amber-400">
                ⭐ {currentDriver.rating} Rating
              </div>
            </div>
          </div>

          {/* Past Trips List */}
          <div className="space-y-3">
            {historyTrips.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-300">{t.bookingNumber}</span>
                    <span className="text-emerald-400 font-bold font-mono">+${t.driverPayout.toFixed(2)} AUD</span>
                    <span className="px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                      COMPLETED ✓
                    </span>
                  </div>
                  <p className="text-slate-200 font-semibold">{t.passengerName} • {t.pickupTime}</p>
                  <p className="text-slate-400 text-[11px]">{t.pickupAddress} ➔ {t.dropoffAddress}</p>
                </div>

                <span className="text-[10px] text-slate-500 font-mono">Paid to Chauffeur</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
