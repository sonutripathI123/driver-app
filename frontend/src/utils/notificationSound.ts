// Audio synthesizer and Service Worker push notification helper

let swRegistration: ServiceWorkerRegistration | null = null;
let audioCtxInstance: AudioContext | null = null;

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

// Play pleasant high-fidelity luxury chime using Web Audio API
export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    
    if (!audioCtxInstance || audioCtxInstance.state === 'closed') {
      audioCtxInstance = new AudioCtx();
    }
    const ctx = audioCtxInstance;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Chord note 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Chord note 2: E5 (659.25 Hz) - delayed by 0.1s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.08);
    gain2.gain.setValueAtTime(0.45, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.7);

    // Chord note 3: G5 (783.99 Hz) - delayed by 0.16s (Crystal sparkle)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(783.99, now + 0.16);
    osc3.frequency.exponentialRampToValueAtTime(1046.50, now + 0.35); // ramp up to C6
    gain3.gain.setValueAtTime(0.5, now + 0.16);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.16);
    osc3.stop(now + 0.9);
  } catch (e) {
    console.warn('Audio chime playback notice:', e);
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
export const triggerNativeNotification = async (title: string, body: string): Promise<boolean> => {
  // 1. Play sound chime
  playNotificationChime();

  // 2. Vibrate phone
  triggerDeviceVibration();

  // 3. Check browser notification support
  if (!('Notification' in window)) {
    return false;
  }

  // If permission is default, ask the user
  if (Notification.permission === 'default') {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    } catch (e) {
      return false;
    }
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  // 4. Try Service Worker showNotification (Required for Android Mobile Chrome & background PWA)
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
          tag: 'chauffeur-alert-' + Date.now(),
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
    console.warn('Standard Notification fallback error:', nErr);
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
    const apiBase = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api/v1` : '/api/v1';
    await fetch(`${apiBase}/notifications/webpush-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
    return true;
  } catch (err) {
    console.warn('Web push background subscription:', err);
    return false;
  }
};
