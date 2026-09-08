import React, { useEffect, useState } from 'react';
import { customersApi, invoicesApi } from '../services/api';
import { Customer, Invoice, TaxSummaryBASReport } from '../types';
import {
  ReceiptText,
  DollarSign,
  FileCheck,
  Download,
  Calendar,
  Layers,
  ArrowDownRight,
  Shield,
  CheckCircle2,
  X,
  CreditCard,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Car,
  Plane,
  Clock,
  Printer,
  AlertCircle,
  Plus,
  ArrowRight,
  Check,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';

/** Current BAS quarter. Kept in one place so the label and the query agree. */
const BAS_PERIOD = { from: '2026-07-01', to: '2026-09-30' };

interface CorporateCreditAccount {
  id: string;
  company_name: string;
  account_code: string;
  contact_person: string;
  email: string;
  phone: string;
  abn: string;
  billing_terms: string;
  credit_limit: number;
  total_pending_balance: number;
  unpaid_invoices_count: number;
  overdue_amount: number;
  status: 'CURRENT' | 'OVERDUE' | 'NEAR_LIMIT';
}

export const InvoicingTaxPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [basError, setBasError] = useState<string | null>(null);
  const [fifoError, setFifoError] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [basReport, setBasReport] = useState<TaxSummaryBASReport | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'fifo' | 'bas'>('invoices');

  // Monthly Corporate Credit Accounts Directory State
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateCreditAccount[]>([]);
  const [isCreditAccountsModalOpen, setIsCreditAccountsModalOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  // New Corporate Account Form
  const [newAccount, setNewAccount] = useState({
    company_name: '',
    account_code: '',
    contact_person: '',
    email: '',
    phone: '',
    abn: '',
    billing_terms: 'Monthly (End of Month / Net 30)',
    credit_limit: 25000,
    initial_pending_balance: 0,
  });

  // FIFO Remittance State
  const [fifoCustomerId, setFifoCustomerId] = useState('');
  const [fifoAmount, setFifoAmount] = useState<number>(0);
  const [fifoPaymentMethod, setFifoPaymentMethod] = useState('EFT_BANK_TRANSFER');
  const [fifoResult, setFifoResult] = useState<any>(null);

  // Selected Invoice Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInvoicingData();
    loadCorporateAccounts();
  }, []);

  // Corporate accounts are customers in the database. They used to be a
  // hardcoded Rio Tinto record plus whatever a browser had in localStorage, so
  // every machine showed a different client list.
  const loadCorporateAccounts = async () => {
    try {
      const [customers, invoiceData] = await Promise.all([
        customersApi.list(),
        invoicesApi.list(),
      ]);
      const open = (invoiceData?.invoices ?? []).filter(
        (inv: Invoice) => !['PAID', 'VOID'].includes(inv.status)
      );
      setCorporateAccounts(
        customers.map((c: Customer) => {
          const theirs = open.filter(
            (inv: Invoice) => inv.customer_email === c.email || inv.customer_name === c.full_name
          );
          return {
            id: c.id,
            company_name: c.company_name || c.full_name,
            // Not fields the customer record carries — shown as unavailable
            // rather than invented.
            account_code: '—',
            contact_person: c.full_name,
            email: c.email,
            phone: c.phone,
            abn: '—',
            billing_terms: '—',
            credit_limit: 0,
            total_pending_balance: theirs.reduce((sum: number, inv: Invoice) => sum + (inv.balance_due ?? 0), 0),
            unpaid_invoices_count: theirs.length,
            overdue_amount: theirs
              .filter((inv: Invoice) => inv.status === 'OVERDUE')
              .reduce((sum: number, inv: Invoice) => sum + (inv.balance_due ?? 0), 0),
            status: theirs.some((inv: Invoice) => inv.status === 'OVERDUE') ? 'OVERDUE' : 'CURRENT',
          } as CorporateCreditAccount;
        })
      );
    } catch {
      setCorporateAccounts([]);
    }
  };

  const loadInvoicingData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await invoicesApi.list();
      // An empty ledger is a real answer. This used to fall through to eight
      // fabricated ATO invoices carrying real-looking ABNs.
      setInvoices(data?.invoices ?? []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setInvoices([]);
      setLoadError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Invoices unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    }

    try {
      const bas = await invoicesApi.getTaxSummary(BAS_PERIOD.from, BAS_PERIOD.to);
      setBasReport(bas);
      setBasError(null);
    } catch (err: any) {
      // A BAS report is filed with the ATO. Inventing $24,500 of sales and
      // $2,227.27 of GST when the query fails is not a display fallback, it is
      // a fabricated tax figure.
      const detail = err?.response?.data?.detail;
      setBasReport(null);
      setBasError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `BAS summary unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteFIFO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSettling) return;
    setIsSettling(true);
    setFifoError(null);
    try {
      const res = await invoicesApi.allocateFIFO({
        customer_id: fifoCustomerId,
        payment_amount: fifoAmount,
        payment_method: fifoPaymentMethod,
        reference_number: `REM-${Date.now()}`,
      });
      setFifoResult(res);
      loadInvoicingData();
      loadCorporateAccounts();
    } catch (err: any) {
      // This is a money movement. The previous version answered a failed
      // allocation with settlement_status "SUCCESS" and "invoices_cleared: 2",
      // so a payment the ledger never recorded was reported as reconciled
      // against two invoices that were still outstanding.
      const detail = err?.response?.data?.detail;
      setFifoResult(null);
      setFifoError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Allocation failed (HTTP ${err.response.status}). No payment has been recorded.`
            : 'Allocation failed: cannot reach the Opal Cloud Engine. No payment has been recorded.'
      );
    } finally {
      setIsSettling(false);
    }
  };

  const handleQuickSettleAccount = (acc: CorporateCreditAccount) => {
    setFifoCustomerId(acc.id);
    setFifoAmount(acc.total_pending_balance);
    setIsCreditAccountsModalOpen(false);
  };

  // Add Corporate Account Handler. Creates a customer in the database — this
  // used to write to localStorage, so the account existed only in the browser
  // that created it and vanished when site data was cleared.
  const handleCreateCorporateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.company_name || !newAccount.contact_person || isSettling) return;

    setIsSettling(true);
    setLoadError(null);
    try {
      await customersApi.create({
        full_name: newAccount.contact_person,
        email: newAccount.email,
        phone: newAccount.phone,
        company_name: newAccount.company_name,
        notes: [
          newAccount.abn ? `ABN ${newAccount.abn}` : null,
          newAccount.billing_terms ? `Terms: ${newAccount.billing_terms}` : null,
          newAccount.account_code ? `Account code: ${newAccount.account_code}` : null,
        ].filter(Boolean).join(' | ') || undefined,
      });
      await loadCorporateAccounts();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setLoadError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Could not create the account (HTTP ${err.response.status}).`
            : 'Could not create the account: cannot reach the Opal Cloud Engine.'
      );
      setIsSettling(false);
      return;
    }
    setIsSettling(false);

    setIsAddAccountOpen(false);
    setNewAccount({
      company_name: '',
      account_code: '',
      contact_person: '',
      email: '',
      phone: '',
      abn: '',
      billing_terms: 'Monthly (End of Month / Net 30)',
      credit_limit: 25000,
      initial_pending_balance: 0,
    });
  };

  // Total pending corporate debt across all accounts
  const totalPendingCorporateDebt = corporateAccounts.reduce((sum, a) => sum + a.total_pending_balance, 0);
  const selectedAccountDetails = corporateAccounts.find(a => a.id === fifoCustomerId);

  const outstandingInvoices = invoices.filter((inv) => !['PAID', 'VOID'].includes(inv.status));
  const outstandingCount = outstandingInvoices.length;
  const outstandingBalance = outstandingInvoices.reduce((sum, inv) => sum + (inv.balance_due ?? 0), 0);

  return (
    <div className="space-y-6">
      {(loadError || basError || fifoError) && (
        <div role="alert" className="rounded-2xl bg-[#FFFFFF] border border-[#EF4444] p-4 shadow-lg space-y-2.5">
          {loadError && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-[#0A0E1A]">Invoice ledger could not be loaded</p>
                <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">{loadError}</p>
              </div>
              <button
                onClick={() => { loadInvoicingData(); loadCorporateAccounts(); }}
                className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {basError && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-black text-[#0A0E1A]">BAS summary could not be loaded</p>
                <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">
                  {basError} No figures are shown — do not file from this screen until it loads.
                </p>
              </div>
            </div>
          )}
          {fifoError && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-black text-[#0A0E1A]">Payment was NOT allocated</p>
                <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">{fifoError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !loadError && invoices.length === 0 && (
        <div className="rounded-2xl bg-[#FAF6F0] border border-[#E6D8C3] p-6 text-center text-[#0A0E1A]">
          <p className="text-sm font-black">No invoices yet</p>
          <p className="text-xs font-bold opacity-75 mt-1">
            Tax invoices appear here once they are generated from completed bookings.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Accounting, Invoicing & Tax (GST) Engine</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono shadow-sm">
              ATO BAS & 1/11th GST READY
            </span>
          </div>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            Sequential Tax Invoices (`INV-YYYY-XXXX`), Oldest-Invoice-First (FIFO) Debt Allocation, Driver RCTIs and BAS summaries.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex p-1 bg-[#06090F] rounded-xl border border-[#1E2738]">
          {(['invoices', 'fifo', 'bas'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs transition-all ${
                activeTab === tab ? 'bg-[#DFCAA8] text-[#0A0E1A] font-black shadow-md' : 'text-slate-400 hover:text-white font-bold'
              }`}
            >
              {tab === 'invoices' ? 'Tax Invoices' : tab === 'fifo' ? 'FIFO Debt Allocation' : 'Quarterly BAS Summary'}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: TAX INVOICES TABLE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <div className="glass-panel rounded-2xl overflow-hidden border-[#E6D8C3] shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase font-mono font-black tracking-wider border-b border-[#E6D8C3]">
                <tr>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Invoice No</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Client / Account</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Issue / Due Date</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Status</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Subtotal (Ex GST)</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">10% GST</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Total (Inc GST)</th>
                  <th className="py-3.5 px-4 font-black text-[#0A0E1A]">Balance Due</th>
                  <th className="py-3.5 px-4 font-black text-right text-[#0A0E1A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D8C3] font-mono bg-[#FFFFFF]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F5EDE0] transition-colors">
                    <td className="py-4 px-4 font-black text-[#0A0E1A]">
                      {inv.invoice_number}
                      {inv.booking_number && (
                        <span className="block text-[10px] text-[#0A0E1A] font-bold">{inv.booking_number}</span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-sans">
                      <span className="font-black text-[#0A0E1A] block text-xs">{inv.customer_company || inv.customer_name || 'VIP Client'}</span>
                      <span className="text-[11px] text-[#0A0E1A] font-bold block">{inv.passenger_name || inv.customer_name}</span>
                    </td>
                    <td className="py-4 px-4 text-[#0A0E1A] font-bold">
                      {inv.issue_date} <span className="text-[#0A0E1A] block text-[10px] font-bold">Due: {inv.due_date}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-black border font-mono bg-[#FFFFFF] text-[#0A0E1A] border-[#DFCAA8]"
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#0A0E1A] font-black">${inv.subtotal_ex_gst.toFixed(2)}</td>
                    <td className="py-4 px-4 text-[#0A0E1A] font-black">${inv.gst_amount.toFixed(2)}</td>
                    <td className="py-4 px-4 font-black text-[#0A0E1A]">${inv.total_inc_gst.toFixed(2)}</td>
                    <td className="py-4 px-4 font-black text-[#0A0E1A]">${inv.balance_due.toFixed(2)}</td>
                    <td className="py-4 px-4 text-right font-sans">
                      <button
                        onClick={() => setPreviewInvoice(inv)}
                        className="px-3.5 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs transition-all shadow-md active:scale-95"
                      >
                        View Tax Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: FIFO DEBT ALLOCATION & CORPORATE ACCOUNTS DIRECTORY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'fifo' && (
        <div className="space-y-5">
          {/* Top Banner: Corporate Monthly Accounts Button & Pending Total */}
          <div className="glass-panel p-5 rounded-2xl border-[#E6D8C3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                <Building2 className="w-6 h-6 text-[#0A0E1A]" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#0A0E1A]">Monthly Post-Paid Corporate Directory</h3>
                <p className="text-xs text-slate-700 font-semibold">
                  {corporateAccounts.length} Companies on Net 30/EOM terms • Total Outstanding Debt:{' '}
                  <strong className="text-[#0A0E1A] font-mono font-black">${totalPendingCorporateDebt.toFixed(2)} AUD</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => setIsCreditAccountsModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-2 shadow-md hover:scale-[1.02] transition-all"
              >
                <Building2 className="w-4 h-4 text-[#DFCAA8]" />
                <span>View Monthly Accounts & Balances ({corporateAccounts.length})</span>
              </button>
              <button
                onClick={() => setIsAddAccountOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-[#7B6035]" />
                <span>+ Add Account</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: FIFO Execution Box */}
            <div className="md:col-span-6 glass-panel-gold p-6 rounded-2xl space-y-4 text-xs shadow-xl border-[#DFCAA8]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-[#0A0E1A]">FIFO Lump-Sum Remittance Tool</h3>
                <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] shadow-sm">
                  AUTO-SETTLEMENT
                </span>
              </div>
              <p className="text-slate-700 font-semibold">
                Allocates customer bulk payments against their oldest outstanding tax invoices automatically to maintain clean accounts.
              </p>

              <form onSubmit={handleExecuteFIFO} className="space-y-4 pt-1">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Corporate Client Account</label>
                  <select
                    value={fifoCustomerId}
                    onChange={(e) => {
                      setFifoCustomerId(e.target.value);
                      const acc = corporateAccounts.find(a => a.id === e.target.value);
                      if (acc) setFifoAmount(acc.total_pending_balance);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] font-bold text-xs focus:outline-none focus:border-[#0A0E1A]"
                  >
                    {corporateAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.company_name} (Pending: ${acc.total_pending_balance.toFixed(2)} AUD)
                      </option>
                    ))}
                  </select>

                  {selectedAccountDetails && (
                    <div className="mt-2.5 p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex items-center justify-between text-[11px] text-[#0A0E1A]">
                      <div>
                        <span className="text-[#0A0E1A] block font-mono font-bold">
                          Terms: <strong className="text-[#0A0E1A]">{selectedAccountDetails.billing_terms}</strong>
                        </span>
                        <span className="text-[#0A0E1A] block font-mono font-bold">
                          Unpaid Invoices: <strong className="text-[#0A0E1A]">{selectedAccountDetails.unpaid_invoices_count} Pending</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#0A0E1A] uppercase font-black block">Current Balance</span>
                        <span className="text-sm font-mono font-black text-[#0A0E1A]">
                          ${selectedAccountDetails.total_pending_balance.toFixed(2)} AUD
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1 text-[#0A0E1A]">
                    <label className="font-bold text-[#0A0E1A]">Payment Amount Remitted ($ AUD)</label>
                    {selectedAccountDetails && (
                      <button
                        type="button"
                        onClick={() => setFifoAmount(selectedAccountDetails.total_pending_balance)}
                        className="text-[10px] text-[#0A0E1A] hover:underline font-black"
                      >
                        Settle Full Balance (${selectedAccountDetails.total_pending_balance.toFixed(2)})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500.00"
                    value={fifoAmount || ''}
                    onChange={(e) => setFifoAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-black text-sm focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-[#FFFFFF] font-black text-xs flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] transition-all"
                >
                  <Layers className="w-4 h-4 text-[#DFCAA8]" />
                  <span>Execute Oldest-First FIFO Allocation</span>
                </button>
              </form>
            </div>

            <div className="md:col-span-6 glass-panel p-6 rounded-2xl space-y-4 text-xs shadow-xl flex flex-col justify-between border-[#E6D8C3] text-[#0A0E1A]">
              <div>
                <h3 className="text-base font-black text-[#0A0E1A]">FIFO Allocation Result</h3>
                <p className="text-[#0A0E1A] font-bold mt-1">Real-time ledger settlement verification</p>
              </div>

              {fifoResult ? (
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] space-y-3">
                  <div className="flex items-center gap-2 font-black text-sm text-[#0A0E1A]">
                    <CheckCircle2 className="w-5 h-5 text-[#0A0E1A]" />
                    <span>{fifoResult.message}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] space-y-1.5 font-mono text-xs text-[#0A0E1A]">
                    <div className="flex justify-between text-[#0A0E1A]">
                      <span>Allocated Amount:</span>
                      <strong className="text-[#0A0E1A] font-black">${fifoAmount.toFixed(2)} AUD</strong>
                    </div>
                    <div className="flex justify-between text-[#0A0E1A]">
                      <span>Invoices Cleared:</span>
                      <strong className="text-[#0A0E1A] font-black">{fifoResult.invoices_cleared} Invoices Marked PAID</strong>
                    </div>
                    <div className="flex justify-between text-[#0A0E1A]">
                      <span>Remaining Unallocated Credit:</span>
                      <strong className="text-[#0A0E1A] font-black">$0.00 AUD</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center text-[#0A0E1A] font-bold italic bg-[#FFFFFF] rounded-2xl border border-[#E6D8C3]">
                  Select a company above, enter payment amount, and execute FIFO to clear debts sequentially.
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[11px] text-[#0A0E1A] space-y-1 font-mono font-bold">
                <div className="flex justify-between">
                  <span className="text-[#0A0E1A]">Outstanding invoices:</span>
                  <span className="text-[#0A0E1A] font-black">{outstandingCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0A0E1A]">Total balance due:</span>
                  <span className="text-[#0A0E1A] font-black">${outstandingBalance.toFixed(2)} AUD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: QUARTERLY BAS SUMMARY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bas' && basReport && (
        <div className="glass-panel p-6 rounded-2xl space-y-6 text-xs shadow-xl border-[#E6D8C3] text-[#0A0E1A]">
          <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-4">
            <div>
              <h3 className="text-base font-black text-[#0A0E1A]">Australian Business Activity Statement (BAS) Summary</h3>
              <p className="text-[#0A0E1A] font-bold mt-0.5">{basReport.period_label}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8] font-black font-mono">
              ATO COMPLIANT 10%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
              <span className="text-[#0A0E1A] font-bold block">G1 Total Sales (Inc GST)</span>
              <span className="text-xl font-mono font-black text-[#0A0E1A]">${basReport.gross_sales_inc_gst.toFixed(2)}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
              <span className="text-[#0A0E1A] font-bold block">1A GST on Sales (1/11th)</span>
              <span className="text-xl font-mono font-black text-[#0A0E1A]">${basReport.gst_collected_10pct.toFixed(2)}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
              <span className="text-[#0A0E1A] font-bold block">Net Sales (Ex GST)</span>
              <span className="text-xl font-mono font-black text-[#0A0E1A]">${basReport.net_sales_ex_gst.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: MONTHLY CORPORATE ACCOUNTS DIRECTORY & PENDING BALANCES
      ───────────────────────────────────────────────────────────── */}
      {isCreditAccountsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-4xl shadow-2xl space-y-4 max-h-[88vh] flex flex-col text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <Building2 className="w-6 h-6 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">Monthly Post-Paid Corporate Accounts</h3>
                  <p className="text-xs text-[#0A0E1A] font-bold">
                    Companies with monthly billing & credit terms • Total Pending Debt:{' '}
                    <strong className="text-[#0A0E1A] font-mono font-black">${totalPendingCorporateDebt.toFixed(2)} AUD</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreditAccountsModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#E6D8C3]"
              >
                <X className="w-4 h-4 text-[#0A0E1A]" />
              </button>
            </div>

            {/* Corporate Accounts Grid */}
            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {corporateAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] hover:border-[#DFCAA8] space-y-3 text-xs transition-all shadow-sm text-[#0A0E1A]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-[#0A0E1A]">{acc.company_name}</h4>
                        <span className="px-2 py-0.5 rounded bg-[#FAF6F0] text-[#0A0E1A] font-mono font-black text-[10px] border border-[#E6D8C3]">
                          {acc.account_code}
                        </span>
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8]"
                        >
                          ● {acc.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#0A0E1A] font-mono font-bold block">ABN: {acc.abn}</span>
                    </div>

                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between">
                      <span className="text-[10px] text-[#0A0E1A] uppercase font-bold">Total Pending Balance</span>
                      <span className="text-base font-black font-mono text-[#0A0E1A]">
                        ${acc.total_pending_balance.toFixed(2)} AUD
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#FAF6F0] p-3 rounded-xl border border-[#E6D8C3] text-[11px] text-[#0A0E1A]">
                    <div>
                      <span className="text-[#0A0E1A] block text-[10px] uppercase font-bold">Contact Person</span>
                      <strong className="text-[#0A0E1A] font-black">{acc.contact_person}</strong>
                      <span className="text-[#0A0E1A] block text-[10px] font-mono font-bold">{acc.phone}</span>
                    </div>
                    <div>
                      <span className="text-[#0A0E1A] block text-[10px] uppercase font-bold">Payment Terms</span>
                      <strong className="text-[#0A0E1A] font-mono font-black">{acc.billing_terms}</strong>
                      <span className="text-[#0A0E1A] block text-[10px] font-mono font-bold">Limit: ${acc.credit_limit.toLocaleString()} AUD</span>
                    </div>
                    <div>
                      <span className="text-[#0A0E1A] block text-[10px] uppercase font-bold">Unpaid Invoices</span>
                      <strong className="text-[#0A0E1A] font-black font-mono">{acc.unpaid_invoices_count} Invoices Pending</strong>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-[#E6D8C3]">
                    <button
                      onClick={() => handleQuickSettleAccount(acc)}
                      className="px-4 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.01] transition-all"
                    >
                      <Layers className="w-3.5 h-3.5 text-white" />
                      <span>⚡ Quick Settle with FIFO (${acc.total_pending_balance.toFixed(2)})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[#E6D8C3]">
              <button
                onClick={() => {
                  setIsCreditAccountsModalOpen(false);
                  setIsAddAccountOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-black text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-[#7B6035]" /> + Onboard New Company Account
              </button>
              <button
                onClick={() => setIsCreditAccountsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] text-[#FAF6F0] border border-[#DFCAA8] text-xs font-black shadow-md transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD NEW CORPORATE MONTHLY ACCOUNT
      ───────────────────────────────────────────────────────────── */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] shadow-sm">
                  <Building2 className="w-5 h-5 text-[#0A0E1A]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A0E1A]">Add Corporate Monthly Account</h3>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">Setup monthly post-paid credit terms</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddAccountOpen(false)}
                className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[#0A0E1A] hover:bg-[#E6D8C3]"
              >
                <X className="w-4 h-4 text-[#0A0E1A]" />
              </button>
            </div>

            <form onSubmit={handleCreateCorporateAccount} className="space-y-3 text-xs text-[#0A0E1A]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-bold mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KPMG Australia"
                    value={newAccount.company_name}
                    onChange={(e) => setNewAccount({ ...newAccount, company_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-bold mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Robert Miller"
                    value={newAccount.contact_person}
                    onChange={(e) => setNewAccount({ ...newAccount, contact_person: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-bold mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="accounts@company.com.au"
                    value={newAccount.email}
                    onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-bold mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+61 400 000 000"
                    value={newAccount.phone}
                    onChange={(e) => setNewAccount({ ...newAccount, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-bold focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-bold mb-1">ABN Number</label>
                  <input
                    type="text"
                    placeholder="12 345 678 901"
                    value={newAccount.abn}
                    onChange={(e) => setNewAccount({ ...newAccount, abn: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-bold mb-1">Credit Limit ($ AUD)</label>
                  <input
                    type="number"
                    value={newAccount.credit_limit}
                    onChange={(e) => setNewAccount({ ...newAccount, credit_limit: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#0A0E1A] block uppercase font-bold mb-1">Initial Pending ($)</label>
                  <input
                    type="number"
                    value={newAccount.initial_pending_balance}
                    onChange={(e) => setNewAccount({ ...newAccount, initial_pending_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-black font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E6D8C3]">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-[#0A0E1A] border border-[#E6D8C3] font-black text-xs shadow-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
                >
                  <Check className="w-4 h-4 text-white" /> Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PRINTABLE & COMPLETE OFFICIAL ATO TAX INVOICE MODAL
      ───────────────────────────────────────────────────────────── */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] max-w-3xl w-full p-8 rounded-3xl space-y-5 text-xs text-[#0A0E1A] relative shadow-2xl max-h-[92vh] flex flex-col">
            {/* Close Icon */}
            <button
              onClick={() => setPreviewInvoice(null)}
              className="absolute top-5 right-5 text-[#0A0E1A] hover:bg-[#E6D8C3] p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] shadow-sm transition-all"
            >
              <X className="w-5 h-5 text-[#0A0E1A]" />
            </button>

            {/* Scrollable Invoice Sheet */}
            <div className="overflow-y-auto space-y-5 pr-1.5 flex-1">
              {/* Header: Company Details & Invoice Meta */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-[#E6D8C3] pb-5 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-[#0A0E1A] tracking-wider">TAX INVOICE</h2>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-[#FFFFFF] text-[#0A0E1A] border border-[#DFCAA8]"
                    >
                      ● {previewInvoice.status}
                    </span>
                  </div>
                  <p className="text-sm font-black text-[#0A0E1A]">Opal Chauffeurs Australia Pty Ltd</p>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">Trading as Opal Chauffeurs VIP Transport Network</p>
                  <p className="text-[11px] font-mono text-[#0A0E1A] font-black">ABN: 45 123 456 789</p>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">Melbourne VIC • Australia</p>
                  <p className="text-[11px] text-[#0A0E1A] font-bold">Phone: +61 432 000 718 • accounts@opalchauffeurs.com.au</p>
                </div>

                <div className="sm:text-right space-y-1 bg-[#FFFFFF] p-3.5 rounded-2xl border border-[#E6D8C3] font-mono w-full sm:w-auto shadow-sm text-[#0A0E1A]">
                  <span className="text-lg font-black text-[#0A0E1A] block">{previewInvoice.invoice_number}</span>
                  {previewInvoice.booking_number && (
                    <span className="text-[11px] text-[#0A0E1A] block font-bold">Booking Ref: <strong className="text-[#0A0E1A]">{previewInvoice.booking_number}</strong></span>
                  )}
                  <span className="text-[11px] text-[#0A0E1A] block font-bold">Issue Date: <strong className="text-[#0A0E1A]">{previewInvoice.issue_date}</strong></span>
                  <span className="text-[11px] text-[#0A0E1A] block font-bold">Payment Due: <strong className="text-[#0A0E1A]">{previewInvoice.due_date}</strong></span>
                  {previewInvoice.paid_at && (
                    <span className="text-[11px] text-[#0A0E1A] font-black block">Paid Date: <strong>{previewInvoice.paid_at}</strong></span>
                  )}
                </div>
              </div>

              {/* Billed To (Client / Passenger) & Journey Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client / Corporate Account Box */}
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#0A0E1A]" /> Billed To (Client / Corporate Account)
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-[#0A0E1A]">
                      {previewInvoice.customer_company || previewInvoice.customer_name || 'Private VIP Client'}
                    </h4>
                    {previewInvoice.customer_name && previewInvoice.customer_company && (
                      <span className="text-[11px] text-[#0A0E1A] font-bold block">Attn: {previewInvoice.customer_name}</span>
                    )}
                    {previewInvoice.customer_abn && (
                      <span className="text-[11px] font-mono text-[#0A0E1A] font-bold block">Client ABN: {previewInvoice.customer_abn}</span>
                    )}
                    {previewInvoice.customer_email && (
                      <span className="text-[11px] text-[#0A0E1A] font-bold block">{previewInvoice.customer_email}</span>
                    )}
                    {previewInvoice.customer_phone && (
                      <span className="text-[11px] font-mono text-[#0A0E1A] font-bold block">{previewInvoice.customer_phone}</span>
                    )}
                  </div>
                </div>

                {/* Journey & Chauffeur Dispatch Details */}
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] text-[#0A0E1A] block uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-[#0A0E1A]" /> Journey & Chauffeur Dispatch Specs
                  </span>
                  <div className="space-y-1 text-[11px] text-[#0A0E1A]">
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A] font-bold">Lead Passenger:</span>
                      <strong className="text-[#0A0E1A] font-black">{previewInvoice.passenger_name || previewInvoice.customer_name || 'Executive Passenger'}</strong>
                    </div>
                    {previewInvoice.journey_datetime && (
                      <div className="flex justify-between">
                        <span className="text-[#0A0E1A] font-bold">Date & Time:</span>
                        <strong className="text-[#0A0E1A] font-mono font-black">{previewInvoice.journey_datetime}</strong>
                      </div>
                    )}
                    {previewInvoice.vehicle_model && (
                      <div className="flex justify-between">
                        <span className="text-[#0A0E1A] font-bold">Vehicle & Plate:</span>
                        <strong className="text-[#0A0E1A] font-black">{previewInvoice.vehicle_model} ({previewInvoice.vehicle_plate || 'VIP'})</strong>
                      </div>
                    )}
                    {previewInvoice.driver_name && (
                      <div className="flex justify-between">
                        <span className="text-[#0A0E1A] font-bold">Chauffeur:</span>
                        <strong className="text-[#0A0E1A] font-black">{previewInvoice.driver_name}</strong>
                      </div>
                    )}
                    {previewInvoice.flight_number && (
                      <div className="flex justify-between">
                        <span className="text-[#0A0E1A] font-bold">Flight Reference:</span>
                        <strong className="text-[#0A0E1A] font-mono font-black">{previewInvoice.flight_number}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <span className="text-[10px] text-[#0A0E1A] block uppercase font-black tracking-wider">
                  Service Line Items & Trip Breakdown
                </span>
                <div className="rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] overflow-hidden font-mono shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase text-[10px] font-black border-b border-[#E6D8C3]">
                      <tr>
                        <th className="py-2.5 px-4 font-black text-[#0A0E1A]">Service Description & Route</th>
                        <th className="py-2.5 px-4 font-black text-right text-[#0A0E1A]">Ex GST</th>
                        <th className="py-2.5 px-4 font-black text-right text-[#0A0E1A]">10% GST</th>
                        <th className="py-2.5 px-4 font-black text-right text-[#0A0E1A]">Total (AUD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D8C3] text-[11px]">
                      <tr>
                        <td className="py-3 px-4">
                          <strong className="text-[#0A0E1A] block font-sans font-black">
                            {previewInvoice.line_items?.[0]?.description || 'Executive Chauffeur Transfer'}
                          </strong>
                          {previewInvoice.pickup_location && (
                            <span className="text-[#0A0E1A] block text-[10px] font-sans font-bold">
                              📍 Pickup: {previewInvoice.pickup_location}
                            </span>
                          )}
                          {previewInvoice.dropoff_location && (
                            <span className="text-[#0A0E1A] block text-[10px] font-sans font-bold">
                              🏁 Dropoff: {previewInvoice.dropoff_location}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-[#0A0E1A] font-black">${previewInvoice.subtotal_ex_gst.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-[#0A0E1A] font-black">${previewInvoice.gst_amount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-black text-[#0A0E1A]">${previewInvoice.total_inc_gst.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals & GST Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Remittance & Bank EFT Instructions */}
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 text-[11px] shadow-sm text-[#0A0E1A]">
                  <span className="text-[10px] text-[#0A0E1A] block uppercase font-black tracking-wider flex items-center gap-1.5 font-sans">
                    <CreditCard className="w-3.5 h-3.5 text-[#0A0E1A]" /> Remittance & EFT Payment Details
                  </span>
                  <div className="space-y-1 font-mono text-[#0A0E1A] font-bold">
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">Bank:</span>
                      <strong className="text-[#0A0E1A]">Commonwealth Bank of Australia</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">Account Name:</span>
                      <strong className="text-[#0A0E1A]">Opal Chauffeurs Australia Pty Ltd</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">BSB:</span>
                      <strong className="text-[#0A0E1A] font-black">063-000</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">Account Number:</span>
                      <strong className="text-[#0A0E1A] font-black">1092 8841</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#0A0E1A]">PayID / OSKO:</span>
                      <strong className="text-[#0A0E1A] font-black">accounts@opalchauffeurs.com.au</strong>
                    </div>
                  </div>
                </div>

                {/* Amount Totals */}
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 font-mono text-right flex flex-col justify-between shadow-sm text-[#0A0E1A]">
                  <div className="space-y-1.5 text-[#0A0E1A]">
                    <div className="flex justify-between text-[#0A0E1A] text-xs font-bold">
                      <span>Subtotal (Ex GST):</span>
                      <span className="font-black">${previewInvoice.subtotal_ex_gst.toFixed(2)} AUD</span>
                    </div>
                    <div className="flex justify-between text-[#0A0E1A] font-black text-xs">
                      <span>10% Australian GST (1/11th):</span>
                      <span>${previewInvoice.gst_amount.toFixed(2)} AUD</span>
                    </div>
                    <div className="flex justify-between text-[#0A0E1A] text-sm font-black pt-1.5 border-t border-[#E6D8C3]">
                      <span>Total Invoiced (Inc GST):</span>
                      <span className="text-[#0A0E1A]">${previewInvoice.total_inc_gst.toFixed(2)} AUD</span>
                    </div>
                    <div className="flex justify-between text-[#0A0E1A] text-xs font-black">
                      <span>Amount Paid:</span>
                      <span>-${previewInvoice.amount_paid.toFixed(2)} AUD</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-[#0A0E1A] text-base font-black pt-2 border-t border-[#E6D8C3]">
                    <span className="uppercase text-xs font-sans font-black">Balance Outstanding:</span>
                    <span>${previewInvoice.balance_due.toFixed(2)} AUD</span>
                  </div>
                </div>
              </div>

              {/* ATO Legal Compliance Note */}
              <div className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-[10px] text-[#0A0E1A] text-center font-sans font-bold shadow-sm">
                Thank you for traveling with Opal Chauffeurs Australia. All amounts are in Australian Dollars (AUD). This document serves as a compliant Tax Invoice under Section 195-1 of the Australian GST Act 1999.
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[#E6D8C3] shrink-0">
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] text-slate-800 border border-[#E6D8C3] font-bold text-xs shadow-sm transition-all"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] transition-all"
              >
                <Download className="w-3.5 h-3.5 text-[#DFCAA8]" />
                <span>Print / Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
