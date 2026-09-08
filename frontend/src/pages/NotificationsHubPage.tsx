import React, { useCallback, useEffect, useState } from 'react';
import { automationsApi, notificationsApi } from '../services/api';
import { ManagerNotificationSettings, NotificationItem } from '../types';
import { triggerNativeNotification, playNotificationChime, subscribeToWebPush } from '../utils/notificationSound';
import {
  Bell,
  Smartphone,
  MessageSquare,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Shield,
  Clock,
  Car,
  Plane,
  Save,
  X,
  Mail,
  RefreshCw,
  LoaderCircle,
} from 'lucide-react';

/**
 * Mobile dispatch and notification centre.
 *
 * Two things on this page were actively misleading. When the API call failed
 * it swapped in three invented "delivered" alerts — addressed to a real
 * Indian mobile number, quoting a booking that does not exist — so a broken
 * connection looked like a working outbox. And saving settings reported
 * "Settings saved to local storage" plus a green tick when the save had in
 * fact failed and nothing was written anywhere.
 *
 * The outbox also never showed a delivery status. Every message rendered the
 * same whether the gateway accepted it or the platform only simulated it
 * because Twilio is on a trial account. That is the difference between the
 * manager being told about an urgent unallocated job and not being told, so
 * it is now the most prominent thing on each row.
 */

const EMPTY_SETTINGS: ManagerNotificationSettings = {
  manager_phone: '',
  manager_email: '',
  whatsapp_enabled: true,
  sms_enabled: true,
  browser_push_enabled: true,
  manager_email_enabled: true,
  alert_on_new_booking: true,
  alert_on_driver_allocation: true,
  alert_on_driver_rejection: true,
  alert_on_unassigned_urgent: true,
  alert_on_trip_milestones: true,
  alert_on_flight_delay: true,
  alert_on_payment_received: true,
};

const apiErrorText = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d: any) => `${(d.loc || []).slice(1).join('.') || 'field'}: ${d.msg}`).join(' • ');
  }
  return err?.message || fallback;
};

/** How a recorded notification actually ended up. */
const statusLook = (status: string): { label: string; className: string; delivered: boolean } => {
  const s = (status || '').toUpperCase();
  if (s === 'SENT' || s === 'DELIVERED') {
    return { label: 'DELIVERED', className: 'bg-emerald-950 border-emerald-500 text-emerald-200', delivered: true };
  }
  if (s === 'SANDBOX_SIMULATED') {
    return { label: 'NOT SENT — SIMULATED', className: 'bg-amber-950 border-amber-500 text-amber-200', delivered: false };
  }
  return { label: s || 'UNKNOWN', className: 'bg-rose-950 border-rose-500 text-rose-200', delivered: false };
};

export const NotificationsHubPage: React.FC = () => {
  const [settings, setSettings] = useState<ManagerNotificationSettings>({ ...EMPTY_SETTINGS });
  const [notificationLogs, setNotificationLogs] = useState<NotificationItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [testResult, setTestResult] = useState<{
    ok: boolean;
    heading: string;
    detail: string;
    channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH';
    actionUrl?: string;
  } | null>(null);

  const [browserPushAllowed, setBrowserPushAllowed] = useState(false);
  const [activePopupAlert, setActivePopupAlert] = useState<{ title: string; body: string; time: string } | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sData, lData] = await Promise.all([
        notificationsApi.getManagerSettings(),
        notificationsApi.getNotificationLogs(30),
      ]);
      // Whatever the server holds is the truth. The old code forced
      // manager_phone to a hardcoded "+919305365420" whenever the server
      // returned a blank — that number is the chauffeur's, so every manager
      // alert went to the driver.
      if (sData) setSettings({ ...EMPTY_SETTINGS, ...sData });
      setNotificationLogs(lData || []);
    } catch (err: any) {
      setLoadError(apiErrorText(err, 'Could not load the notification settings and outbox.'));
      setNotificationLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkBrowserPermission = useCallback(async () => {
    if ('Notification' in window) {
      const isGranted = Notification.permission === 'granted';
      setBrowserPushAllowed(isGranted);
      if (isGranted) await subscribeToWebPush();
    }
  }, []);

  useEffect(() => {
    loadSettings();
    checkBrowserPermission();
  }, [loadSettings, checkBrowserPermission]);

  const requestBrowserPermission = async () => {
    playNotificationChime();
    if (!('Notification' in window)) {
      setTestResult({
        ok: false,
        heading: 'This browser does not support push notifications.',
        detail: 'Use Chrome, Edge or Firefox on desktop, or add this site to your phone home screen.',
        channel: 'PUSH',
      });
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setBrowserPushAllowed(true);
        await subscribeToWebPush();
        await triggerNativeNotification(
          'Opal Chauffeurs alerts activated',
          'Push alerts with a chime will now appear on this device.'
        );
      } else {
        setTestResult({
          ok: false,
          heading: 'Push permission was declined.',
          detail: 'Allow notifications for this site in your browser settings, then try again.',
          channel: 'PUSH',
        });
      }
    } catch (e: any) {
      setTestResult({
        ok: false,
        heading: 'Push permission could not be requested.',
        detail: e?.message || 'Unknown browser error.',
        channel: 'PUSH',
      });
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const saved = await notificationsApi.updateManagerSettings(settings);
      // Render what the server stored, not what was typed — if it normalised
      // or rejected a field the operator should see that.
      setSettings({ ...EMPTY_SETTINGS, ...saved });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      // Previously this said "Settings saved to local storage" and showed the
      // success tick. Nothing was saved anywhere.
      setSaveError(apiErrorText(err, 'The settings were not saved.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRunPreTripConfirmationScanner = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await automationsApi.runPreTripConfirmationReminders();
      const text = `Evaluated ${res.total_processed} bookings, dispatched ${res.confirmation_reminders_count} customer reconfirmations.`;
      setScanResult({ ok: true, text });
      await triggerNativeNotification('Pre-trip scanner complete', text);
      loadSettings();
    } catch (err: any) {
      // Was: alert('Pre-trip reminder scanner triggered.') on failure.
      setScanResult({ ok: false, text: apiErrorText(err, 'The scanner did not run.') });
    } finally {
      setScanning(false);
    }
  };

  const getCleanPhone = (phone: string) => (phone || '').replace(/[^0-9]/g, '');

  const handleSendTestPing = async (channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH') => {
    setTestSending(channel);
    setTestResult(null);

    // Browser push is entirely local — nothing leaves this device.
    if (channel === 'PUSH') {
      playNotificationChime();
      const body = 'This is a test alert from the Opal Chauffeurs dispatch console.';
      await triggerNativeNotification('Test alert', body);
      setActivePopupAlert({
        title: 'Test alert',
        body,
        time: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setTimeout(() => setActivePopupAlert(null), 8000);
      setTestResult({
        ok: true,
        heading: 'Chime played and a browser notification was shown on this device.',
        detail: 'This test never leaves the browser — it does not prove SMS, WhatsApp or email works.',
        channel,
      });
      setTestSending(null);
      return;
    }

    const target = channel === 'EMAIL' ? settings.manager_email : settings.manager_phone;
    if (!target) {
      setTestResult({
        ok: false,
        heading: channel === 'EMAIL' ? 'No manager email address is set.' : 'No manager phone number is set.',
        detail: 'Enter it above and save before sending a test.',
        channel,
      });
      setTestSending(null);
      return;
    }

    // A plainly-labelled test. The old message quoted an invented booking
    // ("CCM-2026-9901", passenger "Sahil Tripathi", fare $460) which read as
    // a genuine job on the recipient's phone.
    const message =
      `[TEST] Opal Chauffeurs dispatch console.\n` +
      `This is a connectivity test sent at ${new Date().toLocaleString('en-AU')}.\n` +
      `If you received this, alerts to ${target} are working.`;

    try {
      const notif =
        channel === 'EMAIL'
          ? await notificationsApi.sendDirect({
              recipient: target,
              channel: 'EMAIL',
              subject: 'Opal Chauffeurs — dispatch alert test',
              message,
            })
          : await notificationsApi.sendTestPing({
              channel,
              target_phone: target,
              custom_message: message,
            });

      const look = statusLook(notif.status);
      const cleanPhone = getCleanPhone(target);
      // Manual fallback: when the gateway only simulated the send, the
      // operator can still push it out by hand from their own account.
      const actionUrl =
        look.delivered || channel === 'EMAIL'
          ? undefined
          : channel === 'WHATSAPP'
          ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
          : `sms:+${cleanPhone}?&body=${encodeURIComponent(message)}`;

      setTestResult({
        ok: look.delivered,
        heading: look.delivered
          ? `${channel} accepted by the gateway for ${target}.`
          : `${channel} was NOT sent to ${target}.`,
        detail: look.delivered
          ? 'The provider accepted the message. Check the handset to confirm it arrived.'
          : `The platform recorded it as ${look.label}. ${
              notif.error_message || 'The provider is not configured or rejected the request.'
            }`,
        channel,
        actionUrl,
      });

      loadSettings();
    } catch (err: any) {
      setTestResult({
        ok: false,
        heading: `The ${channel} test could not be sent.`,
        detail: apiErrorText(err, 'The request to the server failed.'),
        channel,
      });
    } finally {
      setTestSending(null);
    }
  };

  const simulatedCount = notificationLogs.filter((l) => !statusLook(l.status).delivered).length;

  const toggleRow = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    key: keyof ManagerNotificationSettings
  ) => (
    <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <span className="text-xs font-bold text-white block">{title}</span>
          <span className="text-[10px] text-white font-semibold">{subtitle}</span>
        </div>
      </div>
      <input
        type="checkbox"
        checked={Boolean(settings[key])}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
        className="w-4 h-4 rounded accent-white cursor-pointer shrink-0"
      />
    </div>
  );

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 relative pb-12">
      {/* Floating in-app alert toast */}
      {activePopupAlert && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-full bg-[#121A2D] border-2 border-[#DFCAA8] shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top duration-300 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black text-white block">{activePopupAlert.title}</span>
                <p className="text-xs text-white leading-relaxed font-mono font-bold">{activePopupAlert.body}</p>
                <span className="text-[10px] text-white font-mono block">Received: {activePopupAlert.time}</span>
              </div>
            </div>
            <button onClick={() => setActivePopupAlert(null)} className="text-white hover:text-[#DFCAA8] p-1">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Header banner */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden shadow-xl text-white">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1322] border border-[#DFCAA8] text-white text-xs font-bold">
            <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Real-Time Mobile Dispatch Center</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
            Mobile Dispatch &amp; Push Notification Center
          </h1>

          <p className="text-xs md:text-sm text-white leading-relaxed font-bold">
            WhatsApp, SMS, email and browser alerts when a booking arrives, a chauffeur is allocated or a trip milestone
            changes. Every test below reports what the gateway actually did.
          </p>
        </div>

        <div className="flex flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
          {(
            [
              { ch: 'PUSH' as const, icon: <Bell className="w-4 h-4 text-white" />, label: 'Test sound pop-up' },
              { ch: 'EMAIL' as const, icon: <Mail className="w-4 h-4 text-white" />, label: 'Send email test' },
              { ch: 'SMS' as const, icon: <Smartphone className="w-4 h-4 text-white" />, label: 'Send SMS test' },
              { ch: 'WHATSAPP' as const, icon: <MessageSquare className="w-4 h-4 text-white" />, label: 'Send WhatsApp test' },
            ]
          ).map(({ ch, icon, label }) => (
            <button
              key={ch}
              onClick={() => handleSendTestPing(ch)}
              disabled={testSending !== null}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md transition-all disabled:opacity-60"
            >
              {testSending === ch ? <LoaderCircle className="w-4 h-4 text-white animate-spin" /> : icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="p-5 rounded-2xl bg-rose-950 border border-rose-500 text-rose-100 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs min-w-0 flex-1">
            <p className="font-black">Notification settings and outbox could not be loaded.</p>
            <p className="font-semibold mt-0.5 break-words">{loadError}</p>
            <button
              onClick={loadSettings}
              className="mt-2 px-3 py-1.5 rounded-lg bg-[#06090F] text-white font-black text-[11px] border border-[#DFCAA8]"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Test result banner */}
      {testResult && (
        <div
          className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in shadow-xl text-white ${
            testResult.ok ? 'bg-[#121A2D] border-emerald-500' : 'bg-[#2A1520] border-amber-500'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#06090F] border border-[#DFCAA8] flex items-center justify-center shrink-0">
              {testResult.ok ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-white break-words">{testResult.heading}</p>
              <p className="text-xs text-white opacity-90 break-words mt-0.5">{testResult.detail}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {testResult.actionUrl && (
              <a
                href={testResult.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white"
              >
                {testResult.channel === 'SMS' ? (
                  <Smartphone className="w-4 h-4 text-white" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-white" />
                )}
                <span>Send it manually instead</span>
              </a>
            )}
            <button onClick={() => setTestResult(null)} className="p-2 rounded-xl border border-[#1F2E4D] hover:bg-[#0D1322]">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Config grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-white">
        {/* Left: channels */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white">Manager contact &amp; channels</h3>
              </div>
              {loading && <LoaderCircle className="w-4 h-4 text-white animate-spin" />}
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white flex items-center justify-between gap-2">
                  <span>Manager mobile number</span>
                  <span className="text-[10px] text-white font-mono font-bold">Include the country code</span>
                </label>
                <input
                  type="tel"
                  value={settings.manager_phone}
                  onChange={(e) => setSettings({ ...settings, manager_phone: e.target.value })}
                  placeholder="+61 4XX XXX XXX"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] text-white font-mono text-xs focus:border-[#DFCAA8] focus:outline-none font-bold"
                />
                {!settings.manager_phone && !loading && (
                  <p className="text-[10px] text-amber-300 font-bold">
                    Not set — SMS and WhatsApp manager alerts have nowhere to go.
                  </p>
                )}
              </div>

              {/* The email field did not exist on this screen, so the one
                  manager channel that works without a telco account could not
                  be configured from the UI at all. */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white block">Manager email address</label>
                <input
                  type="email"
                  value={settings.manager_email}
                  onChange={(e) => setSettings({ ...settings, manager_email: e.target.value })}
                  placeholder="ops@yourcompany.com.au"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] text-white font-mono text-xs focus:border-[#DFCAA8] focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Active alert channels</span>

                {toggleRow(
                  <MessageSquare className="w-4 h-4 text-white" />,
                  'WhatsApp dispatch alerts',
                  'Requires a WhatsApp sender on the messaging account',
                  'whatsapp_enabled'
                )}
                {toggleRow(
                  <Smartphone className="w-4 h-4 text-white" />,
                  'SMS gateway',
                  settings.manager_phone ? `Carrier SMS to ${settings.manager_phone}` : 'Carrier SMS — no number set yet',
                  'sms_enabled'
                )}
                {toggleRow(
                  <Mail className="w-4 h-4 text-white" />,
                  'Manager email alerts',
                  'Works without a telco account — the most reliable channel today',
                  'manager_email_enabled'
                )}

                <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block">Browser push &amp; sound</span>
                      <span className="text-[10px] text-white">Only on this device, only while a tab is open</span>
                    </div>
                  </div>
                  {browserPushAllowed ? (
                    <span className="px-2 py-1 rounded bg-[#121A2D] border border-[#DFCAA8] text-white text-[10px] font-bold shrink-0">
                      ACTIVE ✓
                    </span>
                  ) : (
                    <button
                      onClick={requestBrowserPermission}
                      className="px-2.5 py-1 rounded bg-[#06090F] border border-[#DFCAA8] text-white text-[10px] font-black hover:bg-[#1A2233] transition-colors shrink-0"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>

              {saveError && (
                <div className="p-3 rounded-xl bg-rose-950 border border-rose-500 text-rose-100 text-[11px] font-bold break-words">
                  Not saved: {saveError}
                </div>
              )}

              <button
                onClick={handleSaveSettings}
                disabled={saving || loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md transition-all disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="w-4 h-4 text-white animate-spin" /> : <Save className="w-4 h-4 text-white" />}
                <span>{saving ? 'Saving…' : saveSuccess ? 'Saved to the server ✓' : 'Save notification settings'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: trigger matrix */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white">Live dispatch trigger rules</h3>
              </div>
              <span className="text-[10px] font-mono text-white">Saved on the server</span>
            </div>

            <div className="space-y-3">
              {toggleRow(
                <Sparkles className="w-4 h-4 text-white" />,
                'New customer booking created & paid',
                'Route, passenger, fare and vehicle class',
                'alert_on_new_booking'
              )}
              {toggleRow(
                <Car className="w-4 h-4 text-white" />,
                'Chauffeur allocated & dispatched',
                'When a driver and vehicle are assigned to a leg, with the payout',
                'alert_on_driver_allocation'
              )}
              {toggleRow(
                <Clock className="w-4 h-4 text-white" />,
                'Trip milestones',
                'En route ➔ arrived ➔ picked up ➔ completed',
                'alert_on_trip_milestones'
              )}
              {toggleRow(
                <Plane className="w-4 h-4 text-white" />,
                'Flight delay auto-reschedule',
                'When the flight provider reports a delay and the pickup is moved',
                'alert_on_flight_delay'
              )}
              {toggleRow(
                <AlertTriangle className="w-4 h-4 text-white" />,
                'Urgent unassigned job escalation',
                'High-priority alert if a job is still unallocated close to pickup',
                'alert_on_unassigned_urgent'
              )}
              {toggleRow(
                <CheckCircle2 className="w-4 h-4 text-white" />,
                'Payment received',
                'When a deposit or balance is recorded against a booking',
                'alert_on_payment_received'
              )}

              {/* Pre-trip reconfirmation scanner */}
              <div className="p-4 rounded-xl bg-[#0D1322] border border-[#DFCAA8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="space-y-1 text-white min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white">12–24h pre-trip customer reconfirmation</span>
                      <span className="px-2 py-0.5 rounded bg-[#121A2D] border border-[#DFCAA8] text-white text-[9px] font-mono font-bold">
                        10AM / 2PM RULE
                      </span>
                    </div>
                    <p className="text-[11px] text-white leading-relaxed">
                      • <strong>Midnight – 8:00 AM trips:</strong> dispatched at <strong>10:00 AM</strong> the day before.
                      <br />• <strong>8:00 AM – midnight trips:</strong> dispatched at <strong>2:00 PM</strong> the day before.
                    </p>
                    {scanResult && (
                      <p
                        className={`text-[11px] font-black mt-1 break-words ${
                          scanResult.ok ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {scanResult.ok ? '✓ ' : '✗ '}
                        {scanResult.text}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleRunPreTripConfirmationScanner}
                  disabled={scanning}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60"
                >
                  {scanning ? (
                    <LoaderCircle className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>{scanning ? 'Scanning…' : 'Run scanner now'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Outbox */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-4 text-white">
        <div className="flex flex-wrap items-center justify-between border-b border-[#1F2E4D] pb-3 gap-2">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold text-white">Alert delivery outbox</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-white">{notificationLogs.length} recorded</span>
            <button
              onClick={loadSettings}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-[#06090F] border border-[#DFCAA8] text-white text-[10px] font-black flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {simulatedCount > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-950 border border-amber-500 text-amber-100 text-xs font-bold flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {simulatedCount} of the {notificationLogs.length} messages below were <strong>recorded but never sent</strong>.
              The platform wrote the log entry and the gateway declined or was not configured, so nobody received them. Use
              “Send manually” on each row until the provider account is live.
            </span>
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2">
              <LoaderCircle className="w-5 h-5 text-white animate-spin" />
              <p className="text-xs font-bold text-white">Loading the outbox…</p>
            </div>
          ) : notificationLogs.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#0D1322] border border-[#1F2E4D] text-center">
              <p className="text-xs font-black text-white">No alerts recorded yet.</p>
              <p className="text-[11px] text-white opacity-80 mt-1">
                Messages appear here as bookings, allocations and trip milestones happen.
              </p>
            </div>
          ) : (
            notificationLogs.map((log) => {
              const look = statusLook(log.status);
              const cleanPhone = getCleanPhone(log.recipient);
              const isEmail = (log.channel || '').toUpperCase() === 'EMAIL';
              const manualUrl = isEmail
                ? `mailto:${log.recipient}?subject=${encodeURIComponent(log.subject || 'Opal Chauffeurs')}&body=${encodeURIComponent(log.content)}`
                : (log.channel || '').toUpperCase() === 'SMS'
                ? `sms:+${cleanPhone}?&body=${encodeURIComponent(log.content)}`
                : `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(log.content)}`;

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-[#0D1322] border border-[#1F2E4D] hover:border-[#DFCAA8] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-white"
                >
                  <div className="space-y-1 min-w-0 flex-1 text-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#121A2D] border border-slate-700 text-white">
                        {log.channel}
                      </span>
                      {/* The delivery status was never shown. A simulated
                          message looked exactly like a delivered one. */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black font-mono border ${look.className}`}>
                        {look.label}
                      </span>
                      <span className="font-mono text-white font-bold break-all">{log.recipient}</span>
                      <span className="text-white">•</span>
                      <span className="text-[11px] text-white font-mono">
                        {new Date(log.created_at).toLocaleString('en-AU', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-white whitespace-pre-line font-mono text-[11px] mt-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 break-words">
                      {log.content}
                    </p>
                    {log.error_message && (
                      <p className="text-[11px] text-rose-300 font-bold break-words">Reason: {log.error_message}</p>
                    )}
                  </div>

                  {!look.delivered && (
                    <div className="shrink-0 flex items-center gap-2 pt-2 md:pt-0">
                      <a
                        href={manualUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-bold text-[11px] transition-all"
                      >
                        {isEmail ? <Mail className="w-3.5 h-3.5 text-white" /> : <MessageSquare className="w-3.5 h-3.5 text-white" />}
                        <span>Send manually ➔</span>
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
