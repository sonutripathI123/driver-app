// Bump this on every meaningful change so all clients purge old caches and
// pull the new build on their next visit (no manual "clear cache" needed).
const CACHE_NAME = 'admin-dashboard-pwa-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// This is an always-online admin dashboard, so correctness of the latest code
// matters more than offline speed: use NETWORK-FIRST for everything, and fall
// back to the cache only when the network is unavailable. This guarantees a
// deploy is picked up on the next load instead of a stale bundle being served.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Never intercept API traffic — always hit the network directly.
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // SPA navigations fall back to the cached shell when offline.
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          return cached;
        })
      )
  );
});
