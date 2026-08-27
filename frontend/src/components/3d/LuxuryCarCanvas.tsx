import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VehicleCategory } from '../../types';
import { Sparkles, Eye, Users, Briefcase } from 'lucide-react';

interface LuxuryCarProps {
  category?: VehicleCategory;
  onCategoryChange?: (cat: VehicleCategory) => void;
  showControls?: boolean;
}

export const LuxuryCarCanvas: React.FC<LuxuryCarProps> = ({
  category = 'SEDAN_EXECUTIVE',
  onCategoryChange,
  showControls = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>('#0d1117'); // Obsidian Black default
  const [activeCategory, setActiveCategory] = useState<VehicleCategory>(category);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Mouse / Touch Drag State
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 5.5);
    camera.lookAt(0, 0.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    // Ambient & Studio Key Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.5);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 3.0);
    rimLight.position.set(-6, 4, -4);
    scene.add(rimLight);

    const goldFill = new THREE.PointLight(0xd4af37, 2.0, 15);
    goldFill.position.set(0, 3, 3);
    scene.add(goldFill);

    // Reflective Mirrored Showroom Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090c15,
      metalness: 0.85,
      roughness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Glowing Circular Showroom Turntable Ring
    const ringGeo = new THREE.RingGeometry(2.3, 2.35, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Build 3D Car Model Group
    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    rebuildCarMesh(carGroup, activeCategory, selectedColor);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isDragging.current && carGroupRef.current) {
        carGroupRef.current.rotation.y += 0.003; // Gentle auto-spin
      }
      renderer.render(scene, camera);
    };
    animate();

    // Mouse / Touch Interaction Listeners
    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !carGroupRef.current) return;
      const deltaX = e.clientX - previousMousePosition.current.x;
      carGroupRef.current.rotation.y += deltaX * 0.008;
      previousMousePosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    // Touch Support for Smartphones
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !carGroupRef.current || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
      carGroupRef.current.rotation.y += deltaX * 0.01;
      previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
    };

    const dom = containerRef.current;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const newW = containerRef.current.clientWidth;
      const newH = containerRef.current.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dom.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Body Color or Model on change
  useEffect(() => {
    if (carGroupRef.current) {
      rebuildCarMesh(carGroupRef.current, activeCategory, selectedColor);
    }
  }, [selectedColor, activeCategory]);

  const rebuildCarMesh = (group: THREE.Group, cat: VehicleCategory, colorHex: string) => {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const isVan = cat === 'PEOPLE_MOVER' || cat === 'MINIBUS';
    const isSUV = cat === 'SUV_PREMIUM';

    const bodyLength = isVan ? 3.6 : isSUV ? 3.3 : 3.2;
    const bodyHeight = isVan ? 1.1 : isSUV ? 0.9 : 0.65;

    // Metallic Car Paint Material
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colorHex),
      metalness: 0.9,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
    });

    // Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(1.6, 0.45, bodyLength);
    const chassis = new THREE.Mesh(chassisGeo, bodyMaterial);
    chassis.position.set(0, 0.45, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    group.add(chassis);

    // Upper Cabin
    const cabinGeo = isVan
      ? new THREE.BoxGeometry(1.55, bodyHeight, bodyLength * 0.9)
      : new THREE.BoxGeometry(1.4, bodyHeight, bodyLength * 0.58);
    const cabin = new THREE.Mesh(cabinGeo, bodyMaterial);
    cabin.position.set(0, 0.5 + bodyHeight * 0.45, isVan ? 0 : -0.2);
    group.add(cabin);

    // Tinted Glass Material
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x05070d,
      transmission: 0.7,
      opacity: 1,
      transparent: true,
      roughness: 0.05,
      metalness: 0.1,
    });

    // Windshield
    const windshieldGeo = new THREE.PlaneGeometry(1.4, 0.75);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 0.85, isVan ? 1.6 : 0.85);
    windshield.rotation.x = -Math.PI / 4;
    group.add(windshield);

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x88e7ff });
    const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.1), lightMat);
    headlightL.position.set(0.6, 0.52, bodyLength / 2 + 0.01);
    const headlightR = headlightL.clone();
    headlightR.position.x = -0.6;
    group.add(headlightL);
    group.add(headlightR);

    // Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const taillight = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.1), tailMat);
    taillight.position.set(0, 0.55, -bodyLength / 2 - 0.01);
    group.add(taillight);

    // Alloy Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.22, 20);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.95, roughness: 0.2 });

    const wheelPositions = [
      [-0.88, 0.35, bodyLength * 0.3],
      [0.88, 0.35, bodyLength * 0.3],
      [-0.88, 0.35, -bodyLength * 0.3],
      [0.88, 0.35, -bodyLength * 0.3],
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, y, z);
      wheel.castShadow = true;

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.24, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);

      group.add(wheel);
    });
  };

  const categoryConfigs: Record<VehicleCategory, { name: string; pax: number; bags: number; desc: string }> = {
    SEDAN_EXECUTIVE: { name: 'Executive Sedan', pax: 4, bags: 2, desc: 'Mercedes S-Class / BMW 7 Series' },
    SEDAN_PREMIUM: { name: 'Premium Sedan', pax: 4, bags: 2, desc: 'Audi A6 / Lexus ES Luxury' },
    SUV_PREMIUM: { name: 'Premium SUV', pax: 4, bags: 4, desc: 'Audi Q7 / Lexus RX Premium' },
    PEOPLE_MOVER: { name: 'Executive Van', pax: 7, bags: 7, desc: 'Mercedes-Benz V-Class VIP Van' },
    MINIBUS: { name: 'Executive Minibus', pax: 11, bags: 12, desc: 'Mercedes Sprinter Shuttle' },
  };

  const colors = [
    { name: 'Obsidian Black', hex: '#0d1117' },
    { name: 'Champagne Gold', hex: '#d4af37' },
    { name: 'Pearl White', hex: '#f8fafc' },
    { name: 'Royal Sapphire', hex: '#0f274a' },
  ];

  return (
    <div className="relative w-full max-w-full h-full min-h-[380px] sm:min-h-[420px] rounded-2xl overflow-hidden glass-panel-gold flex flex-col">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full min-h-[280px] flex-1 cursor-grab active:cursor-grabbing" />

      {/* Holographic Top Badges */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur border border-amber-500/30 text-[11px] text-amber-300 pointer-events-auto">
          <Sparkles className="w-3 h-3 animate-spin" />
          <span className="font-semibold tracking-wide">3D Showroom</span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur border border-slate-700 text-[11px] text-slate-400 pointer-events-auto">
          <Eye className="w-3 h-3" />
          <span>360° Touch</span>
        </div>
      </div>

      {/* Category Info & Color Selector Overlay */}
      <div className="absolute bottom-14 sm:bottom-16 left-3 right-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-none z-10">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-slate-800 pointer-events-auto max-w-[260px] sm:max-w-none">
          <h4 className="text-xs sm:text-sm font-bold text-slate-100">{categoryConfigs[activeCategory].name}</h4>
          <p className="text-[10px] sm:text-xs text-amber-400/90 truncate">{categoryConfigs[activeCategory].desc}</p>
          <div className="flex items-center gap-2.5 mt-0.5 text-[10px] sm:text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Users className="w-3 h-3 text-cyan-400" /> {categoryConfigs[activeCategory].pax} Pax</span>
            <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-amber-400" /> {categoryConfigs[activeCategory].bags} Bags</span>
          </div>
        </div>

        {/* Color Palette Selector */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 pointer-events-auto">
          {colors.map((c) => (
            <button
              key={c.name}
              title={c.name}
              onClick={() => setSelectedColor(c.hex)}
              className={`w-5 h-5 rounded-full border transition-all ${
                selectedColor === c.hex ? 'scale-125 border-amber-400 shadow-md shadow-amber-500/50' : 'border-slate-700 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* Category Tabs if controls active */}
      {showControls && (
        <div className="bg-slate-950/90 border-t border-slate-800/80 p-1.5 flex items-center justify-between gap-1 overflow-x-auto z-10">
          {(Object.keys(categoryConfigs) as VehicleCategory[]).map((catKey) => (
            <button
              key={catKey}
              onClick={() => {
                setActiveCategory(catKey);
                if (onCategoryChange) onCategoryChange(catKey);
              }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all flex-1 whitespace-nowrap text-center ${
                activeCategory === catKey
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {categoryConfigs[catKey].name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
