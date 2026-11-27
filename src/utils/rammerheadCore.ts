import {
  enforceSafeSearchOffUrl,
  enforceSafeSearchOffCookieString,
  sanitizeSafeSearchSetCookie,
} from './safeSearchOff';

export interface RammerheadCookieEntry {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  maxAge?: number;
  secure?: boolean;
  sameSite?: string;
  updatedAt?: number;
}

export interface RammerheadSession {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  httpProxy?: string;
  enableShuffling?: boolean;
  // Legacy flat map kept only for backward compatibility; canonical jar lives in cookieJar
  cookies: Record<string, string>;
  cookieJar?: Record<string, RammerheadCookieEntry>;
}

export function generateRammerheadSessionId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidRammerheadSessionId(id: string): boolean {
  return typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id.trim());
}

/**
 * Restores collapsed slashes like `https:/example.com` -> `https://example.com`
 * introduced by proxies/CDNs (e.g. Cloudflare path normalization) and trims whitespace.
 */
export function normalizeTargetProtocolSlashes(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/^(https?):\/+([^/])/i, '$1://$2')
    .replace(/^(wss?):\/+([^/])/i, '$1://$2');
}

export function extractRammerheadSessionAndUrl(
  pathWithSearch: string,
  refererHeader?: string
): { sessionId: string; targetUrl: string; isDirectUrl: boolean } | null {
  if (!pathWithSearch) return null;

  // Support either pathname (/sessionId/https://...) or full URL (https://proxy.example/sessionId/https://...)
  let candidatePath = pathWithSearch.trim();
  if (/^https?:\/\//i.test(candidatePath)) {
    try {
      const parsedFull = new URL(candidatePath);
      candidatePath = parsedFull.pathname + parsedFull.search;
    } catch {}
  }

  const cleanPath = candidatePath.startsWith('/') ? candidatePath : `/${candidatePath}`;
  const prefixMatch = cleanPath.match(/^(?:\/api\/rammerhead)?\/([a-f0-9]{32})(?:\/(.*))?$/i);
  if (!prefixMatch) return null;

  const sessionId = prefixMatch[1].toLowerCase();
  const rawRest = prefixMatch[2] || '';
  const rest = normalizeTargetProtocolSlashes(rawRest);

  // Direct absolute target URL
  if (/^https?:\/\//i.test(rest)) {
    try {
      const parsed = enforceSafeSearchOffUrl(new URL(rest));
      return { sessionId, targetUrl: parsed.href, isDirectUrl: true };
    } catch {
      return { sessionId, targetUrl: rest, isDirectUrl: true };
    }
  }

  // If protocol-relative: //example.com/...
  if (rawRest.startsWith('//')) {
    const full = `https:${rawRest}`;
    try {
      const parsed = enforceSafeSearchOffUrl(new URL(full));
      return { sessionId, targetUrl: parsed.href, isDirectUrl: true };
    } catch {
      return { sessionId, targetUrl: full, isDirectUrl: true };
    }
  }

  // If rest is empty or a relative path, resolve using Referer header if available
  if (refererHeader) {
    const refererInfo = extractRammerheadSessionAndUrl(refererHeader);
    if (refererInfo && refererInfo.targetUrl && /^https?:\/\//i.test(refererInfo.targetUrl)) {
      try {
        const base = new URL(refererInfo.targetUrl);
        const rel = rawRest.startsWith('/') ? rawRest : `/${rawRest}`;
        const resolved = enforceSafeSearchOffUrl(new URL(rawRest ? rawRest : '', base.origin + base.pathname));
        // If rawRest doesn't start with '/' and has query or subpath, fallback cleanly against base.href
        const exactResolved = rawRest.startsWith('/')
          ? enforceSafeSearchOffUrl(new URL(rel, base.origin))
          : enforceSafeSearchOffUrl(new URL(rawRest || '', base.href));
        return {
          sessionId: refererInfo.sessionId || sessionId,
          targetUrl: exactResolved.href || resolved.href,
          isDirectUrl: false,
        };
      } catch {}
    }
  }

  return { sessionId, targetUrl: rest, isDirectUrl: false };
}

export const FORBIDDEN_FORWARD_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'http2-settings',
  'te',
  'content-length',
  'accept-encoding',
]);

export const STRIPPED_UPSTREAM_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'feature-policy',
  'clear-site-data',
  'strict-transport-security',
  'origin-agent-cluster',
  'report-to',
  'reporting-endpoints',
  'nel',
]);

// When passing raw binary/video/range streams untouched (Accept-Encoding: identity), keep content-length & content-range!
export const STRIPPED_STREAM_HEADERS = new Set([
  'transfer-encoding',
  'connection',
  'keep-alive',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'feature-policy',
  'clear-site-data',
  'strict-transport-security',
  'origin-agent-cluster',
  'report-to',
  'reporting-endpoints',
  'nel',
]);

export function parseSetCookieHeader(
  rawCookie: string,
  requestHost: string
): { key: string; entry: RammerheadCookieEntry } | null {
  if (!rawCookie || typeof rawCookie !== 'string') return null;
  const sanitized = sanitizeSafeSearchSetCookie(requestHost, rawCookie.trim());
  const parts = sanitized.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const firstEq = parts[0].indexOf('=');
  if (firstEq <= 0) return null;
  const name = parts[0].slice(0, firstEq).trim();
  const value = parts[0].slice(firstEq + 1).trim();
  if (!name) return null;

  let domain = requestHost.toLowerCase().replace(/^\.+/, '');
  let cookiePath = '/';
  let secure = true;
  let sameSite = 'Lax';
  let expires = Date.now() + 365 * 24 * 3600 * 1000;

  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const eqIdx = seg.indexOf('=');
    const attrName = (eqIdx === -1 ? seg : seg.slice(0, eqIdx)).trim().toLowerCase();
    const attrVal = eqIdx === -1 ? '' : seg.slice(eqIdx + 1).trim();

    if (attrName === 'domain' && attrVal) {
      const cleaned = attrVal.toLowerCase().replace(/^\.+/, '');
      if (
        cleaned &&
        (requestHost.toLowerCase() === cleaned ||
          requestHost.toLowerCase().endsWith(`.${cleaned}`))
      ) {
        domain = cleaned;
      }
    } else if (attrName === 'path' && attrVal) {
      cookiePath = attrVal.startsWith('/') ? attrVal : `/${attrVal}`;
    } else if (attrName === 'samesite' && attrVal) {
      sameSite = attrVal;
    } else if (attrName === 'expires' && attrVal) {
      const parsed = Date.parse(attrVal);
      if (Number.isFinite(parsed)) {
        expires = Math.max(parsed, Date.now() + 365 * 24 * 3600 * 1000);
      }
    } else if (attrName === 'max-age' && attrVal) {
      const sec = Number(attrVal);
      if (Number.isFinite(sec) && sec > 0) {
        expires = Math.max(Date.now() + sec * 1000, Date.now() + 365 * 24 * 3600 * 1000);
      }
    }
  }

  const key = `${domain}||${cookiePath}||${name}`;
  return {
    key,
    entry: {
      name,
      value,
      domain,
      path: cookiePath,
      expires,
      secure,
      sameSite,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Timestamp-aware additive merge: NEVER wipes a non-empty cookie with empty/deleted values,
 * resolves conflicting non-empty updates by newer updatedAt (preventing stale localStorage
 * from overwriting fresh HTTP Set-Cookie headers), and keeps expirations alive.
 */
export function mergeCookieRecordMap(
  existing: Record<string, any> | undefined,
  incoming: Record<string, any> | undefined
): Record<string, RammerheadCookieEntry> {
  const merged: Record<string, RammerheadCookieEntry> = {};
  if (existing && typeof existing === 'object') {
    for (const [k, v] of Object.entries(existing)) {
      if (v && typeof v === 'object' && v.name) {
        merged[k] = { ...v };
      }
    }
  }
  if (incoming && typeof incoming === 'object') {
    const minFuture = Date.now() + 365 * 24 * 3600 * 1000;
    for (const [k, rawV] of Object.entries(incoming)) {
      if (!rawV || typeof rawV !== 'object') continue;
      const v = rawV as Partial<RammerheadCookieEntry>;
      const ex = merged[k];
      const name = String(v.name || ex?.name || k.split('||').pop() || '').trim();
      if (!name) continue;

      const inVal = typeof v.value === 'string' ? v.value : v.value != null ? String(v.value) : '';
      const exVal = typeof ex?.value === 'string' ? ex.value : '';
      const inTs = typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt) ? v.updatedAt : 0;
      const exTs = typeof ex?.updatedAt === 'number' && Number.isFinite(ex.updatedAt) ? ex.updatedAt : 0;

      let chosenVal = inVal;
      let chosenTs = inTs || Date.now();

      if (ex) {
        if (exVal.length > 0 && (!inVal || inVal === 'deleted' || inVal === 'null' || inVal === 'undefined')) {
          // Never blank out an existing non-empty cookie
          chosenVal = exVal;
          chosenTs = Math.max(exTs, inTs) || Date.now();
        } else if (exTs > 0 && inTs > 0 && inTs < exTs && exVal.length > 0) {
          // Existing entry is strictly newer than stale incoming cache
          chosenVal = exVal;
          chosenTs = exTs;
        } else {
          chosenTs = Math.max(inTs, exTs) || Date.now();
        }
      }

      const combined: RammerheadCookieEntry = {
        name,
        value: chosenVal,
        domain: String(v.domain || ex?.domain || '').toLowerCase().replace(/^\.+/, ''),
        path: String(v.path || ex?.path || '/'),
        secure: v.secure ?? ex?.secure ?? true,
        sameSite: v.sameSite || ex?.sameSite || 'Lax',
        expires: minFuture,
        updatedAt: chosenTs,
      };
      if (typeof v.expires === 'number' && Number.isFinite(v.expires)) {
        combined.expires = Math.max(v.expires, minFuture);
      } else if (typeof ex?.expires === 'number' && Number.isFinite(ex.expires)) {
        combined.expires = Math.max(ex.expires, minFuture);
      }
      merged[k] = combined;
    }
  }
  return merged;
}

export function buildCookieHeaderForUrl(
  jar: Record<string, RammerheadCookieEntry> | undefined,
  legacyFlat: Record<string, string> | undefined,
  targetUrl: URL
): string {
  const host = targetUrl.hostname.toLowerCase();
  const byName = new Map<string, string>();

  if (jar && typeof jar === 'object') {
    for (const entry of Object.values(jar)) {
      if (!entry || !entry.name) continue;
      const domain = (entry.domain || '').toLowerCase().replace(/^\.+/, '');
      if (!domain) continue;
      const domainMatches = host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
      if (!domainMatches) continue;
      byName.set(entry.name, `${entry.name}=${entry.value ?? ''}`);
    }
  }

  // Fallback support for legacy flat map entries if formatted as "domain::name" or raw
  if (legacyFlat && typeof legacyFlat === 'object') {
    for (const [k, rawPair] of Object.entries(legacyFlat)) {
      if (!rawPair || !rawPair.includes('=')) continue;
      if (k.includes('||')) {
        const [dom] = k.split('||');
        if (dom && (host === dom || host.endsWith(`.${dom}`))) {
          const eq = rawPair.indexOf('=');
          const name = rawPair.slice(0, eq).trim();
          if (name && !byName.has(name)) byName.set(name, rawPair);
        }
      }
    }
  }

  const rawJoined = Array.from(byName.values()).join('; ');
  return enforceSafeSearchOffCookieString(host, rawJoined);
}

export function extractHostMatchedCookies(
  jar: Record<string, RammerheadCookieEntry> | undefined,
  targetUrl: URL
): Record<string, RammerheadCookieEntry> {
  const out: Record<string, RammerheadCookieEntry> = {};
  if (!jar || typeof jar !== 'object') return out;
  const host = targetUrl.hostname.toLowerCase();
  for (const [k, entry] of Object.entries(jar)) {
    if (!entry || !entry.name) continue;
    const dom = (entry.domain || '').toLowerCase().replace(/^\.+/, '');
    if (!dom) continue;
    if (host === dom || host.endsWith(`.${dom}`) || dom.endsWith(`.${host}`)) {
      out[k] = entry;
    }
  }
  return out;
}

function decodeBase64Flexible(raw: string): string {
  try {
    let b64 = raw.replace(/-/g, '+').replace(/_/g, '/').replace(/\./g, '=');
    while (b64.length % 4 !== 0) b64 += '=';
    if (typeof atob === 'function') {
      return atob(b64);
    }
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

function encodeRecaptchaCoOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    const raw = `${u.protocol}//${u.hostname}:${port}`;
    const b64 =
      typeof btoa === 'function'
        ? btoa(raw)
        : Buffer.from(raw, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '.');
  } catch {
    return '';
  }
}

function isProxyHostLeak(candidate: string, proxyHost?: string): boolean {
  if (!candidate) return false;
  const lower = candidate.toLowerCase();
  if (proxyHost && lower.includes(proxyHost.toLowerCase())) return true;
  return (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('.run.app') ||
    lower.includes('.pages.dev') ||
    lower.includes('.workers.dev')
  );
}

/**
 * Rewrites CAPTCHA challenge query parameters (reCAPTCHA `co`, hCaptcha `host`, Turnstile `origin`)
 * when they contain the proxy host instead of the upstream site origin.
 */
export function normalizeCaptchaChallengeUrl(
  urlObj: URL,
  refererUpstreamUrl?: string,
  proxyHost?: string
): URL {
  try {
    const host = urlObj.hostname.toLowerCase();
    const pathLower = urlObj.pathname.toLowerCase();
    const isCaptcha =
      pathLower.includes('/recaptcha/') ||
      host.includes('recaptcha.') ||
      host.includes('hcaptcha.') ||
      host.includes('challenges.cloudflare.') ||
      host.includes('turnstile.');

    if (!isCaptcha) return urlObj;

    let siteOrigin = '';
    if (refererUpstreamUrl) {
      try {
        const refObj = new URL(refererUpstreamUrl);
        const refHost = refObj.hostname.toLowerCase();
        if (
          !refHost.includes('recaptcha.') &&
          !refHost.includes('hcaptcha.') &&
          !refHost.includes('challenges.cloudflare.') &&
          !refObj.pathname.toLowerCase().includes('/recaptcha/')
        ) {
          siteOrigin = refObj.origin;
        }
      } catch {}
    }

    if (!siteOrigin) return urlObj;
    const siteHost = new URL(siteOrigin).hostname;

    const coParam = urlObj.searchParams.get('co');
    if (coParam) {
      const decoded = decodeBase64Flexible(coParam);
      if (decoded && isProxyHostLeak(decoded, proxyHost)) {
        const encoded = encodeRecaptchaCoOrigin(siteOrigin);
        if (encoded) urlObj.searchParams.set('co', encoded);
      }
    }

    const originParam = urlObj.searchParams.get('origin');
    if (originParam && isProxyHostLeak(originParam, proxyHost)) {
      urlObj.searchParams.set('origin', siteOrigin);
    }

    const hostParam = urlObj.searchParams.get('host');
    if (hostParam && isProxyHostLeak(hostParam, proxyHost)) {
      urlObj.searchParams.set('host', siteHost);
    }
  } catch {}
  return urlObj;
}

export function buildProxiedUrl(proxyOrigin: string, sessionId: string, targetUrl: string): string {
  const origin =
    proxyOrigin && !/^https?:\/\/localhost(?::\d+)?$/i.test(proxyOrigin)
      ? proxyOrigin.replace(/\/+$/, '')
      : '';
  const cleanTarget = normalizeTargetProtocolSlashes(
    targetUrl.startsWith('//') ? `https:${targetUrl}` : targetUrl
  );
  return `${origin}/api/rammerhead/${sessionId}/${cleanTarget}`;
}

const LOCATION_MEMBERS = new Set([
  'href',
  'origin',
  'protocol',
  'host',
  'hostname',
  'port',
  'pathname',
  'search',
  'hash',
  'assign',
  'replace',
  'reload',
  'toString',
  'ancestorOrigins',
]);

const GLOBAL_WINDOW_OBJS = new Set(['window', 'document', 'self', 'globalThis', 'top', 'parent']);
const GLOBAL_PURE_FRAME_OBJS = new Set(['window', 'self', 'globalThis']);
const MAYBE_LOCAL_FRAME_OBJS = new Set(['top', 'parent']);
const DECL_KEYWORDS = new Set(['function', 'class', 'var', 'let', 'const', 'import', 'export', 'typeof', 'delete', 'void']);
const REGEX_PREV_KEYWORDS = new Set([
  'return',
  'case',
  'throw',
  'typeof',
  'void',
  'delete',
  'await',
  'yield',
  'in',
  'of',
  'instanceof',
  'new',
  'else',
  'do',
]);
const PAREN_CTRL_KEYWORDS = new Set(['if', 'while', 'for', 'with']);

function isIdentStart(ch: number): boolean {
  return (
    (ch >= 65 && ch <= 90) ||
    (ch >= 97 && ch <= 122) ||
    ch === 95 || // _
    ch === 36    // $
  );
}

function isIdentPart(ch: number): boolean {
  return isIdentStart(ch) || (ch >= 48 && ch <= 57);
}

function isWs(ch: number): boolean {
  return ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 12 || ch === 11;
}

/**
 * Skips whitespace and JS comments starting at `idx`, returning the index of the next code char.
 */
function skipWsAndComments(src: string, idx: number): number {
  const n = src.length;
  let i = idx;
  while (i < n) {
    const ch = src.charCodeAt(i);
    if (isWs(ch)) {
      i++;
    } else if (ch === 47 && i + 1 < n) {
      const next = src.charCodeAt(i + 1);
      if (next === 47) {
        i += 2;
        while (i < n && src.charCodeAt(i) !== 10 && src.charCodeAt(i) !== 13) i++;
      } else if (next === 42) {
        i += 2;
        while (i + 1 < n && !(src.charCodeAt(i) === 42 && src.charCodeAt(i + 1) === 47)) i++;
        i = Math.min(n, i + 2);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return i;
}

function readMemberChain(
  js: string,
  fromIdx: number
): { member: string; memEnd: number; afterMem: number } | null {
  const n = js.length;
  const pDot = skipWsAndComments(js, fromIdx);
  if (pDot < n && js.charCodeAt(pDot) === 46 && js.slice(pDot + 1, pDot + 3) !== '..') {
    const pMem = skipWsAndComments(js, pDot + 1);
    if (pMem < n && isIdentStart(js.charCodeAt(pMem))) {
      let memEnd = pMem + 1;
      while (memEnd < n && isIdentPart(js.charCodeAt(memEnd))) memEnd++;
      return {
        member: js.slice(pMem, memEnd),
        memEnd,
        afterMem: skipWsAndComments(js, memEnd),
      };
    }
  }
  return null;
}

/**
 * Syntax-safe lexer JS rewriter (Scramjet-style location, origin & frame virtualization).
 * Skips strings, comments, regex literals, and template text cleanly; supports template `${...}` expressions
 * and works safely in both Window and Web Worker scopes without throwing ReferenceError.
 */
export function rewriteJsForRammerhead(js: string, _sessionId?: string, _upstreamUrl?: string): string {
  if (!js || typeof js !== 'string') return js;
  if (
    !js.includes('location') &&
    !js.includes('.origin') &&
    !js.includes('.top') &&
    !js.includes('.parent') &&
    !js.includes('.frameElement')
  ) {
    return js;
  }

  const n = js.length;
  const out: string[] = [];
  let flushFrom = 0;

  // Template interpolation stack & control-paren stack (`if (...) /regex/`)
  const templateBraceStack: number[] = [];
  const parenCtrlStack: boolean[] = [];
  let braceDepth = 0;

  let lastSigKind: 'exprEnd' | 'punct' | 'kw' | 'start' = 'start';
  let lastWord = '';
  let lastPunct = '';

  let i = 0;
  while (i < n) {
    const ch = js.charCodeAt(i);

    // 1. Whitespace
    if (isWs(ch)) {
      i++;
      continue;
    }

    // 2. Comments or Regex vs Division '/'
    if (ch === 47) {
      const next = i + 1 < n ? js.charCodeAt(i + 1) : 0;
      if (next === 47) {
        i += 2;
        while (i < n && js.charCodeAt(i) !== 10 && js.charCodeAt(i) !== 13) i++;
        continue;
      }
      if (next === 42) {
        i += 2;
        while (i + 1 < n && !(js.charCodeAt(i) === 42 && js.charCodeAt(i + 1) === 47)) i++;
        i = Math.min(n, i + 2);
        continue;
      }
      if (lastSigKind !== 'exprEnd') {
        i++;
        let inClass = false;
        while (i < n) {
          const rc = js.charCodeAt(i);
          if (rc === 92) {
            i += 2;
            continue;
          }
          if (rc === 91) inClass = true;
          else if (rc === 93) inClass = false;
          else if (rc === 47 && !inClass) {
            i++;
            break;
          } else if (rc === 10 || rc === 13) {
            break;
          }
          i++;
        }
        while (i < n && isIdentPart(js.charCodeAt(i))) i++;
        lastSigKind = 'exprEnd';
        lastWord = '';
        lastPunct = '';
        continue;
      }
      i++;
      lastSigKind = 'punct';
      lastWord = '';
      lastPunct = '/';
      continue;
    }

    // 3. Single or double quoted string (handles `\\\r\n` CRLF continuations)
    if (ch === 39 || ch === 34) {
      const quote = ch;
      i++;
      while (i < n) {
        const sc = js.charCodeAt(i);
        if (sc === 92) {
          if (i + 2 < n && js.charCodeAt(i + 1) === 13 && js.charCodeAt(i + 2) === 10) {
            i += 3;
          } else {
            i += 2;
          }
          continue;
        }
        if (sc === quote || sc === 10 || sc === 13) {
          i++;
          break;
        }
        i++;
      }
      lastSigKind = 'exprEnd';
      lastWord = '';
      lastPunct = '';
      continue;
    }

    // 4. Template literal start '`'
    if (ch === 96) {
      i++;
      while (i < n) {
        const tc = js.charCodeAt(i);
        if (tc === 92) {
          i += 2;
          continue;
        }
        if (tc === 36 && i + 1 < n && js.charCodeAt(i + 1) === 123) {
          templateBraceStack.push(braceDepth);
          braceDepth++;
          i += 2;
          lastSigKind = 'punct';
          lastWord = '';
          lastPunct = '${';
          break;
        }
        if (tc === 96) {
          i++;
          lastSigKind = 'exprEnd';
          lastWord = '';
          lastPunct = '';
          break;
        }
        i++;
      }
      continue;
    }

    // 5. Braces `{` and `}`
    if (ch === 123) {
      braceDepth++;
      i++;
      lastSigKind = 'punct';
      lastWord = '';
      lastPunct = '{';
      continue;
    }
    if (ch === 125) {
      braceDepth = Math.max(0, braceDepth - 1);
      if (templateBraceStack.length > 0 && templateBraceStack[templateBraceStack.length - 1] === braceDepth) {
        templateBraceStack.pop();
        i++;
        while (i < n) {
          const tc = js.charCodeAt(i);
          if (tc === 92) {
            i += 2;
            continue;
          }
          if (tc === 36 && i + 1 < n && js.charCodeAt(i + 1) === 123) {
            templateBraceStack.push(braceDepth);
            braceDepth++;
            i += 2;
            lastSigKind = 'punct';
            lastWord = '';
            lastPunct = '${';
            break;
          }
          if (tc === 96) {
            i++;
            lastSigKind = 'exprEnd';
            lastWord = '';
            lastPunct = '';
            break;
          }
          i++;
        }
        continue;
      }
      i++;
      lastSigKind = 'punct';
      lastWord = '';
      lastPunct = '}';
      continue;
    }

    // 6. Parentheses `(` and `)` tracking for `if (...) /regex/`
    if (ch === 40) {
      parenCtrlStack.push(PAREN_CTRL_KEYWORDS.has(lastWord));
      i++;
      lastSigKind = 'punct';
      lastWord = '';
      lastPunct = '(';
      continue;
    }
    if (ch === 41) {
      const wasCtrl = parenCtrlStack.length > 0 ? parenCtrlStack.pop() : false;
      i++;
      lastSigKind = wasCtrl ? 'kw' : 'exprEnd';
      lastWord = '';
      lastPunct = ')';
      continue;
    }

    // 7. Numbers
    if (ch >= 48 && ch <= 57) {
      i++;
      while (i < n && (isIdentPart(js.charCodeAt(i)) || js.charCodeAt(i) === 46)) i++;
      lastSigKind = 'exprEnd';
      lastWord = '';
      lastPunct = '';
      continue;
    }

    // 8. Identifiers & Member Rewriting
    if (isIdentStart(ch)) {
      const start = i;
      i++;
      while (i < n && isIdentPart(js.charCodeAt(i))) i++;
      const ident = js.slice(start, i);

      const precededByDot = lastPunct === '.' || lastPunct === '?.' || lastPunct === '#';
      const precededByDeclKw = DECL_KEYWORDS.has(lastWord);

      if (!precededByDot && !precededByDeclKw) {
        if (GLOBAL_WINDOW_OBJS.has(ident)) {
          const m1 = readMemberChain(js, i);
          if (m1) {
            // Handle chained `window.top.location`, `window.parent.location`, `self.top.location`, etc.
            let targetMember = m1.member;
            let memEnd = m1.memEnd;
            let afterMem = m1.afterMem;

            if (
              GLOBAL_PURE_FRAME_OBJS.has(ident) &&
              (m1.member === 'top' || m1.member === 'parent' || m1.member === 'self' || m1.member === 'window')
            ) {
              const m2 = readMemberChain(js, m1.memEnd);
              if (m2 && (m2.member === 'location' || m2.member === 'origin')) {
                targetMember = m2.member;
                memEnd = m2.memEnd;
                afterMem = m2.afterMem;
              }
            }

            if (targetMember === 'location') {
              const nextCh = afterMem < n ? js.charCodeAt(afterMem) : 0;
              const nextCh2 = afterMem + 1 < n ? js.charCodeAt(afterMem + 1) : 0;
              const isDirectAssign = nextCh === 61 && nextCh2 !== 61 && nextCh2 !== 62;

              if (isDirectAssign) {
                out.push(js.slice(flushFrom, start), 'window.__rh_href =');
                flushFrom = afterMem + 1;
                i = afterMem + 1;
                lastSigKind = 'punct';
                lastWord = '';
                lastPunct = '=';
                continue;
              }

              // For `top.location` or `parent.location` (single hop), wrap safely with `__rh_loc(...)` so local `parent`/`top` vars are never clobbered
              if (MAYBE_LOCAL_FRAME_OBJS.has(ident) && memEnd === m1.memEnd) {
                const origExpr = js.slice(start, memEnd);
                out.push(
                  js.slice(flushFrom, start),
                  `(globalThis.__rh_loc?globalThis.__rh_loc(${origExpr}):${origExpr})`
                );
                flushFrom = memEnd;
                i = memEnd;
                lastSigKind = 'exprEnd';
                lastWord = '__rh_l';
                lastPunct = '';
                continue;
              }

              const repl =
                ident === 'self' || ident === 'globalThis'
                  ? '(globalThis.__rh_l||globalThis.location)'
                  : 'window.__rh_l';
              out.push(js.slice(flushFrom, start), repl);
              flushFrom = memEnd;
              i = memEnd;
              lastSigKind = 'exprEnd';
              lastWord = '__rh_l';
              lastPunct = '';
              continue;
            }

            if (targetMember === 'origin' && (GLOBAL_PURE_FRAME_OBJS.has(ident) || memEnd !== m1.memEnd)) {
              const nextCh = afterMem < n ? js.charCodeAt(afterMem) : 0;
              if (nextCh !== 61 && nextCh !== 58) {
                out.push(js.slice(flushFrom, start), '(globalThis.__rh_origin||globalThis.origin)');
                flushFrom = memEnd;
                i = memEnd;
                lastSigKind = 'exprEnd';
                lastWord = '__rh_origin';
                lastPunct = '';
                continue;
              }
            }

            // Virtualize `(window|self|globalThis).top` / `.parent` / `.frameElement`
            if (
              GLOBAL_PURE_FRAME_OBJS.has(ident) &&
              (m1.member === 'top' || m1.member === 'parent' || m1.member === 'frameElement')
            ) {
              const nextCh = afterMem < n ? js.charCodeAt(afterMem) : 0;
              const nextCh2 = afterMem + 1 < n ? js.charCodeAt(afterMem + 1) : 0;
              const isAssign = nextCh === 61 && nextCh2 !== 61 && nextCh2 !== 62;
              if (!isAssign && nextCh !== 58) {
                const repl =
                  m1.member === 'top'
                    ? `(globalThis.__rh_top?globalThis.__rh_top():${ident}.top)`
                    : m1.member === 'parent'
                    ? `(globalThis.__rh_parent?globalThis.__rh_parent():${ident}.parent)`
                    : `(globalThis.__rh_frameElement!==undefined?globalThis.__rh_frameElement:${ident}.frameElement)`;
                out.push(js.slice(flushFrom, start), repl);
                flushFrom = m1.memEnd;
                i = m1.memEnd;
                lastSigKind = 'exprEnd';
                lastWord = m1.member;
                lastPunct = '';
                continue;
              }
            }
          }
        }

        // Case B: bare `location.<LocationMember>` -> Worker-safe `(globalThis.__rh_loc?globalThis.__rh_loc(location):location).<member>`
        if (ident === 'location') {
          const m1 = readMemberChain(js, i);
          if (m1 && LOCATION_MEMBERS.has(m1.member)) {
            out.push(js.slice(flushFrom, start), '(globalThis.__rh_loc?globalThis.__rh_loc(location):location)');
            flushFrom = i; // keep `.member` intact
            lastSigKind = 'exprEnd';
            lastWord = 'location';
            lastPunct = '';
            continue;
          }
        }
      }

      if (REGEX_PREV_KEYWORDS.has(ident)) {
        lastSigKind = 'kw';
      } else {
        lastSigKind = 'exprEnd';
      }
      lastWord = ident;
      lastPunct = '';
      continue;
    }

    // 9. Multi-char & single-char punctuation
    if (ch === 63 && i + 1 < n && js.charCodeAt(i + 1) === 46) {
      i += 2;
      lastSigKind = 'punct';
      lastWord = '';
      lastPunct = '?.';
      continue;
    }
    if ((ch === 43 || ch === 45) && i + 1 < n && js.charCodeAt(i + 1) === ch) {
      i += 2;
      lastSigKind = 'exprEnd';
      lastWord = '';
      lastPunct = '';
      continue;
    }
    if (ch === 93) {
      i++;
      lastSigKind = 'exprEnd';
      lastWord = '';
      lastPunct = ']';
      continue;
    }

    i++;
    lastSigKind = 'punct';
    lastWord = '';
    lastPunct = String.fromCharCode(ch);
  }

  if (flushFrom === 0) return js;
  out.push(js.slice(flushFrom));
  return out.join('');
}

export interface RewriteHtmlOptions {
  hostCookies?: Record<string, RammerheadCookieEntry>;
}

export function rewriteHtmlForRammerhead(
  html: string,
  sessionId: string,
  upstreamUrl: string,
  proxyOriginOrOptions: string | RewriteHtmlOptions = ''
): string {
  const options: RewriteHtmlOptions =
    typeof proxyOriginOrOptions === 'object' && proxyOriginOrOptions !== null
      ? proxyOriginOrOptions
      : {};

  let upstreamObj: URL;
  try {
    upstreamObj = new URL(upstreamUrl);
  } catch {
    upstreamObj = new URL('https://example.com');
  }

  // Extract <base href="..."> if present so relative links resolve accurately against upstream base, then remove <base>
  let effectiveBase = upstreamObj;
  const baseHrefMatch = html.match(/<base\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))[^>]*>/i);
  if (baseHrefMatch) {
    const rawBaseHref = baseHrefMatch[1] ?? baseHrefMatch[2] ?? baseHrefMatch[3] ?? '';
    if (rawBaseHref) {
      try {
        effectiveBase = new URL(rawBaseHref, upstreamObj.href);
      } catch {}
    }
  }

  const upstreamOrigin = upstreamObj.origin;
  const prefix = `/api/rammerhead/${sessionId}`;

  const transformUrl = (raw: string): string => {
    const trimmed = (raw || '').trim();
    if (
      !trimmed ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('about:') ||
      trimmed.startsWith('#')
    ) {
      return raw;
    }
    if (trimmed.includes(`/${sessionId}/`)) return trimmed;

    const normalized = normalizeTargetProtocolSlashes(trimmed);
    if (/^https?:\/\//i.test(normalized)) {
      return `${prefix}/${normalized}`;
    }
    try {
      const resolved = new URL(normalized, effectiveBase.href);
      return `${prefix}/${resolved.href}`;
    } catch {
      if (normalized.startsWith('//')) {
        return `${prefix}/${upstreamObj.protocol}${normalized}`;
      }
      if (normalized.startsWith('/')) {
        return `${prefix}/${upstreamOrigin}${normalized}`;
      }
      const basePath = effectiveBase.pathname.slice(0, effectiveBase.pathname.lastIndexOf('/') + 1) || '/';
      return `${prefix}/${effectiveBase.origin}${basePath}${normalized}`;
    }
  };

  const rewriteSingleTag = (tagHtml: string): string => {
    const lowerTag = tagHtml.toLowerCase();
    // Remove frame-blocking & CSP meta tags, referrer policy, and <base>
    if (
      lowerTag.startsWith('<meta') &&
      /http-equiv\s*=\s*["']?(?:content-security-policy|x-frame-options)["']?/i.test(tagHtml)
    ) {
      return '';
    }
    if (lowerTag.startsWith('<meta') && /\bname\s*=\s*["']?referrer["']?/i.test(tagHtml)) {
      return '';
    }
    if (lowerTag.startsWith('<base')) {
      return '';
    }

    // Rewrite <meta ... http-equiv="refresh" ... content="...;url=..."> regardless of attribute order
    let out = tagHtml;
    if (lowerTag.startsWith('<meta') && /http-equiv\s*=\s*["']?refresh["']?/i.test(out)) {
      out = out.replace(
        /(\s+content\s*=\s*)(?:"([^"]*)"|'([^']*)')/i,
        (_m, pre, dVal, sVal) => {
          const quote = dVal !== undefined ? '"' : "'";
          const contentVal = dVal !== undefined ? dVal : sVal;
          const replaced = String(contentVal).replace(/(url\s*=\s*)([^;\s"']+)/i, (_u, label, target) => {
            return `${label}${transformUrl(target)}`;
          });
          return `${pre}${quote}${replaced}${quote}`;
        }
      );
    }

    // Strip SRI integrity & nonce attributes
    out = out.replace(/\s+(?:integrity|nonce)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>`]+)/gi, '');

    // Strip noreferrer from rel="..." so referer context stays intact across Rammerhead pages
    if (lowerTag.startsWith('<a') || lowerTag.startsWith('<form')) {
      out = out.replace(/(\s+rel\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi, (_m, pre, dVal, sVal) => {
        const quote = dVal !== undefined ? '"' : "'";
        const val = dVal !== undefined ? dVal : sVal;
        const cleaned = val
          .split(/\s+/)
          .filter((t: string) => t && t.toLowerCase() !== 'noreferrer')
          .join(' ');
        return `${pre}${quote}${cleaned}${quote}`;
      });
    }

    // Rewrite HTML URL attributes ONLY on whitespace boundary (prevents matching `data-action`, `:href`, etc.)
    out = out.replace(
      /(\s+)(href|src|action|poster|data-src|data-href|formaction)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi,
      (_match, ws, attr, doubleVal, singleVal, unquotedVal) => {
        const val = doubleVal !== undefined ? doubleVal : singleVal !== undefined ? singleVal : unquotedVal;
        const transformed = String(transformUrl(val)).replace(/"/g, '&quot;');
        return `${ws}${attr}="${transformed}"`;
      }
    );

    // Rewrite srcset
    out = out.replace(/(\s+)srcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (_match, ws, doubleVal, singleVal) => {
      const val = doubleVal !== undefined ? doubleVal : singleVal;
      const quote = doubleVal !== undefined ? '"' : "'";
      const parts = val.split(',').map((part: string) => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;
        const firstSpace = trimmed.search(/\s/);
        if (firstSpace === -1) return transformUrl(trimmed);
        const url = trimmed.slice(0, firstSpace);
        const descriptor = trimmed.slice(firstSpace);
        return `${transformUrl(url)}${descriptor}`;
      });
      return `${ws}srcset=${quote}${parts.join(', ')}${quote}`;
    });

    // Rewrite url(...) inside inline style="..." attributes
    if (/url\s*\(/i.test(out)) {
      out = out.replace(/(\s+style\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi, (_m, pre, dVal, sVal) => {
        const quote = dVal !== undefined ? '"' : "'";
        const val = dVal !== undefined ? dVal : sVal;
        const cssRewritten = val.replace(/\burl\(\s*([^)]+?)\s*\)/gi, (_um: string, urlContent: string) => {
          const uq = urlContent.startsWith('"') ? '"' : urlContent.startsWith("'") ? "'" : '';
          const clean = urlContent.trim().replace(/^['"]|['"]$/g, '');
          if (!clean || clean.startsWith('data:') || clean.startsWith('blob:') || clean.startsWith('#')) {
            return `url(${urlContent})`;
          }
          return `url(${uq}${transformUrl(clean)}${uq})`;
        });
        return `${pre}${quote}${cssRewritten}${quote}`;
      });
    }

    return out;
  };

  const rewriteTagSegment = (segment: string): string => {
    if (!segment || !segment.includes('<')) return segment;
    // Match individual HTML tags cleanly without touching plain visible text
    return segment.replace(/<[a-zA-Z][a-zA-Z0-9:-]*(?:\s+(?:"[^"]*"|'[^']*'|[^>"'])*)?>/g, rewriteSingleTag);
  };

  // Process HTML while protecting HTML comments, <script>, <style>, and <textarea> bodies
  const blockPattern =
    /(<!--[\s\S]*?-->)|(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)|(<textarea\b[^>]*>)([\s\S]*?)(<\/textarea>)/gi;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push(rewriteTagSegment(html.slice(lastIndex, match.index)));
    }
    if (match[1] !== undefined) {
      // HTML comment: keep untouched
      parts.push(match[1]);
    } else if (match[2] !== undefined) {
      // <script ...>body</script>
      const openTag = match[2];
      const body = match[3] || '';
      const closeTag = match[4] || '</script>';
      const rewrittenOpen = rewriteSingleTag(openTag);
      const isExternal = /\bsrc\s*=/i.test(openTag);
      const typeMatch = openTag.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const scriptType = (typeMatch?.[1] || typeMatch?.[2] || typeMatch?.[3] || '').toLowerCase().trim();
      const isDataScript =
        scriptType &&
        scriptType !== 'text/javascript' &&
        scriptType !== 'application/javascript' &&
        scriptType !== 'module';

      if (!isExternal && !isDataScript && body.trim() && !body.includes('__rammerhead_session_id')) {
        parts.push(rewrittenOpen, rewriteJsForRammerhead(body, sessionId, upstreamUrl), closeTag);
      } else {
        parts.push(rewrittenOpen, body, closeTag);
      }
    } else if (match[5] !== undefined) {
      // <style ...>body</style>
      const openTag = match[5];
      const body = match[6] || '';
      const closeTag = match[7] || '</style>';
      parts.push(rewriteSingleTag(openTag), rewriteCssForRammerhead(body, sessionId, effectiveBase.href), closeTag);
    } else if (match[8] !== undefined) {
      // <textarea ...>body</textarea>
      parts.push(rewriteSingleTag(match[8]), match[9] || '', match[10] || '</textarea>');
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    parts.push(rewriteTagSegment(html.slice(lastIndex)));
  }

  let rewritten = parts.join('');

  // Inject Rammerhead client script, virtual location bootstrap & server cookies at the start of <head>
  const injection = `
<script>
window.__rammerhead_session_id = ${JSON.stringify(sessionId)};
window.__rammerhead_origin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : '';
window.__rammerhead_upstream_url = ${JSON.stringify(upstreamUrl)};
window.__rammerhead_upstream_origin = ${JSON.stringify(upstreamOrigin)};
window.__rh_host_cookies = ${JSON.stringify(options.hostCookies || {})};
</script>
<script src="/rammerhead.js"></script>
`;

  if (/<head\b[^>]*>/i.test(rewritten)) {
    rewritten = rewritten.replace(/<head\b[^>]*>/i, `$&${injection}`);
  } else if (/<html\b[^>]*>/i.test(rewritten)) {
    rewritten = rewritten.replace(/<html\b[^>]*>/i, `$&<head>${injection}</head>`);
  } else {
    rewritten = injection + rewritten;
  }

  return rewritten;
}

export function rewriteCssForRammerhead(
  css: string,
  sessionId: string,
  upstreamUrl: string,
  _proxyOrigin: string = ''
): string {
  let upstreamObj: URL;
  try {
    upstreamObj = new URL(upstreamUrl);
  } catch {
    upstreamObj = new URL('https://example.com');
  }

  const prefix = `/api/rammerhead/${sessionId}`;

  const transformUrl = (raw: string): string => {
    const clean = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!clean || clean.startsWith('data:') || clean.startsWith('blob:') || clean.startsWith('#')) return clean;
    if (clean.includes(`/${sessionId}/`)) return clean;
    const normalized = normalizeTargetProtocolSlashes(clean);
    if (/^https?:\/\//i.test(normalized)) return `${prefix}/${normalized}`;
    try {
      const resolved = new URL(normalized, upstreamObj.href);
      return `${prefix}/${resolved.href}`;
    } catch {
      if (normalized.startsWith('//')) return `${prefix}/${upstreamObj.protocol}${normalized}`;
      if (normalized.startsWith('/')) return `${prefix}/${upstreamObj.origin}${normalized}`;
      const basePath = upstreamObj.pathname.slice(0, upstreamObj.pathname.lastIndexOf('/') + 1) || '/';
      return `${prefix}/${upstreamObj.origin}${basePath}${normalized}`;
    }
  };

  return css.replace(/\burl\(\s*([^)]+?)\s*\)/gi, (_match, urlContent) => {
    const quote = urlContent.startsWith('"') ? '"' : urlContent.startsWith("'") ? "'" : '';
    const transformed = transformUrl(urlContent);
    return `url(${quote}${transformed}${quote})`;
  });
}
