// Audio synthesizer and Service Worker push notification helper

let swRegistration: ServiceWorkerRegistration | null = null;

// Initialize Service Worker
export const initServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      swRegistration = reg;
      return reg;
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  }
  return null;
};

// Play pleasant luxury chime using Web Audio API (works without external audio files)
export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.0, ctx.currentTime + 0.15); // A5

    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.6);

    // Tone 2 (Harmonic)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15); // D6
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.8);
  } catch (e) {
    // Audio context may be restricted before first gesture
  }
};

// Vibrate phone hardware
export const triggerDeviceVibration = () => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 400]);
    } catch (e) {}
  }
};

// Dispatch Native Push Notification via Service Worker (Android & Desktop)
export const triggerNativeNotification = async (title: string, body: string) => {
  // 1. Play sound chime
  playNotificationChime();

  // 2. Vibrate phone
  triggerDeviceVibration();

  // 3. Check permission
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  // 4. Try Service Worker showNotification (Required for Android Chrome)
  if ('serviceWorker' in navigator) {
    try {
      let reg = swRegistration;
      if (!reg) {
        const foundReg = await navigator.serviceWorker.getRegistration();
        reg = foundReg || null;
      }
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
      }
      if (reg && reg.showNotification) {
        const swOptions: any = {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          vibrate: [200, 100, 200, 100, 400],
          tag: 'chauffeur-alert',
          renotify: true,
        };
        await reg.showNotification(title, swOptions);
        return true;
      }
    } catch (swErr) {
      console.warn('SW showNotification fallback:', swErr);
    }
  }

  // 5. Fallback to standard Notification API
  try {
    new Notification(title, {
      body,
      icon: '/favicon.svg',
    });
    return true;
  } catch (nErr) {
    console.warn('Standard Notification failed:', nErr);
    return false;
  }
};

// Helper to convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribes browser to Google FCM / Apple APNs for background push when tab is closed
export const subscribeToWebPush = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  try {
    let reg = swRegistration;
    if (!reg) {
      reg = await navigator.serviceWorker.ready;
    }
    const vapidPublicKey = "BC83SPc-2FsmI9kDBZWw_JiVvYLhGONl_In6RaUZDwpgWF-JPhjiB9qh3Cn8YgN5VWwVMOFYCGi26mExGvTwyqY";
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });
    }

    // Send subscription to backend
    const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
    await fetch(`${apiBase}/notifications/webpush-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
    return true;
  } catch (err) {
    console.warn('Web push background subscription failed:', err);
    return false;
  }
};

