import React, { useEffect, useState } from 'react';
import { driverPortalApi } from '../services/api';
import { BookingLeg } from '../types';
import {
  Smartphone,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Radio,
  DollarSign,
  Shield,
  Send,
  AlertCircle,
  Car
} from 'lucide-react';

export const DriverPortalPage: React.FC = () => {
  const [shiftStatus, setShiftStatus] = useState<'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY'>('AVAILABLE');
  const [activeLeg, setActiveLeg] = useState<BookingLeg | null>(null);
  const [legStatus, setLegStatus] = useState<'ALLOCATED' | 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED'>('ALLOCATED');
  const [gpsPingsCount, setGpsPingsCount] = useState(14);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Inject active demo driver manifest
    setActiveLeg({
      id: 'leg-drv-101',
      booking_id: 'bk-101',
      leg_number: 1,
      status: 'ALLOCATED',
      pickup_address: 'Park Hyatt Melbourne, 1 Parliament Square',
      dropoff_address: 'Melbourne Airport Terminal 4',
      pickup_datetime: new Date(Date.now() + 1800000).toISOString(),
      is_airport_pickup: false,
      flight_delay_minutes: 0,
      wait_time_minutes: 0,
      wait_time_charge: 0,
      vehicle_category: 'SEDAN_EXECUTIVE',
      allocation_cost: 165.0,
      partner_payout_amount: 0,
      passenger_notes: 'VIP Guest. Please hold nameboard "Mr. Alexander Vance". Cold bottled water required.',
    });
  }, []);

  const handleStepStatus = async (nextStatus: 'EN_ROUTE' | 'ARRIVED' | 'PICKED_UP' | 'COMPLETED') => {
    setLegStatus(nextStatus);
    setToastMessage(`Status updated to ${nextStatus}. Customer & Dispatch notified!`);
    setTimeout(() => setToastMessage(null), 3000);

    try {
      if (activeLeg) {
        await driverPortalApi.stepLegStatus(activeLeg.id, nextStatus);
      }
    } catch (err) {
      console.log('Simulated step status in demo mode', nextStatus);
    }
  };

  const handleSimulateGPS = async () => {
    setGpsPingsCount((prev) => prev + 1);
    setToastMessage(`GPS Coordinates (-37.8136, 144.9631) transmitted to Dispatch Radar.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const steps = [
    { id: 'ALLOCATED', label: 'Allocated' },
    { id: 'EN_ROUTE', label: 'En Route' },
    { id: 'ARRIVED', label: 'Arrived' },
    { id: 'PICKED_UP', label: 'Picked Up' },
    { id: 'COMPLETED', label: 'Completed' },
  ];

  const currentStepIdx = steps.findIndex((s) => s.id === legStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Driver Mobile Web App (PWA)</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold font-mono">
              DRIVER TELEMETRY ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mobile-optimized chauffeur portal with one-tap status stepper, GPS tracking, and customer fare privacy isolation.
          </p>
        </div>

        {/* Chauffeur Shift Status Toggle */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['AVAILABLE', 'ON_TRIP', 'OFF_DUTY'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setShiftStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                shiftStatus === st
                  ? st === 'AVAILABLE'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : st === 'ON_TRIP'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <span>{toastMessage}</span>
          <span className="text-[10px] bg-cyan-500/30 px-2 py-0.5 rounded">Live Telemetry</span>
        </div>
      )}

      {/* Centerpiece: Smartphone Simulator Frame */}
      <div className="flex justify-center">
        <div className="w-full max-w-[400px] rounded-[40px] p-4 bg-slate-950 border-[6px] border-slate-800 shadow-2xl shadow-cyan-500/10 space-y-4">
          {/* Phone Notch & Status */}
          <div className="flex justify-between items-center px-4 pt-1 text-[11px] text-slate-400">
            <span className="font-mono font-bold text-slate-200">09:41</span>
            <div className="w-16 h-3 bg-slate-800 rounded-full" />
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>5G</span>
            </div>
          </div>

          {/* Chauffeur Header Badge */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Assigned Chauffeur</span>
              <h3 className="text-sm font-bold text-slate-100">Daniel Ricciardo</h3>
              <p className="text-[10px] text-slate-400">Mercedes S-Class (CROWN-01)</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Your Payout</span>
              <span className="text-base font-mono font-black text-emerald-400">${activeLeg?.allocation_cost.toFixed(2)}</span>
            </div>
          </div>

          {/* Privacy Notice Banner */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Customer fare shielded for corporate confidentiality.</span>
          </div>

          {/* Active Job Manifest Card */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold">NEXT PICKUP</span>
              <span className="text-xs font-mono text-slate-300">10:00 AM AEST</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 text-slate-200">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Pickup</span>
                  <span className="text-slate-300 text-[11px]">{activeLeg?.pickup_address}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-slate-200">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Destination</span>
                  <span className="text-slate-300 text-[11px]">{activeLeg?.dropoff_address}</span>
                </div>
              </div>
            </div>

            {/* Passenger Special Notes */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-amber-300/90">
              <strong>Instructions:</strong> {activeLeg?.passenger_notes}
            </div>

            {/* Quick Action Navigation & Call */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeLeg?.pickup_address || '')}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Navigate</span>
              </a>

              <button
                onClick={handleSimulateGPS}
                className="py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Ping GPS ({gpsPingsCount})</span>
              </button>
            </div>
          </div>

          {/* 1-Tap Trip Stepper Status Matrix */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-bold text-slate-400 block px-1">STEPPER STATUS PROGRESSION</span>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleStepStatus('EN_ROUTE')}
                disabled={currentStepIdx >= 1}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  legStatus === 'EN_ROUTE'
                    ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-black'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>1. En Route</span>
              </button>

              <button
                onClick={() => handleStepStatus('ARRIVED')}
                disabled={currentStepIdx < 1 || currentStepIdx >= 2}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  legStatus === 'ARRIVED'
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30 font-black'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>2. Arrived</span>
              </button>

              <button
                onClick={() => handleStepStatus('PICKED_UP')}
                disabled={currentStepIdx < 2 || currentStepIdx >= 3}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  legStatus === 'PICKED_UP'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 font-black'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>3. Picked Up</span>
              </button>

              <button
                onClick={() => handleStepStatus('COMPLETED')}
                disabled={currentStepIdx < 3}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  legStatus === 'COMPLETED'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-black'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>4. Complete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
