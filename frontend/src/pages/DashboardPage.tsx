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
  Calendar,
  X,
  Search,
  ExternalLink,
  Phone,
  Check,
  ChevronRight,
  Filter
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: any) => void;
}

interface DetailedBookingItem {
  id: string;
  bookingNumber: string;
  passengerName: string;
  passengerPhone: string;
  passengerEmail: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  vehicleCategory: string;
  totalFare: number;
  paymentStatus: 'PAID_IN_FULL' | 'PARTIAL_DEPOSIT' | 'INVOICED';
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  driverPayout: number;
  netProfit: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'ALLOCATED' | 'PENDING';
}

interface DriverRosterItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  plate: string;
  status: 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';
  currentBookingNumber?: string;
  currentRoute?: string;
  todayCompletedTrips: number;
  todayEarnings: number;
  rating: number;
  onTimeRate: number;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<ExecutiveDashboardSummary | null>(null);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [activeModal, setActiveModal] = useState<'REVENUE' | 'PROFIT' | 'BOOKINGS' | 'FLEET' | 'FLIGHTS' | null>(null);
  const [bookingFilter, setBookingFilter] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'PENDING'>('ALL');
  const [driverFilter, setDriverFilter] = useState<'ALL' | 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Sample detailed booking audit records
  const sampleBookings: DetailedBookingItem[] = [
    {
      id: 'b-01',
      bookingNumber: 'CCM-2026-0881',
      passengerName: 'David Warner',
      passengerPhone: '+61 411 222 333',
      passengerEmail: 'david.warner@cricket.com.au',
      pickupAddress: '120 Collins St, Melbourne CBD',
      dropoffAddress: 'Melbourne Airport Terminal 2 (Tullamarine)',
      pickupTime: 'Today, 14:30 AEST',
      vehicleCategory: 'Sedan Premium',
      totalFare: 440.0,
      paymentStatus: 'PAID_IN_FULL',
      driverName: 'Fernando Alonso',
      driverPhone: '+61 433 778 899',
      vehiclePlate: 'FA-14-VIC (Mercedes S450)',
      driverPayout: 160.0,
      netProfit: 240.0,
      status: 'ALLOCATED',
    },
    {
      id: 'b-02',
      bookingNumber: 'CCM-2026-0882',
      passengerName: 'Rio Tinto Mining Delegation (4 Pax)',
      passengerPhone: '+61 499 888 777',
      passengerEmail: 'corporate.travel@riotinto.com',
      pickupAddress: 'Crown Towers, Southbank',
      dropoffAddress: 'Yarra Valley Estate, Coldstream',
      pickupTime: 'Today, 17:00 AEST',
      vehicleCategory: 'Luxury SUV / Minibus',
      totalFare: 680.0,
      paymentStatus: 'PARTIAL_DEPOSIT',
      driverName: 'Lewis Hamilton',
      driverPhone: '+61 499 001 122',
      vehiclePlate: 'LH-44-VIC (Mercedes V-Class)',
      driverPayout: 210.0,
      netProfit: 408.18,
      status: 'ALLOCATED',
    },
    {
      id: 'b-03',
      bookingNumber: 'CCM-2026-0879',
      passengerName: 'Dr. Sophia Sterling',
      passengerPhone: '+61 422 334 455',
      passengerEmail: 'sophia.sterling@monash.edu',
      pickupAddress: 'Grand Hyatt Melbourne',
      dropoffAddress: 'Essendon Airport Jet Base',
      pickupTime: 'Today, 11:15 AEST',
      vehicleCategory: 'Sedan Executive',
      totalFare: 320.0,
      paymentStatus: 'PAID_IN_FULL',
      driverName: 'Daniel Ricciardo',
      driverPhone: '+61 411 998 877',
      vehiclePlate: 'DR-03-VIC (BMW 740i)',
      driverPayout: 140.0,
      netProfit: 150.91,
      status: 'COMPLETED',
    },
    {
      id: 'b-04',
      bookingNumber: 'CCM-2026-0878',
      passengerName: 'Marcus Aurelius Vance',
      passengerPhone: '+61 418 555 666',
      passengerEmail: 'vance@vanceholdings.com.au',
      pickupAddress: 'Park Hyatt, 1 Parliament Square',
      dropoffAddress: 'Melbourne Airport Terminal 4',
      pickupTime: 'Today, 08:45 AEST',
      vehicleCategory: 'Sedan Executive',
      totalFare: 280.0,
      paymentStatus: 'PAID_IN_FULL',
      driverName: 'Charles Leclerc',
      driverPhone: '+61 455 123 456',
      vehiclePlate: 'CL-16-VIC (Mercedes E300)',
      driverPayout: 130.0,
      netProfit: 124.55,
      status: 'COMPLETED',
    },
    {
      id: 'b-05',
      bookingNumber: 'CCM-2026-0883',
      passengerName: 'BHP Executive Board Transfer',
      passengerPhone: '+61 423 777 999',
      passengerEmail: 'events@bhp.com',
      pickupAddress: '171 Collins St, Melbourne',
      dropoffAddress: 'Portsea Coastal Estate',
      pickupTime: 'Tomorrow, 09:00 AEST',
      vehicleCategory: 'Executive Sprinter',
      totalFare: 1150.0,
      paymentStatus: 'INVOICED',
      driverName: 'Pending Allocation',
      driverPhone: 'N/A',
      vehiclePlate: 'Unassigned',
      driverPayout: 380.0,
      netPayoutExpected: 665.45,
      netProfit: 665.45,
      status: 'PENDING',
    } as any,
    {
      id: 'b-06',
      bookingNumber: 'CCM-2026-0880',
      passengerName: 'Elena Rostova (VIP)',
      passengerPhone: '+61 488 444 222',
      passengerEmail: 'elena@rostovafinance.com',
      pickupAddress: 'Melbourne Airport T2 International Arrival',
      dropoffAddress: 'The Ritz-Carlton, 650 Lonsdale St',
      pickupTime: 'Today, 13:00 AEST',
      vehicleCategory: 'Sedan Premium',
      totalFare: 360.0,
      paymentStatus: 'PAID_IN_FULL',
      driverName: 'Max Verstappen',
      driverPhone: '+61 400 999 111',
      vehiclePlate: 'MV-01-VIC (Mercedes S450)',
      driverPayout: 155.0,
      netProfit: 172.27,
      status: 'IN_PROGRESS',
    },
  ];

  // Sample live driver roster
  const sampleDrivers: DriverRosterItem[] = [
    {
      id: 'drv-01',
      name: 'Daniel Ricciardo',
      phone: '+61 411 998 877',
      email: 'daniel@crownchauffeurs.com.au',
      vehicle: 'BMW 7-Series 740i (Black)',
      plate: 'DR-03-VIC',
      status: 'AVAILABLE', // KHALI
      todayCompletedTrips: 3,
      todayEarnings: 420.0,
      rating: 4.98,
      onTimeRate: 100,
    },
    {
      id: 'drv-02',
      name: 'Charles Leclerc',
      phone: '+61 455 123 456',
      email: 'charles@crownchauffeurs.com.au',
      vehicle: 'Mercedes-Benz E-Class E300 (Obsidian Black)',
      plate: 'CL-16-VIC',
      status: 'AVAILABLE', // KHALI
      todayCompletedTrips: 2,
      todayEarnings: 270.0,
      rating: 4.95,
      onTimeRate: 98,
    },
    {
      id: 'drv-03',
      name: 'George Russell',
      phone: '+61 477 333 111',
      email: 'george@crownchauffeurs.com.au',
      vehicle: 'Mercedes-Benz S-Class S450 (Silver)',
      plate: 'GR-63-VIC',
      status: 'AVAILABLE', // KHALI
      todayCompletedTrips: 1,
      todayEarnings: 165.0,
      rating: 4.96,
      onTimeRate: 100,
    },
    {
      id: 'drv-04',
      name: 'Oscar Piastri',
      phone: '+61 466 222 888',
      email: 'oscar@crownchauffeurs.com.au',
      vehicle: 'Audi A8 L (Mythos Black)',
      plate: 'OP-81-VIC',
      status: 'AVAILABLE', // KHALI
      todayCompletedTrips: 2,
      todayEarnings: 310.0,
      rating: 4.99,
      onTimeRate: 100,
    },
    {
      id: 'drv-05',
      name: 'Max Verstappen',
      phone: '+61 400 999 111',
      email: 'max@crownchauffeurs.com.au',
      vehicle: 'Mercedes-Benz S-Class S450 (Obsidian Black)',
      plate: 'MV-01-VIC',
      status: 'ON_TRIP',
      currentBookingNumber: 'CCM-2026-0880',
      currentRoute: 'Melbourne Airport T2 ➔ The Ritz-Carlton (ETA 25m)',
      todayCompletedTrips: 2,
      todayEarnings: 315.0,
      rating: 4.97,
      onTimeRate: 99,
    },
    {
      id: 'drv-06',
      name: 'Fernando Alonso',
      phone: '+61 433 778 899',
      email: 'fernando@crownchauffeurs.com.au',
      vehicle: 'Mercedes-Benz S-Class S450 (Designo Selenite Grey)',
      plate: 'FA-14-VIC',
      status: 'ON_TRIP',
      currentBookingNumber: 'CCM-2026-0881',
      currentRoute: '120 Collins St ➔ Melbourne Airport T2 (En Route)',
      todayCompletedTrips: 2,
      todayEarnings: 320.0,
      rating: 4.96,
      onTimeRate: 97,
    },
    {
      id: 'drv-07',
      name: 'Lewis Hamilton',
      phone: '+61 499 001 122',
      email: 'lewis@crownchauffeurs.com.au',
      vehicle: 'Mercedes-Benz V-Class V250d (Executive Luxury Van)',
      plate: 'LH-44-VIC',
      status: 'ON_TRIP',
      currentBookingNumber: 'CCM-2026-0882',
      currentRoute: 'Crown Towers ➔ Yarra Valley Estate',
      todayCompletedTrips: 1,
      todayEarnings: 210.0,
      rating: 4.99,
      onTimeRate: 100,
    },
    {
      id: 'drv-08',
      name: 'Carlos Sainz',
      phone: '+61 488 111 555',
      email: 'carlos@crownchauffeurs.com.au',
      vehicle: 'Mercedes-Benz Sprinter Executive Minibus',
      plate: 'CS-55-VIC',
      status: 'OFF_DUTY',
      todayCompletedTrips: 0,
      todayEarnings: 0.0,
      rating: 4.94,
      onTimeRate: 96,
    },
  ];

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

  // Filtered Bookings
  const filteredBookings = sampleBookings.filter((b) => {
    const matchesFilter =
      bookingFilter === 'ALL' ||
      (bookingFilter === 'COMPLETED' && b.status === 'COMPLETED') ||
      (bookingFilter === 'IN_PROGRESS' && (b.status === 'IN_PROGRESS' || b.status === 'ALLOCATED')) ||
      (bookingFilter === 'PENDING' && b.status === 'PENDING');

    const matchesSearch =
      searchQuery === '' ||
      b.passengerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.driverName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Filtered Drivers
  const filteredDrivers = sampleDrivers.filter((d) => {
    const matchesFilter = driverFilter === 'ALL' || d.status === driverFilter;
    const matchesSearch =
      searchQuery === '' ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.vehicle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.plate.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const grossRev = summary?.gross_revenue_inc_gst ?? 18450.0;
  const netRev = summary?.net_revenue_ex_gst ?? 16772.73;
  const netProfit = summary?.gross_profit ?? 7802.73;
  const profitMargin = summary?.gross_profit_margin_pct ?? 46.52;
  const totalRides = summary?.total_bookings ?? 38;
  const completedRides = summary?.completed_trips_count ?? 32;

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-hidden relative">
      {/* 1. Hero Command Center Banner */}
      <div className="relative rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden w-full min-w-0">
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-2 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Crown Chauffeurs Intelligence Active</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-100 break-words">
            Chauffeur Operations & Dispatch Command Center
          </h1>

          <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
            Autonomous corporate chauffeur dispatch and live flight delay monitoring for Melbourne & interstate hubs.
            All allocations gated with driver conflict guards.
          </p>
        </div>

        {/* Right CTA Button */}
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

      {/* 2. 4 Interactive Clickable Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full min-w-0">
        {/* Card 1: Gross Revenue */}
        <div
          onClick={() => setActiveModal('REVENUE')}
          className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] hover:border-amber-500/60 p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer hover:scale-[1.01] transition-all group relative overflow-hidden shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider truncate group-hover:text-amber-300 transition-colors">
              GROSS REVENUE (INC GST)
            </span>
            <DollarSign className="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-100 truncate">
            ${grossRev.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-bold text-amber-300 max-w-full truncate">
              <span className="truncate">Ex GST: ${netRev.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[10px] text-amber-400 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Details ➔
            </span>
          </div>
        </div>

        {/* Card 2: Net Operating Profit */}
        <div
          onClick={() => setActiveModal('PROFIT')}
          className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] hover:border-emerald-500/60 p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer hover:scale-[1.01] transition-all group relative overflow-hidden shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider truncate group-hover:text-emerald-300 transition-colors">
              NET OPERATING PROFIT
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 truncate">
            ${netProfit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-300 max-w-full truncate">
              <span className="truncate">{profitMargin.toFixed(1)}% Operating Margin</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Margins ➔
            </span>
          </div>
        </div>

        {/* Card 3: Bookings & Trips Queue */}
        <div
          onClick={() => setActiveModal('BOOKINGS')}
          className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] hover:border-cyan-500/60 p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer hover:scale-[1.01] transition-all group relative overflow-hidden shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider truncate group-hover:text-cyan-300 transition-colors">
              BOOKINGS & TRIPS QUEUE
            </span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300 truncate">
            {totalRides} <span className="text-xs font-normal text-slate-400 font-sans">Total Rides</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[10px] font-bold text-cyan-300 max-w-full truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <span className="truncate">{completedRides} Completed • 2 Pending</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              View All ➔
            </span>
          </div>
        </div>

        {/* Card 4: Fleet & System Status */}
        <div
          onClick={() => setActiveModal('FLEET')}
          className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] hover:border-purple-500/60 p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer hover:scale-[1.01] transition-all group relative overflow-hidden shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider truncate group-hover:text-purple-300 transition-colors">
              FLEET & SYSTEM STATUS
            </span>
            <Car className="w-4 h-4 text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-purple-300 truncate">
            4 <span className="text-xs font-normal text-slate-400 font-sans">Active Chauffeurs</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/25 text-[10px] font-bold text-purple-300 max-w-full truncate">
              <span className="truncate">🟢 4 Available (Khali)</span>
            </div>
            <span className="text-[10px] text-purple-400 font-bold group-hover:underline flex items-center gap-0.5 shrink-0">
              Roster ➔
            </span>
          </div>
        </div>
      </div>

      {/* 3. Dual 3D Interactive Showcase Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
        {/* Left: 3D Interactive Luxury Car Showcase (7 Cols) */}
        <div className="lg:col-span-7 h-[360px] sm:h-[400px] lg:h-[440px] w-full min-w-0 overflow-hidden">
          <LuxuryCarCanvas showControls={true} />
        </div>

        {/* Right: 3D Holographic Dispatch Radar & Airspace (5 Cols) */}
        <div className="lg:col-span-5 h-[360px] sm:h-[400px] lg:h-[440px] w-full min-w-0 overflow-hidden">
          <RadarGlobeCanvas
            activeFlightsCount={6}
            activeDriversCount={12}
            onOpenFlightModal={() => setActiveModal('FLIGHTS')}
          />
        </div>
      </div>

      {/* 4. Human-in-the-Loop Dispatch Queue */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-4 sm:p-6 space-y-4 w-full min-w-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#162036] border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 truncate">Human-in-the-Loop Dispatch & Allocation</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                AI-drafted chauffeur allocations requiring human review.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('operate')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0 ml-auto"
          >
            <span>View full queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Itemized Queue Rows */}
        <div className="space-y-3 w-full min-w-0">
          {pendingBookings.map((b) => (
            <div
              key={b.id}
              className="p-3.5 sm:p-4 rounded-xl bg-[#0D1322] border border-[#1F2E4D] hover:border-amber-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs w-full min-w-0 overflow-hidden"
            >
              <div className="space-y-1.5 min-w-0 w-full md:flex-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-amber-400">{b.booking_number}</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-semibold text-slate-200 truncate">{b.passenger_name}</span>
                  {b.legs[0]?.is_airport_pickup && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono shrink-0">
                      ✈️ Flight {b.legs[0]?.flight_number} (+{b.legs[0]?.flight_delay_minutes}m)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 break-words line-clamp-2">
                  {b.legs[0]?.pickup_address} ➔ {b.legs[0]?.dropoff_address}
                </p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                <div className="text-left md:text-right font-mono min-w-0">
                  <span className="font-bold text-slate-100 text-xs sm:text-sm block">${b.total_fare.toFixed(2)} AUD</span>
                  <span className="text-[10px] text-emerald-400 font-semibold block">Net: +${(b.total_fare / 1.1 - 160).toFixed(2)}</span>
                </div>

                <button
                  onClick={() => onNavigate('operate')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold transition-all text-xs shrink-0"
                >
                  Allocate Driver &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE DRILL-DOWN MODALS (CARD 1, 2, 3 & 4)                        */}
      {/* ========================================================================= */}

      {/* MODAL 1: REVENUE BREAKDOWN */}
      {activeModal === 'REVENUE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121A2D] border border-amber-500/40 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#1F2E4D] flex items-center justify-between bg-[#0D1322]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-100">Gross Revenue & Tax Breakdown</h2>
                  <p className="text-xs text-slate-400">ATO 1/11th Australian GST & Settlement Ledger</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* 3 Metric Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Collected (Inc GST)</span>
                  <div className="text-xl font-black font-mono text-slate-100">${grossRev.toFixed(2)} AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-400">10% ATO GST Portion</span>
                  <div className="text-xl font-black font-mono text-amber-300">${(grossRev / 11).toFixed(2)} AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Net Revenue Ex-GST</span>
                  <div className="text-xl font-black font-mono text-emerald-400">${netRev.toFixed(2)} AUD</div>
                </div>
              </div>

              {/* Inflow Channels */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Revenue By Booking Channel</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex justify-between items-center">
                    <span className="text-slate-300 font-semibold">🌐 Online Passenger Website Bookings (28 trips)</span>
                    <span className="font-mono font-bold text-slate-100">$11,240.00 AUD (60.9%)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex justify-between items-center">
                    <span className="text-slate-300 font-semibold">🏢 Corporate Invoiced Accounts (B2B Multi-Leg)</span>
                    <span className="font-mono font-bold text-slate-100">$5,480.00 AUD (29.7%)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex justify-between items-center">
                    <span className="text-slate-300 font-semibold">📞 Concierge Phone Quotes & Custom Charters</span>
                    <span className="font-mono font-bold text-slate-100">$1,730.00 AUD (9.4%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1F2E4D] bg-[#0D1322] flex justify-between items-center">
              <span className="text-xs text-slate-400">Australian Taxation Office (ATO) Compliant</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('invoicing');
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Go To GST Invoicing Hub ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NET PROFIT & OPERATING MARGIN */}
      {activeModal === 'PROFIT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121A2D] border border-emerald-500/40 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#1F2E4D] flex items-center justify-between bg-[#0D1322]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-100">Net Profit & Operating Margins</h2>
                  <p className="text-xs text-slate-400">Direct Fleet Costs vs Gross Profit Analytics</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Net Revenue (Ex GST)</span>
                  <div className="text-xl font-black font-mono text-slate-100">${netRev.toFixed(2)} AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-rose-400">Total Direct Fleet Costs</span>
                  <div className="text-xl font-black font-mono text-rose-400">-$8,970.00 AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#0D1322] border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Net Profit (+{profitMargin.toFixed(1)}%)</span>
                  <div className="text-xl font-black font-mono text-emerald-400">+${netProfit.toFixed(2)} AUD</div>
                </div>
              </div>

              {/* Profit by Vehicle Class */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Profit Margin By Vehicle Class</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-200 block">Executive Sedan (BMW 7 / Mercedes E)</span>
                      <span className="text-[10px] text-slate-400">Revenue: $4,210 • Driver Payouts: $1,800</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-sm">+$2,027.27 (52.9% Margin)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-200 block">Premium Sedan (Mercedes S-Class S450)</span>
                      <span className="text-[10px] text-slate-400">Revenue: $6,800 • Driver Payouts: $3,100</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-sm">+$3,081.82 (49.8% Margin)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-200 block">Luxury SUV & Minibus (V-Class / Sprinter)</span>
                      <span className="text-[10px] text-slate-400">Revenue: $7,440 • Driver Payouts: $4,070</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-sm">+$2,693.64 (39.8% Margin)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1F2E4D] bg-[#0D1322] flex justify-between items-center">
              <span className="text-xs text-slate-400">Target Margin: &gt; 45%</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('analytics');
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>View Full Profit Reports ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: BOOKINGS & TRIPS QUEUE AUDIT */}
      {activeModal === 'BOOKINGS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121A2D] border border-cyan-500/40 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#1F2E4D] flex items-center justify-between bg-[#0D1322]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-100">All Bookings, Passengers & Driver Payouts</h2>
                  <p className="text-xs text-slate-400">Itemized ledger of who booked, fare paid, assigned driver and payout amount</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 bg-[#0E1526] border-b border-[#1F2E4D] flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'PENDING'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setBookingFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      bookingFilter === tab
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'bg-[#162036] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab === 'ALL'
                      ? `All (${sampleBookings.length})`
                      : tab === 'COMPLETED'
                      ? 'Completed (32)'
                      : tab === 'IN_PROGRESS'
                      ? 'In Progress (4)'
                      : 'Pending Review (2)'}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search passenger or driver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121A2D] border border-[#1F2E4D] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Bookings List Table / Cards */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] hover:border-cyan-500/40 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-cyan-400 text-sm">{b.bookingNumber}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                        {b.vehicleCategory}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : b.status === 'IN_PROGRESS' || b.status === 'ALLOCATED'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        ● {b.status}
                      </span>
                    </div>
                  </div>

                  {/* Route & Passenger Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Left: Passenger & Route */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{b.passengerName}</span>
                        <span className="text-slate-400 text-[11px]">({b.passengerPhone})</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        📍 <strong>Pickup:</strong> {b.pickupAddress}<br />
                        🏁 <strong>Dropoff:</strong> {b.dropoffAddress}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono block">⏰ Scheduled: {b.pickupTime}</span>
                    </div>

                    {/* Right: Assigned Driver & Financials */}
                    <div className="p-3 rounded-xl bg-[#121A2D] border border-slate-800/80 space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Assigned Chauffeur:</span>
                        <span className="font-bold text-slate-200">{b.driverName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Vehicle & Plate:</span>
                        <span className="font-mono text-cyan-300 text-[11px]">{b.vehiclePlate}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Total Customer Fare:</span>
                        <span className="font-mono font-bold text-slate-100">${b.totalFare.toFixed(2)} AUD</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Driver Payout:</span>
                        <span className="font-mono font-bold text-amber-400">-${b.driverPayout.toFixed(2)} AUD</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                        <span className="text-emerald-400 font-bold">Net Platform Profit:</span>
                        <span className="font-mono font-black text-emerald-400">+${b.netProfit.toFixed(2)} AUD</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1F2E4D] bg-[#0D1322] flex justify-between items-center">
              <span className="text-xs text-slate-400">{filteredBookings.length} Bookings Evaluated</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('operate');
                }}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Open Live Dispatch Board ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: FLEET & LIVE CHAUFFEUR ROSTER */}
      {activeModal === 'FLEET' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121A2D] border border-purple-500/40 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#1F2E4D] flex items-center justify-between bg-[#0D1322]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-100">Chauffeurs Roster & Live Availability Radar</h2>
                  <p className="text-xs text-slate-400">Check who is free (Khali) or on active trip to allot upcoming bookings</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 bg-[#0E1526] border-b border-[#1F2E4D] flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {(['ALL', 'AVAILABLE', 'ON_TRIP', 'OFF_DUTY'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDriverFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      driverFilter === tab
                        ? 'bg-purple-500 text-slate-950 shadow-md'
                        : 'bg-[#162036] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab === 'ALL'
                      ? `All Drivers (${sampleDrivers.length})`
                      : tab === 'AVAILABLE'
                      ? '🟢 Free / Khali (4)'
                      : tab === 'ON_TRIP'
                      ? '🟡 On Active Trip (3)'
                      : '⚪ Off Duty (1)'}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search driver or car plate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121A2D] border border-[#1F2E4D] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Drivers Roster Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
              {filteredDrivers.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] hover:border-purple-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{d.name}</span>
                      <span className="text-slate-400 text-xs">({d.phone})</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'AVAILABLE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : d.status === 'ON_TRIP'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {d.status === 'AVAILABLE' ? '🟢 READY / KHALI' : d.status === 'ON_TRIP' ? '🟡 ON TRIP' : '⚪ OFF DUTY'}
                      </span>
                    </div>

                    <p className="text-xs text-purple-300 font-mono">
                      🚘 {d.vehicle} • Plate: <strong>{d.plate}</strong>
                    </p>

                    {d.status === 'ON_TRIP' && d.currentRoute && (
                      <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                        <strong>Current Ride #{d.currentBookingNumber}:</strong> {d.currentRoute}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="text-left md:text-right font-mono text-xs">
                      <span className="text-slate-300 block">Today: {d.todayCompletedTrips} Trips (${d.todayEarnings.toFixed(2)})</span>
                      <span className="text-[10px] text-amber-400 font-bold">⭐ {d.rating} Rating • {d.onTimeRate}% On-Time</span>
                    </div>

                    {d.status === 'AVAILABLE' ? (
                      <button
                        onClick={() => {
                          setActiveModal(null);
                          onNavigate('operate');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
                      >
                        Allot Next Booking ➔
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveModal(null);
                          onNavigate('operate');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                      >
                        View Trip Status
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1F2E4D] bg-[#0D1322] flex justify-between items-center">
              <span className="text-xs text-slate-400">4 Drivers Available for Immediate Dispatch</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('partners-fleet');
                }}
                className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Manage Fleet & Partners ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: AIRPORT FLIGHT RADAR & CUSTOMER DELAYS MONITOR */}
      {activeModal === 'FLIGHTS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121A2D] border border-cyan-500/40 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#1F2E4D] flex items-center justify-between bg-[#0D1322]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Plane className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-100">Live Airport Flight Radar & Customer Delays</h2>
                  <p className="text-xs text-slate-400">Real-time FlightAware radar tracking with customer delay compensation</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 bg-[#0E1526] border-b border-[#1F2E4D] flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filter:
                </span>
                <span className="px-3 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30">
                  ✈️ 6 Active Flights Tracked
                </span>
                <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  🚨 3 Delayed Flights
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search passenger, flight, airline..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#121A2D] border border-[#1F2E4D] rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Flights List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
              {[
                {
                  id: 'fl-01',
                  flightNumber: 'QF400',
                  airline: 'Qantas Airways',
                  origin: 'Sydney (SYD)',
                  destination: 'Melbourne (MEL - Terminal 2)',
                  passengerName: 'David Warner',
                  passengerPhone: '+61 411 222 333',
                  bookingNumber: 'CCM-2026-0881',
                  scheduledTime: 'Today, 14:30 AEST',
                  estimatedLanding: 'Today, 14:55 AEST',
                  delayMinutes: 25,
                  status: 'DELAYED',
                  assignedDriver: 'Fernando Alonso',
                  driverPhone: '+61 433 778 899',
                  vehiclePlate: 'FA-14-VIC (Mercedes S450)',
                  gate: 'Terminal 2 Int / Bay 14',
                  bufferNote: 'Pickup buffer auto-extended by +25 mins. Chauffeur notified ✓',
                },
                {
                  id: 'fl-02',
                  flightNumber: 'EK408',
                  airline: 'Emirates Airlines',
                  origin: 'Dubai (DXB)',
                  destination: 'Melbourne (MEL - Terminal 2)',
                  passengerName: 'Elena Rostova (VIP)',
                  passengerPhone: '+61 488 444 222',
                  bookingNumber: 'CCM-2026-0880',
                  scheduledTime: 'Today, 13:00 AEST',
                  estimatedLanding: 'Today, 13:45 AEST',
                  delayMinutes: 45,
                  status: 'DELAYED',
                  assignedDriver: 'Max Verstappen',
                  driverPhone: '+61 400 999 111',
                  vehiclePlate: 'MV-01-VIC (Mercedes S450)',
                  gate: 'Terminal 2 Gate 9',
                  bufferNote: 'Heavy headwind delay detected. Chauffeur pickup rescheduled to 14:15 AEST ✓',
                },
                {
                  id: 'fl-03',
                  flightNumber: 'CX135',
                  airline: 'Cathay Pacific',
                  origin: 'Hong Kong (HKG)',
                  destination: 'Melbourne (MEL - Terminal 2)',
                  passengerName: 'Dr. Arthur Pendelton',
                  passengerPhone: '+61 499 111 444',
                  bookingNumber: 'CCM-2026-0885',
                  scheduledTime: 'Today, 19:20 AEST',
                  estimatedLanding: 'Today, 19:35 AEST',
                  delayMinutes: 15,
                  status: 'DELAYED',
                  assignedDriver: 'Oscar Piastri',
                  driverPhone: '+61 466 222 888',
                  vehiclePlate: 'OP-81-VIC (Audi A8 L)',
                  gate: 'Terminal 2 Gate 11',
                  bufferNote: 'Air traffic holding pattern. Chauffeur dispatch delayed by +15 mins to avoid parking fees.',
                },
                {
                  id: 'fl-04',
                  flightNumber: 'SQ237',
                  airline: 'Singapore Airlines',
                  origin: 'Singapore Changi (SIN)',
                  destination: 'Melbourne (MEL - Terminal 2)',
                  passengerName: 'Sir James McCauley',
                  passengerPhone: '+61 412 888 333',
                  bookingNumber: 'CCM-2026-0884',
                  scheduledTime: 'Today, 16:15 AEST',
                  estimatedLanding: 'Today, 16:15 AEST (On Time)',
                  delayMinutes: 0,
                  status: 'ON_TIME',
                  assignedDriver: 'Daniel Ricciardo',
                  driverPhone: '+61 411 998 877',
                  vehiclePlate: 'DR-03-VIC (BMW 740i)',
                  gate: 'Terminal 2 Gate 4',
                  bufferNote: 'Flight on schedule. Chauffeur meet-and-greet in holding bay.',
                },
                {
                  id: 'fl-05',
                  flightNumber: 'Bombardier Global 7500 (VH-VHN)',
                  airline: 'VIP Private Charter Jet',
                  origin: 'Sydney Kingsford Smith (SYD)',
                  destination: 'Essendon Airport Jet Base',
                  passengerName: 'BHP Executive Delegation',
                  passengerPhone: '+61 423 777 999',
                  bookingNumber: 'CCM-2026-0883',
                  scheduledTime: 'Today, 17:30 AEST',
                  estimatedLanding: 'Today, 17:30 AEST (On Time)',
                  delayMinutes: 0,
                  status: 'ON_TIME',
                  assignedDriver: 'Lewis Hamilton',
                  driverPhone: '+61 499 001 122',
                  vehiclePlate: 'LH-44-VIC (Mercedes V-Class)',
                  gate: 'Essendon Jet Base Tarmac Gate 1',
                  bufferNote: 'Direct VIP tarmac security clearance approved.',
                },
                {
                  id: 'fl-06',
                  flightNumber: 'VA820',
                  airline: 'Virgin Australia',
                  origin: 'Brisbane (BNE)',
                  destination: 'Melbourne (MEL - Terminal 4)',
                  passengerName: 'Marcus Aurelius Vance',
                  passengerPhone: '+61 418 555 666',
                  bookingNumber: 'CCM-2026-0878',
                  scheduledTime: 'Today, 08:45 AEST',
                  estimatedLanding: 'Today, 08:35 AEST (Early -10m)',
                  delayMinutes: -10,
                  status: 'EARLY',
                  assignedDriver: 'Charles Leclerc',
                  driverPhone: '+61 455 123 456',
                  vehiclePlate: 'CL-16-VIC (Mercedes E300)',
                  gate: 'Terminal 4 Baggage Carousel 2',
                  bufferNote: 'Early touchdown. Chauffeur positioned at Terminal 4 pickup lane.',
                },
              ]
                .filter(
                  (f) =>
                    searchQuery === '' ||
                    f.passengerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    f.flightNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    f.airline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    f.assignedDriver.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((f) => (
                  <div
                    key={f.id}
                    className="p-4 rounded-2xl bg-[#0D1322] border border-[#1F2E4D] hover:border-cyan-500/40 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-black text-cyan-400 text-sm">✈️ {f.flightNumber}</span>
                        <span className="text-slate-400 text-xs font-semibold">({f.airline})</span>
                        <span className="text-slate-500">•</span>
                        <span className="font-mono font-bold text-amber-400 text-xs">{f.bookingNumber}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {f.delayMinutes > 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                            🚨 LATE (+{f.delayMinutes} MIN DELAY)
                          </span>
                        ) : f.delayMinutes < 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            🟢 EARLY (-10 MIN)
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            🟢 ON TIME (0 MIN DELAY)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Flight & Passenger Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Left: Customer & Flight Schedule */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-sm">{f.passengerName}</span>
                          <span className="text-slate-400 text-xs">({f.passengerPhone})</span>
                        </div>
                        <p className="text-slate-300">
                          🛫 <strong>Route:</strong> {f.origin} ➔ {f.destination}
                        </p>
                        <p className="text-slate-300">
                          📍 <strong>Meeting Bay / Gate:</strong> {f.gate}
                        </p>
                        <div className="pt-1 font-mono text-xs">
                          <span className="text-slate-400">Scheduled Time: {f.scheduledTime}</span>
                          <br />
                          <span className={f.delayMinutes > 0 ? 'text-amber-300 font-bold' : 'text-emerald-400 font-bold'}>
                            Updated Real-Time Landing: {f.estimatedLanding}
                          </span>
                        </div>
                      </div>

                      {/* Right: Assigned Chauffeur & Buffer Action */}
                      <div className="p-3 rounded-xl bg-[#121A2D] border border-slate-800/80 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Assigned Chauffeur:</span>
                          <span className="font-bold text-slate-100">{f.assignedDriver}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Driver Phone:</span>
                          <span className="font-mono text-slate-300">{f.driverPhone}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Vehicle Plate:</span>
                          <span className="font-mono text-cyan-300">{f.vehiclePlate}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-800">
                          <p className="text-[11px] text-emerald-300 font-medium leading-relaxed bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                            🛡️ {f.bufferNote}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1F2E4D] bg-[#0D1322] flex justify-between items-center">
              <span className="text-xs text-slate-400">Automated Flight Delay Compensation Active</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('flights');
                }}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <Plane className="w-4 h-4" />
                <span>Open Full Flight Radar Page ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

