import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VehicleCategory } from '../../types';
import { Sparkles, Eye, Shield, Users, Briefcase } from 'lucide-react';

interface LuxuryCarCanvasProps {
  category?: VehicleCategory;
  onCategoryChange?: (category: VehicleCategory) => void;
  showControls?: boolean;
}

export const LuxuryCarCanvas: React.FC<LuxuryCarCanvasProps> = ({
  category = 'SEDAN_EXECUTIVE',
  onCategoryChange,
  showControls = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>('#0d1117');
  const [activeCategory, setActiveCategory] = useState<VehicleCategory>(category);
  const [isRotating, setIsRotating] = useState(true);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const bodyMeshRef = useRef<THREE.Mesh | null>(null);
  const underglowRef = useRef<THREE.PointLight | null>(null);

  useEffect(() => {
    setActiveCategory(category);
  }, [category]);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(7, 4, 8);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    containerRef.current.appendChild(renderer.domElement);

    // 2. Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.5);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
    fillLight.position.set(-5, 4, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xd4af37, 2.0);
    rimLight.position.set(0, 5, -8);
    scene.add(rimLight);

    // 3. Ground Mirror Grid & Underglow
    const gridHelper = new THREE.GridHelper(20, 20, 0xd4af37, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const underglow = new THREE.PointLight(0xd4af37, 3, 6);
    underglow.position.set(0, 0.2, 0);
    scene.add(underglow);
    underglowRef.current = underglow;

    // 4. Build Procedural Luxury Car Geometry
    const carGroup = new THREE.Group();
    carGroupRef.current = carGroup;
    scene.add(carGroup);

    buildCarModel(carGroup, activeCategory, selectedColor);

    // 5. Mouse Drag Controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      setIsRotating(false);
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !carGroupRef.current) return;
      const deltaX = e.clientX - previousMousePosition.x;
      carGroupRef.current.rotation.y += deltaX * 0.008;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // 6. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (carGroupRef.current && isRotating && !isDragging) {
        carGroupRef.current.rotation.y += 0.005;
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [activeCategory]);

  // Update Paint Color dynamically
  useEffect(() => {
    if (bodyMeshRef.current) {
      const mat = bodyMeshRef.current.material as THREE.MeshPhysicalMaterial;
      mat.color.set(selectedColor);
      if (underglowRef.current) {
        underglowRef.current.color.set(selectedColor === '#0d1117' ? 0xd4af37 : selectedColor);
      }
    }
  }, [selectedColor]);

  function buildCarModel(group: THREE.Group, cat: VehicleCategory, color: string) {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const isSUV = cat === 'SUV_PREMIUM';
    const isVan = cat === 'PEOPLE_MOVER' || cat === 'MINIBUS';
    const bodyHeight = isVan ? 1.6 : isSUV ? 1.3 : 0.9;
    const bodyLength = cat === 'MINIBUS' ? 5.2 : 4.4;

    // Body Paint Material (Luxury Metallic Clearcoat)
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      metalness: 0.85,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.9,
    });

    // Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(1.9, bodyHeight * 0.45, bodyLength);
    const chassis = new THREE.Mesh(chassisGeo, bodyMaterial);
    chassis.position.y = 0.5;
    chassis.castShadow = true;
    group.add(chassis);
    bodyMeshRef.current = chassis;

    // Cabin / Canopy
    const cabinGeo = new THREE.BoxGeometry(1.6, bodyHeight * 0.55, bodyLength * (isVan ? 0.8 : 0.55));
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
    const windshieldGeo = new THREE.PlaneGeometry(1.5, 0.8);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 0.85, isVan ? 1.8 : 0.9);
    windshield.rotation.x = -Math.PI / 4;
    group.add(windshield);

    // Headlights (Glowing Xenon LEDs)
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x88e7ff });
    const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), lightMat);
    headlightL.position.set(0.65, 0.55, bodyLength / 2 + 0.01);
    const headlightR = headlightL.clone();
    headlightR.position.x = -0.65;
    group.add(headlightL);
    group.add(headlightR);

    // Taillights (Neon Ruby Red)
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const taillight = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.1), tailMat);
    taillight.position.set(0, 0.6, -bodyLength / 2 - 0.01);
    group.add(taillight);

    // Alloy Wheels with Metallic Rims & Rubber Tires
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.95, roughness: 0.2 });

    const wheelPositions = [
      [-0.95, 0.38, bodyLength * 0.32],
      [0.95, 0.38, bodyLength * 0.32],
      [-0.95, 0.38, -bodyLength * 0.32],
      [0.95, 0.38, -bodyLength * 0.32],
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, y, z);
      wheel.castShadow = true;

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.26, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);

      group.add(wheel);
    });
  }

  const categoryConfigs: Record<VehicleCategory, { name: string; pax: number; bags: number; desc: string }> = {
    SEDAN_EXECUTIVE: { name: 'Executive Sedan', pax: 4, bags: 2, desc: 'Mercedes S-Class / BMW 7 Series' },
    SEDAN_PREMIUM: { name: 'Premium Sedan', pax: 4, bags: 2, desc: 'Audi A6 / Lexus ES Luxury' },
    SUV_PREMIUM: { name: 'Premium SUV', pax: 4, bags: 4, desc: 'Audi Q7 / Lexus RX Premium All-Wheel' },
    PEOPLE_MOVER: { name: 'Executive People Mover', pax: 7, bags: 7, desc: 'Mercedes-Benz V-Class VIP Van' },
    MINIBUS: { name: 'Executive Minibus', pax: 11, bags: 12, desc: 'Mercedes Sprinter Luxury Shuttle' },
  };

  const colors = [
    { name: 'Obsidian Black', hex: '#0d1117', border: 'border-slate-800' },
    { name: 'Champagne Gold', hex: '#d4af37', border: 'border-amber-400' },
    { name: 'Pearl White', hex: '#f8fafc', border: 'border-slate-300' },
    { name: 'Royal Sapphire', hex: '#0f274a', border: 'border-blue-700' },
  ];

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden glass-panel-gold flex flex-col">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full min-h-[340px] flex-1 cursor-grab active:cursor-grabbing" />

      {/* Holographic Badge & Camera Hint */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-amber-500/30 text-xs text-amber-300">
        <Sparkles className="w-3.5 h-3.5 animate-spin" />
        <span className="font-semibold tracking-wide">3D Interactive Showroom</span>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-slate-700 text-xs text-slate-400">
        <Eye className="w-3.5 h-3.5" />
        <span>Drag to rotate 360°</span>
      </div>

      {/* Category Info Badge */}
      <div className="absolute bottom-16 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800">
          <h4 className="text-sm font-bold text-slate-100">{categoryConfigs[activeCategory].name}</h4>
          <p className="text-xs text-amber-400/90">{categoryConfigs[activeCategory].desc}</p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Users className="w-3 h-3 text-cyan-400" /> {categoryConfigs[activeCategory].pax} Passengers</span>
            <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-amber-400" /> {categoryConfigs[activeCategory].bags} Suitcases</span>
          </div>
        </div>

        {/* Color Palette Selector */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 pointer-events-auto">
          {colors.map((c) => (
            <button
              key={c.name}
              title={c.name}
              onClick={() => setSelectedColor(c.hex)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                selectedColor === c.hex ? 'scale-125 border-amber-400 shadow-md shadow-amber-500/50' : 'border-slate-700 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* Category Tabs if controls active */}
      {showControls && (
        <div className="bg-slate-950/80 border-t border-slate-800/80 p-2 flex items-center justify-between gap-1 overflow-x-auto">
          {(Object.keys(categoryConfigs) as VehicleCategory[]).map((catKey) => (
            <button
              key={catKey}
              onClick={() => {
                setActiveCategory(catKey);
                if (onCategoryChange) onCategoryChange(catKey);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex-1 whitespace-nowrap ${
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
