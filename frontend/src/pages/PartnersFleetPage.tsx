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
  Briefcase
} from 'lucide-react';

export const PartnersFleetPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTab, setActiveTab] = useState<'partners' | 'fleet'>('partners');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pData, vData, dData] = await Promise.all([
        partnersApi.list(),
        fleetApi.getVehicles(),
        fleetApi.getDrivers(),
      ]);
      setPartners(pData || []);
      setVehicles(vData || []);
      setDrivers(dData || []);
    } catch (err) {
      // Demo Data
      setPartners([
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
      ]);

      setVehicles([
        { id: 'v-01', category: 'SEDAN_EXECUTIVE', make: 'Mercedes-Benz', model: 'S-Class S450', year: 2024, registration_plate: 'CROWN-01', passenger_capacity: 4, luggage_capacity: 3, is_active: true },
        { id: 'v-02', category: 'SUV_PREMIUM', make: 'Audi', model: 'Q7 Quattro', year: 2024, registration_plate: 'CROWN-02', passenger_capacity: 4, luggage_capacity: 4, is_active: true },
        { id: 'v-03', category: 'PEOPLE_MOVER', make: 'Mercedes-Benz', model: 'V-Class V300', year: 2024, registration_plate: 'VIP-VAN-03', passenger_capacity: 7, luggage_capacity: 7, is_active: true },
      ]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">Partner Network & Fleet Management</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold font-mono">
              AFFILIATE COMPLIANCE GATES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Subcontractor registry with automated public liability insurance verification & company vehicle fleet catalog.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('partners')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'partners' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Subcontractor Partners ({partners.length})
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'fleet' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vehicle Fleet ({vehicles.length})
          </button>
        </div>
      </div>

      {activeTab === 'partners' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map((p) => (
            <div key={p.id} className="glass-panel p-5 rounded-2xl border-slate-800 space-y-4 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-100">{p.company_name}</h3>
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

              <div className="grid grid-cols-2 gap-2 text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Contact</span>
                  <span className="font-semibold block">{p.contact_name}</span>
                  <span className="text-[11px] text-slate-400">{p.phone}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Region & Terms</span>
                  <span className="font-semibold text-cyan-300 block">{p.city}</span>
                  <span className="text-[11px] text-amber-400">{p.commission_rate}% Subcontractor Comm.</span>
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
            </div>
          ))}
        </div>
      ) : (
        /* Vehicle Fleet Catalog */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vehicles.map((v) => (
            <div key={v.id} className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {v.category}
                </span>
                <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active Fleet
                </span>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-100">{v.make} {v.model}</h3>
                <span className="text-slate-400 text-xs font-mono">Plate: <strong className="text-amber-400">{v.registration_plate}</strong> ({v.year})</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-slate-300 text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Passengers</span>
                  <span className="font-bold text-sm text-cyan-300">{v.passenger_capacity} PAX</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Luggage</span>
                  <span className="font-bold text-sm text-amber-300">{v.luggage_capacity} Suitcases</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
