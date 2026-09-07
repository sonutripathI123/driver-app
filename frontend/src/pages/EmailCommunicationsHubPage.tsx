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
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';

export interface EmailLog {
  id: string;
  recipient_name: string;
  recipient_email: string;
  trigger_type: 'BOOKING_CONFIRMATION' | 'CHAUFFEUR_DISPATCH' | 'FLIGHT_DELAY' | 'TAX_INVOICE' | 'QUOTE_PROPOSAL' | 'CUSTOM_COMPOSED';
  subject: string;
  booking_ref?: string;
  invoice_ref?: string;
  sent_at: string;
  status: 'DELIVERED' | 'OPENED' | 'CLICKED' | 'FAILED' | 'QUEUED';
  open_count: number;
  body_preview: string;
  html_body?: string;
}

export interface InboundReply {
  id: string;
  sender_name: string;
  sender_email: string;
  booking_ref: string;
  subject: string;
  received_at: string;
  message_content: string;
  status: 'UNREAD' | 'REPLIED' | 'ACTION_NEEDED';
  reply_history?: { sender: string; timestamp: string; text: string }[];
}

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

  // Email Logs State
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(() => {
    const saved = localStorage.getItem('crown_email_logs_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'em-01',
        recipient_name: 'David Sterling',
        recipient_email: 'david.sterling@riotinto.com',
        trigger_type: 'BOOKING_CONFIRMATION',
        subject: 'Confirmed: Opal Chauffeurs VIP Transfer #CCM-2026-9901 [Melbourne Airport ➔ Grand Hyatt]',
        booking_ref: 'CCM-2026-9901',
        sent_at: 'Today at 01:15 PM AEST',
        status: 'OPENED',
        open_count: 3,
        body_preview: 'Dear David Sterling, your VIP Mercedes-Benz S-Class reservation for Melbourne Airport Terminal 1 has been confirmed with Lead Chauffeur Sonu Tripathi.',
      },
      {
        id: 'em-02',
        recipient_name: 'Sahil Tripathi',
        recipient_email: 'sahil.tripathi@gmail.com',
        trigger_type: 'CHAUFFEUR_DISPATCH',
        subject: 'Chauffeur Allocated: Sonu Tripathi (+61 432 000 718) • Mercedes S-Class [ST-9305-VIC]',
        booking_ref: 'CCM-2026-9901',
        sent_at: 'Today at 11:30 AM AEST',
        status: 'CLICKED',
        open_count: 5,
        body_preview: 'Your dedicated chauffeur Sonu Tripathi is allocated. Flight QF400 tracking active. Meet & Greet at Melbourne Airport Terminal 2 carousel.',
      },
      {
        id: 'em-03',
        recipient_name: 'Elena Rostova',
        recipient_email: 'elena.rostova@prestige.com',
        trigger_type: 'FLIGHT_DELAY',
        subject: 'Flight Advisory QF400 (+25m Delay): Your Chauffeur Schedule Updated to 06:55 PM AEST',
        booking_ref: 'CCM-2026-5520',
        sent_at: 'Yesterday at 06:20 PM AEST',
        status: 'OPENED',
        open_count: 2,
        body_preview: 'Our Airport Radar Engine detected a 25-minute flight delay on QF400. Your chauffeur has adjusted arrival at Essendon Fields accordingly.',
      },
      {
        id: 'em-04',
        recipient_name: 'Claire Redfield',
        recipient_email: 'claire.redfield@bhp.com',
        trigger_type: 'TAX_INVOICE',
        subject: 'Tax Invoice & GST Statement #INV-2026-8801 ($680.00 AUD) — BHP Billiton VIP Tour',
        invoice_ref: 'INV-2026-8801',
        booking_ref: 'CCM-2026-9940',
        sent_at: 'Yesterday at 04:45 PM AEST',
        status: 'DELIVERED',
        open_count: 1,
        body_preview: 'Please find attached Tax Invoice #INV-2026-8801 for Mercedes-Benz Sprinter luxury minibus charter to Domaine Chandon Winery (Paid via AMEX).',
      },
      {
        id: 'em-05',
        recipient_name: 'Alexander Vance',
        recipient_email: 'a.vance@hsf.com.au',
        trigger_type: 'QUOTE_PROPOSAL',
        subject: 'VIP Chauffeur Proposal: Herbert Smith Freehills Crown Towers Delegation Transfer',
        booking_ref: 'CCM-2026-6641',
        sent_at: '28 Aug 2026, 09:10 AM AEST',
        status: 'OPENED',
        open_count: 4,
        body_preview: 'Thank you for requesting an executive quote for 7-Seater Mercedes-Benz V-Class. Total fixed fare $240.00 AUD (Inc GST).',
      },
      {
        id: 'em-06',
        recipient_name: 'Robert Langdon (Sydney Chauffeurs)',
        recipient_email: 'dispatch@silverservice.com.au',
        trigger_type: 'CHAUFFEUR_DISPATCH',
        subject: 'Subcontractor Partner Trip Manifest #CCM-2026-7712 (Sydney Airport ➔ Barangaroo)',
        booking_ref: 'CCM-2026-7712',
        sent_at: '27 Aug 2026, 02:20 PM AEST',
        status: 'DELIVERED',
        open_count: 2,
        body_preview: 'Partner allocation offer for Sydney VIP transfer. Subcontractor Payout: $150.00 AUD. Please confirm acceptance in driver portal.',
      },
    ];
  });

  // Inbound Replies State
  const [inboundReplies, setInboundReplies] = useState<InboundReply[]>(() => {
    const saved = localStorage.getItem('crown_inbound_replies_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'in-01',
        sender_name: 'David Sterling',
        sender_email: 'david.sterling@riotinto.com',
        booking_ref: 'CCM-2026-9901',
        subject: 'Re: Confirmed: Opal Chauffeurs VIP Transfer #CCM-2026-9901',
        received_at: 'Today at 02:40 PM AEST',
        status: 'UNREAD',
        message_content: 'Hi Harps, thanks for the confirmation! Could you please ensure the chauffeur has an extra baby booster seat in the S-Class? We have our toddler with us.',
        reply_history: [],
      },
      {
        id: 'in-02',
        sender_name: 'Elena Rostova',
        sender_email: 'elena.rostova@prestige.com',
        booking_ref: 'CCM-2026-5520',
        subject: 'Re: Flight Advisory QF400 (+25m Delay)',
        received_at: 'Yesterday at 06:45 PM AEST',
        status: 'REPLIED',
        message_content: 'Appreciate the proactive flight delay tracking! We just touched down on the tarmac. Will exit via Carousel 3 in 10 minutes.',
        reply_history: [
          {
            sender: 'Harps Randhawa (Director)',
            timestamp: 'Yesterday at 06:50 PM AEST',
            text: 'Welcome to Melbourne Ms. Rostova! Chauffeur Sonu is standing by at Gate 2 with your name board. Safe travels.',
          },
        ],
      },
      {
        id: 'in-03',
        sender_name: 'Claire Redfield',
        sender_email: 'claire.redfield@bhp.com',
        booking_ref: 'CCM-2026-9940',
        subject: 'Re: Tax Invoice & GST Statement #INV-2026-8801',
        received_at: 'Yesterday at 05:15 PM AEST',
        status: 'ACTION_NEEDED',
        message_content: 'Received invoice thank you. Could you please also CC accounts-au@bhp.com on all future tax invoices so our finance department processes them automatically?',
        reply_history: [],
      },
      {
        id: 'in-04',
        sender_name: 'Alexander Vance',
        sender_email: 'a.vance@hsf.com.au',
        booking_ref: 'CCM-2026-6641',
        subject: 'Re: VIP Chauffeur Proposal: Herbert Smith Freehills',
        received_at: '28 Aug 2026, 11:30 AM AEST',
        status: 'REPLIED',
        message_content: 'Quote approved. Please charge to our corporate account and assign the Mercedes V-Class with driver Sonu.',
        reply_history: [
          {
            sender: 'Harps Randhawa (Director)',
            timestamp: '28 Aug 2026, 11:45 AM AEST',
            text: 'Booking confirmed and charged to HSF Corporate Account #HSF-771. Thank you Mr. Vance.',
          },
        ],
      },
    ];
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('crown_email_logs_v1', JSON.stringify(emailLogs));
  }, [emailLogs]);

  useEffect(() => {
    localStorage.setItem('crown_inbound_replies_v1', JSON.stringify(inboundReplies));
  }, [inboundReplies]);

  // Handle Send Custom Email
  const handleSendCustomEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeRecipientEmail || !composeSubject) {
      alert('Please enter recipient email and subject.');
      return;
    }

    const newLog: EmailLog = {
      id: `em-${Date.now()}`,
      recipient_name: composeRecipientName || composeRecipientEmail.split('@')[0],
      recipient_email: composeRecipientEmail,
      trigger_type: composeTemplate === 'CUSTOM' ? 'CUSTOM_COMPOSED' : (composeTemplate as any),
      subject: composeSubject,
      booking_ref: composeBookingRef || undefined,
      sent_at: 'Just now (AEST)',
      status: 'DELIVERED',
      open_count: 0,
      body_preview: composeMessage.slice(0, 160) + (composeMessage.length > 160 ? '...' : ''),
      html_body: composeMessage,
    };

    setEmailLogs([newLog, ...emailLogs]);

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
  };

  // Handle Quick Reply to Inbound Thread
  const handleSendQuickReply = () => {
    if (!selectedReplyThread || !quickReplyText.trim()) return;

    const newReplyItem = {
      sender: 'Harps Randhawa (Director)',
      timestamp: 'Just now (AEST)',
      text: quickReplyText.trim(),
    };

    const updatedThreads = inboundReplies.map((thread) => {
      if (thread.id === selectedReplyThread.id) {
        return {
          ...thread,
          status: 'REPLIED' as const,
          reply_history: [...(thread.reply_history || []), newReplyItem],
        };
      }
      return thread;
    });

    setInboundReplies(updatedThreads);

    // Also log in sent emails
    const outgoingLog: EmailLog = {
      id: `em-${Date.now()}`,
      recipient_name: selectedReplyThread.sender_name,
      recipient_email: selectedReplyThread.sender_email,
      trigger_type: 'CUSTOM_COMPOSED',
      subject: `Re: ${selectedReplyThread.subject}`,
      booking_ref: selectedReplyThread.booking_ref,
      sent_at: 'Just now (AEST)',
      status: 'DELIVERED',
      open_count: 0,
      body_preview: quickReplyText.trim(),
    };
    setEmailLogs([outgoingLog, ...emailLogs]);

    setSelectedReplyThread((prev) =>
      prev
        ? {
            ...prev,
            status: 'REPLIED',
            reply_history: [...(prev.reply_history || []), newReplyItem],
          }
        : null
    );

    setQuickReplyText('');
    confetti({
      particleCount: 70,
      spread: 50,
      origin: { y: 0.6 },
      colors: ['#DFCAA8', '#38BDF8'],
    });
  };

  // Template autofill
  const handleSelectTemplate = (templateKey: string) => {
    setComposeTemplate(templateKey);
    if (templateKey === 'BOOKING_CONFIRMATION') {
      setComposeSubject('Confirmed: Opal Chauffeurs VIP Transfer Booking #CCM-2026-9901');
      setComposeMessage(
        `Dear Valued VIP Client,\n\nWe are pleased to confirm your upcoming executive chauffeur service with Opal Chauffeurs Australia.\n\n📍 Pickup Location: Melbourne Airport Terminal 2 (Meet & Greet)\n📍 Dropoff: Crown Towers Melbourne (8 Whiteman St, Southbank)\n🚘 Vehicle: Mercedes-Benz V-Class VIP (Rego: CPS711)\n🧑‍✈️ Lead Chauffeur: Harps Randhawa (+61 432 000 718)\n\nFlight tracking is active. Your chauffeur will be waiting in the arrival hall with your personalized digital nameboard.\n\nWarm regards,\nOpal Chauffeurs Australia Dispatch Team\nhttps://www.opalchauffeurs.com.au`
      );
    } else if (templateKey === 'FLIGHT_DELAY') {
      setComposeSubject('Flight Schedule Update: Opal Chauffeurs Pickup Adjusted for Flight QF400');
      setComposeMessage(
        `Dear Passenger,\n\nOur Automated Airport Flight Radar Engine has tracked an update for your incoming flight QF400.\n\nYour lead chauffeur has automatically rescheduled pickup to accommodate the updated arrival time with zero wait-time surcharge.\n\nTrack live chauffeur status or contact dispatch directly at book@opalchauffeurs.com.au.\n\nSafe flight,\nOpal Chauffeurs Operations`
      );
    } else if (templateKey === 'TAX_INVOICE') {
      setComposeSubject('Tax Invoice & Payment Receipt #INV-2026-8801 — Opal Chauffeurs Australia Pty Ltd');
      setComposeMessage(
        `Dear Accounts Department,\n\nPlease find attached the official Tax Invoice & GST Statement for recent executive chauffeur services.\n\nEntity: Opal Chauffeurs Australia Pty Ltd (ABN: 68 642 908 112)\nInvoice Reference: #INV-2026-8801\nTotal Amount: $460.00 AUD (Includes $41.82 GST)\nStatus: PAID IN FULL\n\nThank you for choosing Opal Chauffeurs.\nfinance@opalchauffeurs.com.au`
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
            <span className="px-1.5 py-0.2 rounded bg-[#06090F] text-white text-[9px] font-mono font-black">SPF/DKIM ✓</span>
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
          <div className="text-2xl font-black font-mono mt-1 text-[#0A0E1A]">{emailLogs.length} Dispatched</div>
          <div className="text-[10px] font-bold text-[#0A0E1A] mt-1">100% cloud delivery verified</div>
        </div>

        <div className="bg-[#FAF6F0] border border-[#E6D8C3] p-4 rounded-2xl shadow-sm text-[#0A0E1A]">
          <div className="flex items-center justify-between text-xs font-black text-[#0A0E1A]">
            <span>DELIVERY SUCCESS</span>
            <CheckCircle2 className="w-4 h-4 text-[#0A0E1A]" />
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-[#0A0E1A]">99.8% Success</div>
          <div className="text-[10px] font-bold text-[#0A0E1A] mt-1">0 Bounces • Resend Engine Active</div>
        </div>

        <div className="bg-[#FAF6F0] border border-[#E6D8C3] p-4 rounded-2xl shadow-sm text-[#0A0E1A]">
          <div className="flex items-center justify-between text-xs font-black text-[#0A0E1A]">
            <span>CLIENT OPEN RATE</span>
            <Eye className="w-4 h-4 text-[#0A0E1A]" />
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-[#0A0E1A]">86.4% Opened</div>
          <div className="text-[10px] font-bold text-[#0A0E1A] mt-1">Real-time pixel telemetry</div>
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
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                          <span className="font-black text-[11px] text-[#0A0E1A]">{log.status}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 block mt-0.5">
                          👁️ {log.open_count} Opens recorded
                        </span>
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
                    onClick={() => setSelectedReplyThread(thread)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E0F2FE] border-[#7DD3FC] shadow-sm'
                        : 'bg-[#FFFFFF] border-[#E6D8C3] hover:bg-[#FAF6F0]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0A0E1A]">{thread.sender_name}</span>
                      <span className="text-[10px] font-mono text-slate-600">{thread.received_at}</span>
                    </div>
                    <p className="text-xs font-bold text-[#0A0E1A] mt-1 truncate">{thread.subject}</p>
                    <p className="text-[11px] text-slate-700 font-semibold mt-1 line-clamp-2">
                      {thread.message_content}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E6D8C3]">
                      <span className="font-mono text-[10px] text-[#0A0E1A] font-black">
                        Ref: {thread.booking_ref}
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
            </div>
          </div>

          {/* Right: Selected Thread Detail & Quick Reply (7 Cols) */}
          <div className="lg:col-span-7 bg-[#FAF6F0] p-6 rounded-2xl border border-[#E6D8C3] shadow-md flex flex-col justify-between space-y-4 min-h-[500px]">
            {selectedReplyThread ? (
              <>
                <div className="space-y-4">
                  {/* Thread Header */}
                  <div className="flex items-start justify-between border-b border-[#E6D8C3] pb-4">
                    <div>
                      <h3 className="font-black text-base text-[#0A0E1A]">{selectedReplyThread.subject}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#0A0E1A]">
                        <span className="font-black">From: {selectedReplyThread.sender_name}</span>
                        <span className="font-mono text-slate-600">({selectedReplyThread.sender_email})</span>
                      </div>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded bg-[#FFFFFF] border border-[#DFCAA8] text-[10px] font-mono font-black text-[#0A0E1A]">
                        Master Booking: {selectedReplyThread.booking_ref}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-600 font-bold">{selectedReplyThread.received_at}</span>
                  </div>

                  {/* Initial Client Message Bubble */}
                  <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3] space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-[#0A0E1A]">💬 Client Message:</span>
                    </div>
                    <p className="text-xs text-[#0A0E1A] font-semibold leading-relaxed whitespace-pre-wrap">
                      {selectedReplyThread.message_content}
                    </p>
                  </div>

                  {/* Reply History If Any */}
                  {selectedReplyThread.reply_history && selectedReplyThread.reply_history.length > 0 && (
                    <div className="space-y-2.5">
                      <span className="text-xs font-black text-[#0A0E1A] block">Dispatch Responses:</span>
                      {selectedReplyThread.reply_history.map((rep, idx) => (
                        <div key={idx} className="p-3.5 rounded-2xl bg-[#E0F2FE] border border-[#7DD3FC] ml-4 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-black text-[#0A0E1A]">
                            <span>✓ {rep.sender}</span>
                            <span className="font-mono text-slate-600">{rep.timestamp}</span>
                          </div>
                          <p className="text-xs text-[#0A0E1A] font-semibold">{rep.text}</p>
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
                    placeholder={`Reply to ${selectedReplyThread.sender_name}...`}
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    className="w-full p-3 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs text-[#0A0E1A] font-semibold focus:outline-none focus:border-[#0A0E1A]"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuickReplyText(
                            `Hi ${selectedReplyThread.sender_name.split(' ')[0]},\n\nWe have received your request and updated your booking #${selectedReplyThread.booking_ref} accordingly. Chauffeur Harps is notified.\n\nBest regards,\nOpal Chauffeurs Dispatch`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover-yellow border border-[#E6D8C3] text-[11px] font-black text-[#0A0E1A]"
                      >
                        ⚡ Insert "Request Confirmed" Template
                      </button>
                    </div>

                    <button
                      onClick={handleSendQuickReply}
                      className="px-5 py-2.5 rounded-xl bg-[#06090F] hover-sky border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Client Reply</span>
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
                  <label className="block font-black text-[#0A0E1A] mb-1">Booking Ref</label>
                  <input
                    type="text"
                    placeholder="CCM-2026-9901"
                    value={composeBookingRef}
                    onChange={(e) => setComposeBookingRef(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-xs font-mono font-black text-[#0A0E1A] focus:outline-none focus:border-[#0A0E1A]"
                  />
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
