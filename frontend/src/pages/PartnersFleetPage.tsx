import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingsApi, fleetApi, partnersApi } from '../services/api';
import { Booking, BookingLeg, Driver, Partner, Vehicle } from '../types';
import {
  Users,
  Car,
  ShieldCheck,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Phone,
  Briefcase,
  Calendar,
  Upload,
  FileText,
  Clock,
  RefreshCw,
  LoaderCircle,
  Check,
  X,
  Palette,
} from 'lucide-react';

/**
 * Partner network and fleet.
 *
 * Everything on this screen used to be invented in the browser: the partner
 * list started life as three hardcoded companies ("Silver Service Chauffeurs
 * Sydney" and friends), new partners and vehicles were written to
 * localStorage instead of the API — so they existed only in whichever browser
 * created them and could never be allocated to a job — and every "assigned
 * booking" was generated on the fly from the partner's city, with passenger
 * names and phone numbers that belong to nobody.
 *
 * Now: partners, vehicles and drivers come from the API, assigned jobs are the
 * real booking legs carrying that partner_id / vehicle_id, and creating either
 * one POSTs to the backend. The only thing still kept in localStorage is the
 * per-vehicle photo override, which is a display preference — and the UI says
 * so rather than implying it is shared.
 */

interface ExtendedVehicle extends Vehicle {
  image_url?: string;
  color_name?: string;
  color_hex?: string;
  color_filter?: string;
}

interface ColorShader {
  name: string;
  colorHex: string;
  filter: string;
}

/** A booking leg paired with the booking it belongs to. */
interface LegRow {
  leg: BookingLeg;
  booking: Booking;
}

const IMAGE_OVERRIDE_KEY = 'crown_vehicle_images_v2';

// Photos shipped with the app, matched to the operator's own fleet by plate.
const MODEL_AUTHENTIC_BASE_PHOTOS: Record<string, string> = {
  S_CLASS_GTS783: '/images/fleet/mercedes_s_class_gts783.jpg',
  V_CLASS_CGL646: '/images/fleet/mercedes_vclass_cgl646.jpg',
  V_CLASS_CPS711: '/images/fleet/mercedes_vclass_cps711.jpg',
  V_CLASS_2DC7AY: '/images/fleet/mercedes_vclass_2dc7ay.jpg',
  V_CLASS_2DZ8YJ: '/images/fleet/mercedes_vclass_2dz8yj.jpg',
  SPRINTER_BZZ931: '/images/fleet/mercedes_sprinter_bzz931.jpg',
  SPRINTER_BS14OK: '/images/fleet/mercedes_sprinter_bs14ok.jpg',
  AUDI_Q7_AMJ506: '/images/fleet/audi_q7_amj506.jpg',
  AUDI_Q7_HC0687: '/images/fleet/audi_q7_hc0687.jpg',
  DEFAULT: '/images/fleet/mercedes_s_class_gts783.jpg',
};

const COLOR_SHADERS: ColorShader[] = [
  { name: 'Obsidian Jet Black', colorHex: '#0a0a0a', filter: 'brightness(0.82) contrast(1.3) grayscale(0.25)' },
  { name: 'Polar Diamond White', colorHex: '#f8fafc', filter: 'brightness(1.4) contrast(1.1) grayscale(0.45)' },
  { name: 'Selenite Anthracite Grey', colorHex: '#334155', filter: 'brightness(0.95) contrast(1.25) grayscale(0.95)' },
  { name: 'Iridium Silver Metallic', colorHex: '#cbd5e1', filter: 'brightness(1.2) contrast(1.15) grayscale(0.7)' },
  { name: 'Nautical Navy Blue', colorHex: '#1e3a8a', filter: 'brightness(0.9) contrast(1.2) hue-rotate(185deg) saturate(1.4)' },
  { name: 'Emerald Forest Green', colorHex: '#064e3b', filter: 'brightness(0.88) contrast(1.2) hue-rotate(85deg) saturate(1.3)' },
];

// Must match the backend VehicleCategory enum — the old list offered
// "FIRST_CLASS", which the API rejects with a 422.
const VEHICLE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'SEDAN_EXECUTIVE', label: 'Sedan Executive' },
  { value: 'SEDAN_PREMIUM', label: 'Sedan Premium' },
  { value: 'SUV_PREMIUM', label: 'SUV Premium' },
  { value: 'PEOPLE_MOVER', label: 'People Mover Van' },
  { value: 'MINIBUS', label: 'Minibus' },
];

const getModelBasePhoto = (
  vehicle: { make?: string; model?: string; category?: string; registration_plate?: string } | null
): string => {
  if (!vehicle) return MODEL_AUTHENTIC_BASE_PHOTOS.DEFAULT;
  const plate = (vehicle.registration_plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (plate.includes('GTS783')) return MODEL_AUTHENTIC_BASE_PHOTOS.S_CLASS_GTS783;
  if (plate.includes('CGL646')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_CGL646;
  if (plate.includes('CPS711')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_CPS711;
  if (plate.includes('2DC7AY')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_2DC7AY;
  if (plate.includes('2DZ8YJ')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_2DZ8YJ;
  if (plate.includes('BZZ931')) return MODEL_AUTHENTIC_BASE_PHOTOS.SPRINTER_BZZ931;
  if (plate.includes('BS14OK')) return MODEL_AUTHENTIC_BASE_PHOTOS.SPRINTER_BS14OK;
  if (plate.includes('AMJ506')) return MODEL_AUTHENTIC_BASE_PHOTOS.AUDI_Q7_AMJ506;
  if (plate.includes('HC0687')) return MODEL_AUTHENTIC_BASE_PHOTOS.AUDI_Q7_HC0687;

  const name = `${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.category || ''}`.toUpperCase();
  if (name.includes('S-CLASS') || name.includes('S450') || name.includes('S580')) {
    return MODEL_AUTHENTIC_BASE_PHOTOS.S_CLASS_GTS783;
  }
  if (name.includes('SPRINTER') || name.includes('MINIBUS')) return MODEL_AUTHENTIC_BASE_PHOTOS.SPRINTER_BS14OK;
  if (name.includes('Q7') || name.includes('AUDI') || name.includes('SUV')) return MODEL_AUTHENTIC_BASE_PHOTOS.AUDI_Q7_HC0687;
  return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_CPS711;
};

const readImageOverrides = (): Record<string, { url?: string; color_name?: string; color_hex?: string; color_filter?: string }> => {
  try {
    return JSON.parse(localStorage.getItem(IMAGE_OVERRIDE_KEY) || '{}');
  } catch {
    return {};
  }
};

const money = (amount?: number | null): string =>
  typeof amount === 'number' ? `$${amount.toFixed(2)}` : '—';

const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (iso?: string | null): string => {
  if (!iso) return 'Not recorded';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** A policy that has already lapsed is a compliance failure, whatever the flag says. */
const isExpired = (iso?: string | null): boolean => {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
};

const apiErrorText = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d: any) => `${(d.loc || []).slice(1).join('.') || 'field'}: ${d.msg}`).join(' • ');
  }
  return err?.message || fallback;
};

const EMPTY_PARTNER_FORM = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  abn: '',
  commission_rate: 15,
  city: 'Melbourne',
  insurance_policy_number: '',
  insurance_expiry: '',
  accreditation_number: '',
  accreditation_expiry: '',
};

const EMPTY_VEHICLE_FORM = {
  make: 'Mercedes-Benz',
  model: '',
  year: new Date().getFullYear(),
  category: 'SEDAN_EXECUTIVE',
  registration_plate: '',
  passenger_capacity: 4,
  luggage_capacity: 3,
  color: '',
};

export const PartnersFleetPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [vehicles, setVehicles] = useState<ExtendedVehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'partners' | 'fleet'>('partners');

  // Modals
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [selectedPartnerForBookings, setSelectedPartnerForBookings] = useState<Partner | null>(null);
  const [selectedVehicleForBookings, setSelectedVehicleForBookings] = useState<ExtendedVehicle | null>(null);
  const [vehicleBookingsTab, setVehicleBookingsTab] = useState<'advance' | 'completed'>('advance');

  // Vehicle photo / colour customiser
  const [editingVehicleImage, setEditingVehicleImage] = useState<ExtendedVehicle | null>(null);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [selectedColorName, setSelectedColorName] = useState(COLOR_SHADERS[0].name);
  const [selectedColorHex, setSelectedColorHex] = useState(COLOR_SHADERS[0].colorHex);
  const [selectedColorFilter, setSelectedColorFilter] = useState(COLOR_SHADERS[0].filter);
  const [savingColor, setSavingColor] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);

  // Forms
  const [newPartner, setNewPartner] = useState({ ...EMPTY_PARTNER_FORM });
  const [newVehicle, setNewVehicle] = useState({ ...EMPTY_VEHICLE_FORM });
  const [savingPartner, setSavingPartner] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [partnerFormError, setPartnerFormError] = useState<string | null>(null);
  const [vehicleFormError, setVehicleFormError] = useState<string | null>(null);

  // Live compliance check result, keyed by partner id.
  const [complianceResults, setComplianceResults] = useState<Record<string, any>>({});
  const [checkingCompliance, setCheckingCompliance] = useState<string | null>(null);

  const applyImageOverrides = useCallback((list: Vehicle[]): ExtendedVehicle[] => {
    const overrides = readImageOverrides();
    return list.map((v) => {
      const custom = overrides[v.id] || {};
      const shader = COLOR_SHADERS.find((c) => c.name === (v.color || ''));
      return {
        ...v,
        image_url: custom.url || getModelBasePhoto(v),
        // The colour recorded against the vehicle in the database wins; the
        // local override only supplies one when the record has none.
        color_name: v.color || custom.color_name || undefined,
        color_hex: shader?.colorHex || custom.color_hex,
        color_filter: shader ? shader.filter : custom.color_filter,
      };
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [partnerList, vehicleList, driverList, bookingPage] = await Promise.all([
        partnersApi.list(),
        fleetApi.getVehicles(),
        fleetApi.getDrivers(),
        bookingsApi.list(undefined, 200),
      ]);
      setPartners(partnerList);
      setVehicles(applyImageOverrides(vehicleList));
      setDrivers(driverList);
      setBookings(bookingPage.bookings || []);
    } catch (err: any) {
      // No demo fallback: an operator looking at invented partners would
      // offload work to companies that do not exist.
      setLoadError(apiErrorText(err, 'Could not load the partner network and fleet.'));
      setPartners([]);
      setVehicles([]);
      setDrivers([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [applyImageOverrides]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Every booking leg, flattened, so partner/vehicle lookups are one pass. */
  const legRows = useMemo<LegRow[]>(
    () => bookings.flatMap((b) => (b.legs || []).map((leg) => ({ leg, booking: b }))),
    [bookings]
  );

  const partnerLegs = useCallback(
    (partnerId: string): LegRow[] =>
      legRows
        .filter((r) => r.leg.partner_id === partnerId)
        .sort((a, b) => (b.leg.pickup_datetime || '').localeCompare(a.leg.pickup_datetime || '')),
    [legRows]
  );

  const vehicleLegs = useCallback(
    (vehicleId: string) => {
      const mine = legRows.filter((r) => r.leg.vehicle_id === vehicleId);
      const completed = mine
        .filter((r) => r.leg.status === 'COMPLETED')
        .sort((a, b) => (b.leg.pickup_datetime || '').localeCompare(a.leg.pickup_datetime || ''));
      const advance = mine
        .filter((r) => r.leg.status !== 'COMPLETED' && r.leg.status !== 'CANCELLED')
        .sort((a, b) => (a.leg.pickup_datetime || '').localeCompare(b.leg.pickup_datetime || ''));
      return { advance, completed };
    },
    [legRows]
  );

  const driversForVehicle = useCallback(
    (vehicleId: string) => drivers.filter((d) => d.default_vehicle_id === vehicleId),
    [drivers]
  );

  // --- Create partner -------------------------------------------------

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerFormError(null);
    setSavingPartner(true);
    try {
      // Sent exactly as typed. The old version substituted a placeholder ABN
      // and phone number when a field was blank, which put fictitious
      // compliance data against a real subcontractor.
      const created = await partnersApi.create({
        company_name: newPartner.company_name.trim(),
        contact_name: newPartner.contact_name.trim(),
        email: newPartner.email.trim(),
        phone: newPartner.phone.trim(),
        abn: newPartner.abn.trim() || null,
        commission_rate: Number(newPartner.commission_rate),
        city: newPartner.city,
        insurance_policy_number: newPartner.insurance_policy_number.trim() || null,
        insurance_expiry: newPartner.insurance_expiry
          ? new Date(`${newPartner.insurance_expiry}T00:00:00`).toISOString()
          : null,
        accreditation_number: newPartner.accreditation_number.trim() || null,
        accreditation_expiry: newPartner.accreditation_expiry
          ? new Date(`${newPartner.accreditation_expiry}T00:00:00`).toISOString()
          : null,
        is_active: true,
      });
      setPartners((prev) => [...prev, created].sort((a, b) => a.company_name.localeCompare(b.company_name)));
      setIsAddPartnerOpen(false);
      setNewPartner({ ...EMPTY_PARTNER_FORM });
    } catch (err: any) {
      setPartnerFormError(apiErrorText(err, 'The partner was not saved.'));
    } finally {
      setSavingPartner(false);
    }
  };

  // --- Create vehicle -------------------------------------------------

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleFormError(null);
    setSavingVehicle(true);
    try {
      const created = await fleetApi.createVehicle({
        make: newVehicle.make.trim(),
        model: newVehicle.model.trim(),
        year: Number(newVehicle.year),
        category: newVehicle.category,
        // Plates are stored without spacing so the photo lookup and the
        // dispatch board agree on one form.
        registration_plate: newVehicle.registration_plate.toUpperCase().replace(/\s+/g, ''),
        passenger_capacity: Number(newVehicle.passenger_capacity),
        luggage_capacity: Number(newVehicle.luggage_capacity),
        color: newVehicle.color || null,
        is_active: true,
      });
      setVehicles((prev) => applyImageOverrides([...prev, created]));
      setIsAddVehicleOpen(false);
      setNewVehicle({ ...EMPTY_VEHICLE_FORM });
    } catch (err: any) {
      setVehicleFormError(apiErrorText(err, 'The vehicle was not saved.'));
    } finally {
      setSavingVehicle(false);
    }
  };

  // --- Compliance -----------------------------------------------------

  const handleComplianceCheck = async (partner: Partner) => {
    setCheckingCompliance(partner.id);
    try {
      const result = await partnersApi.checkCompliance(partner.id);
      setComplianceResults((prev) => ({ ...prev, [partner.id]: result }));
    } catch (err: any) {
      setComplianceResults((prev) => ({
        ...prev,
        [partner.id]: { error: apiErrorText(err, 'Compliance check failed.') },
      }));
    } finally {
      setCheckingCompliance(null);
    }
  };

  // --- Vehicle photo / colour ----------------------------------------

  const handleOpenImageEditor = (vehicle: ExtendedVehicle) => {
    setColorError(null);
    setEditingVehicleImage(vehicle);
    setCustomImageUrlInput(vehicle.image_url || getModelBasePhoto(vehicle));
    const shader = COLOR_SHADERS.find((c) => c.name === vehicle.color_name) || COLOR_SHADERS[0];
    setSelectedColorName(vehicle.color_name || shader.name);
    setSelectedColorHex(vehicle.color_hex || shader.colorHex);
    setSelectedColorFilter(vehicle.color_filter ?? shader.filter);
  };

  const handleSaveVehicleImage = async () => {
    if (!editingVehicleImage) return;
    const vId = editingVehicleImage.id;
    setColorError(null);
    setSavingColor(true);
    try {
      // The colour is a fleet fact — a dispatcher on another machine needs to
      // know the car is white — so it goes to the database. The photo is a
      // local display choice and stays in this browser.
      await fleetApi.updateVehicle(vId, { color: selectedColorName });

      let photoWarning: string | null = null;
      const overrides = readImageOverrides();
      overrides[vId] = {
        url: customImageUrlInput,
        color_name: selectedColorName,
        color_hex: selectedColorHex,
        color_filter: selectedColorFilter,
      };
      try {
        localStorage.setItem(IMAGE_OVERRIDE_KEY, JSON.stringify(overrides));
      } catch {
        // Quota exceeded on a large uploaded photo — the colour still saved.
        photoWarning = 'Colour saved. The photo was too large to keep in this browser.';
      }

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vId
            ? {
                ...v,
                color: selectedColorName,
                image_url: customImageUrlInput,
                color_name: selectedColorName,
                color_hex: selectedColorHex,
                color_filter: selectedColorFilter,
              }
            : v
        )
      );

      if (photoWarning) {
        setColorError(photoWarning);
      } else {
        setEditingVehicleImage(null);
      }
    } catch (err: any) {
      setColorError(apiErrorText(err, 'The colour was not saved.'));
    } finally {
      setSavingColor(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        setCustomImageUrlInput(base64Url);
        setSelectedColorFilter('');
        setSelectedColorName('Original Photo');
        setSelectedColorHex('#38bdf8');
      }
    };
    reader.readAsDataURL(file);
  };

  // --- Render ---------------------------------------------------------

  const selectedPartnerLegs = selectedPartnerForBookings ? partnerLegs(selectedPartnerForBookings.id) : [];
  const selectedVehicleLegs = selectedVehicleForBookings
    ? vehicleLegs(selectedVehicleForBookings.id)
    : { advance: [] as LegRow[], completed: [] as LegRow[] };
  const visibleVehicleLegs =
    vehicleBookingsTab === 'advance' ? selectedVehicleLegs.advance : selectedVehicleLegs.completed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Partner Network &amp; Fleet Management</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono shadow-sm">
              AFFILIATE COMPLIANCE GATES
            </span>
          </div>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            Subcontractor registry with insurance verification, and the fleet catalogue with its real assigned jobs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex p-1 bg-[#06090F] rounded-xl border border-[#1E2738]">
            <button
              onClick={() => setActiveTab('partners')}
              className={`px-4 py-2 rounded-lg text-xs transition-all ${
                activeTab === 'partners'
                  ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
                  : 'text-slate-400 hover:text-white font-bold'
              }`}
            >
              Subcontractor Partners ({partners.length})
            </button>
            <button
              onClick={() => setActiveTab('fleet')}
              className={`px-4 py-2 rounded-lg text-xs transition-all ${
                activeTab === 'fleet'
                  ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
                  : 'text-slate-400 hover:text-white font-bold'
              }`}
            >
              Vehicle Fleet ({vehicles.length})
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-black text-xs flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          {activeTab === 'partners' ? (
            <button
              onClick={() => {
                setPartnerFormError(null);
                setIsAddPartnerOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4 text-[#DFCAA8]" /> Onboard Partner
            </button>
          ) : (
            <button
              onClick={() => {
                setVehicleFormError(null);
                setIsAddVehicleOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4 text-[#DFCAA8]" /> Add Fleet Vehicle
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="glass-panel p-5 rounded-2xl border border-rose-300 bg-rose-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-black text-rose-900">Partner network and fleet could not be loaded.</p>
            <p className="text-rose-800 font-semibold mt-0.5">{loadError}</p>
            <button
              onClick={loadData}
              className="mt-2 px-3 py-1.5 rounded-lg bg-[#06090F] text-white font-black text-[11px] border border-[#DFCAA8]"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center gap-2">
          <LoaderCircle className="w-6 h-6 text-[#7B6035] animate-spin" />
          <p className="text-xs font-black text-[#0A0E1A]">Loading partners, fleet and assigned jobs…</p>
        </div>
      )}

      {/* ── TAB 1: SUBCONTRACTOR PARTNERS ───────────────────────────── */}
      {!loading &&
        !loadError &&
        activeTab === 'partners' &&
        (partners.length === 0 ? (
          <div className="glass-panel p-10 rounded-2xl text-center space-y-2">
            <Users className="w-8 h-8 text-[#7B6035] mx-auto" />
            <p className="text-sm font-black text-[#0A0E1A]">No subcontractor partners registered yet.</p>
            <p className="text-xs text-slate-700 font-semibold">
              Use “Onboard Partner” to add an affiliate operator. They become available for job offers immediately.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {partners.map((p) => {
              const legs = partnerLegs(p.id);
              const payoutTotal = legs.reduce((sum, r) => sum + (r.leg.partner_payout_amount || 0), 0);
              const insuranceLapsed = isExpired(p.insurance_expiry);
              const accreditationLapsed = isExpired(p.accreditation_expiry);
              const compliant = Boolean(p.is_compliance_verified) && !insuranceLapsed && !accreditationLapsed;
              const check = complianceResults[p.id];

              return (
                <div
                  key={p.id}
                  className="glass-panel p-5 rounded-2xl border-[#E6D8C3] space-y-4 text-xs shadow-xl hover:border-[#DFCAA8] transition-all text-[#0A0E1A]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-[#0A0E1A]">{p.company_name}</h3>
                      <span className="text-[#0A0E1A] font-mono font-bold text-[11px]">ABN: {p.abn || 'Not provided'}</span>
                    </div>
                    {compliant ? (
                      <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" /> Compliant
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-900 border border-rose-300 shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" /> Action required
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[#0A0E1A] bg-[#FFFFFF] p-3.5 rounded-xl border border-[#E6D8C3]">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] block uppercase font-bold tracking-wider">Contact person</span>
                      <span className="font-black block truncate">{p.contact_name || p.contact_person || '—'}</span>
                      <span className="text-[11px] flex items-center gap-1 font-mono font-bold">
                        <Phone className="w-3 h-3" /> {p.phone || '—'}
                      </span>
                      <span className="text-[11px] font-semibold block truncate">{p.email}</span>
                    </div>
                    <div className="space-y-1 text-right min-w-0">
                      <span className="text-[10px] block uppercase font-bold tracking-wider">Region &amp; terms</span>
                      <span className="font-black block">{p.city || '—'}</span>
                      <span className="text-[11px] font-black font-mono">
                        {typeof p.commission_rate === 'number' ? `${p.commission_rate}% commission` : 'Rate not set'}
                      </span>
                      <span className={`text-[11px] font-black block ${p.is_active ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[11px] space-y-1 font-mono text-[#0A0E1A]">
                    <div className="flex justify-between gap-2">
                      <span className="font-bold font-sans">Public liability policy</span>
                      <span className="font-black text-right">{p.insurance_policy_number || 'Not recorded'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold font-sans">Insurance expiry</span>
                      <span className={`font-black ${insuranceLapsed ? 'text-rose-800' : ''}`}>
                        {formatDate(p.insurance_expiry)}
                        {insuranceLapsed ? ' — LAPSED' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="font-bold font-sans">Accreditation</span>
                      <span className={`font-black text-right ${accreditationLapsed ? 'text-rose-800' : ''}`}>
                        {p.accreditation_number || 'Not recorded'}
                        {accreditationLapsed ? ' — LAPSED' : ''}
                      </span>
                    </div>
                  </div>

                  {check && (
                    <div
                      className={`p-3 rounded-xl text-[11px] font-semibold border ${
                        check.error
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : check.is_compliant
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : 'bg-amber-50 border-amber-300 text-amber-900'
                      }`}
                    >
                      {check.error
                        ? check.error
                        : check.is_compliant
                        ? 'Server compliance check passed — this partner can be offered work.'
                        : `Server compliance check failed: ${(check.reasons || []).join(' • ') || 'no reason given'}`}
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6D8C3]">
                    <div className="text-[11px] font-bold">
                      Payouts booked: <strong className="font-mono font-black">{money(payoutTotal)} AUD</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleComplianceCheck(p)}
                        disabled={checkingCompliance === p.id}
                        className="px-3 py-2 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-black text-[11px] flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {checkingCompliance === p.id ? (
                          <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Check compliance
                      </button>
                      <button
                        onClick={() => setSelectedPartnerForBookings(p)}
                        className="px-3.5 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" /> Assigned jobs ({legs.length})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* ── TAB 2: VEHICLE FLEET ────────────────────────────────────── */}
      {!loading &&
        !loadError &&
        activeTab === 'fleet' &&
        (vehicles.length === 0 ? (
          <div className="glass-panel p-10 rounded-2xl text-center space-y-2">
            <Car className="w-8 h-8 text-[#7B6035] mx-auto" />
            <p className="text-sm font-black text-[#0A0E1A]">No vehicles in the fleet yet.</p>
            <p className="text-xs text-slate-700 font-semibold">
              Add a car with “Add Fleet Vehicle”. It can then be allocated to a booking leg.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {vehicles.map((v) => {
              const vLegs = vehicleLegs(v.id);
              const totalTrips = vLegs.advance.length + vLegs.completed.length;
              const basePhoto = v.image_url || getModelBasePhoto(v);
              const assigned = driversForVehicle(v.id);

              return (
                <div
                  key={v.id}
                  className="glass-panel p-5 rounded-2xl border-[#E6D8C3] space-y-3.5 text-xs shadow-xl hover:border-[#DFCAA8] transition-all flex flex-col justify-between text-[#0A0E1A]"
                >
                  <div>
                    <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-950 border border-[#DFCAA8] group">
                      <img
                        src={basePhoto}
                        alt={`${v.make} ${v.model}`}
                        style={{ filter: v.color_filter || 'none' }}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-all duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent pointer-events-none" />

                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] shadow-sm">
                        {v.category}
                      </span>

                      <button
                        onClick={() => handleOpenImageEditor(v)}
                        className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] transition-all shadow-md flex items-center gap-1 text-[10px] font-black"
                        title="Change colour finish / photo"
                      >
                        <Palette className="w-3 h-3" />
                        <span>Colour</span>
                      </button>

                      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between pointer-events-none gap-2">
                        <div className="min-w-0">
                          <span className="text-white font-black text-sm tracking-wide drop-shadow-md block truncate">
                            {v.make} {v.model}
                          </span>
                          {v.color_name && (
                            <span className="text-[10px] text-white font-bold drop-shadow flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full border border-slate-700 inline-block"
                                style={{ backgroundColor: v.color_hex || '#0a0a0a' }}
                              />
                              {v.color_name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] font-bold font-mono shrink-0">
                          {v.year}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold">
                        Plate: <strong className="text-sm font-black">{v.registration_plate}</strong>
                      </span>
                      <span
                        className={`text-[11px] font-black flex items-center gap-1.5 ${
                          v.is_active ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${v.is_active ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`}
                        />
                        {v.is_active ? 'Active fleet' : 'Deactivated'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-center">
                      <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                        <span className="text-[10px] block uppercase font-bold">Passengers</span>
                        <span className="font-black text-sm font-mono">{v.passenger_capacity} PAX</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                        <span className="text-[10px] block uppercase font-bold">Luggage</span>
                        <span className="font-black text-sm font-mono">{v.luggage_capacity} bags</span>
                      </div>
                    </div>

                    <div className="mt-2 p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[11px]">
                      <span className="text-[10px] block uppercase font-bold">Default chauffeur</span>
                      <span className="font-black">
                        {assigned.length ? assigned.map((d) => d.full_name).join(', ') : 'None assigned'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E6D8C3]">
                    <button
                      onClick={() => {
                        setSelectedVehicleForBookings(v);
                        setVehicleBookingsTab(vLegs.advance.length ? 'advance' : 'completed');
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Calendar className="w-3.5 h-3.5" /> Schedule &amp; jobs ({totalTrips})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* ── MODAL 1: ONBOARD PARTNER ────────────────────────────────── */}
      {isAddPartnerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] shadow-sm">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Onboard new subcontractor partner</h3>
                  <p className="text-[11px] font-bold">Saved to the operations database, not just this browser</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPartnerOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] hover:bg-[#E6D8C3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Company name *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    placeholder="e.g. Perth Luxury Transfers"
                    value={newPartner.company_name}
                    onChange={(e) => setNewPartner({ ...newPartner, company_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Contact person *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={newPartner.contact_name}
                    onChange={(e) => setNewPartner({ ...newPartner, contact_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+61 400 000 000"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-mono font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="ops@partner.com.au"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Region / city</label>
                  <select
                    value={newPartner.city}
                    onChange={(e) => setNewPartner({ ...newPartner, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black"
                  >
                    {['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Hobart', 'Darwin'].map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">ABN</label>
                  <input
                    type="text"
                    placeholder="Blank if unknown"
                    value={newPartner.abn}
                    onChange={(e) => setNewPartner({ ...newPartner, abn: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-mono font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Commission %</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={newPartner.commission_rate}
                    onChange={(e) => setNewPartner({ ...newPartner, commission_rate: parseFloat(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black font-mono focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Public liability policy #</label>
                  <input
                    type="text"
                    value={newPartner.insurance_policy_number}
                    onChange={(e) => setNewPartner({ ...newPartner, insurance_policy_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-mono font-black"
                  />
                </div>
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Insurance expiry</label>
                  <input
                    type="date"
                    value={newPartner.insurance_expiry}
                    onChange={(e) => setNewPartner({ ...newPartner, insurance_expiry: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-mono font-black"
                  />
                </div>
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Accreditation #</label>
                  <input
                    type="text"
                    value={newPartner.accreditation_number}
                    onChange={(e) => setNewPartner({ ...newPartner, accreditation_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-mono font-black"
                  />
                </div>
                <div>
                  <label className="text-[10px] block uppercase font-black mb-1">Accreditation expiry</label>
                  <input
                    type="date"
                    value={newPartner.accreditation_expiry}
                    onChange={(e) => setNewPartner({ ...newPartner, accreditation_expiry: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-mono font-black"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-700 font-semibold">
                Blank compliance fields stay blank. The partner is then flagged “action required” until you enter the real
                policy details.
              </p>

              {partnerFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold">
                  {partnerFormError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E6D8C3]">
                <button
                  type="button"
                  onClick={() => setIsAddPartnerOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] font-black text-xs shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPartner}
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black flex items-center gap-1.5 shadow-md disabled:opacity-60"
                >
                  {savingPartner ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {savingPartner ? 'Saving…' : 'Save partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ADD VEHICLE ────────────────────────────────────── */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] shadow-sm">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Add fleet vehicle</h3>
                  <p className="text-[11px] text-slate-700 font-semibold">Registered in the database and available to dispatch</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddVehicleOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] hover:bg-[#E6D8C3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Make / brand</label>
                  <select
                    value={newVehicle.make}
                    onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-bold"
                  >
                    {['Mercedes-Benz', 'Audi', 'BMW', 'Genesis', 'Lexus', 'Toyota', 'Rolls-Royce'].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S-Class S580 or V-Class"
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-bold focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Category</label>
                  <select
                    value={newVehicle.category}
                    onChange={(e) => setNewVehicle({ ...newVehicle, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-bold text-[11px]"
                  >
                    {VEHICLE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Plate *</label>
                  <input
                    type="text"
                    required
                    placeholder="1AB2CD"
                    value={newVehicle.registration_plate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, registration_plate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black font-mono focus:outline-none focus:border-[#0A0E1A] uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Year</label>
                  <input
                    type="number"
                    min="2015"
                    max="2030"
                    value={newVehicle.year}
                    onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value, 10) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Max passengers (PAX)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={newVehicle.passenger_capacity}
                    onChange={(e) => setNewVehicle({ ...newVehicle, passenger_capacity: parseInt(e.target.value, 10) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Max luggage (bags)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={newVehicle.luggage_capacity}
                    onChange={(e) => setNewVehicle({ ...newVehicle, luggage_capacity: parseInt(e.target.value, 10) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl font-black font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1.5">Colour finish</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_SHADERS.map((color) => (
                    <div
                      key={color.name}
                      onClick={() => setNewVehicle({ ...newVehicle, color: color.name })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                        newVehicle.color === color.name
                          ? 'border-[#DFCAA8] bg-[#FAF6F0] ring-2 ring-[#DFCAA8]'
                          : 'border-[#E6D8C3] bg-[#FFFFFF] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-slate-400 shrink-0"
                        style={{ backgroundColor: color.colorHex }}
                      />
                      <span className="text-[10px] font-bold truncate">{color.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {vehicleFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold">
                  {vehicleFormError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E6D8C3]">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-slate-800 border border-[#E6D8C3] font-bold text-xs shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVehicle}
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-1.5 shadow-md disabled:opacity-60"
                >
                  {savingVehicle ? (
                    <LoaderCircle className="w-4 h-4 animate-spin text-[#DFCAA8]" />
                  ) : (
                    <Check className="w-4 h-4 text-[#DFCAA8]" />
                  )}
                  {savingVehicle ? 'Saving…' : 'Add vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: COLOUR / PHOTO ─────────────────────────────────── */}
      {editingVehicleImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] shadow-sm shrink-0">
                  <Palette className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black">Change vehicle colour finish</h3>
                  <p className="text-[11px] text-slate-700 font-semibold truncate">
                    {editingVehicleImage.make} {editingVehicleImage.model} ({editingVehicleImage.registration_plate})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingVehicleImage(null)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] hover:bg-[#E6D8C3] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-slate-950 border border-[#DFCAA8] shadow-inner">
              <img
                src={customImageUrlInput || getModelBasePhoto(editingVehicleImage)}
                alt="Preview"
                style={{ filter: selectedColorFilter || 'none' }}
                className="w-full h-full object-cover object-center transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none gap-2">
                <div className="min-w-0">
                  <span className="text-white font-black text-sm drop-shadow-md block truncate">
                    {editingVehicleImage.make} {editingVehicleImage.model}
                  </span>
                  <span className="text-[10px] text-[#DFCAA8] font-mono font-bold">
                    Rego: {editingVehicleImage.registration_plate}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black flex items-center gap-1.5 shadow-md shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full border border-slate-400" style={{ backgroundColor: selectedColorHex }} />
                  {selectedColorName}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-700 uppercase font-bold tracking-wider block">
                Colour finish for {editingVehicleImage.model}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_SHADERS.map((color) => {
                  const isSelected = selectedColorName === color.name;
                  return (
                    <div
                      key={color.name}
                      onClick={() => {
                        setSelectedColorName(color.name);
                        setSelectedColorHex(color.colorHex);
                        setSelectedColorFilter(color.filter);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#DFCAA8] bg-[#FFFFFF] ring-2 ring-[#DFCAA8] shadow-md'
                          : 'border-[#E6D8C3] bg-[#FFFFFF] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full border border-slate-400 shrink-0 shadow-sm"
                        style={{ backgroundColor: color.colorHex }}
                      />
                      <span className={`text-[11px] font-black block truncate flex-1 ${isSelected ? '' : 'text-slate-800'}`}>
                        {color.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-[#E6D8C3]">
              <label className="text-[10px] text-slate-700 uppercase font-bold block mb-1.5">
                Or upload a real photo of this car
              </label>
              <label className="w-full py-2.5 px-3 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm">
                <Upload className="w-4 h-4 text-[#7B6035]" />
                <span>Choose photo from phone / laptop</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
              <p className="text-[10px] text-slate-700 font-semibold mt-1.5">
                The colour name is saved against the vehicle for everyone. The photo is kept in this browser only — other
                staff will still see the stock image.
              </p>
            </div>

            {colorError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold">
                {colorError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E6D8C3]">
              <button
                type="button"
                onClick={() => setEditingVehicleImage(null)}
                className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-slate-800 border border-[#E6D8C3] font-bold text-xs shadow-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveVehicleImage}
                disabled={savingColor}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-1.5 shadow-md disabled:opacity-60"
              >
                {savingColor ? (
                  <LoaderCircle className="w-4 h-4 animate-spin text-[#DFCAA8]" />
                ) : (
                  <Check className="w-4 h-4 text-[#DFCAA8]" />
                )}
                {savingColor ? 'Saving…' : 'Save colour finish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: PARTNER ASSIGNED JOBS ──────────────────────────── */}
      {selectedPartnerForBookings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] shrink-0">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black truncate">{selectedPartnerForBookings.company_name}</h3>
                  <span className="text-xs text-slate-700 font-mono font-bold">
                    {selectedPartnerForBookings.city || 'Region not set'} •{' '}
                    {typeof selectedPartnerForBookings.commission_rate === 'number'
                      ? `${selectedPartnerForBookings.commission_rate}% agreed commission`
                      : 'commission not set'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPartnerForBookings(null)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] hover:bg-[#E6D8C3] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm">
                <span className="text-[10px] text-slate-600 block uppercase font-bold">Jobs assigned</span>
                <span className="text-base font-black font-mono">{selectedPartnerLegs.length}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm">
                <span className="text-[10px] text-slate-600 block uppercase font-bold">Customer fares</span>
                <span className="text-base font-black font-mono">
                  {money(
                    selectedPartnerLegs.reduce((sum, r) => sum + (r.leg.fare_share ?? r.booking.total_fare ?? 0), 0)
                  )}{' '}
                  AUD
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm">
                <span className="text-[10px] text-slate-600 block uppercase font-bold">Partner payouts</span>
                <span className="text-base font-black text-amber-800 font-mono">
                  {money(selectedPartnerLegs.reduce((sum, r) => sum + (r.leg.partner_payout_amount || 0), 0))} AUD
                </span>
              </div>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {selectedPartnerLegs.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] text-center">
                  <p className="text-xs font-black">No jobs have been offloaded to this partner yet.</p>
                  <p className="text-[11px] text-slate-700 font-semibold mt-1">
                    Offer them a leg from the Operate board and it will appear here.
                  </p>
                </div>
              ) : (
                selectedPartnerLegs.map(({ leg, booking }) => {
                  const fare = leg.fare_share ?? booking.total_fare;
                  const payout = leg.partner_payout_amount;
                  const margin = typeof fare === 'number' && typeof payout === 'number' ? fare - payout : null;

                  return (
                    <div key={leg.id} className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 text-xs shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] font-mono font-black text-[11px] border border-[#E6D8C3] shrink-0">
                            {booking.booking_number}
                          </span>
                          <span className="font-black truncate">{booking.passenger_name}</span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            leg.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : leg.status === 'CANCELLED'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                          }`}
                        >
                          {leg.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-slate-700 text-[11px]">
                        <div className="min-w-0">
                          <span className="text-slate-500 block text-[10px] font-bold">PICKUP</span>
                          <strong className="text-[#0A0E1A]">{leg.pickup_address}</strong>
                        </div>
                        <div className="min-w-0">
                          <span className="text-slate-500 block text-[10px] font-bold">DROPOFF</span>
                          <strong className="text-[#0A0E1A]">{leg.dropoff_address}</strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#E6D8C3] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="text-slate-600 font-semibold">{formatDateTime(leg.pickup_datetime)}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-700">
                            Fare: <strong className="text-[#0A0E1A]">{money(fare)}</strong>
                          </span>
                          <span className="text-amber-800 font-black">Payout: {money(payout)}</span>
                          {margin !== null && (
                            <span className={margin < 0 ? 'text-rose-800 font-black' : 'text-emerald-800 font-black'}>
                              Margin: {money(margin)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E6D8C3]">
              <button
                onClick={() => setSelectedPartnerForBookings(null)}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] text-[#FAF6F0] border border-[#DFCAA8] text-xs font-black shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: VEHICLE SCHEDULE ───────────────────────────────── */}
      {selectedVehicleForBookings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] shrink-0">
                  <Car className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black truncate">
                    {selectedVehicleForBookings.make} {selectedVehicleForBookings.model}
                  </h3>
                  <span className="text-xs text-slate-700 font-mono font-bold">
                    Plate: <strong>{selectedVehicleForBookings.registration_plate}</strong> • {selectedVehicleForBookings.year}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicleForBookings(null)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] hover:bg-[#E6D8C3] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex p-1 bg-[#06090F] rounded-xl border border-[#1E2738]">
              <button
                onClick={() => setVehicleBookingsTab('advance')}
                className={`flex-1 py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 ${
                  vehicleBookingsTab === 'advance'
                    ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
                    : 'text-slate-400 hover:text-white font-bold'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Upcoming ({selectedVehicleLegs.advance.length})
              </button>
              <button
                onClick={() => setVehicleBookingsTab('completed')}
                className={`flex-1 py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 ${
                  vehicleBookingsTab === 'completed'
                    ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
                    : 'text-slate-400 hover:text-white font-bold'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed ({selectedVehicleLegs.completed.length})
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {visibleVehicleLegs.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] text-center">
                  <p className="text-xs font-black">
                    {vehicleBookingsTab === 'advance'
                      ? 'No upcoming jobs allocated to this vehicle.'
                      : 'This vehicle has no completed jobs yet.'}
                  </p>
                </div>
              ) : (
                visibleVehicleLegs.map(({ leg, booking }) => (
                  <div key={leg.id} className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 text-xs shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] font-mono font-black text-[11px] border border-[#E6D8C3] shrink-0">
                          {booking.booking_number}
                        </span>
                        <span className="font-black truncate">{booking.passenger_name}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                          leg.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                        }`}
                      >
                        {leg.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-700 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-slate-500 block text-[10px] font-bold">PICKUP POINT</span>
                        <strong className="text-[#0A0E1A]">{leg.pickup_address}</strong>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-500 block text-[10px] font-bold">DESTINATION</span>
                        <strong className="text-[#0A0E1A]">{leg.dropoff_address}</strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E6D8C3] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-cyan-900 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-700" /> {formatDateTime(leg.pickup_datetime)}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600">
                          Chauffeur: <strong className="text-[#0A0E1A]">{leg.driver_name || 'Unassigned'}</strong>
                        </span>
                        <span className="text-amber-800 font-black">{money(leg.fare_share ?? booking.total_fare)} AUD</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E6D8C3]">
              <button
                onClick={() => setSelectedVehicleForBookings(null)}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] text-[#FAF6F0] border border-[#DFCAA8] text-xs font-black shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
