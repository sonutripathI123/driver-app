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
  X,
  Palette
} from 'lucide-react';

interface ExtendedVehicle extends Vehicle {
  image_url?: string;
  color_name?: string;
  color_hex?: string;
  color_filter?: string;
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

interface ColorShader {
  name: string;
  colorHex: string;
  filter: string;
}

// Model-Specific Authentic Base Photos
// Model-Specific Authentic Base Photos (User's Exact 9 Fleet Cars)
const MODEL_AUTHENTIC_BASE_PHOTOS = {
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

// Real-Time Automotive Color Shaders (Applied to the SAME car body!)
const COLOR_SHADERS: ColorShader[] = [
  { name: 'Obsidian Jet Black', colorHex: '#0a0a0a', filter: 'brightness(0.82) contrast(1.3) grayscale(0.25)' },
  { name: 'Polar Diamond White', colorHex: '#f8fafc', filter: 'brightness(1.4) contrast(1.1) grayscale(0.45)' },
  { name: 'Selenite Anthracite Grey', colorHex: '#334155', filter: 'brightness(0.95) contrast(1.25) grayscale(0.95)' },
  { name: 'Iridium Silver Metallic', colorHex: '#cbd5e1', filter: 'brightness(1.2) contrast(1.15) grayscale(0.7)' },
  { name: 'Nautical Navy Blue', colorHex: '#1e3a8a', filter: 'brightness(0.9) contrast(1.2) hue-rotate(185deg) saturate(1.4)' },
  { name: 'Emerald Forest Green', colorHex: '#064e3b', filter: 'brightness(0.88) contrast(1.2) hue-rotate(85deg) saturate(1.3)' },
];

const getModelBasePhoto = (vehicle: ExtendedVehicle | { make: string; model: string; category: string; registration_plate?: string } | null): string => {
  if (!vehicle) return MODEL_AUTHENTIC_BASE_PHOTOS.DEFAULT;
  const plate = (vehicle.registration_plate || '').toUpperCase();
  if (plate.includes('GTS783')) return MODEL_AUTHENTIC_BASE_PHOTOS.S_CLASS_GTS783;
  if (plate.includes('CGL646')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_CGL646;
  if (plate.includes('CPS711')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_CPS711;
  if (plate.includes('2DC7AY')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_2DC7AY;
  if (plate.includes('2DZ8YJ')) return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_2DZ8YJ;
  if (plate.includes('BZZ931')) return MODEL_AUTHENTIC_BASE_PHOTOS.SPRINTER_BZZ931;
  if (plate.includes('BS14OK')) return MODEL_AUTHENTIC_BASE_PHOTOS.SPRINTER_BS14OK;
  if (plate.includes('AMJ506')) return MODEL_AUTHENTIC_BASE_PHOTOS.AUDI_Q7_AMJ506;
  if (plate.includes('0687') || plate.includes('HC')) return MODEL_AUTHENTIC_BASE_PHOTOS.AUDI_Q7_HC0687;
  
  const name = `${vehicle.make} ${vehicle.model} ${vehicle.category}`.toUpperCase();
  if (name.includes('S-CLASS') || name.includes('S450')) return MODEL_AUTHENTIC_BASE_PHOTOS.S_CLASS_GTS783;
  if (name.includes('SPRINTER')) return MODEL_AUTHENTIC_BASE_PHOTOS.SPRINTER_BS14OK;
  if (name.includes('Q7') || name.includes('AUDI')) return MODEL_AUTHENTIC_BASE_PHOTOS.AUDI_Q7_HC0687;
  return MODEL_AUTHENTIC_BASE_PHOTOS.V_CLASS_CPS711;
};

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

  // Vehicle Image & Color Customizer Modal State
  const [editingVehicleImage, setEditingVehicleImage] = useState<ExtendedVehicle | null>(null);
  const [customImageUrlInput, setCustomImageUrlInput] = useState('');
  const [selectedColorName, setSelectedColorName] = useState('Obsidian Jet Black');
  const [selectedColorHex, setSelectedColorHex] = useState('#0a0a0a');
  const [selectedColorFilter, setSelectedColorFilter] = useState('');

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
    image_url: MODEL_AUTHENTIC_BASE_PHOTOS.DEFAULT,
    color_name: 'Obsidian Jet Black',
    color_hex: '#0a0a0a',
    color_filter: COLOR_SHADERS[0].filter,
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

    // User's Exact 9 Fleet Cars with Authentic High-Resolution Photos & Color Shaders
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
        image_url: '/images/fleet/mercedes_s_class_gts783.jpg',
        color_name: 'Obsidian Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-02',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'Valente Mini Van (V-Class)',
        year: 2023,
        registration_plate: 'CGL646',
        passenger_capacity: 7,
        luggage_capacity: 6,
        is_active: true,
        image_url: '/images/fleet/mercedes_vclass_cgl646.jpg',
        color_name: 'Obsidian Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-03',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'V-Class VIP People Mover',
        year: 2024,
        registration_plate: 'CPS711',
        passenger_capacity: 7,
        luggage_capacity: 7,
        is_active: true,
        image_url: '/images/fleet/mercedes_vclass_cps711.jpg',
        color_name: 'Obsidian Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-04',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'V-Class Exclusive Line',
        year: 2024,
        registration_plate: '2DC7AY',
        passenger_capacity: 7,
        luggage_capacity: 7,
        is_active: true,
        image_url: '/images/fleet/mercedes_vclass_2dc7ay.jpg',
        color_name: 'Obsidian Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-05',
        category: 'PEOPLE_MOVER',
        make: 'Mercedes-Benz',
        model: 'V-Class City VIP Van',
        year: 2024,
        registration_plate: '2DZ8YJ',
        passenger_capacity: 7,
        luggage_capacity: 7,
        is_active: true,
        image_url: '/images/fleet/mercedes_vclass_2dz8yj.jpg',
        color_name: 'Obsidian Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-06',
        category: 'MINIBUS' as any,
        make: 'Mercedes-Benz',
        model: 'Sprinter Luxury Minibus',
        year: 2024,
        registration_plate: 'BZZ931',
        passenger_capacity: 11,
        luggage_capacity: 10,
        is_active: true,
        image_url: '/images/fleet/mercedes_sprinter_bzz931.jpg',
        color_name: 'Obsidian Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-07',
        category: 'MINIBUS' as any,
        make: 'Mercedes-Benz',
        model: 'Sprinter Executive Shuttle',
        year: 2024,
        registration_plate: 'BS14OK',
        passenger_capacity: 11,
        luggage_capacity: 12,
        is_active: true,
        image_url: '/images/fleet/mercedes_sprinter_bs14ok.jpg',
        color_name: 'Obsidian Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-08',
        category: 'SUV_PREMIUM',
        make: 'Audi',
        model: 'Q7 Black Edition Quattro',
        year: 2024,
        registration_plate: 'AMJ506',
        passenger_capacity: 4,
        luggage_capacity: 4,
        is_active: true,
        image_url: '/images/fleet/audi_q7_amj506.jpg',
        color_name: 'Mythos Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
      {
        id: 'v-09',
        category: 'SUV_PREMIUM',
        make: 'Audi',
        model: 'Q7 50 TDI Quattro SUV',
        year: 2024,
        registration_plate: 'HC 0687',
        passenger_capacity: 5,
        luggage_capacity: 4,
        is_active: true,
        image_url: '/images/fleet/audi_q7_hc0687.jpg',
        color_name: 'Mythos Jet Black',
        color_hex: '#0a0a0a',
        color_filter: COLOR_SHADERS[0].filter,
      },
    ];

    // Ingest custom stored partners & vehicles
    try {
      const savedPartners = localStorage.getItem('crown_custom_partners');
      if (savedPartners) {
        const parsed = JSON.parse(savedPartners);
        initialPartners = [...initialPartners, ...parsed];
      }

      // Check saved custom image overrides & color shaders
      const savedImages = localStorage.getItem('crown_vehicle_images_v2');
      if (savedImages) {
        const imgMap = JSON.parse(savedImages);
        initialVehicles = initialVehicles.map(v => {
          const custom = imgMap[v.id];
          if (custom) {
            return {
              ...v,
              image_url: custom.url || v.image_url || getModelBasePhoto(v),
              color_name: custom.color_name || v.color_name,
              color_hex: custom.color_hex || v.color_hex,
              color_filter: custom.color_filter !== undefined ? custom.color_filter : v.color_filter,
            };
          }
          return v;
        });
      }
    } catch (e) {
      console.warn('Error loading custom fleet data', e);
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

    const basePhoto = getModelBasePhoto(newVehicle);
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
      image_url: newVehicle.image_url || basePhoto,
      color_name: newVehicle.color_name || 'Obsidian Jet Black',
      color_hex: newVehicle.color_hex || '#0a0a0a',
      color_filter: newVehicle.color_filter || COLOR_SHADERS[0].filter,
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
      image_url: MODEL_AUTHENTIC_BASE_PHOTOS.DEFAULT,
      color_name: 'Obsidian Jet Black',
      color_hex: '#0a0a0a',
      color_filter: COLOR_SHADERS[0].filter,
    });
  };

  // Open Image & Color Editor Modal for Vehicle
  const handleOpenImageEditor = (vehicle: ExtendedVehicle) => {
    setEditingVehicleImage(vehicle);
    setCustomImageUrlInput(vehicle.image_url || getModelBasePhoto(vehicle));
    setSelectedColorName(vehicle.color_name || 'Obsidian Jet Black');
    setSelectedColorHex(vehicle.color_hex || '#0a0a0a');
    setSelectedColorFilter(vehicle.color_filter || COLOR_SHADERS[0].filter);
  };

  // Save Vehicle Image & Color Shader
  const handleSaveVehicleImage = () => {
    if (!editingVehicleImage) return;
    const vId = editingVehicleImage.id;

    const updated = vehicles.map(v =>
      v.id === vId
        ? {
            ...v,
            image_url: customImageUrlInput,
            color_name: selectedColorName,
            color_hex: selectedColorHex,
            color_filter: selectedColorFilter,
          }
        : v
    );
    setVehicles(updated);

    try {
      const existingImgMap = JSON.parse(localStorage.getItem('crown_vehicle_images_v2') || '{}');
      existingImgMap[vId] = {
        url: customImageUrlInput,
        color_name: selectedColorName,
        color_hex: selectedColorHex,
        color_filter: selectedColorFilter,
      };
      localStorage.setItem('crown_vehicle_images_v2', JSON.stringify(existingImgMap));
    } catch (err) {}

    setEditingVehicleImage(null);
  };

  // Direct Device Local Photo Uploader (Gallery / Desktop)
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
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Partner Network & Fleet Management</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono shadow-sm">
              AFFILIATE COMPLIANCE GATES
            </span>
          </div>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            Subcontractor registry with automated insurance verification, luxury vehicle fleet catalog & same-model color customizer.
          </p>
        </div>

        {/* Toolbar & Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Tab Switcher */}
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

          {/* Contextual Add Buttons */}
          {activeTab === 'partners' ? (
            <button
              onClick={() => setIsAddPartnerOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4 text-[#DFCAA8]" /> + Onboard Partner
            </button>
          ) : (
            <button
              onClick={() => setIsAddVehicleOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all"
            >
              <Plus className="w-4 h-4 text-[#DFCAA8]" /> + Add Fleet Vehicle
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
              <div key={p.id} className="glass-panel p-5 rounded-2xl border-[#E6D8C3] space-y-4 text-xs shadow-xl hover:border-[#DFCAA8] transition-all text-[#0A0E1A]">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-black text-[#0A0E1A]">{p.company_name}</h3>
                    <span className="text-[#0A0E1A] font-mono font-bold text-[11px]">ABN: {p.abn || 'Not Provided'}</span>
                  </div>
                  {p.is_compliance_verified ? (
                    <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0A0E1A]" /> Compliant
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#0A0E1A]" /> Action Required
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[#0A0E1A] bg-[#FFFFFF] p-3.5 rounded-xl border border-[#E6D8C3]">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold tracking-wider">Contact Person</span>
                    <span className="font-black text-[#0A0E1A] block">{p.contact_name}</span>
                    <span className="text-[11px] text-[#0A0E1A] flex items-center gap-1 font-mono font-bold">
                      <Phone className="w-3 h-3 text-[#0A0E1A]" /> {p.phone}
                    </span>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold tracking-wider">Region & Terms</span>
                    <span className="font-black text-[#0A0E1A] block">{p.city}</span>
                    <span className="text-[11px] text-[#0A0E1A] font-black font-mono">
                      {p.commission_rate}% Subcontractor Comm.
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[11px] space-y-1 font-mono text-[#0A0E1A]">
                  <div className="flex justify-between">
                    <span className="text-[#0A0E1A] font-bold font-sans">Public Liability Policy:</span>
                    <span className="text-[#0A0E1A] font-black">{p.insurance_policy_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#0A0E1A] font-bold font-sans">Insurance Expiry:</span>
                    <span className="text-[#0A0E1A] font-black">{p.insurance_expiry}</span>
                  </div>
                </div>

                {/* Partner Action Button: View Assigned Bookings */}
                <div className="pt-2 flex items-center justify-between border-t border-[#E6D8C3]">
                  <div className="text-[11px] text-[#0A0E1A] font-bold">
                    Total Comm Earned: <strong className="text-[#0A0E1A] font-mono font-black">${totalCommissionEarned.toFixed(2)} AUD</strong>
                  </div>
                  <button
                    onClick={() => setSelectedPartnerForBookings(p)}
                    className="px-3.5 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5 text-white" /> View Assigned Bookings ({pBookings.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            TAB 2: VEHICLE FLEET CATALOG & SAME-MODEL COLOR FINISHES
        ───────────────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {vehicles.map((v) => {
            const vBookings = getVehicleBookings(v);
            const totalTrips = vBookings.advance.length + vBookings.completed.length;
            const basePhoto = v.image_url || getModelBasePhoto(v);

            return (
              <div key={v.id} className="glass-panel p-5 rounded-2xl border-[#E6D8C3] space-y-3.5 text-xs shadow-xl hover:border-[#DFCAA8] transition-all flex flex-col justify-between text-[#0A0E1A]">
                <div>
                  {/* Vehicle Image Banner with Dynamic Color Filter */}
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

                    {/* Change Color Finish / Photo Button */}
                    <button
                      onClick={() => handleOpenImageEditor(v)}
                      className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] transition-all shadow-md flex items-center gap-1 text-[10px] font-black"
                      title="Change Color Finish / Upload Photo"
                    >
                      <Palette className="w-3 h-3 text-white" />
                      <span>Color</span>
                    </button>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <div>
                        <span className="text-white font-black text-sm tracking-wide drop-shadow-md block">
                          {v.make} {v.model}
                        </span>
                        {v.color_name && (
                          <span className="text-[10px] text-white font-bold drop-shadow flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full border border-slate-700 inline-block" style={{ backgroundColor: v.color_hex || '#0a0a0a' }} />
                            {v.color_name}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] font-bold font-mono">
                        {v.year}
                      </span>
                    </div>
                  </div>

                  {/* Details Header */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[#0A0E1A] font-mono text-xs font-bold">
                      Plate: <strong className="text-[#0A0E1A] text-sm font-black">{v.registration_plate}</strong>
                    </span>
                    <span className="text-[#0A0E1A] text-[11px] font-black flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#0A0E1A] animate-pulse" /> Active Fleet
                    </span>
                  </div>

                  {/* PAX and Luggage Badges */}
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[#0A0E1A] text-center">
                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                      <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold">Passengers</span>
                      <span className="font-black text-sm text-[#0A0E1A] font-mono">{v.passenger_capacity} PAX</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                      <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold">Luggage</span>
                      <span className="font-black text-sm text-[#0A0E1A] font-mono">{v.luggage_capacity} Bags</span>
                    </div>
                  </div>
                </div>

                {/* Vehicle Action Button: View Bookings & Schedule */}
                <div className="pt-2 border-t border-[#E6D8C3]">
                  <button
                    onClick={() => {
                      setSelectedVehicleForBookings(v);
                      setVehicleBookingsTab('advance');
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Calendar className="w-3.5 h-3.5 text-white" /> View Schedule & Bookings ({totalTrips})
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <Users className="w-5 h-5 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">Onboard New Subcontractor Partner</h3>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">Register verified interstate chauffeur network</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPartnerOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#E6D8C3]"
              >
                <X className="w-4 h-4 text-[#0A0E1A]" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Perth Luxury Transfers"
                    value={newPartner.company_name}
                    onChange={(e) => setNewPartner({ ...newPartner, company_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jason Scott"
                    value={newPartner.contact_name}
                    onChange={(e) => setNewPartner({ ...newPartner, contact_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Phone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="+61 400 000 000"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="ops@partner.com.au"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Region / City</label>
                  <select
                    value={newPartner.city}
                    onChange={(e) => setNewPartner({ ...newPartner, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black"
                  >
                    <option value="Sydney" className="text-[#0A0E1A]">Sydney</option>
                    <option value="Brisbane" className="text-[#0A0E1A]">Brisbane</option>
                    <option value="Perth" className="text-[#0A0E1A]">Perth</option>
                    <option value="Adelaide" className="text-[#0A0E1A]">Adelaide</option>
                    <option value="Gold Coast" className="text-[#0A0E1A]">Gold Coast</option>
                    <option value="Canberra" className="text-[#0A0E1A]">Canberra</option>
                    <option value="Melbourne" className="text-[#0A0E1A]">Melbourne</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">ABN Number</label>
                  <input
                    type="text"
                    placeholder="12 345 678 901"
                    value={newPartner.abn}
                    onChange={(e) => setNewPartner({ ...newPartner, abn: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Commission %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newPartner.commission_rate}
                    onChange={(e) => setNewPartner({ ...newPartner, commission_rate: parseFloat(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black font-mono focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Public Liability Policy #</label>
                  <input
                    type="text"
                    placeholder="POL-AU-2026-X"
                    value={newPartner.insurance_policy_number}
                    onChange={(e) => setNewPartner({ ...newPartner, insurance_policy_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-black"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Insurance Expiry</label>
                  <input
                    type="date"
                    value={newPartner.insurance_expiry}
                    onChange={(e) => setNewPartner({ ...newPartner, insurance_expiry: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-black"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E6D8C3]">
                <button
                  type="button"
                  onClick={() => setIsAddPartnerOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] font-black text-xs shadow-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" /> Save Partner Network
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <Car className="w-5 h-5 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">Add Luxury Fleet Vehicle</h3>
                  <p className="text-[11px] text-slate-700 font-semibold">Register new car with custom color finish & seating specs</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddVehicleOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-slate-400 hover:text-[#0A0E1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Make / Brand</label>
                  <select
                    value={newVehicle.make}
                    onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold"
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
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Model Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S-Class S580 or V-Class"
                    value={newVehicle.model}
                    onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Category</label>
                  <select
                    value={newVehicle.category}
                    onChange={(e) => setNewVehicle({ ...newVehicle, category: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold text-[11px]"
                  >
                    <option value="SEDAN_EXECUTIVE">Sedan Executive</option>
                    <option value="SUV_PREMIUM">SUV Premium</option>
                    <option value="PEOPLE_MOVER">People Mover Van</option>
                    <option value="MINIBUS">Minibus</option>
                    <option value="FIRST_CLASS">First Class</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Plate Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="OPAL-09"
                    value={newVehicle.registration_plate}
                    onChange={(e) => setNewVehicle({ ...newVehicle, registration_plate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black font-mono focus:outline-none focus:border-[#0A0E1A] uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Year</label>
                  <input
                    type="number"
                    value={newVehicle.year}
                    onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Max Passengers (PAX)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={newVehicle.passenger_capacity}
                    onChange={(e) => setNewVehicle({ ...newVehicle, passenger_capacity: parseInt(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1">Max Luggage (Bags)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={newVehicle.luggage_capacity}
                    onChange={(e) => setNewVehicle({ ...newVehicle, luggage_capacity: parseInt(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black font-mono"
                  />
                </div>
              </div>

              {/* Color Shader Selector */}
              <div>
                <label className="text-[10px] text-slate-700 block uppercase font-bold mb-1.5">Select Vehicle Color Finish</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_SHADERS.map((color, idx) => (
                    <div
                      key={idx}
                      onClick={() => setNewVehicle({
                        ...newVehicle,
                        color_name: color.name,
                        color_hex: color.colorHex,
                        color_filter: color.filter,
                      })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                        newVehicle.color_name === color.name
                          ? 'border-[#DFCAA8] bg-[#FAF6F0] ring-2 ring-[#DFCAA8]'
                          : 'border-[#E6D8C3] bg-[#FFFFFF] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full border border-slate-400 shrink-0" style={{ backgroundColor: color.colorHex }} />
                      <span className="text-[10px] text-[#0A0E1A] font-bold truncate">{color.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E6D8C3]">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-slate-800 border border-[#E6D8C3] font-bold text-xs shadow-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
                >
                  <Check className="w-4 h-4 text-[#DFCAA8]" /> Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: VEHICLE COLOR SHADER & CUSTOM PHOTO UPLOADER
      ───────────────────────────────────────────────────────────── */}
      {editingVehicleImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <Palette className="w-5 h-5 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">
                    Change Vehicle Color Finish
                  </h3>
                  <p className="text-[11px] text-slate-700 font-semibold">
                    {editingVehicleImage.make} {editingVehicleImage.model} ({editingVehicleImage.registration_plate})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingVehicleImage(null)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-slate-400 hover:text-[#0A0E1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Guaranteed Same-Car Live Preview with Real-Time Color Shader */}
            <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-slate-950 border border-[#DFCAA8] shadow-inner">
              <img
                src={customImageUrlInput || getModelBasePhoto(editingVehicleImage)}
                alt="Preview"
                style={{ filter: selectedColorFilter || 'none' }}
                className="w-full h-full object-cover object-center transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div>
                  <span className="text-white font-black text-sm drop-shadow-md block">
                    {editingVehicleImage.make} {editingVehicleImage.model}
                  </span>
                  <span className="text-[10px] text-[#DFCAA8] font-mono font-bold">
                    Rego: {editingVehicleImage.registration_plate}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black flex items-center gap-1.5 shadow-md">
                  <span className="w-2.5 h-2.5 rounded-full border border-slate-400" style={{ backgroundColor: selectedColorHex }} />
                  {selectedColorName}
                </span>
              </div>
            </div>

            {/* Same-Model Color Swatches (Car Never Changes Model!) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-700 uppercase font-bold tracking-wider">
                  Select Color Finish for {editingVehicleImage.model}:
                </label>
                <span className="text-[10px] text-emerald-800 font-mono font-black">✓ 100% Same Model Silhouette</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {COLOR_SHADERS.map((color, idx) => {
                  const isSelected = selectedColorName === color.name;
                  return (
                    <div
                      key={idx}
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
                      <div className="flex-1 min-w-0">
                        <span className={`text-[11px] font-black block truncate ${isSelected ? 'text-[#0A0E1A]' : 'text-slate-800'}`}>
                          {color.name}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#0A0E1A] shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct Device Photo Upload (Phone Gallery / Desktop) */}
            <div className="pt-2 border-t border-[#E6D8C3]">
              <label className="text-[10px] text-slate-700 uppercase font-bold block mb-1.5">
                Or Upload Real Photo Directly From Device Gallery:
              </label>
              <label className="w-full py-2.5 px-3 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm">
                <Upload className="w-4 h-4 text-[#7B6035]" />
                <span>Choose Photo From Phone / Laptop</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E6D8C3]">
              <button
                type="button"
                onClick={() => setEditingVehicleImage(null)}
                className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-slate-800 border border-[#E6D8C3] font-bold text-xs shadow-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVehicleImage}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
              >
                <Check className="w-4 h-4 text-[#DFCAA8]" /> Save Color Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: PARTNER ASSIGNED BOOKINGS HISTORY
      ───────────────────────────────────────────────────────────── */}
      {selectedPartnerForBookings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A]">
                  <Briefcase className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">{selectedPartnerForBookings.company_name}</h3>
                  <span className="text-xs text-slate-700 font-mono font-bold">
                    {selectedPartnerForBookings.city} Network • {selectedPartnerForBookings.commission_rate}% Agreed Comm.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPartnerForBookings(null)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-slate-400 hover:text-[#0A0E1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm">
                <span className="text-[10px] text-slate-600 block uppercase font-bold">Total Dispatched</span>
                <span className="text-base font-black text-[#0A0E1A] font-mono">
                  {getPartnerBookings(selectedPartnerForBookings).length} Rides
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm">
                <span className="text-[10px] text-slate-600 block uppercase font-bold">Total Turnover</span>
                <span className="text-base font-black text-[#0A0E1A] font-mono">
                  ${getPartnerBookings(selectedPartnerForBookings).reduce((sum, b) => sum + b.fare_amount, 0).toFixed(2)} AUD
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm">
                <span className="text-[10px] text-slate-600 block uppercase font-bold">Net Comm Earned</span>
                <span className="text-base font-black text-amber-800 font-mono">
                  ${getPartnerBookings(selectedPartnerForBookings).reduce((sum, b) => sum + b.commission_amount, 0).toFixed(2)} AUD
                </span>
              </div>
            </div>

            {/* Bookings List */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {getPartnerBookings(selectedPartnerForBookings).map((b) => (
                <div key={b.id} className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] text-[#0A0E1A] font-mono font-black text-[11px] border border-[#E6D8C3]">
                        {b.booking_number}
                      </span>
                      <span className="font-black text-[#0A0E1A]">{b.passenger_name}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        b.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-700 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold">PICKUP</span>
                      <strong className="text-[#0A0E1A]">{b.pickup_location}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold">DROPOFF</span>
                      <strong className="text-[#0A0E1A]">{b.dropoff_location}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E6D8C3] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-600 font-semibold">{b.pickup_datetime}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-700">Fare: <strong className="text-[#0A0E1A]">${b.fare_amount.toFixed(2)}</strong></span>
                      <span className="text-amber-800 font-black">Comm: +${b.commission_amount.toFixed(2)} AUD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E6D8C3]">
              <button
                onClick={() => setSelectedPartnerForBookings(null)}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] text-[#FAF6F0] border border-[#DFCAA8] text-xs font-black shadow-md transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A]">
                  <Car className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">
                    {selectedVehicleForBookings.make} {selectedVehicleForBookings.model}
                  </h3>
                  <span className="text-xs text-slate-700 font-mono font-bold">
                    Plate: <strong className="text-[#0A0E1A]">{selectedVehicleForBookings.registration_plate}</strong> • ({selectedVehicleForBookings.year})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedVehicleForBookings(null)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-slate-400 hover:text-[#0A0E1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher: Advance Bookings vs Completed Trips */}
            <div className="flex p-1 bg-[#06090F] rounded-xl border border-[#1E2738]">
              <button
                onClick={() => setVehicleBookingsTab('advance')}
                className={`flex-1 py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 ${
                  vehicleVehicleBookingsTab === 'advance'
                    ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
                    : 'text-slate-400 hover:text-white font-bold'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Advance Scheduled Bookings ({getVehicleBookings(selectedVehicleForBookings).advance.length})
              </button>
              <button
                onClick={() => setVehicleBookingsTab('completed')}
                className={`flex-1 py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 ${
                  vehicleVehicleBookingsTab === 'completed'
                    ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md'
                    : 'text-slate-400 hover:text-white font-bold'
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
                <div key={trip.id} className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#FAF6F0] text-[#0A0E1A] font-mono font-black text-[11px] border border-[#E6D8C3]">
                        {trip.booking_number}
                      </span>
                      <span className="font-black text-[#0A0E1A]">{trip.passenger_name}</span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        trip.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                      }`}
                    >
                      {trip.status === 'ADVANCE_SCHEDULED' ? '📅 ADVANCE SCHEDULED' : trip.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-700 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold">PICKUP POINT</span>
                      <strong className="text-[#0A0E1A]">{trip.pickup_location}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] font-bold">DESTINATION</span>
                      <strong className="text-[#0A0E1A]">{trip.dropoff_location}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E6D8C3] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-900 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-700" /> {trip.pickup_datetime}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600">Driver: <strong className="text-[#0A0E1A]">{trip.driver_name}</strong></span>
                      <span className="text-amber-800 font-black">${trip.fare_amount.toFixed(2)} AUD</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E6D8C3]">
              <button
                onClick={() => setSelectedVehicleForBookings(null)}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] text-[#FAF6F0] border border-[#DFCAA8] text-xs font-black shadow-md transition-all"
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
