import type { ProxyTransport } from '@mercuryworkshop/proxy-transports';
import type { Controller, Frame } from '@mercuryworkshop/scramjet-controller';

const COOKIE_STORAGE_KEY = 'sj_saved_cookies_v1';
const USER_ID_STORAGE_KEY = 'frosthub_chat_user_id';
const CONTROLLER_IDB_NAME = '__scramjet_controller';
const CONTROLLER_IDB_STORE = 'state';
const CONTROLLER_IDB_KEY = 'cookies';

export interface ScramjetFrameCallbacks {
  onNavigate?: (url: string, title?: string) => void;
  onOpenNewTab?: (url: string) => void;
}

let initPromise: Promise<Controller> | null = null;
let cachedController: Controller | null = null;
let remoteSyncTimer: number | null = null;
let periodicFlushTimer: number | null = null;
let lifecycleListenersAttached = false;
const frameMap = new WeakMap<HTMLIFrameElement, Frame>();
const frameCallbackMap = new WeakMap<HTMLIFrameElement, ScramjetFrameCallbacks>();

function getCookieStoreUserId(): string {
  try {
    return localStorage.getItem(USER_ID_STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

function parseCookieDump(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, any>) };
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function readLocalSavedCookies(): Record<string, any> {
  try {
    return parseCookieDump(localStorage.getItem(COOKIE_STORAGE_KEY));
  } catch {
    return {};
  }
}

function writeLocalSavedCookies(cookies: Record<string, any>): void {
  try {
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(cookies));
  } catch {
    // Ignore quota errors
  }
}

async function readControllerIdbCookies(): Promise<Record<string, any>> {
  if (typeof indexedDB === 'undefined') return {};
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(CONTROLLER_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CONTROLLER_IDB_STORE)) {
          db.createObjectStore(CONTROLLER_IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(CONTROLLER_IDB_STORE, 'readonly');
          const store = tx.objectStore(CONTROLLER_IDB_STORE);
          const getReq = store.get(CONTROLLER_IDB_KEY);
          getReq.onsuccess = () => {
            const val = getReq.result;
            resolve(parseCookieDump(val?.cookies));
          };
          getReq.onerror = () => resolve({});
        } catch {
          resolve({});
        }
      };
      req.onerror = () => resolve({});
    } catch {
      resolve({});
    }
  });
}

async function seedControllerIdbCookies(cookies: Record<string, any>): Promise<void> {
  if (typeof indexedDB === 'undefined' || !cookies || Object.keys(cookies).length === 0) return;
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.open(CONTROLLER_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CONTROLLER_IDB_STORE)) {
          db.createObjectStore(CONTROLLER_IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(CONTROLLER_IDB_STORE, 'readwrite');
          const store = tx.objectStore(CONTROLLER_IDB_STORE);
          const getReq = store.get(CONTROLLER_IDB_KEY);
          getReq.onsuccess = () => {
            const existing = parseCookieDump(getReq.result?.cookies);
            const merged = { ...cookies, ...existing };
            const updatedAt = Math.max(Date.now(), (Number(getReq.result?.updatedAt) || 0) + 1);
            store.put({ updatedAt, cookies: JSON.stringify(merged) }, CONTROLLER_IDB_KEY);
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function fetchRemoteSavedCookies(): Promise<Record<string, any>> {
  try {
    const userId = getCookieStoreUserId();
    const res = await fetch(`/api/scramjet-cookies?userId=${encodeURIComponent(userId)}`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return parseCookieDump(data?.cookies);
  } catch {
    return {};
  }
}

function pushRemoteSavedCookies(cookies: Record<string, any>, immediate = false): void {
  if (!cookies || Object.keys(cookies).length === 0) return;
  const userId = getCookieStoreUserId();

  const send = () => {
    try {
      fetch('/api/scramjet-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, cookies }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  if (immediate) {
    if (remoteSyncTimer !== null) {
      window.clearTimeout(remoteSyncTimer);
      remoteSyncTimer = null;
    }
    send();
    return;
  }

  if (remoteSyncTimer !== null) {
    window.clearTimeout(remoteSyncTimer);
  }
  remoteSyncTimer = window.setTimeout(() => {
    remoteSyncTimer = null;
    send();
  }, 500);
}

export function flushScramjetCookies(immediateRemote = true): void {
  const controller = cachedController;
  if (!controller?.cookieJar) return;
  try {
    const inMemory = parseCookieDump(controller.cookieJar.dump());
    const localStored = readLocalSavedCookies();
    const merged = { ...localStored, ...inMemory };
    if (Object.keys(merged).length > 0) {
      writeLocalSavedCookies(merged);
      if (typeof controller.persistCookies === 'function') {
        controller.persistCookies().catch(() => {});
      }
      pushRemoteSavedCookies(merged, immediateRemote);
    }
  } catch {
    // Ignore errors during flush
  }
}

function attachCookieLifecycleListeners(): void {
  if (lifecycleListenersAttached || typeof window === 'undefined') return;
  lifecycleListenersAttached = true;

  window.addEventListener('pagehide', () => flushScramjetCookies(true));
  window.addEventListener('beforeunload', () => flushScramjetCookies(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushScramjetCookies(true);
    }
  });

  // Periodic background checkpoint so website sessions never drop on sudden tab closes
  periodicFlushTimer = window.setInterval(() => {
    const controller = cachedController;
    if (!controller?.cookieJar) return;
    try {
      const inMemory = parseCookieDump(controller.cookieJar.dump());
      const localStored = readLocalSavedCookies();
      const merged = { ...localStored, ...inMemory };
      if (Object.keys(merged).length > Object.keys(localStored).length) {
        writeLocalSavedCookies(merged);
        pushRemoteSavedCookies(merged, false);
        controller.persistCookies?.().catch(() => {});
      }
    } catch {}
  }, 3000);
  void periodicFlushTimer;
}

function protectCookieJarInstance(jar: any, onMutate?: () => void): void {
  if (!jar || jar.__frostProtected) return;
  jar.__frostProtected = true;

  // Never allow Clear-Site-Data or runtime resets to clear saved website cookies
  jar.clear = () => {};

  const origLoad = typeof jar.load === 'function' ? jar.load.bind(jar) : null;
  if (origLoad) {
    jar.load = (rawJson: string) => {
      const current = parseCookieDump(typeof jar.dump === 'function' ? jar.dump() : '{}');
      const stored = readLocalSavedCookies();
      const incoming = parseCookieDump(rawJson);
      const merged = { ...stored, ...current, ...incoming };
      const mergedJson = JSON.stringify(merged);
      writeLocalSavedCookies(merged);
      return origLoad(mergedJson);
    };
  }

  const origSetCookies = typeof jar.setCookies === 'function' ? jar.setCookies.bind(jar) : null;
  if (origSetCookies) {
    jar.setCookies = (...args: any[]) => {
      const res = origSetCookies(...args);
      try {
        const updated = { ...readLocalSavedCookies(), ...parseCookieDump(jar.dump()) };
        writeLocalSavedCookies(updated);
        pushRemoteSavedCookies(updated, false);
        onMutate?.();
      } catch {}
      return res;
    };
  }
}

async function protectAndHydrateCookies(controller: Controller): Promise<void> {
  const jar = controller.cookieJar;
  if (!jar) return;

  attachCookieLifecycleListeners();

  // Merge cookies across remote store, localStorage, IndexedDB, and live jar
  const [remoteCookies, idbCookies] = await Promise.all([
    fetchRemoteSavedCookies(),
    readControllerIdbCookies(),
  ]);
  const localCookies = readLocalSavedCookies();
  const jarCookies = parseCookieDump(jar.dump());
  const merged = { ...remoteCookies, ...idbCookies, ...localCookies, ...jarCookies };

  protectCookieJarInstance(jar, () => {
    controller.persistCookies?.().catch(() => {});
  });

  if (Object.keys(merged).length > 0) {
    const mergedJson = JSON.stringify(merged);
    jar.load(mergedJson);
    writeLocalSavedCookies(merged);
    if (typeof controller.persistCookies === 'function') {
      await controller.persistCookies().catch(() => {});
    }
  }

  const origPersist = typeof controller.persistCookies === 'function' ? controller.persistCookies.bind(controller) : null;
  if (origPersist) {
    controller.persistCookies = async () => {
      try {
        const current = parseCookieDump(jar.dump());
        const stored = readLocalSavedCookies();
        const combined = { ...stored, ...current };
        if (Object.keys(combined).length > Object.keys(current).length) {
          jar.load(JSON.stringify(combined));
        }
        writeLocalSavedCookies(combined);
        pushRemoteSavedCookies(combined, false);
      } catch {}
      return origPersist();
    };
  }
}

function loadScriptOnce(src: string, globalCheck: () => boolean): Promise<void> {
  if (globalCheck()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (globalCheck()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function waitForServiceWorkerActive(registration: ServiceWorkerRegistration): Promise<ServiceWorker> {
  if (registration.active && registration.active.state === 'activated') {
    return registration.active;
  }

  const candidate = registration.installing || registration.waiting || registration.active;
  if (!candidate) {
    const readyReg = await navigator.serviceWorker.ready;
    if (readyReg.active) {
      return readyReg.active;
    }
    throw new Error('Scramjet Service Worker failed to activate');
  }

  if (candidate.state === 'activated') {
    return candidate;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Timed out waiting for Scramjet Service Worker activation'));
    }, 8000);

    const onStateChange = () => {
      if (candidate.state === 'activated') {
        window.clearTimeout(timeout);
        candidate.removeEventListener('statechange', onStateChange);
        resolve();
      } else if (candidate.state === 'redundant') {
        window.clearTimeout(timeout);
        candidate.removeEventListener('statechange', onStateChange);
        reject(new Error('Scramjet Service Worker became redundant'));
      }
    };

    candidate.addEventListener('statechange', onStateChange);
  });

  return registration.active || candidate;
}

type RawHeaderPair = [string, string];

const FORBIDDEN_H2_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'http2-settings',
]);

function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function sanitizeTransportHeaders(
  headers: RawHeaderPair[] | Headers | Record<string, string> | undefined,
  method: string
): RawHeaderPair[] {
  const entries: RawHeaderPair[] = [];
  if (!headers) return entries;

  const rawPairs: Array<[string, string]> = Array.isArray(headers)
    ? headers
    : headers instanceof Headers
    ? Array.from(headers.entries())
    : Object.entries(headers);

  const upperMethod = (method || 'GET').toUpperCase();
  const isBodylessMethod = upperMethod === 'GET' || upperMethod === 'HEAD';
  const map = new Map<string, string>();
  const cookies: string[] = [];

  for (const pair of rawPairs) {
    if (!pair || pair.length < 2) continue;
    const key = String(pair[0] ?? '')
      .replace(/[\r\n\0:\s]+/g, '')
      .toLowerCase();
    if (!key || FORBIDDEN_H2_HEADERS.has(key)) continue;
    if (isBodylessMethod && key === 'content-length') continue;

    let val = String(pair[1] ?? '').replace(/[\r\n\0]+/g, ' ').trim();
    if (key === 'te' && val.toLowerCase() !== 'trailers') continue;
    if (key === 'accept-encoding') {
      const cleaned = val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !s.toLowerCase().startsWith('zstd'))
        .join(', ');
      val = cleaned || 'gzip, deflate, br';
    }

    if (key === 'cookie') {
      if (val) cookies.push(val);
    } else {
      map.set(key, val);
    }
  }

  for (const [k, v] of map.entries()) {
    entries.push([k, v]);
  }
  if (cookies.length > 0) {
    entries.push(['cookie', cookies.join('; ')]);
  }
  return entries;
}

async function normalizeRequestBody(method: string, body: BodyInit | null | undefined): Promise<ArrayBuffer | Uint8Array | string | null> {
  const upperMethod = (method || 'GET').toUpperCase();
  if (upperMethod === 'GET' || upperMethod === 'HEAD' || body == null) {
    return null;
  }
  if (typeof body === 'string') return body;
  if (body instanceof ArrayBuffer) return body;
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  if (body instanceof Blob) {
    return await body.arrayBuffer();
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const u8 = value instanceof Uint8Array ? value : new Uint8Array(value);
        chunks.push(u8);
        total += u8.byteLength;
      }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return merged;
  }
  return body as any;
}

async function serverFallbackFetch(
  remote: URL,
  method: string,
  body: ArrayBuffer | Uint8Array | string | null,
  headers: RawHeaderPair[],
  signal?: AbortSignal
): Promise<{
  body: ArrayBuffer;
  headers: RawHeaderPair[];
  status: number;
  statusText: string;
}> {
  const reqHeaders = new Headers();
  reqHeaders.set('X-SJ-Url', remote.href);
  reqHeaders.set('X-SJ-Method', (method || 'GET').toUpperCase());
  reqHeaders.set('X-SJ-Headers', toBase64Utf8(JSON.stringify(headers)));

  const retryDelays = [400, 900, 1500];
  let lastErrorMsg = 'Proxy request failed';

  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const res = await fetch('/api/scramjet-fetch', {
        method: 'POST',
        headers: reqHeaders,
        body: body as BodyInit | null,
        signal,
      });

      const metaHeader = res.headers.get('X-SJ-Meta');
      const contentType = (res.headers.get('content-type') || '').toLowerCase();

      if (res.ok && metaHeader) {
        const meta = JSON.parse(fromBase64Utf8(metaHeader)) as {
          status: number;
          statusText: string;
          headers: RawHeaderPair[];
        };
        const status = Number(meta.status) || 200;
        const isNullBodyStatus =
          status === 101 || status === 204 || status === 205 || status === 304;
        const buf = isNullBodyStatus ? null : await res.arrayBuffer();
        return {
          body: buf as any,
          headers: Array.isArray(meta.headers) ? meta.headers : [],
          status,
          statusText: String(meta.statusText || ''),
        };
      }

      // Detect proxy/container warmup HTML ("Starting Server...") or 502/503/504 and retry cleanly
      const rawBodyText = await res.text().catch(() => '');
      const isHtmlSplash =
        contentType.includes('text/html') ||
        rawBodyText.trimStart().startsWith('<') ||
        rawBodyText.includes('Starting Server');

      if (isHtmlSplash) {
        lastErrorMsg = `Server is starting up (HTTP ${res.status})`;
      } else {
        try {
          const parsed = JSON.parse(rawBodyText);
          lastErrorMsg = parsed?.message || parsed?.error || `HTTP ${res.status}`;
        } catch {
          lastErrorMsg = (rawBodyText || res.statusText || `HTTP ${res.status}`)
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 150);
        }
      }

      const shouldRetry =
        attempt < retryDelays.length &&
        (isHtmlSplash || res.status === 502 || res.status === 503 || res.status === 504 || !metaHeader);

      if (!shouldRetry) {
        break;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) {
        throw err;
      }
      lastErrorMsg = String(err?.message || 'Network error').replace(/<[^>]+>/g, ' ').slice(0, 150);
      if (attempt >= retryDelays.length) {
        break;
      }
    }

    await new Promise((r) => window.setTimeout(r, retryDelays[attempt]));
  }

  throw new Error(lastErrorMsg.replace(/<[^>]+>/g, '').trim() || 'Proxy request temporarily unavailable');
}

function formatEpoxyHeaders(rawHeaders: Record<string, string | string[]>): RawHeaderPair[] {
  const entries: RawHeaderPair[] = [];
  for (const [key, value] of Object.entries(rawHeaders || {})) {
    if (Array.isArray(value)) {
      for (const v of value) {
        entries.push([key, v]);
      }
    } else if (value !== undefined) {
      entries.push([key, value]);
    }
  }
  return entries;
}

function isRecoverableTransportError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    msg.includes('hyper') ||
    msg.includes('http2') ||
    msg.includes('protocol_error') ||
    msg.includes('reset(') ||
    msg.includes('sendrequest') ||
    msg.includes('wisp') ||
    msg.includes('eof') ||
    msg.includes('closed') ||
    msg.includes('broken pipe') ||
    msg.includes('connection') ||
    msg.includes('tls') ||
    msg.includes('stream')
  );
}

const KNOWN_HTTP2_INCOMPATIBLE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'googlevideo.com',
  'ytimg.com',
  'i.ytimg.com',
  'google.com',
  'www.google.com',
  'gstatic.com',
  'googleapis.com',
  'googleusercontent.com',
  'youtube-nocookie.com',
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'tiktokcdn.com',
  'byteoversea.com',
  'ibytedtos.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'tiktokcdn-in.com',
  'ttwstatic.com',
  'ibyteimg.com',
  'muscdn.com',
]);

function isKnownHttp2Incompatible(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const known of KNOWN_HTTP2_INCOMPATIBLE_HOSTS) {
    if (h === known || h.endsWith('.' + known)) {
      return true;
    }
  }
  return false;
}

const LIBCURL_PREFERRED_HOSTS = new Set([
  'youtube.com',
  'googlevideo.com',
  'ytimg.com',
  'tiktok.com',
  'tiktokcdn.com',
  'byteoversea.com',
  'twitch.tv',
  'discord.com',
  'github.com',
  'spotify.com',
  'netflix.com',
]);

function isLibcurlPreferredHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const known of LIBCURL_PREFERRED_HOSTS) {
    if (h === known || h.endsWith('.' + known)) {
      return true;
    }
  }
  return false;
}

async function createWispTransport(): Promise<ProxyTransport> {
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wispUrl = `${wsProto}//${window.location.host}/wisp/`;
  const http2FallbackHosts = new Set<string>();

  let epoxyInstance: any = null;
  let libcurlInstance: any = null;
  let epoxyRefreshPromise: Promise<void> | null = null;

  await Promise.all([
    (async () => {
      try {
        const { default: EpoxyTransport } = await import('@mercuryworkshop/epoxy-transport');
        const instance = new EpoxyTransport({
          wisp: wispUrl,
          redirect_limit: 0,
          header_limit: 512,
          buffer_size: 8192,
        });
        await instance.init();
        epoxyInstance = instance;
      } catch (err) {
        console.warn('[Scramjet] EpoxyTransport init warning:', err);
      }
    })(),
    (async () => {
      try {
        const { default: LibcurlClient } = await import('@mercuryworkshop/libcurl-transport');
        const libcurl = new LibcurlClient({ wisp: wispUrl });
        await libcurl.init();
        libcurlInstance = libcurl;
      } catch (err) {
        console.warn('[Scramjet] LibcurlClient init warning:', err);
      }
    })(),
  ]);

  const refreshEpoxyInBackground = () => {
    if (epoxyRefreshPromise) return;
    epoxyRefreshPromise = (async () => {
      try {
        const { default: EpoxyTransport } = await import('@mercuryworkshop/epoxy-transport');
        const instance = new EpoxyTransport({
          wisp: wispUrl,
          redirect_limit: 0,
          header_limit: 512,
          buffer_size: 8192,
        });
        await instance.init();
        epoxyInstance = instance;
      } catch {}
    })().finally(() => {
      epoxyRefreshPromise = null;
    });
  };

  const resilientTransport: ProxyTransport = {
    ready: true,
    async init() {
      this.ready = true;
    },
    async request(remote, method, body, headers, signal) {
      const cleanHeaders = sanitizeTransportHeaders(headers as any, method);
      const safeBody = await normalizeRequestBody(method, body);
      const hostKey = remote.host.toLowerCase();

      // If this host is known to reject Hyper HTTP/2, go straight to server fetch
      if (isKnownHttp2Incompatible(remote.hostname) || http2FallbackHosts.has(hostKey)) {
        return await serverFallbackFetch(remote, method, safeBody, cleanHeaders, signal);
      }

      const useLibcurl = isLibcurlPreferredHost(remote.hostname);

      // 1. If Libcurl is preferred for this media/streaming site, try Libcurl first
      if (useLibcurl && libcurlInstance) {
        try {
          return await libcurlInstance.request(remote, method, safeBody, cleanHeaders, signal);
        } catch {
          // Fall through to Epoxy / Server Fetch
        }
      }

      // 2. Try Epoxy transport
      if (epoxyInstance?.client) {
        try {
          const headersObj: Record<string, string> = {};
          for (const [k, v] of cleanHeaders) {
            headersObj[k] = v;
          }
          const res = await epoxyInstance.client.fetch(remote.href, {
            method: method || 'GET',
            body: safeBody,
            headers: headersObj,
            redirect: 'manual',
          });
          return {
            body: res.body,
            headers: formatEpoxyHeaders(res.rawHeaders),
            status: res.status,
            statusText: res.statusText,
          };
        } catch (err) {
          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          if (!isRecoverableTransportError(err)) {
            throw err;
          }
          const msg = String((err as any)?.message || err || '').toLowerCase();
          if (msg.includes('http2') || msg.includes('protocol_error') || msg.includes('reset(')) {
            if (http2FallbackHosts.size > 200) {
              http2FallbackHosts.clear();
            }
            http2FallbackHosts.add(hostKey);
          } else if (msg.includes('wisp') || msg.includes('closed') || msg.includes('eof')) {
            refreshEpoxyInBackground();
          }
        }
      }

      // 3. Fallback to Libcurl if not tried yet
      if (!useLibcurl && libcurlInstance) {
        try {
          return await libcurlInstance.request(remote, method, safeBody, cleanHeaders, signal);
        } catch {}
      }

      // 4. Final fallback to server raw fetch
      if (!epoxyInstance?.client && !libcurlInstance) {
        refreshEpoxyInBackground();
      }
      return await serverFallbackFetch(remote, method, safeBody, cleanHeaders, signal);
    },
    connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
      const active = epoxyInstance || libcurlInstance;
      if (active) {
        return active.connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror);
      }
      onerror('WebSocket transport unavailable');
      return [() => {}, () => {}];
    },
  };

  return resilientTransport;
}

export async function initScramjetProxy(): Promise<Controller> {
  if (cachedController && cachedController.isReady) {
    return cachedController;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      throw new Error('Service Workers are not supported in this browser context');
    }

    // 1. Pre-seed IndexedDB cookie store before Controller constructor reads it
    const [localPre, remotePre] = await Promise.all([
      Promise.resolve(readLocalSavedCookies()),
      fetchRemoteSavedCookies(),
    ]);
    const preMerged = { ...remotePre, ...localPre };
    if (Object.keys(preMerged).length > 0) {
      writeLocalSavedCookies(preMerged);
      await seedControllerIdbCookies(preMerged);
    }

    // 2. Load Scramjet 2.0.67-alpha.2 runtime and Controller API sequentially
    await loadScriptOnce('/scramjet/scramjet.js', () => Boolean(window.$scramjet));
    await loadScriptOnce('/controller/controller.api.js', () => Boolean(window.$scramjetController));

    if (!window.$scramjetController) {
      throw new Error('Scramjet Controller API failed to initialize');
    }

    // 3. Register and activate Scramjet Controller Service Worker at root scope
    const registration = await navigator.serviceWorker.register('/sj-sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    await registration.update().catch(() => {});

    const activeWorker = await waitForServiceWorkerActive(registration);

    // 4. Initialize Wisp transport (Epoxy v3 with HTTP/2 & Wisp resilience fallback)
    const transport = await createWispTransport();

    // 5. Create Controller with optimized flags for heavy media/SPA web apps (YouTube, TikTok, etc.)
    const baseFlags = (window.$scramjet?.defaultConfig?.flags || {}) as NonNullable<
      NonNullable<typeof window.$scramjet>['defaultConfig']
    >['flags'];
    const controller = new window.$scramjetController.Controller({
      serviceworker: activeWorker,
      transport,
      scramjetConfig: {
        flags: {
          ...baseFlags,
          sourcemaps: false,
          allowFailedIntercepts: true,
          allowInvalidJs: true,
          encapsulateWorkers: true,
        },
      },
    });

    await Promise.race([
      controller.wait(),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Timed out waiting for Scramjet Controller handshake')), 10000)
      ),
    ]);

    // 6. Hydrate & protect saved website cookies so they never reset
    await protectAndHydrateCookies(controller);

    cachedController = controller;
    return controller;
  })().catch((err) => {
    initPromise = null;
    cachedController = null;
    throw err;
  });

  return initPromise;
}

function isAdOrTrackingUrl(url: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes('googleadservices') ||
      host.includes('doubleclick') ||
      host.includes('googlesyndication') ||
      host.includes('adservice.google') ||
      host.includes('tiktokv.com') ||
      host.includes('analytics.tiktok') ||
      host.includes('apps.apple.com') ||
      host.includes('play.google.com') ||
      host.includes('adnxs') ||
      host.includes('taboola') ||
      host.includes('outbrain')
    );
  } catch {
    return false;
  }
}

function resolveRealTargetUrl(rawUrl: string, baseRealUrl?: string): string | null {
  if (!rawUrl) return null;
  const unrewritten = extractUrlFromScramjetSrc(rawUrl);
  if (unrewritten) return unrewritten;
  // If rawUrl is an internal Scramjet path that failed to decode, do NOT treat it as a relative URL
  if (rawUrl.includes('/~/sj/')) return null;
  try {
    const resolved = baseRealUrl ? new URL(rawUrl, baseRealUrl) : new URL(rawUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.href;
    }
  } catch {}
  return null;
}

export async function launchInScramjetFrame(
  iframe: HTMLIFrameElement,
  targetUrl: string,
  callbacks?: ScramjetFrameCallbacks
): Promise<{ frame: Frame; proxiedSrc: string }> {
  frameCallbackMap.set(iframe, callbacks || {});
  const controller = await initScramjetProxy();

  // Ensure saved cookies are merged without resetting before navigation
  const localCookies = readLocalSavedCookies();
  if (Object.keys(localCookies).length > 0 && controller.cookieJar) {
    controller.cookieJar.load(JSON.stringify(localCookies));
  }

  let frame = frameMap.get(iframe);
  if (!frame || frame.controller !== controller) {
    frame = controller.createFrame(iframe);
    // Register Scramjet hooks via Tap.tap (Proxy properties do not expose .tap directly)
    const Tap = (window.$scramjet as any)?.Tap;
    if (Tap && typeof Tap.tap === 'function') {
      try {
        Tap.tap(frame.hooks.init.post, ({ client }: any) => {
          if (client?.context?.cookieJar) {
            protectCookieJarInstance(client.context.cookieJar);
          }

          const win = client?.global as any;
          if (!win || win.__frostCompatPatched) return;
          win.__frostCompatPatched = true;

          // Neutralize framebusting and top-level redirection (YouTube & TikTok checks like top.location = ...)
          try {
            Object.defineProperty(win, 'top', {
              get: () => win,
              configurable: true,
            });
            Object.defineProperty(win, 'parent', {
              get: () => win,
              configurable: true,
            });
            Object.defineProperty(win, 'frameElement', {
              get: () => null,
              configurable: true,
            });
          } catch {}

          // Create default Trusted Types policy to prevent YouTube and modern SPAs from crashing on HTML/Script assignments
          try {
            if (win.trustedTypes && typeof win.trustedTypes.createPolicy === 'function') {
              if (!win.trustedTypes.defaultPolicy) {
                win.trustedTypes.createPolicy('default', {
                  createHTML: (s: string) => s,
                  createScript: (s: string) => s,
                  createScriptURL: (s: string) => s,
                });
              }
            }
          } catch {}

          // 1. Prevent proxied sites (e.g. YouTube) from registering rogue Service Workers over /sj-sw.js
          try {
            const sw = win.navigator?.serviceWorker;
            if (sw) {
              const fakeReg = {
                scope: '/',
                active: { postMessage: () => {}, state: 'activated' },
                installing: null,
                waiting: null,
                update: async () => undefined,
                unregister: async () => true,
                addEventListener: () => {},
                removeEventListener: () => {},
              };
              try {
                Object.defineProperty(sw, 'register', {
                  value: async () => fakeReg,
                  configurable: true,
                });
                Object.defineProperty(sw, 'getRegistration', {
                  value: async () => fakeReg,
                  configurable: true,
                });
                Object.defineProperty(sw, 'getRegistrations', {
                  value: async () => [fakeReg],
                  configurable: true,
                });
                Object.defineProperty(sw, 'ready', {
                  value: Promise.resolve(fakeReg),
                  configurable: true,
                });
              } catch {}
            }
          } catch {}

          let lastUserInteractionTime = 0;

          // 2. Intercept window.open so popup ads don't steal user's view while watching videos
          try {
            const origOpen = typeof win.open === 'function' ? win.open.bind(win) : null;
            win.open = (url?: string | URL, target?: string, features?: string) => {
              const strUrl = url ? String(url) : '';
              if (!strUrl) return null;
              const baseHref = client?.url?.href || targetUrl;
              const realUrl = resolveRealTargetUrl(strUrl, baseHref);
              if (!realUrl) return null;

              // Block popup ad / tracking domains
              if (isAdOrTrackingUrl(realUrl)) {
                return null;
              }

              // Only allow window.open to create a new tab if user recently clicked (< 1500ms)
              const wasUserInitiated = Date.now() - lastUserInteractionTime < 1500;
              const cb = frameCallbackMap.get(iframe);
              if (wasUserInitiated && cb?.onOpenNewTab && (target === '_blank' || !target)) {
                cb.onOpenNewTab(realUrl);
                return null;
              }
              if (origOpen && wasUserInitiated) {
                return origOpen(url, target, features);
              }
              return null;
            };
          } catch {}

          // 3. Intercept genuine user clicks on <a target="_blank"> to open inside BrowserTab tabs without stealing focus
          try {
            win.document?.addEventListener(
              'click',
              (ev: MouseEvent) => {
                if (ev.isTrusted) {
                  lastUserInteractionTime = Date.now();
                }
                const el = (ev.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
                if (!el) return;
                const linkTarget = (el.getAttribute('target') || '').toLowerCase();
                const isNewTabTarget = linkTarget === '_blank' || ev.ctrlKey || ev.metaKey;
                if (!isNewTabTarget) return;

                const cb = frameCallbackMap.get(iframe);
                if (!cb?.onOpenNewTab) return;
                const rawHref = el.getAttribute('href') || el.href;
                const baseHref = client?.url?.href || targetUrl;
                const realUrl = resolveRealTargetUrl(rawHref, baseHref);
                if (!realUrl) return;

                // Block popup ad / tracking domains
                if (isAdOrTrackingUrl(realUrl)) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  return;
                }

                if (ev.isTrusted) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  cb.onOpenNewTab(realUrl);
                }
              },
              true
            );
          } catch {}

          // 4. Sync SPA navigations (YouTube watch/shorts, TikTok feeds, etc.) with BrowserTab omnibox/history
          try {
            if (client?.hooks?.lifecycle?.navigate) {
              Tap.tap(client.hooks.lifecycle.navigate, (_ev: any, details: any) => {
                const cb = frameCallbackMap.get(iframe);
                const nextUrl = resolveRealTargetUrl(details?.url || '', client?.url?.href) || client?.url?.href;
                if (nextUrl && cb?.onNavigate) {
                  window.setTimeout(() => {
                    cb.onNavigate?.(nextUrl, win.document?.title?.trim() || undefined);
                  }, 60);
                }
              });
            }
          } catch {}
        });
      } catch {}
      try {
        Tap.tap(frame.hooks.error.request, ({ rawrequest, error }: any, target: any) => {
          if (!target) return;
          target.suppressError = true;
          const isAborted = (error as any)?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('abort');
          const dest = rawrequest?.destination;

          // If request was aborted (e.g. video seek or discarded fetch), return clean 204
          if (isAborted) {
            target.setResponse = {
              body: null,
              status: 204,
              statusText: 'No Content',
              headers: [],
            };
            return;
          }

          // Only show error splash for failed top-level document navigation
          if (dest === 'document') {
            const cleanMsg = String(error?.message || error || 'Unable to load page')
              .replace(/<[^>]+>/g, '')
              .replace(/&/g, '&amp;')
              .slice(0, 150);
            target.setResponse = {
              body: `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;"><div style="max-width:460px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px;"><h2 style="margin:0 0 8px;font-size:18px;font-weight:700;">Page couldn't load</h2><p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">${cleanMsg}</p></div></body></html>`,
              status: 502,
              statusText: 'Bad Gateway',
              headers: [['content-type', 'text/html; charset=utf-8']],
            };
          } else {
            // For subresources (media chunks, beacons, analytics), return 204 No Content so player doesn't panic
            target.setResponse = {
              body: null,
              status: 204,
              statusText: 'No Content',
              headers: [],
            };
          }
        });
      } catch {}
    }
    frameMap.set(iframe, frame);
  }

  frame.go(targetUrl);
  try {
    if (iframe.contentWindow && iframe.contentWindow.location && iframe.src) {
      iframe.contentWindow.location.href = iframe.src;
    }
  } catch {}

  return {
    frame,
    proxiedSrc: iframe.src || '',
  };
}

export function getScramjetFrameForIframe(iframe: HTMLIFrameElement | null): Frame | null {
  if (!iframe) return null;
  return frameMap.get(iframe) || null;
}

/**
 * Decodes the real upstream URL from a Scramjet proxied iframe src or contentWindow URL.
 */
export function extractUrlFromScramjetSrc(rawSrc: string): string | null {
  if (!rawSrc) return null;
  try {
    // If already direct http/https and not a Scramjet path
    if ((rawSrc.startsWith('http://') || rawSrc.startsWith('https://')) && !rawSrc.includes('/~/sj/')) {
      return rawSrc;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
    const parsed = new URL(rawSrc, origin);

    // 1. Standard Scramjet format: /~/sj/<controllerId>/<encodedUrl>
    const match = parsed.pathname.match(/^\/~\/sj\/[^/]+\/(.+)$/);
    if (match && match[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          const hasSearch = decoded.includes('?');
          const hasHash = decoded.includes('#');
          const extraSearch = !hasSearch && parsed.search ? parsed.search : '';
          const extraHash = !hasHash && parsed.hash ? parsed.hash : '';
          return decoded + extraSearch + extraHash;
        }
      } catch {}
    }

    // 2. Sub-path Scramjet format: /~/sj/<controllerId>/<subpath>/<encodedUrl>
    const subMatch = parsed.pathname.match(/^\/~\/sj\/[^/]+(?:\/[^/]+)*\/(https?%3A%2F%2F.+)$/i);
    if (subMatch && subMatch[1]) {
      try {
        const decoded = decodeURIComponent(subMatch[1]);
        const hasSearch = decoded.includes('?');
        const hasHash = decoded.includes('#');
        const extraSearch = !hasSearch && parsed.search ? parsed.search : '';
        const extraHash = !hasHash && parsed.hash ? parsed.hash : '';
        return decoded + extraSearch + extraHash;
      } catch {}
    }

    // 3. Encoded URL substring match
    const rawMatch = rawSrc.match(/(https?%3A%2F%2F[^\s"'<>]+)/i);
    if (rawMatch && rawMatch[1]) {
      try {
        return decodeURIComponent(rawMatch[1]);
      } catch {}
    }

    return null;
  } catch {
    return null;
  }
}
