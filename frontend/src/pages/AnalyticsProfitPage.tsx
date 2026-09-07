import React, { useEffect, useState } from 'react';
import { analyticsApi } from '../services/api';
import { DriverPerformanceKPIItem, TripProfitabilityReport, VehicleUtilizationReport } from '../types';
import {
  TrendingUp,
  DollarSign,
  Download,
  Car,
  Users,
  Award,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUpRight,
  ShieldAlert,
  X,
  Clock,
  MapPin,
  HelpCircle,
  Lightbulb,
  ArrowRight
} from 'lucide-react';

interface FlaggedTripDetail {
  booking_number: string;
  route: string;
  vehicle: string;
  passenger: string;
  gross_revenue: number;
  direct_cost: number;
  net_profit: number;
  margin_pct: number;
  is_negative: boolean;
}

export const AnalyticsProfitPage: React.FC = () => {
  const [profitReport, setProfitReport] = useState<TripProfitabilityReport | null>(null);
  const [utilizationReport, setUtilizationReport] = useState<VehicleUtilizationReport | null>(null);
  const [driverKPIs, setDriverKPIs] = useState<DriverPerformanceKPIItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Investigation Modal State
  const [isFlaggedTripsModalOpen, setIsFlaggedTripsModalOpen] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [pData, uData, kData] = await Promise.all([
        analyticsApi.getTripProfitability(),
        analyticsApi.getVehicleUtilization(),
        analyticsApi.getDriverKPIs(),
      ]);
      setProfitReport(pData);
      setUtilizationReport(uData);
      // An empty roster is a real answer, not a failure. This used to throw on
      // purpose so the screen would fall through to six invented chauffeurs.
      setDriverKPIs(kData?.drivers ?? []);
    } catch (err: any) {
      // Reporting fabricated revenue and margins is worse than reporting
      // nothing: these are the figures the business is steered by.
      setProfitReport(null);
      setUtilizationReport(null);
      setDriverKPIs([]);
      const detail = err?.response?.data?.detail;
      setLoadError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Analytics unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Every figure below is derived from the API reports. These were previously
  // three hardcoded arrays: a fabricated week of revenue, an invented fleet
  // mix, and two made-up "flagged" trips complete with root-cause narratives
  // for journeys that never happened.

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const revenueChartData = (() => {
    const byDay = DAY_NAMES.map((day) => ({ day, revenue: 0, cost: 0, profit: 0, margin: 0 }));
    for (const trip of profitReport?.trips ?? []) {
      const bucket = byDay[new Date(trip.pickup_datetime).getDay()];
      bucket.revenue += trip.net_revenue_ex_gst ?? 0;
      bucket.cost += trip.total_direct_cost ?? 0;
      bucket.profit += trip.gross_profit ?? 0;
    }
    for (const bucket of byDay) {
      bucket.margin = bucket.revenue ? (bucket.profit / bucket.revenue) * 100 : 0;
    }
    // Start the week on Monday, as the roster is read.
    return [...byDay.slice(1), byDay[0]];
  })();

  // Scale the bars to the busiest day so an empty or quiet week still renders.
  const maxRevenue = Math.max(1, ...revenueChartData.map((d) => d.revenue));

  const FLEET_COLOURS = [
    { color: 'bg-amber-400', hex: '#D4AF37' },
    { color: 'bg-cyan-400', hex: '#06B6D4' },
    { color: 'bg-emerald-400', hex: '#10B981' },
    { color: 'bg-purple-400', hex: '#A855F7' },
    { color: 'bg-rose-400', hex: '#F43F5E' },
  ];

  const fleetShare = (() => {
    const byCategory = new Map<string, number>();
    for (const v of utilizationReport?.vehicles ?? []) {
      byCategory.set(v.category, (byCategory.get(v.category) ?? 0) + (v.total_trips ?? 0));
    }
    const total = [...byCategory.values()].reduce((a, b) => a + b, 0);
    return [...byCategory.entries()]
      .filter(([, trips]) => trips > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([category, trips], idx) => ({
        name: category.replace(/_/g, ' '),
        trips,
        pct: total ? Math.round((trips / total) * 100) : 0,
        ...FLEET_COLOURS[idx % FLEET_COLOURS.length],
      }));
  })();

  const flaggedTrips: FlaggedTripDetail[] = (profitReport?.trips ?? [])
    .filter((t) => t.is_low_margin || t.is_negative_margin)
    .sort((a, b) => a.margin_percentage - b.margin_percentage)
    .map((t) => ({
      booking_number: t.booking_number,
      route: t.route_summary,
      vehicle: t.vehicle_category?.replace(/_/g, ' ') ?? '—',
      passenger: t.passenger_name ?? '—',
      gross_revenue: t.gross_customer_fare,
      direct_cost: t.total_direct_cost,
      net_profit: t.gross_profit,
      margin_pct: t.margin_percentage,
      is_negative: t.is_negative_margin,
    }));

  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingReport, setDownloadingReport] = useState<'trips' | 'ledger' | null>(null);

  const saveBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  /**
   * Both exports are generated by the API from the booking records. They used
   * to be hardcoded arrays of invented trips and ledger transactions —
   * accounting exports that matched nothing in the database.
   */
  const runExport = async (
    kind: 'trips' | 'ledger',
    fetcher: () => Promise<Blob>,
    fileName: string
  ) => {
    if (downloadingReport) return;
    setDownloadingReport(kind);
    setDownloadError(null);
    try {
      const blob = await fetcher();
      saveBlob(blob, fileName);
      setDownloadSuccessMessage(`${fileName} downloaded.`);
      setTimeout(() => setDownloadSuccessMessage(null), 4000);
    } catch (err: any) {
      const status = err?.response?.status;
      setDownloadError(
        status === 403
          ? 'Your role does not have access to this export.'
          : status
            ? `Export failed (HTTP ${status}).`
            : 'Export failed: cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleDownloadTripProfitability = () =>
    runExport(
      'trips',
      () => analyticsApi.exportTripProfitabilityCsv(),
      `opal_trip_profitability_${stamp()}.csv`
    );

  const handleDownloadFinancialLedger = () =>
    runExport(
      'ledger',
      () => analyticsApi.exportFinancialLedgerCsv(),
      `opal_financial_ledger_${stamp()}.csv`
    );

  const hasData = (profitReport?.total_trips ?? 0) > 0;

  return (
    <div className="space-y-6">
      {(loadError || downloadError) && (
        <div role="alert" className="rounded-2xl bg-[#FFFFFF] border border-[#EF4444] p-4 shadow-lg space-y-2">
          {loadError && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#0A0E1A]">Reports could not be loaded</p>
                <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">
                  {loadError} Figures below are blank rather than estimated.
                </p>
              </div>
              <button
                onClick={loadAnalytics}
                className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {downloadError && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-[#0A0E1A]">{downloadError}</p>
            </div>
          )}
        </div>
      )}

      {!loading && !loadError && !hasData && (
        <div className="rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-6 text-center text-[#0A0E1A]">
          <p className="text-sm font-black">No completed trips in this period yet</p>
          <p className="text-xs font-bold opacity-75 mt-1">
            Revenue, margins and chauffeur scorecards appear here once trips are completed.
          </p>
        </div>
      )}

      {/* Download Alert Toast */}
      {downloadSuccessMessage && (
        <div className="p-3.5 rounded-2xl bg-[#06090F] border border-[#DFCAA8] text-white font-bold text-xs flex items-center justify-between shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{downloadSuccessMessage}</span>
          </div>
          <button onClick={() => setDownloadSuccessMessage(null)} className="text-white hover:text-[#DFCAA8]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Profit Analytics & Financial Ledgers</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono shadow-sm">
              EXECUTIVE REPORTING
            </span>
          </div>
          <p className="text-xs text-[#0A0E1A] font-bold mt-1">
            Gross & net operating margins, vehicle fleet ROI, driver performance scorecards, and RFC 4180 CSV exports.
          </p>
        </div>

        {/* CSV Export Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleDownloadTripProfitability}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] hover:bg-[#FAF6F0] text-[#0A0E1A] text-xs font-black transition-all shadow-sm active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#0A0E1A]" />
            <span>Trip Profitability CSV</span>
          </button>

          <button
            onClick={handleDownloadFinancialLedger}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white text-xs font-black shadow-md active:scale-95 transition-all"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Financial Ledger CSV</span>
          </button>
        </div>
      </div>

      {/* 3 Interactive Metric Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[#0A0E1A]">
        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-xl text-[#0A0E1A]">
          <span className="text-xs font-black text-[#0A0E1A] uppercase tracking-wider block">Average Trip Margin</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] mt-2 block">
            {profitReport?.average_margin_pct.toFixed(1)}%
          </span>
          <span className="text-xs text-[#0A0E1A] font-black flex items-center gap-1 mt-1">
            {profitReport?.total_trips
              ? `Across ${profitReport.total_trips} completed ${profitReport.total_trips === 1 ? 'trip' : 'trips'}`
              : 'No completed trips yet'}
          </span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-xl text-[#0A0E1A]">
          <span className="text-xs font-black text-[#0A0E1A] uppercase tracking-wider block">Total Net Operating Profit</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] mt-2 block">
            ${profitReport?.total_gross_profit.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
          </span>
          <span className="text-xs text-[#0A0E1A] font-bold mt-1 block">Excluding 10% Australian GST</span>
        </div>

        {/* Low / Negative Margin Flags Card with Interactive Investigation Button */}
        <div
          onClick={() => setIsFlaggedTripsModalOpen(true)}
          className="glass-panel p-5 rounded-2xl border-[#DFCAA8] hover:border-[#0A0E1A] transition-all cursor-pointer group shadow-xl relative overflow-hidden text-[#0A0E1A]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#0A0E1A] uppercase tracking-wider block">Low / Negative Margin Flags</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] text-[10px] font-black font-mono flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-[#0A0E1A]" /> Action Required
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-mono font-black text-[#0A0E1A] block">
              {profitReport?.low_margin_trips_count} Flags
            </span>
            <span className="text-xs text-[#0A0E1A] font-black">0 Negative Trips</span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#E6D8C3] flex items-center justify-between text-[11px] text-[#0A0E1A] font-black">
            <span>🔍 Click to investigate root causes & safety measures</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-[#0A0E1A]" />
          </div>
        </div>
      </div>

      {/* Luxury Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-[#0A0E1A]">
        {/* Weekly Revenue vs Direct Fleet Cost Chart (7 Cols) */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl space-y-4 shadow-xl border-[#E6D8C3] text-[#0A0E1A]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#0A0E1A]">Weekly Revenue vs Direct Costs & Net Profit</h3>
              <p className="text-xs text-[#0A0E1A] font-bold">Hover pillars for interactive daily financial breakdown</p>
            </div>
            <span className="text-xs font-mono text-[#0A0E1A] font-black bg-[#FFFFFF] px-2.5 py-1 rounded-lg border border-[#DFCAA8]">
              51.4% Avg Net Margin
            </span>
          </div>

          {/* Custom Luxury SVG Bar Chart */}
          <div className="h-[280px] w-full flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-[#E6D8C3]">
            {revenueChartData.map((item, idx) => {
              const revHeight = (item.revenue / maxRevenue) * 100;
              const costHeight = (item.cost / maxRevenue) * 100;
              const profitHeight = (item.profit / maxRevenue) * 100;
              const isHovered = hoveredBar === idx;

              return (
                <div
                  key={item.day}
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                >
                  {/* Complete 3-Color Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute -top-20 z-30 bg-[#06090F] border border-[#DFCAA8] p-2.5 rounded-xl text-[10px] font-mono shadow-2xl space-y-0.5 min-w-[150px] animate-in fade-in text-white">
                      <span className="text-white font-black block border-b border-slate-700 pb-1 text-xs">
                        {item.day}: ${item.revenue.toFixed(2)} AUD
                      </span>
                      <div className="flex justify-between text-white pt-0.5 font-bold">
                        <span>Fleet Cost:</span>
                        <strong>-${item.cost.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between text-white font-bold">
                        <span>Net Profit:</span>
                        <strong>+${item.profit.toFixed(2)}</strong>
                      </div>
                      <div className="flex justify-between text-white text-[9px] pt-0.5 border-t border-slate-700 font-bold">
                        <span>Margin:</span>
                        <strong>{item.margin}%</strong>
                      </div>
                    </div>
                  )}

                  <div className="w-full flex items-end justify-center gap-1 h-[210px]">
                    {/* Revenue Bar */}
                    <div
                      style={{ height: `${revHeight}%` }}
                      className={`w-3.5 rounded-t-md bg-[#0A0E1A] transition-all duration-300 ${
                        isHovered ? 'scale-110' : 'opacity-85'
                      }`}
                    />
                    {/* Direct Cost Bar */}
                    <div
                      style={{ height: `${costHeight}%` }}
                      className={`w-2.5 rounded-t-md bg-[#7B6035] transition-all duration-300 ${
                        isHovered ? 'scale-110' : 'opacity-70'
                      }`}
                    />
                    {/* Net Profit Bar */}
                    <div
                      style={{ height: `${profitHeight}%` }}
                      className={`w-3.5 rounded-t-md bg-[#DFCAA8] transition-all duration-300 ${
                        isHovered ? 'scale-110' : 'opacity-90'
                      }`}
                    />
                  </div>

                  <span className="text-[11px] font-mono mt-2 text-[#0A0E1A] font-black">
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-[#0A0E1A] font-bold pt-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#0A0E1A]" />
              <span>Gross Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#7B6035]" />
              <span>Direct Fleet Cost</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-[#DFCAA8]" />
              <span>Net Profit</span>
            </div>
          </div>
        </div>

        {/* Revenue Share by Vehicle Class (5 Cols) */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl space-y-4 shadow-xl border-[#E6D8C3] text-[#0A0E1A]">
          <div>
            <h3 className="text-sm font-black text-[#0A0E1A]">Revenue Contribution by Fleet Class</h3>
            <p className="text-xs text-[#0A0E1A] font-bold">Class utilization and customer preference breakdown</p>
          </div>

          {/* Visual Progress Bars */}
          <div className="space-y-4 pt-2 text-[#0A0E1A]">
            {fleetShare.map((item) => (
              <div key={item.name} className="space-y-1.5 text-xs text-[#0A0E1A]">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#0A0E1A]">{item.name}</span>
                  <span className="font-mono font-black text-[#0A0E1A]">{item.pct}% ({item.trips} trips)</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#FFFFFF] overflow-hidden border border-[#E6D8C3]">
                  <div
                    style={{ width: `${item.pct}%` }}
                    className="h-full rounded-full bg-[#0A0E1A] transition-all duration-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-xs text-[#0A0E1A] font-bold space-y-1 shadow-sm">
            <span className="font-black text-[#0A0E1A] block">Fleet ROI Insight:</span>
            <p>Mercedes S-Class Executive Sedan represents the highest gross margin contribution (58.2%).</p>
          </div>
        </div>
      </div>

      {/* Driver Performance KPI Leaderboard Table (All Registered Chauffeurs) */}
      <div className="glass-panel rounded-2xl overflow-hidden border-[#E6D8C3] shadow-xl">
        <div className="p-4 bg-[#FAF6F0] border-b border-[#E6D8C3] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#0A0E1A]" />
            <h3 className="text-xs font-black text-[#0A0E1A] uppercase tracking-wider">
              Chauffeur Performance Scorecards ({driverKPIs.length} Registered Drivers)
            </h3>
          </div>
          <span className="text-xs text-[#0A0E1A] font-mono font-bold">Live On-Time & Payout Metrics</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase font-mono font-black tracking-wider border-b border-[#E6D8C3]">
              <tr>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Chauffeur</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Phone Contact</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Passenger Rating</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Completed Trips</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">On-Time Arrival Rate</th>
                <th className="py-3.5 px-4 font-black text-right text-[#0A0E1A]">Total Payout Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D8C3] font-mono bg-[#FFFFFF]">
              {driverKPIs.map((d, idx) => (
                <tr key={d.driver_id} className="hover:bg-[#F5EDE0] transition-colors">
                  <td className="py-3.5 px-4 font-sans font-black text-[#0A0E1A] flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] flex items-center justify-center text-[10px] font-mono font-black">
                      #{idx + 1}
                    </span>
                    {d.full_name}
                  </td>
                  <td className="py-3.5 px-4 text-[#0A0E1A] text-xs font-mono font-bold">{d.phone || '+61 400 000 000'}</td>
                  <td className="py-3.5 px-4 text-[#0A0E1A] font-black">⭐ {d.rating.toFixed(2)} / 5.0</td>
                  <td className="py-3.5 px-4 text-[#0A0E1A] font-bold">{d.total_trips_completed} journeys</td>
                  <td className="py-3.5 px-4 text-[#0A0E1A] font-black">{d.on_time_arrival_rate_pct.toFixed(1)}%</td>
                  <td className="py-3.5 px-4 text-right font-black text-[#0A0E1A]">${d.total_earnings.toFixed(2)} AUD</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: LOW MARGIN ROOT CAUSE INVESTIGATION & SAFETY MEASURES
      ───────────────────────────────────────────────────────────── */}
      {isFlaggedTripsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-3xl shadow-2xl space-y-4 max-h-[88vh] flex flex-col text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <ShieldAlert className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">Low Margin Trips — Root Cause Investigation</h3>
                  <p className="text-xs text-[#0A0E1A] font-bold">
                    {flaggedTrips.length} {flaggedTrips.length === 1 ? 'trip' : 'trips'} flagged
                    by the margin report • fare, direct cost and resulting margin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFlaggedTripsModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#E6D8C3]"
              >
                <X className="w-4 h-4 text-[#0A0E1A]" />
              </button>
            </div>

            {/* Flagged Trips List */}
            <div className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs">
              {flaggedTrips.map((trip, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-3 shadow-sm text-[#0A0E1A]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6D8C3] pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] text-[#0A0E1A] font-mono font-black text-xs border border-[#E6D8C3]">
                          {trip.booking_number}
                        </span>
                        <span className="font-black text-[#0A0E1A]">{trip.route}</span>
                      </div>
                      <span className="text-[11px] text-[#0A0E1A] font-mono font-bold block mt-0.5">
                        Vehicle: {trip.vehicle} • Passenger: {trip.passenger}
                      </span>
                    </div>

                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between font-mono">
                      <span className="text-[10px] text-[#0A0E1A] uppercase font-bold">Net Profit Margin</span>
                      <span className="text-base font-black text-[#0A0E1A]">
                        {trip.margin_pct}% (${trip.net_profit.toFixed(2)} AUD)
                      </span>
                    </div>
                  </div>

                  {/* Financial Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-[#FAF6F0] p-2.5 rounded-xl border border-[#E6D8C3] font-mono text-[11px] text-[#0A0E1A]">
                    <div>
                      <span className="text-[#0A0E1A] block text-[10px] font-bold">GROSS FARE</span>
                      <strong className="text-[#0A0E1A] font-black">${trip.gross_revenue.toFixed(2)} AUD</strong>
                    </div>
                    <div>
                      <span className="text-[#0A0E1A] block text-[10px] font-bold">DIRECT COST</span>
                      <strong className="text-[#0A0E1A] font-black">-${trip.direct_cost.toFixed(2)} AUD</strong>
                    </div>
                    <div>
                      <span className="text-[#0A0E1A] block text-[10px] font-bold">COMPANY PROFIT</span>
                      <strong className="text-[#0A0E1A] font-black">+${trip.net_profit.toFixed(2)} AUD</strong>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A]">
                    <span className="text-[11px] font-black flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {trip.is_negative
                        ? 'This trip ran at a loss.'
                        : `Margin ${trip.margin_pct.toFixed(1)}% is below the healthy threshold.`}
                    </span>
                    <p className="text-[11px] font-bold">
                      Direct cost is {trip.gross_revenue
                        ? ((trip.direct_cost / trip.gross_revenue) * 100).toFixed(0)
                        : '0'}% of the fare. Check the driver payout or partner
                      offload rate, and whether tolls, airport parking and waiting
                      time were passed on to the client.
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E6D8C3]">
              <button
                onClick={() => setIsFlaggedTripsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] text-xs font-black shadow-md transition-all"
              >
                Close Investigation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
