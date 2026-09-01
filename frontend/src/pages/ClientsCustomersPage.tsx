import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Car,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  DollarSign,
  FileText,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Shield,
  Star,
  Clock,
  ChevronRight,
  X,
  Send,
  UserCheck
} from 'lucide-react';

interface ClientBookingHistory {
  booking_number: string;
  invoice_number: string;
  date: string;
  pickup: string;
  dropoff: string;
  vehicle: string;
  plate: string;
  chauffeur: string;
  fare: number;
  payment_status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';
  payment_method: string;
}

interface VIPClient {
  id: string;
  name: string;
  company_name?: string;
  client_type: 'CORPORATE' | 'VIP_PRIVATE';
  email: string;
  phone: string;
  city: string;
  abn?: string;
  billing_terms: string;
  credit_limit: number;
  total_spent: number;
  pending_balance: number;
  unpaid_invoices_count: number;
  preferred_vehicle: string;
  preferred_chauffeur: string;
  vip_notes: string;
  rating: number;
  bookings: ClientBookingHistory[];
}

export const ClientsCustomersPage: React.FC = () => {
  const [clients, setClients] = useState<VIPClient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CORPORATE' | 'VIP_PRIVATE' | 'UNPAID'>('ALL');
  const [selectedClient, setSelectedClient] = useState<VIPClient | null>(null);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);

  // New Client Form
  const [newClient, setNewClient] = useState({
    name: '',
    company_name: '',
    client_type: 'CORPORATE' as 'CORPORATE' | 'VIP_PRIVATE',
    email: '',
    phone: '',
    city: 'Melbourne VIC',
    abn: '',
    billing_terms: 'Monthly (End of Month / Net 30)',
    credit_limit: 25000,
    preferred_vehicle: 'Mercedes-Benz S-Class S450 LWB (GTS783)',
    preferred_chauffeur: 'Sonu Tripathi',
    vip_notes: 'Complimentary Still Water, 21°C Climate, Qantas Platinum Meet & Greet',
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    let initialClients: VIPClient[] = [
      {
        id: 'client-01',
        name: 'David Sterling (Managing Director)',
        company_name: 'Rio Tinto Mining Executive Account',
        client_type: 'CORPORATE',
        email: 'd.sterling@riotinto.com',
        phone: '+61 412 889 001',
        city: 'Melbourne VIC',
        abn: '48 004 458 404',
        billing_terms: 'Monthly (End of Month / Net 30)',
        credit_limit: 25000.0,
        total_spent: 14850.0,
        pending_balance: 1440.0,
        unpaid_invoices_count: 2,
        preferred_vehicle: 'Mercedes-Benz S-Class S450 LWB (GTS783)',
        preferred_chauffeur: 'Sonu Tripathi',
        vip_notes: 'Priority Airport Pickup, Sparkling Mineral Water, Strict On-Time Arrival',
        rating: 5.0,
        bookings: [
          {
            booking_number: 'CCM-2026-9901',
            invoice_number: 'INV-2026-0041',
            date: '27 Aug 2026, 02:30 PM AEST',
            pickup: 'Melbourne Airport Terminal 1 (Tullamarine)',
            dropoff: 'Grand Hyatt Melbourne (123 Collins St)',
            vehicle: 'Mercedes-Benz S-Class S450 LWB',
            plate: 'GTS783',
            chauffeur: 'Sonu Tripathi',
            fare: 440.0,
            payment_status: 'UNPAID',
            payment_method: 'Direct EFT Bank Transfer (14 Days Terms)',
          },
          {
            booking_number: 'CCM-2026-9750',
            invoice_number: 'INV-2026-0038',
            date: '20 Aug 2026, 08:30 AM AEST',
            pickup: 'Crown Towers, 8 Whiteman St, Southbank',
            dropoff: 'Melbourne Airport Terminal 1',
            vehicle: 'Mercedes-Benz S-Class S450 LWB',
            plate: 'GTS783',
            chauffeur: 'Sonu Tripathi',
            fare: 1000.0,
            payment_status: 'UNPAID',
            payment_method: 'Direct EFT Bank Transfer (14 Days Terms)',
          },
          {
            booking_number: 'CCM-2026-9420',
            invoice_number: 'INV-2026-0031',
            date: '14 Aug 2026, 06:15 PM AEST',
            pickup: 'Melbourne Airport Terminal 1',
            dropoff: 'Park Hyatt Melbourne',
            vehicle: 'Mercedes-Benz S-Class S450 LWB',
            plate: 'GTS783',
            chauffeur: 'Sonu Tripathi',
            fare: 440.0,
            payment_status: 'PAID',
            payment_method: 'Direct EFT Bank Transfer',
          },
        ],
      },
      {
        id: 'client-02',
        name: 'Claire Redfield (VP Board Operations)',
        company_name: 'BHP Billiton VIP Corporate Services',
        client_type: 'CORPORATE',
        email: 'c.redfield@bhp.com',
        phone: '+61 498 221 445',
        city: 'Melbourne VIC',
        abn: '49 004 028 077',
        billing_terms: 'Monthly (End of Month / Net 30)',
        credit_limit: 30000.0,
        total_spent: 22400.0,
        pending_balance: 2160.0,
        unpaid_invoices_count: 3,
        preferred_vehicle: 'Mercedes-Benz Sprinter Luxury Minibus (BS14OK)',
        preferred_chauffeur: 'Sonu Tripathi',
        vip_notes: 'Board delegation group transfers, full-day winery & executive retreats',
        rating: 5.0,
        bookings: [
          {
            booking_number: 'CCM-2026-9940',
            invoice_number: 'INV-2026-0042',
            date: '25 Aug 2026, 09:00 AM AEST',
            pickup: 'Collins Square, 727 Collins St, Docklands',
            dropoff: 'Domaine Chandon Winery, Yarra Valley (Full Day)',
            vehicle: 'Mercedes-Benz Sprinter Luxury Minibus',
            plate: 'BS14OK',
            chauffeur: 'Sonu Tripathi',
            fare: 680.0,
            payment_status: 'PAID',
            payment_method: 'Corporate OSKO Direct Transfer',
          },
          {
            booking_number: 'CCM-2026-9810',
            invoice_number: 'INV-2026-0039',
            date: '19 Aug 2026, 07:45 AM AEST',
            pickup: '171 Collins St, Melbourne',
            dropoff: 'Avalon Airport Executive Hangar',
            vehicle: 'Mercedes-Benz V-Class People Mover',
            plate: 'CPS711',
            chauffeur: 'Sonu Tripathi',
            fare: 740.0,
            payment_status: 'UNPAID',
            payment_method: 'Corporate OSKO Direct Transfer',
          },
        ],
      },
      {
        id: 'client-03',
        name: 'Marcus Brody (Managing Director & CEO)',
        company_name: 'Macquarie Group Private Wealth',
        client_type: 'CORPORATE',
        email: 'm.brody@macquarie.com',
        phone: '+61 400 334 119',
        city: 'Sydney / Melbourne',
        abn: '46 008 583 542',
        billing_terms: 'Net 14 Days Post-Paid',
        credit_limit: 15000.0,
        total_spent: 11900.0,
        pending_balance: 920.0,
        unpaid_invoices_count: 2,
        preferred_vehicle: 'Audi Q7 Black Edition Quattro (AMJ506)',
        preferred_chauffeur: 'Marcus Vance',
        vip_notes: 'Sydney Domestic T3 flights, luggage assistance at car door',
        rating: 4.9,
        bookings: [
          {
            booking_number: 'CCM-2026-8812',
            invoice_number: 'INV-2026-0043',
            date: '24 Aug 2026, 11:15 AM AEST',
            pickup: 'Sydney Airport T3 Domestic',
            dropoff: 'Crown Towers Sydney, Barangaroo',
            vehicle: 'Audi Q7 Black Edition Quattro',
            plate: 'AMJ506',
            chauffeur: 'Marcus Vance',
            fare: 320.0,
            payment_status: 'PAID',
            payment_method: 'Corporate Amex Card',
          },
        ],
      },
      {
        id: 'client-04',
        name: 'Sarah Jenkins (Senior Managing Partner)',
        company_name: 'PwC Australia Executive Chauffeur Account',
        client_type: 'CORPORATE',
        email: 's.jenkins@pwc.com.au',
        phone: '+61 411 990 223',
        city: 'Melbourne VIC',
        abn: '52 780 433 757',
        billing_terms: 'Monthly (Net 30 Days)',
        credit_limit: 20000.0,
        total_spent: 9800.0,
        pending_balance: 680.0,
        unpaid_invoices_count: 1,
        preferred_vehicle: 'Mercedes-Benz E-Class Executive (BYY499)',
        preferred_chauffeur: 'Alexander Vance',
        vip_notes: 'Early morning airport transfers, quiet ride preference',
        rating: 5.0,
        bookings: [
          {
            booking_number: 'CCM-2026-7730',
            invoice_number: 'INV-2026-0044',
            date: '22 Aug 2026, 02:00 PM AEST',
            pickup: 'Melbourne Airport Terminal 2',
            dropoff: '101 Collins St, Melbourne CBD',
            vehicle: 'Mercedes-Benz E-Class Executive',
            plate: 'BYY499',
            chauffeur: 'Alexander Vance',
            fare: 190.0,
            payment_status: 'PAID',
            payment_method: 'Direct EFT Bank Transfer',
          },
        ],
      },
      {
        id: 'client-05',
        name: 'Elena Rostova (Private VIP Client)',
        company_name: 'Private Client Account',
        client_type: 'VIP_PRIVATE',
        email: 'elena.rostova@vipmail.com',
        phone: '+61 433 881 229',
        city: 'Melbourne VIC',
        billing_terms: 'Instant Pay (Card / PayID on booking)',
        credit_limit: 5000.0,
        total_spent: 7420.0,
        pending_balance: 0.0,
        unpaid_invoices_count: 0,
        preferred_vehicle: 'Mercedes-Benz S-Class S450 LWB (GTS783)',
        preferred_chauffeur: 'Sonu Tripathi',
        vip_notes: 'Luxury shopping charters (Chadstone & Collins St), champagne on special occasions',
        rating: 5.0,
        bookings: [
          {
            booking_number: 'CCM-2026-5520',
            invoice_number: 'INV-2026-0035',
            date: '18 Aug 2026, 10:00 AM AEST',
            pickup: 'Grand Hyatt Melbourne',
            dropoff: 'Mornington Peninsula Winery Tour',
            vehicle: 'Mercedes-Benz S-Class S450 LWB',
            plate: 'GTS783',
            chauffeur: 'Sonu Tripathi',
            fare: 520.0,
            payment_status: 'PAID',
            payment_method: 'Apple Pay / Credit Card',
          },
        ],
      },
      {
        id: 'client-06',
        name: 'Alexander Vance (Managing Partner)',
        company_name: 'Herbert Smith Freehills Law',
        client_type: 'CORPORATE',
        email: 'a.vance@hsf.com',
        phone: '+61 402 771 889',
        city: 'Melbourne VIC',
        abn: '35 162 971 789',
        billing_terms: 'Monthly (End of Month / Net 30)',
        credit_limit: 18000.0,
        total_spent: 8350.0,
        pending_balance: 530.0,
        unpaid_invoices_count: 1,
        preferred_vehicle: 'Mercedes-Benz V-Class People Mover (CPS711)',
        preferred_chauffeur: 'Sonu Tripathi',
        vip_notes: 'Legal team transfers to Supreme Court and Airport',
        rating: 4.9,
        bookings: [
          {
            booking_number: 'CCM-2026-6641',
            invoice_number: 'INV-2026-0036',
            date: '20 Aug 2026, 04:30 PM AEST',
            pickup: 'Crown Towers, Southbank',
            dropoff: 'Melbourne Airport Terminal 4',
            vehicle: 'Mercedes-Benz V-Class People Mover',
            plate: 'CPS711',
            chauffeur: 'Sonu Tripathi',
            fare: 240.0,
            payment_status: 'PAID',
            payment_method: 'Corporate OSKO Direct',
          },
        ],
      },
    ];

    try {
      const saved = localStorage.getItem('opal_registered_clients');
      if (saved) {
        const parsed = JSON.parse(saved);
        initialClients = [...initialClients, ...parsed];
      }
    } catch (e) {}

    setClients(initialClients);
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.email) return;

    const created: VIPClient = {
      id: `client-${Date.now()}`,
      name: newClient.name,
      company_name: newClient.company_name || 'Private VIP Client',
      client_type: newClient.client_type,
      email: newClient.email,
      phone: newClient.phone || '+61 400 000 000',
      city: newClient.city,
      abn: newClient.abn || undefined,
      billing_terms: newClient.billing_terms,
      credit_limit: Number(newClient.credit_limit) || 25000,
      total_spent: 0,
      pending_balance: 0,
      unpaid_invoices_count: 0,
      preferred_vehicle: newClient.preferred_vehicle,
      preferred_chauffeur: newClient.preferred_chauffeur,
      vip_notes: newClient.vip_notes,
      rating: 5.0,
      bookings: [],
    };

    const updated = [created, ...clients];
    setClients(updated);

    try {
      const existing = JSON.parse(localStorage.getItem('opal_registered_clients') || '[]');
      localStorage.setItem('opal_registered_clients', JSON.stringify([created, ...existing]));
    } catch (err) {}

    setIsAddClientModalOpen(false);
    setNewClient({
      name: '',
      company_name: '',
      client_type: 'CORPORATE',
      email: '',
      phone: '',
      city: 'Melbourne VIC',
      abn: '',
      billing_terms: 'Monthly (End of Month / Net 30)',
      credit_limit: 25000,
      preferred_vehicle: 'Mercedes-Benz S-Class S450 LWB (GTS783)',
      preferred_chauffeur: 'Sonu Tripathi',
      vip_notes: 'Complimentary Still Water, 21°C Climate, Qantas Platinum Meet & Greet',
    });
  };

  // Filtered Clients
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.company_name && c.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    if (!matchesSearch) return false;

    if (filterType === 'CORPORATE') return c.client_type === 'CORPORATE';
    if (filterType === 'VIP_PRIVATE') return c.client_type === 'VIP_PRIVATE';
    if (filterType === 'UNPAID') return c.pending_balance > 0;
    return true;
  });

  const totalClientsCount = clients.length;
  const corporateCount = clients.filter((c) => c.client_type === 'CORPORATE').length;
  const totalLifetimeSpend = clients.reduce((sum, c) => sum + c.total_spent, 0);
  const totalOutstandingDebt = clients.reduce((sum, c) => sum + c.pending_balance, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-100 tracking-tight">VIP Clients & Corporate CRM Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold font-mono">
              OPAL VIP CLIENT MANAGEMENT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete client dossiers, booking history, payment records, VIP chauffeur preferences, and corporate credit accounts.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsAddClientModalOpen(true)}
          className="px-5 py-2.5 rounded-xl glow-gold-btn text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Onboard VIP Client / Corporate Account</span>
        </button>
      </div>

      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-amber-500/30 shadow-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Registered VIPs</span>
          <span className="text-2xl font-mono font-black gold-gradient-text block">{totalClientsCount} Clients</span>
          <span className="text-[11px] text-slate-400 block">{corporateCount} Corporate Accounts</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-cyan-500/30 shadow-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Corporate Net 30 Terms</span>
          <span className="text-2xl font-mono font-black text-cyan-300 block">{corporateCount} Accounts</span>
          <span className="text-[11px] text-emerald-400 block">Monthly Post-Paid Billing</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-emerald-500/30 shadow-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Client Lifetime Spend</span>
          <span className="text-2xl font-mono font-black text-emerald-400 block">
            ${totalLifetimeSpend.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
          </span>
          <span className="text-[11px] text-slate-400 block">Across 120+ Completed Journeys</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-rose-500/30 shadow-xl space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Outstanding Debt</span>
          <span className="text-2xl font-mono font-black text-rose-400 block">
            ${totalOutstandingDebt.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
          </span>
          <span className="text-[11px] text-amber-300 block">Ready for FIFO Settlement</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, company, email, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'CORPORATE', 'VIP_PRIVATE', 'UNPAID'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterType(filter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === filter
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {filter === 'ALL'
                ? 'All Clients'
                : filter === 'CORPORATE'
                ? 'Corporate Accounts'
                : filter === 'VIP_PRIVATE'
                ? 'Private VIPs'
                : 'Pending Debt'}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Directory Table / Grid */}
      <div className="glass-panel rounded-2xl overflow-hidden border-slate-800 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/90 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Client / Corporate Entity</th>
                <th className="py-3.5 px-4 font-semibold">Contact & Phone</th>
                <th className="py-3.5 px-4 font-semibold">Account Type</th>
                <th className="py-3.5 px-4 font-semibold">Total Rides</th>
                <th className="py-3.5 px-4 font-semibold">Lifetime Spend</th>
                <th className="py-3.5 px-4 font-semibold">Outstanding Debt</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs font-mono shrink-0">
                        {client.company_name ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </div>
                      <div>
                        <strong className="text-slate-100 block text-xs">
                          {client.company_name || client.name}
                        </strong>
                        {client.company_name && (
                          <span className="text-[11px] text-slate-400 block">{client.name}</span>
                        )}
                        {client.abn && (
                          <span className="text-[10px] font-mono text-slate-500 block">ABN: {client.abn}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px]">
                    <span className="text-slate-200 block font-bold">{client.phone}</span>
                    <span className="text-slate-400 block text-[10px]">{client.email}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border font-mono ${
                        client.client_type === 'CORPORATE'
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      {client.client_type === 'CORPORATE' ? '🏢 CORPORATE (Net 30)' : '💎 PRIVATE VIP'}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-300">
                    <strong>{client.bookings.length}</strong> Bookings
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-emerald-400">
                    ${client.total_spent.toFixed(2)} AUD
                  </td>
                  <td className="py-4 px-4 font-mono font-bold">
                    {client.pending_balance > 0 ? (
                      <span className="text-rose-400">
                        ${client.pending_balance.toFixed(2)} AUD{' '}
                        <span className="block text-[10px] text-rose-300 font-normal">
                          ({client.unpaid_invoices_count} Unpaid)
                        </span>
                      </span>
                    ) : (
                      <span className="text-emerald-400">● Settle ($0.00)</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedClient(client)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Dossier & Rides</span>
                      </button>

                      <a
                        href={`https://api.whatsapp.com/send?phone=${client.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(
                          `Hello ${client.name},\nThis is Sonu Tripathi from Opal Chauffeurs Australia. Thank you for your continued partnership with us!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all"
                        title="Open WhatsApp Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: FULL CLIENT DOSSIER & BOOKING HISTORY
      ───────────────────────────────────────────────────────────── */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="glass-panel p-6 rounded-3xl border border-amber-500/40 w-full max-w-4xl shadow-2xl space-y-5 max-h-[90vh] flex flex-col text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-100">
                      {selectedClient.company_name || selectedClient.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
                      ⭐ {selectedClient.rating} VIP
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Attn: {selectedClient.name} • Phone: {selectedClient.phone} • Email: {selectedClient.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Dossier Body */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              {/* Financial & Contract Specs Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/90 p-4 rounded-2xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Billing Terms</span>
                  <strong className="text-slate-100">{selectedClient.billing_terms}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Credit Limit</span>
                  <strong className="text-cyan-300">${selectedClient.credit_limit.toLocaleString()} AUD</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Spent</span>
                  <strong className="text-emerald-400">${selectedClient.total_spent.toFixed(2)} AUD</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Pending Debt</span>
                  <strong className="text-rose-400">${selectedClient.pending_balance.toFixed(2)} AUD</strong>
                </div>
              </div>

              {/* VIP Preferences Card */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> VIP Preferences & Dedicated Chauffeur Allocation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-200">
                  <div>
                    <span className="text-slate-400 block">Preferred Fleet Model:</span>
                    <strong>{selectedClient.preferred_vehicle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Dedicated Chauffeur:</span>
                    <strong className="text-amber-400">{selectedClient.preferred_chauffeur}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 pt-1 border-t border-amber-500/20 italic">
                  📝 "{selectedClient.vip_notes}"
                </p>
              </div>

              {/* Bookings & Rides History Table */}
              <div className="space-y-2">
                <span className="font-bold text-slate-200 text-xs block">
                  All Booking Records & Payment Manifests ({selectedClient.bookings.length} Journeys)
                </span>
                <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden font-mono">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Booking Ref</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Route (Pickup ➔ Dropoff)</th>
                        <th className="py-2.5 px-3">Chauffeur & Plate</th>
                        <th className="py-2.5 px-3">Fare (AUD)</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {selectedClient.bookings.map((b) => (
                        <tr key={b.booking_number} className="hover:bg-slate-900/60">
                          <td className="py-3 px-3 font-bold text-amber-400">
                            {b.booking_number}
                            <span className="block text-[10px] text-slate-500">{b.invoice_number}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{b.date}</td>
                          <td className="py-3 px-3 font-sans text-slate-200">
                            <span className="block font-semibold">📍 {b.pickup}</span>
                            <span className="block text-slate-400 text-[10px]">🏁 {b.dropoff}</span>
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-300">
                            <strong className="text-slate-200 block">{b.chauffeur}</strong>
                            <span className="text-amber-400 text-[10px] font-mono">{b.plate}</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-100">${b.fare.toFixed(2)}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.payment_status === 'PAID'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              ● {b.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <a
                href={`https://api.whatsapp.com/send?phone=${selectedClient.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(
                  `Hello ${selectedClient.name},\nThis is Sonu Tripathi from Opal Chauffeurs Australia regarding your account (${selectedClient.company_name || selectedClient.name}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>📱 Open Direct WhatsApp</span>
              </a>

              <button
                onClick={() => setSelectedClient(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white text-xs font-bold"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ONBOARD NEW VIP CLIENT / CORPORATE ACCOUNT
      ───────────────────────────────────────────────────────────── */}
      {isAddClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="glass-panel p-6 rounded-3xl border border-amber-500/40 w-full max-w-lg shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-100">Onboard VIP Client / Corporate</h3>
                  <p className="text-[11px] text-slate-400">Setup customer dossier, credit limit & preferences</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddClientModalOpen(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Client / Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Sterling"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Company / Entity</label>
                  <input
                    type="text"
                    placeholder="e.g. KPMG Australia / Private"
                    value={newClient.company_name}
                    onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="client@company.com.au"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+61 400 000 000"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Account Type</label>
                  <select
                    value={newClient.client_type}
                    onChange={(e) => setNewClient({ ...newClient, client_type: e.target.value as any })}
                    className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  >
                    <option value="CORPORATE">Corporate Net 30</option>
                    <option value="VIP_PRIVATE">Private VIP Client</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    value={newClient.credit_limit}
                    onChange={(e) => setNewClient({ ...newClient, credit_limit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">Client ABN</label>
                  <input
                    type="text"
                    placeholder="12 345 678 901"
                    value={newClient.abn}
                    onChange={(e) => setNewClient({ ...newClient, abn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block uppercase font-bold mb-1">VIP Notes & Preferences</label>
                <textarea
                  rows={2}
                  value={newClient.vip_notes}
                  onChange={(e) => setNewClient({ ...newClient, vip_notes: e.target.value })}
                  placeholder="Special amenities, temperature, airport meet requirements..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 font-bold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl glow-gold-btn text-slate-950 font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" /> Save Client Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
