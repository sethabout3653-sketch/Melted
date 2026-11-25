import type { ProxyTransport } from '@mercuryworkshop/proxy-transports';
import type { Controller, Frame } from '@mercuryworkshop/scramjet-controller';
import { getClientDeviceProfile } from './browserStorageService';
import {
  enforceSafeSearchOffUrl,
  enforceSafeSearchOffCookieString,
  sanitizeSafeSearchSetCookie,
  sanitizeSafeSearchLocation,
} from '../utils/safeSearchOff';
import {
  isGoogleSearchDomain,
} from '../utils/botBypassHelper';
import { installWasmWebSocketGuard } from '../utils/wasmWsGuard';

installWasmWebSocketGuard();

function getProfileUserAgent(_profile?: string): string {
  if (typeof window !== 'undefined' && window.navigator?.userAgent) {
    const raw = window.navigator.userAgent;
    if (!raw.includes('Mobile') && !raw.includes('Android') && !raw.includes('Quest')) {
      return raw;
    }
  }
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
}

function getProfileClientHints(_profile?: string) {
  return {
    isMobile: false,
    platform: 'Windows',
    platformVersion: '15.0.0',
    model: '',
    architecture: 'x86',
    bitness: '64',
    wow64: false,
    uaFullVersion: '131.0.0.0',
    secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    secChUaFullVersionList:
      '"Google Chrome";v="131.0.0.0", "Chromium";v="131.0.0.0", "Not_A Brand";v="24.0.0.0"',
    brands: [
      { brand: 'Google Chrome', version: '131' },
      { brand: 'Chromium', version: '131' },
      { brand: 'Not_A Brand', version: '24' },
    ],
    fullVersionList: [
      { brand: 'Google Chrome', version: '131.0.0.0' },
      { brand: 'Chromium', version: '131.0.0.0' },
      { brand: 'Not_A Brand', version: '24.0.0.0' },
    ],
  };
}

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
let cachedControllerReady = false;
let controllerChangeListenerAttached = false;
let remoteSyncTimer: number | null = null;
let periodicFlushTimer: number | null = null;
let lifecycleListenersAttached = false;
const frameMap = new WeakMap<HTMLIFrameElement, Frame>();
const frameCallbackMap = new WeakMap<HTMLIFrameElement, ScramjetFrameCallbacks>();
const retiredFrames: Frame[] = [];

const AD_AND_TRACKING_URL_SUBSTRINGS = [
  'privacymanager.io',
  'marphezis.com',
  'liveramp',
  'prebid',
  'adnxs',
  'googleadservices',
  'googlesyndication',
  'doubleclick',
  'adservice.google',
  'amazon-adsystem',
  'pubmatic',
  'rubiconproject',
  'openx.net',
  'casalemedia',
  'crwdcntrl',
  'adroll',
  'smartadserver',
  'taboola',
  'outbrain',
  'scorecardresearch',
  'quantserve',
  'btloader',
  'id5-sync',
  'confiant',
  'criteo',
  'lijit',
  'sonobi',
  'bidswitch',
  'yieldmo',
  'sharethrough',
  '3lift',
  'triplelift',
  'adform',
  'googletagservices',
  'google-analytics',
  'hotjar',
  'clarity.ms',
  'statcounter',
  'adobedtm',
  'advertising.com',
  'chartbeat',
  'exponential.com',
  'infolinks',
  'tiktokv.com',
  'analytics.tiktok',
  'apps.apple.com',
  'play.google.com',
  'adserv.',
  'exoclick',
  'trafficjunky',
  'juicyads',
  'tsyndicate',
  'realsrv',
  'popads',
  'popcash',
  'propellerads',
  'adsterra',
  'erohub',
  'hilltopads',
];

export function isAdOrTrackingUrl(url: string): boolean {
  if (!url) return false;
  try {
    const lower = url.toLowerCase();
    for (const sub of AD_AND_TRACKING_URL_SUBSTRINGS) {
      if (lower.includes(sub)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function normalizeHttpOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('wss://')) {
    return 'https://' + trimmed.slice(6).replace(/\/(ws-db|wisp)\/?$/, '');
  }
  if (trimmed.startsWith('ws://')) {
    return 'http://' + trimmed.slice(5).replace(/\/(ws-db|wisp)\/?$/, '');
  }
  return `https://${trimmed}`;
}

function isStaticHostingHost(): boolean {
  if (typeof window === 'undefined') return false;
  return /\.(vercel\.app|pages\.dev|netlify\.app|github\.io)$/i.test(window.location.hostname);
}

function resolveBackendOrigins(): string[] {
  const origins: string[] = isStaticHostingHost() ? [] : [''];
  if (typeof window === 'undefined') return origins;

  const pushUnique = (val: string | null | undefined) => {
    const norm = normalizeHttpOrigin(val);
    if (!norm) return;
    if (norm === window.location.origin) return;
    if (!origins.includes(norm)) origins.push(norm);
  };

  try {
    const params = new URLSearchParams(window.location.search);
    pushUnique(params.get('server') || params.get('ws') || params.get('backend'));
    pushUnique(
      localStorage.getItem('frosthub_backend_url') ||
        localStorage.getItem('frosthub_server_url') ||
        localStorage.getItem('frosthub_ws_url')
    );
    pushUnique((import.meta as any).env?.VITE_BACKEND_URL);
  } catch {}

  return origins;
}

function getWispCandidates(): string[] {
  if (typeof window === 'undefined') return [];
  const urls: string[] = [];
  const pushWisp = (raw: string | null | undefined, forceWispSuffix = true) => {
    if (!raw) return;
    const parts = raw.split(',');
    for (const part of parts) {
      let u = part.trim();
      if (!u) continue;
      if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
      else if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
      else if (!u.startsWith('ws://') && !u.startsWith('wss://')) {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        u = `${wsProto}//${u}`;
      }
      u = u.replace(/\/ws-db\/?$/, '');
      if (forceWispSuffix) {
        u = u.replace(/\/+$/, '');
        if (!u.endsWith('/wisp')) u += '/wisp';
        u += '/';
      } else {
        if (!u.endsWith('/')) u += '/';
      }
      if (!urls.includes(u)) urls.push(u);
    }
  };

  try {
    // 1. Explicit Epoxy Server endpoint, followed by the existing Wisp overrides.
    // Set VITE_EPOXY_SERVER_URL to the public WebSocket URL exposed by epoxy-server
    // (for example: wss://your-host.example/wisp/).
    const params = new URLSearchParams(window.location.search);
    const paramEpoxyWisp = params.get('epoxyWisp');
    if (paramEpoxyWisp) pushWisp(paramEpoxyWisp, false);
    const paramWisp = params.get('wisp');
    if (paramWisp) pushWisp(paramWisp, false);

    const storedEpoxyWisp = localStorage.getItem('frosthub_epoxy_wisp_url');
    if (storedEpoxyWisp) pushWisp(storedEpoxyWisp, false);
    const storedWisp = localStorage.getItem('frosthub_wisp_url');
    if (storedWisp) pushWisp(storedWisp, false);

    const envEpoxyWisp = (import.meta as any).env?.VITE_EPOXY_SERVER_URL;
    if (envEpoxyWisp) pushWisp(envEpoxyWisp, false);
    const envWisp = (import.meta as any).env?.VITE_WISP_URL;
    if (envWisp) pushWisp(envWisp, false);

    // 2. Primary: Local or deployed Worker / Pages Wisp & epoxy-server endpoint on current host
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    pushWisp(`${wsProto}//${window.location.host}/wisp/`, false);

    // 3. Configured backend origins
    const backendOrigins = resolveBackendOrigins().filter(Boolean);
    for (const origin of backendOrigins) {
      pushWisp(origin, true);
    }

    // 4. Fallback public Wisp servers if local/worker host cannot be reached
    pushWisp('wss://themannastore.com/wisp/', false);
    pushWisp('wss://turningthepagenow.com/wisp/', false);
    pushWisp('wss://21baseballacademy.com/wisp/', false);
    pushWisp('wss://theavancehotel.com/wisp/', false);
    pushWisp('wss://diamondstudsbaseball.com/wisp/', false);
    pushWisp('wss://broughton-hotel.com/wisp/', false);
    pushWisp('wss://anura.pro/wisp/', false);
    pushWisp('wss://anura.pro/', false);
    pushWisp('wss://wisp.mercurywork.shop/wisp/', false);
    pushWisp('wss://gointospace.app/wisp/', false);
  } catch {}

  return urls;
}

let globalActiveWispUrl: string | null = null;
export function getActiveWispUrl(): string | null {
  return globalActiveWispUrl;
}

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

/**
 * Deeply and additively merges cookies from any number of sources (storage, memory, incoming payloads).
 * Guarantees that cookies are never truncated, overwritten with empty values, or wiped out.
 * Extends expiration so cookies are never dropped as expired.
 */
export function deepMergeCookies(...sources: Array<Record<string, any> | undefined | null>): Record<string, any> {
  const result: Record<string, any> = {};
  const now = Date.now();
  const minRenewalThreshold = now + 30 * 24 * 3600 * 1000;
  const extendedExpiry = now + 365 * 24 * 3600 * 1000;

  const allKeys = new Set<string>();
  for (const src of sources) {
    if (src && typeof src === 'object') {
      for (const k of Object.keys(src)) allKeys.add(k);
    }
  }

  for (const key of allKeys) {
    let bestVal: any = null;
    for (const src of sources) {
      if (src && src[key] && typeof src[key] === 'object') {
        const candidate = src[key];
        if (!bestVal) {
          bestVal = { ...candidate };
        } else {
          bestVal = { ...bestVal, ...candidate };
          if (
            typeof bestVal.value === 'string' &&
            bestVal.value.length === 0 &&
            typeof candidate.value === 'string' &&
            candidate.value.length > 0
          ) {
            bestVal.value = candidate.value;
          }
        }
      }
    }

    if (bestVal && bestVal.name && bestVal.value !== undefined) {
      if (typeof bestVal.maxAge === 'number' && bestVal.maxAge <= 0) {
        delete bestVal.maxAge;
      }
      if (bestVal.expires !== undefined) {
        const parsed =
          typeof bestVal.expires === 'string' ? Date.parse(bestVal.expires) : Number(bestVal.expires);
        bestVal.expires = Number.isFinite(parsed)
          ? parsed < minRenewalThreshold
            ? extendedExpiry
            : parsed
          : extendedExpiry;
      }
      result[key] = bestVal;
    }
  }
  return result;
}

function getCookieSnapshotKey(cookies: Record<string, any>): string {
  const keys = Object.keys(cookies || {}).sort();
  return keys
    .map((k) => {
      const c = cookies[k];
      return `${k}=${c?.value ?? ''}|${c?.domain ?? ''}|${c?.path ?? ''}`;
    })
    .join('\n');
}

function hasExpiredOrShortLivedCookie(cookies: Record<string, any>): boolean {
  const minThreshold = Date.now() + 24 * 3600 * 1000;
  for (const val of Object.values(cookies || {})) {
    if (!val || typeof val !== 'object') continue;
    if (typeof val.maxAge === 'number' && val.maxAge <= 0) return true;
    if (val.expires !== undefined) {
      const parsed = typeof val.expires === 'string' ? Date.parse(val.expires) : Number(val.expires);
      if (!Number.isFinite(parsed) || parsed < minThreshold) return true;
    }
  }
  return false;
}

export function readLocalSavedCookies(): Record<string, any> {
  try {
    return parseCookieDump(localStorage.getItem(COOKIE_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function writeLocalSavedCookies(cookies: Record<string, any>): void {
  try {
    const existing = readLocalSavedCookies();
    const merged = deepMergeCookies(existing, cookies);
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(merged));
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
            const merged = deepMergeCookies(existing, cookies);
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

export async function fetchRemoteSavedCookies(): Promise<Record<string, any>> {
  const userId = getCookieStoreUserId();
  const origins = resolveBackendOrigins();
  if (origins.length === 0) return {};

  const fetchForId = async (id: string): Promise<Record<string, any>> => {
    for (const origin of origins) {
      try {
        const res = await fetch(`${origin}/api/scramjet-cookies?userId=${encodeURIComponent(id)}`, {
          signal: AbortSignal.timeout(800),
        });
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!res.ok || !ct.includes('application/json')) continue;
        const data = await res.json();
        if (data && typeof data.cookies === 'object') {
          return parseCookieDump(data.cookies);
        }
      } catch {
        // Try next backend origin
      }
    }
    return {};
  };

  if (userId !== 'default') {
    const [defaultCookies, userCookies] = await Promise.all([fetchForId('default'), fetchForId(userId)]);
    return deepMergeCookies(defaultCookies, userCookies);
  }
  return fetchForId(userId);
}

export function pushRemoteSavedCookies(cookies: Record<string, any>, immediate = false): void {
  if (!cookies || Object.keys(cookies).length === 0) return;
  const userId = getCookieStoreUserId();
  const primaryOrigin = resolveBackendOrigins()[0] || '';

  const send = () => {
    try {
      fetch(`${primaryOrigin}/api/scramjet-cookies`, {
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
  }, 400);
}

export function flushScramjetCookies(immediateRemote = true): void {
  const controller = cachedController;
  if (!controller?.cookieJar) return;
  try {
    const inMemory = parseCookieDump(controller.cookieJar.dump());
    const localStored = readLocalSavedCookies();
    const merged = deepMergeCookies(localStored, inMemory);
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

  // Periodic background checkpoint so website sessions & updated tokens never drop on sudden tab closes
  periodicFlushTimer = window.setInterval(() => {
    const controller = cachedController;
    if (!controller?.cookieJar) return;
    try {
      const inMemory = parseCookieDump(controller.cookieJar.dump());
      const localStored = readLocalSavedCookies();
      const merged = deepMergeCookies(localStored, inMemory);
      if (getCookieSnapshotKey(merged) !== getCookieSnapshotKey(localStored)) {
        writeLocalSavedCookies(merged);
        pushRemoteSavedCookies(merged, false);
        controller.persistCookies?.().catch(() => {});
      }
    } catch {}
  }, 2500);
  void periodicFlushTimer;
}

const instanceMutateListeners = new WeakMap<object, () => void>();

export function protectCookieJarPrototype(target: any): void {
  if (!target) return;
  const candidateProto =
    target?.CookieJar?.prototype ||
    (typeof target === 'function' ? target.prototype : null) ||
    (typeof target?.clear === 'function' && typeof target?.dump === 'function'
      ? Object.getPrototypeOf(target)
      : target);

  if (!candidateProto || candidateProto === Object.prototype || candidateProto.__frostProtoProtected) return;
  candidateProto.__frostProtoProtected = true;

  // NEVER RESET COOKIES - Neutralize clear and removeById (leave unindexCookie intact so cookie updates don't duplicate entries)
  candidateProto.clear = function () {};
  candidateProto.removeById = function () {};

  const origLoad = typeof candidateProto.load === 'function' ? candidateProto.load : null;
  if (origLoad) {
    candidateProto.load = function (rawInput: any) {
      let rawJson = '';
      if (typeof rawInput === 'object' && rawInput !== null) {
        rawJson = JSON.stringify(rawInput);
      } else if (typeof rawInput === 'string') {
        rawJson = rawInput;
      }
      if (this.__frostLoading) {
        return origLoad.call(this, rawJson);
      }
      this.__frostLoading = true;
      try {
        const current = parseCookieDump(typeof this.dump === 'function' ? this.dump() : '{}');
        const stored = readLocalSavedCookies();
        const incoming = parseCookieDump(rawJson);
        const merged = deepMergeCookies(stored, current, incoming);
        if (getCookieSnapshotKey(merged) !== getCookieSnapshotKey(stored)) {
          writeLocalSavedCookies(merged);
          pushRemoteSavedCookies(merged, false);
        }
        return origLoad.call(this, JSON.stringify(merged));
      } finally {
        this.__frostLoading = false;
      }
    };
  }

  const origSetCookies = typeof candidateProto.setCookies === 'function' ? candidateProto.setCookies : null;
  if (origSetCookies) {
    candidateProto.setCookies = function (...args: any[]) {
      const before = parseCookieDump(typeof this.dump === 'function' ? this.dump() : '{}');
      const res = origSetCookies.apply(this, args);
      try {
        const after = parseCookieDump(typeof this.dump === 'function' ? this.dump() : '{}');
        const stored = readLocalSavedCookies();
        const merged = deepMergeCookies(stored, before, after);

        // If site sent an expired date, maxAge<=0, or blank deletion value, immediately restore the preserved cookie in-memory
        if (
          origLoad &&
          !this.__frostLoading &&
          (getCookieSnapshotKey(merged) !== getCookieSnapshotKey(after) || hasExpiredOrShortLivedCookie(after))
        ) {
          this.__frostLoading = true;
          try {
            origLoad.call(this, JSON.stringify(merged));
          } finally {
            this.__frostLoading = false;
          }
        }

        writeLocalSavedCookies(merged);
        pushRemoteSavedCookies(merged, false);

        // Cross-sync iframe cookie updates back into main controller jar so reloads & new tabs have them immediately
        const mainJar = (cachedController as any)?.cookieJar;
        if (mainJar && mainJar !== this && !this.__frostSyncing && !mainJar.__frostSyncing) {
          this.__frostSyncing = true;
          mainJar.__frostSyncing = true;
          try {
            if (typeof mainJar.load === 'function') {
              mainJar.load(JSON.stringify(merged));
            }
            cachedController?.persistCookies?.().catch(() => {});
          } finally {
            this.__frostSyncing = false;
            mainJar.__frostSyncing = false;
          }
        }

        instanceMutateListeners.get(this)?.();
      } catch {}
      return res;
    };
  }
}

export function protectCookieJarInstance(jar: any, onMutate?: () => void): void {
  if (!jar) return;
  if (onMutate) {
    instanceMutateListeners.set(jar, onMutate);
  }
  protectCookieJarPrototype(jar);
  if (jar.__frostProtected) return;
  jar.__frostProtected = true;

  // Ensure direct own-property overrides also exist in case prototype calls are bypassed
  const proto = Object.getPrototypeOf(jar);
  if (proto?.__frostProtoProtected) {
    // Prototype already wraps clear, removeById, load, setCookies cleanly
    return;
  }

  jar.clear = () => {};
  jar.removeById = () => {};

  const origLoad = typeof jar.load === 'function' ? jar.load.bind(jar) : null;
  if (origLoad) {
    jar.load = (rawInput: any) => {
      let rawJson = '';
      if (typeof rawInput === 'object' && rawInput !== null) {
        rawJson = JSON.stringify(rawInput);
      } else if (typeof rawInput === 'string') {
        rawJson = rawInput;
      }
      const current = parseCookieDump(typeof jar.dump === 'function' ? jar.dump() : '{}');
      const stored = readLocalSavedCookies();
      const incoming = parseCookieDump(rawJson);
      const merged = deepMergeCookies(stored, current, incoming);
      writeLocalSavedCookies(merged);
      pushRemoteSavedCookies(merged, false);
      return origLoad(JSON.stringify(merged));
    };
  }

  const origSetCookies = typeof jar.setCookies === 'function' ? jar.setCookies.bind(jar) : null;
  if (origSetCookies) {
    jar.setCookies = (...args: any[]) => {
      const before = parseCookieDump(jar.dump());
      const res = origSetCookies(...args);
      try {
        const after = parseCookieDump(jar.dump());
        const stored = readLocalSavedCookies();
        const merged = deepMergeCookies(stored, before, after);
        if (origLoad && (getCookieSnapshotKey(merged) !== getCookieSnapshotKey(after) || hasExpiredOrShortLivedCookie(after))) {
          origLoad(JSON.stringify(merged));
        }
        writeLocalSavedCookies(merged);
        pushRemoteSavedCookies(merged, false);
        instanceMutateListeners.get(jar)?.();
      } catch {}
      return res;
    };
  }
}

async function protectAndHydrateCookies(controller: Controller): Promise<void> {
  const jar = controller.cookieJar;
  if (!jar) return;

  attachCookieLifecycleListeners();
  protectCookieJarPrototype((window as any).$scramjet);
  protectCookieJarInstance(jar, () => {
    controller.persistCookies?.().catch(() => {});
  });

  // Merge cookies across remote store, localStorage, IndexedDB, and live jar
  const [remoteCookies, idbCookies] = await Promise.all([
    fetchRemoteSavedCookies(),
    readControllerIdbCookies(),
  ]);
  const localCookies = readLocalSavedCookies();
  const jarCookies = parseCookieDump(jar.dump());
  const merged = deepMergeCookies(remoteCookies, idbCookies, localCookies, jarCookies);

  if (Object.keys(merged).length > 0) {
    const mergedJson = JSON.stringify(merged);
    jar.load(mergedJson);
    writeLocalSavedCookies(merged);
    await seedControllerIdbCookies(merged);
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
        const combined = deepMergeCookies(stored, current);
        if (getCookieSnapshotKey(combined) !== getCookieSnapshotKey(current) || hasExpiredOrShortLivedCookie(current)) {
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

  const attemptLoad = (url: string) =>
    new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = false;
      script.onload = () => {
        if (globalCheck()) {
          resolve();
        } else {
          reject(new Error(`Script loaded but runtime global missing: ${url}`));
        }
      };
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });

  return (async () => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (globalCheck()) return;
      try {
        await new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(() => reject(new Error(`Timed out loading ${src}`)), 6000);
          existing.addEventListener(
            'load',
            () => {
              window.clearTimeout(t);
              resolve();
            },
            { once: true }
          );
          existing.addEventListener(
            'error',
            () => {
              window.clearTimeout(t);
              reject(new Error(`Failed to load script: ${src}`));
            },
            { once: true }
          );
        });
        if (globalCheck()) return;
      } catch {}
      existing.remove();
    }

    try {
      await attemptLoad(src);
    } catch {
      const bust = `${src}${src.includes('?') ? '&' : '?'}v=${Date.now()}`;
      await attemptLoad(bust);
    }
  })();
}

async function ensureValidScramjetWasm(): Promise<void> {
  const isValidWasm = (buf: ArrayBuffer) => {
    if (buf.byteLength < 8) return false;
    const u8 = new Uint8Array(buf, 0, 4);
    return u8[0] === 0x00 && u8[1] === 0x61 && u8[2] === 0x73 && u8[3] === 0x6d;
  };

  let res = await fetch('/scramjet/scramjet.wasm');
  let buf = res.ok ? await res.arrayBuffer() : new ArrayBuffer(0);
  if (!isValidWasm(buf)) {
    res = await fetch(`/scramjet/scramjet.wasm?v=${Date.now()}`, { cache: 'reload' });
    buf = res.ok ? await res.arrayBuffer() : new ArrayBuffer(0);
  }
  if (!isValidWasm(buf)) {
    throw new Error('Failed to load valid Scramjet WASM binary');
  }
  try {
    (window.$scramjet as any)?.setWasm?.(buf);
  } catch {}
}

async function cleanupLegacyServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.race([
      Promise.all(
        regs.map(async (reg) => {
          const scriptUrl =
            reg.active?.scriptURL ||
            reg.waiting?.scriptURL ||
            reg.installing?.scriptURL ||
            '';
          if (scriptUrl && !scriptUrl.includes('/sj-sw.js')) {
            await reg.unregister().catch(() => {});
          }
        })
      ),
      new Promise<void>((r) => window.setTimeout(r, 1500)),
    ]);
  } catch {}
}

async function waitForServiceWorkerActive(registration: ServiceWorkerRegistration): Promise<ServiceWorker> {
  // Always prefer an incoming installing/waiting worker over an outgoing active one (since skipWaiting swaps them)
  const waitWorkerActivated = (worker: ServiceWorker) =>
    new Promise<ServiceWorker>((resolve, reject) => {
      if (worker.state === 'activated') {
        resolve(worker);
        return;
      }
      if (worker.state === 'redundant') {
        reject(new Error('redundant'));
        return;
      }

      const timeout = window.setTimeout(() => {
        worker.removeEventListener('statechange', onStateChange);
        reject(new Error('Timed out waiting for Scramjet Service Worker activation'));
      }, 9000);

      const onStateChange = () => {
        if (worker.state === 'activated') {
          window.clearTimeout(timeout);
          worker.removeEventListener('statechange', onStateChange);
          resolve(worker);
        } else if (worker.state === 'redundant') {
          window.clearTimeout(timeout);
          worker.removeEventListener('statechange', onStateChange);
          reject(new Error('redundant'));
        }
      };

      worker.addEventListener('statechange', onStateChange);
    });

  let activeWorker: ServiceWorker | null = null;
  const incoming = registration.installing || registration.waiting;
  if (incoming) {
    try {
      activeWorker = await waitWorkerActivated(incoming);
    } catch {
      activeWorker = registration.active || null;
    }
  } else if (registration.active && registration.active.state === 'activated') {
    activeWorker = registration.active;
  }

  if (!activeWorker) {
    const candidate = registration.installing || registration.waiting || registration.active;
    if (candidate) {
      try {
        activeWorker = await waitWorkerActivated(candidate);
      } catch {
        activeWorker = registration.active || null;
      }
    }
  }

  if (!activeWorker) {
    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error('Scramjet Service Worker ready timeout')), 9000)
      ),
    ]);
    activeWorker = readyReg.active;
  }

  if (!activeWorker) {
    throw new Error('Scramjet Service Worker failed to activate');
  }

  // Ensure activeWorker claims this page immediately if not already controlling
  if (!navigator.serviceWorker.controller) {
    try {
      activeWorker.postMessage({ $sj$claim: true });
    } catch {}
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        window.clearInterval(poll);
        window.clearTimeout(timer);
        resolve();
      };
      const onChange = () => {
        if (navigator.serviceWorker.controller) finish();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onChange);
      const poll = window.setInterval(() => {
        if (navigator.serviceWorker.controller) finish();
      }, 40);
      const timer = window.setTimeout(finish, 3200);
    });
  }

  // Verify the service worker actually intercepts fetch calls on this window before loading /~/sj/
  const pingDeadline = Date.now() + 3500;
  while (Date.now() < pingDeadline) {
    try {
      const pingRes = await fetch('/__sj_ping__', { cache: 'no-store' });
      if (pingRes.headers.get('x-sj-sw') === '1') {
        break;
      }
    } catch {}
    try {
      (navigator.serviceWorker.controller || registration.active || activeWorker).postMessage({ $sj$claim: true });
    } catch {}
    await new Promise((r) => window.setTimeout(r, 100));
  }

  return navigator.serviceWorker.controller || registration.active || activeWorker;
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

let cachedStickySessionId: string | null = null;
function getStickyProxySessionId(): string {
  if (cachedStickySessionId) return cachedStickySessionId;
  try {
    const existing = sessionStorage.getItem('sj_sticky_session_v1');
    if (existing) {
      cachedStickySessionId = existing;
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        : `sj${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('sj_sticky_session_v1', generated);
    cachedStickySessionId = generated;
    return generated;
  } catch {
    cachedStickySessionId = `sj${Date.now().toString(36)}`;
    return cachedStickySessionId;
  }
}

function sanitizeTransportHeaders(
  headers: RawHeaderPair[] | Headers | Record<string, string> | undefined,
  method: string,
  targetOrigin?: string
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
  let secFetchMode = '';
  for (const pair of rawPairs) {
    if (pair && pair.length >= 2 && String(pair[0] ?? '').trim().toLowerCase() === 'sec-fetch-mode') {
      secFetchMode = String(pair[1] ?? '').trim().toLowerCase();
      break;
    }
  }
  const map = new Map<string, string>();
  const cookies: string[] = [];
  const proxyOrigin = typeof window !== 'undefined' ? window.location.origin.toLowerCase() : '';
  const proxyHostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';

  for (const pair of rawPairs) {
    if (!pair || pair.length < 2) continue;
    const key = String(pair[0] ?? '')
      .replace(/[\r\n\0:\s]+/g, '')
      .toLowerCase();
    if (
      !key ||
      FORBIDDEN_H2_HEADERS.has(key) ||
      key === 'youtube-restrict' ||
      key === 'x-youtube-restrict' ||
      key === 'x-safesearch' ||
      key === 'x-safe-search' ||
      key === 'x-googapps-allowed-domains' ||
      key === 'x-prefer'
    ) continue;
    if (isBodylessMethod && key === 'content-length') continue;
    // Browsers never send Origin on no-cors / navigate GETs (<link rel="stylesheet">, <script>, <img>);
    // Scramjet injects it unconditionally, which triggers Cloudflare gzip/Vary corruption on some CDNs.
    if (isBodylessMethod && key === 'origin' && secFetchMode !== 'cors') continue;

    let val = String(pair[1] ?? '').replace(/[\r\n\0]+/g, ' ').trim();
    if ((key === 'prefer' || key === 'x-prefer') && val.toLowerCase().includes('safe')) continue;
    if (key === 'te' && val.toLowerCase() !== 'trailers') continue;
    if (key === 'accept-encoding') {
      const cleaned = val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !s.toLowerCase().startsWith('zstd'))
        .join(', ');
      val = cleaned || 'gzip, deflate, br';
    }

    // Prevent leaking Cloud Run / Pages / localhost proxy Origin or Referer to upstream servers
    if ((key === 'origin' || key === 'referer') && val && targetOrigin) {
      const lowerVal = val.toLowerCase();
      if ((proxyOrigin && lowerVal.startsWith(proxyOrigin)) || (proxyHostname && lowerVal.includes(proxyHostname))) {
        val = key === 'origin' ? targetOrigin : `${targetOrigin}/`;
      }
    }

    if (key === 'cookie') {
      if (val) cookies.push(val);
    } else {
      map.set(key, val);
    }
  }

  // Force US-English language preference unconditionally so any website renders in English, not Japanese or Chinese
  map.set('accept-language', 'en-US,en;q=0.9');

  // Enforce Desktop / configured client profile with standard low-entropy Client Hints
  // (avoid sending unrequested high-entropy sec-ch-ua-* hints on every request, which flags bot detectors)
  const profile = getClientDeviceProfile();
  const profileUa = getProfileUserAgent(profile);
  const hints = getProfileClientHints(profile);
  map.set('user-agent', profileUa);
  map.set('sec-ch-ua', hints.secChUa);
  map.set('sec-ch-ua-mobile', hints.isMobile ? '?1' : '?0');
  map.set('sec-ch-ua-platform', `"${hints.platform}"`);
  if (!hints.isMobile) {
    map.delete('sec-ch-ua-model');
    map.delete('sec-ch-ua-platform-version');
    map.delete('sec-ch-ua-arch');
    map.delete('sec-ch-ua-bitness');
    map.delete('sec-ch-ua-wow64');
    map.delete('sec-ch-ua-full-version');
    map.delete('sec-ch-ua-full-version-list');
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

async function decodeProxyFetchResponse(res: Response): Promise<{
  body: ArrayBuffer | null;
  headers: RawHeaderPair[];
  status: number;
  statusText: string;
} | null> {
  const metaHeader = res.headers.get('X-SJ-Meta');
  const metaInBody = res.headers.get('X-SJ-Meta-In-Body') === '1';

  if (metaHeader) {
    const meta = JSON.parse(fromBase64Utf8(metaHeader)) as {
      status: number;
      statusText: string;
      headers: RawHeaderPair[];
    };
    const status = Number(meta.status) || 200;
    const isNullBodyStatus = status === 101 || status === 204 || status === 205 || status === 304;
    const buf = isNullBodyStatus ? null : await res.arrayBuffer();
    return {
      body: buf,
      headers: Array.isArray(meta.headers) ? meta.headers : [],
      status,
      statusText: String(meta.statusText || ''),
    };
  }

  if (metaInBody) {
    const fullBuf = await res.arrayBuffer();
    if (fullBuf.byteLength < 4) return null;
    const view = new DataView(fullBuf);
    const metaLen = view.getUint32(0, false);
    if (metaLen <= 0 || 4 + metaLen > fullBuf.byteLength) return null;
    const metaBytes = new Uint8Array(fullBuf, 4, metaLen);
    const meta = JSON.parse(new TextDecoder().decode(metaBytes)) as {
      status: number;
      statusText: string;
      headers: RawHeaderPair[];
    };
    const status = Number(meta.status) || 200;
    const isNullBodyStatus = status === 101 || status === 204 || status === 205 || status === 304;
    const bodyBuf = isNullBodyStatus ? null : fullBuf.slice(4 + metaLen);
    return {
      body: bodyBuf,
      headers: Array.isArray(meta.headers) ? meta.headers : [],
      status,
      statusText: String(meta.statusText || ''),
    };
  }

  return null;
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
  reqHeaders.set('X-SJ-Session', getStickyProxySessionId());

  const origins = resolveBackendOrigins();
  const isDocReq = headers.some(
    ([k, v]) =>
      (k.toLowerCase() === 'sec-fetch-dest' && v.toLowerCase() === 'document') ||
      (k.toLowerCase() === 'accept' && v.includes('text/html'))
  );
  const isYoutube = isYoutubeMediaHost(remote.hostname);
  const isYoutubeVideoChunk =
    remote.hostname.toLowerCase() === 'googlevideo.com' ||
    remote.hostname.toLowerCase().endsWith('.googlevideo.com');
  // YouTube requests should fail over promptly instead of leaving the player spinner active forever.
  // Video chunks get a longer window because they can be larger than player/API responses.
  const requestTimeoutMs = isYoutubeVideoChunk ? 30000 : isYoutube ? 18000 : 20000;
  const retryDelays = isYoutube
    ? [250]
    : isDocReq
      ? [300, 800]
      : [250, 700];
  let lastErrorMsg = 'Proxy request failed';

  for (let originIdx = 0; originIdx < origins.length; originIdx++) {
    const endpoint = `${origins[originIdx]}/api/scramjet-fetch`;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const requestController = new AbortController();
      const relayOuterAbort = () => {
        try {
          requestController.abort(signal?.reason || new DOMException('Aborted', 'AbortError'));
        } catch {}
      };
      if (signal?.aborted) {
        relayOuterAbort();
      } else {
        signal?.addEventListener('abort', relayOuterAbort, { once: true });
      }
      const requestTimeout = window.setTimeout(() => {
        try {
          requestController.abort(
            new DOMException(`Proxy request timed out after ${requestTimeoutMs}ms`, 'TimeoutError')
          );
        } catch {}
      }, requestTimeoutMs);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: reqHeaders,
          body: body as BodyInit | null,
          signal: requestController.signal,
        });

        if (res.ok) {
          const decoded = await decodeProxyFetchResponse(res);
          if (decoded) {
            return decoded as any;
          }
        }

        // If endpoint returned 404/405 or HTML without X-SJ-Meta, switch to next backend origin immediately
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const rawBodyText = await res.text().catch(() => '');
        const isHtmlResponse =
          contentType.includes('text/html') || rawBodyText.trimStart().startsWith('<');
        const isWarmupSplash = rawBodyText.includes('Starting Server');

        if ((res.status === 404 || res.status === 405 || (res.ok && isHtmlResponse && !isWarmupSplash)) && originIdx < origins.length - 1) {
          lastErrorMsg = `Endpoint unavailable on origin (${res.status})`;
          break;
        }

        if (isHtmlResponse) {
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
          (isWarmupSplash || isHtmlResponse || res.status === 502 || res.status === 503 || res.status === 504);

        if (!shouldRetry) {
          break;
        }
      } catch (err: any) {
        // Only the caller's abort should cancel the entire proxy operation. Our own timeout
        // is recoverable: continue to the next retry/origin/transport instead of hanging.
        if (signal?.aborted) {
          throw err;
        }
        lastErrorMsg = String(err?.message || 'Network error').replace(/<[^>]+>/g, ' ').slice(0, 150);
        if (attempt >= retryDelays.length) {
          break;
        }
      } finally {
        window.clearTimeout(requestTimeout);
        signal?.removeEventListener('abort', relayOuterAbort);
      }

      await new Promise((r) => window.setTimeout(r, retryDelays[attempt]));
    }
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
    msg.includes('stream') ||
    msg.includes('invaliddata') ||
    msg.includes('invalid gzip') ||
    msg.includes('gzip') ||
    msg.includes('deflate') ||
    msg.includes('brotli') ||
    msg.includes('decompress')
  );
}

const KNOWN_HTTP2_INCOMPATIBLE_HOSTS = new Set([
  'duckduckgo.com',
  'www.duckduckgo.com',
  'links.duckduckgo.com',
  'icons.duckduckgo.com',
  'imgg.duckduckgo.com',
  'external-content.duckduckgo.com',
  'html.duckduckgo.com',
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
  if (
    h.includes('duckduckgo') ||
    h.includes('tiktok') ||
    h.includes('byteoversea') ||
    h.includes('ibytedtos') ||
    h.includes('ttwstatic')
  ) {
    return true;
  }
  for (const known of KNOWN_HTTP2_INCOMPATIBLE_HOSTS) {
    if (h === known || h.endsWith('.' + known)) {
      return true;
    }
  }
  return false;
}

function isYoutubeMediaHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'youtube.com' ||
    h.endsWith('.youtube.com') ||
    h === 'googlevideo.com' ||
    h.endsWith('.googlevideo.com') ||
    h === 'ytimg.com' ||
    h.endsWith('.ytimg.com') ||
    h === 'ggpht.com' ||
    h.endsWith('.ggpht.com')
  );
}

const LIBCURL_PREFERRED_HOSTS = new Set([
  'duckduckgo.com',
  'www.duckduckgo.com',
  'links.duckduckgo.com',
  'icons.duckduckgo.com',
  'imgg.duckduckgo.com',
  'external-content.duckduckgo.com',
  'html.duckduckgo.com',
  'tiktok.com',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'tiktokcdn-eu.com',
  'byteoversea.com',
  'ibytedtos.com',
  'ttwstatic.com',
  'ibyteimg.com',
  'muscdn.com',
  'twitch.tv',
  'ttvnw.net',
  'jtvnw.net',
  'discord.com',
  'discordapp.com',
  'github.com',
  'spotify.com',
  'scdn.co',
  'netflix.com',
  'nflxvideo.net',
  'vimeo.com',
  'vimeocdn.com',
]);

function isLibcurlPreferredHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.includes('duckduckgo') || h.includes('tiktok')) {
    return true;
  }
  for (const known of LIBCURL_PREFERRED_HOSTS) {
    if (h === known || h.endsWith('.' + known)) {
      return true;
    }
  }
  return false;
}

function getLocalWispUrl(): string {
  const candidates = getWispCandidates();
  if (candidates.length > 0) return candidates[0];
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${window.location.host}/wisp/`;
}

async function probeWispEndpoint(url: string, timeoutMs = 2500): Promise<boolean> {
  if (typeof WebSocket === 'undefined') return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let ws: WebSocket | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch {}
      }
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      ws.onmessage = (e) => {
        // Real Wisp servers send a Wisp CONTINUE (0x03) or INFO (0x05) greeting
        if (e.data instanceof ArrayBuffer && e.data.byteLength > 0) {
          const u8 = new Uint8Array(e.data);
          if (u8[0] === 0x03 || u8[0] === 0x05) {
            finish(true);
            return;
          }
        }
        finish(true);
      };
      ws.onopen = () => {
        // If it opened and didn't immediately error, give 250ms for Wisp greeting
        window.setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            finish(true);
          }
        }, 250);
      };
      ws.onerror = () => finish(false);
      ws.onclose = () => finish(false);
    } catch {
      finish(false);
    }
  });
}

function withPromiseTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function ensureNullBodyConsistency<T extends { status: number; body: any }>(res: T): T {
  if (res && (res.status === 101 || res.status === 204 || res.status === 205 || res.status === 304)) {
    return { ...res, body: null };
  }
  return res;
}

async function readTransportBodyBytes(body: any): Promise<Uint8Array | null> {
  if (!body) return null;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof body === 'string') {
    return new TextEncoder().encode(body);
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
  return null;
}

function normalizeGoogleRemoteUrl(remoteUrl: URL): URL {
  return enforceSafeSearchOffUrl(remoteUrl);
}



async function probeWispCandidatesParallel(candidates: string[], timeoutMs = 2000): Promise<string[]> {
  if (candidates.length === 0) return [];
  // Probe in parallel but preserve strict priority order of `candidates` so local US /wisp/ always beats foreign public servers
  const okFlags = await Promise.all(candidates.map((c) => probeWispEndpoint(c, timeoutMs)));
  return candidates.filter((_, idx) => okFlags[idx]);
}

const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'transfer-encoding',
  'content-length',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'origin-agent-cluster',
  'clear-site-data',
]);

function cleanDecompressedHeaders(headers: RawHeaderPair[] | undefined): RawHeaderPair[] {
  if (!Array.isArray(headers)) return [];
  return headers.filter(([k]: RawHeaderPair) => {
    const l = String(k).toLowerCase().trim();
    return !STRIPPED_RESPONSE_HEADERS.has(l);
  });
}

function getHeaderValue(headers: RawHeaderPair[] | undefined, name: string): string {
  if (!Array.isArray(headers)) return '';
  const target = name.toLowerCase();
  for (const [k, v] of headers) {
    if (String(k).toLowerCase().trim() === target) {
      return String(v || '');
    }
  }
  return '';
}

function fixQuirkyHtmlString(text: string, isDocument: boolean): string {
  let out = text;

  // 1. Undertale / similar exports: stray <body oncontextmenu="return false;"> placed inside <head>
  if (out.includes('<head>') && /<body\s+oncontextmenu\s*=\s*"return false;"\s*>/i.test(out)) {
    out = out.replace(/<head>(\s*<base[^>]*>)\s*<body\s+oncontextmenu\s*=\s*"return false;"\s*>/i, '<head>$1');
  }

  const lower = out.toLowerCase();
  const hasHtmlClose = lower.lastIndexOf('</html>');
  if (hasHtmlClose !== -1) {
    // 2. Trailing tags after </html> (e.g. DuckDuckGo trailing <script>DDG.index = ...</script>)
    // Scramjet's htmlparser2 checks root childNodes and logs "detected quirky document structure parsing"
    // if anything other than whitespace/comments exists outside <html>.
    const trailing = out.slice(hasHtmlClose + 7);
    const trailingWithoutComments = trailing.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (trailingWithoutComments.length > 0 && trailingWithoutComments.includes('<')) {
      out = out.slice(0, hasHtmlClose + 7);
      const bodyCloseIdx = out.toLowerCase().lastIndexOf('</body>');
      if (bodyCloseIdx !== -1) {
        out = out.slice(0, bodyCloseIdx) + trailingWithoutComments + out.slice(bodyCloseIdx);
      } else {
        const htmlCloseIdx = out.toLowerCase().lastIndexOf('</html>');
        out = out.slice(0, htmlCloseIdx) + trailingWithoutComments + out.slice(htmlCloseIdx);
      }
    }

    // 3. Move any stray tags placed between </head> and <body...> inside </head>
    const lowerAfter = out.toLowerCase();
    const headCloseIdx = lowerAfter.indexOf('</head>');
    const bodyOpenIdx = lowerAfter.indexOf('<body');
    if (headCloseIdx !== -1 && bodyOpenIdx !== -1 && bodyOpenIdx > headCloseIdx + 7) {
      const between = out.slice(headCloseIdx + 7, bodyOpenIdx);
      const betweenNonComments = between.replace(/<!--[\s\S]*?-->/g, '').trim();
      if (betweenNonComments.length > 0 && betweenNonComments.includes('<')) {
        out =
          out.slice(0, headCloseIdx) +
          between +
          out.slice(headCloseIdx, headCloseIdx + 7) +
          out.slice(bodyOpenIdx);
      }
    }

    // 4. Move any leading stray tags before <html> (excluding doctype/xml/comments) inside <body> or <head>
    const htmlOpenIdx = out.toLowerCase().indexOf('<html');
    if (htmlOpenIdx > 0) {
      const prefix = out.slice(0, htmlOpenIdx);
      const cleanedPrefix = prefix
        .replace(/<!doctype[^>]*>/gi, '')
        .replace(/<\?xml[^>]*\?>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
      if (cleanedPrefix.length > 0 && cleanedPrefix.includes('<')) {
        const doctypeMatch = prefix.match(/<!doctype[^>]*>/i);
        const keptPrefix = doctypeMatch ? `${doctypeMatch[0]}\n` : '';
        out = keptPrefix + out.slice(htmlOpenIdx);
        const targetBodyIdx = out.toLowerCase().search(/<body[^>]*>/i);
        if (targetBodyIdx !== -1) {
          const bodyTagEnd = out.indexOf('>', targetBodyIdx);
          if (bodyTagEnd !== -1) {
            out = out.slice(0, bodyTagEnd + 1) + cleanedPrefix + out.slice(bodyTagEnd + 1);
          }
        }
      }
    }
  } else if (
    isDocument &&
    !lower.includes('<html') &&
    !lower.includes('<svg') &&
    !lower.includes('<?xml') &&
    /<(div|p|span|script|style|h[1-6]|body|head|meta|title|form|a|img|ul|table|center|pre|section|main)\b/i.test(out)
  ) {
    out = `<!DOCTYPE html><html><head></head><body>${out}</body></html>`;
  }

  return out;
}

async function normalizeQuirkyHtml(
  _remote: URL,
  body: any,
  headers?: RawHeaderPair[],
  isDocument = false
): Promise<any> {
  if (!body) return body;
  const ct = getHeaderValue(headers, 'content-type').toLowerCase();
  const explicitlyNonHtml =
    ct &&
    !ct.includes('text/html') &&
    !ct.includes('application/xhtml+xml');
  if (explicitlyNonHtml) {
    return body;
  }
  if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml') && !isDocument) {
    return body;
  }

  const bytes = await readTransportBodyBytes(body);
  if (!bytes) return body;
  if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  const text = new TextDecoder().decode(bytes);
  const fixed = fixQuirkyHtmlString(text, isDocument);
  if (fixed !== text) {
    return new TextEncoder().encode(fixed).buffer;
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function createWispTransport(): Promise<ProxyTransport> {
  const wispCandidates = getWispCandidates();
  let workingWispUrls = wispCandidates.length > 0 ? [...wispCandidates] : [];
  let candidateIndex = 0;
  let activeWispUrl: string | null = workingWispUrls[0] || null;

  globalActiveWispUrl = activeWispUrl;

  // Refine candidate order in background without blocking initial page render
  if (wispCandidates.length > 1) {
    probeWispCandidatesParallel(wispCandidates, 2000).then((liveCandidates) => {
      if (liveCandidates && liveCandidates.length > 0) {
        workingWispUrls = liveCandidates;
        if (!activeWispUrl || !liveCandidates.includes(activeWispUrl)) {
          activeWispUrl = liveCandidates[0];
          globalActiveWispUrl = activeWispUrl;
        }
      }
    }).catch(() => {});
  }

  const epoxyClients = new Map<string, any>();
  const epoxyInitPromises = new Map<string, Promise<any>>();
  const libcurlClients = new Map<string, any>();
  const libcurlInitPromises = new Map<string, Promise<any>>();

  const retireEpoxyClient = (wispUrl: string, target?: any) => {
    const current = epoxyClients.get(wispUrl);
    if (!target || current === target) {
      epoxyClients.delete(wispUrl);
      epoxyInitPromises.delete(wispUrl);
    }
  };

  const rotateToNextWisp = () => {
    if (workingWispUrls.length <= 1) return activeWispUrl;
    candidateIndex = (candidateIndex + 1) % workingWispUrls.length;
    activeWispUrl = workingWispUrls[candidateIndex];
    globalActiveWispUrl = activeWispUrl;
    return activeWispUrl;
  };

  const getEpoxy = async (wispUrl: string): Promise<any> => {
    if (epoxyClients.has(wispUrl)) return epoxyClients.get(wispUrl);
    let initP = epoxyInitPromises.get(wispUrl);
    if (!initP) {
      initP = (async () => {
        installWasmWebSocketGuard();
        const { default: EpoxyTransport } = await import('@mercuryworkshop/epoxy-transport');
        const epoxy = new (EpoxyTransport as any)({
          wisp: wispUrl,
          wisp_v2: true,
        });
        await withPromiseTimeout(epoxy.init(), 10000, `Epoxy init (${wispUrl})`);
        const origReq = epoxy.request.bind(epoxy);
        epoxy.request = async (...reqArgs: any[]) => {
          try {
            return await origReq(...reqArgs);
          } catch (err: any) {
            const msg = String(err?.message || err || '').toLowerCase();
            if (
              msg.includes('goaway') ||
              msg.includes('http2') ||
              msg.includes('hyper client') ||
              msg.includes('sendrequest') ||
              msg.includes('wisp') ||
              msg.includes('websocket') ||
              msg.includes('closure') ||
              msg.includes('dropped') ||
              msg.includes('eof') ||
              msg.includes('closed')
            ) {
              retireEpoxyClient(wispUrl, epoxy);
            }
            throw err;
          }
        };
        epoxyClients.set(wispUrl, epoxy);
        return epoxy;
      })();
      epoxyInitPromises.set(wispUrl, initP);
    }
    try {
      return await initP;
    } catch (err) {
      epoxyInitPromises.delete(wispUrl);
      epoxyClients.delete(wispUrl);
      throw err;
    }
  };

  const getLibcurl = async (wispUrl: string): Promise<any> => {
    if (libcurlClients.has(wispUrl)) return libcurlClients.get(wispUrl);
    let initP = libcurlInitPromises.get(wispUrl);
    if (!initP) {
      initP = (async () => {
        const { default: LibcurlClient } = await import('@mercuryworkshop/libcurl-transport');
        const libcurl = new LibcurlClient({
          wisp: wispUrl,
          connections: [16, 12, 8, 4],
        });
        await withPromiseTimeout(libcurl.init(), 6000, `Libcurl init (${wispUrl})`);
        libcurlClients.set(wispUrl, libcurl);
        return libcurl;
      })();
      libcurlInitPromises.set(wispUrl, initP);
    }
    try {
      return await initP;
    } catch (err) {
      libcurlInitPromises.delete(wispUrl);
      libcurlClients.delete(wispUrl);
      throw err;
    }
  };

  // Pre-warm primary Wisp transport in background
  if (activeWispUrl) {
    getEpoxy(activeWispUrl).catch(() => {
      getLibcurl(activeWispUrl!).catch(() => {});
    });
  }

  const resilientTransport: ProxyTransport = {
    ready: true,
    async init() {
      this.ready = true;
    },
    async request(remote, method, body, headers, signal) {
      const targetRemote = normalizeGoogleRemoteUrl(new URL(remote.href));
      // 0. Neutralize ad, tracking, and telemetry networks immediately without network overhead
      if (isAdOrTrackingUrl(targetRemote.href)) {
        return {
          body: null,
          status: 204,
          statusText: 'No Content',
          headers: [['content-type', 'text/plain; charset=utf-8']],
        };
      }

      const cleanHeaders = sanitizeTransportHeaders(headers as any, method, targetRemote.origin);
      const safeBody = await normalizeRequestBody(method, body);
      const targetHost = targetRemote.hostname.toLowerCase();
      const targetPath = targetRemote.pathname.toLowerCase();
      const isGoogle =
        targetHost === 'google.com' ||
        targetHost.endsWith('.google.com') ||
        /^(www\.)?google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(targetHost);
      const isDocument = cleanHeaders.some(
        ([k, v]) =>
          (k.toLowerCase() === 'sec-fetch-dest' && v.toLowerCase() === 'document') ||
          (k.toLowerCase() === 'accept' && v.includes('text/html'))
      );

      // Immediately resolve search/social redirect wrappers (e.g. duckduckgo.com/l/?uddg=..., bing.com/ck/a)
      // so navigations never stall on interstitial link pages that fail JS/meta redirects
      if (isDocument) {
        const unwrappedNav = unwrapRedirectWrapperUrl(targetRemote.href);
        if (unwrappedNav) {
          let cleanRedirectTarget = unwrappedNav;
          try {
            cleanRedirectTarget = enforceSafeSearchOffUrl(new URL(unwrappedNav)).href;
          } catch {}
          return {
            body: null,
            status: 302,
            statusText: 'Found',
            headers: [['location', cleanRedirectTarget]],
          };
        }
      }

      // Inject stored cookies into outgoing request if not already present or partial
      if (cachedController?.cookieJar) {
        try {
          const jarCookies = cachedController.cookieJar.getCookies(targetRemote, false, 'strict');
          if (jarCookies) {
            const idx = cleanHeaders.findIndex(([k]) => k.toLowerCase() === 'cookie');
            if (idx === -1) {
              cleanHeaders.push(['cookie', jarCookies]);
            } else {
              const existing = cleanHeaders[idx][1] || '';
              const jarCookieList = jarCookies.split(';').map((s: string) => s.trim()).filter(Boolean);
              const existingList = existing.split(';').map((s: string) => s.trim()).filter(Boolean);
              const existingKeys = new Set(existingList.map((s: string) => s.split('=')[0].trim()));
              for (const jc of jarCookieList) {
                const k = jc.split('=')[0].trim();
                if (!existingKeys.has(k)) {
                  existingList.push(jc);
                }
              }
              cleanHeaders[idx] = ['cookie', existingList.join('; ')];
            }
          }
        } catch {}
      }

      // Enforce SafeSearch OFF cookies across all search engines & sites
      {
        const cookieIdx = cleanHeaders.findIndex(([k]) => k.toLowerCase() === 'cookie');
        const currentCookie = cookieIdx !== -1 ? cleanHeaders[cookieIdx][1] || '' : '';
        const nextCookie = enforceSafeSearchOffCookieString(targetHost, currentCookie);
        if (nextCookie !== (cookieIdx !== -1 ? cleanHeaders[cookieIdx][1] || '' : '')) {
          if (cookieIdx !== -1) {
            if (nextCookie) cleanHeaders[cookieIdx] = ['cookie', nextCookie];
            else cleanHeaders.splice(cookieIdx, 1);
          } else if (nextCookie) {
            cleanHeaders.push(['cookie', nextCookie]);
          }
        }
      }

      const captureResponseCookies = (resp: { headers?: RawHeaderPair[] } | null | undefined) => {
        if (!resp || !Array.isArray(resp.headers)) return;
        let hasSetCookie = false;
        const jar = cachedController?.cookieJar;
        for (let i = resp.headers.length - 1; i >= 0; i--) {
          const [k, v] = resp.headers[i];
          const lowerK = k.toLowerCase();
          if (lowerK === 'location' && v) {
            resp.headers[i] = [k, sanitizeSafeSearchLocation(v, targetRemote.origin)];
          } else if (lowerK === 'set-cookie' && v) {
            const cleanSc = sanitizeSafeSearchSetCookie(targetHost, v);
            resp.headers[i] = [k, cleanSc];
            if (jar) {
              try {
                jar.setCookies(cleanSc, targetRemote);
                hasSetCookie = true;
              } catch {}
            }
          }
        }
        if (hasSetCookie) {
          flushScramjetCookies(false);
        }
      };

      const formatResponse = async (rawRes: any) => {
        let out = ensureNullBodyConsistency(rawRes);
        out.headers = cleanDecompressedHeaders(out.headers);
        out.body = await normalizeQuirkyHtml(targetRemote, out.body, out.headers, isDocument);
        captureResponseCookies(out);
        return out;
      };

      const isSearchChallengeHost =
        targetHost === 'duckduckgo.com' ||
        targetHost.endsWith('.duckduckgo.com') ||
        targetHost === 'startpage.com' ||
        targetHost.endsWith('.startpage.com') ||
        targetHost === 'search.brave.com';
      const reqDest = getHeaderValue(cleanHeaders, 'sec-fetch-dest').toLowerCase();
      const isCriticalSubresource =
        reqDest === 'script' ||
        reqDest === 'worker' ||
        reqDest === 'sharedworker' ||
        targetHost.includes('duckduckgo.com') ||
        targetHost.includes('startpage.com') ||
        targetHost.includes('search.brave.com') ||
        targetHost.includes('bing.com') ||
        isGoogle;

      const hasBackendOrigin = resolveBackendOrigins().length > 0;

      const inspectChallengeResponse = async (
        rawRes: any
      ): Promise<{ isChallenge: boolean; kind: 'search' | 'cloudflare' | 'none' }> => {
        if (!rawRes) return { isChallenge: false, kind: 'none' };
        const status = Number(rawRes.status || 0);
        const resHeaders: RawHeaderPair[] = Array.isArray(rawRes.headers) ? rawRes.headers : [];
        const locHeader = getHeaderValue(resHeaders, 'location');
        const cfMitigated = getHeaderValue(resHeaders, 'cf-mitigated').toLowerCase();
        const ct = getHeaderValue(resHeaders, 'content-type').toLowerCase();

        if (isSearchChallengeHost && (status === 202 || status === 403 || status === 429)) {
          return { isChallenge: true, kind: 'search' };
        }

        if (cfMitigated === 'challenge') {
          return { isChallenge: true, kind: 'cloudflare' };
        }

        const isTextLike =
          !ct ||
          ct.includes('text/html') ||
          ct.includes('application/xhtml+xml') ||
          ct.includes('application/json') ||
          ct.includes('text/plain');
        const shouldInspectBody =
          isTextLike &&
          (isSearchChallengeHost ||
            (isDocument && (status === 403 || status === 429 || status === 503)));

        if (!shouldInspectBody || !rawRes.body) {
          return { isChallenge: false, kind: 'none' };
        }

        const bytes = await readTransportBodyBytes(rawRes.body);
        if (!bytes) return { isChallenge: false, kind: 'none' };
        // Preserve body intact for formatResponse if we end up returning this response
        rawRes.body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

        const maxSlice = Math.min(bytes.byteLength, 48000);
        const probeText = new TextDecoder().decode(bytes.subarray(0, maxSlice));

        if (isSearchChallengeHost && probeText.includes('anomalyDetectionBlock')) {
          return { isChallenge: true, kind: 'search' };
        }

        if (isDocument && (status === 403 || status === 429 || status === 503)) {
          const lower = probeText.toLowerCase();
          if (
            lower.includes('just a moment...') ||
            lower.includes('cf-turnstile') ||
            lower.includes('_cf_chl_opt') ||
            lower.includes('challenge-platform') ||
            lower.includes('attention required! | cloudflare') ||
            lower.includes('enable javascript and cookies to continue') ||
            (lower.includes('captcha') && lower.includes('cloudflare'))
          ) {
            return { isChallenge: true, kind: 'cloudflare' };
          }
        }

        return { isChallenge: false, kind: 'none' };
      };

      // 1. Try EpoxyTransport across available Wisp servers (primary high-concurrency engine)
      const wispsToTry = workingWispUrls.length > 0 ? workingWispUrls : getWispCandidates();
      const startWispIdx = activeWispUrl ? Math.max(0, wispsToTry.indexOf(activeWispUrl)) : candidateIndex;
      let lastTransportError: any = null;
      let lastChallengeResponse: any = null;
      let fastFailToServerBypass = false;
      const challengedWispUrls = new Set<string>();
      const challengedWispHosts = new Set<string>();
      const getWispHost = (u: string) => {
        try {
          return new URL(u).hostname.toLowerCase();
        } catch {
          return u;
        }
      };
      const preferLibcurl = isKnownHttp2Incompatible(targetHost) || isLibcurlPreferredHost(targetHost);
      const epoxyAttempts = preferLibcurl ? 0 : Math.min(wispsToTry.length, 5);

      for (let i = 0; i < epoxyAttempts; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const wispUrl = wispsToTry[(startWispIdx + i) % wispsToTry.length];
        const wispHost = getWispHost(wispUrl);
        if (challengedWispHosts.has(wispHost)) {
          continue;
        }
        for (let h2Retry = 0; h2Retry < 2; h2Retry++) {
          try {
            const client = await getEpoxy(wispUrl);
            const rawRes = await withPromiseTimeout<any>(
              client.request(
                targetRemote,
                method,
                safeBody === null ? undefined : safeBody,
                cleanHeaders,
                signal
              ),
              i === 0 ? 20000 : 9000,
              `Epoxy fetch (${wispUrl})`
            );
            const challenge = await inspectChallengeResponse(rawRes);
            if (challenge.isChallenge) {
              lastChallengeResponse = rawRes;
              challengedWispUrls.add(wispUrl);
              challengedWispHosts.add(wispHost);
              // Fast-fail YouTube bot gates directly to /api/scramjet-fetch (ANDROID_VR/IOS Innertube bypass);
              // for Google/Cloudflare/search challenges, rotate across distinct Wisp exit IPs first
              if ((challenge.kind as any) === 'youtube' && hasBackendOrigin) {
                fastFailToServerBypass = true;
                break;
              }
              throw new Error(`Bot challenge (${challenge.kind}) via ${wispUrl}; rotating transport`);
            }
            return await formatResponse(rawRes);
          } catch (err: any) {
            if (signal?.aborted) throw err;
            lastTransportError = err;
            const errMsg = String(err?.message || err || '').toLowerCase();
            const isPermanentH2Error =
              errMsg.includes('protocol_error') ||
              errMsg.includes('http_1_1_required') ||
              errMsg.includes('inadequate_security') ||
              errMsg.includes('frame_size_error');
            const isTransientGoAway =
              errMsg.includes('goaway') ||
              errMsg.includes('http2') ||
              errMsg.includes('sendrequest') ||
              errMsg.includes('closure') ||
              errMsg.includes('dropped') ||
              errMsg.includes('wisp') ||
              errMsg.includes('websocket');

            if (isPermanentH2Error) {
              KNOWN_HTTP2_INCOMPATIBLE_HOSTS.add(targetHost);
              LIBCURL_PREFERRED_HOSTS.add(targetHost);
              retireEpoxyClient(wispUrl);
              break;
            }
            if (isTransientGoAway) {
              retireEpoxyClient(wispUrl);
              if (h2Retry === 0) {
                continue;
              }
              break;
            }
            if (isDocument && !fastFailToServerBypass) {
              rotateToNextWisp();
            }
            break;
          }
        }
        if (fastFailToServerBypass || KNOWN_HTTP2_INCOMPATIBLE_HOSTS.has(targetHost)) {
          break;
        }
      }

      // 2. Try LibcurlClient as secondary Wisp fallback across non-challenged Wisp endpoints
      if (!fastFailToServerBypass) {
        const libcurlAttempts = Math.min(wispsToTry.length, 4);
        for (let i = 0; i < libcurlAttempts; i++) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          const wispUrl = wispsToTry[(startWispIdx + i) % wispsToTry.length];
          const wispHost = getWispHost(wispUrl);
          if ((challengedWispUrls.has(wispUrl) || challengedWispHosts.has(wispHost)) && !preferLibcurl) {
            continue;
          }
          try {
            const client = await getLibcurl(wispUrl);
            const rawRes = await withPromiseTimeout<any>(
              client.request(
                targetRemote,
                method,
                safeBody === null ? undefined : safeBody,
                cleanHeaders,
                signal
              ),
              i === 0 ? 20000 : 9000,
              `Libcurl fetch (${wispUrl})`
            );
            const challenge = await inspectChallengeResponse(rawRes);
            if (challenge.isChallenge) {
              lastChallengeResponse = rawRes;
              challengedWispUrls.add(wispUrl);
              challengedWispHosts.add(wispHost);
              if ((challenge.kind as any) === 'youtube' && hasBackendOrigin) {
                fastFailToServerBypass = true;
                break;
              }
              throw new Error(`Bot challenge (${challenge.kind}) over Libcurl via ${wispUrl}`);
            }
            return await formatResponse(rawRes);
          } catch (err: any) {
            if (signal?.aborted) throw err;
            lastTransportError = err;
            if (isDocument) {
              rotateToNextWisp();
            }
          }
        }
      }

      // 3. Fall back to server /api/scramjet-fetch when backend origin is present
      // (/api/scramjet-fetch includes dedicated Google SERP recovery & YouTube ANDROID_VR/IOS bypass)
      if (hasBackendOrigin) {
        try {
          const res = await serverFallbackFetch(targetRemote, method, safeBody, cleanHeaders, signal);
          return await formatResponse(res);
        } catch (err) {
          lastTransportError = err;
        }
      }

      // If every transport returned a challenge (e.g. a site-specific Turnstile prompt), surface it instead of an empty error
      if (lastChallengeResponse) {
        return await formatResponse(lastChallengeResponse);
      }

      // Never silence critical script/search-API requests as empty 204 (triggers false "No results found")
      if (!isDocument && isCriticalSubresource) {
        return {
          body: null,
          status: 502,
          statusText: 'Bad Gateway',
          headers: [['content-type', reqDest === 'script' ? 'application/javascript; charset=utf-8' : 'text/plain; charset=utf-8']],
        };
      }

      // For non-critical subresources (third party analytics, beacons, broken trackers), return clean 204
      if (!isDocument) {
        return {
          body: null,
          status: 204,
          statusText: 'No Content',
          headers: [],
        };
      }

      // If document navigation failed due to GoAway or HTTP/2 protocol error, return a friendly reconnecting page
      if (
        lastTransportError &&
        (String(lastTransportError?.message || lastTransportError).includes('GoAway') ||
         String(lastTransportError?.message || lastTransportError).includes('Http2') ||
         String(lastTransportError?.message || lastTransportError).includes('Hyper client'))
      ) {
        return {
          body: new TextEncoder().encode(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reconnecting...</title><meta http-equiv="refresh" content="2"></head><body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;padding:30px;text-align:center;"><h2>Reconnecting to destination...</h2><p>Connection refreshed. Retrying automatically.</p></body></html>`
          ).buffer,
          status: 200,
          statusText: 'OK',
          headers: [['content-type', 'text/html; charset=utf-8']],
        };
      }

      throw lastTransportError || new Error('All Wisp proxy transports failed');
    },
    connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror) {
      const wispUrl = activeWispUrl || workingWispUrls[0] || getWispCandidates()[0];
      if (!wispUrl) {
        onerror('No Wisp endpoint available');
        return [() => {}, () => {}];
      }

      // Epoxy handles multiplexed Wisp WebSocket channels cleanly
      const client = epoxyClients.get(wispUrl);
      if (client && typeof client.connect === 'function') {
        try {
          return client.connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror);
        } catch {}
      }

      // Secondary libcurl WS fallback
      const libcurl = libcurlClients.get(wispUrl);
      if (libcurl && typeof libcurl.connect === 'function') {
        try {
          return libcurl.connect(url, protocols, requestHeaders, onopen, onmessage, onclose, onerror);
        } catch (err: any) {
          onerror(err?.message || 'WebSocket transport error');
          return [() => {}, () => {}];
        }
      }

      onerror('WebSocket client connecting...');
      return [() => {}, () => {}];
    },
  };

  return resilientTransport;
}

function patchControllerRequestHandler(controller: Controller): void {
  const methods = (controller as any).methods;
  if (!methods || methods.__frostPatched) return;
  methods.__frostPatched = true;

  const origRequest = typeof methods.request === 'function' ? methods.request.bind(methods) : null;
  if (!origRequest) return;

  methods.request = async (data: any) => {
    let rawPath = '';
    try {
      rawPath = new URL(data?.rawUrl || '').pathname;
    } catch {
      rawPath = String(data?.rawUrl || '');
    }

    const frames = (controller as any).frames as Frame[];

    // Ensure that if a request matches a retired frame, it is re-attached to controller.frames
    if (Array.isArray(frames) && rawPath) {
      const matchInCurrent = frames.find((f) => rawPath.startsWith(f.prefix));
      if (!matchInCurrent) {
        const matchInRetired = retiredFrames.find((f) => rawPath.startsWith(f.prefix));
        if (matchInRetired && !frames.includes(matchInRetired)) {
          frames.push(matchInRetired);
        }
      }
    }

    try {
      return await origRequest(data);
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      if (errMsg.includes('No frame found for request')) {
        // Fallback: handle via the most recent available active or retired frame
        const fallbackFrame =
          Array.isArray(frames) && frames.length > 0
            ? frames[frames.length - 1]
            : retiredFrames.length > 0
            ? retiredFrames[retiredFrames.length - 1]
            : null;

        if (fallbackFrame?.fetchHandler) {
          try {
            const sjheaders = (window as any).$scramjet?.ScramjetHeaders?.fromRawHeaders
              ? (window as any).$scramjet.ScramjetHeaders.fromRawHeaders(data.initialHeaders)
              : undefined;

            const fetchresponse = await fallbackFrame.fetchHandler.handleFetch({
              initialHeaders: sjheaders,
              rawClientUrl: data.rawClientUrl ? new URL(data.rawClientUrl) : undefined,
              rawUrl: new URL(data.rawUrl),
              rawReferrer: data.rawReferrer,
              rawDestination: data.destination,
              method: data.method,
              mode: data.mode,
              referrer: data.referrer,
              body: data.body,
              cache: data.cache,
              clientId: data.clientId,
            });

            return [
              {
                body: fetchresponse.body,
                status: fetchresponse.status,
                statusText: fetchresponse.statusText,
                headers: fetchresponse.headers.toRawHeaders(),
              },
              fetchresponse.body instanceof ReadableStream || fetchresponse.body instanceof ArrayBuffer
                ? [fetchresponse.body]
                : [],
            ];
          } catch {}
        }

        // Return a clean 204 No Content for subresources (beacons, tracking, media chunks, images)
        const dest = data?.destination;
        if (dest && dest !== 'document') {
          return [
            {
              body: null,
              status: 204,
              statusText: 'No Content',
              headers: [],
            },
            [],
          ];
        }

        return [
          {
            body: '<!doctype html><html><body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;padding:20px;">Session closed</body></html>',
            status: 404,
            statusText: 'Not Found',
            headers: [['content-type', 'text/html; charset=utf-8']],
          },
          [],
        ];
      }

      const errStr = String(err?.message || err || '');
      if (
        errStr.includes('GoAway') ||
        errStr.includes('Http2') ||
        errStr.includes('Hyper client') ||
        errStr.includes('sendrequest')
      ) {
        const dest = data?.destination;
        if (dest && dest !== 'document') {
          return [
            {
              body: null,
              status: 204,
              statusText: 'No Content',
              headers: [],
            },
            [],
          ];
        }
        return [
          {
            body: '<!doctype html><html><head><meta charset="utf-8"><title>Reconnecting...</title><meta http-equiv="refresh" content="2"></head><body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;padding:30px;text-align:center;"><h2>Reconnecting to destination...</h2><p>Connection refreshed. Retrying automatically.</p></body></html>',
            status: 200,
            statusText: 'OK',
            headers: [['content-type', 'text/html; charset=utf-8']],
          },
          [],
        ];
      }

      throw err;
    }
  };
}

export async function initScramjetProxy(): Promise<Controller> {
  if (cachedController && cachedControllerReady) {
    const activeSw = navigator.serviceWorker?.controller;
    if (activeSw && (cachedController as any).serviceWorkerController !== activeSw) {
      (cachedController as any).serviceWorkerController = activeSw;
      try {
        (cachedController as any).setupMessagePort?.();
      } catch {}
    }
    return cachedController;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      throw new Error(
        window?.isSecureContext === false
          ? 'Proxy requires HTTPS or localhost (Service Workers are blocked on insecure HTTP links)'
          : 'Service Workers are not supported in this browser context'
      );
    }

    // 1. Pre-seed IndexedDB cookie store before Controller constructor reads it
    const [localPre, remotePre, idbPre] = await Promise.all([
      Promise.resolve(readLocalSavedCookies()),
      fetchRemoteSavedCookies(),
      readControllerIdbCookies(),
    ]);
    const preMerged = deepMergeCookies(remotePre, idbPre, localPre);
    if (Object.keys(preMerged).length > 0) {
      writeLocalSavedCookies(preMerged);
      await seedControllerIdbCookies(preMerged);
    }

    // 2. Clean legacy SWs + load Scramjet 2.0.67-alpha.2 runtime, WASM, and Controller API
    await cleanupLegacyServiceWorkers();
    await loadScriptOnce('/scramjet/scramjet.js', () => Boolean(window.$scramjet));
    protectCookieJarPrototype((window as any).$scramjet);
    await loadScriptOnce('/controller/controller.api.js', () => Boolean(window.$scramjetController));
    await ensureValidScramjetWasm();

    const scramjetControllerApi = window.$scramjetController;
    if (!scramjetControllerApi) {
      throw new Error('Scramjet Controller API failed to initialize');
    }

    const createAndHandshakeController = async (): Promise<Controller> => {
      // 3. Register and activate Scramjet Controller Service Worker at root scope
      const registration = await navigator.serviceWorker.register('/sj-sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      const activeWorker = await waitForServiceWorkerActive(registration);

      // 4. Initialize transport (Epoxy/Libcurl over Wisp if reachable, plus HTTP /api/scramjet-fetch fallback)
      const transport = await createWispTransport();

      // 5. Create Controller with randomized globals and optimized flags for heavy media/SPA web apps
      const baseFlags = (window.$scramjet?.defaultConfig?.flags || {}) as NonNullable<
        NonNullable<typeof window.$scramjet>['defaultConfig']
      >['flags'];
      const baseGlobals = (window.$scramjet?.defaultConfig?.globals || {});
      const controller = new scramjetControllerApi.Controller({
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

      // Immediately protect Controller's bundled CookieJar prototype & instance before any frame/SW sync fires
      protectCookieJarPrototype(controller.cookieJar);
      protectCookieJarInstance(controller.cookieJar);

      patchControllerRequestHandler(controller);

      await Promise.race([
        controller.wait(),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error('Timed out waiting for Scramjet Controller handshake')), 10000)
        ),
      ]);

      // Disable the 5-second revive guard immediately so SW idle wakeups reconnect without delay
      (controller as any).guardServiceWorkerRevive = false;
      patchControllerRequestHandler(controller);
      return controller;
    };

    let controller: Controller;
    try {
      controller = await createAndHandshakeController();
    } catch (firstErr) {
      console.warn('[Scramjet] Retrying Controller initialization after handshake error:', firstErr);
      controller = await createAndHandshakeController();
    }

    // Keep controller message port bound if the Service Worker swaps underneath
    if (!controllerChangeListenerAttached) {
      controllerChangeListenerAttached = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        const nextSw = navigator.serviceWorker.controller;
        if (nextSw && cachedController && (cachedController as any).serviceWorkerController !== nextSw) {
          (cachedController as any).serviceWorkerController = nextSw;
          try {
            (cachedController as any).setupMessagePort?.();
          } catch {}
        }
      });
    }

    // 6. Hydrate & protect saved website cookies so they never reset
    await protectAndHydrateCookies(controller);

    cachedController = controller;
    cachedControllerReady = true;
    return controller;
  })().catch((err) => {
    initPromise = null;
    cachedController = null;
    cachedControllerReady = false;
    throw err;
  });

  return initPromise;
}

function unwrapRedirectWrapperUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();

    if (
      (host === 'duckduckgo.com' ||
        host.endsWith('.duckduckgo.com')) &&
      (pathLower === '/l' || pathLower.startsWith('/l/'))
    ) {
      const uddg = parsed.searchParams.get('uddg');
      if (uddg && /^https?:\/\//i.test(uddg)) return uddg;
    }

    if (isGoogleSearchDomain(host) && pathLower === '/url') {
      const dest = parsed.searchParams.get('url') || parsed.searchParams.get('q');
      if (dest && /^https?:\/\//i.test(dest)) return dest;
    }

    if ((host === 'youtube.com' || host.endsWith('.youtube.com')) && pathLower === '/redirect') {
      const dest = parsed.searchParams.get('q');
      if (dest && /^https?:\/\//i.test(dest)) return dest;
    }

    if ((host === 'l.facebook.com' || host === 'lm.facebook.com') && pathLower === '/l.php') {
      const dest = parsed.searchParams.get('u');
      if (dest && /^https?:\/\//i.test(dest)) return dest;
    }

    if (host === 'out.reddit.com') {
      const dest = parsed.searchParams.get('url');
      if (dest && /^https?:\/\//i.test(dest)) return dest;
    }

    if ((host === 'bing.com' || host.endsWith('.bing.com')) && pathLower.startsWith('/ck/a')) {
      const uParam = parsed.searchParams.get('u') || '';
      if (uParam.startsWith('a1') && uParam.length > 6) {
        try {
          const b64 = uParam.slice(2).replace(/-/g, '+').replace(/_/g, '/');
          const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
          const decoded = atob(padded);
          if (/^https?:\/\//i.test(decoded)) return decoded;
        } catch {}
      }
    }
  } catch {}
  return null;
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

  // Merge local saved cookies instantaneously without blocking launch on a network roundtrip
  try {
    const localCookies = readLocalSavedCookies();
    if (Object.keys(localCookies).length > 0 && controller.cookieJar) {
      controller.cookieJar.load(JSON.stringify(localCookies));
    }
  } catch {}

  let frame = frameMap.get(iframe);
  if (!frame || frame.controller !== controller) {
    frame = controller.createFrame(iframe);
    // Register Scramjet hooks via Tap.tap (Proxy properties do not expose .tap directly)
    const nativeInnerHtmlDescMap = new WeakMap<Window, PropertyDescriptor>();
    const silenceWindowConsole = (win: any) => {
      if (!win?.console || win.console.__frostFiltered) return;
      win.console.__frostFiltered = true;
      const origWarn = typeof win.console.warn === 'function' ? win.console.warn.bind(win.console) : null;
      if (origWarn) {
        win.console.warn = (...args: any[]) => {
          for (const a of args) {
            if (
              typeof a === 'string' &&
              (a.includes('Assuming <form> element') ||
                a.includes('extraneous query parameter') ||
                a.includes('detected quirky document structure parsing'))
            ) {
              return;
            }
          }
          return origWarn(...args);
        };
      }
    };

    const Tap = (window.$scramjet as any)?.Tap;
    if (Tap && typeof Tap.tap === 'function') {
      try {
        Tap.tap(frame.hooks.init.pre, ({ window: win, client }: any) => {
          silenceWindowConsole(win);
          try {
            if (win?.Element?.prototype) {
              const desc = Object.getOwnPropertyDescriptor(win.Element.prototype, 'innerHTML');
              if (desc?.set && !nativeInnerHtmlDescMap.has(win)) {
                nativeInnerHtmlDescMap.set(win, desc);
              }
            }
          } catch {}
          protectCookieJarPrototype(win?.$scramjet);
          if (client?.context?.cookieJar) {
            protectCookieJarPrototype(client.context.cookieJar);
            protectCookieJarInstance(client.context.cookieJar);
            try {
              const saved = readLocalSavedCookies();
              if (Object.keys(saved).length > 0) {
                client.context.cookieJar.load(JSON.stringify(saved));
              }
            } catch {}
          }
        });
      } catch {}
      try {
        Tap.tap(frame.hooks.init.post, ({ client }: any) => {
          const win = client?.global as any;
          silenceWindowConsole(win);
          protectCookieJarPrototype(win?.$scramjet);
          if (client?.context?.cookieJar) {
            protectCookieJarPrototype(client.context.cookieJar);
            protectCookieJarInstance(client.context.cookieJar);
          }
          if (!win || win.__frostCompatPatched) return;
          win.__frostCompatPatched = true;

          // Preserve exact native HTML5 parser serialization on detached pure-tag innerHTML checks (e.g. DuckDuckGo JSA challenge)
          try {
            const nativeDesc = nativeInnerHtmlDescMap.get(win);
            const wrappedDesc = win.Element?.prototype
              ? Object.getOwnPropertyDescriptor(win.Element.prototype, 'innerHTML')
              : null;
            if (nativeDesc?.set && wrappedDesc?.set && wrappedDesc.configurable) {
              Object.defineProperty(win.Element.prototype, 'innerHTML', {
                configurable: true,
                enumerable: wrappedDesc.enumerable,
                get: wrappedDesc.get,
                set(val: any) {
                  if (
                    typeof val === 'string' &&
                    val.length < 160 &&
                    !(this as Element).isConnected &&
                    /^<[a-z/><\s]*$/i.test(val)
                  ) {
                    return nativeDesc.set!.call(this, val);
                  }
                  return wrappedDesc.set!.call(this, val);
                },
              });
            }
          } catch {}

          // Enforce Android VR / Android Mobile / Desktop navigator + userAgentData + touch fingerprint
          try {
            const nav = win.navigator;
            if (nav) {
              const profile = getClientDeviceProfile();
              const profileUa = getProfileUserAgent(profile);
              const hints = getProfileClientHints(profile);
              const isMobile = hints.isMobile;
              const platformStr = (profile as any) === 'android_vr' ? 'Linux armv8l' : (profile as any) === 'android_mobile' ? 'Linux armv8l' : 'Win32';
              const appVersionStr = profileUa.replace(/^Mozilla\//, '');
              const touchPoints = isMobile ? 5 : 0;

              const spoofedUaData = {
                brands: hints.brands.map((b) => ({ ...b })),
                mobile: hints.isMobile,
                platform: hints.platform,
                toJSON() {
                  return {
                    brands: hints.brands.map((b) => ({ ...b })),
                    mobile: hints.isMobile,
                    platform: hints.platform,
                  };
                },
                async getHighEntropyValues(requestedHints: string[] = []) {
                  const full: Record<string, any> = {
                    brands: hints.brands.map((b) => ({ ...b })),
                    mobile: hints.isMobile,
                    platform: hints.platform,
                    architecture: hints.architecture,
                    bitness: hints.bitness,
                    model: hints.model,
                    platformVersion: hints.platformVersion,
                    uaFullVersion: hints.uaFullVersion,
                    fullVersionList: hints.fullVersionList.map((b) => ({ ...b })),
                    wow64: hints.wow64,
                  };
                  const out: Record<string, any> = {
                    brands: full.brands,
                    mobile: full.mobile,
                    platform: full.platform,
                  };
                  if (Array.isArray(requestedHints)) {
                    for (const h of requestedHints) {
                      if (h in full) out[h] = full[h];
                    }
                  }
                  return out;
                },
              };

              const defineOnNavAndProto = (prop: string, getter: () => any) => {
                try {
                  Object.defineProperty(nav, prop, { get: getter, configurable: true });
                } catch {}
                try {
                  const navProto = win.Navigator?.prototype;
                  if (navProto) {
                    const desc = Object.getOwnPropertyDescriptor(navProto, prop);
                    if (!desc || desc.configurable) {
                      Object.defineProperty(navProto, prop, { get: getter, configurable: true });
                    }
                  }
                } catch {}
              };

              defineOnNavAndProto('userAgent', () => profileUa);
              defineOnNavAndProto('appVersion', () => appVersionStr);
              defineOnNavAndProto('platform', () => platformStr);
              defineOnNavAndProto('vendor', () => 'Google Inc.');
              defineOnNavAndProto('webdriver', () => false);
              defineOnNavAndProto('language', () => 'en-US');
              defineOnNavAndProto('languages', () => ['en-US', 'en']);
              defineOnNavAndProto('maxTouchPoints', () => touchPoints);
              defineOnNavAndProto('hardwareConcurrency', () => 8);
              defineOnNavAndProto('deviceMemory', () => 8);
              defineOnNavAndProto('userAgentData', () => spoofedUaData);

              if (isMobile) {
                try {
                  if (!('ontouchstart' in win)) {
                    Object.defineProperty(win, 'ontouchstart', { value: null, writable: true, configurable: true });
                  }
                  if (win.Document?.prototype && !('ontouchstart' in win.Document.prototype)) {
                    Object.defineProperty(win.Document.prototype, 'ontouchstart', { value: null, writable: true, configurable: true });
                  }
                  if (win.HTMLElement?.prototype && !('ontouchstart' in win.HTMLElement.prototype)) {
                    Object.defineProperty(win.HTMLElement.prototype, 'ontouchstart', { value: null, writable: true, configurable: true });
                  }
                } catch {}

                try {
                  if (typeof win.matchMedia === 'function') {
                    const origMatchMedia = win.matchMedia.bind(win);
                    win.matchMedia = (query: string) => {
                      const res = origMatchMedia(query);
                      const q = String(query || '').toLowerCase().replace(/\s+/g, '');
                      const forceTrue =
                        q === '(pointer:coarse)' ||
                        q === '(any-pointer:coarse)' ||
                        q === '(hover:none)' ||
                        q === '(any-hover:none)';
                      const forceFalse =
                        q === '(pointer:fine)' ||
                        q === '(any-pointer:fine)' ||
                        q === '(hover:hover)' ||
                        q === '(any-hover:hover)';
                      if (forceTrue || forceFalse) {
                        const forced = forceTrue;
                        try {
                          return new Proxy(res, {
                            get(target, prop) {
                              if (prop === 'matches') return forced;
                              const val = Reflect.get(target, prop);
                              return typeof val === 'function' ? val.bind(target) : val;
                            },
                          });
                        } catch {
                          return res;
                        }
                      }
                      return res;
                    };
                  }
                } catch {}

                // Spoof Android Adreno GPU renderer in WebGL so Google/BotGuard sees mobile Snapdragon/Quest hardware
                try {
                  const patchWebgl = (proto: any) => {
                    if (!proto || typeof proto.getParameter !== 'function') return;
                    const origGetParam = proto.getParameter;
                    proto.getParameter = function (param: number) {
                      if (param === 37445) return 'Qualcomm';
                      if (param === 37446) return (profile as any) === 'android_vr' ? 'Adreno (TM) 740' : 'Adreno (TM) 750';
                      return origGetParam.apply(this, arguments);
                    };
                  };
                  patchWebgl(win.WebGLRenderingContext?.prototype);
                  patchWebgl(win.WebGL2RenderingContext?.prototype);
                } catch {}
              }
            }
            if (!win.chrome) {
              win.chrome = {
                loadTimes: function() {},
                csi: function() {},
                app: { isInstalled: false },
              };
            }
          } catch {}

          // Trap top-level framebusting on the root proxied tab window only.
          // Preserve parent & frameElement inside nested sub-iframes (reCAPTCHA anchor/bframe, BotGuard about:blank)
          // so Scramjet cross-iframe postMessage and frame hierarchy keep working properly.
          try {
            const isRootProxiedWindow = (() => {
              try {
                return win === iframe.contentWindow || win.parent === window;
              } catch {
                return true;
              }
            })();

            if (isRootProxiedWindow) {
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
            } else {
              Object.defineProperty(win, 'top', {
                get: () => iframe.contentWindow || win,
                configurable: true,
              });
            }
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

          // Force SafeSearch OFF on ANY page's forms, links, and client-side cookies/storage
          try {
            const doc = win.document;
            const currentHost = String(client?.url?.hostname || '').toLowerCase();
            const scrubSafeSearchForm = (form: HTMLFormElement | null | undefined) => {
              if (!form) return;
              try {
                const actionAttr = form.getAttribute('action') || '';
                const formHost = (() => {
                  try {
                    return new URL(actionAttr || client?.url?.href || 'https://example.com').hostname.toLowerCase();
                  } catch {
                    return currentHost;
                  }
                })();
                const setOrUpdateInput = (name: string, val: string) => {
                  const existing = form.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
                  if (existing) {
                    existing.value = val;
                  } else if (doc) {
                    const created = doc.createElement('input');
                    created.type = 'hidden';
                    created.name = name;
                    created.value = val;
                    form.appendChild(created);
                  }
                };
                form.querySelectorAll('input[name="ssui"]').forEach((el: any) => el.remove?.());
                const existingSafe = form.querySelector('input[name="safe"]') as HTMLInputElement | null;
                if (existingSafe) existingSafe.value = 'off';
                const existingSafeSearch = form.querySelector('input[name="safesearch"]') as HTMLInputElement | null;
                if (existingSafeSearch) {
                  existingSafeSearch.value = formHost.includes('ecosia') || formHost.includes('qwant') ? '0' : 'off';
                }
                const existingAdlt = form.querySelector('input[name="adlt"]') as HTMLInputElement | null;
                if (existingAdlt) existingAdlt.value = 'off';

                if (formHost.includes('google.')) {
                  setOrUpdateInput('safe', 'off');
                  setOrUpdateInput('safeui', 'off');
                } else if (formHost.includes('duckduckgo.com')) {
                  setOrUpdateInput('kp', '-2');
                } else if (formHost.includes('bing.com')) {
                  setOrUpdateInput('adlt', 'off');
                } else if (formHost.includes('search.brave.com')) {
                  setOrUpdateInput('safesearch', 'off');
                } else if (formHost.includes('startpage.com')) {
                  setOrUpdateInput('ff', '0');
                } else if (formHost.includes('search.yahoo.com')) {
                  setOrUpdateInput('vm', 'p');
                }
              } catch {}
            };

            if (doc) {
              doc.addEventListener(
                'submit',
                (ev: Event) => {
                  scrubSafeSearchForm(ev.target as HTMLFormElement);
                },
                true
              );
              const scanAllForms = () => {
                try {
                  doc.querySelectorAll?.('form')?.forEach((f: any) => scrubSafeSearchForm(f));
                } catch {}
              };
              if (doc.readyState === 'loading') {
                win.addEventListener?.('DOMContentLoaded', scanAllForms, { once: true });
              } else {
                scanAllForms();
              }

              // Intercept document.cookie writes inside the proxied window so SafeSearch cannot be re-enabled by page JS
              const cookieDesc =
                Object.getOwnPropertyDescriptor(win.Document?.prototype || {}, 'cookie') ||
                Object.getOwnPropertyDescriptor(doc, 'cookie');
              if (cookieDesc?.set && cookieDesc.configurable) {
                Object.defineProperty(doc, 'cookie', {
                  configurable: true,
                  enumerable: cookieDesc.enumerable,
                  get: cookieDesc.get ? () => cookieDesc.get!.call(doc) : undefined,
                  set(val: string) {
                    const cleanVal = sanitizeSafeSearchSetCookie(currentHost, String(val || ''));
                    return cookieDesc.set!.call(doc, cleanVal);
                  },
                });
              }

              // Clear YouTube restricted mode localStorage flag if present
              if (currentHost.includes('youtube.com')) {
                try {
                  win.localStorage?.removeItem?.('yt-player-restricted-mode');
                } catch {}
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

          // Suppress blocking modal alert() dialogs inside game frames (e.g. Undertale boot alerts)
          // and auto-resume suspended Web Audio contexts on interaction
          try {
            const cb = frameCallbackMap.get(iframe);
            if (!cb?.onNavigate) {
              win.alert = (msg?: any) => {
                console.info('[Scramjet Game Alert]:', msg);
              };
            }
            const OrigAudio = win.AudioContext || win.webkitAudioContext;
            if (OrigAudio && !OrigAudio.__frostResumable) {
              const ctxList: any[] = [];
              const WrappedAudio = function (this: any, ...args: any[]) {
                const inst = new OrigAudio(...args);
                ctxList.push(inst);
                return inst;
              } as any;
              WrappedAudio.prototype = OrigAudio.prototype;
              WrappedAudio.__frostResumable = true;
              win.AudioContext = WrappedAudio;
              if (win.webkitAudioContext) win.webkitAudioContext = WrappedAudio;
              const resumeAudio = () => {
                for (const ctx of ctxList) {
                  if (ctx && ctx.state === 'suspended') {
                    ctx.resume?.().catch(() => {});
                  }
                }
              };
              win.addEventListener?.('pointerdown', resumeAudio, { capture: true, passive: true });
              win.addEventListener?.('keydown', resumeAudio, { capture: true, passive: true });
            }
          } catch {}

          // 1b. Recover stalled YouTube players with the regular youtube.com/embed player
          try {
            const clientHost = String(client?.url?.hostname || '').toLowerCase();
            if (clientHost.includes('youtube.com')) {
              if (win.document) {
                try {
                  Object.defineProperty(win.document, 'hidden', { get: () => false, configurable: true });
                  Object.defineProperty(win.document, 'visibilityState', { get: () => 'visible', configurable: true });
                } catch {}
              }
              const nudgePlayerLayout = () => {
                try {
                  win.dispatchEvent(new win.Event('resize'));
                } catch {}
              };
              win.addEventListener?.('DOMContentLoaded', () => {
                nudgePlayerLayout();
                window.setTimeout(nudgePlayerLayout, 500);
              }, { once: true });
              win.addEventListener?.('load', () => {
                nudgePlayerLayout();
                window.setTimeout(nudgePlayerLayout, 700);
              }, { once: true });

              let lastPatchedVideoId = '';
              let currentObservedVid = '';
              let videoObservedAt = 0;
              let checkTimer: number | null = null;
              let pollTimer: number | null = null;
              let embedRetryTimer: number | null = null;

              let embedMessageListener: ((event: MessageEvent) => void) | null = null;
              const clearEmbedRetryTimer = () => {
                if (embedRetryTimer !== null) {
                  window.clearTimeout(embedRetryTimer);
                  embedRetryTimer = null;
                }
                if (embedMessageListener) {
                  win.removeEventListener('message', embedMessageListener);
                  embedMessageListener = null;
                }
              };

              const hideErrorOverlays = (doc: Document) => {
                const errorSelectors = [
                  '.ytp-playability-error-supported-renderers',
                  '.ytp-error',
                  'yt-playability-error-supported-renderers',
                  'ytd-playability-error-supported-renderers',
                  '#error-screen',
                  '.error-message',
                  'ytd-reel-player-overlay-renderer #error-screen',
                  '.playability-error',
                  '[id*="error-screen"]',
                ];
                try {
                  doc.querySelectorAll(errorSelectors.join(', ')).forEach((el: any) => {
                    try {
                      el.style.setProperty('display', 'none', 'important');
                      el.style.setProperty('opacity', '0', 'important');
                      el.style.setProperty('pointer-events', 'none', 'important');
                    } catch {}
                  });
                } catch {}
              };

              const showYoutubeEmbedFailure = (doc: Document, playerSlot: Element, vid: string) => {
                try {
                  let notice = doc.getElementById('__frost_yt_notice') as HTMLDivElement | null;
                  if (!notice) {
                    notice = doc.createElement('div');
                    notice.id = '__frost_yt_notice';
                    notice.style.cssText =
                      'position:absolute;inset:0;z-index:2147483642;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px;box-sizing:border-box;background:#000;color:#fff;text-align:center;font:14px Arial,sans-serif;';
                    const message = doc.createElement('div');
                    message.textContent = 'This video could not be loaded in the embedded player.';
                    notice.appendChild(message);
                    const link = doc.createElement('a');
                    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(vid)}`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'Open on YouTube';
                    link.style.cssText = 'color:#8ab4f8;text-decoration:underline;';
                    notice.appendChild(link);
                  }
                  if (win.getComputedStyle(playerSlot).position === 'static') {
                    (playerSlot as HTMLElement).style.position = 'relative';
                  }
                  if (!playerSlot.contains(notice)) playerSlot.appendChild(notice);
                } catch {}
              };

              const mountNativeYoutubeFallback = (doc: Document, playerSlot: Element, vid: string) => {
                lastPatchedVideoId = vid;
                hideErrorOverlays(doc);
                clearEmbedRetryTimer();

                // Stop the original player before mounting the regular YouTube embed.
                try {
                  playerSlot.querySelectorAll('video').forEach((vEl: any) => {
                    try {
                      vEl.muted = true;
                      vEl.pause?.();
                      if (vEl.id === '__frost_yt_player') vEl.remove();
                    } catch {}
                  });
                } catch {}

                const existingEmbed = doc.getElementById('__frost_yt_embed') as HTMLIFrameElement | null;
                if (existingEmbed && existingEmbed.dataset.vid === vid && playerSlot.contains(existingEmbed)) {
                  return;
                }
                existingEmbed?.remove();
                doc.getElementById('__frost_yt_player')?.remove();
                doc.getElementById('__frost_yt_notice')?.remove();

                if (win.getComputedStyle(playerSlot).position === 'static') {
                  (playerSlot as HTMLElement).style.position = 'relative';
                }

                const embedIframe = doc.createElement('iframe');
                embedIframe.id = '__frost_yt_embed';
                embedIframe.dataset.vid = vid;
                embedIframe.title = 'YouTube video player';
                embedIframe.allow =
                  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                embedIframe.allowFullscreen = true;
                embedIframe.referrerPolicy = 'strict-origin-when-cross-origin';
                embedIframe.setAttribute('loading', 'eager');
                embedIframe.style.cssText =
                  'position:absolute;inset:0;width:100%;height:100%;border:0;z-index:2147483641;background:#000;';

                let attempt = 0;
                let playerReady = false;
                const MAX_EMBED_ATTEMPTS = 2;
                const EMBED_READY_TIMEOUT_MS = 18000;

                const failEmbed = () => {
                  clearEmbedRetryTimer();
                  embedIframe.remove();
                  showYoutubeEmbedFailure(doc, playerSlot, vid);
                };

                const onEmbedMessage = (event: MessageEvent) => {
                  if (event.source !== embedIframe.contentWindow) return;
                  if (event.origin !== 'https://www.youtube.com') return;

                  let payload: any = event.data;
                  if (typeof payload === 'string') {
                    try {
                      payload = JSON.parse(payload);
                    } catch {
                      return;
                    }
                  }
                  if (!payload || typeof payload !== 'object') return;

                  if (payload.event === 'onReady' || payload.event === 'initialDelivery') {
                    playerReady = true;
                    clearEmbedRetryTimer();
                    return;
                  }

                  if (payload.event === 'infoDelivery' && payload.info) {
                    // Any player-state report proves the embedded player initialized.
                    if (typeof payload.info.playerState === 'number') {
                      playerReady = true;
                      clearEmbedRetryTimer();
                    }
                  }

                  if (payload.event === 'onError' || payload.info?.errorCode) {
                    failEmbed();
                  }
                };

                win.addEventListener('message', onEmbedMessage);
                embedMessageListener = onEmbedMessage;

                const startEmbedAttempt = () => {
                  if (!embedIframe.isConnected || embedIframe.dataset.vid !== vid) return;
                  if (embedRetryTimer !== null) {
                    window.clearTimeout(embedRetryTimer);
                    embedRetryTimer = null;
                  }
                  attempt++;
                  playerReady = false;
                  embedIframe.dataset.loaded = '';
                  embedIframe.dataset.attempt = String(attempt);

                  const parentOrigin = encodeURIComponent(String(win.location?.origin || ''));
                  embedIframe.src =
                    `https://www.youtube.com/embed/${encodeURIComponent(vid)}` +
                    `?autoplay=1&playsinline=1&rel=0&controls=1&enablejsapi=1&origin=${parentOrigin}`;

                  // An iframe load event alone does not mean the YouTube player is ready.
                  // Keep a watchdog active until the player reports that it initialized.
                  embedRetryTimer = window.setTimeout(() => {
                    if (!embedIframe.isConnected || playerReady) return;
                    if (attempt < MAX_EMBED_ATTEMPTS) {
                      startEmbedAttempt();
                    } else {
                      failEmbed();
                    }
                  }, EMBED_READY_TIMEOUT_MS);
                };

                embedIframe.addEventListener('load', () => {
                  if (!embedIframe.isConnected) return;
                  embedIframe.dataset.loaded = '1';
                  try {
                    const target = 'https://www.youtube.com';
                    embedIframe.contentWindow?.postMessage(
                      JSON.stringify({ event: 'listening', id: '__frost_yt_embed' }),
                      target
                    );
                    embedIframe.contentWindow?.postMessage(
                      JSON.stringify({
                        event: 'command',
                        func: 'addEventListener',
                        args: ['onReady'],
                        id: '__frost_yt_embed',
                      }),
                      target
                    );
                    embedIframe.contentWindow?.postMessage(
                      JSON.stringify({
                        event: 'command',
                        func: 'addEventListener',
                        args: ['onError'],
                        id: '__frost_yt_embed',
                      }),
                      target
                    );
                  } catch {}
                });
                embedIframe.addEventListener('error', failEmbed);

                playerSlot.appendChild(embedIframe);
                startEmbedAttempt();
              };

              // Intercept window.location signin redirect attempts so YouTube cannot throw user to accounts.google.com
              try {
                const origAssign = win.location.assign?.bind(win.location);
                const origReplace = win.location.replace?.bind(win.location);
                const isSignInUrl = (target: any) => {
                  const s = String(target || '').toLowerCase();
                  return (
                    s.includes('accounts.google.com') ||
                    s.includes('/servicelogin') ||
                    s.includes('action_handle_signin') ||
                    s.includes('/signin_passive')
                  );
                };
                if (origAssign) {
                  win.location.assign = (url: string) => {
                    if (isSignInUrl(url)) return;
                    return origAssign(url);
                  };
                }
                if (origReplace) {
                  win.location.replace = (url: string) => {
                    if (isSignInUrl(url)) return;
                    return origReplace(url);
                  };
                }
              } catch {}

              const checkBotGateOverlay = () => {
                try {
                  const doc = win.document;
                  if (!doc) return;
                  const realHref =
                    resolveRealTargetUrl(win.location?.href || '', client?.url?.href) ||
                    client?.url?.href ||
                    '';
                  if (!realHref) return;

                  const parsedUrl = new URL(realHref);
                  let vid =
                    parsedUrl.searchParams.get('v') ||
                    (parsedUrl.pathname.startsWith('/shorts/') ? parsedUrl.pathname.split('/')[2] : '') ||
                    '';

                  const activeReel =
                    doc.querySelector('ytd-reel-video-renderer[is-active]') ||
                    doc.querySelector('ytd-reel-video-renderer');

                  if (!vid && activeReel) {
                    const reelLink = activeReel.querySelector(
                      'a[href*="/shorts/"], a[href*="/watch?v="]'
                    ) as HTMLAnchorElement | null;
                    if (reelLink) {
                      const m = (reelLink.getAttribute('href') || '').match(
                        /\/(shorts|watch\?v=)(?:\/|\?v=)?([a-zA-Z0-9_-]{6,20})/
                      );
                      if (m && m[2]) vid = m[2];
                    }
                    if (!vid) {
                      const attrVid = activeReel.getAttribute('video-id') || (activeReel as any).dataset?.videoId;
                      if (attrVid && /^[a-zA-Z0-9_-]{6,20}$/.test(attrVid)) vid = attrVid;
                    }
                  }

                  if (!vid || !/^[a-zA-Z0-9_-]{6,20}$/.test(vid)) {
                    clearEmbedRetryTimer();
                    lastPatchedVideoId = '';
                    currentObservedVid = '';
                    doc.getElementById('__frost_yt_player')?.remove();
                    doc.getElementById('__frost_yt_embed')?.remove();
                    doc.getElementById('__frost_yt_notice')?.remove();
                    return;
                  }

                  if (currentObservedVid !== vid) {
                    currentObservedVid = vid;
                    videoObservedAt = Date.now();
                  }

                  if (lastPatchedVideoId && lastPatchedVideoId !== vid) {
                    clearEmbedRetryTimer();
                    lastPatchedVideoId = '';
                    doc.getElementById('__frost_yt_player')?.remove();
                    doc.getElementById('__frost_yt_embed')?.remove();
                    doc.getElementById('__frost_yt_notice')?.remove();
                  }

                  let playerSlot: Element | null = null;
                  if (parsedUrl.pathname.startsWith('/shorts') && activeReel) {
                    playerSlot =
                      activeReel.querySelector('.player-container') ||
                      activeReel.querySelector('#player-container') ||
                      activeReel.querySelector('#shorts-player') ||
                      activeReel;
                  }
                  if (!playerSlot) {
                    playerSlot =
                      doc.querySelector('#player-container-inner') ||
                      doc.querySelector('#movie_player') ||
                      doc.querySelector('#shorts-player') ||
                      doc.querySelector('#player-container') ||
                      doc.querySelector('ytd-player') ||
                      doc.querySelector('#player');
                  }
                  if (!playerSlot) return;

                  const existingFallback =
                    doc.getElementById('__frost_yt_embed') || doc.getElementById('__frost_yt_notice');
                  if (lastPatchedVideoId === vid && existingFallback && playerSlot.contains(existingFallback)) {
                    hideErrorOverlays(doc);
                    return;
                  }

                  const slotText = (playerSlot.textContent || doc.body?.textContent || '').toLowerCase();
                  const hasPlayabilityError =
                    slotText.includes('confirm you’re not a bot') ||
                    slotText.includes("confirm you're not a bot") ||
                    slotText.includes('sign in to confirm') ||
                    slotText.includes('an error occurred') ||
                    slotText.includes('video unavailable') ||
                    slotText.includes('something went wrong') ||
                    slotText.includes('playback id');

                  const nativeVideo = playerSlot.querySelector(
                    'video:not(#__frost_yt_player)'
                  ) as HTMLVideoElement | null;
                  const nativeHasError = Boolean(
                    nativeVideo && (nativeVideo.error || nativeVideo.networkState === 3)
                  );
                  const nativePlayingOk = Boolean(
                    nativeVideo &&
                      nativeVideo.readyState >= 2 &&
                      nativeVideo.videoWidth > 0 &&
                      !nativeVideo.error
                  );
                  // Give YouTube time to hydrate and buffer. The old 3-second threshold
                  // replaced healthy players before their first media segment arrived.
                  const stalledTooLong =
                    !nativePlayingOk &&
                    videoObservedAt > 0 &&
                    Date.now() - videoObservedAt > 15000;

                  if (!hasPlayabilityError && !nativeHasError && !stalledTooLong) {
                    return;
                  }

                  mountNativeYoutubeFallback(doc, playerSlot, vid);
                } catch {}
              };

              let obs: MutationObserver | null = null;
              const cleanupObserver = () => {
                clearEmbedRetryTimer();
                if (checkTimer !== null) {
                  window.clearTimeout(checkTimer);
                  checkTimer = null;
                }
                if (pollTimer !== null) {
                  window.clearInterval(pollTimer);
                  pollTimer = null;
                }
                if (obs) {
                  try {
                    obs.disconnect();
                  } catch {}
                  obs = null;
                }
              };
              const attachObserver = () => {
                try {
                  if (!win.document?.body) return;
                  obs = new win.MutationObserver(() => {
                    if (checkTimer !== null) window.clearTimeout(checkTimer);
                    checkTimer = window.setTimeout(checkBotGateOverlay, 250);
                  });
                  obs?.observe(win.document.body, { childList: true, subtree: true });
                  win.addEventListener?.('yt-navigate-finish', () => {
                    window.setTimeout(checkBotGateOverlay, 250);
                  });
                  win.addEventListener?.('yt-action', () => {
                    window.setTimeout(checkBotGateOverlay, 250);
                  });
                  win.addEventListener?.('transitionend', () => {
                    window.setTimeout(checkBotGateOverlay, 250);
                  });
                  pollTimer = window.setInterval(checkBotGateOverlay, 1000);
                } catch {}
              };
              win.addEventListener?.('pagehide', cleanupObserver, { once: true });
              win.addEventListener?.('unload', cleanupObserver, { once: true });
              if (win.document?.readyState === 'loading') {
                win.addEventListener?.('DOMContentLoaded', attachObserver, { once: true });
              } else {
                attachObserver();
              }
            }
          } catch {}

          let lastUserInteractionTime = 0;
          const activeFrame = frame;
          const navigateInsideFrame = (destUrl: string) => {
            let safeDest = destUrl;
            try {
              safeDest = enforceSafeSearchOffUrl(new URL(destUrl)).href;
            } catch {}
            try {
              if (activeFrame && typeof activeFrame.go === 'function') {
                activeFrame.go(safeDest);
                return;
              }
            } catch {}
            try {
              win.location.assign(safeDest);
            } catch {}
          };

          const markInteraction = (ev: Event) => {
            if (ev.isTrusted) {
              lastUserInteractionTime = Date.now();
            }
          };
          try {
            win.document?.addEventListener('pointerdown', markInteraction, true);
            win.document?.addEventListener('mousedown', markInteraction, true);
            win.document?.addEventListener('keydown', markInteraction, true);
          } catch {}

          // 2. Intercept window.open so links navigate inside the current tab or Scramjet frame instead of failing as blocked popups
          try {
            win.open = (url?: string | URL, target?: string) => {
              const strUrl = url ? String(url) : '';
              if (!strUrl) return null;
              const baseHref = client?.url?.href || targetUrl;
              const realUrl = resolveRealTargetUrl(strUrl, baseHref);
              if (!realUrl) return null;
              const finalUrl = unwrapRedirectWrapperUrl(realUrl) || realUrl;

              // Block popup ad / tracking domains
              if (isAdOrTrackingUrl(finalUrl)) {
                return null;
              }

              const wasUserInitiated = Date.now() - lastUserInteractionTime < 2000;
              const cb = frameCallbackMap.get(iframe);
              if (wasUserInitiated) {
                if (cb?.onOpenNewTab && (target === '_blank' || !target)) {
                  cb.onOpenNewTab(finalUrl);
                  return win;
                }
                navigateInsideFrame(finalUrl);
                return win;
              }
              return null;
            };
          } catch {}

          // 3. Intercept redirect wrapper links, _blank/_top/_parent links, and unrewritten external links
          // so clicking a website on DuckDuckGo or any site ALWAYS navigates cleanly instead of showing a dead link
          try {
            const resolveClickLink = (ev: MouseEvent) => {
              const el = (ev.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
              if (!el) return null;
              if (el.hasAttribute('download')) return null;
              const attrHref = (el.getAttribute('href') || '').trim();
              const propHref = (el.href || '').trim();
              const candidateHref = attrHref || propHref;
              if (
                !candidateHref ||
                candidateHref.startsWith('#') ||
                /^javascript:/i.test(candidateHref) ||
                /^mailto:/i.test(candidateHref) ||
                /^tel:/i.test(candidateHref) ||
                /^data:/i.test(candidateHref) ||
                /^blob:/i.test(candidateHref)
              ) {
                return null;
              }
              const baseHref = client?.url?.href || targetUrl;
              const resolved = resolveRealTargetUrl(candidateHref, baseHref);
              if (!resolved) return null;
              const unwrapped = unwrapRedirectWrapperUrl(resolved);
              const finalUrl = unwrapped || resolved;
              return { el, propHref, unwrapped, finalUrl };
            };

            win.document?.addEventListener(
              'click',
              (ev: MouseEvent) => {
                if (ev.isTrusted) {
                  lastUserInteractionTime = Date.now();
                }
                const info = resolveClickLink(ev);
                if (!info) return;
                const { el, unwrapped, finalUrl } = info;

                if (isAdOrTrackingUrl(finalUrl)) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  return;
                }

                const linkTarget = (el.getAttribute('target') || '').trim().toLowerCase();
                let isNamedExternalFrame = false;
                if (linkTarget && linkTarget !== '_self') {
                  if (linkTarget === '_blank' || linkTarget === '_top' || linkTarget === '_parent') {
                    isNamedExternalFrame = true;
                  } else {
                    try {
                      isNamedExternalFrame = !win.document.querySelector(`iframe[name="${linkTarget.replace(/"/g, '\\"')}"]`);
                    } catch {
                      isNamedExternalFrame = true;
                    }
                  }
                }
                const wantsNewWindow = isNamedExternalFrame || ev.ctrlKey || ev.metaKey;
                if (!ev.isTrusted) return;

                if (unwrapped || wantsNewWindow) {
                  ev.preventDefault();
                  ev.stopPropagation();
                  const cb = frameCallbackMap.get(iframe);
                  if (cb?.onOpenNewTab && (linkTarget === '_blank' || ev.ctrlKey || ev.metaKey)) {
                    cb.onOpenNewTab(finalUrl);
                  } else {
                    navigateInsideFrame(finalUrl);
                  }
                }
              },
              true
            );

            // Bubble-phase safety net: if no SPA handler cancelled the click, catch unrewritten external <a> links
            // so dynamically hydrated links never navigate outside Scramjet or stall on an unproxied iframe block
            win.document?.addEventListener(
              'click',
              (ev: MouseEvent) => {
                if (!ev.isTrusted || ev.defaultPrevented) return;
                const info = resolveClickLink(ev);
                if (!info) return;
                const { propHref, finalUrl } = info;
                const isProxiedContext = String(win.location?.pathname || '').startsWith('/~/sj/');
                if (isProxiedContext && /^https?:\/\//i.test(propHref) && !propHref.includes('/~/sj/')) {
                  ev.preventDefault();
                  navigateInsideFrame(finalUrl);
                }
              },
              false
            );
          } catch {}

          // 3b. Auto-follow <meta http-equiv="refresh"> interstitials inside Scramjet
          try {
            const checkMetaRefresh = () => {
              try {
                const meta = win.document?.querySelector?.('meta[http-equiv="refresh" i]') as HTMLMetaElement | null;
                const content = meta?.getAttribute('content') || '';
                const m = content.match(/^\s*(\d+(?:\.\d+)?)\s*;\s*url\s*=\s*['"]?([^'">\s]+)['"]?/i);
                if (m && m[2]) {
                  const delaySec = Math.min(5, Math.max(0, Number(m[1]) || 0));
                  const baseHref = client?.url?.href || targetUrl;
                  const resolved = resolveRealTargetUrl(m[2], baseHref);
                  const dest = resolved ? unwrapRedirectWrapperUrl(resolved) || resolved : null;
                  if (dest && !isAdOrTrackingUrl(dest) && dest !== baseHref) {
                    window.setTimeout(() => navigateInsideFrame(dest), Math.round(delaySec * 1000) + 150);
                  }
                }
              } catch {}
            };
            if (win.document?.readyState === 'loading') {
              win.addEventListener?.('DOMContentLoaded', checkMetaRefresh, { once: true });
            } else {
              window.setTimeout(checkMetaRefresh, 150);
            }
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

          // Only suppress non-document subresources with 204; never return 204 for document navigations (leaves about:blank black screen)
          if (isAborted && dest !== 'document') {
            target.setResponse = {
              body: null,
              status: 204,
              statusText: 'No Content',
              headers: [],
            };
            return;
          }

          if (dest === 'document') {
            if (isAborted) {
              return;
            }
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
          } else if (dest === 'style' || dest === 'script' || dest === 'worker' || dest === 'sharedworker') {
            target.setResponse = {
              body: null,
              status: 502,
              statusText: 'Bad Gateway',
              headers: [['content-type', dest === 'style' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8']],
            };
          } else {
            // For non-critical subresources (media chunks, beacons, analytics), return 204 No Content so player doesn't panic
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

  // Ensure the Service Worker actively intercepts and has registered the controller prefix
  try {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const pingRes = await fetch(`/__sj_ping__?prefix=${encodeURIComponent(controller.prefix)}`, {
        cache: 'no-store',
      });
      if (pingRes.headers.get('x-sj-ctrl') === '1') {
        break;
      }
      try {
        (controller as any).setupMessagePort?.();
      } catch {}
      await new Promise((r) => window.setTimeout(r, 60));
    }
  } catch {}

  let finalTargetUrl = targetUrl;
  try {
    finalTargetUrl = enforceSafeSearchOffUrl(new URL(targetUrl)).href;
  } catch {}

  frame.go(finalTargetUrl);

  return {
    frame,
    proxiedSrc: iframe.src || '',
  };
}

export function cleanupScramjetFrame(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;
  const frame = frameMap.get(iframe);
  frameMap.delete(iframe);
  frameCallbackMap.delete(iframe);

  if (frame) {
    if (!retiredFrames.includes(frame)) {
      retiredFrames.push(frame);
      if (retiredFrames.length > 25) {
        retiredFrames.shift();
      }
    }
  }

  // Retain a rolling buffer of frames in controller.frames so in-flight subresource requests
  // do not fail with "No frame found for request"
  if (cachedController && Array.isArray((cachedController as any).frames)) {
    const frames = (cachedController as any).frames as Frame[];
    if (frames.length > 25) {
      frames.splice(0, frames.length - 25);
    }
  }

  try {
    iframe.src = 'about:blank';
  } catch {}
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
