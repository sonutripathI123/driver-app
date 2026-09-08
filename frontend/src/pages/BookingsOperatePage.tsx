import React, { useEffect, useState } from 'react';
import { bookingsApi, dispatchApi, fleetApi, notificationsApi, partnersApi, DriverAvailabilityItem } from '../services/api';
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
  AlertTriangle,
  Search,
  Shield,
  UserCheck,
  Users,
  X,
  AlertCircle,
  Send,
  UserPlus,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const BookingsOperatePage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Driver Modal State
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('+61 ');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverLicense, setNewDriverLicense] = useState('');
  const [newDriverVehicleId, setNewDriverVehicleId] = useState('');
  const [newDriverPassword, setNewDriverPassword] = useState('');
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverFormError, setDriverFormError] = useState<string | null>(null);
  const [driverNotice, setDriverNotice] = useState<string | null>(null);

  // Allocation Modal State
  const [selectedLeg, setSelectedLeg] = useState<{ bookingId: string; leg: BookingLeg } | null>(null);
  const [allocationDriverId, setAllocationDriverId] = useState('');
  const [allocationVehicleId, setAllocationVehicleId] = useState('');
  const [allocationCost, setAllocationCost] = useState<number>(120);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [availability, setAvailability] = useState<DriverAvailabilityItem[] | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);

  // Partner Offload Modal State
  const [offloadModalOpen, setOffloadModalOpen] = useState(false);
  const [offloadPartnerId, setOffloadPartnerId] = useState('');
  const [offloadPayout, setOffloadPayout] = useState<number>(150);
  const [offloadNotes, setOffloadNotes] = useState('');

  /**
   * Onboards a chauffeur.
   *
   * This used to build a driver object in the browser, push it into local
   * state and write it to a `crown_custom_drivers` localStorage key, then
   * fire confetti. Nothing was ever sent to the API. The record existed only
   * in that one browser, no other dispatcher could see it, the board's own
   * 15-second refresh wiped it from the list, and because the modal
   * pre-selected the invented id for allocation the very next allocate
   * attempt failed against a driver the server had never heard of.
   *
   * It also filled blanks with placeholders — a licence number of
   * "VIC-DA-88" for anyone who left the field empty, which is a compliance
   * record, and an email guessed from the person's name.
   */
  const handleSaveNewDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriverFormError(null);
    setDriverNotice(null);
    setSavingDriver(true);
    try {
      const created = await fleetApi.createDriver({
        full_name: newDriverName.trim(),
        phone: newDriverPhone.trim(),
        email: newDriverEmail.trim(),
        license_number: newDriverLicense.trim(),
        default_vehicle_id: newDriverVehicleId || null,
        status: 'AVAILABLE',
        rating: 5.0,
        is_active: true,
        // Without an explicit password the API falls back to one shared
        // default for every chauffeur it creates.
        create_user_account: true,
        password: newDriverPassword,
      });

      setDrivers((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
      setAllocationDriverId(created.id);
      setDriverNotice(
        `${created.full_name} is on the roster. Their portal login is ${created.email} with the password you just set — pass it on, and they can change it from the portal.`
      );

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#DFCAA8', '#C2A16B', '#FAF6F0'],
      });

      setIsAddDriverOpen(false);
      setNewDriverName('');
      setNewDriverPhone('+61 ');
      setNewDriverEmail('');
      setNewDriverLicense('');
      setNewDriverVehicleId('');
      setNewDriverPassword('');
      loadData();
    } catch (err: any) {
      // A duplicate licence number is the common one, and the API says so.
      const detail = err?.response?.data?.detail;
      setDriverFormError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail) && detail.length
            ? detail.map((d: any) => `${(d.loc || []).slice(1).join('.') || 'field'}: ${d.msg}`).join(' • ')
            : err?.message || 'The chauffeur was not saved.'
      );
    } finally {
      setSavingDriver(false);
    }
  };

  // Poll the board so a chauffeur advancing a trip on their phone shows up
  // here. This used to patch a hardcoded "CCM-2026-9901" booking from the
  // in-memory live-sync cache, which reflected demo state rather than the
  // legs actually on the board.
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
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
      setBoardError(null);
    } catch (err: any) {
      // Demo bookings used to be injected here, which meant a dispatcher could
      // be looking at invented jobs and never know the board was stale.
      const detail = err?.response?.data?.detail;
      setBookings([]);
      setDrivers([]);
      setVehicles([]);
      setPartners([]);
      setBoardError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Operate board unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setLoading(false);
    }
  };


  const [allocatedWhatsAppUrl, setAllocatedWhatsAppUrl] = useState<string | null>(null);

  /**
   * Asks the API which chauffeurs are free for this leg's pickup window. The
   * backend evaluates real booking conflicts, so the dispatcher no longer has
   * to eyeball timings against a list.
   */
  const loadAvailability = async (leg: BookingLeg) => {
    setAvailability(null);
    setAvailabilityError(null);
    try {
      const durationMinutes = leg.duration_minutes && leg.duration_minutes > 0 ? leg.duration_minutes : 90;
      const res = await dispatchApi.getDriverAvailability(leg.pickup_datetime, durationMinutes);
      setAvailability(Array.isArray(res) ? res : []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setAvailabilityError(
        typeof detail === 'string' ? detail : 'Could not check chauffeur availability for this pickup window.'
      );
    }
  };

  const availabilityFor = (driverId: string) => availability?.find((a) => a.driver_id === driverId);

  const handleOpenAllocation = (booking: Booking, leg: BookingLeg) => {
    setSelectedLeg({ bookingId: booking.id, leg });
    setDispatchNotice(null);
    loadAvailability(leg);
    setAllocationDriverId(leg.driver_id || (drivers[0]?.id || ''));
    setAllocationVehicleId(leg.vehicle_id || (vehicles[0]?.id || ''));
    setAllocationCost(leg.allocation_cost > 0 ? leg.allocation_cost : 140);
    setAllocationError(null);
    setAllocationSuccess(null);
    setAllocatedWhatsAppUrl(null);
  };

  const handleExecuteAllocation = async () => {
    if (!selectedLeg) return;
    
    const assignedDriver = drivers.find((d) => d.id === allocationDriverId) || drivers[0];
    const parentBooking = bookings.find((b) => b.id === selectedLeg.bookingId);
    const cleanPhone = (assignedDriver?.phone || '61432000718').replace(/[^0-9]/g, '');

    const waText =
      `🚗 *[OPAL CHAUFFEURS - DRIVER TRIP ALLOCATION]* 🧑‍✈️\n\n` +
      `📋 *Booking Ref:* #${parentBooking?.booking_number || selectedLeg.bookingId}\n` +
      `👤 *Passenger:* ${parentBooking?.passenger_name || 'VIP Client'} (${parentBooking?.passenger_phone || '+61 411 222 333'})\n` +
      `📅 *Pickup Time:* ${new Date(selectedLeg.leg.pickup_datetime).toLocaleString('en-AU')}\n` +
      `📍 *Pickup:* ${selectedLeg.leg.pickup_address}\n` +
      `🏁 *Dropoff:* ${selectedLeg.leg.dropoff_address}\n` +
      `💰 *Guaranteed Driver Payout:* $${allocationCost.toFixed(2)} AUD\n\n` +
      `📲 *Click your Driver Portal link below to open live manifest, 1-tap call & maps:*\n` +
      `👉 https://driver-frontend-q3fh.onrender.com/driver`;

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waText)}`;
    setAllocatedWhatsAppUrl(waUrl);

    try {
      setAllocationError(null);
      setIsAllocating(true);
      await dispatchApi.allocateDriver(
        selectedLeg.leg.id,
        allocationDriverId,
        allocationVehicleId,
        allocationCost
      );
      setAllocationSuccess(`Chauffeur allocated to ${parentBooking?.booking_number || 'this leg'}.`);

      // Send the trip brief to the chauffeur from the server, so allocation and
      // notification are one action rather than a link someone has to remember
      // to press Send on.
      if (assignedDriver?.phone) {
        try {
          const notif = await notificationsApi.sendDirect({
            recipient: assignedDriver.phone,
            channel: 'WHATSAPP',
            message: waText,
            booking_id: selectedLeg.bookingId,
          });
          setDispatchNotice(
            notif?.status === 'SENT'
              ? `WhatsApp trip brief delivered to ${assignedDriver.full_name} (${assignedDriver.phone}).`
              : `Trip brief recorded but the gateway did not confirm delivery (${notif?.status || 'unknown'}). Use the manual WhatsApp link below.`
          );
        } catch (err: any) {
          const detail = err?.response?.data?.detail;
          setDispatchNotice(
            `Allocation saved, but the WhatsApp brief could not be sent${
              typeof detail === 'string' ? `: ${detail}` : ''
            }. Use the manual WhatsApp link below.`
          );
        }
      }

      loadData();
      loadAvailability(selectedLeg.leg);
    } catch (err: any) {
      // A refusal here is usually the backend's schedule-conflict check, which
      // is the entire point of allocating through it. Never report success.
      const detail = err?.response?.data?.detail;
      setAllocationSuccess(null);
      setAllocationError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Allocation failed (HTTP ${err.response.status}).`
            : 'Allocation failed: no connection to the Opal Cloud Engine.'
      );
    } finally {
      setIsAllocating(false);
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
    PENDING: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
    ALLOCATED: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
    DISPATCHED: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
    EN_ROUTE: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
    ARRIVED: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
    PICKED_UP: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
    COMPLETED: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
    CANCELLED: 'bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black',
  };

  return (
    <div className="space-y-6 text-[#0A0E1A]">
      {driverNotice && (
        <div className="flex items-start gap-3 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] p-4 shadow-lg">
          <UserCheck className="w-5 h-5 text-[#0A0E1A] shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-[#0A0E1A] flex-1 min-w-0 break-words">{driverNotice}</p>
          <button
            onClick={() => setDriverNotice(null)}
            className="shrink-0 p-1 rounded-lg border border-[#E6D8C3] hover:bg-[#FAF6F0]"
          >
            <X className="w-4 h-4 text-[#0A0E1A]" />
          </button>
        </div>
      )}

      {boardError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl bg-[#FFFFFF] border border-[#EF4444] p-4 shadow-lg"
        >
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-black text-[#0A0E1A]">Operate board could not be loaded</p>
              <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">
                {boardError} The board is empty rather than showing stale or sample jobs.
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="shrink-0 px-4 py-2 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Header & View Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl shadow-lg bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Live Operate & Dispatch Board</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono shadow-sm">
              ONE MASTER BOOKING ENGINE
            </span>
          </div>
          <p className="text-xs text-[#0A0E1A] font-bold mt-1">
            Real-time Add-Allocate-Settle operational lifecycle with net profit margins and driver schedule conflict guards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Onboard New Driver Button */}
          <button
            onClick={() => setIsAddDriverOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
            title="Onboard and add a new chauffeur"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="font-black">+ Onboard Driver</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Table / Kanban View Toggle */}
          <div className="flex p-1 bg-[#06090F] rounded-xl border border-[#1E2738]">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'table' ? 'bg-[#FAF6F0] text-[#0A0E1A] font-black shadow' : 'text-white hover-yellow font-bold'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3.5 py-1.5 rounded-lg text-xs transition-all ${
                viewMode === 'kanban' ? 'bg-[#FAF6F0] text-[#0A0E1A] font-black shadow' : 'text-white hover-sky font-bold'
              }`}
            >
              Kanban Board
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex items-center gap-4 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E6D8C3] shadow-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#0A0E1A]" />
          <input
            type="text"
            placeholder="Search booking number, passenger name, flight number or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs text-[#0A0E1A] placeholder-slate-600 font-black focus:outline-none focus:border-[#0A0E1A]"
          />
        </div>
      </div>

      {/* Main Table View */}
      {viewMode === 'table' ? (
        <div className="glass-panel rounded-2xl overflow-hidden border-[#E6D8C3] shadow-xl bg-[#FAF6F0]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase font-mono font-black tracking-wider border-b border-[#E6D8C3]">
                <tr>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Booking Ref</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Passenger & Contact</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Route & Vehicle Class</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Pickup Time (AEST)</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Status</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Assigned Driver / Partner</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Fare & Margin</th>
                  <th className="py-3.5 px-4 font-black text-right text-[#0A0E1A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D8C3] font-sans">
                {bookings.map((b) =>
                  b.legs.map((leg) => {
                    const assignedDriver = drivers.find((d) => d.id === leg.driver_id);
                    const grossFare = leg.fare_share || b.total_fare / Math.max(1, b.legs.length);
                    const netExGst = grossFare / 1.1;
                    // The API omits partner_payout_amount when there is no
                    // partner, which turned the whole margin column into NaN.
                    const directCost = (leg.allocation_cost ?? 0) + (leg.partner_payout_amount ?? 0);
                    const margin = netExGst - directCost;
                    const marginPct = (margin / Math.max(1, netExGst)) * 100;

                    return (
                      <tr key={leg.id} className="clickable-row bg-[#FFFFFF] transition-colors cursor-pointer">
                        <td className="py-4 px-4 font-mono font-black text-[#0A0E1A]">
                          {b.booking_number}
                          <span className="block text-[10px] text-[#0A0E1A] font-bold font-sans">Leg #{leg.leg_number}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-black text-[#0A0E1A] block text-sm">{b.passenger_name || 'VIP Client'}</span>
                          <span className="block text-[10px] text-[#0A0E1A] font-bold font-mono">{b.passenger_phone || '+61 400 000 000'}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-[#0A0E1A] font-black">
                            <MapPin className="w-3.5 h-3.5 text-[#0A0E1A] shrink-0" />
                            <span className="truncate max-w-[180px] text-[#0A0E1A]">{leg.pickup_address}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[#0A0E1A] text-[11px] font-bold mt-0.5">
                            <span className="truncate max-w-[180px] text-[#0A0E1A]">➔ {leg.dropoff_address}</span>
                          </div>
                          {leg.is_airport_pickup && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 mt-1 rounded-md bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] font-black">
                              <Plane className="w-2.5 h-2.5 text-[#0A0E1A]" /> Airport Meet & Greet ({leg.flight_number || 'Tullamarine'})
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-[#0A0E1A] font-black">
                          {new Date(leg.pickup_datetime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          <span className="block text-[10px] text-[#0A0E1A] font-bold font-sans">{new Date(leg.pickup_datetime).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black border font-mono bg-[#FAF6F0] text-[#0A0E1A] border-[#DFCAA8]">
                            {leg.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {assignedDriver ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-[#06090F] text-white border border-[#DFCAA8] font-black flex items-center justify-center text-xs shadow-sm">
                                {assignedDriver.full_name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-black text-[#0A0E1A] block">{assignedDriver.full_name}</span>
                                <span className="block text-[10px] text-[#0A0E1A] font-bold font-mono">Cost: ${leg.allocation_cost.toFixed(2)} AUD</span>
                              </div>
                            </div>
                          ) : leg.partner_id ? (
                            <div className="text-[#0A0E1A] font-black">
                              Subcontractor Offload
                              <span className="block text-[10px] text-[#0A0E1A] font-bold font-mono">Payout: ${(leg.partner_payout_amount ?? 0).toFixed(2)} AUD</span>
                            </div>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-full bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] font-black text-[11px]">
                              Unallocated
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          <span className="font-black text-[#0A0E1A] text-sm">${grossFare.toFixed(2)}</span>
                          <span className="block text-[11px] text-[#0A0E1A] font-black">
                            +${margin.toFixed(2)} ({marginPct.toFixed(0)}%)
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleOpenAllocation(b, leg)}
                            className="px-3.5 py-2 rounded-xl bg-[#06090F] hover-sky text-white border border-[#DFCAA8] text-xs font-black transition-all shadow-md active:scale-95"
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
              <div key={colStatus} className="glass-panel p-4 rounded-2xl flex flex-col space-y-3 shadow-lg bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A]">
                <div className="flex items-center justify-between pb-2 border-b border-[#E6D8C3]">
                  <h3 className="text-xs font-black text-[#0A0E1A] uppercase tracking-wider">{colStatus}</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] text-xs font-mono font-black shadow-sm">
                    {legsInCol.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px]">
                  {legsInCol.map(({ booking, leg }) => (
                    <div key={leg.id} className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] hover:border-[#0A0E1A] transition-all shadow-sm text-[#0A0E1A]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-black text-[#0A0E1A]">{booking.booking_number}</span>
                        <span className="font-mono font-black text-[#0A0E1A]">${booking.total_fare.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-[#0A0E1A] font-black mt-1">{booking.passenger_name}</p>
                      <p className="text-[11px] text-[#0A0E1A] font-bold mt-1 truncate">{leg.pickup_address} ➔ {leg.dropoff_address}</p>
                      <button
                        onClick={() => handleOpenAllocation(booking, leg)}
                        className="w-full mt-3 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] text-xs font-black transition-all shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] max-w-lg w-full p-6 sm:p-7 rounded-3xl relative space-y-5 shadow-2xl text-[#0A0E1A]">
            <button
              onClick={() => setSelectedLeg(null)}
              className="absolute top-5 right-5 text-white hover:bg-[#1A2233] p-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8]"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div>
              <h3 className="text-lg font-black text-[#0A0E1A]">Dispatch & Driver Allocation</h3>
              <p className="text-xs text-[#0A0E1A] font-bold mt-1">
                Master Booking: <strong className="font-mono text-[#0A0E1A]">{selectedLeg.leg.pickup_address} ➔ {selectedLeg.leg.dropoff_address}</strong>
              </p>
            </div>

            {allocationError && (
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs flex items-center gap-2 font-black">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#0A0E1A]" />
                <span>{allocationError}</span>
              </div>
            )}

            {allocationSuccess && (
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs flex items-center gap-2 font-black">
                <CheckCircle className="w-4 h-4 shrink-0 text-[#0A0E1A]" />
                <span>{allocationSuccess}</span>
              </div>
            )}

            {dispatchNotice && (
              <div className="mb-3 p-3 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-bold flex items-start gap-2">
                <Send className="w-4 h-4 shrink-0 text-[#0A0E1A] mt-0.5" />
                <span>{dispatchNotice}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <label className="block font-black text-[#0A0E1A]">Select Fleet Chauffeur</label>
                  {availability === null && !availabilityError ? (
                    <span className="text-[10px] font-bold text-[#0A0E1A] opacity-60">checking availability…</span>
                  ) : availability ? (
                    <span className="text-[10px] font-black text-[#0A0E1A]">
                      {availability.filter((a) => a.is_available).length} of {availability.length} free at this pickup
                    </span>
                  ) : null}
                </div>
                <select
                  value={allocationDriverId}
                  onChange={(e) => setAllocationDriverId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                >
                  {drivers.map((d) => {
                    const avail = availabilityFor(d.id);
                    const marker = !avail ? '' : avail.is_available ? ' — FREE' : ' — BUSY';
                    return (
                      <option key={d.id} value={d.id} className="text-[#0A0E1A]">
                        {d.full_name} (⭐ {d.rating.toFixed(2)}){marker}
                      </option>
                    );
                  })}
                </select>

                {availabilityError && (
                  <p className="mt-1.5 text-[11px] font-bold text-[#B91C1C]">{availabilityError}</p>
                )}

                {(() => {
                  const avail = availabilityFor(allocationDriverId);
                  if (!avail || avail.is_available) return null;
                  return (
                    <p className="mt-1.5 text-[11px] font-black text-[#B91C1C]">
                      ⚠ Schedule conflict: {avail.conflict_reason || 'already committed during this pickup window.'}
                    </p>
                  );
                })()}
              </div>

              <div>
                <label className="block font-black text-[#0A0E1A] mb-1.5">Select Fleet Vehicle</label>
                <select
                  value={allocationVehicleId}
                  onChange={(e) => setAllocationVehicleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id} className="text-[#0A0E1A]">
                      {v.make} {v.model} ({v.registration_plate} • {v.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black text-[#0A0E1A] mb-1.5">Driver Allocation Payout Rate ($ AUD)</label>
                <input
                  type="number"
                  value={allocationCost}
                  onChange={(e) => setAllocationCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-black font-mono focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>
            </div>

            {allocatedWhatsAppUrl && (
              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] space-y-2.5 text-[#0A0E1A]">
                <span className="text-xs font-black text-[#0A0E1A] block">
                  ✓ Chauffeur Allocated! Send trip link to Driver WhatsApp:
                </span>
                <a
                  href={allocatedWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white font-black text-xs flex items-center justify-center gap-2 border border-[#DFCAA8] shadow-lg transition-all"
                >
                  <Send className="w-4 h-4 text-white" />
                  <span>📱 Send Driver Portal Link to WhatsApp ➔</span>
                </a>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[#E6D8C3]">
              <button
                onClick={() => setOffloadModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] text-xs font-black transition-all shadow-sm"
              >
                Subcontractor Offload &rarr;
              </button>

              <div className="flex items-center gap-2">
                {allocatedWhatsAppUrl && (
                  <button
                    onClick={() => {
                      setSelectedLeg(null);
                      setAllocatedWhatsAppUrl(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] text-xs font-black transition-all shadow-sm"
                  >
                    Done & Close
                  </button>
                )}
                <button
                  onClick={handleExecuteAllocation}
                  className="px-6 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs shadow-md transition-all"
                >
                  Confirm Allocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subcontractor Partner Offload Modal */}
      {offloadModalOpen && selectedLeg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] max-w-md w-full p-6 sm:p-7 rounded-3xl relative space-y-4 shadow-2xl text-[#0A0E1A]">
            <button
              onClick={() => setOffloadModalOpen(false)}
              className="absolute top-5 right-5 text-[#0A0E1A] hover:bg-[#E6D8C3] p-1.5 rounded-xl bg-white border border-[#E6D8C3]"
            >
              <X className="w-5 h-5 text-[#0A0E1A]" />
            </button>

            <h3 className="text-base font-black text-[#0A0E1A]">Broadcast 15-Min Partner Offer</h3>
            <p className="text-xs text-[#0A0E1A] font-bold">
              Dispatches an instant email/SMS offer to the affiliate partner with a 15-minute countdown window.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black text-[#0A0E1A] mb-1">Select Partner Network</label>
                <select
                  value={offloadPartnerId}
                  onChange={(e) => setOffloadPartnerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-black"
                >
                  <option value="" className="text-[#0A0E1A]">-- Select Compliant Partner --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id} className="text-[#0A0E1A]">
                      {p.company_name} ({p.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-black text-[#0A0E1A] mb-1">Offered Subcontractor Payout ($)</label>
                <input
                  type="number"
                  value={offloadPayout}
                  onChange={(e) => setOffloadPayout(parseFloat(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-mono font-black"
                />
              </div>
            </div>

            <button
              onClick={handleBroadcastPartnerOffer}
              className="w-full mt-4 py-3 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <Send className="w-4 h-4 text-white" />
              <span>Broadcast Offer (15-Min Timer)</span>
            </button>
          </div>
        </div>
      )}

      {/* Onboard New Chauffeur Modal (ADMIN PANEL ONLY) */}
      {isAddDriverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] max-w-lg w-full p-6 sm:p-7 rounded-3xl relative space-y-5 shadow-2xl text-[#0A0E1A]">
            <button
              onClick={() => setIsAddDriverOpen(false)}
              className="absolute top-5 right-5 text-[#0A0E1A] hover:bg-[#E6D8C3] p-1.5 rounded-xl bg-white border border-[#E6D8C3]"
            >
              <X className="w-5 h-5 text-[#0A0E1A]" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] flex items-center justify-center text-[#0A0E1A] shadow-sm">
                <UserPlus className="w-5 h-5 text-[#0A0E1A]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#0A0E1A]">Onboard New Fleet Chauffeur</h3>
                <p className="text-xs text-[#0A0E1A] font-bold">Add driver credentials for automated WhatsApp dispatch & job allocations.</p>
              </div>
            </div>

            <form onSubmit={handleSaveNewDriver} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">Driver Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amit Sharma"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>

                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">WhatsApp / Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+61 400 000 000"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A] font-mono font-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="driver@opalchauffeurs.com.au"
                    value={newDriverEmail}
                    onChange={(e) => setNewDriverEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                  <p className="text-[10px] text-slate-700 font-bold mt-1">This becomes their driver portal login.</p>
                </div>

                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">Driver Accreditation / Licence No *</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    placeholder="Their real licence number"
                    value={newDriverLicense}
                    onChange={(e) => setNewDriverLicense(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A] font-mono font-black"
                  />
                  <p className="text-[10px] text-slate-700 font-bold mt-1">
                    Their real accreditation number. This is a compliance record, so it must not be guessed.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  {/* Was two free-text boxes whose values went nowhere. The API
                      links a driver to a vehicle by id, so this is the real fleet. */}
                  <label className="block font-black text-[#0A0E1A] mb-1">Default Vehicle</label>
                  <select
                    value={newDriverVehicleId}
                    onChange={(e) => setNewDriverVehicleId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  >
                    <option value="">No default vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model} — {v.registration_plate}
                      </option>
                    ))}
                  </select>
                  {vehicles.length === 0 && (
                    <p className="text-[10px] text-slate-700 font-bold mt-1">
                      No vehicles on file yet — add them under Partners &amp; Fleet.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">Initial Portal Password *</label>
                  <input
                    type="text"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={newDriverPassword}
                    onChange={(e) => setNewDriverPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A] font-mono font-black"
                  />
                  <p className="text-[10px] text-slate-700 font-bold mt-1">
                    Give this to the chauffeur — they can change it from the portal.
                  </p>
                </div>
              </div>

              {driverFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold break-words">
                  {driverFormError}
                </div>
              )}

              <div className="pt-3 border-t border-[#E6D8C3] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddDriverOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] text-xs font-black transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDriver}
                  className="px-6 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all disabled:opacity-60"
                >
                  {savingDriver ? (
                    <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 text-white" />
                  )}
                  <span>{savingDriver ? 'Saving…' : 'Save & Onboard Driver'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
