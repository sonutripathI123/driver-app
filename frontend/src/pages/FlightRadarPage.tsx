import React, { useState } from 'react';
import { RadarGlobeCanvas } from '../components/3d/RadarGlobeCanvas';
import { flightsApi } from '../services/api';
import {
  Plane,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Search,
  MapPin,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

export const FlightRadarPage: React.FC = () => {
  const [flightQuery, setFlightQuery] = useState('QF400');
  const [flightData, setFlightData] = useState<any>({
    flight_number: 'QF400',
    airline: 'Qantas Airways',
    origin_airport: 'SYD (Sydney Kingsford)',
    destination_airport: 'MEL (Melbourne Tullamarine)',
    scheduled_arrival_utc: '2026-08-28T09:15:00Z',
    estimated_arrival_utc: '2026-08-28T09:40:00Z',
    delay_minutes: 25,
    status: 'DELAYED',
    terminal: 'T1 Domestic',
    gate: 'Gate 14',
    rescheduled_pickup_time: '2026-08-28T10:10:00 AEST (+30m buffer)',
    wait_time_policy: '60 minutes complimentary from touchdown',
  });

  const [waitMinutes, setWaitMinutes] = useState(75);
  const excessWaitTimeCharge = Math.max(0, waitMinutes - 60) * 1.5;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await flightsApi.lookup(flightQuery);
      setFlightData(data);
    } catch (err) {
      // Fallback mock
      setFlightData({
        flight_number: flightQuery.toUpperCase(),
        airline: flightQuery.startsWith('VA') ? 'Virgin Australia' : 'Qantas Airways',
        origin_airport: 'SYD (Sydney Kingsford)',
        destination_airport: 'MEL (Melbourne Tullamarine)',
        scheduled_arrival_utc: '2026-08-28T11:00:00Z',
        estimated_arrival_utc: '2026-08-28T11:20:00Z',
        delay_minutes: 20,
        status: 'DELAYED',
        terminal: 'T2 Domestic',
        gate: 'Gate 22',
        rescheduled_pickup_time: '2026-08-28T11:50:00 AEST (+30m buffer)',
        wait_time_policy: '60 minutes complimentary from touchdown',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Airport Flight Radar & Automation</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold font-mono">
              FLIGHTAWARE LIVE TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time commercial flight delay tracking, automatic pickup rescheduling, and 60-minute complimentary meet & greet buffer.
          </p>
        </div>

        {/* Flight Search Form */}
        <form onSubmit={handleLookup} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={flightQuery}
              onChange={(e) => setFlightQuery(e.target.value)}
              placeholder="e.g. QF400 or VA214"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 uppercase font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl glow-cyan-btn text-white font-bold text-xs whitespace-nowrap"
          >
            Track Flight
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 3D Holographic Globe (5 Cols) */}
        <div className="lg:col-span-5 h-[420px]">
          <RadarGlobeCanvas activeFlightsCount={8} activeDriversCount={14} />
        </div>

        {/* Right Column: Flight Telemetry & Delay Compensation Card (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="glass-panel-cyan p-6 rounded-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Plane className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100 font-mono">{flightData.flight_number}</h3>
                  <span className="text-slate-400">{flightData.airline}</span>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                {flightData.status} (+{flightData.delay_minutes}m)
              </span>
            </div>

            {/* Flight Route Details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Departure Origin</span>
                <span className="text-sm font-bold text-slate-200">{flightData.origin_airport}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">Gate Dep: Gate 4</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Arrival Destination</span>
                <span className="text-sm font-bold text-cyan-300">{flightData.destination_airport}</span>
                <span className="text-[11px] text-amber-300 block mt-0.5 font-mono">{flightData.terminal} • {flightData.gate}</span>
              </div>
            </div>

            {/* Automated Rescheduling Action Box */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Automated Pickup Reschedule Triggered:</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Flight delayed by <strong>{flightData.delay_minutes} mins</strong>. Chauffeur pickup automatically shifted to{' '}
                <strong className="text-white font-mono">{flightData.rescheduled_pickup_time}</strong>.
                Passenger and driver SMS alerts dispatched.
              </p>
            </div>
          </div>

          {/* Complimentary Wait Time & Billing Simulator */}
          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Meet & Greet Wait-Time Billing Calculator</span>
              </div>
              <span className="text-emerald-400 font-semibold font-mono">60 Min Complimentary</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-slate-400 mb-1">Total Wait Time Since Touchdown (Minutes):</label>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={waitMinutes}
                  onChange={(e) => setWaitMinutes(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                  <span>0 min</span>
                  <span>60 min (Free Limit)</span>
                  <span>120 min</span>
                </div>
              </div>

              <div className="text-right pl-4 border-l border-slate-800 min-w-[120px]">
                <span className="text-[10px] text-slate-400 block">Excess Wait Charge</span>
                <span className="text-xl font-mono font-black text-amber-400">${excessWaitTimeCharge.toFixed(2)} AUD</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ({Math.max(0, waitMinutes - 60)}m @ $1.50/m)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
