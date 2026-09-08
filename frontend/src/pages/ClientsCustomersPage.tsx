import React, { useState, useEffect } from 'react';
import { bookingsApi, customersApi, invoicesApi } from '../services/api';
import { Customer } from '../types';
import { BANK, BANK_CONFIGURED, COMPANY, NOT_CONFIGURED } from '../config/company';
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
  Receipt,
  AlertTriangle,
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  const AEST = 'Australia/Melbourne';
  const fmtDate = (iso?: string) =>
    iso
      ? new Intl.DateTimeFormat('en-AU', {
          timeZone: AEST, day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(new Date(iso))
      : '—';

  const PAYMENT_LABEL: Record<string, ClientBookingHistory['payment_status']> = {
    PAID_IN_FULL: 'PAID',
    PARTIAL_DEPOSIT: 'PARTIALLY_PAID',
  };

  /**
   * Clients come from the customer records, with spend, balances and journey
   * history derived from their bookings and invoices.
   *
   * This screen previously held two hardcoded clients — a Rio Tinto executive
   * account and a private VIP, complete with ABNs, credit limits and invented
   * trip histories — merged with whatever a browser had in localStorage. Every
   * machine therefore showed a different client book, and a client added on one
   * was invisible on another.
   */
  const loadClients = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [customers, bookingData, invoiceData] = await Promise.all([
        customersApi.list(),
        bookingsApi.list(),
        invoicesApi.list(),
      ]);
      const bookings = bookingData?.bookings ?? [];
      const invoices = invoiceData?.invoices ?? [];

      setClients(
        customers.map((c: Customer): VIPClient => {
          const mine = bookings.filter(
            (b) => b.passenger_email === c.email || b.passenger_name === c.full_name
          );
          const theirInvoices = invoices.filter(
            (inv) => inv.customer_email === c.email || inv.customer_name === c.full_name
          );
          const open = theirInvoices.filter((inv) => !['PAID', 'VOID'].includes(inv.status));

          return {
            id: c.id,
            name: c.full_name,
            company_name: c.company_name || undefined,
            client_type: c.company_name ? 'CORPORATE' : 'VIP_PRIVATE',
            email: c.email,
            phone: c.phone,
            // Fields the customer record does not carry. Shown as unavailable
            // rather than filled with plausible-looking values.
            city: '—',
            abn: undefined,
            billing_terms: '—',
            credit_limit: 0,
            total_spent: c.total_spent ?? c.total_spend ?? 0,
            pending_balance: open.reduce((sum, inv) => sum + (inv.balance_due ?? 0), 0),
            unpaid_invoices_count: open.length,
            preferred_vehicle: '—',
            preferred_chauffeur: '—',
            vip_notes: c.notes || '',
            rating: 0,
            bookings: mine.map((b): ClientBookingHistory => {
              const leg = b.legs?.[0];
              const inv = theirInvoices.find((i) => i.booking_id === b.id);
              return {
                booking_number: b.booking_number,
                invoice_number: inv?.invoice_number || '—',
                date: fmtDate(leg?.pickup_datetime || b.created_at),
                pickup: leg?.pickup_address || '—',
                dropoff: leg?.dropoff_address || '—',
                vehicle: String(leg?.vehicle_category || '').replace(/_/g, ' ') || '—',
                plate: leg?.vehicle_plate || '—',
                chauffeur: leg?.driver_name || 'Unallocated',
                fare: b.total_fare,
                payment_status: PAYMENT_LABEL[b.payment_status] || 'UNPAID',
                payment_method: '—',
              };
            }),
          };
        })
      );
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setClients([]);
      setLoadError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Client list unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.email || isSaving) return;

    setIsSaving(true);
    setLoadError(null);
    try {
      // Saved to the database. This used to build the client locally and push
      // it into localStorage, so the record lived in one browser only.
      await customersApi.create({
        full_name: newClient.name,
        email: newClient.email,
        phone: newClient.phone,
        company_name: newClient.company_name || undefined,
        is_vip: newClient.client_type === 'VIP_PRIVATE',
        notes: [
          newClient.abn ? `ABN ${newClient.abn}` : null,
          newClient.city ? `City: ${newClient.city}` : null,
          newClient.billing_terms ? `Terms: ${newClient.billing_terms}` : null,
          newClient.preferred_vehicle ? `Preferred vehicle: ${newClient.preferred_vehicle}` : null,
          newClient.preferred_chauffeur ? `Preferred chauffeur: ${newClient.preferred_chauffeur}` : null,
          newClient.vip_notes || null,
        ].filter(Boolean).join(' | ') || undefined,
      });
      await loadClients();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setLoadError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Could not save the client (HTTP ${err.response.status}).`
            : 'Could not save the client: cannot reach the Opal Cloud Engine.'
      );
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

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

  /**
   * Remittance lines for an outgoing message.
   *
   * These used to be hardcoded as Commonwealth Bank BSB 063-000 / account
   * 1092 8841 - an account that is not this business's. Every statement and
   * every invoice sent from this screen was telling a real client to pay a
   * stranger. Nothing is quoted now unless the details are configured.
   */
  const remittanceLines = (bullet: string): string => {
    if (!BANK_CONFIGURED) return '';
    const rows = [
      `${bullet}Bank: ${BANK.name}`,
      `${bullet}Account Name: ${BANK.accountName}`,
      `${bullet}BSB: ${BANK.bsb}`,
      `${bullet}Account: ${BANK.accountNumber}`,
    ];
    if (BANK.payId) rows.push(`${bullet}PayID: ${BANK.payId}`);
    return rows.join('\n') + '\n\n';
  };

  // WhatsApp Statement Dispatch
  const handleGenerateWhatsAppStatement = (client: VIPClient) => {
    const text =
      `🧾 *[OPAL CHAUFFEURS AUSTRALIA - TAX INVOICE STATEMENT]* 🚘\n\n` +
      `🏢 *Client Account:* ${client.company_name || client.name}\n` +
      `👤 *Attn:* ${client.name}\n` +
      `💳 *Billing Terms:* ${client.billing_terms}\n` +
      `💰 *Total Outstanding Balance:* $${client.pending_balance.toFixed(2)} AUD (${client.unpaid_invoices_count} Invoices Pending)\n\n` +
      (BANK_CONFIGURED
        ? `🏦 *Remittance Bank Details (EFT / OSKO):*
` + remittanceLines('• ')
        : '') +
      `📞 *Accounts Enquiries:* ${COMPANY.phone}
` +
      `🌐 *Website:* https://www.${COMPANY.website}

` +
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
      (BANK_CONFIGURED ? `Remittance Bank EFT Transfer Details:
` + remittanceLines('') : '') +
      `Kind Regards,
Accounts & Dispatch
${COMPANY.legalName}
Phone: ${COMPANY.phone}
Web: https://www.${COMPANY.website}`
    );
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <div role="alert" className="rounded-2xl bg-[#FFFFFF] border border-[#EF4444] p-4 shadow-lg flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#0A0E1A]">Client book could not be loaded</p>
            <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">{loadError}</p>
          </div>
          <button
            onClick={loadClients}
            className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && clients.length === 0 && (
        <div className="rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-6 text-center text-[#0A0E1A]">
          <p className="text-sm font-black">No clients yet</p>
          <p className="text-xs font-bold opacity-75 mt-1">
            Clients are created here, or automatically the first time someone books.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Client & Customer Details Directory</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono">
              OPAL CLIENT & CUSTOMER DIRECTORY
            </span>
          </div>
          <p className="text-xs text-[#0A0E1A] font-bold mt-1">
            Complete customer dossiers, booking history, payment records, vehicle preferences, and corporate credit accounts.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsAddClientModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>+ Onboard Client / Corporate Account</span>
        </button>
      </div>

      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[#0A0E1A]">
        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1 text-[#0A0E1A]">
          <span className="text-[11px] font-black text-[#0A0E1A] uppercase tracking-wider block">Total Registered Clients</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">{totalClientsCount} Clients</span>
          <span className="text-[11px] text-[#0A0E1A] font-bold block">{corporateCount} Corporate Accounts</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1 text-[#0A0E1A]">
          <span className="text-[11px] font-black text-[#0A0E1A] uppercase tracking-wider block">Corporate Net 30 Terms</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">{corporateCount} Accounts</span>
          <span className="text-[11px] text-[#0A0E1A] font-bold block">Monthly Post-Paid Billing</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1 text-[#0A0E1A]">
          <span className="text-[11px] font-black text-[#0A0E1A] uppercase tracking-wider block">Total Client Lifetime Spend</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">
            ${totalLifetimeSpend.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
          </span>
          <span className="text-[11px] text-[#0A0E1A] font-bold block">Across 120+ Completed Journeys</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] shadow-lg space-y-1 text-[#0A0E1A]">
          <span className="text-[11px] font-black text-[#0A0E1A] uppercase tracking-wider block">Total Outstanding Debt</span>
          <span className="text-2xl font-mono font-black text-[#0A0E1A] block">
            ${totalOutstandingDebt.toLocaleString('en-AU', { minimumFractionDigits: 2 })} AUD
          </span>
          <span className="text-[11px] text-[#0A0E1A] font-bold block">Ready for FIFO Settlement</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg text-[#0A0E1A]">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#0A0E1A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by client name, company, email, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] placeholder-[#0A0E1A]/50 text-xs focus:outline-none focus:border-[#0A0E1A] font-bold"
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
                  ? 'bg-[#06090F] text-white border border-[#DFCAA8] shadow-md'
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
      <div className="glass-panel rounded-2xl overflow-hidden border-[#E6D8C3] shadow-xl text-[#0A0E1A]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase font-mono font-black tracking-wider border-b border-[#E6D8C3]">
              <tr>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Client / Corporate Entity</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Contact & Phone</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Account Type</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Total Rides</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Lifetime Spend</th>
                <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Outstanding Debt</th>
                <th className="py-3.5 px-4 font-black text-right text-[#0A0E1A]">Direct Invoice & CRM Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D8C3] font-sans">
              {filteredClients.map((client) => (
                <tr key={client.id} className="bg-[#FFFFFF] hover:bg-[#F5EDE0] transition-colors">
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
                          <span className="text-[11px] text-[#0A0E1A] font-bold block">{client.name}</span>
                        )}
                        {client.abn && (
                          <span className="text-[10px] font-mono text-[#0A0E1A] block font-bold">ABN: {client.abn}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px]">
                    <span className="text-[#0A0E1A] block font-black">{client.phone}</span>
                    <span className="text-[#0A0E1A] block text-[10px] font-bold">{client.email}</span>
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
                        <span className="block text-[10px] text-[#0A0E1A] font-bold">
                          ({client.unpaid_invoices_count} Unpaid)
                        </span>
                      </span>
                    ) : (
                      <span className="text-[#0A0E1A] font-bold">● Settle ($0.00)</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View Dossier Button */}
                      <button
                        onClick={() => setSelectedClient(client)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] text-xs font-black transition-all flex items-center gap-1 shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-white" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-4xl shadow-2xl space-y-5 max-h-[90vh] flex flex-col text-xs text-[#0A0E1A]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <Building2 className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-[#0A0E1A]">
                      {selectedClient.company_name || selectedClient.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-mono font-black text-[10px] shadow-sm">
                      ⭐ {selectedClient.rating} VIP
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 font-bold">
                    Attn: {selectedClient.name} • Phone: {selectedClient.phone} • Email: {selectedClient.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-slate-400 hover:text-[#0A0E1A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Dossier Body */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              {/* Financial & Contract Specs Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#FFFFFF] p-4 rounded-2xl border border-[#E6D8C3] font-mono shadow-sm">
                <div>
                  <span className="text-[#0A0E1A] block text-[10px] uppercase font-bold">Billing Terms</span>
                  <strong className="text-[#0A0E1A] font-black">{selectedClient.billing_terms}</strong>
                </div>
                <div>
                  <span className="text-[#0A0E1A] block text-[10px] uppercase font-bold">Total Spent</span>
                  <strong className="text-[#0A0E1A] font-black">${selectedClient.total_spent.toFixed(2)} AUD</strong>
                </div>
                <div>
                  <span className="text-[#0A0E1A] block text-[10px] uppercase font-bold">Pending Debt</span>
                  <strong className="text-[#0A0E1A] font-black">${selectedClient.pending_balance.toFixed(2)} AUD</strong>
                </div>
                <div>
                  <span className="text-[#0A0E1A] block text-[10px] uppercase font-bold">Total Bookings</span>
                  <strong className="text-[#0A0E1A] font-black">{selectedClient.bookings.length} Trips</strong>
                </div>
              </div>

              {/* VIP Preferences Card */}
              <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] space-y-2 shadow-sm text-[#0A0E1A]">
                <span className="font-black text-[#0A0E1A] text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0A0E1A]" /> VIP Preferences & Dedicated Chauffeur Allocation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[#0A0E1A]">
                  <div>
                    <span className="text-[#0A0E1A] block font-bold">Preferred Fleet Model:</span>
                    <strong className="text-[#0A0E1A] font-black">{selectedClient.preferred_vehicle}</strong>
                  </div>
                  <div>
                    <span className="text-[#0A0E1A] block font-bold">Dedicated Chauffeur:</span>
                    <strong className="text-[#0A0E1A] font-black">{selectedClient.preferred_chauffeur}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-[#0A0E1A] pt-1 border-t border-[#E6D8C3] font-bold italic">
                  📝 "{selectedClient.vip_notes}"
                </p>
              </div>

              {/* Bookings & Rides History Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#0A0E1A] text-xs block">
                    All Booking Records & Tax Invoices ({selectedClient.bookings.length} Journeys)
                  </span>
                  <span className="text-[10px] text-[#0A0E1A] font-mono font-bold">1-Click Invoice Dispatch Available</span>
                </div>

                <div className="rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] overflow-hidden font-mono shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase text-[10px] font-black border-b border-[#E6D8C3]">
                      <tr>
                        <th className="py-2.5 px-3 text-[#0A0E1A]">Booking Ref</th>
                        <th className="py-2.5 px-3 text-[#0A0E1A]">Date & Time</th>
                        <th className="py-2.5 px-3 text-[#0A0E1A]">Route</th>
                        <th className="py-2.5 px-3 text-[#0A0E1A]">Chauffeur</th>
                        <th className="py-2.5 px-3 text-[#0A0E1A]">Fare (AUD)</th>
                        <th className="py-2.5 px-3 text-[#0A0E1A]">Status</th>
                        <th className="py-2.5 px-3 text-right text-[#0A0E1A]">Tax Invoice Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D8C3] text-[11px]">
                      {selectedClient.bookings.map((b) => (
                        <tr key={b.booking_number} className="hover:bg-[#F5EDE0] font-sans">
                          <td className="py-3 px-3 font-black text-[#0A0E1A] font-mono">
                            {b.booking_number}
                            <span className="block text-[10px] text-[#0A0E1A] font-bold">{b.invoice_number}</span>
                          </td>
                          <td className="py-3 px-3 text-[#0A0E1A] font-mono text-[10px] font-bold">{b.date}</td>
                          <td className="py-3 px-3 text-[#0A0E1A]">
                            <span className="block font-black text-xs text-[#0A0E1A]">📍 {b.pickup}</span>
                            <span className="block text-[#0A0E1A] text-[10px] font-bold">🏁 {b.dropoff}</span>
                          </td>
                          <td className="py-3 px-3 text-[#0A0E1A]">
                            <strong className="text-[#0A0E1A] block text-xs">{b.chauffeur}</strong>
                            <span className="text-[#0A0E1A] text-[10px] font-mono font-bold">{b.plate}</span>
                          </td>
                          <td className="py-3 px-3 font-black text-[#0A0E1A] font-mono">${b.fare.toFixed(2)}</td>
                          <td className="py-3 px-3 font-mono">
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FAF6F0] text-[#0A0E1A] border border-[#DFCAA8]"
                            >
                              ● {b.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View / Print Tax Invoice */}
                              <button
                                onClick={() => setPreviewBooking({ client: selectedClient, booking: b })}
                                className="px-2.5 py-1 rounded-xl bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] text-[10px] font-black flex items-center gap-1 shadow-sm"
                                title="View & Print Tax Invoice"
                              >
                                <Receipt className="w-3 h-3 text-white" />
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
                                  (BANK_CONFIGURED
                                    ? `🏦 *Bank EFT Remittance:* ${BANK.name} (BSB: ${BANK.bsb} • Acc: ${BANK.accountNumber})
`
                                    : '') +
                                  `📞 *Phone:* ${COMPANY.phone}

` +
                                  `✅ Thank you for traveling with Opal Chauffeurs Australia!`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] shadow-sm"
                                title="Send Ride Invoice to WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-[#0A0E1A]" />
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
                                  (BANK_CONFIGURED ? `Bank EFT Details:
` + remittanceLines('') : '') +
                                  `Thank you for traveling with ${COMPANY.legalName}.
Phone: ${COMPANY.phone}
Web: https://www.${COMPANY.website}`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] shadow-sm"
                                title="Send Ride Invoice via Email"
                              >
                                <Mail className="w-3.5 h-3.5 text-[#0A0E1A]" />
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
            <div className="flex justify-between items-center pt-3 border-t border-[#E6D8C3]">
              <button
                onClick={() => handleGenerateWhatsAppStatement(selectedClient)}
                className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.01] transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5 text-white" />
                <span>📱 Dispatch Full Statement to WhatsApp</span>
              </button>

              <button
                onClick={() => setSelectedClient(null)}
                className="px-5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] text-xs font-black shadow-sm transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] max-w-3xl w-full p-8 rounded-3xl space-y-5 text-xs text-[#0A0E1A] relative shadow-2xl max-h-[92vh] flex flex-col">
            <button
              onClick={() => setPreviewBooking(null)}
              className="absolute top-5 right-5 text-[#0A0E1A] hover:bg-[#E6D8C3] p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm transition-all"
            >
              <X className="w-5 h-5 text-[#0A0E1A]" />
            </button>

            <div className="overflow-y-auto space-y-5 pr-1.5 flex-1">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-[#E6D8C3] pb-5 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-[#0A0E1A] tracking-wider">TAX INVOICE</h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8]"
                    >
                      ● {previewBooking.booking.payment_status}
                    </span>
                  </div>
                  {/* Was hardcoded, and the ABN was invented ("45 123 456 789"),
                      which makes the document invalid as a tax invoice. */}
                  <p className="text-sm font-black text-[#0A0E1A]">{COMPANY.legalName}</p>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">{COMPANY.tradingAs}</p>
                  <p className="text-[11px] font-mono text-[#0A0E1A] font-black">ABN: {COMPANY.abn}</p>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">{COMPANY.location}</p>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">Phone: {COMPANY.phone} • {COMPANY.email}</p>
                </div>

                <div className="sm:text-right space-y-1 bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#E6D8C3] font-mono w-full sm:w-auto shadow-sm">
                  <span className="text-lg font-black text-[#0A0E1A] block">{previewBooking.booking.invoice_number}</span>
                  <span className="text-[11px] text-[#0A0E1A] block font-bold">Booking Ref: <strong className="text-[#0A0E1A]">{previewBooking.booking.booking_number}</strong></span>
                  <span className="text-[11px] text-[#0A0E1A] block font-bold">Journey Date: <strong className="text-[#0A0E1A]">{previewBooking.booking.date}</strong></span>
                </div>
              </div>

              {/* Billed To & Chauffeur Specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#0A0E1A]" /> Billed To (Client Account)
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-[#0A0E1A]">
                      {previewBooking.client.company_name || previewBooking.client.name}
                    </h4>
                    <span className="text-[11px] text-[#0A0E1A] font-bold block">Attn: {previewBooking.client.name}</span>
                    {previewBooking.client.abn && (
                      <span className="text-[11px] font-mono text-[#0A0E1A] font-bold block">Client ABN: {previewBooking.client.abn}</span>
                    )}
                    <span className="text-[11px] text-[#0A0E1A] font-bold block">{previewBooking.client.email}</span>
                    <span className="text-[11px] font-mono text-[#0A0E1A] font-bold block">{previewBooking.client.phone}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-[#0A0E1A]" /> Chauffeur & Vehicle Specs
                  </span>
                  <div className="space-y-1 text-[11px] text-[#0A0E1A]">
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A] font-bold">Assigned Chauffeur:</span>
                      <strong className="text-[#0A0E1A] font-black">{previewBooking.booking.chauffeur}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A] font-bold">Vehicle Model:</span>
                      <strong className="text-[#0A0E1A] font-black">{previewBooking.booking.vehicle}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A] font-bold">Registration Plate:</span>
                      <span className="font-mono text-[#0A0E1A] font-black">{previewBooking.booking.plate}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Line Items */}
              <div className="rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] overflow-hidden font-mono shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase text-[10px] font-black border-b border-[#E6D8C3]">
                    <tr>
                      <th className="py-2.5 px-4 font-black">Service Description & Route</th>
                      <th className="py-2.5 px-4 font-black text-right">Ex GST</th>
                      <th className="py-2.5 px-4 font-black text-right">10% GST</th>
                      <th className="py-2.5 px-4 font-black text-right">Total (AUD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6D8C3] text-[11px]">
                    <tr>
                      <td className="py-3 px-4">
                        <strong className="text-[#0A0E1A] block font-sans font-black">Executive VIP Chauffeur Transfer</strong>
                        <span className="text-[#0A0E1A] block text-[10px] font-sans font-bold">📍 Pickup: {previewBooking.booking.pickup}</span>
                        <span className="text-[#0A0E1A] block text-[10px] font-sans font-bold">🏁 Dropoff: {previewBooking.booking.dropoff}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-[#0A0E1A] font-black">${(previewBooking.booking.fare - previewBooking.booking.fare / 11).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-[#0A0E1A] font-black">${(previewBooking.booking.fare / 11).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-black text-[#0A0E1A]">${previewBooking.booking.fare.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Remittance & Bank Transfer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 text-[11px] shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] text-[#0A0E1A] block uppercase font-black tracking-wider flex items-center gap-1.5 font-sans">
                    <CreditCard className="w-3.5 h-3.5 text-[#0A0E1A]" /> Remittance & EFT Payment Details
                  </span>
                  <div className="space-y-1 font-mono text-[#0A0E1A] font-bold">
                    {!BANK_CONFIGURED && (
                      <p className="text-[10px] font-sans font-bold text-[#B91C1C]">
                        Remittance details are not configured. Do not send this invoice yet — a client paying
                        against placeholder details pays the wrong account.
                      </p>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">Bank:</span>
                      <strong className="text-[#0A0E1A] font-black">{BANK.name || NOT_CONFIGURED}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">Account Name:</span>
                      <strong className="text-[#0A0E1A] font-black">{BANK.accountName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">BSB:</span>
                      <strong className="text-[#0A0E1A] font-black">{BANK.bsb || NOT_CONFIGURED}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">Account Number:</span>
                      <strong className="text-[#0A0E1A] font-black">{BANK.accountNumber || NOT_CONFIGURED}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">Reference:</span>
                      <strong className="text-[#0A0E1A] font-black">{previewBooking.booking.invoice_number}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 font-mono text-right flex flex-col justify-between shadow-sm text-[#0A0E1A]">
                  <div className="space-y-1.5 text-[#0A0E1A]">
                    <div className="flex justify-between text-[#0A0E1A] text-xs font-bold">
                      <span>Subtotal (Ex GST):</span>
                      <span className="font-black">${(previewBooking.booking.fare - previewBooking.booking.fare / 11).toFixed(2)} AUD</span>
                    </div>
                    <div className="flex justify-between text-[#0A0E1A] font-black text-xs">
                      <span>10% Australian GST (1/11th):</span>
                      <span>${(previewBooking.booking.fare / 11).toFixed(2)} AUD</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[#0A0E1A] text-base font-black pt-2 border-t border-[#E6D8C3]">
                    <span className="uppercase text-xs font-sans font-black">Total (Inc GST):</span>
                    <span>${previewBooking.booking.fare.toFixed(2)} AUD</span>
                  </div>
                </div>
              </div>

              {/* ATO Legal Compliance Note */}
              <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[10px] text-[#0A0E1A] text-center font-sans font-bold shadow-sm">
                Thank you for traveling with Opal Chauffeurs Australia. All amounts are in Australian Dollars (AUD). This document serves as a compliant Tax Invoice under Section 195-1 of the Australian GST Act 1999.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#E6D8C3] shrink-0">
              <button
                onClick={() => setPreviewBooking(null)}
                className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] font-black text-xs shadow-sm transition-all"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
              >
                <Download className="w-3.5 h-3.5 text-white" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-xs text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <UserCheck className="w-5 h-5 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">Onboard VIP Client / Corporate</h3>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">Setup customer dossier, credit limit & preferences</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddClientModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#E6D8C3]"
              >
                <X className="w-4 h-4 text-[#0A0E1A]" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Client / Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Sterling"
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Company / Entity</label>
                  <input
                    type="text"
                    placeholder="e.g. KPMG Australia / Private"
                    value={newClient.company_name}
                    onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="client@company.com.au"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+61 400 000 000"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-black focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Account Type</label>
                  <select
                    value={newClient.client_type}
                    onChange={(e) => setNewClient({ ...newClient, client_type: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black"
                  >
                    <option value="CORPORATE" className="text-[#0A0E1A]">Corporate Net 30</option>
                    <option value="VIP_PRIVATE" className="text-[#0A0E1A]">Private VIP Client</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    value={newClient.credit_limit}
                    onChange={(e) => setNewClient({ ...newClient, credit_limit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">Client ABN</label>
                  <input
                    type="text"
                    placeholder="12 345 678 901"
                    value={newClient.abn}
                    onChange={(e) => setNewClient({ ...newClient, abn: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#0A0E1A] block uppercase font-black mb-1">VIP Notes & Preferences</label>
                <textarea
                  rows={2}
                  value={newClient.vip_notes}
                  onChange={(e) => setNewClient({ ...newClient, vip_notes: e.target.value })}
                  placeholder="Special amenities, temperature, airport meet requirements..."
                  className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E6D8C3]">
                <button
                  type="button"
                  onClick={() => setIsAddClientModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] font-black text-xs shadow-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" /> Save Client Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
