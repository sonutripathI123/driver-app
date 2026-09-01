import React, { useEffect, useState } from 'react';
import { fleetApi, partnersApi } from '../services/api';
import { Driver, Partner, Vehicle } from '../types';
import {
  Users,
  Car,
  ShieldCheck,
  AlertTriangle,
  Plus,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  Image as ImageIcon,
  Upload,
  FileText,
  DollarSign,
  Clock,
  ArrowRight,
  Eye,
  Edit3,
  Sparkles,
  Check,
  X
} from 'lucide-react';

interface ExtendedVehicle extends Vehicle {
  image_url?: string;
}

interface PartnerBooking {
  id: string;
  booking_number: string;
  passenger_name: string;
  passenger_phone: string;
  pickup_datetime: string;
  pickup_location: string;
  dropoff_location: string;
  fare_amount: number;
  commission_amount: number;
  status: 'COMPLETED' | 'CONFIRMED' | 'IN_PROGRESS';
}

interface VehicleBookingHistory {
  id: string;
  booking_number: string;
  passenger_name: string;
  driver_name: string;
  pickup_datetime: string;
  pickup_location: string;
  dropoff_location: string;
  fare_amount: number;
  status: 'COMPLETED' | 'CONFIRMED' | 'ADVANCE_SCHEDULED';
}

const PRESET_VEHICLE_IMAGES = [
  { name: 'Mercedes S-Class Sedan', url: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80' },
  { name: 'Audi Q7 Premium SUV', url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=800&q=80' },
  { name: 'Mercedes V-Class VIP Van', url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80' },
  { name: 'BMW 7 Series Luxury', url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80' },
  { name: 'Genesis G90 Executive', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80' },
];

export const PartnersFleetPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [vehicles, setVehicles] = useState<ExtendedVehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTab, setActiveTab] = useState<'partners' | 'fleet'>('partners');

  // Modals
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [selectedPartnerForBookings, setSelectedPartnerForBookings] = useState<Partner | null>(null);
  const [selectedVehicleForBookings, setSelectedVehicleForBookings] = useState<ExtendedVehicle | null>(null);
  const [vehicleVehicleBookingsTab, setVehicleBookingsTab] = useState<'advance' | 'completed'>('advance');
  const [editingVehicleImage, setEditingVehicleImage] = useState<ExtendedVehicle | null>(null);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');

  // Form states - New Partner
  const [newPartner, setNewPartner] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    abn: '',
    commission_rate: 15.0,
    city: 'Sydney',
    insurance_policy_number: '',
    insurance_expiry: '2027-12-31',
    accreditation_number: '',
  });

  // Form states - New Vehicle
  const [newVehicle, setNewVehicle] = useState({
    make: 'Mercedes-Benz',
    model: '',
    year: 2025,
    category: 'SEDAN_EXECUTIVE',
    registration_plate: '',
    passenger_capacity: 4,
    luggage_capacity: 3,
    image_url: PRESET_VEHICLE_IMAGES[0].url,
  });

  // Load Initial and LocalStorage Data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    let initialPartners: Partner[] = [
      {
        id: 'p-01',
        company_name: 'Silver Service Chauffeurs Sydney',
        contact_name: 'Robert Langdon',
        email: 'dispatch@silverservice.com.au',
        phone: '+61 2 9888 1234',
        abn: '12 345 678 901',
        commission_rate: 15.0,
        city: 'Sydney',
        is_active: true,
        insurance_policy_number: 'POL-NSW-99812',
        insurance_expiry: '2027-04-15',
        accreditation_number: 'ACC-NSW-2026',
        is_compliance_verified: true,
      },
      {
        id: 'p-02',
        company_name: 'Brisbane Prestige Limousines',
        contact_name: 'Claire Redfield',
        email: 'ops@brisbaneprestige.com.au',
        phone: '+61 7 3222 5555',
        abn: '98 765 432 109',
        commission_rate: 18.0,
        city: 'Brisbane',
        is_active: true,
        insurance_policy_number: 'POL-QLD-55410',
        insurance_expiry: '2026-11-30',
        accreditation_number: 'ACC-QLD-8891',
        is_compliance_verified: true,
      },
    ];

    let initialVehicles: ExtendedVehicle[] = [
      {
        id: 'v-01',
        category: 'FIRST_CLASS' as any,
        make: 'Mercedes-Benz',
        model: 'S-Class S450 LWB',
        year: 2024,
        registration_plate: 'GTS783',
        passenger_capacity: 4,
        luggage_capacity: 3,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-02',
        category: 'SEDAN_EXECUTIVE',
        make: 'Mercedes-Benz',
        model: 'E-Class E300',
        year: 2024,
        registration_plate: 'BYY499',
        passenger_capacity: 4,
        luggage_capacity: 3,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-03',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'Valente Mini Van',
        year: 2023,
        registration_plate: 'CGL646',
        passenger_capacity: 7,
        luggage_capacity: 6,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-04',
        category: 'MINIBUS' as any,
        make: 'Mercedes-Benz',
        model: 'Sprinter Luxury Minibus',
        year: 2024,
        registration_plate: 'BZZ931',
        passenger_capacity: 11,
        luggage_capacity: 10,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-05',
        category: 'SUV_PREMIUM',
        make: 'Audi',
        model: 'Q7 Quattro',
        year: 2024,
        registration_plate: 'AMJ506',
        passenger_capacity: 4,
        luggage_capacity: 4,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-06',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'V-Class V300 (Black)',
        year: 2024,
        registration_plate: 'CPS711',
        passenger_capacity: 7,
        luggage_capacity: 7,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-07',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'V-Class V300 (Black Exclusive)',
        year: 2025,
        registration_plate: '2DC7AY',
        passenger_capacity: 7,
        luggage_capacity: 7,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-08',
        category: 'MINIBUS' as any,
        make: 'Mercedes-Benz',
        model: 'Sprinter Executive 12-Seater (Black)',
        year: 2024,
        registration_plate: 'BS14OK',
        passenger_capacity: 12,
        luggage_capacity: 12,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-09',
        category: 'SUV_PREMIUM',
        make: 'Audi',
        model: 'Q7 Black Edition Quattro',
        year: 2024,
        registration_plate: 'HC 0687',
        passenger_capacity: 4,
        luggage_capacity: 4,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=800&q=80',
      },
      {
        id: 'v-10',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'V-Class Executive Van',
        year: 2024,
        registration_plate: '2DZ8YJ',
        passenger_capacity: 7,
        luggage_capacity: 7,
        is_active: true,
        image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
      },
    ];

    // Ingest custom stored partners & vehicles
    try {
      const savedPartners = localStorage.getItem('crown_custom_partners');
      if (savedPartners) {
        const parsed = JSON.parse(savedPartners);
        initialPartners = [...initialPartners, ...parsed];
      }

      const savedVehicles = localStorage.getItem('crown_custom_vehicles');
      if (savedVehicles) {
        const parsedV = JSON.parse(savedVehicles);
        initialVehicles = [...initialVehicles, ...parsedV];
      }

      // Check saved custom image overrides
      const savedImages = localStorage.getItem('crown_vehicle_images');
      if (savedImages) {
        const imgMap = JSON.parse(savedImages);
        initialVehicles = initialVehicles.map(v => ({
          ...v,
          image_url: imgMap[v.id] || v.image_url || PRESET_VEHICLE_IMAGES[0].url
        }));
      }
    } catch (e) {
      console.error(e);
    }

    setPartners(initialPartners);
    setVehicles(initialVehicles);
  };

  // Add Partner Handler
  const handleCreatePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartner.company_name || !newPartner.contact_name) return;

    const created: Partner = {
      id: `p-${Date.now()}`,
      company_name: newPartner.company_name,
      contact_name: newPartner.contact_name,
      email: newPartner.email || 'dispatch@partner.com.au',
      phone: newPartner.phone || '+61 2 9000 0000',
      abn: newPartner.abn || '11 222 333 444',
      commission_rate: Number(newPartner.commission_rate) || 15.0,
      city: newPartner.city,
      is_active: true,
      insurance_policy_number: newPartner.insurance_policy_number || `POL-${newPartner.city.slice(0, 3).toUpperCase()}-7721`,
      insurance_expiry: newPartner.insurance_expiry || '2027-12-31',
      accreditation_number: newPartner.accreditation_number || `ACC-${newPartner.city.slice(0, 3).toUpperCase()}-2026`,
      is_compliance_verified: true,
    };

    const updated = [...partners, created];
    setPartners(updated);

    // Save custom partners to localStorage
    try {
      const existingCustom = JSON.parse(localStorage.getItem('crown_custom_partners') || '[]');
      localStorage.setItem('crown_custom_partners', JSON.stringify([...existingCustom, created]));
    } catch (err) {}

    setIsAddPartnerOpen(false);
    setNewPartner({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      abn: '',
      commission_rate: 15.0,
      city: 'Sydney',
      insurance_policy_number: '',
      insurance_expiry: '2027-12-31',
      accreditation_number: '',
    });
  };

  // Add Vehicle Handler
  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.model || !newVehicle.registration_plate) return;

    const created: ExtendedVehicle = {
      id: `v-${Date.now()}`,
      category: newVehicle.category as any,
      make: newVehicle.make,
      model: newVehicle.model,
      year: Number(newVehicle.year) || 2025,
      registration_plate: newVehicle.registration_plate.toUpperCase(),
      passenger_capacity: Number(newVehicle.passenger_capacity) || 4,
      luggage_capacity: Number(newVehicle.luggage_capacity) || 3,
      is_active: true,
      image_url: newVehicle.image_url || PRESET_VEHICLE_IMAGES[0].url,
    };

    const updated = [...vehicles, created];
    setVehicles(updated);

    try {
      const existingCustomV = JSON.parse(localStorage.getItem('crown_custom_vehicles') || '[]');
      localStorage.setItem('crown_custom_vehicles', JSON.stringify([...existingCustomV, created]));
    } catch (err) {}

    setIsAddVehicleOpen(false);
    setNewVehicle({
      make: 'Mercedes-Benz',
      model: '',
      year: 2025,
      category: 'SEDAN_EXECUTIVE',
      registration_plate: '',
      passenger_capacity: 4,
      luggage_capacity: 3,
      image_url: PRESET_VEHICLE_IMAGES[0].url,
    });
  };

  // Change Image Handler
  const handleSaveVehicleImage = () => {
    if (!editingVehicleImage || !customImageUrlInput) return;
    const vId = editingVehicleImage.id;

    const updated = vehicles.map(v => v.id === vId ? { ...v, image_url: customImageUrlInput } : v);
    setVehicles(updated);

    try {
      const existingImgMap = JSON.parse(localStorage.getItem('crown_vehicle_images') || '{}');
      existingImgMap[vId] = customImageUrlInput;
      localStorage.setItem('crown_vehicle_images', JSON.stringify(existingImgMap));
    } catch (err) {}

    setEditingVehicleImage(null);
    setCustomImageUrlInput('');
  };

  // Mock Bookings for Partner Modal
  const getPartnerBookings = (partner: Partner): PartnerBooking[] => {
    const city = partner.city || 'Sydney';
    const commRate = partner.commission_rate ?? 15.0;
    const cityCode = city.slice(0, 3).toUpperCase();

    return [
      {
        id: 'pb-01',
        booking_number: `CRW-${cityCode}-901`,
        passenger_name: 'David Sterling (Managing Director)',
        passenger_phone: '+61 412 889 001',
        pickup_datetime: 'Today at 02:30 PM AEST',
        pickup_location: `${city} Kingsford / Domestic T1`,
        dropoff_location: `${city} CBD Premium Tower`,
        fare_amount: 280.0,
        commission_amount: Number(((280.0 * commRate) / 100).toFixed(2)),
        status: 'CONFIRMED',
      },
      {
        id: 'pb-02',
        booking_number: `CRW-${cityCode}-844`,
        passenger_name: 'Eleanor Vance (Goldman Sachs)',
        passenger_phone: '+61 498 221 445',
        pickup_datetime: 'Yesterday at 06:15 PM AEST',
        pickup_location: `Crown Towers ${city}`,
        dropoff_location: `${city} International Terminal`,
        fare_amount: 195.0,
        commission_amount: Number(((195.0 * commRate) / 100).toFixed(2)),
        status: 'COMPLETED',
      },
      {
        id: 'pb-03',
        booking_number: `CRW-${cityCode}-720`,
        passenger_name: 'Marcus Brody (CEO)',
        passenger_phone: '+61 400 334 119',
        pickup_datetime: '28 Aug 2026, 09:00 AM AEST',
        pickup_location: `${city} Financial District`,
        dropoff_location: `Private Air Hangar ${city}`,
        fare_amount: 340.0,
        commission_amount: Number(((340.0 * commRate) / 100).toFixed(2)),
        status: 'COMPLETED',
      },
    ];
  };

  // Mock Bookings for Vehicle Modal
  const getVehicleBookings = (vehicle: ExtendedVehicle) => {
    const advance: VehicleBookingHistory[] = [
      {
        id: 'vb-adv-1',
        booking_number: 'CRW-ADV-108',
        passenger_name: 'Sahil Tripathi',
        driver_name: 'Sonu Tripathi',
        pickup_datetime: 'Tomorrow at 09:30 AM AEST',
        pickup_location: 'Melbourne Airport Terminal 1 Domestic',
        dropoff_location: 'Grand Hyatt Melbourne (123 Collins St)',
        fare_amount: 145.0,
        status: 'ADVANCE_SCHEDULED',
      },
      {
        id: 'vb-adv-2',
        booking_number: 'CRW-ADV-114',
        passenger_name: 'Alexander Crown (VIP)',
        driver_name: 'Marcus Vance',
        pickup_datetime: '03 Sept 2026, 04:00 PM AEST',
        pickup_location: 'Crown Towers Southbank',
        dropoff_location: 'Essendon Fields Jet Base',
        fare_amount: 220.0,
        status: 'CONFIRMED',
      },
    ];

    const completed: VehicleBookingHistory[] = [
      {
        id: 'vb-comp-1',
        booking_number: 'CRW-MEL-992',
        passenger_name: 'Victoria Cross',
        driver_name: 'Sonu Tripathi',
        pickup_datetime: 'Today at 08:15 AM AEST',
        pickup_location: 'Melbourne Airport T2 International',
        dropoff_location: 'St Kilda Road Executive Suites',
        fare_amount: 165.0,
        status: 'COMPLETED',
      },
      {
        id: 'vb-comp-2',
        booking_number: 'CRW-MEL-940',
        passenger_name: 'Michael Chang',
        driver_name: 'Sonu Tripathi',
        pickup_datetime: 'Yesterday at 05:45 PM AEST',
        pickup_location: 'Collins Square, Docklands',
        dropoff_location: 'Tullamarine Airport T1',
        fare_amount: 140.0,
        status: 'COMPLETED',
      },
      {
        id: 'vb-comp-3',
        booking_number: 'CRW-MEL-880',
        passenger_name: 'Sarah Jenkins',
        driver_name: 'Leo Thorne',
        pickup_datetime: '29 Aug 2026, 11:30 AM AEST',
        pickup_location: 'Park Hyatt East Melbourne',
        dropoff_location: 'Yarra Valley Winery Tour',
        fare_amount: 480.0,
        status: 'COMPLETED',
      },
    ];

    return { advance, completed };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Partner Network & Fleet Management</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold font-mono">
              AFFILIATE COMPLIANCE GATES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Subcontractor registry with automated insurance verification, vehicle fleet catalog, manual image management & booking history.
          </p>
        </div>

        {/* Toolbar & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('partners')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'partners'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Subcontractor Partners ({partners.length})
            </button>
            <button
              onClick={() => setActiveTab('fleet')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'fleet'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vehicle Fleet ({vehicles.length})
            </button>
          </div>

          {/* Contextual Add Buttons */}
          {activeTab === 'partners' ? (
            <button
              onClick={() => setIsAddPartnerOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Plus className="w-4 h-4" /> + Onboard Partner
            </button>
          ) : (
            <button
              onClick={() => setIsAddVehicleOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" /> + Add Fleet Vehicle
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: SUBCONTRACTOR PARTNERS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'partners' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {partners.map((p) => {
            const pBookings = getPartnerBookings(p);
            const totalCommissionEarned = pBookings.reduce((sum, b) => sum + b.commission_amount, 0);

            return (
              <div key={p.id} className="glass-panel p-5 rounded-2xl border-slate-800 space-y-4 text-xs shadow-xl hover:border-slate-700 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-100">{p.company_name}</h3>
                    <span className="text-slate-400 font-mono text-[11px]">ABN: {p.abn || 'Not Provided'}</span>
                  </div>
                  {p.is_compliance_verified ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" /> Compliant
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      <AlertTriangle className="w-3.5 h-3.5" /> Action Required
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Contact Person</span>
                    <span className="font-bold text-slate-200 block">{p.contact_name}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-cyan-400" /> {p.phone}
                    </span>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Region & Terms</span>
                    <span className="font-bold text-cyan-300 block">{p.city}</span>
                    <span className="text-[11px] text-amber-400 font-bold font-mono">
                      {p.commission_rate}% Subcontractor Comm.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Public Liability Policy:</span>
                    <span className="text-slate-200">{p.insurance_policy_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Insurance Expiry:</span>
                    <span className="text-emerald-400 font-bold">{p.insurance_expiry}</span>
                  </div>
                </div>

                {/* Partner Action Button: View Assigned Bookings */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                  <div className="text-[11px] text-slate-400">
                    Total Comm Earned: <strong className="text-amber-400 font-mono">${totalCommissionEarned.toFixed(2)} AUD</strong>
                  </div>
                  <button
                    onClick={() => setSelectedPartnerForBookings(p)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-200 hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-amber-400" /> View Assigned Bookings ({pBookings.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            TAB 2: VEHICLE FLEET CATALOG & IMAGES
        ───────────────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {vehicles.map((v) => {
            const vBookings = getVehicleBookings(v);
            const totalTrips = vBookings.advance.length + vBookings.completed.length;

            return (
              <div key={v.id} className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3.5 text-xs shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">
                <div>
                  {/* Vehicle Image Banner with Edit Button */}
                  <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group">
                    <img
                      src={v.image_url || PRESET_VEHICLE_IMAGES[0].url}
                      alt={`${v.make} ${v.model}`}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-500/30">
                      {v.category}
                    </span>

                    <button
                      onClick={() => {
                        setEditingVehicleImage(v);
                        setCustomImageUrlInput(v.image_url || '');
                      }}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-950/80 hover:bg-amber-500 text-slate-300 hover:text-slate-950 border border-slate-700 backdrop-blur-md transition-all shadow-md"
                      title="Change / Upload Vehicle Image"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="text-white font-black text-sm tracking-wide drop-shadow-md">
                        {v.make} {v.model}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold font-mono">
                        {v.year}
                      </span>
                    </div>
                  </div>

                  {/* Details Header */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-400 font-mono text-xs">
                      Plate: <strong className="text-amber-400 text-sm font-black">{v.registration_plate}</strong>
                    </span>
                    <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active Fleet
                    </span>
                  </div>

                  {/* PAX and Luggage Badges */}
                  <div className="grid grid-cols-2 gap-2 pt-2 text-slate-300 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Passengers</span>
                      <span className="font-black text-sm text-cyan-300 font-mono">{v.passenger_capacity} PAX</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Luggage</span>
                      <span className="font-black text-sm text-amber-300 font-mono">{v.luggage_capacity} Bags</span>
                    </div>
                  </div>
                </div>

                {/* Vehicle Action Button: View Bookings & Schedule */}
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setSelectedVehicleForBookings(v);
                      setVehicleBookingsTab('advance');
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-cyan-500/20 hover:to-blue-500/20 border border-slate-700 hover:border-cyan-400/50 text-slate-200 hover:text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" /> View Schedule & Bookings ({totalTrips})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: ONBOARD NEW SUBCONTRACTOR PARTNER
      ───────────────────────────────────────────────────────────── */}
      {isAddPartnerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl border border-slate-700 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">Onboard New Subcontractor Partner</h3>
                  <p className="text-[11px] text-slate-400">Register verified interstate chauffeur network</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPartnerOpen(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Perth Luxury Transfers"
                    value={newPartner.company_name}
                    onChange={(e) => setNewPartner({ ...newPartner, company_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jason Scott"
                    value={newPartner.contact_name}
                    onChange={(e) => setNewPartner({ ...newPartner, contact_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Phone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="+61 400 000 000"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="ops@partner.com.au"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Region / City</label>
                  <select
                    value={newPartner.city}
                    onChange={(e) => setNewPartner({ ...newPartner, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold"
                  >
                    <option value="Sydney">Sydney</option>
                    <option value="Brisbane">Brisbane</option>
                    <option value="Perth">Perth</option>
                    <option value="Adelaide">Adelaide</option>
                    <option value="Gold Coast">Gold Coast</option>
                    <option value="Canberra">Canberra</option>
                    <option value="Melbourne">Melbourne</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">ABN Number</label>
                  <input
                    type="text"
                    placeholder="12 345 678 901"
                    value={newPartner.abn}
                    onChange={(e) => setNewPartner({ ...newPartner, abn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Commission %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPartner.commission_rate}
                    onChange={(e) => setNewPartner({ ...newPartner, commission_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-bold font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Public Liability Policy #</label>
                  <input
                    type="text"
                    placeholder="POL-AU-2026-X"
                    value={newPartner.insurance_policy_number}
                    onChange={(e) => setNewPartner({ ...newPartner, insurance_policy_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Insurance Expiry</label>
                  <input
                    type="date"
                    value={newPartner.insurance_expiry}
                    onChange={(e) => setNewPartner({ ...newPartner, insurance_expiry: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPartnerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 font-bold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Check className="w-4 h-4" /> Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: ADD NEW VEHICLE TO FLEET
      ───────────────────────────────────────────────────────────── */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl border border-slate-700 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">Add Luxury Fleet Vehicle</h3>
                  <p className="text-[11px] text-slate-400">Register new car with custom photo & seating specs</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddVehicleOpen(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Make / Brand</label>
                  <select
                    value={newVehicle.make}
                    onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold"
                  >
                    <option value="Mercedes-Benz">Mercedes-Benz</option>
                    <option value="Audi">Audi</option>
                    <option value="BMW">BMW</option>
                    <option value="Genesis">Genesis</option>
                    <option value="Lexus">Lexus</option>
                    <option value="Rolls-Royce">Rolls-Royce</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Model Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S-Class S580 or Q8"
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Category</label>
                  <select
                    value={newVehicle.category}
                    onChange={(e) => setNewVehicle({ ...newVehicle, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold text-[11px]"
                  >
                    <option value="SEDAN_EXECUTIVE">Sedan Executive</option>
                    <option value="SUV_PREMIUM">SUV Premium</option>
                    <option value="PEOPLE_MOVER">People Mover Van</option>
                    <option value="FIRST_CLASS">First Class</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Plate Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="CROWN-09"
                    value={newVehicle.registration_plate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, registration_plate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-black font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Year</label>
                  <input
                    type="number"
                    value={newVehicle.year}
                    onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Max Passengers (PAX)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={newVehicle.passenger_capacity}
                    onChange={(e) => setNewVehicle({ ...newVehicle, passenger_capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 font-black font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Max Luggage (Bags)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={newVehicle.luggage_capacity}
                    onChange={(e) => setNewVehicle({ ...newVehicle, luggage_capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-black font-mono"
                  />
                </div>
              </div>

              {/* Photo Presets & URL */}
              <div>
                <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Select Preset Photo or Enter Image URL</label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {PRESET_VEHICLE_IMAGES.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setNewVehicle({ ...newVehicle, image_url: img.url })}
                      className={`relative h-14 rounded-lg overflow-hidden border cursor-pointer transition-all ${
                        newVehicle.image_url === img.url
                          ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <input
                  type="url"
                  placeholder="Or paste custom image URL (https://...)"
                  value={newVehicle.image_url}
                  onChange={(e) => setNewVehicle({ ...newVehicle, image_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-[11px] font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 font-bold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                >
                  <Check className="w-4 h-4" /> Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: CHANGE / UPLOAD VEHICLE IMAGE
      ───────────────────────────────────────────────────────────── */}
      {editingVehicleImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl border border-slate-700 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">Update Vehicle Image</h3>
                  <p className="text-[11px] text-slate-400">
                    {editingVehicleImage.make} {editingVehicleImage.model} ({editingVehicleImage.registration_plate})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingVehicleImage(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Preview */}
            <div className="w-full h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              <img
                src={customImageUrlInput || PRESET_VEHICLE_IMAGES[0].url}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Preset Options */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 uppercase font-bold block">Choose from High-Res Presets</label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_VEHICLE_IMAGES.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCustomImageUrlInput(img.url)}
                    className={`h-12 rounded-lg overflow-hidden border cursor-pointer transition-all ${
                      customImageUrlInput === img.url
                        ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                        : 'border-slate-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Custom URL Input */}
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Or Enter Custom Image URL</label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={customImageUrlInput}
                onChange={(e) => setCustomImageUrlInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingVehicleImage(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 font-bold hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVehicleImage}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Check className="w-4 h-4" /> Save New Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: PARTNER ASSIGNED BOOKINGS HISTORY
      ───────────────────────────────────────────────────────────── */}
      {selectedPartnerForBookings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl border border-slate-700 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">{selectedPartnerForBookings.company_name}</h3>
                  <span className="text-xs text-amber-400 font-mono">
                    {selectedPartnerForBookings.city} Network • {selectedPartnerForBookings.commission_rate}% Agreed Comm.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPartnerForBookings(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Dispatched</span>
                <span className="text-base font-black text-slate-100 font-mono">
                  {getPartnerBookings(selectedPartnerForBookings).length} Rides
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Turnover</span>
                <span className="text-base font-black text-cyan-300 font-mono">
                  ${getPartnerBookings(selectedPartnerForBookings).reduce((sum, b) => sum + b.fare_amount, 0).toFixed(2)} AUD
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Net Comm Earned</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  ${getPartnerBookings(selectedPartnerForBookings).reduce((sum, b) => sum + b.commission_amount, 0).toFixed(2)} AUD
                </span>
              </div>
            </div>

            {/* Bookings List */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {getPartnerBookings(selectedPartnerForBookings).map((b) => (
                <div key={b.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono font-bold text-[11px] border border-slate-700">
                        {b.booking_number}
                      </span>
                      <span className="font-bold text-slate-200">{b.passenger_name}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        b.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">PICKUP</span>
                      <strong className="text-slate-300">{b.pickup_location}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">DROPOFF</span>
                      <strong className="text-slate-300">{b.dropoff_location}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">{b.pickup_datetime}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-300">Fare: <strong>${b.fare_amount.toFixed(2)}</strong></span>
                      <span className="text-amber-400 font-bold">Comm: +${b.commission_amount.toFixed(2)} AUD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedPartnerForBookings(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 5: VEHICLE ADVANCE BOOKINGS & COMPLETED TRIPS
      ───────────────────────────────────────────────────────────── */}
      {selectedVehicleForBookings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-panel p-6 rounded-3xl border border-slate-700 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">
                    {selectedVehicleForBookings.make} {selectedVehicleForBookings.model}
                  </h3>
                  <span className="text-xs text-amber-400 font-mono">
                    Plate: <strong className="text-amber-300">{selectedVehicleForBookings.registration_plate}</strong> • ({selectedVehicleForBookings.year})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicleForBookings(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher: Advance Bookings vs Completed Trips */}
            <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setVehicleBookingsTab('advance')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  vehicleVehicleBookingsTab === 'advance'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Advance Scheduled Bookings ({getVehicleBookings(selectedVehicleForBookings).advance.length})
              </button>
              <button
                onClick={() => setVehicleBookingsTab('completed')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  vehicleVehicleBookingsTab === 'completed'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Completed Trips ({getVehicleBookings(selectedVehicleForBookings).completed.length})
              </button>
            </div>

            {/* Bookings List */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {(vehicleVehicleBookingsTab === 'advance'
                ? getVehicleBookings(selectedVehicleForBookings).advance
                : getVehicleBookings(selectedVehicleForBookings).completed
              ).map((trip) => (
                <div key={trip.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-slate-900 text-slate-300 font-mono font-bold text-[11px] border border-slate-700">
                        {trip.booking_number}
                      </span>
                      <span className="font-bold text-slate-200">{trip.passenger_name}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        trip.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {trip.status === 'ADVANCE_SCHEDULED' ? '📅 ADVANCE SCHEDULED' : trip.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">PICKUP POINT</span>
                      <strong className="text-slate-300">{trip.pickup_location}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">DESTINATION</span>
                      <strong className="text-slate-300">{trip.dropoff_location}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-300 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" /> {trip.pickup_datetime}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">Driver: <strong className="text-slate-200">{trip.driver_name}</strong></span>
                      <span className="text-amber-400 font-bold">${trip.fare_amount.toFixed(2)} AUD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedVehicleForBookings(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white text-xs font-bold"
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
