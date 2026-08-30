import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Plane, Radio, ShieldCheck } from 'lucide-react';

interface RadarGlobeProps {
  activeFlightsCount?: number;
  activeDriversCount?: number;
  onOpenFlightModal?: () => void;
}

export const RadarGlobeCanvas: React.FC<RadarGlobeProps> = ({
  activeFlightsCount = 6,
  activeDriversCount = 12,
  onOpenFlightModal,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    // 1. Holographic Wireframe Globe
    const globeGeo = new THREE.SphereGeometry(2, 28, 28);
    const globeMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const globe = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globe);

    // Inner Glowing Core
    const coreGeo = new THREE.SphereGeometry(1.9, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.85,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // 2. Radar Scanner Ring & Sweeping Line
    const ringGeo = new THREE.RingGeometry(2.1, 2.15, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // Radar Sweeper Cone
    const sweepGeo = new THREE.CircleGeometry(2.1, 32, 0, Math.PI / 4);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const sweep = new THREE.Mesh(sweepGeo, sweepMat);
    sweep.rotation.x = -Math.PI / 2;
    scene.add(sweep);

    // 3. Flight Arcs
    const createCurvedArc = (v1: THREE.Vector3, v2: THREE.Vector3, color = 0xd4af37) => {
      const mid = v1.clone().lerp(v2, 0.5).normalize().multiplyScalar(2.6);
      const curve = new THREE.QuadraticBezierCurve3(v1, mid, v2);
      const points = curve.getPoints(30);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
      return new THREE.Line(geometry, material);
    };

    const melbourne = new THREE.Vector3(1.2, -1.3, 0.8).normalize().multiplyScalar(2);
    const sydney = new THREE.Vector3(1.5, -1.1, 0.6).normalize().multiplyScalar(2);
    const brisbane = new THREE.Vector3(1.6, -0.6, 0.9).normalize().multiplyScalar(2);
    const perth = new THREE.Vector3(0.3, -1.2, 1.5).normalize().multiplyScalar(2);

    scene.add(createCurvedArc(sydney, melbourne, 0x06b6d4));
    scene.add(createCurvedArc(brisbane, melbourne, 0xd4af37));
    scene.add(createCurvedArc(perth, melbourne, 0x10b981));

    // Airport Pins
    const pinGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [melbourne, sydney, brisbane, perth].forEach((pos) => {
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(pos);
      scene.add(pin);
    });

    // 4. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      globe.rotation.y += 0.003;
      core.rotation.y += 0.003;
      sweep.rotation.z -= 0.03; // Sweeper radar spin
      renderer.render(scene, camera);
    };
    animate();

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
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full max-w-full h-full min-h-[360px] rounded-2xl overflow-hidden glass-panel-cyan flex flex-col items-center justify-center p-3 sm:p-4">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full min-h-[280px]" />

      {/* Holographic Radar Header */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur border border-cyan-500/40 text-[11px] text-cyan-300 pointer-events-auto">
          <Radio className="w-3 h-3 animate-pulse text-cyan-400" />
          <span className="font-semibold tracking-wide">Live Dispatch Radar</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/85 backdrop-blur border border-emerald-500/30 text-[11px] text-emerald-300 pointer-events-auto">
          <ShieldCheck className="w-3 h-3" />
          <span>FlightAware Active</span>
        </div>
      </div>

      {/* Live Airspace Radar Stats Bar with Interactive Button */}
      <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 z-10 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <Plane className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 truncate">Airport Flights</p>
              <p className="text-xs font-bold text-slate-100 truncate">{activeFlightsCount} In-Bound</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 truncate">Telemetry Pings</p>
              <p className="text-xs font-bold text-amber-300 truncate">{activeDriversCount} Active Drivers</p>
            </div>
          </div>
        </div>

        {onOpenFlightModal && (
          <button
            onClick={onOpenFlightModal}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-[11px] shadow transition-all flex items-center justify-center gap-1.5"
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Check Flight Bookings & Delays ➔</span>
          </button>
        )}
      </div>
    </div>
  );
};
