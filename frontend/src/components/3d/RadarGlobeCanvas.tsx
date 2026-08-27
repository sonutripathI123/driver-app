import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Plane, Radio, ShieldCheck } from 'lucide-react';

interface RadarGlobeProps {
  activeFlightsCount?: number;
  activeDriversCount?: number;
}

export const RadarGlobeCanvas: React.FC<RadarGlobeProps> = ({
  activeFlightsCount = 8,
  activeDriversCount = 14,
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

    // 3. Airport Radar Nodes (e.g. Melbourne Airport coordinates mapped on 3D sphere)
    const pointsGroup = new THREE.Group();
    scene.add(pointsGroup);

    const airportNodes = [
      { name: 'MEL (Melbourne Tullamarine)', lat: -37.669, lng: 144.841, color: 0x06b6d4 },
      { name: 'AVV (Avalon Airport)', lat: -38.039, lng: 144.469, color: 0x22d3ee },
      { name: 'SYD (Sydney Kingsford)', lat: -33.939, lng: 151.175, color: 0xd4af37 },
      { name: 'BNE (Brisbane Airport)', lat: -27.384, lng: 153.117, color: 0x10b981 },
    ];

    function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const z = radius * Math.sin(phi) * Math.sin(theta);
      const y = radius * Math.cos(phi);
      return new THREE.Vector3(x, y, z);
    }

    airportNodes.forEach((node) => {
      const pos = latLngToVector3(node.lat, node.lng, 2.05);
      const nodeGeo = new THREE.SphereGeometry(0.06, 12, 12);
      const nodeMat = new THREE.MeshBasicMaterial({ color: node.color });
      const pin = new THREE.Mesh(nodeGeo, nodeMat);
      pin.position.copy(pos);
      pointsGroup.add(pin);
    });

    // 4. Flight Trajectory Arcs
    const melPos = latLngToVector3(-37.669, 144.841, 2.05);
    const sydPos = latLngToVector3(-33.939, 151.175, 2.05);
    const midPoint = new THREE.Vector3().addVectors(melPos, sydPos).multiplyScalar(0.5);
    midPoint.normalize().multiplyScalar(2.6); // elevated arc

    const curve = new THREE.QuadraticBezierCurve3(melPos, midPoint, sydPos);
    const curvePoints = curve.getPoints(50);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const arcMat = new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.8 });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    scene.add(arcLine);

    // 5. Animation
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      globe.rotation.y += 0.003;
      core.rotation.y += 0.003;
      pointsGroup.rotation.y += 0.003;
      arcLine.rotation.y += 0.003;
      ring.rotation.z += 0.01; // sweep
      renderer.render(scene, camera);
    };
    animate();

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
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-2xl overflow-hidden glass-panel-cyan flex flex-col items-center justify-center p-4">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full min-h-[300px]" />

      {/* Holographic Radar Header */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-cyan-500/40 text-xs text-cyan-300">
        <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
        <span className="font-semibold tracking-wide">Live Dispatch Radar & Airspace</span>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-emerald-500/30 text-xs text-emerald-300">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>FlightAware Telemetry Active</span>
      </div>

      {/* Live Airspace Radar Stats Bar */}
      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3 bg-slate-950/85 backdrop-blur-md p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Tracked Airport Pickups</p>
            <p className="text-sm font-bold text-slate-100">{activeFlightsCount} Flights In-Bound</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Chauffeur Telemetry Pings</p>
            <p className="text-sm font-bold text-amber-300">{activeDriversCount} Active Drivers</p>
          </div>
        </div>
      </div>
    </div>
  );
};
