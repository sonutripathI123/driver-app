import React, { useEffect, useState } from 'react';
import { notificationsApi } from '../services/api';
import { ManagerNotificationSettings, NotificationItem } from '../types';
import { triggerNativeNotification, playNotificationChime } from '../utils/notificationSound';
import {
  Bell,
  Smartphone,
  MessageSquare,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  Shield,
  Clock,
  Car,
  Plane,
  Save,
  Volume2,
  X
} from 'lucide-react';

export const NotificationsHubPage: React.FC = () => {
  const [settings, setSettings] = useState<ManagerNotificationSettings>({
    manager_phone: '+919385365428',
    manager_email: 'owner@chauffeurplatform.com',
    whatsapp_enabled: true,
    sms_enabled: true,
    browser_push_enabled: true,
    alert_on_new_booking: true,
    alert_on_driver_allocation: true,
    alert_on_driver_rejection: true,
    alert_on_unassigned_urgent: true,
    alert_on_trip_milestones: true,
    alert_on_flight_delay: true,
    alert_on_payment_received: true,
  });

  const [notificationLogs, setNotificationLogs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    message: string;
    whatsappUrl?: string;
    phone: string;
  } | null>(null);
  const [browserPushAllowed, setBrowserPushAllowed] = useState(false);
  const [activePopupAlert, setActivePopupAlert] = useState<{
    title: string;
    body: string;
    time: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
    checkBrowserPermission();
  }, []);

  const checkBrowserPermission = () => {
    if ('Notification' in window) {
      setBrowserPushAllowed(Notification.permission === 'granted');
    }
  };

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop/mobile push notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setBrowserPushAllowed(true);
      await triggerNativeNotification(
        '🔔 Crown Chauffeurs Alerts Activated',
        'You will now receive instant push alerts with sound & vibration on this device!'
      );
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [sData, lData] = await Promise.all([
        notificationsApi.getManagerSettings(),
        notificationsApi.getNotificationLogs(30),
      ]);
      setSettings(sData);
      setNotificationLogs(lData || []);
    } catch (err) {
      // Demo mock logs
      setNotificationLogs([
        {
          id: 'n-01',
          recipient: settings.manager_phone,
          channel: 'WHATSAPP',
          template_name: 'MANAGER_NEW_BOOKING',
          content: '🔔 [CHAUFFEUR OPS] New Booking #CCM-2026-0881\nPassenger: David Warner (+61 411 222 333)\nRoute: 120 Collins St, CBD -> Melbourne Airport T2\nFare: $440.00 AUD (Paid in full)',
          status: 'SENT',
          created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        },
        {
          id: 'n-02',
          recipient: settings.manager_phone,
          channel: 'WHATSAPP',
          template_name: 'MANAGER_DRIVER_ALLOCATED',
          content: '🔔 [CHAUFFEUR OPS] Driver Allocated — #CCM-2026-0881\nChauffeur: Daniel Ricciardo\nVehicle: Mercedes S-Class (Plate: VIP-01)\nDriver Payout: $160.00 AUD',
          status: 'SENT',
          created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        },
        {
          id: 'n-03',
          recipient: settings.manager_phone,
          channel: 'SMS',
          template_name: 'MANAGER_FLIGHT_DELAY',
          content: '🚨 [URGENT DISPATCH] Flight Delay: QF400 (+25m)\nNew Pickup: 03:25 PM @ Melbourne Airport Terminal 2\nDriver: Daniel Ricciardo',
          status: 'SENT',
          created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await notificationsApi.updateManagerSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getCleanPhone = (phone: string) => {
    return phone.replace(/[^0-9]/g, '');
  };

  const handleSendTestPing = async (channel: 'WHATSAPP' | 'SMS' | 'PUSH') => {
    try {
      setTestSending(true);
      setTestResult(null);

      const title = '🚨 [CHAUFFEUR OPS] New Booking #CCM-2026-0881';
      const sampleMsg = `David Warner • 120 Collins St ➔ Melbourne Airport T2 • Fare: $440.00 AUD (Paid in full)`;
      const fullText = `🔔 [CHAUFFEUR OPS TEST ALERT]\n\nCrown Chauffeurs Dispatch Hub is connected to your mobile phone (${settings.manager_phone})!\n\nAll real-time customer bookings, chauffeur allocations, and trip milestones will be dispatched here in real-time.`;
      
      const cleanPhone = getCleanPhone(settings.manager_phone);
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(fullText)}`;

      // 1. Play chime sound & trigger native system notification
      await triggerNativeNotification(title, sampleMsg);

      // 2. Show floating in-app popup alert card
      setActivePopupAlert({
        title,
        body: sampleMsg,
        time: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setTimeout(() => setActivePopupAlert(null), 8000);

      // 3. Call backend API
      if (channel !== 'PUSH') {
        await notificationsApi.sendTestPing({
          channel,
          target_phone: settings.manager_phone,
          custom_message: fullText,
        });
      }

      setTestResult({
        message: `Alert dispatched with sound chime for ${settings.manager_phone}!`,
        whatsappUrl: waUrl,
        phone: settings.manager_phone,
      });

      loadSettings();
    } catch (err) {
      const cleanPhone = getCleanPhone(settings.manager_phone);
      const fullText = `🔔 [CHAUFFEUR OPS TEST ALERT]\n\nCrown Chauffeurs Dispatch Hub is connected to your mobile phone (${settings.manager_phone})!`;
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(fullText)}`;
      setTestResult({
        message: `Alert generated for ${settings.manager_phone}!`,
        whatsappUrl: waUrl,
        phone: settings.manager_phone,
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 relative">
      {/* Floating In-App Dispatch Alert Toast with Sound */}
      {activePopupAlert && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-full bg-[#121A2D] border-2 border-emerald-400 shadow-2xl shadow-emerald-500/30 rounded-2xl p-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-emerald-300">{activePopupAlert.title}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-mono">
                  {activePopupAlert.body}
                </p>
                <span className="text-[10px] text-slate-400 font-mono block">Received: {activePopupAlert.time}</span>
              </div>
            </div>
            <button
              onClick={() => setActivePopupAlert(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Real-Time Mobile Dispatch Center</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-100">
            Mobile Dispatch & Push Notification Center
          </h1>

          <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
            Get instant WhatsApp, SMS, and Mobile Push alerts directly on your phone whenever a new booking arrives, a driver is allocated, or a trip milestone changes.
          </p>
        </div>

        {/* Quick Test Ping Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => handleSendTestPing('PUSH')}
            disabled={testSending}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#162036] hover:bg-[#1E2C4A] border border-cyan-500/40 text-cyan-300 font-bold text-xs shadow-md transition-all"
          >
            <Bell className="w-4 h-4 text-cyan-400" />
            <span>Test Sound Pop-up</span>
          </button>

          <button
            onClick={() => handleSendTestPing('WHATSAPP')}
            disabled={testSending}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 transition-all"
          >
            <MessageSquare className="w-4 h-4 text-slate-950" />
            <span>{testSending ? 'Sending Ping...' : 'Send WhatsApp Ping'}</span>
          </button>
        </div>
      </div>

      {/* Test Result Action Banner */}
      {testResult && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-300">Test Alert Generated for {testResult.phone}</p>
              <p className="text-xs text-slate-400">Click below to open and receive this message directly in your WhatsApp app/web:</p>
            </div>
          </div>

          {testResult.whatsappUrl && (
            <a
              href={testResult.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 shrink-0 transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>📱 Open In WhatsApp Web / App ➔</span>
            </a>
          )}
        </div>
      )}

      {/* 2. Main Config Grid: Left (Channel Setup) & Right (Trigger Matrix) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mobile Phone & Delivery Channels (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-100">Owner Mobile Device Configuration</h3>
              </div>
            </div>

            <div className="space-y-4">
              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Manager Mobile Phone Number</span>
                  <span className="text-[10px] text-amber-400 font-mono">With Country Code (+91 / +61)</span>
                </label>
                <input
                  type="text"
                  value={settings.manager_phone}
                  onChange={(e) => setSettings({ ...settings, manager_phone: e.target.value })}
                  placeholder="+91 9385365428"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] text-slate-100 font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Channels Toggles */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Active Alert Channels</span>

                {/* WhatsApp Toggle */}
                <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">WhatsApp Dispatch Alerts</span>
                      <span className="text-[10px] text-slate-400">Rich formatted cards with direct view links</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.whatsapp_enabled}
                    onChange={(e) => setSettings({ ...settings, whatsapp_enabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* SMS Fallback Toggle */}
                <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">SMS Direct Gateway</span>
                      <span className="text-[10px] text-slate-400">Cellular telecom carrier SMS</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sms_enabled}
                    onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Browser Web Push */}
                <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">Browser Push & Sound Alert</span>
                      <span className="text-[10px] text-slate-400">Chime chime + screen pop-up</span>
                    </div>
                  </div>
                  {browserPushAllowed ? (
                    <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">ACTIVE</span>
                  ) : (
                    <button
                      onClick={requestBrowserPermission}
                      className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-[10px] font-bold hover:bg-cyan-400"
                    >
                      Allow Push
                    </button>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : saveSuccess ? 'Saved Successfully! ✓' : 'Save Notification Settings'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Alert Trigger Event Matrix (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Live Dispatch Trigger Rules</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Instant Mobile Ping</span>
            </div>

            {/* Triggers List */}
            <div className="space-y-3">
              {/* Trigger 1: New Booking */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">New Customer Booking Created & Paid</span>
                    <span className="text-[10px] text-slate-400">Pings with route, passenger name, fare ($ AUD), and vehicle class</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_new_booking}
                  onChange={(e) => setSettings({ ...settings, alert_on_new_booking: e.target.checked })}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Trigger 2: Driver Allocated */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Chauffeur Allocated & Dispatched</span>
                    <span className="text-[10px] text-slate-400">Alerts when a driver and vehicle are assigned to a leg with payout rate</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_driver_allocation}
                  onChange={(e) => setSettings({ ...settings, alert_on_driver_allocation: e.target.checked })}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Trigger 3: Trip Milestones */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Trip Stepper Live Milestones</span>
                    <span className="text-[10px] text-slate-400">Pings when chauffeur taps: En Route ➔ Arrived ➔ Picked Up ➔ Completed</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_trip_milestones}
                  onChange={(e) => setSettings({ ...settings, alert_on_trip_milestones: e.target.checked })}
                  className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                />
              </div>

              {/* Trigger 4: Flight Delay */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Plane className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Airport Flight Delay Auto-Reschedule</span>
                    <span className="text-[10px] text-slate-400">Alerts when FlightAware detects delays and adjusts pickup buffer</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_flight_delay}
                  onChange={(e) => setSettings({ ...settings, alert_on_flight_delay: e.target.checked })}
                  className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Trigger 5: Urgent Unassigned Job Escalation */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Urgent Unassigned Job Escalation</span>
                    <span className="text-[10px] text-slate-400">Sends high-priority alert if a job remains unallocated &lt; 4 hours before pickup</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_unassigned_urgent}
                  onChange={(e) => setSettings({ ...settings, alert_on_unassigned_urgent: e.target.checked })}
                  className="w-4 h-4 rounded accent-rose-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Mobile Alert Outbox Feed */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">Live Mobile Alert Delivery Outbox</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{notificationLogs.length} Messages Dispatched</span>
        </div>

        <div className="space-y-3">
          {notificationLogs.map((log) => {
            const cleanPhone = getCleanPhone(log.recipient || settings.manager_phone);
            const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(log.content)}`;
            return (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-[#0D1322] border border-[#1F2E4D] hover:border-amber-500/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      log.channel === 'WHATSAPP' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {log.channel}
                    </span>
                    <span className="font-mono text-slate-300 font-bold">{log.recipient}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-200 whitespace-pre-line font-mono text-[11px] mt-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    {log.content}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2.5 pt-2 md:pt-0">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open in WhatsApp ➔</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
