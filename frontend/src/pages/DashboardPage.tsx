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
      id: 'b-sahil',
      bookingNumber: 'CCM-2026-9901',
      passengerName: 'Sahil Tripathi',
      passengerPhone: '+91 6386154107',
      passengerEmail: 'sahil.tripathi@gmail.com',
      pickupAddress: 'Crown Towers, 8 Whiteman St, Southbank VIC 3006',
      dropoffAddress: 'Melbourne Airport Terminal 2 (Tullamarine)',
      pickupTime: 'Today, 18:30 AEST',
      vehicleCategory: 'Executive Sedan',
      totalFare: 460.0,
      paymentStatus: 'PAID_IN_FULL',
      driverName: 'Sonu Tripathi (Live Driver)',
      driverPhone: '+61 432 000 718',
      vehiclePlate: 'ST-9305-VIC (Mercedes S450)',
      driverPayout: 170.0,
      netProfit: 248.18,
      status: (localStorage.getItem('crown_active_trip_status') as any) || 'ALLOCATED',
    },
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
      id: 'drv-sonu',
      name: 'Sonu Tripathi (Live Driver)',
      phone: '+91 9305365420',
      email: 'sonu@crownchauffeurs.com.au',
      vehicle: 'Mercedes-Benz S-Class S450 (Obsidian Black)',
      plate: 'ST-9305-VIC',
      status: 'ON_TRIP',
      currentBookingNumber: 'CCM-2026-9901',
      currentRoute: 'Crown Towers, Southbank ➔ Melbourne Airport T2',
      todayCompletedTrips: 2,
      todayEarnings: 340.0,
      rating: 5.0,
      onTimeRate: 100,
    },
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
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-hidden relative text-[#0A0E1A]">
      {/* 1. Hero Command Center Banner */}
      <div className="relative rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-5 sm:p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden w-full min-w-0 shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#DFCAA8]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-2 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#7B6035] shrink-0" />
            <span className="truncate">Admin Dashboard Intelligence Active</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-[#0A0E1A] break-words">
            Admin Dashboard — Operations & Dispatch Command Center
          </h1>

          <p className="text-xs md:text-sm text-[#0A0E1A] leading-relaxed font-bold">
            Autonomous corporate chauffeur dispatch and live flight delay monitoring for Melbourne & interstate hubs.
            All allocations gated with driver conflict guards.
          </p>
        </div>

        {/* Right CTA Button */}
        <div className="relative z-10 w-full md:w-auto shrink-0">
          <button
            onClick={() => onNavigate('operate')}
            className="w-full md:w-auto flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md hover:scale-[1.02] transition-all"
          >
            <Clock className="w-4 h-4 text-white" />
            <span>Review Pending Queue (2)</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 text-white" />
          </button>
        </div>
      </div>

      {/* 2. 4 Interactive Clickable Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full min-w-0">
        {/* Card 1: Gross Revenue */}
        <div
          onClick={() => setActiveModal('REVENUE')}
          className="card-clickable-sky rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer relative overflow-hidden shadow-md text-[#0A0E1A]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-black text-[#0A0E1A] tracking-wider truncate">
              GROSS REVENUE (INC GST)
            </span>
            <DollarSign className="w-4 h-4 text-[#0A0E1A] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-[#0A0E1A] truncate">
            ${grossRev.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E6D8C3]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E6D8C3] text-[10px] font-black text-[#0A0E1A] max-w-full truncate">
              <span className="truncate">Ex GST: ${netRev.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
            <span className="text-[10px] text-[#0A0E1A] font-black underline flex items-center gap-0.5 shrink-0 link-hover-sky">
              Details ➔
            </span>
          </div>
        </div>

        {/* Card 2: Net Operating Profit */}
        <div
          onClick={() => setActiveModal('PROFIT')}
          className="card-clickable-yellow rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer relative overflow-hidden shadow-md text-[#0A0E1A]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-black text-[#0A0E1A] tracking-wider truncate">
              NET OPERATING PROFIT
            </span>
            <TrendingUp className="w-4 h-4 text-[#0A0E1A] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-[#0A0E1A] truncate">
            ${netProfit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E6D8C3]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E6D8C3] text-[10px] font-black text-[#0A0E1A] max-w-full truncate">
              <span className="truncate">{profitMargin.toFixed(1)}% Operating Margin</span>
            </div>
            <span className="text-[10px] text-[#0A0E1A] font-black underline flex items-center gap-0.5 shrink-0 link-hover-yellow">
              Margins ➔
            </span>
          </div>
        </div>

        {/* Card 3: Bookings & Trips Queue */}
        <div
          onClick={() => setActiveModal('BOOKINGS')}
          className="card-clickable-sky rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer relative overflow-hidden shadow-md text-[#0A0E1A]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-black text-[#0A0E1A] tracking-wider truncate">
              BOOKINGS & TRIPS QUEUE
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#0A0E1A] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-[#0A0E1A] truncate">
            {totalRides} <span className="text-xs font-bold text-[#0A0E1A] font-sans">Total Rides</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E6D8C3]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E6D8C3] text-[10px] font-black text-[#0A0E1A] max-w-full truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0A0E1A] animate-ping shrink-0" />
              <span className="truncate">{completedRides} Completed • 2 Pending</span>
            </div>
            <span className="text-[10px] text-[#0A0E1A] font-black underline flex items-center gap-0.5 shrink-0 link-hover-sky">
              View All ➔
            </span>
          </div>
        </div>

        {/* Card 4: Active Drivers & Availability */}
        <div
          onClick={() => setActiveModal('FLEET')}
          className="card-clickable-yellow rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-4 sm:p-5 space-y-2.5 min-w-0 cursor-pointer relative overflow-hidden shadow-md text-[#0A0E1A]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-black text-[#0A0E1A] tracking-wider truncate">
              ACTIVE DRIVERS & AVAILABILITY
            </span>
            <Users className="w-4 h-4 text-[#0A0E1A] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-[#0A0E1A] truncate">
            4 <span className="text-xs font-bold text-[#0A0E1A] font-sans">Active Drivers</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E6D8C3]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E6D8C3] text-[10px] font-black text-[#0A0E1A] max-w-full truncate">
              <span className="truncate">● 4 Available • 3 On Trip</span>
            </div>
            <span className="text-[10px] text-[#0A0E1A] font-black underline flex items-center gap-0.5 shrink-0 link-hover-yellow">
              Driver Status ➔
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
      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-4 sm:p-6 space-y-4 w-full min-w-0 overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] flex items-center justify-center text-[#0A0E1A] shrink-0 shadow-sm">
              <Shield className="w-4 h-4 text-[#0A0E1A]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-[#0A0E1A] truncate">Human-in-the-Loop Dispatch & Allocation</h3>
              <p className="text-[11px] sm:text-xs text-[#0A0E1A] font-bold truncate">
                AI-drafted chauffeur allocations requiring human review.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('operate')}
            className="text-xs font-black text-[#0A0E1A] hover-yellow flex items-center gap-1 shrink-0 ml-auto px-2.5 py-1 rounded-lg transition-all"
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
              className="clickable-row p-3.5 sm:p-4 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs w-full min-w-0 overflow-hidden shadow-sm text-[#0A0E1A] cursor-pointer transition-all"
            >
              <div className="space-y-1.5 min-w-0 w-full md:flex-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-mono font-black text-[#0A0E1A]">{b.booking_number}</span>
                  <span className="text-[#0A0E1A] font-bold">•</span>
                  <span className="font-black text-[#0A0E1A] truncate">{b.passenger_name}</span>
                  {b.legs[0]?.is_airport_pickup && (
                    <span className="px-2 py-0.5 rounded bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] text-[10px] font-mono shrink-0 font-black">
                      ✈️ Flight {b.legs[0]?.flight_number} (+{b.legs[0]?.flight_delay_minutes}m)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#0A0E1A] font-bold break-words line-clamp-2">
                  {b.legs[0]?.pickup_address} ➔ {b.legs[0]?.dropoff_address}
                </p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#E6D8C3]">
                <div className="text-left md:text-right font-mono min-w-0">
                  <span className="font-black text-[#0A0E1A] text-xs sm:text-sm block">${b.total_fare.toFixed(2)} AUD</span>
                  <span className="text-[10px] text-[#0A0E1A] font-black block">Net: +${(b.total_fare / 1.1 - 160).toFixed(2)}</span>
                </div>

                <button
                  onClick={() => onNavigate('operate')}
                  className="px-3.5 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black transition-all text-xs shrink-0 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl text-[#0A0E1A]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#E6D8C3] flex items-center justify-between bg-[#FAF6F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] flex items-center justify-center shadow-sm">
                  <DollarSign className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0A0E1A]">Gross Revenue & Tax Breakdown</h2>
                  <p className="text-xs text-[#0A0E1A] font-bold">ATO 1/11th Australian GST & Settlement Ledger</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto text-[#0A0E1A]">
              {/* 3 Metric Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-1 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] uppercase font-bold text-[#0A0E1A]">Total Collected (Inc GST)</span>
                  <div className="text-xl font-black font-mono text-[#0A0E1A]">${grossRev.toFixed(2)} AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-1 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] uppercase font-bold text-[#0A0E1A]">10% ATO GST Portion</span>
                  <div className="text-xl font-black font-mono text-[#0A0E1A]">${(grossRev / 11).toFixed(2)} AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-1 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] uppercase font-bold text-[#0A0E1A]">Net Revenue Ex-GST</span>
                  <div className="text-xl font-black font-mono text-[#0A0E1A]">${netRev.toFixed(2)} AUD</div>
                </div>
              </div>

              {/* Inflow Channels */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#0A0E1A] uppercase tracking-wider">Revenue By Booking Channel</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex justify-between items-center shadow-sm text-[#0A0E1A]">
                    <span className="text-[#0A0E1A] font-bold">🌐 Online Passenger Website Bookings (28 trips)</span>
                    <span className="font-mono font-black text-[#0A0E1A]">$11,240.00 AUD (60.9%)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex justify-between items-center shadow-sm text-[#0A0E1A]">
                    <span className="text-[#0A0E1A] font-bold">🏢 Corporate Invoiced Accounts (B2B Multi-Leg)</span>
                    <span className="font-mono font-black text-[#0A0E1A]">$5,480.00 AUD (29.7%)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex justify-between items-center shadow-sm text-[#0A0E1A]">
                    <span className="text-[#0A0E1A] font-bold">📞 Concierge Phone Quotes & Custom Charters</span>
                    <span className="font-mono font-black text-[#0A0E1A]">$1,730.00 AUD (9.4%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6D8C3] bg-[#FAF6F0] flex justify-between items-center text-[#0A0E1A]">
              <span className="text-xs text-[#0A0E1A] font-bold">Australian Taxation Office (ATO) Compliant</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('invoicing');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Go To GST Invoicing Hub ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NET PROFIT & OPERATING MARGIN */}
      {activeModal === 'PROFIT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl text-[#0A0E1A]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#E6D8C3] flex items-center justify-between bg-[#FAF6F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0A0E1A]">Net Profit & Operating Margins</h2>
                  <p className="text-xs text-[#0A0E1A] font-bold">Direct Fleet Costs vs Gross Profit Analytics</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-6 overflow-y-auto text-[#0A0E1A]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-1 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] uppercase font-bold text-[#0A0E1A]">Net Revenue (Ex GST)</span>
                  <div className="text-xl font-black font-mono text-[#0A0E1A]">${netRev.toFixed(2)} AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-1 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] uppercase font-bold text-[#0A0E1A]">Total Direct Fleet Costs</span>
                  <div className="text-xl font-black font-mono text-[#0A0E1A]">-$8,970.00 AUD</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-1 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] uppercase font-bold text-[#0A0E1A]">Net Profit (+{profitMargin.toFixed(1)}%)</span>
                  <div className="text-xl font-black font-mono text-[#0A0E1A]">+${netProfit.toFixed(2)} AUD</div>
                </div>
              </div>

              {/* Profit by Vehicle Class */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-[#0A0E1A] uppercase tracking-wider">Profit Margin By Vehicle Class</h3>
                <div className="space-y-2 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex justify-between items-center shadow-sm text-[#0A0E1A]">
                    <div>
                      <span className="font-black text-[#0A0E1A] block">Executive Sedan (BMW 7 / Mercedes E)</span>
                      <span className="text-[10px] text-[#0A0E1A] font-bold">Revenue: $4,210 • Driver Payouts: $1,800</span>
                    </div>
                    <span className="font-mono font-black text-[#0A0E1A] text-sm">+$2,027.27 (52.9% Margin)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex justify-between items-center shadow-sm text-[#0A0E1A]">
                    <div>
                      <span className="font-black text-[#0A0E1A] block">Premium Sedan (Mercedes S-Class S450)</span>
                      <span className="text-[10px] text-[#0A0E1A] font-bold">Revenue: $6,800 • Driver Payouts: $3,100</span>
                    </div>
                    <span className="font-mono font-black text-[#0A0E1A] text-sm">+$3,081.82 (49.8% Margin)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex justify-between items-center shadow-sm text-[#0A0E1A]">
                    <div>
                      <span className="font-black text-[#0A0E1A] block">Luxury SUV & Minibus (V-Class / Sprinter)</span>
                      <span className="text-[10px] text-[#0A0E1A] font-bold">Revenue: $7,440 • Driver Payouts: $4,070</span>
                    </div>
                    <span className="font-mono font-black text-[#0A0E1A] text-sm">+$2,693.64 (39.8% Margin)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6D8C3] bg-[#FAF6F0] flex justify-between items-center text-[#0A0E1A]">
              <span className="text-xs text-[#0A0E1A] font-bold">Target Margin: &gt; 45%</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('analytics');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>View Full Profit Reports ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: BOOKINGS & TRIPS QUEUE AUDIT */}
      {activeModal === 'BOOKINGS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-[#0A0E1A]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#E6D8C3] flex items-center justify-between bg-[#FAF6F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0A0E1A]">All Bookings, Passengers & Driver Payouts</h2>
                  <p className="text-xs text-[#0A0E1A] font-bold">Itemized ledger of who booked, fare paid, assigned driver and payout amount</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 bg-[#FAF6F0] border-b border-[#E6D8C3] flex flex-col sm:flex-row items-center justify-between gap-3 text-[#0A0E1A]">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'PENDING'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setBookingFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      bookingFilter === tab
                        ? 'bg-[#06090F] text-white border border-[#DFCAA8] shadow-md'
                        : 'bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#FAF6F0]'
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
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#0A0E1A]" />
                <input
                  type="text"
                  placeholder="Search passenger or driver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#0A0E1A] placeholder-[#0A0E1A]/50 font-bold focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>
            </div>

            {/* Bookings List Table / Cards */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 text-[#0A0E1A]">
              {filteredBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] hover:border-[#DFCAA8] transition-all space-y-3 shadow-sm text-[#0A0E1A]"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E6D8C3] pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-[#0A0E1A] text-sm">{b.bookingNumber}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A]">
                        {b.vehicleCategory}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A]"
                      >
                        ● {b.status}
                      </span>
                    </div>
                  </div>

                  {/* Route & Passenger Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#0A0E1A]">
                    {/* Left: Passenger & Route */}
                    <div className="space-y-1.5 text-[#0A0E1A]">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[#0A0E1A]">{b.passengerName}</span>
                        <span className="text-[#0A0E1A] text-[11px] font-bold">({b.passengerPhone})</span>
                      </div>
                      <p className="text-[#0A0E1A] leading-relaxed font-bold">
                        📍 <strong>Pickup:</strong> {b.pickupAddress}<br />
                        🏁 <strong>Dropoff:</strong> {b.dropoffAddress}
                      </p>
                      <span className="text-[10px] text-[#0A0E1A] font-mono font-bold block">⏰ Scheduled: {b.pickupTime}</span>
                    </div>

                    {/* Right: Assigned Driver & Financials */}
                    <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] space-y-1 text-xs text-[#0A0E1A]">
                      <div className="flex justify-between items-center">
                        <span className="text-[#0A0E1A] font-bold">Assigned Chauffeur:</span>
                        <span className="font-black text-[#0A0E1A]">{b.driverName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#0A0E1A] font-bold">Vehicle & Plate:</span>
                        <span className="font-mono font-black text-[#0A0E1A] text-[11px]">{b.vehiclePlate}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#E6D8C3]">
                        <span className="text-[#0A0E1A] font-bold">Total Customer Fare:</span>
                        <span className="font-mono font-black text-[#0A0E1A]">${b.totalFare.toFixed(2)} AUD</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#0A0E1A] font-bold">Driver Payout:</span>
                        <span className="font-mono font-black text-[#0A0E1A]">-${b.driverPayout.toFixed(2)} AUD</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#E6D8C3]">
                        <span className="text-[#0A0E1A] font-black">Net Platform Profit:</span>
                        <span className="font-mono font-black text-[#0A0E1A]">+${b.netProfit.toFixed(2)} AUD</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6D8C3] bg-[#FAF6F0] flex justify-between items-center text-[#0A0E1A]">
              <span className="text-xs text-[#0A0E1A] font-bold">{filteredBookings.length} Bookings Evaluated</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('operate');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Open Live Dispatch Board ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ACTIVE DRIVERS & LIVE AVAILABILITY STATUS */}
      {activeModal === 'FLEET' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-[#0A0E1A]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#E6D8C3] flex items-center justify-between bg-[#FAF6F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] flex items-center justify-center shadow-sm">
                  <Users className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0A0E1A]">Active Drivers & Live Availability Status</h2>
                  <p className="text-xs text-[#0A0E1A] font-bold">Driver Roster & Shift Tracking — Check who is free (Khali) or on active trip to allot upcoming bookings</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 bg-[#FAF6F0] border-b border-[#E6D8C3] flex flex-col sm:flex-row items-center justify-between gap-3 text-[#0A0E1A]">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {(['ALL', 'AVAILABLE', 'ON_TRIP', 'OFF_DUTY'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDriverFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                      driverFilter === tab
                        ? 'bg-[#06090F] text-white border border-[#DFCAA8] shadow-md'
                        : 'bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#FAF6F0]'
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
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#0A0E1A]" />
                <input
                  type="text"
                  placeholder="Search driver or car plate..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#0A0E1A] placeholder-[#0A0E1A]/50 font-bold focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>
            </div>

            {/* Drivers Roster Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 text-[#0A0E1A]">
              {filteredDrivers.map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] hover:border-[#DFCAA8] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm text-[#0A0E1A]"
                >
                  <div className="space-y-1.5 min-w-0 flex-1 text-[#0A0E1A]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-[#0A0E1A] text-sm">{d.name}</span>
                      <span className="text-[#0A0E1A] text-xs font-bold">({d.phone})</span>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A]"
                      >
                        {d.status === 'AVAILABLE' ? '🟢 READY / KHALI' : d.status === 'ON_TRIP' ? '🟡 ON TRIP' : '⚪ OFF DUTY'}
                      </span>
                    </div>

                    <p className="text-xs text-[#0A0E1A] font-mono font-bold">
                      🚘 {d.vehicle} • Plate: <strong>{d.plate}</strong>
                    </p>

                    {d.status === 'ON_TRIP' && d.currentRoute && (
                      <p className="text-[11px] text-[#0A0E1A] bg-[#FAF6F0] border border-[#DFCAA8] p-2 rounded-lg font-bold">
                        <strong>Current Ride #{d.currentBookingNumber}:</strong> {d.currentRoute}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#E6D8C3]">
                    <div className="text-left md:text-right font-mono text-xs text-[#0A0E1A]">
                      <span className="text-[#0A0E1A] block font-bold">Today: {d.todayCompletedTrips} Trips (${d.todayEarnings.toFixed(2)})</span>
                      <span className="text-[10px] text-[#0A0E1A] font-black">⭐ {d.rating} Rating • {d.onTimeRate}% On-Time</span>
                    </div>

                    {d.status === 'AVAILABLE' ? (
                      <button
                        onClick={() => {
                          setActiveModal(null);
                          onNavigate('operate');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs shadow-md transition-all"
                      >
                        Allot Next Booking ➔
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveModal(null);
                          onNavigate('operate');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#EBDDC8] text-[#0A0E1A] border border-[#E6D8C3] font-black text-xs transition-all shadow-sm"
                      >
                        View Trip Status
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6D8C3] bg-[#FAF6F0] flex justify-between items-center text-[#0A0E1A]">
              <span className="text-xs text-[#0A0E1A] font-bold">4 Drivers Available for Immediate Dispatch</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('partners-fleet');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Manage Fleet & Partners ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: AIRPORT FLIGHT RADAR & CUSTOMER DELAYS MONITOR */}
      {activeModal === 'FLIGHTS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-[#0A0E1A]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#E6D8C3] flex items-center justify-between bg-[#FAF6F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] flex items-center justify-center shadow-sm">
                  <Plane className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-[#0A0E1A]">Live Airport Flight Radar & Customer Delays</h2>
                  <p className="text-xs text-[#0A0E1A] font-bold">Real-time FlightAware radar tracking with customer delay compensation</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 bg-[#FAF6F0] border-b border-[#E6D8C3] flex flex-col sm:flex-row items-center justify-between gap-3 text-[#0A0E1A]">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <span className="text-xs font-black text-[#0A0E1A] mr-2 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-[#0A0E1A]" /> Filter:
                </span>
                <span className="px-3 py-1 rounded-xl bg-[#FFFFFF] text-[#0A0E1A] text-xs font-black border border-[#DFCAA8]">
                  ✈️ 6 Active Flights Tracked
                </span>
                <span className="px-3 py-1 rounded-xl bg-[#FFFFFF] text-[#0A0E1A] text-xs font-black border border-[#DFCAA8]">
                  🚨 3 Delayed Flights
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#0A0E1A]" />
                <input
                  type="text"
                  placeholder="Search passenger, flight, airline..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#0A0E1A] placeholder-[#0A0E1A]/50 font-bold focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>
            </div>

            {/* Flights List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 text-[#0A0E1A]">
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
                    className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] hover:border-[#DFCAA8] transition-all space-y-3 shadow-sm text-[#0A0E1A]"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#E6D8C3] pb-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-black text-[#0A0E1A] text-sm">✈️ {f.flightNumber}</span>
                        <span className="text-[#0A0E1A] text-xs font-bold">({f.airline})</span>
                        <span className="text-[#0A0E1A] font-bold">•</span>
                        <span className="font-mono font-black text-[#0A0E1A] text-xs">{f.bookingNumber}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {f.delayMinutes > 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8]">
                            🚨 LATE (+{f.delayMinutes} MIN DELAY)
                          </span>
                        ) : f.delayMinutes < 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8]">
                            🟢 EARLY (-10 MIN)
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8]">
                            🟢 ON TIME (0 MIN DELAY)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Flight & Passenger Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#0A0E1A]">
                      {/* Left: Customer & Flight Schedule */}
                      <div className="space-y-1.5 text-[#0A0E1A]">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#0A0E1A] text-sm">{f.passengerName}</span>
                          <span className="text-[#0A0E1A] text-xs font-bold">({f.passengerPhone})</span>
                        </div>
                        <p className="text-[#0A0E1A] font-bold">
                          🛫 <strong>Route:</strong> {f.origin} ➔ {f.destination}
                        </p>
                        <p className="text-[#0A0E1A] font-bold">
                          📍 <strong>Meeting Bay / Gate:</strong> {f.gate}
                        </p>
                        <div className="pt-1 font-mono text-xs">
                          <span className="text-[#0A0E1A] font-bold">Scheduled Time: {f.scheduledTime}</span>
                          <br />
                          <span className="text-[#0A0E1A] font-black">
                            Updated Real-Time Landing: {f.estimatedLanding}
                          </span>
                        </div>
                      </div>

                      {/* Right: Assigned Chauffeur & Buffer Action */}
                      <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] space-y-2 text-xs text-[#0A0E1A]">
                        <div className="flex justify-between items-center">
                          <span className="text-[#0A0E1A] font-bold">Assigned Chauffeur:</span>
                          <span className="font-black text-[#0A0E1A]">{f.assignedDriver}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#0A0E1A] font-bold">Driver Phone:</span>
                          <span className="font-mono text-[#0A0E1A] font-black">{f.driverPhone}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#0A0E1A] font-bold">Vehicle Plate:</span>
                          <span className="font-mono font-black text-[#0A0E1A]">{f.vehiclePlate}</span>
                        </div>
                        <div className="pt-1.5 border-t border-[#E6D8C3]">
                          <p className="text-[11px] text-[#0A0E1A] font-bold leading-relaxed bg-[#FFFFFF] p-2 rounded-lg border border-[#DFCAA8]">
                            🛡️ {f.bufferNote}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6D8C3] bg-[#FAF6F0] flex justify-between items-center text-[#0A0E1A]">
              <span className="text-xs text-[#0A0E1A] font-bold">Automated Flight Delay Compensation Active</span>
              <button
                onClick={() => {
                  setActiveModal(null);
                  onNavigate('flights');
                }}
                className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <Plane className="w-4 h-4 text-white" />
                <span>Open Full Flight Radar Page ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

