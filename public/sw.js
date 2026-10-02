const CACHE_NAME = 'melted-offline-core-v2';
const GAME_CACHE_NAME = 'melted-offline-games-v1';
const ASSETS_CACHE_NAME = 'melted-offline-assets-v1';

// Essential app shell assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Core precache partial notice:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key !== GAME_CACHE_NAME && key !== ASSETS_CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only intercept GET requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // 1. Navigation requests (Handling the tricky offline reload / refresh!)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
              cache.put('/', clone.clone());
              cache.put('/index.html', clone.clone());
            });
          }
          return response;
        })
        .catch(async () => {
          // OFFLINE REFRESH: Serve cached index.html or root
          const match = await caches.match(request);
          if (match) return match;
          const rootMatch = await caches.match('/');
          if (rootMatch) return rootMatch;
          const indexMatch = await caches.match('/index.html');
          if (indexMatch) return indexMatch;

          return new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Melted Offline</title></head><body style="background:#080808;color:#fff;font-family:sans-serif;display:flex;height:100vh;align-items:center;justify-content:center;margin:0;"><div style="text-align:center;"><h2>Offline Mode</h2><p>Please reconnect to the internet once to load the initial arcade files.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 2. Game package files (/api/raw/*)
  if (url.pathname.startsWith('/api/raw/')) {
    event.respondWith(
      caches.open(GAME_CACHE_NAME).then(async (gameCache) => {
        const cachedResponse = await gameCache.match(request);

        // When offline, prioritize cached game package immediately
        if (!navigator.onLine && cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              gameCache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            if (cachedResponse) return cachedResponse;
            return new Response(
              '<!doctype html><html><body style="background:#0a0a0c;color:#fff;font-family:sans-serif;height:100vh;display:flex;align-items:center;justify-content:center;margin:0;"><div style="text-align:center;padding:20px;"><h3>Game Not Cached Offline</h3><p style="color:#888;font-size:13px;">Connect online once and launch this game to cache it for offline play.</p></div></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
      })
    );
    return;
  }

  // 3. Static assets: JS, CSS, CDN covers, Fonts
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(ASSETS_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
