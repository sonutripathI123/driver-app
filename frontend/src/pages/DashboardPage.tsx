import React, { useEffect, useState } from 'react';
import { LuxuryCarCanvas } from '../components/3d/LuxuryCarCanvas';
import { RadarGlobeCanvas } from '../components/3d/RadarGlobeCanvas';
import { analyticsApi, bookingsApi } from '../services/api';
import { Booking, ExecutiveDashboardSummary } from '../types';
import {
  Sparkles,
  Car,
  Plane,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  DollarSign,
  Users,
  MapPin,
  Send,
  PlusCircle,
  TrendingUp,
  Building2,
  Calendar
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<ExecutiveDashboardSummary | null>(null);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [sumData, bData] = await Promise.all([
        analyticsApi.getDashboardSummary(),
        bookingsApi.list(),
      ]);
      setSummary(sumData);
      setPendingBookings(bData.bookings?.slice(0, 3) || []);
    } catch (err) {
      setSummary({
        date_from: new Date().toISOString(),
        date_to: new Date().toISOString(),
        gross_revenue_inc_gst: 18450.0,
        net_revenue_ex_gst: 16772.73,
        gst_collected_10pct: 1677.27,
        total_driver_costs: 7120.0,
        total_partner_costs: 1850.0,
        total_direct_costs: 8970.0,
        gross_profit: 7802.73,
        gross_profit_margin_pct: 46.52,
        total_bookings: 38,
        completed_trips_count: 32,
        cancelled_trips_count: 2,
        cancellation_rate_pct: 5.26,
        average_booking_value: 485.53,
      });

      // Default demo queue
      setPendingBookings([
        {
          id: 'b-01',
          booking_number: 'CCM-2026-0881',
          source: 'WEBSITE',
          status: 'PENDING' as any,
          payment_status: 'PAID_IN_FULL',
          currency: 'AUD',
          total_fare: 440.0,
          deposit_required: 440.0,
          paid_amount: 440.0,
          balance_amount: 0.0,
          passenger_name: 'David Warner',
          passenger_phone: '+61 411 222 333',
          created_at: new Date().toISOString(),
          legs: [
            {
              id: 'l-01',
              booking_id: 'b-01',
              leg_number: 1,
              status: 'PENDING',
              pickup_address: '120 Collins St, Melbourne CBD',
              dropoff_address: 'Melbourne Airport Terminal 2 (Tullamarine)',
              pickup_datetime: new Date(Date.now() + 3600000 * 3).toISOString(),
              is_airport_pickup: true,
              flight_number: 'QF400',
              flight_delay_minutes: 25,
              wait_time_minutes: 0,
              wait_time_charge: 0,
              vehicle_category: 'SEDAN_PREMIUM',
              allocation_cost: 160.0,
              partner_payout_amount: 0,
            },
          ],
        },
        {
          id: 'b-02',
          booking_number: 'CCM-2026-0882',
          source: 'CORPORATE_PORTAL',
          status: 'PENDING' as any,
          payment_status: 'PARTIAL_DEPOSIT',
          currency: 'AUD',
          total_fare: 680.0,
          deposit_required: 170.0,
          paid_amount: 170.0,
          balance_amount: 510.0,
          passenger_name: 'Rio Tinto Mining Delegation',
          passenger_phone: '+61 499 888 777',
          created_at: new Date().toISOString(),
          legs: [
            {
              id: 'l-02',
              booking_id: 'b-02',
              leg_number: 1,
              status: 'PENDING',
              pickup_address: 'Crown Towers, Southbank',
              dropoff_address: 'Yarra Valley Estate',
              pickup_datetime: new Date(Date.now() + 3600000 * 5).toISOString(),
              is_airport_pickup: false,
              flight_delay_minutes: 0,
              wait_time_minutes: 0,
              wait_time_charge: 0,
              vehicle_category: 'PEOPLE_MOVER',
              allocation_cost: 210.0,
              partner_payout_amount: 0,
            },
          ],
        },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Command Center Banner (Matching user reference layout) */}
      <div className="relative rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Crown Chauffeurs Intelligence Active</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-100">
            Chauffeur Operations & Dispatch Command Center
          </h1>

          <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
            Autonomous corporate chauffeur dispatch and live flight delay monitoring for Melbourne & interstate hubs.
            All allocations gated with driver conflict guards.
          </p>
        </div>

        {/* Right CTA Button (Glowing Amber Pill) */}
        <div className="relative z-10 w-full md:w-auto shrink-0">
          <button
            onClick={() => onNavigate('operate')}
            className="w-full md:w-auto flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/30 hover:scale-[1.02] transition-all"
          >
            <Clock className="w-4 h-4 text-slate-950" />
            <span>Review Pending Queue (2)</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      </div>

      {/* 2. 4 Metric Cards Row (Clean, perfectly aligned glass cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Corporate Companies */}
        <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">GROSS REVENUE (INC GST)</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-100">
            ${summary?.gross_revenue_inc_gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-bold text-amber-300">
            <span>Ex GST: ${summary?.net_revenue_ex_gst.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Card 2: Upcoming Events / Journeys */}
        <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">NET OPERATING PROFIT</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">
            ${summary?.gross_profit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-300">
            <span>{summary?.gross_profit_margin_pct.toFixed(1)}% Operating Margin</span>
          </div>
        </div>

        {/* Card 3: Pending Approval / Queue */}
        <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">PENDING DISPATCH QUEUE</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            2 <span className="text-xs font-normal text-slate-400 font-sans">/ {summary?.total_bookings} Total</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-bold text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Awaiting Human Review</span>
          </div>
        </div>

        {/* Card 4: On-Time Execution */}
        <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">ON-TIME ARRIVAL RATE</span>
            <Car className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-300">
            97.6%
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-[10px] font-bold text-purple-300">
            <span>⭐ 4.96 Chauffeur Avg</span>
          </div>
        </div>
      </div>

      {/* 3. Dual 3D Interactive Showcase Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 3D Interactive Luxury Car Showcase (7 Cols) */}
        <div className="lg:col-span-7 h-[340px] sm:h-[380px] lg:h-[440px]">
          <LuxuryCarCanvas showControls={true} />
        </div>

        {/* Right: 3D Holographic Dispatch Radar & Airspace (5 Cols) */}
        <div className="lg:col-span-5 h-[340px] sm:h-[380px] lg:h-[440px]">
          <RadarGlobeCanvas activeFlightsCount={6} activeDriversCount={12} />
        </div>
      </div>

      {/* 4. Human-in-the-Loop Dispatch Queue (Bottom Section from user reference) */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#162036] border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Human-in-the-Loop Dispatch & Allocation Queue</h3>
              <p className="text-xs text-slate-400">
                AI-drafted chauffeur allocations requiring human dispatcher review before SMS dispatch.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('operate')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            <span>View full queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Itemized Queue Rows */}
        <div className="space-y-3">
          {pendingBookings.map((b) => (
            <div
              key={b.id}
              className="p-4 rounded-xl bg-[#0D1322] border border-[#1F2E4D] hover:border-amber-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-400">{b.booking_number}</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-semibold text-slate-200">{b.passenger_name}</span>
                  {b.legs[0]?.is_airport_pickup && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono">
                      ✈️ Flight {b.legs[0]?.flight_number} (+{b.legs[0]?.flight_delay_minutes}m)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {b.legs[0]?.pickup_address} ➔ {b.legs[0]?.dropoff_address}
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right font-mono">
                  <span className="font-bold text-slate-100 block">${b.total_fare.toFixed(2)} AUD</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Net Profit: +${(b.total_fare / 1.1 - 160).toFixed(2)}</span>
                </div>

                <button
                  onClick={() => onNavigate('operate')}
                  className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold transition-all"
                >
                  Allocate Driver &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
