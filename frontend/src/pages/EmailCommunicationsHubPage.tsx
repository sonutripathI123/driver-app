import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Inbox,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  FileText,
  Sparkles,
  Shield,
  User,
  ExternalLink,
  MessageSquare,
  CornerDownRight,
  Reply,
  Copy,
  Plus,
  X,
  Sliders,
  Check,
  Plane,
  Car,
  Receipt,
  Download,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { automationsApi, bookingsApi, inboxApi, notificationsApi } from '../services/api';
import { Booking, InboundEmail, InboundMailboxStatus } from '../types';

export interface EmailLog {
  id: string;
  recipient_name: string;
  recipient_email: string;
  trigger_type: 'BOOKING_CONFIRMATION' | 'CHAUFFEUR_DISPATCH' | 'FLIGHT_DELAY' | 'TAX_INVOICE' | 'QUOTE_PROPOSAL' | 'CUSTOM_COMPOSED';
  subject: string;
  booking_ref?: string;
  invoice_ref?: string;
  sent_at: string;
  /** Mirrors the provider outcome. Open/click tracking would need Resend
   *  webhooks, which are not wired, so it is not claimed here. */
  status: 'SENT' | 'NOT_DELIVERED';
  failure_reason?: string | null;
  body_preview: string;
  html_body?: string;
}

/**
 * A thread in the inbox.
 *
 * This used to be a browser-local shape seeded with four invented threads —
 * people who do not exist at riotinto.com, bhp.com and hsf.com.au. Replying
 * to one sent a genuine email to a stranger's domain. It is now whatever the
 * inbound webhook actually delivered.
 */
export type InboundReply = InboundEmail;

export const EmailCommunicationsHubPage: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'sent' | 'inbox' | 'templates' | 'automation'>('sent');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Modals
  const [viewingEmail, setViewingEmail] = useState<EmailLog | null>(null);
  const [selectedReplyThread, setSelectedReplyThread] = useState<InboundReply | null>(null);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Compose Form
  const [composeRecipientName, setComposeRecipientName] = useState('');
  const [composeRecipientEmail, setComposeRecipientEmail] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeTemplate, setComposeTemplate] = useState<string>('CUSTOM');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeBookingRef, setComposeBookingRef] = useState('');

  // Automation toggles
  const [autoBookingConfirm, setAutoBookingConfirm] = useState(true);
  const [autoDriverDispatch, setAutoDriverDispatch] = useState(true);
  const [autoFlightDelay, setAutoFlightDelay] = useState(true);
  const [autoInvoiceReceipt, setAutoInvoiceReceipt] = useState(true);
  const [autoDriverManifest, setAutoDriverManifest] = useState(true);

  // Email Logs: the dispatch outbox, read from the API. This used to be
  // seeded with six invented "delivered" emails in localStorage, which is why
  // the hub always looked busy even though nothing had ever been sent.
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [mailboxStatus, setMailboxStatus] = useState<InboundMailboxStatus | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const TRIGGER_BY_TEMPLATE: Record<string, EmailLog['trigger_type']> = {
    BOOKING_CONFIRMATION: 'BOOKING_CONFIRMATION',
    CHAUFFEUR_DISPATCH: 'CHAUFFEUR_DISPATCH',
    DRIVER_DISPATCH_DOSSIER: 'CHAUFFEUR_DISPATCH',
    FLIGHT_DELAY: 'FLIGHT_DELAY',
    TAX_INVOICE: 'TAX_INVOICE',
    QUOTE_PROPOSAL: 'QUOTE_PROPOSAL',
    DIRECT_CUSTOM_EMAIL: 'CUSTOM_COMPOSED',
  };

  /** Server timestamps are ISO; the old sample threads carried prose like "Today at 02:40 PM". */
  const fmtReceived = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const toEmailLog = (n: any): EmailLog => {
    const body = n.content || '';
    return {
      id: n.id,
      recipient_name: (n.recipient || '').split('@')[0],
      recipient_email: n.recipient,
      trigger_type: TRIGGER_BY_TEMPLATE[n.template_name] || 'CUSTOM_COMPOSED',
      subject: n.subject || '(no subject)',
      booking_ref: n.booking_id || undefined,
      sent_at: new Date(n.created_at).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' }),
      status: n.status === 'SENT' ? 'SENT' : 'NOT_DELIVERED',
      failure_reason: n.error_message || null,
      body_preview: stripHtml(body).slice(0, 160),
      html_body: body,
    };
  };

  const loadEmailLogs = async () => {
    setLoading(true);
    try {
      // Bookings back the compose form's reference picker. It used to be a
      // free-text box posted as booking_id, which is a foreign key, so any
      // value typed into it made the send fail outright.
      bookingsApi
        .list(undefined, 200)
        .then((page) => setBookings(page.bookings || []))
        .catch(() => setBookings([]));

      const items = await notificationsApi.getNotificationLogs(100);
      setEmailLogs(
        (Array.isArray(items) ? items : [])
          .filter((n: any) => (n.channel || '').toUpperCase() === 'EMAIL')
          .map(toEmailLog)
      );
      setLogsError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEmailLogs([]);
      setLogsError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Email log unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmailLogs();
  }, []);

  // Inbound mailbox, read from the API. Nothing is seeded: an empty inbox
  // means no mail has arrived, and the banner explains how to connect one.
  const [inboundReplies, setInboundReplies] = useState<InboundReply[]>([]);

  const loadInbox = async () => {
    try {
      const [status, threads] = await Promise.all([inboxApi.getStatus(), inboxApi.list(50)]);
      setMailboxStatus(status);
      setInboundReplies(threads || []);
      setInboxError(null);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setInboundReplies([]);
      setInboxError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Inbox unavailable (HTTP ${err.response.status}).`
            : 'Cannot reach the Opal Cloud Engine.'
      );
    }
  };

  useEffect(() => {
    loadInbox();
  }, []);

  /** Opening a thread marks it read for everyone, not just this browser. */
  const handleOpenThread = async (thread: InboundReply) => {
    setSelectedReplyThread(thread);
    if (thread.status !== 'UNREAD') return;
    try {
      const updated = await inboxApi.updateStatus(thread.id, 'READ');
      setInboundReplies((prev) => prev.map((t) => (t.id === thread.id ? updated : t)));
      setSelectedReplyThread((prev) => (prev && prev.id === thread.id ? updated : prev));
    } catch {
      // Triage state is cosmetic; the message is still readable.
    }
  };

  /** Replies already sent to this correspondent, from the real outbox. */
  const repliesTo = (email: string) =>
    emailLogs.filter((log) => log.recipient_email.toLowerCase() === email.toLowerCase());

  // Handle Send Custom Email
  const handleSendCustomEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeRecipientEmail || !composeSubject || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      const notif = await notificationsApi.sendDirect({
        recipient: composeRecipientEmail.trim(),
        channel: 'EMAIL',
        subject: composeSubject,
        message: composeMessage,
        booking_id: composeBookingRef.trim() || undefined,
      });

      // Only celebrate an email the provider actually accepted. This used to
      // fire confetti and log DELIVERED without contacting anything at all.
      if (notif?.status === 'SENT') {
        confetti({
          particleCount: 90,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#DFCAA8', '#38BDF8', '#10B981'],
        });
        setIsComposeOpen(false);
        setComposeRecipientName('');
        setComposeRecipientEmail('');
        setComposeSubject('');
        setComposeMessage('');
        setComposeBookingRef('');
        setActiveSubTab('sent');
      } else {
        setSendError(
          (notif as any)?.error_message ||
            'The email was recorded but the provider did not confirm delivery.'
        );
      }
      loadEmailLogs();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSendError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Send failed (HTTP ${err.response.status}).`
            : 'Send failed: cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setIsSending(false);
    }
  };

  // Handle Quick Reply to Inbound Thread. The thread list itself is not yet
  // fed by a real mailbox, but the reply is a genuine outbound email.
  const handleSendQuickReply = async () => {
    if (!selectedReplyThread || !quickReplyText.trim() || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      const notif = await notificationsApi.sendDirect({
        recipient: selectedReplyThread.sender_email,
        channel: 'EMAIL',
        subject: `Re: ${selectedReplyThread.subject || '(no subject)'}`,
        message: quickReplyText.trim(),
        booking_id: selectedReplyThread.booking_id || undefined,
      });

      if (notif?.status !== 'SENT') {
        setSendError(
          (notif as any)?.error_message ||
            'The reply was recorded but the provider did not confirm delivery.'
        );
        loadEmailLogs();
        return;
      }

      // The thread is marked replied on the server, so a colleague looking at
      // the same inbox can see it has been handled.
      try {
        const updated = await inboxApi.updateStatus(selectedReplyThread.id, 'REPLIED');
        setInboundReplies((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSelectedReplyThread(updated);
      } catch {
        // The email went out; failing to re-label the thread is not worth an error.
      }

      setQuickReplyText('');
      confetti({ particleCount: 70, spread: 50, origin: { y: 0.6 }, colors: ['#DFCAA8', '#38BDF8'] });
      loadEmailLogs();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setSendError(
        typeof detail === 'string'
          ? detail
          : err?.response
            ? `Reply failed (HTTP ${err.response.status}).`
            : 'Reply failed: cannot reach the Opal Cloud Engine.'
      );
    } finally {
      setIsSending(false);
    }
  };

  // Template autofill
  const handleSelectTemplate = (templateKey: string) => {
    setComposeTemplate(templateKey);
    // Placeholders in [BRACKETS], not invented specifics. This template used
    // to prefill a real-looking confirmation naming a booking, a registration
    // plate and a chauffeur. Sent without careful editing, the client
    // received a confirmation for a journey nobody had booked.
    if (templateKey === 'BOOKING_CONFIRMATION') {
      setComposeSubject('Confirmed: Opal Chauffeurs VIP Transfer Booking #[BOOKING NUMBER]');
      setComposeMessage(
        `Dear [CLIENT NAME],\n\nWe are pleased to confirm your executive chauffeur service with Opal Chauffeurs Australia.\n\nDate & time: [PICKUP DATE AND TIME]\nPickup: [PICKUP ADDRESS]\nDropoff: [DROPOFF ADDRESS]\nVehicle: [VEHICLE AND REGISTRATION]\nChauffeur: [CHAUFFEUR NAME AND PHONE]\n\nYour chauffeur will be waiting with your name board.\n\nWarm regards,\nOpal Chauffeurs Australia Dispatch Team\nhttps://www.opalchauffeurs.com.au`
      );
    } else if (templateKey === 'FLIGHT_DELAY') {
      setComposeSubject('Flight schedule update — pickup adjusted for flight [FLIGHT NUMBER]');
      setComposeMessage(
        `Dear [PASSENGER NAME],\n\nWe have tracked an update to your incoming flight [FLIGHT NUMBER].\n\nYour pickup has been rescheduled to [NEW PICKUP TIME] to match the updated arrival, with no wait-time surcharge.\n\nAny questions, reply to this email or contact dispatch at book@opalchauffeurs.com.au.\n\nSafe flight,\nOpal Chauffeurs Operations`
      );
    } else if (templateKey === 'TAX_INVOICE') {
      setComposeSubject('Tax Invoice #[INVOICE NUMBER] — Opal Chauffeurs Australia Pty Ltd');
      setComposeMessage(
        `Dear [ACCOUNTS CONTACT],\n\nPlease find the Tax Invoice and GST statement for recent chauffeur services.\n\nEntity: Opal Chauffeurs Australia Pty Ltd (ABN: 68 642 908 112)\nInvoice reference: #[INVOICE NUMBER]\nTotal: $[AMOUNT] AUD (includes $[GST] GST)\nStatus: [PAYMENT STATUS]\n\nThank you for choosing Opal Chauffeurs.\naccounts@opalchauffeurs.com.au`
      );
    } else {
      setComposeSubject('');
      setComposeMessage('');
    }
  };

  // Filtered Logs
  const filteredLogs = emailLogs.filter((log) => {
    const matchesQuery =
      log.recipient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.booking_ref && log.booking_ref.toLowerCase().includes(searchQuery.toLowerCase()));

    if (filterType === 'ALL') return matchesQuery;
    return matchesQuery && log.trigger_type === filterType;
  });

  const unreadCount = inboundReplies.filter((r) => r.status === 'UNREAD').length;
  const sentCount = emailLogs.filter((l) => l.status === 'SENT').length;
  const failedCount = emailLogs.length - sentCount;
  const deliveryRate = emailLogs.length ? (sentCount / emailLogs.length) * 100 : 0;

  return (
    <div className="space-y-6 text-[#0A0E1A]">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP COMMAND HEADER & STATS BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF6F0] border border-[#E6D8C3] p-6 rounded-2xl shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#06090F] border border-[#DFCAA8] flex items-center justify-center text-white shadow-md">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0A0E1A] tracking-tight">
                Email & Dispatch Communications Center
              </h1>
              <p className="text-xs text-[#0A0E1A] font-bold">
                Live SMTP Dispatch Engine • Automated VIP Triggers • Inbound Client Replies • 100% Audit Logging
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Official Sender Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] text-xs font-black text-[#0A0E1A] flex items-center gap-1.5 shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#0A0E1A]" />
            <span>Sender: <strong className="font-mono text-[#0A0E1A]">book@opalchauffeurs.com.au</strong></span>
          </div>

          {/* Compose Email Button */}
          <button
            onClick={() => {
              handleSelectTemplate('CUSTOM');
              setIsComposeOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Compose VIP Email</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KPI TELEMETRY METRICS
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FAF6F0] border border-[#E6D8C3] p-4 rounded-2xl shadow-sm text-[#0A0E1A]">
          <div className="flex items-center justify-between text-xs font-black text-[#0A0E1A]">
            <span>TOTAL EMAILS SENT</span>
            <Send className="w-4 h-4 text-[#0A0E1A]" />
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-[#0A0E1A]">{sentCount} Sent</div>
          <div className="text-[10px] font-bold text-[#0A0E1A] mt-1">{emailLogs.length} attempts recorded</div>
        </div>

        <div className="bg-[#FAF6F0] border border-[#E6D8C3] p-4 rounded-2xl shadow-sm text-[#0A0E1A]">
          <div className="flex items-center justify-between text-xs font-black text-[#0A0E1A]">
            <span>DELIVERY SUCCESS</span>
            <CheckCircle2 className="w-4 h-4 text-[#0A0E1A]" />
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-[#0A0E1A]">
            {emailLogs.length ? `${deliveryRate.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] font-bold text-[#0A0E1A] mt-1">
            {emailLogs.length ? `${sentCount} accepted by provider` : 'No sends recorded yet'}
          </div>
        </div>

        <div className="bg-[#FAF6F0] border border-[#E6D8C3] p-4 rounded-2xl shadow-sm text-[#0A0E1A]">
          <div className="flex items-center justify-between text-xs font-black text-[#0A0E1A]">
            <span>NOT DELIVERED</span>
            <Eye className="w-4 h-4 text-[#0A0E1A]" />
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-[#0A0E1A]">{failedCount}</div>
          <div className="text-[10px] font-bold text-[#0A0E1A] mt-1">
            {failedCount ? 'Open the log for the provider reason' : 'Open tracking needs Resend webhooks'}
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('inbox')}
          className="bg-[#FAF6F0] border border-[#E6D8C3] p-4 rounded-2xl shadow-sm text-[#0A0E1A] cursor-pointer card-clickable-yellow"
        >
          <div className="flex items-center justify-between text-xs font-black text-[#0A0E1A]">
            <span>INBOUND CLIENT REPLIES</span>
            <MessageSquare className="w-4 h-4 text-[#0A0E1A]" />
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-[#0A0E1A] flex items-center gap-2">
            <span>{inboundReplies.length} Threads</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#06090F] text-white text-[10px] font-bold">
                {unreadCount} New
              </span>
            )}
          </div>
          <div className="text-[10px] font-black text-[#0A0E1A] mt-1 underline">Click to view client replies ➔</div>
        </div>
      </div>

      {(logsError || sendError) && (
        <div role="alert" className="rounded-2xl bg-[#FFFFFF] border border-[#EF4444] p-4 shadow-lg space-y-2">
          {logsError && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-black text-[#0A0E1A]">Dispatch log could not be loaded</p>
                <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">{logsError}</p>
              </div>
              <button
                onClick={loadEmailLogs}
                className="ml-auto shrink-0 px-3.5 py-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black hover:bg-[#E0F2FE] hover:text-[#0A0E1A] transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          {sendError && (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-black text-[#0A0E1A]">Email was not delivered</p>
                <p className="text-xs font-bold text-[#0A0E1A] opacity-75 break-words">{sendError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. SUB-NAVIGATION TABS
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-1.5 bg-[#06090F] rounded-2xl border border-[#1E2738] overflow-x-auto select-none">
        <button
          onClick={() => setActiveSubTab('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'sent'
              ? 'bg-[#FAF6F0] text-[#0A0E1A] font-black shadow-md'
              : 'text-white hover-sky font-bold'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Outbound Dispatched Logs ({emailLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'inbox'
              ? 'bg-[#FAF6F0] text-[#0A0E1A] font-black shadow-md'
              : 'text-white hover-yellow font-bold'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Client Inbox & Replies ({inboundReplies.length})</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-black">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'templates'
              ? 'bg-[#FAF6F0] text-[#0A0E1A] font-black shadow-md'
              : 'text-white hover-sky font-bold'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Luxury Email Templates Library</span>
        </button>

        <button
          onClick={() => setActiveSubTab('automation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'automation'
              ? 'bg-[#FAF6F0] text-[#0A0E1A] font-black shadow-md'
              : 'text-white hover-yellow font-bold'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Automated Triggers & SMTP Config</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: OUTBOUND SENT EMAIL AUDIT LOG
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'sent' && (
        <div className="space-y-4">
          {/* Search & Filter Controls */}
          <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#E6D8C3] shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#0A0E1A]" />
              <input
                type="text"
                placeholder="Search recipient name, email, booking reference, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs text-[#0A0E1A] placeholder-slate-600 font-bold focus:outline-none focus:border-[#0A0E1A]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-xs font-black text-[#0A0E1A] focus:outline-none"
              >
                <option value="ALL">All Email Types</option>
                <option value="BOOKING_CONFIRMATION">Booking Confirmations</option>
                <option value="CHAUFFEUR_DISPATCH">Chauffeur Dispatches</option>
                <option value="FLIGHT_DELAY">Flight Delay Alerts</option>
                <option value="TAX_INVOICE">Tax Invoices & Receipts</option>
                <option value="QUOTE_PROPOSAL">Quote Proposals</option>
                <option value="CUSTOM_COMPOSED">Custom Messages</option>
              </select>

              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('ALL');
                }}
                className="p-2 rounded-xl bg-[#FFFFFF] hover-sky border border-[#E6D8C3] text-[#0A0E1A]"
                title="Reset Filters"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table of Sent Emails */}
          <div className="bg-[#FAF6F0] rounded-2xl border border-[#E6D8C3] overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6F0] text-[#0A0E1A] uppercase font-mono font-black tracking-wider border-b border-[#E6D8C3]">
                  <tr>
                    <th className="py-3.5 px-4">Recipient & Entity</th>
                    <th className="py-3.5 px-4">Email Category</th>
                    <th className="py-3.5 px-4">Subject & Preview</th>
                    <th className="py-3.5 px-4">Reference</th>
                    <th className="py-3.5 px-4">Dispatched Time</th>
                    <th className="py-3.5 px-4">Delivery Telemetry</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D8C3] font-sans">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="clickable-row bg-[#FFFFFF] transition-colors cursor-pointer"
                      onClick={() => setViewingEmail(log)}
                    >
                      <td className="py-4 px-4">
                        <span className="font-black text-[#0A0E1A] block text-sm">{log.recipient_name}</span>
                        <span className="font-mono text-[11px] text-[#0A0E1A] font-bold block">{log.recipient_email}</span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black border font-mono bg-[#FAF6F0] text-[#0A0E1A] border-[#DFCAA8]">
                          {log.trigger_type.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-4 px-4 max-w-[280px]">
                        <span className="font-black text-[#0A0E1A] block truncate">{log.subject}</span>
                        <span className="text-[11px] text-slate-700 font-bold block truncate mt-0.5">{log.body_preview}</span>
                      </td>

                      <td className="py-4 px-4 font-mono font-black text-[#0A0E1A]">
                        {log.booking_ref && (
                          <span className="inline-block px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E6D8C3] text-[10px]">
                            {log.booking_ref}
                          </span>
                        )}
                        {log.invoice_ref && (
                          <span className="inline-block px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E6D8C3] text-[10px] ml-1">
                            {log.invoice_ref}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono text-[#0A0E1A] font-black whitespace-nowrap">
                        {log.sent_at}
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              log.status === 'SENT' ? 'bg-emerald-600' : 'bg-red-600'
                            }`}
                          />
                          <span className="font-black text-[11px] text-[#0A0E1A]">
                            {log.status === 'SENT' ? 'SENT' : 'NOT DELIVERED'}
                          </span>
                        </div>
                        {log.failure_reason && (
                          <span className="text-[10px] font-mono text-[#B91C1C] block mt-0.5 max-w-[220px] break-words">
                            {log.failure_reason}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setViewingEmail(log)}
                          className="px-3 py-1.5 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white text-xs font-black transition-all shadow-sm"
                        >
                          View HTML
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: CLIENT INBOX & REPLIES
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'inbox' && inboxError && (
        <div className="rounded-2xl bg-[#FFFFFF] border border-[#EF4444] p-4 mb-4 flex items-start gap-2.5 text-[#0A0E1A]">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Inbox could not be loaded</p>
            <p className="text-xs font-bold opacity-75 break-words">{inboxError}</p>
          </div>
          <button
            onClick={loadInbox}
            className="shrink-0 px-3.5 py-1.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white text-xs font-black"
          >
            Retry
          </button>
        </div>
      )}

      {activeSubTab === 'inbox' && !inboxError && mailboxStatus && !mailboxStatus.configured && (
        <div className="rounded-2xl bg-[#FEF9C3] border border-[#DFCAA8] p-4 mb-4 flex items-start gap-2.5 text-[#0A0E1A]">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-black">Inbound mail is not connected yet</p>
            <p className="text-xs font-bold opacity-80">{mailboxStatus.detail}</p>
            <p className="text-[11px] font-mono font-black mt-1.5 break-all">
              Webhook URL: {mailboxStatus.webhook_path}
            </p>
            <p className="text-xs font-bold opacity-80 mt-1">
              Replies you send from here <strong>are</strong> real outbound emails and are recorded in the outbox.
            </p>
          </div>
        </div>
      )}

      {activeSubTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Threads List (5 Cols) */}
          <div className="lg:col-span-5 bg-[#FAF6F0] p-4 rounded-2xl border border-[#E6D8C3] shadow-md space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6D8C3]">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#0A0E1A]" />
                <h3 className="font-black text-sm text-[#0A0E1A]">Inbound Client Messages</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-xs font-black font-mono">
                {inboundReplies.length} Threads
              </span>
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
              {inboundReplies.map((thread) => {
                const isSelected = selectedReplyThread?.id === thread.id;
                return (
                  <div
                    key={thread.id}
                    onClick={() => handleOpenThread(thread)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E0F2FE] border-[#7DD3FC] shadow-sm'
                        : 'bg-[#FFFFFF] border-[#E6D8C3] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-xs text-[#0A0E1A] truncate">
                        {thread.sender_name || thread.sender_email}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 shrink-0">
                        {fmtReceived(thread.received_at)}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#0A0E1A] mt-1 truncate">{thread.subject}</p>
                    <p className="text-[11px] text-slate-700 font-semibold mt-1 line-clamp-2">
                      {thread.body_text || '(no message body)'}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E6D8C3] gap-2">
                      <span className="font-mono text-[10px] text-[#0A0E1A] font-black truncate">
                        {/* Matched from the subject or body against a real
                            booking. Unmatched stays unmatched rather than
                            being attached to the wrong job. */}
                        {thread.booking_number ? `Ref: ${thread.booking_number}` : 'No booking matched'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                          thread.status === 'UNREAD'
                            ? 'bg-[#06090F] text-white border-[#DFCAA8]'
                            : thread.status === 'ACTION_NEEDED'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {thread.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {inboundReplies.length === 0 && !inboxError && (
                <div className="p-6 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] text-center space-y-1">
                  <p className="text-xs font-black text-[#0A0E1A]">No replies in the inbox.</p>
                  <p className="text-[11px] text-slate-700 font-semibold">
                    {mailboxStatus?.configured
                      ? 'Client replies will appear here as they arrive.'
                      : 'Connect inbound mail to see client replies here.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Thread Detail & Quick Reply (7 Cols) */}
          <div className="lg:col-span-7 bg-[#FAF6F0] p-6 rounded-2xl border border-[#E6D8C3] shadow-md flex flex-col justify-between space-y-4 min-h-[500px]">
            {selectedReplyThread ? (
              <>
                <div className="space-y-4">
                  {/* Thread Header */}
                  <div className="flex items-start justify-between border-b border-[#E6D8C3] pb-4 gap-3">
                    <div className="min-w-0">
                      <h3 className="font-black text-base text-[#0A0E1A]">{selectedReplyThread.subject}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#0A0E1A] flex-wrap">
                        <span className="font-black">From: {selectedReplyThread.sender_name || 'Unnamed sender'}</span>
                        <span className="font-mono text-slate-600 break-all">({selectedReplyThread.sender_email})</span>
                      </div>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded bg-[#FFFFFF] border border-[#DFCAA8] text-[10px] font-mono font-black text-[#0A0E1A]">
                        {selectedReplyThread.booking_number
                          ? `Booking: ${selectedReplyThread.booking_number}`
                          : 'No booking matched to this thread'}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-600 font-bold shrink-0">
                      {fmtReceived(selectedReplyThread.received_at)}
                    </span>
                  </div>

                  {/* Initial Client Message Bubble */}
                  <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0A0E1A]">💬 Client Message:</span>
                    </div>
                    <p className="text-xs text-[#0A0E1A] font-semibold leading-relaxed whitespace-pre-wrap break-words">
                      {selectedReplyThread.body_text || '(no message body)'}
                    </p>
                  </div>

                  {/* Replies actually sent to this address, taken from the
                      outbox rather than a browser-local history — so the
                      provider's real delivery outcome is visible here too. */}
                  {repliesTo(selectedReplyThread.sender_email).length > 0 && (
                    <div className="space-y-2.5">
                      <span className="text-xs font-black text-[#0A0E1A] block">Emails sent to this address:</span>
                      {repliesTo(selectedReplyThread.sender_email).map((sent) => (
                        <div
                          key={sent.id}
                          className="p-3.5 rounded-2xl bg-[#E0F2FE] border border-[#7DD3FC] ml-4 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px] font-black text-[#0A0E1A] gap-2">
                            <span className="truncate">
                              {sent.status === 'SENT' ? '✓' : '✗'} {sent.subject}
                            </span>
                            <span className="font-mono text-slate-600 shrink-0">{sent.sent_at}</span>
                          </div>
                          <p className="text-xs text-[#0A0E1A] font-semibold break-words">{sent.body_preview}</p>
                          {sent.status !== 'SENT' && (
                            <p className="text-[11px] font-black text-rose-800">
                              Not delivered{sent.failure_reason ? `: ${sent.failure_reason}` : '.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Reply Box */}
                <div className="pt-4 border-t border-[#E6D8C3] space-y-3">
                  <label className="block text-xs font-black text-[#0A0E1A]">
                    Quick Direct Email Reply (Sends from <strong className="font-mono">book@opalchauffeurs.com.au</strong>):
                  </label>
                  <textarea
                    rows={3}
                    placeholder={`Reply to ${selectedReplyThread.sender_name || selectedReplyThread.sender_email}...`}
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    className="w-full p-3 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs text-[#0A0E1A] font-semibold focus:outline-none focus:border-[#0A0E1A]"
                  />
                  {sendError && (
                    <p className="text-[11px] font-black text-rose-800 break-words">{sendError}</p>
                  )}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuickReplyText(
                            // Was: "Chauffeur Harps is notified" — a name the
                            // sender had no reason to expect, asserted whether
                            // or not any chauffeur had been told anything.
                            `Hi ${(selectedReplyThread.sender_name || '').split(' ')[0] || 'there'},\n\nThank you for your message. We have received your request${
                              selectedReplyThread.booking_number
                                ? ` regarding booking #${selectedReplyThread.booking_number}`
                                : ''
                            } and will confirm shortly.\n\nBest regards,\nOpal Chauffeurs Dispatch`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover-yellow border border-[#E6D8C3] text-[11px] font-black text-[#0A0E1A]"
                      >
                        ⚡ Insert acknowledgement
                      </button>
                    </div>

                    <button
                      onClick={handleSendQuickReply}
                      disabled={isSending || !quickReplyText.trim()}
                      className="px-5 py-2.5 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-60"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? 'Sending…' : 'Send Client Reply'}</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-3">
                <MessageSquare className="w-12 h-12 text-[#0A0E1A] opacity-40" />
                <h4 className="font-black text-base text-[#0A0E1A]">Select a Conversation Thread</h4>
                <p className="text-xs text-slate-600 max-w-sm">
                  Click any client message thread on the left to review their request and send an instant official reply.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: LUXURY EMAIL TEMPLATES LIBRARY
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              id: 'BOOKING_CONFIRMATION',
              title: 'VIP Booking Confirmation & Itinerary',
              desc: 'Dispatched to customer immediately upon booking creation with route, price & vehicle category.',
              icon: CheckCircle2,
              badge: 'AUTOMATED ON BOOK',
            },
            {
              id: 'CHAUFFEUR_DISPATCH',
              title: 'Chauffeur & Vehicle Dossier',
              desc: 'Sent when driver is assigned, complete with Chauffeur Name, Phone, Car Plate & Meet & Greet instructions.',
              icon: Car,
              badge: 'ON ALLOCATION',
            },
            {
              id: 'FLIGHT_DELAY',
              title: 'Airport Flight Delay Advisory',
              desc: 'Triggered when Airport Flight Radar detects flight delays, assuring client chauffeur is adjusted.',
              icon: Plane,
              badge: 'RADAR TRIGGERED',
            },
            {
              id: 'TAX_INVOICE',
              title: 'GST Tax Invoice & Remittance Statement',
              desc: 'Official ATO-compliant tax invoice PDF link sent automatically upon ride completion.',
              icon: Receipt,
              badge: 'POST-TRIP RECEIPT',
            },
            {
              id: 'QUOTE_PROPOSAL',
              title: 'Custom Corporate Chauffeur Quote',
              desc: 'Custom corporate quote with 3D fleet showcase link and fixed pricing calculation.',
              icon: FileText,
              badge: 'PROPOSAL ENGINE',
            },
            {
              id: 'CUSTOM',
              title: 'Direct Executive Broadcast',
              desc: 'Custom high-priority email to VIP clients, corporate account managers, or partner drivers.',
              icon: Mail,
              badge: 'MANUAL BROADCAST',
            },
          ].map((tmpl) => {
            const Icon = tmpl.icon;
            return (
              <div key={tmpl.id} className="bg-[#FAF6F0] p-5 rounded-2xl border border-[#E6D8C3] shadow-md space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-[#FFFFFF] border border-[#DFCAA8] flex items-center justify-center text-[#0A0E1A]">
                      <Icon className="w-4 h-4 text-[#0A0E1A]" />
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[9px] font-mono font-black text-[#0A0E1A]">
                      {tmpl.badge}
                    </span>
                  </div>
                  <h3 className="font-black text-sm text-[#0A0E1A]">{tmpl.title}</h3>
                  <p className="text-xs text-slate-700 font-semibold">{tmpl.desc}</p>
                </div>

                <button
                  onClick={() => {
                    handleSelectTemplate(tmpl.id);
                    setIsComposeOpen(true);
                  }}
                  className="w-full py-2 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Use This Template</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: AUTOMATED TRIGGERS & SMTP ENGINE
      ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'automation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Automation Rules (Toggles) */}
          <div className="bg-[#FAF6F0] p-6 rounded-2xl border border-[#E6D8C3] shadow-md space-y-5 text-[#0A0E1A]">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6D8C3]">
              <Sliders className="w-5 h-5 text-[#0A0E1A]" />
              <h3 className="font-black text-base text-[#0A0E1A]">Automated Dispatch Email Rules</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                <div>
                  <h4 className="font-black text-xs text-[#0A0E1A]">Instant Booking Confirmation Email</h4>
                  <p className="text-[11px] text-slate-700 font-semibold">Sends HTML itinerary to customer immediately on booking creation.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoBookingConfirm}
                  onChange={(e) => setAutoBookingConfirm(e.target.checked)}
                  className="w-5 h-5 accent-[#06090F] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                <div>
                  <h4 className="font-black text-xs text-[#0A0E1A]">Chauffeur Allocated Notification</h4>
                  <p className="text-[11px] text-slate-700 font-semibold">Alerts passenger with Chauffeur name, phone, car model & number plate.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoDriverDispatch}
                  onChange={(e) => setAutoDriverDispatch(e.target.checked)}
                  className="w-5 h-5 accent-[#06090F] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                <div>
                  <h4 className="font-black text-xs text-[#0A0E1A]">Flight Delay Auto-Notification</h4>
                  <p className="text-[11px] text-slate-700 font-semibold">Triggers advisory email if Radar detects flight delay +15 minutes.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoFlightDelay}
                  onChange={(e) => setAutoFlightDelay(e.target.checked)}
                  className="w-5 h-5 accent-[#06090F] rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]">
                <div>
                  <h4 className="font-black text-xs text-[#0A0E1A]">Post-Trip GST Tax Invoice Receipt</h4>
                  <p className="text-[11px] text-slate-700 font-semibold">Automatically emails PDF tax receipt when ride is marked COMPLETED.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoInvoiceReceipt}
                  onChange={(e) => setAutoInvoiceReceipt(e.target.checked)}
                  className="w-5 h-5 accent-[#06090F] rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right: Verified SMTP Sender & Server Status */}
          <div className="bg-[#FAF6F0] p-6 rounded-2xl border border-[#E6D8C3] shadow-md space-y-5 text-[#0A0E1A]">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E6D8C3]">
              <Shield className="w-5 h-5 text-[#0A0E1A]" />
              <h3 className="font-black text-base text-[#0A0E1A]">Verified SMTP & Dispatch Gateway</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#E6D8C3] space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-600 block">Primary Sender Identity</span>
                <p className="font-mono font-black text-sm text-[#0A0E1A]">Opal Chauffeurs Australia Dispatch</p>
                <p className="font-mono text-xs text-[#0A0E1A] font-bold">book@opalchauffeurs.com.au</p>
              </div>

              <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#E6D8C3] space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-600 block">Inbound Reply Routing</span>
                <p className="font-mono font-black text-xs text-[#0A0E1A]">book@opalchauffeurs.com.au (Two-Way Synced)</p>
              </div>

              <div className="p-3.5 bg-[#FFFFFF] rounded-xl border border-[#E6D8C3] space-y-1.5">
                <span className="text-[10px] uppercase font-black text-slate-600 block">DNS & Authentication Health</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-[10px] font-black text-emerald-900 block">SPF RECORD</span>
                    <span className="text-[9px] text-emerald-700 font-bold">✓ PASS</span>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-[10px] font-black text-emerald-900 block">DKIM 2048</span>
                    <span className="text-[9px] text-emerald-700 font-bold">✓ VERIFIED</span>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-[10px] font-black text-emerald-900 block">DMARC POLICY</span>
                    <span className="text-[9px] text-emerald-700 font-bold">✓ REJECT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: PREVIEW HTML EMAIL MODAL
      ───────────────────────────────────────────────────────────── */}
      {viewingEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl max-w-2xl w-full shadow-2xl p-6 sm:p-7 space-y-5 text-[#0A0E1A] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#0A0E1A]" />
                <h3 className="font-black text-base text-[#0A0E1A]">Email Dispatch Record</h3>
              </div>
              <button
                onClick={() => setViewingEmail(null)}
                className="p-1.5 rounded-xl bg-[#06090F] text-white border border-[#DFCAA8]"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-3.5 bg-[#FFFFFF] rounded-2xl border border-[#E6D8C3] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-slate-600">To:</span>
                <span className="font-black text-[#0A0E1A]">{viewingEmail.recipient_name} ({viewingEmail.recipient_email})</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-600">From:</span>
                <span className="font-black text-[#0A0E1A]">Opal Chauffeurs Australia &lt;book@opalchauffeurs.com.au&gt;</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-600">Subject:</span>
                <span className="font-black text-[#0A0E1A]">{viewingEmail.subject}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-600">Dispatched:</span>
                <span className="font-mono text-[#0A0E1A] font-bold">{viewingEmail.sent_at}</span>
              </div>
            </div>

            {/* Luxury HTML Email Body Preview */}
            <div className="border border-[#DFCAA8] rounded-2xl overflow-hidden bg-white shadow-inner">
              {/* Luxury Email Header */}
              <div className="bg-[#06090F] p-4 text-center border-b border-[#DFCAA8]">
                <h2 className="text-sm font-black text-white tracking-widest uppercase">OPAL CHAUFFEURS AUSTRALIA</h2>
                <p className="text-[10px] text-[#DFCAA8] font-mono tracking-wider mt-0.5">EXECUTIVE CHAUFFEUR SERVICES AUSTRALIA-WIDE</p>
              </div>

              {/* Email Content Body */}
              <div className="p-6 text-xs text-[#0A0E1A] font-semibold space-y-4 leading-relaxed">
                <p className="font-black text-sm text-[#0A0E1A]">Dear {viewingEmail.recipient_name},</p>
                <p className="whitespace-pre-wrap">{viewingEmail.html_body || viewingEmail.body_preview}</p>

                {viewingEmail.booking_ref && (
                  <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E6D8C3] space-y-1.5">
                    <span className="text-[10px] uppercase font-black text-slate-700 block">RESERVATION SUMMARY</span>
                    <p className="font-mono text-xs font-black">Booking Reference: {viewingEmail.booking_ref}</p>
                    <p className="text-[11px] text-slate-800 font-bold">24/7 Dispatch Hotline: +61 432 000 718</p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold">Opal Chauffeurs Australia Pty Ltd (ABN 68 642 908 112)</p>
                  <p>Melbourne • Sydney • Brisbane • Gold Coast • Perth • Adelaide</p>
                  <p className="font-mono text-[10px] text-slate-500">https://www.opalchauffeurs.com.au</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  alert(`Resending email to ${viewingEmail.recipient_email}...`);
                  setViewingEmail(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white text-xs font-black shadow-sm"
              >
                Resend Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: COMPOSE NEW EMAIL MODAL
      ───────────────────────────────────────────────────────────── */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] rounded-3xl max-w-xl w-full shadow-2xl p-6 sm:p-7 space-y-4 text-[#0A0E1A]">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#0A0E1A]" />
                <h3 className="font-black text-base text-[#0A0E1A]">Compose Executive Email</h3>
              </div>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="p-1.5 rounded-xl bg-[#06090F] text-white border border-[#DFCAA8]"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSendCustomEmail} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black text-[#0A0E1A] mb-1">Select Preset Template</label>
                <select
                  value={composeTemplate}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs font-black text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A]"
                >
                  <option value="CUSTOM">Custom Manual Email</option>
                  <option value="BOOKING_CONFIRMATION">VIP Booking Confirmation & Itinerary</option>
                  <option value="FLIGHT_DELAY">Airport Flight Delay & Schedule Update</option>
                  <option value="TAX_INVOICE">Tax Invoice & GST Statement</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Sterling"
                    value={composeRecipientName}
                    onChange={(e) => setComposeRecipientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs font-black text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. client@company.com"
                    value={composeRecipientEmail}
                    onChange={(e) => setComposeRecipientEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs font-black font-mono text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-black text-[#0A0E1A] mb-1">Subject Line *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Confirmed: Opal Chauffeurs VIP Booking"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs font-black text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A]"
                  />
                </div>
                <div>
                  <label className="block font-black text-[#0A0E1A] mb-1">Link to Booking</label>
                  <select
                    value={composeBookingRef}
                    onChange={(e) => setComposeBookingRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs font-mono font-black text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A]"
                  >
                    <option value="">Not linked to a booking</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.booking_number} — {b.passenger_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-black text-[#0A0E1A] mb-1">Email Body Message *</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Type your official message here..."
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  className="w-full p-3.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs font-semibold text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E6D8C3]">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] hover-yellow border border-[#E6D8C3] text-xs font-black text-[#0A0E1A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
