import {
  generateRammerheadSessionId,
  isValidRammerheadSessionId,
  normalizeTargetProtocolSlashes,
  mergeCookieRecordMap,
  type RammerheadCookieEntry,
} from '../utils/rammerheadCore';
import { enforceSafeSearchOffUrl } from '../utils/safeSearchOff';

const SESSION_STORAGE_KEY = 'frosthub_rammerhead_session_id';
const COOKIE_STORAGE_KEY = 'frosthub_rammerhead_cookies_v1';
const USER_ID_STORAGE_KEY = 'frosthub_chat_user_id';

export interface RammerheadFrameCallbacks {
  onNavigate?: (url: string, title?: string) => void;
  onOpenNewTab?: (url: string) => void;
}

let cachedSessionId: string | null = null;
let sessionInitPromise: Promise<string> | null = null;
let hasSyncedCookiesOnce = false;

function getSafeBrowserOrigin(): string {
  if (typeof window === 'undefined' || !window.location) return '';
  const origin = window.location.origin;
  if (!origin || origin === 'null' || window.location.protocol === 'about:') {
    return '';
  }
  return origin.replace(/\/+$/, '');
}

function getEffectiveCookieUserId(): string {
  try {
    return localStorage.getItem(USER_ID_STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

/**
 * Loads locally cached Rammerhead cookies and merges with server/edge KV store.
 * Strictly additive: NEVER deletes or resets stored cookies!
 */
export async function syncRammerheadCookies(sessionId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const origin = getSafeBrowserOrigin();
  const userId = getEffectiveCookieUserId();

  let localJar: Record<string, RammerheadCookieEntry> = {};
  try {
    const raw = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        localJar = parsed;
      }
    }
  } catch {}

  try {
    const res = await fetch(
      `${origin}/api/rammerhead/cookies?userId=${encodeURIComponent(userId)}&sessionId=${encodeURIComponent(sessionId)}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.cookies && typeof data.cookies === 'object') {
        const merged = mergeCookieRecordMap(localJar, data.cookies);
        try {
          localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        // Push back any local-only cookies that the server didn't have (e.g. after container restart)
        const serverCount = Object.keys(data.cookies).length;
        if (Object.keys(merged).length > serverCount) {
          await fetch(`${origin}/api/rammerhead/cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, sessionId, cookies: merged }),
          }).catch(() => {});
        }
      }
    }
  } catch {}
}

/**
 * Initializes or restores an active Rammerhead session ID without ever resetting cookies.
 */
export async function initRammerheadSession(): Promise<string> {
  if (cachedSessionId && isValidRammerheadSessionId(cachedSessionId)) {
    if (!hasSyncedCookiesOnce) {
      hasSyncedCookiesOnce = true;
      void syncRammerheadCookies(cachedSessionId);
    }
    return cachedSessionId;
  }

  if (sessionInitPromise) {
    return sessionInitPromise;
  }

  sessionInitPromise = (async () => {
    const origin = getSafeBrowserOrigin();

    // 1. Try restoring existing persistent session ID from localStorage first
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored && isValidRammerheadSessionId(stored)) {
        cachedSessionId = stored;
        hasSyncedCookiesOnce = true;
        // Validate / re-register existing session ID on server so cookies stay attached
        void fetch(`${origin}/sessionexists?id=${encodeURIComponent(stored)}`, { cache: 'no-store' }).catch(() => {});
        void syncRammerheadCookies(stored);
        return stored;
      }
    } catch {}

    // 2. Request a new session from the server (or Cloudflare Function)
    for (const endpoint of [`${origin}/newsession`, `${origin}/api/rammerhead/newsession`]) {
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (res.ok) {
          const text = (await res.text()).trim();
          if (isValidRammerheadSessionId(text)) {
            cachedSessionId = text;
            try {
              localStorage.setItem(SESSION_STORAGE_KEY, text);
            } catch {}
            hasSyncedCookiesOnce = true;
            void syncRammerheadCookies(text);
            return text;
          }
        }
      } catch {}
    }

    // 3. Deterministic client-side session ID fallback (still works seamlessly with Rammerhead server)
    const generated = generateRammerheadSessionId();
    cachedSessionId = generated;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, generated);
    } catch {}
    hasSyncedCookiesOnce = true;
    void syncRammerheadCookies(generated);
    return generated;
  })().finally(() => {
    sessionInitPromise = null;
  });

  return sessionInitPromise;
}

/**
 * Resolves the full proxied Rammerhead URL for a target URL.
 * Uses the real current browser origin (never localhost unless actually running locally).
 */
export async function getRammerheadProxiedUrl(targetUrl: string, customSessionId?: string): Promise<string> {
  if (!targetUrl) return '';
  const sessionId = customSessionId || (await initRammerheadSession());

  let cleanUrl = normalizeTargetProtocolSlashes(targetUrl);
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = cleanUrl.startsWith('//') ? `https:${cleanUrl}` : `https://${cleanUrl}`;
  }

  try {
    cleanUrl = enforceSafeSearchOffUrl(new URL(cleanUrl)).href;
  } catch {}

  const origin = getSafeBrowserOrigin();
  return `${origin}/api/rammerhead/${sessionId}/${cleanUrl}`;
}

/**
 * Launches a target URL into an iframe using the Rammerhead proxy.
 */
export async function launchInRammerheadFrame(
  iframe: HTMLIFrameElement,
  targetUrl: string,
  callbacks?: RammerheadFrameCallbacks
): Promise<{ proxiedSrc: string }> {
  if (!iframe) {
    throw new Error('No iframe provided to launchInRammerheadFrame');
  }

  const proxiedUrl = await getRammerheadProxiedUrl(targetUrl);

  iframe.setAttribute(
    'allow',
    'fullscreen; autoplay; clipboard-write; clipboard-read; encrypted-media; picture-in-picture; microphone; camera; display-capture; web-share'
  );
  iframe.setAttribute('allowfullscreen', 'true');
  iframe.setAttribute('loading', 'eager');

  const onLoadHandler = () => {
    try {
      callbacks?.onNavigate?.(targetUrl);
    } catch {}
  };

  iframe.removeEventListener('load', onLoadHandler);
  iframe.addEventListener('load', onLoadHandler, { once: true });

  iframe.src = proxiedUrl;

  return {
    proxiedSrc: proxiedUrl,
  };
}

/**
 * Resets a Rammerhead iframe cleanly when navigating away (preserves session & cookies!).
 */
export function cleanupRammerheadFrame(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;
  try {
    iframe.src = 'about:blank';
  } catch {}
}

/**
 * Extracts the real upstream target URL from a Rammerhead proxied src or location.
 */
export function extractUrlFromRammerheadSrc(rawSrc: string): string | null {
  if (!rawSrc) return null;
  try {
    const match = rawSrc.match(/(?:\/api\/rammerhead)?\/[a-f0-9]{32}\/(https?:\/+.+)$/i);
    if (match && match[1]) {
      return normalizeTargetProtocolSlashes(match[1]);
    }
    if (/^https?:\/\//i.test(rawSrc) && !/\/[a-f0-9]{32}\//i.test(rawSrc)) {
      return rawSrc;
    }
  } catch {}
  return null;
}
