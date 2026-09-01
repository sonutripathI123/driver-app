import React, { useState, useRef, useEffect } from 'react';
import { VehicleCategory } from '../../types';
import { Sparkles, Eye, Users, Briefcase, Car } from 'lucide-react';

interface LuxuryCarProps {
  category?: VehicleCategory;
  onCategoryChange?: (cat: VehicleCategory) => void;
  showControls?: boolean;
}

interface VehicleFleetDetail {
  category: VehicleCategory;
  name: string;
  modelFullName: string;
  regoPlate: string;
  pax: number;
  bags: number;
  image: string;
  tagline: string;
  badge: string;
  features: string[];
}

export const LuxuryCarCanvas: React.FC<LuxuryCarProps> = ({
  category = 'SEDAN_PREMIUM',
  onCategoryChange,
  showControls = true,
}) => {
  const [activeCategory, setActiveCategory] = useState<VehicleCategory>(category);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, glareX: 50, glareY: 50 });
  const [isHovered, setIsHovered] = useState(false);

  // Sync state if category prop changes externally
  useEffect(() => {
    setActiveCategory(category);
  }, [category]);

  const fleetData: Record<VehicleCategory, VehicleFleetDetail> = {
    SEDAN_PREMIUM: {
      category: 'SEDAN_PREMIUM',
      name: 'Mercedes-Benz S-Class LWB',
      modelFullName: 'Mercedes S-Class S450 Long Wheelbase',
      regoPlate: 'GTS783',
      pax: 4,
      bags: 3,
      image: '/images/fleet/mercedes_s_class_gts783.jpg',
      tagline: 'Flagship VIP First-Class Chauffeur Transport',
      badge: 'FIRST CLASS VIP',
      features: ['Reclining Nappa Leather', 'Burmester 3D Sound', 'Complimentary Fiji Water', 'Active Air Suspension'],
    },
    SEDAN_EXECUTIVE: {
      category: 'SEDAN_EXECUTIVE',
      name: 'Mercedes-Benz E-Class Executive',
      modelFullName: 'Mercedes-Benz E-Class AMG Line',
      regoPlate: 'BYY499',
      pax: 4,
      bags: 2,
      image: '/images/fleet/mercedes_s_class_gts783.jpg',
      tagline: 'Executive Corporate Transfer & Airport Express',
      badge: 'EXECUTIVE CORPORATE',
      features: ['Dual Zone Climate', 'High-Speed Wi-Fi', 'Silent Acoustic Cabin', 'Express Airport Route'],
    },
    PEOPLE_MOVER: {
      category: 'PEOPLE_MOVER',
      name: 'Mercedes-Benz Mini Van (V-Class)',
      modelFullName: 'Mercedes-Benz V-Class VIP People Mover',
      regoPlate: 'CGL646',
      pax: 7,
      bags: 7,
      image: '/images/fleet/mercedes_vclass_cgl646.jpg',
      tagline: 'VIP Delegations, Family & Group Luxury Transfer',
      badge: '7-SEATER LUXURY',
      features: ['Conference Seating Mode', 'Electric Sliding Doors', 'Extra Large Luggage Bay', 'Rear AC Controls'],
    },
    MINIBUS: {
      category: 'MINIBUS',
      name: 'Mercedes-Benz Sprinter Shuttle',
      modelFullName: 'Mercedes Sprinter Executive Luxury Shuttle',
      regoPlate: 'BS14OK',
      pax: 11,
      bags: 12,
      image: '/images/fleet/mercedes_sprinter_bs14ok.jpg',
      tagline: 'Executive Group Transport & Winery Charters',
      badge: '11-SEATER SHUTTLE',
      features: ['Standing Headroom', 'High-Capacity Luggage Pod', 'Tour Microphone & PA', 'Reclining Armrest Seats'],
    },
    SUV_PREMIUM: {
      category: 'SUV_PREMIUM',
      name: 'Audi Q7 Black Edition',
      modelFullName: 'Audi Q7 50 TDI Quattro Black Edition',
      regoPlate: 'AMJ506',
      pax: 4,
      bags: 4,
      image: '/images/fleet/audi_q7_amj506.jpg',
      tagline: 'Luxury Quattro All-Weather VIP Escort',
      badge: 'LUXURY QUATTRO SUV',
      features: ['Quattro All-Wheel Drive', 'Panoramic Sunroof', 'Air Suspension Comfort', 'Extended Boot Space'],
    },
  };

  const currentVehicle = fleetData[activeCategory] || fleetData.SEDAN_PREMIUM;

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

  const handleSelectCategory = (cat: VehicleCategory) => {
    setActiveCategory(cat);
    if (onCategoryChange) {
      onCategoryChange(cat);
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
      className="relative w-full h-full min-h-[380px] sm:min-h-[430px] rounded-3xl overflow-hidden bg-white flex flex-col justify-between select-none shadow-sm border border-slate-200"
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
          className="absolute inset-0 opacity-60 pointer-events-none transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(223, 202, 168, 0.35) 0%, rgba(248, 250, 252, 0.95) 75%)`,
          }}
        />

        {/* Glowing Beige Showroom Stage Ring */}
        <div className="absolute bottom-6 sm:bottom-8 w-4/5 h-16 rounded-[100%] border-2 border-[#C2A16B]/50 shadow-[0_0_25px_rgba(194,161,107,0.25)] pointer-events-none transform -rotate-X-60 animate-pulse" />

        {/* Real Luxury High-Definition Car Photo */}
        <div className="relative z-10 w-full h-full max-h-[260px] sm:max-h-[300px] flex items-center justify-center">
          <img
            key={currentVehicle.image}
            src={currentVehicle.image}
            alt={currentVehicle.name}
            className="w-full h-full object-cover sm:object-contain rounded-2xl drop-shadow-[0_15px_25px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-300"
          />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP BADGES OVERLAY
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-[#DFCAA8] text-xs text-slate-900 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#C2A16B] animate-spin" style={{ animationDuration: '6s' }} />
          <span className="font-bold tracking-wide">3D Showroom</span>
          <span className="px-1.5 py-0.2 rounded bg-[#DFCAA8]/30 text-[#7B6035] text-[10px] font-mono font-black">
            {currentVehicle.badge}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-xs text-slate-800 shadow-sm">
          <Eye className="w-3.5 h-3.5 text-[#C2A16B]" />
          <span className="font-mono font-black text-[#534023]">Rego: {currentVehicle.regoPlate}</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM VEHICLE INFO & SPECS OVERLAY
      ───────────────────────────────────────────────────────────── */}
      <div className="relative z-20 px-4 pt-2 pb-2 bg-white border-t border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-black text-slate-900">{currentVehicle.name}</h4>
              <span className="px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#7B6035] font-mono font-bold text-[10px] border border-[#DFCAA8]">
                ACTIVE IN FLEET
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{currentVehicle.tagline}</p>
          </div>

          <div className="flex items-center gap-3 bg-[#FAF8F5] border border-slate-200 px-3 py-1.5 rounded-xl font-mono text-xs shadow-sm">
            <span className="flex items-center gap-1 text-slate-800 font-bold">
              <Users className="w-3.5 h-3.5 text-[#7B6035]" /> {currentVehicle.pax} Pax
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1 text-slate-800 font-bold">
              <Briefcase className="w-3.5 h-3.5 text-[#C2A16B]" /> {currentVehicle.bags} Bags
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5 CATEGORY SELECTOR TABS
      ───────────────────────────────────────────────────────────── */}
      {showControls && (
        <div className="relative z-20 bg-[#FAF8F5] border-t border-slate-200 p-2 flex items-center justify-between gap-1.5 overflow-x-auto">
          {([
            { id: 'SEDAN_PREMIUM', label: 'S-Class (GTS783)', plate: 'GTS783' },
            { id: 'PEOPLE_MOVER', label: 'V-Class (CGL646)', plate: 'CGL646' },
            { id: 'MINIBUS', label: 'Sprinter (BS14OK)', plate: 'BS14OK' },
            { id: 'SUV_PREMIUM', label: 'Audi Q7 (AMJ506)', plate: 'AMJ506' },
            { id: 'SEDAN_EXECUTIVE', label: 'E-Class (BYY499)', plate: 'BYY499' },
          ] as const).map((tab) => {
            const isSelected = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectCategory(tab.id as VehicleCategory)}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex-1 whitespace-nowrap text-center flex flex-col items-center justify-center shadow-sm active:scale-95 ${
                  isSelected
                    ? 'glow-gold-btn text-slate-950 shadow-md shadow-[#DFCAA8]/30 scale-100 font-black'
                    : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-950 hover:border-[#DFCAA8]'
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
