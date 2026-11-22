// Prevent 'Failed to construct Response: Response with null body status cannot have body'
const _NativeResponse = self.Response;
self.Response = class ScramjetPatchedResponse extends _NativeResponse {
  constructor(body, init) {
    const status = init && typeof init === 'object' ? init.status : undefined;
    if (status === 204 || status === 205 || status === 304 || status === 101) {
      super(null, init);
      return;
    }
    super(body, init);
  }
};

const SJ_RUNTIME_CACHE = 'scramjet-v2-runtime-v4';
const SJ_PRECACHE_ASSETS = [
  '/scramjet/scramjet.js',
  '/controller/controller.inject.js',
];
const SJ_BACKGROUND_WARM_ASSETS = ['/scramjet/scramjet.wasm'];

function isCacheableScramjetRuntimeUrl(pathname) {
  return (
    pathname.startsWith('/scramjet/') ||
    pathname.startsWith('/epoxy/') ||
    pathname.startsWith('/libcurl/') ||
    pathname === '/controller/controller.inject.js' ||
    pathname === '/controller/controller.api.js'
  );
}

async function isValidRuntimeResponse(pathname, res) {
  if (!res || !res.ok) return false;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  // Never cache HTML error/auth/SPA fallback pages under .js or .wasm URLs
  if (ct.includes('text/html')) return false;
  if (pathname.endsWith('.wasm')) {
    try {
      const buf = await res.clone().arrayBuffer();
      if (buf.byteLength < 8) return false;
      const view = new Uint8Array(buf, 0, 4);
      // Verify WASM magic bytes \0asm
      return view[0] === 0x00 && view[1] === 0x61 && view[2] === 0x73 && view[3] === 0x6d;
    } catch {
      return false;
    }
  }
  return true;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // Warm light JS runtime fast during install; warm WASM in background so slow mobile networks never stall SW activation
  event.waitUntil(
    caches
      .open(SJ_RUNTIME_CACHE)
      .then((cache) =>
        Promise.allSettled(
          SJ_PRECACHE_ASSETS.map(async (asset) => {
            const res = await fetch(asset, { cache: 'default', credentials: 'same-origin' });
            if (await isValidRuntimeResponse(asset, res)) {
              await cache.put(asset, res.clone());
            }
          })
        )
      )
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith('scramjet-v2-runtime-') && k !== SJ_RUNTIME_CACHE)
              .map((k) => caches.delete(k))
          )
        )
        .catch(() => {}),
      caches
        .open(SJ_RUNTIME_CACHE)
        .then((cache) =>
          Promise.allSettled(
            SJ_BACKGROUND_WARM_ASSETS.map(async (asset) => {
              if (await cache.match(asset)) return;
              const res = await fetch(asset, { cache: 'default', credentials: 'same-origin' });
              if (await isValidRuntimeResponse(asset, res)) {
                await cache.put(asset, res.clone());
              }
            })
          )
        )
        .catch(() => {}),
    ])
  );
});

importScripts('/controller/controller.sw.js');

const initWaiters = new Set();
self.addEventListener('message', (event) => {
  if (event?.data && typeof event.data === 'object') {
    if (event.data.$sj$claim) {
      const claimPromise = self.clients.claim().catch(() => {});
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(claimPromise);
      }
      return;
    }
    if (event.data.$controller$init) {
      // Allow controller.sw.js's listener to run first on this tick, then wake waiters
      setTimeout(() => {
        for (const resolve of initWaiters) {
          try {
            resolve();
          } catch {}
        }
        initWaiters.clear();
      }, 0);
    }
  }
});

async function notifyClientsToRevive() {
  try {
    const windowClients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window',
    });
    for (const client of windowClients) {
      try {
        client.postMessage({ $controller$swrevive: {} });
      } catch {}
    }
  } catch {}
}

async function routeScramjetEvent(event) {
  const res = await $scramjetController.route(event);
  if (res && (res.status === 204 || res.status === 205 || res.status === 304 || res.status === 101)) {
    return new _NativeResponse(null, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }
  return res;
}

async function waitForControllerAndRoute(event) {
  await notifyClientsToRevive();

  const deadline = Date.now() + 5500;
  let lastRevive = Date.now();
  while (Date.now() < deadline) {
    if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
      return routeScramjetEvent(event);
    }
    if (Date.now() - lastRevive >= 350) {
      lastRevive = Date.now();
      notifyClientsToRevive();
    }
    await new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        initWaiters.delete(done);
        resolve();
      };
      initWaiters.add(done);
      const timer = setTimeout(done, 50);
    });
  }

  if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
    return routeScramjetEvent(event);
  }

  try {
    return fetch(event.request);
  } catch {
    return new _NativeResponse('Service Unavailable', { status: 503 });
  }
}

self.addEventListener('fetch', (event) => {
  let reqUrl;
  try {
    reqUrl = new URL(event.request.url);
  } catch {
    return;
  }

  if (reqUrl.origin === self.location.origin && reqUrl.pathname === '/__sj_ping__') {
    let ctrlReady = '0';
    const prefix = reqUrl.searchParams.get('prefix');
    if (prefix && typeof $scramjetController !== 'undefined' && typeof $scramjetController.shouldRoute === 'function') {
      try {
        const probeReq = new Request(self.location.origin + prefix + 'https://example.com/');
        if ($scramjetController.shouldRoute({ request: probeReq })) {
          ctrlReady = '1';
        }
      } catch {}
    }
    event.respondWith(
      new _NativeResponse('ok', {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-sj-sw': '1',
          'x-sj-ctrl': ctrlReady,
        },
      })
    );
    return;
  }

  // Bypass Scramjet WASM/Wisp routing for local YouTube stream proxy requests (even when rewritten inside /~/sj/)
  if (reqUrl.origin === self.location.origin && reqUrl.href.includes('__frost_yt_stream__')) {
    let vid = reqUrl.searchParams.get('v') || '';
    if (!vid) {
      try {
        const decodedHref = decodeURIComponent(reqUrl.href);
        const m = decodedHref.match(/[?&]v=([a-zA-Z0-9_-]{6,20})/);
        if (m) vid = m[1];
      } catch {}
    }
    if (vid && /^[a-zA-Z0-9_-]{6,20}$/.test(vid)) {
      const forwardHeaders = new Headers();
      const rangeHeader = event.request.headers.get('range');
      if (rangeHeader) {
        forwardHeaders.set('range', rangeHeader);
      }
      event.respondWith(
        fetch('/api/yt-stream?v=' + encodeURIComponent(vid), {
          method: event.request.method === 'HEAD' ? 'HEAD' : 'GET',
          headers: forwardHeaders,
          cache: 'no-store',
        })
      );
      return;
    }
  }

  if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
    event.respondWith(routeScramjetEvent(event));
    return;
  }

  // If this is a Scramjet prefix request (/~/sj/...) that arrived while SW just woke from idle,
  // wait briefly for the controller tab to re-attach via $controller$swrevive instead of falling back to SPA index.html.
  if (reqUrl.origin === self.location.origin && reqUrl.pathname.startsWith('/~/sj/')) {
    event.respondWith(waitForControllerAndRoute(event));
    return;
  }

  if (event.request.method !== 'GET') return;

  // Serve cached local Scramjet runtime & WASM binary without re-fetching on every navigation
  if (reqUrl.origin === self.location.origin && isCacheableScramjetRuntimeUrl(reqUrl.pathname)) {
    event.respondWith(
      caches.open(SJ_RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request, { ignoreSearch: false });
        if (cached && (await isValidRuntimeResponse(reqUrl.pathname, cached))) {
          return cached;
        }
        if (cached) {
          await cache.delete(event.request).catch(() => {});
        }
        const netRes = await fetch(event.request, { credentials: 'same-origin' });
        if (await isValidRuntimeResponse(reqUrl.pathname, netRes)) {
          cache.put(event.request, netRes.clone()).catch(() => {});
        }
        return netRes;
      })
    );
  }
});
