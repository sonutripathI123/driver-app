import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { mailboxesApi, bookingsApi } from '../services/api';
import { Mailbox, InboundEmail } from '../types';
import {
  Inbox,
  Mail,
  Plus,
  RefreshCw,
  Settings,
  Send,
  CheckCircle2,
  AlertTriangle,
  LoaderCircle,
  Trash2,
  X,
  PlugZap,
  CalendarPlus,
  Sparkles,
} from 'lucide-react';

/**
 * Email-to-booking workflow across several connected mailboxes.
 *
 * Sub-tabs per mailbox → the received enquiries for that account → reply from
 * that same address (a quote, a code, a confirmation) → and when the client is
 * ready, turn the enquiry straight into a booking that enters the normal
 * dispatch/invoice pipeline. Mailboxes are managed here too (add/test/remove);
 * their passwords are stored encrypted on the server and never sent back.
 */

const apiError = (err: any, fallback: string): string => {
  const d = err?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d.length) return d.map((x: any) => `${(x.loc || []).slice(1).join('.') || 'field'}: ${x.msg}`).join(' • ');
  return err?.message || fallback;
};

const fmt = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const EMPTY_MAILBOX = {
  label: '',
  email_address: '',
  imap_host: '',
  imap_port: 993,
  smtp_host: '',
  smtp_port: 587,
  smtp_use_tls: true,
  username: '',
  password: '',
};

export const EmailBookingWorkflowPage: React.FC = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threads, setThreads] = useState<InboundEmail[]>([]);
  const [selectedThread, setSelectedThread] = useState<InboundEmail | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // reply
  const [replyText, setReplyText] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  // AI-drafted reply
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [aiDrafts, setAiDrafts] = useState<Record<string, { subject: string; message: string }>>({});

  // manage mailboxes modal
  const [manageOpen, setManageOpen] = useState(false);
  const [newMailbox, setNewMailbox] = useState({ ...EMPTY_MAILBOX });
  const [savingMailbox, setSavingMailbox] = useState(false);
  const [mailboxError, setMailboxError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  // booking-from-enquiry modal
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    pickup_address: '', dropoff_address: '', pickup_datetime: '',
    vehicle_category: 'SEDAN_EXECUTIVE', total_fare: 0, is_airport_pickup: false, flight_number: '',
  });
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingCreated, setBookingCreated] = useState<string | null>(null);

  const selectedMailbox = useMemo(() => mailboxes.find((m) => m.id === selectedId) || null, [mailboxes, selectedId]);

  const loadMailboxes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await mailboxesApi.list();
      setMailboxes(list);
      setSelectedId((prev) => prev && list.some((m) => m.id === prev) ? prev : (list[0]?.id ?? null));
    } catch (err: any) {
      setLoadError(apiError(err, 'Could not load mailboxes.'));
      setMailboxes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThreads = useCallback(async (mailboxId: string) => {
    setThreadsLoading(true);
    setSelectedThread(null);
    try {
      const rows = await mailboxesApi.listInbound(mailboxId, 100);
      setThreads(rows);
    } catch {
      setThreads([]);
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => { loadMailboxes(); }, [loadMailboxes]);
  useEffect(() => { if (selectedId) loadThreads(selectedId); else setThreads([]); }, [selectedId, loadThreads]);

  const unreadCount = (mailboxId: string) => threads.filter((t) => t.mailbox_id === mailboxId && t.status === 'UNREAD').length;

  const handlePoll = async () => {
    setPolling(true);
    setNotice(null);
    try {
      const res = await mailboxesApi.pollAll();
      const pulled = Array.isArray(res) ? res.reduce((s: number, r: any) => s + (r.stored || 0), 0) : 0;
      setNotice(pulled ? `${pulled} new email(s) pulled.` : 'No new emails.');
      await loadMailboxes();
      if (selectedId) await loadThreads(selectedId);
    } catch (err: any) {
      setNotice(apiError(err, 'Could not refresh mailboxes.'));
    } finally {
      setPolling(false);
    }
  };

  const generateDraft = async (t: InboundEmail, force = false) => {
    if (!selectedId) return;
    // Reuse an existing draft for this thread unless a fresh one is asked for.
    if (!force && aiDrafts[t.id]) {
      setReplySubject(aiDrafts[t.id].subject);
      setReplyText(aiDrafts[t.id].message);
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const d = await mailboxesApi.draftReply(selectedId, t.id);
      setAiDrafts((prev) => ({ ...prev, [t.id]: { subject: d.subject, message: d.message } }));
      // Only fill if the operator is still looking at this same thread.
      setSelectedThread((cur) => {
        if (cur && cur.id === t.id) {
          setReplySubject(d.subject);
          setReplyText(d.message);
        }
        return cur;
      });
    } catch (err: any) {
      setDraftError(apiError(err, 'AI draft failed.'));
    } finally {
      setDrafting(false);
    }
  };

  const openThread = async (t: InboundEmail) => {
    setSelectedThread(t);
    setReplyError(null);
    setDraftError(null);
    // If we already drafted this thread, restore it; otherwise auto-draft a
    // reply with the Claude API (unless it's already been replied to).
    if (aiDrafts[t.id]) {
      setReplySubject(aiDrafts[t.id].subject);
      setReplyText(aiDrafts[t.id].message);
    } else {
      setReplyText('');
      setReplySubject(`Re: ${t.subject || '(no subject)'}`);
      if (t.status !== 'REPLIED') {
        generateDraft(t);
      }
    }
  };

  const handleReply = async () => {
    if (!selectedThread || !selectedId || !replyText.trim()) return;
    setSending(true);
    setReplyError(null);
    try {
      const notif = await mailboxesApi.reply(selectedId, {
        to_email: selectedThread.sender_email,
        subject: replySubject.trim() || `Re: ${selectedThread.subject || ''}`,
        message: replyText.trim(),
        booking_id: selectedThread.booking_id || undefined,
        inbound_id: selectedThread.id,
      });
      if (notif?.status === 'SENT') {
        setNotice('Reply sent from ' + (selectedMailbox?.email_address || 'the mailbox') + '.');
        setReplyText('');
        setThreads((prev) => prev.map((t) => t.id === selectedThread.id ? { ...t, status: 'REPLIED' } : t));
        setSelectedThread((prev) => prev ? { ...prev, status: 'REPLIED' } : prev);
      } else {
        setReplyError((notif as any)?.error_message || 'The reply was recorded but the provider did not confirm it.');
      }
    } catch (err: any) {
      setReplyError(apiError(err, 'Reply failed.'));
    } finally {
      setSending(false);
    }
  };

  // --- mailbox management ---
  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setMailboxError(null);
    setSavingMailbox(true);
    try {
      await mailboxesApi.create(newMailbox);
      setNewMailbox({ ...EMPTY_MAILBOX });
      await loadMailboxes();
    } catch (err: any) {
      setMailboxError(apiError(err, 'Could not save the mailbox.'));
    } finally {
      setSavingMailbox(false);
    }
  };

  const handleTestMailbox = async (id: string) => {
    setTestingId(id);
    try {
      const r = await mailboxesApi.test(id);
      setTestResult((prev) => ({ ...prev, [id]: r.imap_ok && r.smtp_ok ? '✓ Both IMAP & SMTP connected' : `✗ ${r.detail}` }));
    } catch (err: any) {
      setTestResult((prev) => ({ ...prev, [id]: '✗ ' + apiError(err, 'Test failed') }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteMailbox = async (m: Mailbox) => {
    if (!window.confirm(`Disconnect mailbox "${m.label}" (${m.email_address})? Its received messages stay, but it won't be polled anymore.`)) return;
    try {
      await mailboxesApi.remove(m.id);
      await loadMailboxes();
    } catch (err: any) {
      alert(apiError(err, 'Could not remove the mailbox.'));
    }
  };

  // --- booking from enquiry ---
  const openBookingFromThread = (t: InboundEmail) => {
    setBookingError(null);
    setBookingCreated(null);
    setBookingForm({
      customer_name: t.sender_name || '',
      customer_email: t.sender_email || '',
      customer_phone: '',
      pickup_address: '',
      dropoff_address: '',
      pickup_datetime: '',
      vehicle_category: 'SEDAN_EXECUTIVE',
      total_fare: 0,
      is_airport_pickup: false,
      flight_number: '',
    });
    setBookingOpen(true);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setCreatingBooking(true);
    try {
      const created = await bookingsApi.create({
        source: 'EMAIL',
        customer_name: bookingForm.customer_name.trim(),
        customer_email: bookingForm.customer_email.trim() || undefined,
        customer_phone: bookingForm.customer_phone.trim() || undefined,
        passenger_name: bookingForm.customer_name.trim(),
        passenger_phone: bookingForm.customer_phone.trim() || undefined,
        total_fare: Number(bookingForm.total_fare) || 0,
        legs: [{
          leg_number: 1,
          pickup_address: bookingForm.pickup_address.trim(),
          dropoff_address: bookingForm.dropoff_address.trim(),
          pickup_datetime: new Date(bookingForm.pickup_datetime).toISOString(),
          vehicle_category: bookingForm.vehicle_category,
          is_airport_pickup: bookingForm.is_airport_pickup,
          flight_number: bookingForm.flight_number.trim() || undefined,
        }],
      });
      setBookingCreated(created.booking_number);
    } catch (err: any) {
      setBookingError(apiError(err, 'Could not create the booking.'));
    } finally {
      setCreatingBooking(false);
    }
  };

  const fld = 'w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E6D8C3] rounded-xl text-[#0A0E1A] font-bold text-xs focus:outline-none focus:border-[#0A0E1A]';
  const lbl = 'text-[10px] text-[#0A0E1A] block uppercase font-black mb-1';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#0A0E1A] tracking-tight">Email Booking Workflow</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[#FFFFFF] border border-[#DFCAA8] text-[#0A0E1A] text-xs font-black font-mono shadow-sm">
              MULTI-MAILBOX
            </span>
          </div>
          <p className="text-xs text-slate-700 font-semibold mt-1">
            Read enquiries per mailbox, reply with a quote or code from the same address, and turn an enquiry into a booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePoll} disabled={polling || mailboxes.length === 0}
            className="px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] text-[#0A0E1A] font-black text-xs flex items-center gap-2 shadow-sm disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} /> {polling ? 'Refreshing…' : 'Refresh mail'}
          </button>
          <button onClick={() => { setManageOpen(true); setMailboxError(null); }}
            className="px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#121824] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs flex items-center gap-2 shadow-md">
            <Settings className="w-4 h-4 text-[#DFCAA8]" /> Manage mailboxes
          </button>
        </div>
      </div>

      {notice && (
        <div className="glass-panel p-3.5 rounded-xl border border-[#DFCAA8] flex items-center justify-between gap-3 text-xs">
          <span className="font-bold text-[#0A0E1A]">{notice}</span>
          <button onClick={() => setNotice(null)}><X className="w-4 h-4 text-[#0A0E1A]" /></button>
        </div>
      )}

      {loadError && (
        <div className="glass-panel p-5 rounded-2xl border border-rose-300 bg-rose-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="text-xs"><p className="font-black text-rose-900">{loadError}</p>
            <button onClick={loadMailboxes} className="mt-2 px-3 py-1.5 rounded-lg bg-[#06090F] text-white font-black text-[11px] border border-[#DFCAA8]">Try again</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-10 rounded-2xl flex flex-col items-center gap-2">
          <LoaderCircle className="w-6 h-6 text-[#7B6035] animate-spin" />
          <p className="text-xs font-black text-[#0A0E1A]">Loading mailboxes…</p>
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-3">
          <Inbox className="w-9 h-9 text-[#7B6035] mx-auto" />
          <p className="text-sm font-black text-[#0A0E1A]">No mailboxes connected yet.</p>
          <p className="text-xs text-slate-700 font-semibold">Connect the 3-4 email accounts your enquiries arrive on. Each gets its own tab here.</p>
          <button onClick={() => setManageOpen(true)} className="mt-1 px-4 py-2.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-[#FAF6F0] font-black text-xs inline-flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#DFCAA8]" /> Connect a mailbox
          </button>
        </div>
      ) : (
        <>
          {/* Mailbox tabs */}
          <div className="flex flex-wrap gap-2">
            {mailboxes.map((m) => (
              <button key={m.id} onClick={() => setSelectedId(m.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-2 ${
                  selectedId === m.id ? 'bg-[#06090F] text-white border-[#DFCAA8]' : 'bg-[#FFFFFF] text-[#0A0E1A] border-[#E6D8C3] hover:bg-[#FAF6F0]'}`}>
                <Mail className="w-3.5 h-3.5" />
                <span>{m.label}</span>
                {!m.is_active && <span className="text-[9px] opacity-70">(off)</span>}
              </button>
            ))}
          </div>

          {selectedMailbox && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Thread list */}
              <div className="lg:col-span-5 glass-panel rounded-2xl border border-[#E6D8C3] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-2.5">
                  <div>
                    <h3 className="text-sm font-black text-[#0A0E1A]">{selectedMailbox.email_address}</h3>
                    <p className="text-[10px] text-slate-600 font-semibold">
                      {selectedMailbox.last_poll_error ? <span className="text-rose-700">Last poll error: {selectedMailbox.last_poll_error}</span>
                        : selectedMailbox.last_polled_at ? `Last checked ${fmt(selectedMailbox.last_polled_at)}` : 'Not polled yet'}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600">{threads.length} msg</span>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {threadsLoading ? (
                    <div className="p-6 flex justify-center"><LoaderCircle className="w-5 h-5 text-[#7B6035] animate-spin" /></div>
                  ) : threads.length === 0 ? (
                    <div className="p-6 text-center text-xs font-semibold text-slate-600">
                      No messages here yet. New enquiries appear after a refresh (or the 15-min auto-poll).
                    </div>
                  ) : threads.map((t) => (
                    <div key={t.id} onClick={() => openThread(t)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedThread?.id === t.id ? 'bg-[#E0F2FE] border-[#7DD3FC]' : 'bg-[#FFFFFF] border-[#E6D8C3] hover:bg-[#FAF6F0]'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-xs text-[#0A0E1A] truncate">{t.sender_name || t.sender_email}</span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">{fmt(t.received_at)}</span>
                      </div>
                      <p className="text-xs font-bold text-[#0A0E1A] truncate mt-0.5">{t.subject}</p>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{t.body_text}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-mono text-slate-500">{t.booking_number ? `Ref ${t.booking_number}` : ''}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                          t.status === 'UNREAD' ? 'bg-[#06090F] text-white border-[#DFCAA8]'
                          : t.status === 'REPLIED' ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'}`}>{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thread detail + reply + create booking */}
              <div className="lg:col-span-7 glass-panel rounded-2xl border border-[#E6D8C3] p-5 min-h-[400px]">
                {!selectedThread ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-16 gap-2">
                    <Mail className="w-10 h-10 text-[#7B6035] opacity-40" />
                    <p className="text-sm font-black text-[#0A0E1A]">Select an enquiry to read and reply</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border-b border-[#E6D8C3] pb-3">
                      <h3 className="font-black text-base text-[#0A0E1A]">{selectedThread.subject}</h3>
                      <p className="text-xs text-slate-600 font-bold mt-0.5">
                        From: {selectedThread.sender_name || 'Unnamed'} <span className="font-mono">({selectedThread.sender_email})</span> • {fmt(selectedThread.received_at)}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#E6D8C3]">
                      <p className="text-xs text-[#0A0E1A] font-semibold whitespace-pre-wrap break-words">{selectedThread.body_text || '(no message body)'}</p>
                    </div>

                    {/* Reply */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className={lbl}>Reply from {selectedMailbox.email_address}</label>
                        <button
                          type="button"
                          onClick={() => generateDraft(selectedThread, true)}
                          disabled={drafting}
                          title="Draft a reply with Claude AI"
                          className="px-2.5 py-1 rounded-lg bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-[#FAF6F0] font-black text-[10px] flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                        >
                          {drafting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[#DFCAA8]" />}
                          {drafting ? 'Drafting…' : (aiDrafts[selectedThread.id] ? 'Regenerate AI draft' : 'Draft with AI')}
                        </button>
                      </div>
                      {drafting && <p className="text-[11px] font-bold text-slate-600">Claude is drafting a reply from this enquiry — you can edit it before sending.</p>}
                      {draftError && <p className="text-[11px] font-black text-rose-800 break-words">AI draft: {draftError}</p>}
                      <input className={fld} value={replySubject} onChange={(e) => setReplySubject(e.target.value)} placeholder="Subject" />
                      <textarea rows={5} className={fld} value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply — or use “Draft with AI” to auto-write one from the enquiry…" />
                      {replyError && <p className="text-[11px] font-black text-rose-800 break-words">{replyError}</p>}
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => openBookingFromThread(selectedThread)}
                          className="px-3.5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#DFCAA8] text-[#0A0E1A] font-black text-xs flex items-center gap-1.5 shadow-sm">
                          <CalendarPlus className="w-4 h-4" /> Create booking from this
                        </button>
                        <button onClick={handleReply} disabled={sending || !replyText.trim()}
                          className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 shadow-md disabled:opacity-60">
                          {sending ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {sending ? 'Sending…' : 'Send reply'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Manage mailboxes modal */}
      {manageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 rounded-3xl w-full max-w-2xl shadow-2xl space-y-4 text-[#0A0E1A] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-[#FFFFFF] border border-[#DFCAA8]"><Settings className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-base font-black">Connected mailboxes</h3>
                  <p className="text-[11px] font-bold text-slate-700">Passwords are stored encrypted and never shown again.</p>
                </div>
              </div>
              <button onClick={() => setManageOpen(false)} className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]"><X className="w-4 h-4" /></button>
            </div>

            {/* existing list */}
            <div className="space-y-2">
              {mailboxes.length === 0 && <p className="text-xs font-semibold text-slate-600">None yet — add your first below.</p>}
              {mailboxes.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{m.label} <span className="font-mono font-bold text-slate-600">· {m.email_address}</span></p>
                    <p className="text-[10px] text-slate-600 font-mono">IMAP {m.imap_host}:{m.imap_port} · SMTP {m.smtp_host}:{m.smtp_port}</p>
                    {testResult[m.id] && <p className={`text-[10px] font-black mt-0.5 ${testResult[m.id].startsWith('✓') ? 'text-emerald-800' : 'text-rose-800'}`}>{testResult[m.id]}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleTestMailbox(m.id)} disabled={testingId === m.id}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#FAF6F0] border border-[#E6D8C3] text-[11px] font-black flex items-center gap-1 disabled:opacity-50">
                      {testingId === m.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />} Test
                    </button>
                    <button onClick={() => handleDeleteMailbox(m)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FFF1F2] hover:bg-[#FFE4E6] border border-[#FECACA] text-[#B91C1C] text-[11px] font-black">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* add form */}
            <form onSubmit={handleCreateMailbox} className="space-y-3 border-t border-[#E6D8C3] pt-4">
              <p className="text-xs font-black">Add a mailbox</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Label *</label><input className={fld} required value={newMailbox.label} onChange={(e) => setNewMailbox({ ...newMailbox, label: e.target.value })} placeholder="e.g. Corporate enquiries" /></div>
                <div><label className={lbl}>Email address *</label><input className={fld} required type="email" value={newMailbox.email_address} onChange={(e) => setNewMailbox({ ...newMailbox, email_address: e.target.value, username: newMailbox.username || e.target.value })} placeholder="name@yourdomain.com" /></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className={lbl}>IMAP host *</label><input className={fld} required value={newMailbox.imap_host} onChange={(e) => setNewMailbox({ ...newMailbox, imap_host: e.target.value })} placeholder="imap.zoho.in" /></div>
                <div><label className={lbl}>IMAP port</label><input className={fld} type="number" value={newMailbox.imap_port} onChange={(e) => setNewMailbox({ ...newMailbox, imap_port: parseInt(e.target.value, 10) })} /></div>
                <div><label className={lbl}>SMTP host *</label><input className={fld} required value={newMailbox.smtp_host} onChange={(e) => setNewMailbox({ ...newMailbox, smtp_host: e.target.value })} placeholder="smtp.zoho.in" /></div>
                <div><label className={lbl}>SMTP port</label><input className={fld} type="number" value={newMailbox.smtp_port} onChange={(e) => setNewMailbox({ ...newMailbox, smtp_port: parseInt(e.target.value, 10) })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={lbl}>Username *</label><input className={fld} required value={newMailbox.username} onChange={(e) => setNewMailbox({ ...newMailbox, username: e.target.value })} placeholder="usually the full email" /></div>
                <div><label className={lbl}>Password / app-password *</label><input className={fld} required type="password" value={newMailbox.password} onChange={(e) => setNewMailbox({ ...newMailbox, password: e.target.value })} placeholder="stored encrypted" /></div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={newMailbox.smtp_use_tls} onChange={(e) => setNewMailbox({ ...newMailbox, smtp_use_tls: e.target.checked })} />
                SMTP uses STARTTLS (port 587). Uncheck for SSL (port 465).
              </label>
              {mailboxError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold">{mailboxError}</div>}
              <div className="flex justify-end">
                <button type="submit" disabled={savingMailbox}
                  className="px-5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 disabled:opacity-60">
                  {savingMailbox ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {savingMailbox ? 'Saving…' : 'Add mailbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create booking from enquiry modal */}
      {bookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#FAF6F0] border border-[#DFCAA8] p-6 rounded-3xl w-full max-w-lg shadow-2xl space-y-4 text-[#0A0E1A] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E6D8C3] pb-3">
              <h3 className="text-base font-black flex items-center gap-2"><CalendarPlus className="w-5 h-5" /> Create booking from enquiry</h3>
              <button onClick={() => setBookingOpen(false)} className="p-1.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3]"><X className="w-4 h-4" /></button>
            </div>

            {bookingCreated ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <p className="text-sm font-black">Booking {bookingCreated} created.</p>
                <p className="text-xs text-slate-700 font-semibold">It's now on the Operate board — allocate a chauffeur and it flows through dispatch and invoicing as usual.</p>
                <button onClick={() => setBookingOpen(false)} className="px-5 py-2.5 rounded-xl bg-[#06090F] text-white border border-[#DFCAA8] text-xs font-black">Close</button>
              </div>
            ) : (
              <form onSubmit={handleCreateBooking} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={lbl}>Customer name *</label><input className={fld} required value={bookingForm.customer_name} onChange={(e) => setBookingForm({ ...bookingForm, customer_name: e.target.value })} /></div>
                  <div><label className={lbl}>Phone</label><input className={fld} value={bookingForm.customer_phone} onChange={(e) => setBookingForm({ ...bookingForm, customer_phone: e.target.value })} placeholder="+61…" /></div>
                </div>
                <div><label className={lbl}>Email</label><input className={fld} type="email" value={bookingForm.customer_email} onChange={(e) => setBookingForm({ ...bookingForm, customer_email: e.target.value })} /></div>
                <div><label className={lbl}>Pickup address *</label><input className={fld} required minLength={3} value={bookingForm.pickup_address} onChange={(e) => setBookingForm({ ...bookingForm, pickup_address: e.target.value })} /></div>
                <div><label className={lbl}>Dropoff address *</label><input className={fld} required minLength={3} value={bookingForm.dropoff_address} onChange={(e) => setBookingForm({ ...bookingForm, dropoff_address: e.target.value })} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={lbl}>Pickup date & time *</label><input className={fld} required type="datetime-local" value={bookingForm.pickup_datetime} onChange={(e) => setBookingForm({ ...bookingForm, pickup_datetime: e.target.value })} /></div>
                  <div><label className={lbl}>Total fare (AUD) *</label><input className={fld} required type="number" step="0.01" min="0" value={bookingForm.total_fare} onChange={(e) => setBookingForm({ ...bookingForm, total_fare: parseFloat(e.target.value) })} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Vehicle class</label>
                    <select className={fld} value={bookingForm.vehicle_category} onChange={(e) => setBookingForm({ ...bookingForm, vehicle_category: e.target.value })}>
                      {['SEDAN_EXECUTIVE', 'SEDAN_PREMIUM', 'SUV_PREMIUM', 'PEOPLE_MOVER', 'MINIBUS'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Flight (if airport)</label>
                    <input className={fld} value={bookingForm.flight_number} onChange={(e) => setBookingForm({ ...bookingForm, flight_number: e.target.value, is_airport_pickup: e.target.value ? true : bookingForm.is_airport_pickup })} placeholder="e.g. EK408" />
                  </div>
                </div>
                {bookingError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[11px] font-bold">{bookingError}</div>}
                <div className="flex justify-end gap-2 pt-2 border-t border-[#E6D8C3]">
                  <button type="button" onClick={() => setBookingOpen(false)} className="px-4 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E6D8C3] font-black text-xs">Cancel</button>
                  <button type="submit" disabled={creatingBooking} className="px-5 py-2.5 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white font-black text-xs flex items-center gap-1.5 disabled:opacity-60">
                    {creatingBooking ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {creatingBooking ? 'Creating…' : 'Create booking'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailBookingWorkflowPage;
