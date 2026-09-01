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
  UserCheck,
  Printer,
  Download,
  Receipt
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

  // Selected Booking Invoice Preview
  const [previewBooking, setPreviewBooking] = useState<{
    client: VIPClient;
    booking: ClientBookingHistory;
  } | null>(null);

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

  // WhatsApp Statement Dispatch
  const handleGenerateWhatsAppStatement = (client: VIPClient) => {
    const text =
      `🧾 *[OPAL CHAUFFEURS AUSTRALIA - TAX INVOICE STATEMENT]* 🚘\n\n` +
      `🏢 *Client Account:* ${client.company_name || client.name}\n` +
      `👤 *Attn:* ${client.name}\n` +
      `💳 *Billing Terms:* ${client.billing_terms}\n` +
      `💰 *Total Outstanding Balance:* $${client.pending_balance.toFixed(2)} AUD (${client.unpaid_invoices_count} Invoices Pending)\n\n` +
      `🏦 *Remittance Bank Details (EFT / OSKO):*\n` +
      `• Bank: Commonwealth Bank of Australia\n` +
      `• Account Name: Opal Chauffeurs Australia Pty Ltd\n` +
      `• BSB: 063-000\n` +
      `• Account: 1092 8841\n` +
      `• PayID: accounts@opalchauffeurs.com.au\n\n` +
      `📞 *Accounts Enquiries:* +61 432 000 718\n` +
      `🌐 *Website:* https://www.opalchauffeurs.com.au\n\n` +
      `✅ Thank you for traveling with Opal Chauffeurs Australia!`;

    window.open(
      `https://api.whatsapp.com/send?phone=${client.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  // Email Statement Dispatch
  const handleSendEmailStatement = (client: VIPClient) => {
    const subject = encodeURIComponent(`[Opal Chauffeurs] Official Tax Invoice Statement — ${client.company_name || client.name}`);
    const body = encodeURIComponent(
      `Dear ${client.name},\n\nPlease find the summary of your account with Opal Chauffeurs Australia.\n\n` +
      `Client Account: ${client.company_name || client.name}\n` +
      `Total Outstanding Balance: $${client.pending_balance.toFixed(2)} AUD\n` +
      `Payment Terms: ${client.billing_terms}\n\n` +
      `Remittance Bank EFT Transfer Details:\n` +
      `Bank: Commonwealth Bank of Australia\n` +
      `Account Name: Opal Chauffeurs Australia Pty Ltd\n` +
      `BSB: 063-000\n` +
      `Account Number: 1092 8841\n` +
      `PayID: accounts@opalchauffeurs.com.au\n\n` +
      `Kind Regards,\nAccounts & Dispatch\nOpal Chauffeurs Australia\nPhone: +61 432 000 718\nWeb: https://www.opalchauffeurs.com.au`
    );
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Client & Customer Details Directory</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono">
              OPAL CLIENT & CUSTOMER DIRECTORY
            </span>
          </div>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            Complete customer dossiers, booking history, payment records, vehicle preferences, and corporate credit accounts.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsAddClientModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all"
        >
          <Plus className="w-4 h-4 text-[#DFCAA8]" />
          <span>+ Onboard Client / Corporate Account</span>
        </button>
      </div>

      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1">
          <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Total Registered Clients</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">{totalClientsCount} Clients</span>
          <span className="text-[11px] text-slate-700 font-bold block">{corporateCount} Corporate Accounts</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1">
          <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Corporate Net 30 Terms</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">{corporateCount} Accounts</span>
          <span className="text-[11px] text-slate-700 font-bold block">Monthly Post-Paid Billing</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1">
          <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Total Client Lifetime Spend</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">
            ${totalLifetimeSpend.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
          </span>
          <span className="text-[11px] text-slate-700 font-bold block">Across 120+ Completed Journeys</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1">
          <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider block">Total Outstanding Debt</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">
            ${totalOutstandingDebt.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
          </span>
          <span className="text-[11px] text-slate-700 font-bold block">Ready for FIFO Settlement</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, company, email, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] placeholder-slate-400 text-xs focus:outline-none focus:border-[#0A0E1A] font-bold"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'CORPORATE', 'VIP_PRIVATE', 'UNPAID'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterType(filter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                filterType === filter
                  ? 'bg-[#06090F] text-[#FAF6F0] border border-[#DFCAA8] shadow-md'
                  : 'bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#FAF6F0]'
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

      {/* Clients Directory Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border-[#E6D8C3] shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase font-mono font-black tracking-wider border-b border-[#E6D8C3]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Client / Corporate Entity</th>
                <th className="py-3.5 px-4 font-semibold">Contact & Phone</th>
                <th className="py-3.5 px-4 font-semibold">Account Type</th>
                <th className="py-3.5 px-4 font-semibold">Total Rides</th>
                <th className="py-3.5 px-4 font-semibold">Lifetime Spend</th>
                <th className="py-3.5 px-4 font-semibold">Outstanding Debt</th>
                <th className="py-3.5 px-4 font-semibold text-right">Direct Invoice & CRM Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D8C3] font-sans">
              {filteredClients.map((client) => (
                <tr key={client.id} className="bg-[#FFFFFF] hover:bg-[#FAF6F0] transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF6F0] border border-[#DFCAA8] flex items-center justify-center text-[#0A0E1A] font-bold text-xs font-mono shrink-0">
                        {client.company_name ? <Building2 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </div>
                      <div>
                        <strong className="text-[#0A0E1A] block text-xs font-black">
                          {client.company_name || client.name}
                        </strong>
                        {client.company_name && (
                          <span className="text-[11px] text-slate-700 font-semibold block">{client.name}</span>
                        )}
                        {client.abn && (
                          <span className="text-[10px] font-mono text-slate-500 block font-medium">ABN: {client.abn}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px]">
                    <span className="text-[#0A0E1A] block font-black">{client.phone}</span>
                    <span className="text-slate-600 block text-[10px] font-medium">{client.email}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-black border font-mono bg-[#FAF6F0] text-[#0A0E1A] border-[#DFCAA8]"
                    >
                      {client.client_type === 'CORPORATE' ? '🏢 CORPORATE (Net 30)' : '💎 PRIVATE VIP'}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-[#0A0E1A] font-black">
                    <strong>{client.bookings.length}</strong> Bookings
                  </td>
                  <td className="py-4 px-4 font-mono font-black text-[#0A0E1A]">
                    ${client.total_spent.toFixed(2)} AUD
                  </td>
                  <td className="py-4 px-4 font-mono font-black">
                    {client.pending_balance > 0 ? (
                      <span className="text-[#0A0E1A]">
                        ${client.pending_balance.toFixed(2)} AUD{' '}
                        <span className="block text-[10px] text-slate-700 font-bold">
                          ({client.unpaid_invoices_count} Unpaid)
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-700 font-bold">● Settle ($0.00)</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View Dossier Button */}
                      <button
                        onClick={() => setSelectedClient(client)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#06090F] hover:bg-[#121824] text-[#FAF6F0] border border-[#DFCAA8] text-xs font-black transition-all flex items-center gap-1 shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#DFCAA8]" />
                        <span>Dossier & Rides</span>
                      </button>

                      {/* Send Invoice Statement via WhatsApp */}
                      <button
                        onClick={() => handleGenerateWhatsAppStatement(client)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EBDDC8] text-[#0A0E1A] border border-[#E6D8C3] text-xs font-black transition-all flex items-center gap-1 shadow-sm"
                        title="Send Tax Invoice Statement via WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#0A0E1A]" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>

                      {/* Send Invoice Statement via Email */}
                      <button
                        onClick={() => handleSendEmailStatement(client)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EBDDC8] text-[#0A0E1A] border border-[#E6D8C3] text-xs font-black transition-all flex items-center gap-1 shadow-sm"
                        title="Send Tax Invoice Statement via Email"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#0A0E1A]" />
                        <span className="hidden sm:inline">Email</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: FULL CLIENT DOSSIER & BOOKING HISTORY
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
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs block">
                    All Booking Records & Tax Invoices ({selectedClient.bookings.length} Journeys)
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono">1-Click Invoice Dispatch Available</span>
                </div>

                <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden font-mono">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Booking Ref</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Route</th>
                        <th className="py-2.5 px-3">Chauffeur</th>
                        <th className="py-2.5 px-3">Fare (AUD)</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Tax Invoice Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      {selectedClient.bookings.map((b) => (
                        <tr key={b.booking_number} className="hover:bg-slate-900/60 font-sans">
                          <td className="py-3 px-3 font-bold text-amber-400 font-mono">
                            {b.booking_number}
                            <span className="block text-[10px] text-slate-500">{b.invoice_number}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 font-mono text-[10px]">{b.date}</td>
                          <td className="py-3 px-3 text-slate-200">
                            <span className="block font-semibold text-xs">📍 {b.pickup}</span>
                            <span className="block text-slate-400 text-[10px]">🏁 {b.dropoff}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            <strong className="text-slate-200 block text-xs">{b.chauffeur}</strong>
                            <span className="text-amber-400 text-[10px] font-mono">{b.plate}</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-100 font-mono">${b.fare.toFixed(2)}</td>
                          <td className="py-3 px-3 font-mono">
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
                          <td className="py-3 px-3 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View / Print Tax Invoice */}
                              <button
                                onClick={() => setPreviewBooking({ client: selectedClient, booking: b })}
                                className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1"
                                title="View & Print Tax Invoice"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>Invoice</span>
                              </button>

                              {/* Send Tax Invoice to WhatsApp */}
                              <a
                                href={`https://api.whatsapp.com/send?phone=${selectedClient.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(
                                  `🧾 *[OPAL CHAUFFEURS - TAX INVOICE RECEIPT]* 🚘\n\n` +
                                  `📋 *Tax Invoice:* #${b.invoice_number}\n` +
                                  `🔖 *Booking Ref:* #${b.booking_number}\n` +
                                  `👤 *Client:* ${selectedClient.company_name || selectedClient.name}\n` +
                                  `📅 *Date:* ${b.date}\n` +
                                  `📍 *Pickup:* ${b.pickup}\n` +
                                  `🏁 *Dropoff:* ${b.dropoff}\n` +
                                  `🚘 *Vehicle & Plate:* ${b.vehicle} (${b.plate})\n` +
                                  `🧑‍✈️ *Chauffeur:* ${b.chauffeur}\n` +
                                  `💰 *Total Amount (Inc 10% GST):* $${b.fare.toFixed(2)} AUD\n` +
                                  `💳 *Payment Status:* ${b.payment_status} (${b.payment_method})\n\n` +
                                  `🏦 *Bank EFT Remittance:* CBA (BSB: 063-000 • Acc: 1092 8841)\n` +
                                  `📞 *Phone:* +61 432 000 718\n\n` +
                                  `✅ Thank you for traveling with Opal Chauffeurs Australia!`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                                title="Send Ride Invoice to WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3" />
                              </a>

                              {/* Send Tax Invoice via Email */}
                              <a
                                href={`mailto:${selectedClient.email}?subject=${encodeURIComponent(
                                  `[Tax Invoice] Opal Chauffeurs Trip #${b.booking_number} — ${b.invoice_number}`
                                )}&body=${encodeURIComponent(
                                  `Dear ${selectedClient.name},\n\nPlease find the Tax Invoice details for your journey with Opal Chauffeurs Australia:\n\n` +
                                  `Tax Invoice: #${b.invoice_number}\n` +
                                  `Booking Ref: #${b.booking_number}\n` +
                                  `Date & Time: ${b.date}\n` +
                                  `Pickup: ${b.pickup}\n` +
                                  `Dropoff: ${b.dropoff}\n` +
                                  `Chauffeur: ${b.chauffeur} (${b.vehicle} - ${b.plate})\n` +
                                  `Total Fare (Inc 10% GST): $${b.fare.toFixed(2)} AUD\n` +
                                  `Payment Status: ${b.payment_status}\n\n` +
                                  `Commonwealth Bank EFT Details:\n` +
                                  `BSB: 063-000\n` +
                                  `Account: 1092 8841\n` +
                                  `PayID: accounts@opalchauffeurs.com.au\n\n` +
                                  `Thank you for traveling with Opal Chauffeurs Australia.\nPhone: +61 432 000 718\nWeb: https://www.opalchauffeurs.com.au`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30"
                                title="Send Ride Invoice via Email"
                              >
                                <Mail className="w-3 h-3" />
                              </a>
                            </div>
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
              <button
                onClick={() => handleGenerateWhatsAppStatement(selectedClient)}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>📱 Dispatch Full Statement to WhatsApp</span>
              </button>

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
          MODAL 2: PRINTABLE OFFICIAL ATO TAX INVOICE PREVIEW
      ───────────────────────────────────────────────────────────── */}
      {previewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 max-w-3xl w-full p-8 rounded-3xl space-y-5 text-xs text-slate-200 relative shadow-2xl max-h-[92vh] flex flex-col">
            <button
              onClick={() => setPreviewBooking(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="overflow-y-auto space-y-5 pr-1.5 flex-1">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-800 pb-5 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black gold-gradient-text tracking-wider">TAX INVOICE</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                        previewBooking.booking.payment_status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      ● {previewBooking.booking.payment_status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-100">Opal Chauffeurs Australia Pty Ltd</p>
                  <p className="text-[11px] text-slate-400">Trading as Opal Chauffeurs VIP Transport Network</p>
                  <p className="text-[11px] font-mono text-amber-400 font-bold">ABN: 45 123 456 789</p>
                  <p className="text-[11px] text-slate-400">Melbourne VIC • Australia</p>
                  <p className="text-[11px] text-slate-400">Phone: +61 432 000 718 • accounts@opalchauffeurs.com.au</p>
                </div>

                <div className="sm:text-right space-y-1 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/90 font-mono w-full sm:w-auto">
                  <span className="text-lg font-black text-amber-400 block">{previewBooking.booking.invoice_number}</span>
                  <span className="text-[11px] text-slate-400 block">Booking Ref: <strong className="text-slate-200">{previewBooking.booking.booking_number}</strong></span>
                  <span className="text-[11px] text-slate-400 block">Journey Date: <strong className="text-slate-300">{previewBooking.booking.date}</strong></span>
                </div>
              </div>

              {/* Billed To & Chauffeur Specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" /> Billed To (Client Account)
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">
                      {previewBooking.client.company_name || previewBooking.client.name}
                    </h4>
                    <span className="text-[11px] text-slate-300 block">Attn: {previewBooking.client.name}</span>
                    {previewBooking.client.abn && (
                      <span className="text-[11px] font-mono text-slate-400 block">Client ABN: {previewBooking.client.abn}</span>
                    )}
                    <span className="text-[11px] text-cyan-300 block">{previewBooking.client.email}</span>
                    <span className="text-[11px] font-mono text-slate-400 block">{previewBooking.client.phone}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-amber-400" /> Chauffeur & Vehicle Specs
                  </span>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Chauffeur:</span>
                      <strong className="text-slate-200">{previewBooking.booking.chauffeur}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vehicle Model:</span>
                      <strong className="text-amber-300">{previewBooking.booking.vehicle}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Registration Plate:</span>
                      <strong className="text-cyan-300 font-mono">{previewBooking.booking.plate}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Line Items */}
              <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden font-mono">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Service Description & Route</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Ex GST</th>
                      <th className="py-2.5 px-4 font-semibold text-right">10% GST</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Total (AUD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-[11px]">
                    <tr>
                      <td className="py-3 px-4">
                        <strong className="text-slate-100 block font-sans">Executive VIP Chauffeur Transfer</strong>
                        <span className="text-slate-400 block text-[10px] font-sans">📍 Pickup: {previewBooking.booking.pickup}</span>
                        <span className="text-slate-400 block text-[10px] font-sans">🏁 Dropoff: {previewBooking.booking.dropoff}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">${(previewBooking.booking.fare - previewBooking.booking.fare / 11).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-amber-400">${(previewBooking.booking.fare / 11).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-100">${previewBooking.booking.fare.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Remittance & Bank Transfer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 text-[11px]">
                  <span className="text-[10px] text-amber-400 block uppercase font-bold tracking-wider flex items-center gap-1.5 font-sans">
                    <CreditCard className="w-3.5 h-3.5" /> Remittance & EFT Payment Details
                  </span>
                  <div className="space-y-1 font-mono text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bank:</span>
                      <strong className="text-slate-200">Commonwealth Bank of Australia</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Name:</span>
                      <strong className="text-slate-200">Opal Chauffeurs Australia Pty Ltd</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">BSB:</span>
                      <strong className="text-amber-400 font-bold">063-000</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Number:</span>
                      <strong className="text-amber-400 font-bold">1092 8841</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Reference:</span>
                      <strong className="text-cyan-300 font-bold">{previewBooking.booking.invoice_number}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-right flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400 text-xs">
                      <span>Subtotal (Ex GST):</span>
                      <span>${(previewBooking.booking.fare - previewBooking.booking.fare / 11).toFixed(2)} AUD</span>
                    </div>
                    <div className="flex justify-between text-amber-400 font-bold text-xs">
                      <span>10% Australian GST (1/11th):</span>
                      <span>${(previewBooking.booking.fare / 11).toFixed(2)} AUD</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-100 text-base font-black pt-2 border-t border-slate-800">
                    <span className="uppercase text-xs font-sans">Total (Inc GST):</span>
                    <span>${previewBooking.booking.fare.toFixed(2)} AUD</span>
                  </div>
                </div>
              </div>

              {/* ATO Legal Compliance Note */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400 text-center font-sans">
                Thank you for traveling with Opal Chauffeurs Australia. All amounts are in Australian Dollars (AUD). This document serves as a compliant Tax Invoice under Section 195-1 of the Australian GST Act 1999.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800 shrink-0">
              <button
                onClick={() => setPreviewBooking(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl glow-gold-btn text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Print / Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: ONBOARD NEW VIP CLIENT / CORPORATE ACCOUNT
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
