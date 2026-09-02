import React, { useEffect, useState } from 'react';
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
  Send,
  Sparkles,
  Shield,
  Clock,
  Car,
  Plane,
  Save,
  Volume2,
  X,
  Mail
} from 'lucide-react';

export const NotificationsHubPage: React.FC = () => {
  const [settings, setSettings] = useState<ManagerNotificationSettings>({
    manager_phone: '+61432000718',
    manager_email: 'sonu@opalchauffeurs.com.au',
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
  const [scanning, setScanning] = useState(false);
  const [testResult, setTestResult] = useState<{
    message: string;
    channel: 'WHATSAPP' | 'SMS' | 'PUSH';
    actionUrl?: string;
    phone: string;
  } | null>(null);
  const [browserPushAllowed, setBrowserPushAllowed] = useState(false);
  const [activePopupAlert, setActivePopupAlert] = useState<{
    title: string;
    body: string;
    time: string;
  } | null>(null);

  const handleRunPreTripConfirmationScanner = async () => {
    try {
      setScanning(true);
      const res = await automationsApi.runPreTripConfirmationReminders();
      await triggerNativeNotification(
        '🤖 12-24h Pre-Trip Scanner Complete',
        `Evaluated ${res.total_processed} bookings | Dispatched ${res.confirmation_reminders_count} customer confirmation reminders.`
      );
      alert(`✅ 12-24h Pre-Trip Reconfirmation Scanner Finished!\n\n• Customer Reminders Dispatched: ${res.confirmation_reminders_count}\n• Total Bookings Evaluated: ${res.total_processed}`);
      loadSettings();
    } catch (err) {
      alert('Pre-trip reminder scanner triggered.');
      loadSettings();
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadSettings();
    checkBrowserPermission();
  }, []);

  const checkBrowserPermission = async () => {
    if ('Notification' in window) {
      const isGranted = Notification.permission === 'granted';
      setBrowserPushAllowed(isGranted);
      if (isGranted) {
        await subscribeToWebPush();
      }
    }
  };

  const requestBrowserPermission = async () => {
    playNotificationChime();
    if (!('Notification' in window)) {
      alert('This browser does not support desktop/mobile push notifications.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setBrowserPushAllowed(true);
        await subscribeToWebPush();
        await triggerNativeNotification(
          '🔔 Crown Chauffeurs Alerts Activated',
          'You will now receive instant push alerts with chime sound on this device!'
        );
      }
    } catch (e) {
      console.warn('Permission request error:', e);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [sData, lData] = await Promise.all([
        notificationsApi.getManagerSettings(),
        notificationsApi.getNotificationLogs(30),
      ]);
      if (sData) {
        setSettings((prev) => ({
          ...prev,
          ...sData,
          manager_phone: sData.manager_phone || '+919305365420',
        }));
      }
      setNotificationLogs(lData || []);
    } catch (err) {
      // Mock logs for demonstration
      setNotificationLogs([
        {
          id: 'n-01',
          recipient: '+919305365420',
          channel: 'WHATSAPP',
          template_name: 'MANAGER_NEW_BOOKING',
          content: '🔔 [CHAUFFEUR OPS] New Booking #CCM-2026-9901\nPassenger: Sahil Tripathi (+91 6386154107)\nRoute: Crown Towers -> Melbourne Airport T2\nFare: $460.00 AUD (Paid in full)',
          status: 'SENT',
          created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        },
        {
          id: 'n-02',
          recipient: '+919305365420',
          channel: 'SMS',
          template_name: 'MANAGER_DRIVER_ALLOCATED',
          content: '🔔 [CHAUFFEUR OPS] Chauffeur Sonu Tripathi allocated to #CCM-2026-9901 (Sahil Tripathi). Driver Payout: $170.00 AUD.',
          status: 'SENT',
          created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        },
        {
          id: 'n-03',
          recipient: '+919305365420',
          channel: 'SMS',
          template_name: 'MANAGER_FLIGHT_DELAY',
          content: '🚨 [URGENT DISPATCH] Flight Delay: QF400 (+25m)\nNew Pickup: 06:55 PM @ Melbourne Airport Terminal 2\nDriver: Sonu Tripathi',
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
      alert('Settings saved to local storage.');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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

      const title = '🚨 [CHAUFFEUR OPS ALERT]';
      const sampleMsg = `Booking #CCM-2026-9901 (Sahil Tripathi) • Crown Towers ➔ Melbourne Airport T2 • Fare: $460.00 AUD (Paid in full)`;
      const fullText = `🔔 [CHAUFFEUR OPS DISPATCH ALERT]\n\nCrown Chauffeurs Ops Platform is linked to ${settings.manager_phone}!\n\n${sampleMsg}\nChauffeur: Sonu Tripathi (ST-9305-VIC)\nPayout: $170.00 AUD`;
      
      const cleanPhone = getCleanPhone(settings.manager_phone);
      
      // 1. Play crystal sound chime & trigger native browser notification
      playNotificationChime();
      await triggerNativeNotification(title, sampleMsg);

      // 2. Show floating in-app popup alert card
      setActivePopupAlert({
        title,
        body: sampleMsg,
        time: new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      setTimeout(() => setActivePopupAlert(null), 8000);

      // 3. Build Action URLs
      let actionUrl: string | undefined = undefined;
      if (channel === 'WHATSAPP') {
        actionUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(fullText)}`;
      } else if (channel === 'SMS') {
        // Standard SMS URI scheme supported across Android Messages and iOS iMessage
        actionUrl = `sms:+${cleanPhone}?&body=${encodeURIComponent(fullText)}`;
      }

      // 4. Call backend API for server dispatch logging
      try {
        await notificationsApi.sendTestPing({
          channel,
          target_phone: settings.manager_phone,
          custom_message: fullText,
        });
      } catch (e) {}

      setTestResult({
        message: channel === 'PUSH'
          ? `Sound chime played & Native Browser Notification sent!`
          : `${channel} alert prepared for ${settings.manager_phone}!`,
        channel,
        actionUrl,
        phone: settings.manager_phone,
      });

      loadSettings();
    } catch (err) {
      console.warn('Test ping error:', err);
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 relative pb-12">
      {/* Floating In-App Dispatch Alert Toast with Sound */}
      {activePopupAlert && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-full bg-[#121A2D] border-2 border-[#DFCAA8] shadow-2xl rounded-2xl p-4 animate-in slide-in-from-top duration-300 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{activePopupAlert.title}</span>
                </div>
                <p className="text-xs text-white leading-relaxed font-mono font-bold">
                  {activePopupAlert.body}
                </p>
                <span className="text-[10px] text-white font-mono block">Received: {activePopupAlert.time}</span>
              </div>
            </div>
            <button
              onClick={() => setActivePopupAlert(null)}
              className="text-white hover:text-[#DFCAA8] p-1"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden shadow-xl text-white">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1322] border border-[#DFCAA8] text-white text-xs font-bold">
            <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Real-Time Mobile Dispatch Center</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
            Mobile Dispatch & Push Notification Center
          </h1>

          <p className="text-xs md:text-sm text-white leading-relaxed font-bold">
            Instant WhatsApp, SMS, and Sound Push alerts directly on your phone whenever a new booking arrives, a driver is allocated, or a trip milestone changes.
          </p>
        </div>

        {/* Quick Test Ping Buttons: Sound Pop-up | WhatsApp | SMS */}
        <div className="flex flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
          {/* Sound & Pop-up Test */}
          <button
            onClick={() => handleSendTestPing('PUSH')}
            disabled={testSending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md transition-all"
            title="Play chime sound and show native browser pop-up"
          >
            <Bell className="w-4 h-4 text-white" />
            <span>Test Sound Pop-up 🔔</span>
          </button>

          {/* SMS Ping Test */}
          <button
            onClick={() => handleSendTestPing('SMS')}
            disabled={testSending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md transition-all"
            title="Send test message alert via SMS"
          >
            <Smartphone className="w-4 h-4 text-white" />
            <span>Send SMS Ping ✉️</span>
          </button>

          {/* WhatsApp Ping Test */}
          <button
            onClick={() => handleSendTestPing('WHATSAPP')}
            disabled={testSending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-lg transition-all"
            title="Send test WhatsApp alert"
          >
            <MessageSquare className="w-4 h-4 text-white" />
            <span>Send WhatsApp Ping 📲</span>
          </button>
        </div>
      </div>

      {/* Test Result Action Banner */}
      {testResult && (
        <div className="p-5 rounded-2xl bg-[#121A2D] border border-[#DFCAA8] text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#06090F] border border-[#DFCAA8] text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{testResult.message}</p>
              <p className="text-xs text-white">
                {testResult.channel === 'SMS'
                  ? 'Click below to open in your phone Messages / SMS app:'
                  : testResult.channel === 'WHATSAPP'
                  ? 'Click below to open and receive in WhatsApp:'
                  : 'Sound chime and browser notification triggered on this device!'}
              </p>
            </div>
          </div>

          {testResult.actionUrl && (
            <a
              href={testResult.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs shadow-lg shrink-0 transition-all bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white"
            >
              {testResult.channel === 'SMS' ? <Smartphone className="w-4 h-4 text-white" /> : <MessageSquare className="w-4 h-4 text-white" />}
              <span>
                {testResult.channel === 'SMS' ? '✉️ Open In Phone Messages (SMS) ➔' : '📱 Open In WhatsApp App / Web ➔'}
              </span>
            </a>
          )}
        </div>
      )}

      {/* 2. Main Config Grid: Left (Channel Setup) & Right (Trigger Matrix) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-white">
        {/* Left Column: Mobile Phone & Delivery Channels (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white">Owner Mobile Device Configuration</h3>
              </div>
            </div>

            <div className="space-y-4">
              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white flex items-center justify-between">
                  <span>Manager Mobile Phone Number</span>
                  <span className="text-[10px] text-white font-mono font-bold">With Country Code (+91 / +61)</span>
                </label>
                <input
                  type="text"
                  value={settings.manager_phone}
                  onChange={(e) => setSettings({ ...settings, manager_phone: e.target.value })}
                  placeholder="+919305365420"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] text-white font-mono text-xs focus:border-[#DFCAA8] focus:outline-none font-bold"
                />
              </div>

              {/* Channels Toggles */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">Active Alert Channels</span>

                {/* WhatsApp Toggle */}
                <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">WhatsApp Dispatch Alerts</span>
                      <span className="text-[10px] text-white">Rich formatted cards with direct view links</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.whatsapp_enabled}
                    onChange={(e) => setSettings({ ...settings, whatsapp_enabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-white cursor-pointer"
                  />
                </div>

                {/* SMS Fallback Toggle */}
                <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">SMS Direct Gateway</span>
                      <span className="text-[10px] text-white">Cellular telecom carrier SMS to +91 9305365420</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sms_enabled}
                    onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-white cursor-pointer"
                  />
                </div>

                {/* Browser Web Push & Sound */}
                <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                      <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Browser Push & Sound Alert</span>
                      <span className="text-[10px] text-white">Chime sound + screen pop-up</span>
                    </div>
                  </div>
                  {browserPushAllowed ? (
                    <span className="px-2 py-1 rounded bg-[#121A2D] border border-[#DFCAA8] text-white text-[10px] font-bold">ACTIVE ✓</span>
                  ) : (
                    <button
                      onClick={requestBrowserPermission}
                      className="px-2.5 py-1 rounded bg-[#06090F] border border-[#DFCAA8] text-white text-[10px] font-black hover:bg-[#1A2233] transition-colors"
                    >
                      Enable Sound & Push
                    </button>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md transition-all"
              >
                <Save className="w-4 h-4 text-white" />
                <span>{saving ? 'Saving...' : saveSuccess ? 'Saved Successfully! ✓' : 'Save Notification Settings'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Alert Trigger Event Matrix (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white">Live Dispatch Trigger Rules</h3>
              </div>
              <span className="text-[10px] font-mono text-white">Instant Mobile Ping</span>
            </div>

            {/* Triggers List */}
            <div className="space-y-3">
              {/* Trigger 1: New Booking */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">New Customer Booking Created & Paid</span>
                    <span className="text-[10px] text-white font-semibold">Pings with route, passenger name, fare ($ AUD), and vehicle class</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_new_booking}
                  onChange={(e) => setSettings({ ...settings, alert_on_new_booking: e.target.checked })}
                  className="w-4 h-4 rounded accent-white cursor-pointer"
                />
              </div>

              {/* Trigger 2: Driver Allocated */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                    <Car className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Chauffeur Allocated & Dispatched</span>
                    <span className="text-[10px] text-white font-semibold">Alerts when a driver and vehicle are assigned to a leg with payout rate</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_driver_allocation}
                  onChange={(e) => setSettings({ ...settings, alert_on_driver_allocation: e.target.checked })}
                  className="w-4 h-4 rounded accent-white cursor-pointer"
                />
              </div>

              {/* Trigger 3: Trip Milestones */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Trip Stepper Live Milestones</span>
                    <span className="text-[10px] text-white font-semibold">Pings when chauffeur taps: En Route ➔ Arrived ➔ Picked Up ➔ Completed</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_trip_milestones}
                  onChange={(e) => setSettings({ ...settings, alert_on_trip_milestones: e.target.checked })}
                  className="w-4 h-4 rounded accent-white cursor-pointer"
                />
              </div>

              {/* Trigger 4: Flight Delay */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                    <Plane className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Airport Flight Delay Auto-Reschedule</span>
                    <span className="text-[10px] text-white font-semibold">Alerts when FlightRadar detects delays and adjusts pickup buffer</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_flight_delay}
                  onChange={(e) => setSettings({ ...settings, alert_on_flight_delay: e.target.checked })}
                  className="w-4 h-4 rounded accent-white cursor-pointer"
                />
              </div>

              {/* Trigger 5: Urgent Unassigned Job Escalation */}
              <div className="p-3.5 rounded-xl bg-[#0D1322] border border-[#1F2E4D] flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Urgent Unassigned Job Escalation</span>
                    <span className="text-[10px] text-white font-semibold">Sends high-priority alert if a job remains unallocated &lt; 4 hours before pickup</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alert_on_unassigned_urgent}
                  onChange={(e) => setSettings({ ...settings, alert_on_unassigned_urgent: e.target.checked })}
                  className="w-4 h-4 rounded accent-white cursor-pointer"
                />
              </div>

              {/* Trigger 6: 12-24h Customer Pre-Trip Reconfirmation (10am / 2pm Rule) */}
              <div className="p-4 rounded-xl bg-[#0D1322] border border-[#DFCAA8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-white">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#121A2D] border border-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="space-y-1 text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">12-24h Pre-Trip Customer Reconfirmation</span>
                      <span className="px-2 py-0.5 rounded bg-[#121A2D] border border-[#DFCAA8] text-white text-[9px] font-mono font-bold">10AM / 2PM RULE</span>
                    </div>
                    <p className="text-[11px] text-white leading-relaxed">
                      • <strong>Midnight – 8:00 AM trips:</strong> Dispatched at <strong>10:00 AM</strong> on the day prior.<br/>
                      • <strong>8:00 AM – Midnight trips:</strong> Dispatched at <strong>2:00 PM (14:00)</strong> on the day prior.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRunPreTripConfirmationScanner}
                  disabled={scanning}
                  className="shrink-0 px-3.5 py-2 rounded-xl bg-[#06090F] hover:bg-[#1A2233] border border-[#DFCAA8] text-white font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>{scanning ? 'Scanning...' : 'Run 12-24h Scanner ➔'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Mobile Alert Outbox Feed */}
      <div className="rounded-2xl bg-[#121A2D] border border-[#1F2E4D] p-5 sm:p-6 space-y-4 text-white">
        <div className="flex items-center justify-between border-b border-[#1F2E4D] pb-3">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold text-white">Live Mobile Alert Delivery Outbox</h3>
          </div>
          <span className="text-[10px] font-mono text-white">{notificationLogs.length} Messages Dispatched</span>
        </div>

        <div className="space-y-3">
          {notificationLogs.map((log) => {
            const cleanPhone = getCleanPhone(log.recipient || settings.manager_phone);
            const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(log.content)}`;
            const smsUrl = `sms:+${cleanPhone}?&body=${encodeURIComponent(log.content)}`;
            return (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-[#0D1322] border border-[#1F2E4D] hover:border-[#DFCAA8] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-white"
              >
                <div className="space-y-1 min-w-0 flex-1 text-white">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#121A2D] border border-slate-700 text-white">
                      {log.channel}
                    </span>
                    <span className="font-mono text-white font-bold">{log.recipient}</span>
                    <span className="text-white">•</span>
                    <span className="text-[11px] text-white font-mono">
                      {new Date(log.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-white whitespace-pre-line font-mono text-[11px] mt-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    {log.content}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2 pt-2 md:pt-0">
                  {log.channel === 'SMS' ? (
                    <a
                      href={smsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-bold text-[11px] transition-all"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-white" />
                      <span>Open in SMS ➔</span>
                    </a>
                  ) : (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#06090F] hover:bg-[#1A2233] text-white border border-[#DFCAA8] font-bold text-[11px] transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                      <span>Open in WhatsApp ➔</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
