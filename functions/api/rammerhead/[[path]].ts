// Cloudflare Pages / Workers Function: Rammerhead Proxy, Persistent Cookie Store & Session API
import {
  generateRammerheadSessionId,
  isValidRammerheadSessionId,
  extractRammerheadSessionAndUrl,
  rewriteHtmlForRammerhead,
  rewriteCssForRammerhead,
  parseSetCookieHeader,
  mergeCookieRecordMap,
  buildCookieHeaderForUrl,
  STRIPPED_UPSTREAM_HEADERS,
  STRIPPED_STREAM_HEADERS,
  FORBIDDEN_FORWARD_HEADERS,
  type RammerheadCookieEntry,
} from '../../../src/utils/rammerheadCore';
import { enforceSafeSearchOffUrl, sanitizeSafeSearchSetCookie } from '../../../src/utils/safeSearchOff';

interface CFContext {
  request: Request;
  env?: Record<string, any>;
  params?: { path?: string | string[] };
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  'X-Frame-Options': 'ALLOWALL',
};

const edgeSessionStore = new Set<string>();
const edgeCookieMemory = new Map<string, { cookies: Record<string, RammerheadCookieEntry>; updatedAt: number }>();

async function readCookieBucket(env: Record<string, any> | undefined, key: string) {
  const mem = edgeCookieMemory.get(key) || { cookies: {}, updatedAt: 0 };
  const kv = env?.SCRAMJET_COOKIES || env?.RAMMERHEAD_COOKIES;
  if (kv) {
    try {
      const fromKv = await kv.get(`rammerhead:${key}`, 'json');
      if (fromKv && typeof fromKv === 'object') {
        const merged = mergeCookieRecordMap(mem.cookies, (fromKv as any).cookies);
        const rec = { cookies: merged, updatedAt: Math.max(mem.updatedAt, (fromKv as any).updatedAt || 0) };
        edgeCookieMemory.set(key, rec);
        return rec;
      }
    } catch {}
  }
  return mem;
}

async function writeCookieBucket(
  env: Record<string, any> | undefined,
  key: string,
  incoming: Record<string, any>
) {
  const cur = await readCookieBucket(env, key);
  const merged = mergeCookieRecordMap(cur.cookies, incoming);
  const next = { cookies: merged, updatedAt: Date.now() };
  edgeCookieMemory.set(key, next);
  const kv = env?.SCRAMJET_COOKIES || env?.RAMMERHEAD_COOKIES;
  if (kv) {
    try {
      await kv.put(`rammerhead:${key}`, JSON.stringify(next));
    } catch {}
  }
  return next;
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const pathname = url.pathname;

  // 0. Persistent Additive Cookie Sync Endpoint (/api/rammerhead/cookies)
  if (pathname === '/api/rammerhead/cookies' || pathname.endsWith('/api/rammerhead/cookies')) {
    if (request.method === 'GET') {
      const userId = url.searchParams.get('userId') || 'default';
      const sessionId = (url.searchParams.get('sessionId') || '').toLowerCase();
      const base = await readCookieBucket(env, 'default');
      const user = await readCookieBucket(env, userId);
      const sess = isValidRammerheadSessionId(sessionId)
        ? await readCookieBucket(env, sessionId)
        : { cookies: {}, updatedAt: 0 };
      const combined = mergeCookieRecordMap(mergeCookieRecordMap(base.cookies, user.cookies), sess.cookies);
      return new Response(JSON.stringify({ success: true, cookies: combined, updatedAt: Date.now() }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as {
          userId?: string;
          sessionId?: string;
          cookies?: Record<string, any>;
        };
        if (!body?.cookies || typeof body.cookies !== 'object') {
          return new Response(JSON.stringify({ error: 'Missing cookies object' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        await writeCookieBucket(env, 'default', body.cookies);
        const saved = await writeCookieBucket(env, body.userId || 'default', body.cookies);
        if (body.sessionId && isValidRammerheadSessionId(body.sessionId)) {
          await writeCookieBucket(env, body.sessionId.toLowerCase(), body.cookies);
        }
        return new Response(JSON.stringify({ success: true, cookies: saved.cookies, updatedAt: saved.updatedAt }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Invalid JSON' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // 1. Session API routes
  if (pathname === '/newsession' || pathname.endsWith('/newsession')) {
    const newId = generateRammerheadSessionId();
    edgeSessionStore.add(newId);
    return new Response(newId, { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } });
  }

  if (pathname === '/sessionexists' || pathname.endsWith('/sessionexists')) {
    const id = (url.searchParams.get('id') || url.searchParams.get('sessionId') || '').trim().toLowerCase();
    const exists = isValidRammerheadSessionId(id);
    if (exists) edgeSessionStore.add(id);
    return new Response(exists ? 'exists' : 'not found', {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
    });
  }

  if (
    pathname === '/editsession' ||
    pathname.endsWith('/editsession') ||
    pathname === '/deletesession' ||
    pathname.endsWith('/deletesession')
  ) {
    return new Response('Success', { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } });
  }

  if (pathname === '/needpassword' || pathname.endsWith('/needpassword')) {
    return new Response('false', { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } });
  }

  if (pathname === '/mainport' || pathname.endsWith('/mainport')) {
    return new Response('', { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } });
  }

  // 2. Proxy request
  const referer = request.headers.get('referer') || undefined;
  const extracted = extractRammerheadSessionAndUrl(pathname + url.search, referer);

  if (!extracted || !isValidRammerheadSessionId(extracted.sessionId) || !extracted.targetUrl) {
    return new Response('Invalid Rammerhead session or URL', { status: 400, headers: CORS_HEADERS });
  }

  const { sessionId, targetUrl } = extracted;

  let parsedTarget: URL;
  try {
    parsedTarget = enforceSafeSearchOffUrl(new URL(targetUrl));
  } catch {
    return new Response('Invalid target URL structure', { status: 400, headers: CORS_HEADERS });
  }

  const host = parsedTarget.hostname.toLowerCase();
  const edgeHost = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    (edgeHost && host === edgeHost) ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    return new Response('Self or private network proxy request disallowed', { status: 403, headers: CORS_HEADERS });
  }

  try {
    const forwardHeaders = new Headers();
    forwardHeaders.set(
      'User-Agent',
      request.headers.get('user-agent') ||
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    forwardHeaders.set('Accept', request.headers.get('accept') || '*/*');
    forwardHeaders.set('Accept-Language', 'en-US,en;q=0.9');
    if (request.headers.has('range')) {
      forwardHeaders.set('Range', request.headers.get('range')!);
    }
    if (request.headers.has('if-range')) {
      forwardHeaders.set('If-Range', request.headers.get('if-range')!);
    }
    if (request.headers.has('content-type')) {
      forwardHeaders.set('Content-Type', request.headers.get('content-type')!);
    }

    const baseBucket = await readCookieBucket(env, 'default');
    const sessBucket = await readCookieBucket(env, sessionId);
    const mergedJar = mergeCookieRecordMap(baseBucket.cookies, sessBucket.cookies);
    const cookieHeader = buildCookieHeaderForUrl(mergedJar, undefined, parsedTarget);
    if (cookieHeader) {
      forwardHeaders.set('Cookie', cookieHeader);
    }

    if (host.includes('youtube.com') || host.includes('googlevideo.com') || host.includes('ytimg.com')) {
      forwardHeaders.set('Referer', 'https://www.youtube.com/');
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        forwardHeaders.set('Origin', 'https://www.youtube.com');
      }
    } else {
      forwardHeaders.set('Referer', parsedTarget.origin + '/');
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        forwardHeaders.set('Origin', parsedTarget.origin);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstreamRes = await fetch(parsedTarget.href, {
      method: request.method,
      headers: forwardHeaders,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Capture Set-Cookie persistently (never resets cookies)
    const setCookies = (upstreamRes.headers as any).getSetCookie?.() || [];
    if (Array.isArray(setCookies) && setCookies.length > 0) {
      const parsedBatch: Record<string, RammerheadCookieEntry> = {};
      for (const rawC of setCookies) {
        const parsed = parseSetCookieHeader(String(rawC), host);
        if (parsed) parsedBatch[parsed.key] = parsed.entry;
      }
      if (Object.keys(parsedBatch).length > 0) {
        await writeCookieBucket(env, 'default', parsedBatch);
        await writeCookieBucket(env, sessionId, parsedBatch);
      }
    }

    // Rewrite 3xx redirect Location manually to keep session + stay off localhost
    if ([301, 302, 303, 307, 308].includes(upstreamRes.status) && upstreamRes.headers.has('location')) {
      const loc = upstreamRes.headers.get('location')!;
      const resolvedLoc = enforceSafeSearchOffUrl(new URL(loc, parsedTarget.href)).href;
      const redirHeaders = new Headers(CORS_HEADERS);
      redirHeaders.set('Location', `/api/rammerhead/${sessionId}/${resolvedLoc}`);
      redirHeaders.set('Cache-Control', 'no-store');
      return new Response(null, { status: upstreamRes.status, headers: redirHeaders });
    }

    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
    const isHtml = contentType.includes('text/html');
    const isCss = contentType.includes('text/css');

    const resHeaders = new Headers(CORS_HEADERS);
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (lower === 'set-cookie') {
        resHeaders.append('Set-Cookie', sanitizeSafeSearchSetCookie(host, val));
        return;
      }
      if (isHtml || isCss) {
        if (!STRIPPED_UPSTREAM_HEADERS.has(lower) && !FORBIDDEN_FORWARD_HEADERS.has(lower)) {
          resHeaders.set(key, val);
        }
      } else {
        // Keep Content-Range / Content-Length intact for video/binary/media streams
        if (
          lower !== 'content-encoding' &&
          !STRIPPED_STREAM_HEADERS.has(lower) &&
          !FORBIDDEN_FORWARD_HEADERS.has(lower)
        ) {
          resHeaders.set(key, val);
        }
      }
    });

    if (isHtml) {
      const rawHtml = await upstreamRes.text();
      const rewrittenHtml = rewriteHtmlForRammerhead(rawHtml, sessionId, parsedTarget.href);
      resHeaders.set('Content-Type', 'text/html; charset=utf-8');
      resHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return new Response(rewrittenHtml, { status: upstreamRes.status, headers: resHeaders });
    }

    if (isCss) {
      const rawCss = await upstreamRes.text();
      const rewrittenCss = rewriteCssForRammerhead(rawCss, sessionId, parsedTarget.href);
      resHeaders.set('Content-Type', 'text/css; charset=utf-8');
      return new Response(rewrittenCss, { status: upstreamRes.status, headers: resHeaders });
    }

    if (!resHeaders.has('Cache-Control')) {
      resHeaders.set('Cache-Control', 'no-transform');
    }
    return new Response(upstreamRes.body, { status: upstreamRes.status, headers: resHeaders });
  } catch (err: any) {
    return new Response(`Rammerhead upstream fetch failed: ${err?.message || 'Error communicating with target host'}`, {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}
