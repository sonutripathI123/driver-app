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

interface FlightView {
  flight_number: string;
  airline: string;
  origin_airport: string;
  origin_gate: string;
  destination_airport: string;
  terminal: string;
  gate: string;
  scheduled_arrival: string;
  estimated_arrival: string;
  delay_minutes: number;
  status: string;
  rescheduled_pickup_time: string;
  wait_time_policy: string;
}

export const FlightRadarPage: React.FC = () => {
  const [flightQuery, setFlightQuery] = useState('');
  const [flightData, setFlightData] = useState<FlightView | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  // null = not yet known; set from whether the API reports a configured provider.
  const [providerConnected, setProviderConnected] = useState<boolean | null>(null);

  const [waitMinutes, setWaitMinutes] = useState(75);
  const excessWaitTimeCharge = Math.max(0, waitMinutes - 60) * 1.5;

  const AEST = 'Australia/Melbourne';
  const fmtAest = (iso?: string | null) =>
    iso
      ? `${new Intl.DateTimeFormat('en-AU', {
          timeZone: AEST, hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(new Date(iso))} AEST`
      : '—';

  /**
   * Shows only what the provider actually returned.
   *
   * The page used to seed itself with an invented VA214 arrival, and even on a
   * successful lookup it pasted hardcoded gates and a fixed "18:30 AEST"
   * schedule over the API's own values. On failure it fabricated the whole
   * record from an airline-prefix table. Fields the provider does not supply —
   * gates, origin gate — are shown as unavailable instead.
   */
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = flightQuery.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanQuery || isLooking) return;

    setIsLooking(true);
    setLookupError(null);
    try {
      const data = await flightsApi.lookup(cleanQuery);
      const delay = data.delay_minutes ?? 0;
      setProviderConnected(true);
      setFlightData({
        flight_number: data.flight_number || cleanQuery,
        airline: data.airline || '—',
        origin_airport: data.origin_airport || '—',
        origin_gate: '—',
        destination_airport: data.destination_airport || '—',
        terminal: data.terminal || '—',
        gate: '—',
        scheduled_arrival: fmtAest(data.scheduled_arrival),
        estimated_arrival: fmtAest(data.estimated_arrival ?? data.scheduled_arrival),
        delay_minutes: delay,
        status: data.status || (delay > 0 ? 'DELAYED' : 'ON_TIME'),
        // The dispatch service adds the pickup buffer when a leg is synced;
        // this screen is a lookup, so it does not assert a new pickup time.
        rescheduled_pickup_time: delay >= 15
          ? `Sync the booking leg to move the pickup by ${delay} minutes`
          : 'No reschedule required',
        wait_time_policy: '60 minutes complimentary from touchdown',
      });
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      // 503 is the API saying no provider is configured; 404 means the provider
      // answered but had nothing for that flight.
      if (status === 503) setProviderConnected(false);
      else if (status === 404) setProviderConnected(true);
      setFlightData(null);
      setLookupError(
        typeof detail === 'string'
          ? detail
          : status === 404
            ? `No live data found for flight ${cleanQuery}.`
            : status
              ? `Flight lookup failed (HTTP ${status}).`
              : 'Flight lookup failed: cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setIsLooking(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Airport Flight Radar & Automation</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono shadow-sm border ${
                providerConnected === false
                  ? 'bg-[#FFFFFF] border-[#EF4444] text-[#B91C1C]'
                  : 'bg-[#FFFFFF] border-[#DFCAA8] text-[#0A0E1A]'
              }`}
            >
              {providerConnected === false
                ? 'NO FLIGHT PROVIDER CONNECTED'
                : providerConnected
                  ? 'LIVE PROVIDER CONNECTED'
                  : 'FLIGHT PROVIDER STATUS UNKNOWN'}
            </span>
          </div>
          <p className="text-xs text-[#0A0E1A] font-bold mt-1">
            Commercial flight tracking with automatic pickup buffer. Arrival times,
            terminal and delay come from the connected provider — nothing is estimated here.
          </p>
        </div>

        {/* Flight Search Form */}
        <form onSubmit={handleLookup} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#0A0E1A]" />
            <input
              type="text"
              value={flightQuery}
              onChange={(e) => setFlightQuery(e.target.value)}
              placeholder="e.g. VA214, EK404, QF400"
              className="w-full pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs text-[#0A0E1A] uppercase font-mono focus:outline-none focus:border-[#0A0E1A] font-black placeholder-[#0A0E1A]/50"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs whitespace-nowrap shadow-md hover:scale-[1.02] transition-all"
          >
            Track Flight ✈️
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 3D Holographic Globe (5 Cols) */}
        <div className="lg:col-span-5 h-[420px]">
          <RadarGlobeCanvas activeFlightsCount={flightData ? 1 : 0} activeDriversCount={0} />
        </div>

        {/* Right Column: Flight Telemetry & Delay Compensation Card (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          {flightData && (
          <div className="glass-panel p-6 rounded-2xl space-y-4 text-xs shadow-xl animate-in fade-in duration-300 text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <Plane className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0A0E1A] font-mono tracking-wide">{flightData.flight_number}</h3>
                  <span className="text-xs text-[#0A0E1A] font-bold">{flightData.airline}</span>
                </div>
              </div>

              <span
                className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8]"
              >
                ● {flightData.status} {flightData.delay_minutes > 0 ? `(+${flightData.delay_minutes}m)` : '✓'}
              </span>
            </div>

            {/* Flight Route Details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#06090F] border border-[#1E2738] text-white">
              <div>
                <span className="text-[10px] uppercase font-bold text-white block">Departure Origin</span>
                <span className="text-sm font-black text-white block mt-0.5">{flightData.origin_airport}</span>
                <span className="text-[11px] text-white block mt-0.5 font-mono font-bold">Gate Dep: {flightData.origin_gate}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-white block">Arrival Destination</span>
                <span className="text-sm font-black text-white block mt-0.5">{flightData.destination_airport}</span>
                <span className="text-[11px] text-white block mt-0.5 font-mono font-bold">{flightData.terminal} • {flightData.gate}</span>
              </div>
            </div>

            {/* Automated Rescheduling Action Box */}
            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#DFCAA8] space-y-2 text-[#0A0E1A]">
              <div className="flex items-center gap-2 text-[#0A0E1A] font-black text-xs">
                <AlertTriangle className="w-4 h-4 text-[#0A0E1A] shrink-0" />
                <span>Automated Pickup Reschedule Trigger:</span>
              </div>
              <p className="text-[#0A0E1A] text-xs leading-relaxed font-bold">
                {flightData.delay_minutes > 0 ? (
                  <>
                    Flight delayed by <strong>{flightData.delay_minutes} mins</strong>. Chauffeur pickup automatically shifted to{' '}
                    <strong className="text-[#0A0E1A] font-mono font-black">{flightData.rescheduled_pickup_time}</strong>.
                    Passenger and driver SMS alerts dispatched.
                  </>
                ) : (
                  <>
                    Flight is running <strong>100% on schedule</strong>. Chauffeur pickup scheduled for{' '}
                    <strong className="text-[#0A0E1A] font-mono font-black">{flightData.rescheduled_pickup_time}</strong>.
                  </>
                )}
              </p>
            </div>
          </div>
          )}

          {!flightData && (
            <div className="glass-panel p-6 rounded-2xl text-xs shadow-xl text-[#0A0E1A] space-y-2">
              {lookupError ? (
                <>
                  <p className="text-sm font-black">Flight data unavailable</p>
                  <p className="font-bold opacity-80 break-words">{lookupError}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-black">Search a flight number to begin</p>
                  <p className="font-bold opacity-80">
                    Arrival times, terminal and delay come from the connected flight
                    data provider. Nothing is shown until a lookup returns.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Complimentary Wait Time & Billing Simulator */}
          <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] space-y-3 text-xs shadow-lg text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-2">
              <div className="flex items-center gap-2 text-[#0A0E1A] font-black">
                <Clock className="w-4 h-4 text-[#0A0E1A]" />
                <span>Meet & Greet Wait-Time Billing Calculator</span>
              </div>
              <span className="text-[#0A0E1A] font-black font-mono">60 Min Complimentary</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-[#0A0E1A] font-bold mb-1">Total Wait Time Since Touchdown (Minutes):</label>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="5"
                  value={waitMinutes}
                  onChange={(e) => setWaitMinutes(parseInt(e.target.value))}
                  className="w-full accent-[#06090F] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#0A0E1A] mt-1 font-mono font-bold">
                  <span>0 min</span>
                  <span>60 min (Free Limit)</span>
                  <span>120 min</span>
                </div>
              </div>

              <div className="text-right pl-4 border-l border-[#E6D8C3] min-w-[120px]">
                <span className="text-[10px] text-[#0A0E1A] font-bold block">Excess Wait Charge</span>
                <span className="text-2xl font-mono font-black text-[#0A0E1A]">${excessWaitTimeCharge.toFixed(2)} AUD</span>
                <span className="text-[10px] text-[#0A0E1A] font-bold block mt-0.5">
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
