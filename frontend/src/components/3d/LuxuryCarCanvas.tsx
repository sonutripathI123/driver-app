import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Eye, Users, Briefcase } from 'lucide-react';
import { VehicleCategory } from '../../types';

export type FleetCarKey = 'V_CLASS_CPS711' | 'V_CLASS_2DC7AY' | 'SPRINTER_BS14OK' | 'V_CLASS_2DZ8YJ' | 'AUDI_Q7_HC0687';

interface LuxuryCarProps {
  initialKey?: FleetCarKey;
  category?: VehicleCategory | string;
  onVehicleChange?: (carKey: FleetCarKey) => void;
  onCategoryChange?: (cat: VehicleCategory) => void;
  showControls?: boolean;
}

interface VehicleFleetDetail {
  id: FleetCarKey;
  name: string;
  modelFullName: string;
  regoPlate: string;
  category: string;
  pax: number;
  bags: number;
  image: string;
  tagline: string;
  badge: string;
  features: string[];
}

export const LuxuryCarCanvas: React.FC<LuxuryCarProps> = ({
  initialKey = 'V_CLASS_CPS711',
  category,
  onVehicleChange,
  onCategoryChange,
  showControls = true,
}) => {
  const [activeCar, setActiveCar] = useState<FleetCarKey>(() => {
    if (category === 'MINIBUS') return 'SPRINTER_BS14OK';
    if (category === 'SUV_PREMIUM') return 'AUDI_Q7_HC0687';
    if (category === 'PEOPLE_MOVER') return 'V_CLASS_CPS711';
    return initialKey;
  });

  useEffect(() => {
    if (category === 'MINIBUS') setActiveCar('SPRINTER_BS14OK');
    else if (category === 'SUV_PREMIUM') setActiveCar('AUDI_Q7_HC0687');
    else if (category === 'PEOPLE_MOVER') setActiveCar('V_CLASS_CPS711');
  }, [category]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const fleetData: Record<FleetCarKey, VehicleFleetDetail> = {
    V_CLASS_CPS711: {
      id: 'V_CLASS_CPS711',
      name: 'Mercedes-Benz V-Class',
      modelFullName: 'Mercedes-Benz V-Class VIP People Mover',
      regoPlate: 'CPS711',
      category: 'PEOPLE_MOVER',
      pax: 7,
      bags: 7,
      image: '/images/fleet/mercedes_vclass_cps711.jpg',
      tagline: 'VIP Delegations, Family & Corporate Luxury Transfer',
      badge: '7-SEATER LUXURY',
      features: ['Executive Face-to-Face Seating', 'Electric Sliding Doors', 'Extra Large Luggage Capacity', 'Rear Individual AC'],
    },
    V_CLASS_2DC7AY: {
      id: 'V_CLASS_2DC7AY',
      name: 'Mercedes-Benz V-Class (Exclusive)',
      modelFullName: 'Mercedes-Benz V-Class Exclusive Line',
      regoPlate: '2DC7AY',
      category: 'PEOPLE_MOVER',
      pax: 7,
      bags: 7,
      image: '/images/fleet/mercedes_vclass_2dc7ay.jpg',
      tagline: 'First-Class Chauffeur People Mover for VIP Group Transfers',
      badge: '7-SEATER EXCLUSIVE',
      features: ['Nappa Leather Interior', 'Burmester Surround Sound', 'High-Speed Onboard Wi-Fi', 'Tinted Privacy Glass'],
    },
    SPRINTER_BS14OK: {
      id: 'SPRINTER_BS14OK',
      name: 'Mercedes-Benz Sprinter',
      modelFullName: 'Mercedes-Benz Sprinter Executive Group Shuttle',
      regoPlate: 'BS14OK',
      category: 'MINIBUS',
      pax: 11,
      bags: 12,
      image: '/images/fleet/mercedes_sprinter_bs14ok.jpg',
      tagline: 'Executive Group Transport & Winery Charters',
      badge: '11-SEATER SHUTTLE',
      features: ['High Standing Headroom', 'Massive Luggage Capacity', 'Tour Microphone & PA', 'Reclining Comfort Seats'],
    },
    V_CLASS_2DZ8YJ: {
      id: 'V_CLASS_2DZ8YJ',
      name: 'Mercedes-Benz V-Class (Urban)',
      modelFullName: 'Mercedes-Benz V-Class City Chauffeur Edition',
      regoPlate: '2DZ8YJ',
      category: 'PEOPLE_MOVER',
      pax: 7,
      bags: 7,
      image: '/images/fleet/mercedes_vclass_2dz8yj.jpg',
      tagline: 'Premium City & Airport Group Chauffeur Service',
      badge: '7-SEATER VIP',
      features: ['Acoustic Comfort Package', 'Ambient Lighting', 'Luggage Compartment Divider', 'Rear USB Ports'],
    },
    AUDI_Q7_HC0687: {
      id: 'AUDI_Q7_HC0687',
      name: 'Audi Q7 Quattro SUV',
      modelFullName: 'Audi Q7 50 TDI Quattro Black Edition',
      regoPlate: 'HC 0687',
      category: 'SUV_PREMIUM',
      pax: 5,
      bags: 4,
      image: '/images/fleet/audi_q7_hc0687.jpg',
      tagline: 'Luxury Quattro All-Weather VIP Escort & Corporate SUV',
      badge: 'QUATTRO SUV',
      features: ['Quattro All-Wheel Drive', 'Panoramic Glass Roof', 'Adaptive Air Suspension', 'Spacious Executive Boot'],
    },
  };

  const currentVehicle: VehicleFleetDetail = fleetData[activeCar] || fleetData.V_CLASS_CPS711;

  // Interactive 3D Mouse Parallax Tilt Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -10;
    const tiltY = ((x - centerX) / centerX) * 12;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTilt({ x: tiltX, y: tiltY, glareX, glareY });
  };

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 });
  };

  // Touch support for smartphones
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -8;
    const tiltY = ((x - centerX) / centerX) * 10;
    setTilt({ x: tiltX, y: tiltY, glareX: (x / rect.width) * 100, glareY: (y / rect.height) * 100 });
  };

  const handleSelectCar = (key: FleetCarKey) => {
    setActiveCar(key);
    if (onVehicleChange) {
      onVehicleChange(key);
    }
    if (onCategoryChange) {
      const cat = fleetData[key]?.category as VehicleCategory;
      if (cat) onCategoryChange(cat);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setTilt({ x: 0, y: 0, glareX: 50, glareY: 50 })}
      className="relative w-full h-full min-h-[380px] sm:min-h-[430px] rounded-3xl overflow-hidden bg-[#FAF6F0] flex flex-col justify-between select-none shadow-lg border border-[#E6D8C3]"
      style={{ perspective: '1000px' }}
    >
      {/* ─────────────────────────────────────────────────────────────
          3D INTERACTIVE TILT SHOWROOM CANVAS
      ───────────────────────────────────────────────────────────── */}
      <div
        className="relative w-full flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-4 transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.02 : 1})`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Ambient Lighting Studio Aura */}
        <div
          className="absolute inset-0 opacity-70 pointer-events-none transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(223, 202, 168, 0.45) 0%, rgba(250, 246, 240, 0.95) 75%)`,
          }}
        />

        {/* Glowing Beige Showroom Stage Ring */}
        <div className="absolute bottom-6 sm:bottom-8 w-4/5 h-16 rounded-[100%] border-2 border-[#C2A16B] shadow-[0_0_25px_rgba(194,161,107,0.35)] pointer-events-none transform -rotate-X-60 animate-pulse" />

        {/* Real Luxury High-Definition Car Photo */}
        <div className="relative z-10 w-full h-full max-h-[260px] sm:max-h-[300px] flex items-center justify-center">
          <img
            key={currentVehicle.image}
            src={currentVehicle.image}
            alt={currentVehicle.name}
            className="w-full h-full object-cover sm:object-contain rounded-2xl drop-shadow-[0_15px_25px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-300"
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP BADGES OVERLAY
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-xs text-[#0A0E1A] shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#7B6035] animate-spin" style={{ animationDuration: '6s' }} />
          <span className="font-black tracking-wide">3D Showroom</span>
          <span className="px-1.5 py-0.2 rounded bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8] text-[10px] font-mono font-black">
            {currentVehicle.badge}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFFFF] border border-[#E6D8C3] text-xs text-[#0A0E1A] shadow-sm">
          <Eye className="w-3.5 h-3.5 text-[#0A0E1A]" />
          <span className="font-mono font-black text-[#0A0E1A]">Rego: {currentVehicle.regoPlate}</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM VEHICLE INFO & SPECS OVERLAY
      ───────────────────────────────────────────────────────────── */}
      <div className="relative z-20 px-4 pt-2 pb-2 bg-[#FAF6F0] border-t border-[#E6D8C3]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-black text-[#0A0E1A]">{currentVehicle.name}</h4>
              <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] text-[#0A0E1A] font-mono font-black text-[10px] border border-[#DFCAA8]">
                REGO: {currentVehicle.regoPlate}
              </span>
            </div>
            <p className="text-[11px] text-slate-700 font-semibold mt-0.5">{currentVehicle.tagline}</p>
          </div>

          <div className="flex items-center gap-3 bg-[#FFFFFF] border border-[#E6D8C3] px-3 py-1.5 rounded-xl font-mono text-xs shadow-sm">
            <span className="flex items-center gap-1 text-[#0A0E1A] font-black">
              <Users className="w-3.5 h-3.5 text-[#0A0E1A]" /> {currentVehicle.pax} Pax
            </span>
            <span className="text-slate-400">|</span>
            <span className="flex items-center gap-1 text-[#0A0E1A] font-black">
              <Briefcase className="w-3.5 h-3.5 text-[#0A0E1A]" /> {currentVehicle.bags} Bags
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5 REAL CAR SELECTOR TABS
      ───────────────────────────────────────────────────────────── */}
      {showControls && (
        <div className="relative z-20 bg-[#FAF6F0] border-t border-[#E6D8C3] p-2 flex items-center justify-between gap-1.5 overflow-x-auto">
          {([
            { id: 'V_CLASS_CPS711', label: 'V-Class (CPS711)' },
            { id: 'V_CLASS_2DC7AY', label: 'V-Class (2DC7AY)' },
            { id: 'SPRINTER_BS14OK', label: 'Sprinter (BS14OK)' },
            { id: 'V_CLASS_2DZ8YJ', label: 'V-Class (2DZ8YJ)' },
            { id: 'AUDI_Q7_HC0687', label: 'Audi Q7 (HC 0687)' },
          ] as const).map((tab) => {
            const isSelected = activeCar === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectCar(tab.id as FleetCarKey)}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex-1 whitespace-nowrap text-center flex flex-col items-center justify-center shadow-sm active:scale-95 ${
                  isSelected
                    ? 'bg-[#06090F] text-[#FAF6F0] border border-[#DFCAA8] shadow-md scale-100 font-black'
                    : 'bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#E0F2FE] hover:border-[#7DD3FC]'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
