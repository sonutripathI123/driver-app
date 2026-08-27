import React, { useEffect, useState } from 'react';
import { bookingsApi, dispatchApi, fleetApi, partnersApi } from '../services/api';
import { Booking, BookingLeg, Driver, LegStatus, Partner, Vehicle } from '../types';
import {
  CalendarDays,
  Car,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  MapPin,
  Plane,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  Users,
  X,
  AlertCircle,
  Send
} from 'lucide-react';

export const BookingsOperatePage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [searchQuery, setSearchQuery] = useState('');

  // Allocation Modal State
  const [selectedLeg, setSelectedLeg] = useState<{ bookingId: string; leg: BookingLeg } | null>(null);
  const [allocationDriverId, setAllocationDriverId] = useState('');
  const [allocationVehicleId, setAllocationVehicleId] = useState('');
  const [allocationCost, setAllocationCost] = useState<number>(120);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);

  // Partner Offload Modal State
  const [offloadModalOpen, setOffloadModalOpen] = useState(false);
  const [offloadPartnerId, setOffloadPartnerId] = useState('');
  const [offloadPayout, setOffloadPayout] = useState<number>(150);
  const [offloadNotes, setOffloadNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bData, dData, vData, pData] = await Promise.all([
        bookingsApi.list(),
        fleetApi.getDrivers(),
        fleetApi.getVehicles(),
        partnersApi.list(),
      ]);
      setBookings(bData.bookings || []);
      setDrivers(dData || []);
      setVehicles(vData || []);
      setPartners(pData || []);
    } catch (err) {
      console.warn('Backend loading, using fallback demo data', err);
      injectDemoData();
    } finally {
      setLoading(false);
    }
  };

  const injectDemoData = () => {
    const demoBookings: Booking[] = [
      {
        id: 'b-01',
        booking_number: 'CCM-2026-0881',
        source: 'WEBSITE',
        status: 'ALLOCATED',
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
            status: 'ALLOCATED',
            pickup_address: '120 Collins St, Melbourne CBD',
            dropoff_address: 'Melbourne Airport Terminal 2',
            pickup_datetime: new Date(Date.now() + 3600000 * 3).toISOString(),
            is_airport_pickup: true,
            flight_number: 'QF400',
            flight_delay_minutes: 25,
            wait_time_minutes: 0,
            wait_time_charge: 0,
            vehicle_category: 'SEDAN_PREMIUM',
            driver_id: 'drv-01',
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
        passenger_name: 'Rio Tinto Executive Delegation',
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
            allocation_cost: 0,
            partner_payout_amount: 0,
          },
        ],
      },
    ];

    const demoDrivers: Driver[] = [
      { id: 'drv-01', full_name: 'Daniel Ricciardo', phone: '+61 433 221 100', email: 'daniel@f1.com', license_number: 'LIC-03', status: 'AVAILABLE', rating: 4.98, total_trips_completed: 142 },
      { id: 'drv-02', full_name: 'Sebastian Vettel', phone: '+61 411 000 111', email: 'seb@f1.com', license_number: 'LIC-05', status: 'AVAILABLE', rating: 4.95, total_trips_completed: 98 },
    ];

    const demoVehicles: Vehicle[] = [
      { id: 'v-01', category: 'SEDAN_PREMIUM', make: 'Mercedes-Benz', model: 'S-Class', year: 2024, registration_plate: 'CROWN-01', passenger_capacity: 4, luggage_capacity: 3, is_active: true },
      { id: 'v-02', category: 'PEOPLE_MOVER', make: 'Mercedes-Benz', model: 'V-Class', year: 2024, registration_plate: 'VIP-VAN-02', passenger_capacity: 7, luggage_capacity: 7, is_active: true },
    ];

    setBookings(demoBookings);
    setDrivers(demoDrivers);
    setVehicles(demoVehicles);
  };

  const handleOpenAllocation = (booking: Booking, leg: BookingLeg) => {
    setSelectedLeg({ bookingId: booking.id, leg });
    setAllocationDriverId(leg.driver_id || (drivers[0]?.id || ''));
    setAllocationVehicleId(leg.vehicle_id || (vehicles[0]?.id || ''));
    setAllocationCost(leg.allocation_cost > 0 ? leg.allocation_cost : 140);
    setAllocationError(null);
    setAllocationSuccess(null);
  };

  const handleExecuteAllocation = async () => {
    if (!selectedLeg) return;
    try {
      setAllocationError(null);
      await dispatchApi.allocateDriver(
        selectedLeg.leg.id,
        allocationDriverId,
        allocationVehicleId,
        allocationCost
      );
      setAllocationSuccess('Chauffeur allocated successfully without schedule conflict!');
      setTimeout(() => {
        setSelectedLeg(null);
        loadData();
      }, 1200);
    } catch (err: any) {
      setAllocationError(err.response?.data?.detail || 'Schedule conflict or validation error.');
    }
  };

  const handleBroadcastPartnerOffer = async () => {
    if (!selectedLeg || !offloadPartnerId) return;
    try {
      await partnersApi.broadcastOffer({
        leg_id: selectedLeg.leg.id,
        partner_id: offloadPartnerId,
        offered_payout: offloadPayout,
        expiry_minutes: 15,
        notes: offloadNotes,
      });
      setOffloadModalOpen(false);
      setSelectedLeg(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not send partner offer.');
    }
  };

  const statusColors: Record<LegStatus, string> = {
    PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    ALLOCATED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    DISPATCHED: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    EN_ROUTE: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 animate-pulse',
    ARRIVED: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    PICKED_UP: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    COMPLETED: 'bg-slate-800 text-slate-300 border-slate-700',
    CANCELLED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Live Operate & Dispatch Board</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
              ONE MASTER BOOKING ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Add-Allocate-Settle operational lifecycle with net profit margins and driver schedule conflict guards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Table / Kanban View Toggle */}
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kanban Board
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Search booking number, passenger name, flight number or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Main Table View */}
      {viewMode === 'table' ? (
        <div className="glass-panel rounded-2xl overflow-hidden border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Booking Ref</th>
                  <th className="py-3.5 px-4 font-semibold">Passenger & Contact</th>
                  <th className="py-3.5 px-4 font-semibold">Route & Vehicle Class</th>
                  <th className="py-3.5 px-4 font-semibold">Pickup Time (AEST)</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Assigned Driver / Partner</th>
                  <th className="py-3.5 px-4 font-semibold">Fare & Margin</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {bookings.map((b) =>
                  b.legs.map((leg) => {
                    const assignedDriver = drivers.find((d) => d.id === leg.driver_id);
                    const grossFare = leg.fare_share || b.total_fare / Math.max(1, b.legs.length);
                    const netExGst = grossFare / 1.1;
                    const directCost = leg.allocation_cost + leg.partner_payout_amount;
                    const margin = netExGst - directCost;
                    const marginPct = (margin / Math.max(1, netExGst)) * 100;

                    return (
                      <tr key={leg.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-amber-400">
                          {b.booking_number}
                          <span className="block text-[10px] text-slate-400">Leg #{leg.leg_number}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-slate-100">{b.passenger_name || 'VIP Client'}</span>
                          <span className="block text-[10px] text-slate-400">{b.passenger_phone || '+61 400 000 000'}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{leg.pickup_address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                            <span className="truncate max-w-[180px]">➔ {leg.dropoff_address}</span>
                          </div>
                          {leg.is_airport_pickup && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 mt-1 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              <Plane className="w-2.5 h-2.5" /> Airport Meet & Greet ({leg.flight_number || 'Tullamarine'})
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-300">
                          {new Date(leg.pickup_datetime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          <span className="block text-[10px] text-slate-400">{new Date(leg.pickup_datetime).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusColors[leg.status]}`}>
                            {leg.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {assignedDriver ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                                {assignedDriver.full_name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-200">{assignedDriver.full_name}</span>
                                <span className="block text-[10px] text-slate-400">Cost: ${leg.allocation_cost.toFixed(2)}</span>
                              </div>
                            </div>
                          ) : leg.partner_id ? (
                            <div className="text-cyan-300 font-semibold">
                              Subcontractor Offload
                              <span className="block text-[10px] text-slate-400">Payout: ${leg.partner_payout_amount.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-amber-400/80 italic text-xs">Unallocated</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          <span className="font-bold text-slate-100">${grossFare.toFixed(2)}</span>
                          <span className="block text-[10px] text-emerald-400 font-semibold">
                            +${margin.toFixed(2)} ({marginPct.toFixed(0)}%)
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleOpenAllocation(b, leg)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                          >
                            Dispatch / Offload
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(['PENDING', 'ALLOCATED', 'EN_ROUTE', 'COMPLETED'] as LegStatus[]).map((colStatus) => {
            const legsInCol = bookings.flatMap((b) => b.legs.filter((l) => l.status === colStatus).map((l) => ({ booking: b, leg: l })));
            return (
              <div key={colStatus} className="glass-panel p-4 rounded-2xl flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">{colStatus}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
                    {legsInCol.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px]">
                  {legsInCol.map(({ booking, leg }) => (
                    <div key={leg.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-amber-400">{booking.booking_number}</span>
                        <span className="font-bold text-slate-100">${booking.total_fare.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-slate-200 font-semibold mt-1">{booking.passenger_name}</p>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">{leg.pickup_address} ➔ {leg.dropoff_address}</p>
                      <button
                        onClick={() => handleOpenAllocation(booking, leg)}
                        className="w-full mt-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs font-semibold transition-all"
                      >
                        Manage Allocation
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Driver Allocation Modal */}
      {selectedLeg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="glass-panel-gold max-w-lg w-full p-6 rounded-2xl relative space-y-5 animate-in fade-in zoom-in-95">
            <button
              onClick={() => setSelectedLeg(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-slate-100">Dispatch & Driver Allocation</h3>
              <p className="text-xs text-amber-400 mt-0.5">
                Master Booking: <strong className="font-mono text-white">{selectedLeg.leg.pickup_address} ➔ {selectedLeg.leg.dropoff_address}</strong>
              </p>
            </div>

            {allocationError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{allocationError}</span>
              </div>
            )}

            {allocationSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{allocationSuccess}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Select Fleet Chauffeur</label>
                <select
                  value={allocationDriverId}
                  onChange={(e) => setAllocationDriverId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} (⭐ {d.rating.toFixed(2)} • {d.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Select Fleet Vehicle</label>
                <select
                  value={allocationVehicleId}
                  onChange={(e) => setAllocationVehicleId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.registration_plate} • {v.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Driver Allocation Payout Rate ($ AUD)</label>
                <input
                  type="number"
                  value={allocationCost}
                  onChange={(e) => setAllocationCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setOffloadModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all"
              >
                Subcontractor Offload &rarr;
              </button>

              <button
                onClick={handleExecuteAllocation}
                className="px-6 py-2.5 rounded-xl glow-gold-btn text-slate-950 font-bold text-xs"
              >
                Confirm Allocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subcontractor Partner Offload Modal */}
      {offloadModalOpen && selectedLeg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="glass-panel-cyan max-w-md w-full p-6 rounded-2xl relative space-y-4">
            <button
              onClick={() => setOffloadModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-slate-100">Broadcast 15-Min Partner Offer</h3>
            <p className="text-xs text-slate-400">
              Dispatches an instant email/SMS offer to the affiliate partner with a 15-minute countdown window.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Select Partner Network</label>
                <select
                  value={offloadPartnerId}
                  onChange={(e) => setOffloadPartnerId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100"
                >
                  <option value="">-- Select Compliant Partner --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.company_name} ({p.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Offered Subcontractor Payout ($)</label>
                <input
                  type="number"
                  value={offloadPayout}
                  onChange={(e) => setOffloadPayout(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleBroadcastPartnerOffer}
              className="w-full mt-4 py-2.5 rounded-xl glow-cyan-btn text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Broadcast Offer (15-Min Timer)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
