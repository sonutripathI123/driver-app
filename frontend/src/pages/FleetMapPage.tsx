import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, RefreshCw, Satellite } from 'lucide-react';
import { fleetApi, FleetLocation } from '../services/api';

// Melbourne CBD — the fleet's home city, used until the first live point lands.
const MELBOURNE: [number, number] = [-37.8136, 144.9631];
const POLL_MS = 20000;

/**
 * Live Fleet Map — shows drivers' real-time GPS positions pulled (read-only)
 * from the TrackMyChauffeur app. A driver appears here only while they are
 * sharing a location (on an active trip), so an empty map is normal when the
 * fleet is idle.
 */
export const FleetMapPage: React.FC = () => {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const [drivers, setDrivers] = useState<FleetLocation[]>([]);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Init the map once.
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true }).setView(MELBOURNE, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  const dotIcon = (heading?: number | null) =>
    L.divIcon({
      className: 'fleet-dot',
      html: `<div style="position:relative;width:26px;height:26px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#0A0E1A;border:3px solid #C2A16B;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>
        ${
          typeof heading === 'number'
            ? `<div style="position:absolute;top:-6px;left:11px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:8px solid #C2A16B;transform-origin:4px 20px;transform:rotate(${heading}deg);"></div>`
            : ''
        }
      </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fleetApi.getFleetLocations();
      setConfigured(res.configured);
      setDrivers(res.drivers || []);
      setError(null);
      setLastUpdated(new Date());

      const map = mapRef.current;
      if (!map) return;
      const seen = new Set<string>();
      (res.drivers || []).forEach((d) => {
        const key = d.driver_id || `${d.lat},${d.lng}`;
        seen.add(key);
        const label = `<strong>${d.name}</strong>${d.booking ? `<br/>Booking ${d.booking}` : ''}`;
        const existing = markersRef.current[key];
        if (existing) {
          existing.setLatLng([d.lat, d.lng]);
          existing.setIcon(dotIcon(d.heading));
          existing.getPopup()?.setContent(label);
        } else {
          const m = L.marker([d.lat, d.lng], { icon: dotIcon(d.heading) }).addTo(map).bindPopup(label);
          markersRef.current[key] = m;
        }
      });
      // Drop markers for drivers no longer sharing a location.
      Object.keys(markersRef.current).forEach((key) => {
        if (!seen.has(key)) {
          map.removeLayer(markersRef.current[key]);
          delete markersRef.current[key];
        }
      });
      // Frame all live drivers the first time we get some.
      const pts = (res.drivers || []).map((d) => [d.lat, d.lng]) as [number, number][];
      if (pts.length > 0) {
        map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 14 });
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not load live fleet locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Live Fleet Map</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${drivers.length ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {drivers.length} live
            </span>
          </div>
          <p className="text-xs text-[#0A0E1A] font-bold mt-1">
            Real-time chauffeur positions from TrackMyChauffeur. Drivers show here while on an active trip.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] font-bold text-slate-600">
              updated {lastUpdated.toLocaleTimeString('en-AU')}
            </span>
          )}
          <button
            onClick={load}
            className="p-2.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white transition-colors shadow-sm"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!configured && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-start gap-2">
          <Satellite className="w-4 h-4 shrink-0 mt-0.5" />
          <span>TrackMyChauffeur connector is not configured, so live locations are unavailable.</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold">{error}</div>
      )}

      <div className="relative rounded-2xl overflow-hidden border border-[#E6D8C3] shadow-md">
        <div ref={mapEl} style={{ height: '70vh', width: '100%', background: '#e8eef2' }} />
        {configured && !error && drivers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 border border-[#DFCAA8] rounded-2xl px-5 py-4 text-center shadow-lg pointer-events-auto max-w-sm">
              <MapPin className="w-6 h-6 mx-auto text-[#0A0E1A]" />
              <p className="mt-2 text-sm font-black text-[#0A0E1A]">No drivers sharing location right now</p>
              <p className="mt-1 text-[11px] font-bold text-slate-600">
                A chauffeur appears here while on an active trip. The map refreshes every 20 seconds.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
