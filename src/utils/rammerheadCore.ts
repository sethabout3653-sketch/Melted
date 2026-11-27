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
 * Strictly additive merge: NEVER deletes or blanks out an existing cookie value,
 * and extends past expirations so Rammerhead logins/preferences stay alive.
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
      const ex = merged[k] || ({} as Partial<RammerheadCookieEntry>);
      const combined: RammerheadCookieEntry = {
        name: String(v.name || ex.name || k.split('||').pop() || '').trim(),
        value: typeof v.value === 'string' ? v.value : String(ex.value || ''),
        domain: String(v.domain || ex.domain || '').toLowerCase().replace(/^\.+/, ''),
        path: String(v.path || ex.path || '/'),
        secure: v.secure ?? ex.secure ?? true,
        sameSite: v.sameSite || ex.sameSite || 'Lax',
        expires: minFuture,
        updatedAt: Date.now(),
      };
      if (!combined.name) continue;
      // Preserve existing non-empty value if incoming tried to wipe/clear it
      if (
        typeof ex.value === 'string' &&
        ex.value.length > 0 &&
        (v.value === '' || v.value === undefined || v.value === null)
      ) {
        combined.value = ex.value;
      }
      if (typeof v.expires === 'number' && Number.isFinite(v.expires)) {
        combined.expires = Math.max(v.expires, minFuture);
      } else if (typeof ex.expires === 'number' && Number.isFinite(ex.expires)) {
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
  const reqPath = targetUrl.pathname || '/';
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

export function rewriteHtmlForRammerhead(
  html: string,
  sessionId: string,
  upstreamUrl: string,
  _proxyOrigin: string = ''
): string {
  const lowerUpstream = (upstreamUrl || '').toLowerCase();
  if (
    lowerUpstream.includes('recaptcha') ||
    lowerUpstream.includes('hcaptcha') ||
    lowerUpstream.includes('turnstile') ||
    lowerUpstream.includes('challenges.cloudflare') ||
    lowerUpstream.includes('/sorry/')
  ) {
    return html;
  }

  let upstreamObj: URL;
  try {
    upstreamObj = new URL(upstreamUrl);
  } catch {
    upstreamObj = new URL('https://example.com');
  }

  // Extract <base href="..."> if present so relative links resolve accurately against upstream base, then remove <base>
  let effectiveBase = upstreamObj;
  const baseHrefMatch = html.match(/<base\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/i);
  if (baseHrefMatch) {
    const rawBaseHref = baseHrefMatch[1] ?? baseHrefMatch[2] ?? '';
    if (rawBaseHref) {
      try {
        effectiveBase = new URL(rawBaseHref, upstreamObj.href);
      } catch {}
    }
  }

  const upstreamOrigin = upstreamObj.origin;
  // Root-relative prefix (`/api/rammerhead/${sessionId}`) so browser uses real origin & Cloudflare Workers routes cleanly
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

  // 1. Strip CSP / X-Frame-Options / Referrer meta tags and upstream <base> tags + SRI integrity/nonce attributes
  let rewritten = html
    .replace(/<meta[^>]+http-equiv=["']?(?:Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']?(?:referrer)["']?[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/\s+(?:integrity|nonce)=("[^"]*"|'[^']*')/gi, '');

  // Rewrite <meta http-equiv="refresh" content="...; url=...">
  rewritten = rewritten.replace(
    /(<meta[^>]+http-equiv=["']?refresh["']?[^>]*\bcontent=)(["'])([^"']*)(["'])/gi,
    (_m, pre, q1, contentVal, q2) => {
      const replaced = String(contentVal).replace(/(url\s*=\s*)([^;\s"']+)/i, (_u, label, target) => {
        return `${label}${transformUrl(target)}`;
      });
      return `${pre}${q1}${replaced}${q2}`;
    }
  );

  // 2. Rewrite HTML URL attributes (href, src, action, poster, data-src, data-href, formaction)
  rewritten = rewritten.replace(
    /\b(href|src|action|poster|data-src|data-href|formaction)=("([^"]*)"|'([^']*)')/gi,
    (_match, attr, _quoted, doubleVal, singleVal) => {
      const val = doubleVal !== undefined ? doubleVal : singleVal;
      const quote = doubleVal !== undefined ? '"' : "'";
      const transformed = transformUrl(val);
      return `${attr}=${quote}${transformed}${quote}`;
    }
  );

  // 3. Rewrite srcset
  rewritten = rewritten.replace(/\bsrcset=("([^"]*)"|'([^']*)')/gi, (_match, _quoted, doubleVal, singleVal) => {
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
    return `srcset=${quote}${parts.join(', ')}${quote}`;
  });

  // 4. Rewrite inline <style> url(...) references
  rewritten = rewritten.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, openTag, cssBody, closeTag) => {
    return `${openTag}${rewriteCssForRammerhead(cssBody, sessionId, effectiveBase.href)}${closeTag}`;
  });

  // 5. Inject Rammerhead client script and bootstrap variables at the beginning of <head>
  const injection = `
<script>
window.__rammerhead_session_id = ${JSON.stringify(sessionId)};
window.__rammerhead_origin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : '';
window.__rammerhead_upstream_url = ${JSON.stringify(upstreamUrl)};
window.__rammerhead_upstream_origin = ${JSON.stringify(upstreamOrigin)};
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
