import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import zlib from 'zlib';
import { promisify } from 'util';
import {
  RammerheadSession,
  RammerheadCookieEntry,
  generateRammerheadSessionId,
  isValidRammerheadSessionId,
  extractRammerheadSessionAndUrl,
  extractHostMatchedCookies,
  normalizeCaptchaChallengeUrl,
  rewriteHtmlForRammerhead,
  rewriteCssForRammerhead,
  rewriteJsForRammerhead,
  parseSetCookieHeader,
  mergeCookieRecordMap,
  buildCookieHeaderForUrl,
  FORBIDDEN_FORWARD_HEADERS,
  STRIPPED_UPSTREAM_HEADERS,
  STRIPPED_STREAM_HEADERS,
} from '../utils/rammerheadCore';
import { enforceSafeSearchOffUrl } from '../utils/safeSearchOff';
import { unfilteredLookup } from './dohResolver';

const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);

const MAX_REWRITE_TEXT_BYTES = 24 * 1024 * 1024; // 24 MB cap for HTML/CSS rewriting

// Persistent HTTP/HTTPS Keep-Alive agents tuned for chunked YouTube video playback without socket churn
const rhHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 128,
  maxFreeSockets: 32,
  lookup: unfilteredLookup as any,
});

const rhHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 128,
  maxFreeSockets: 32,
  rejectUnauthorized: false,
  lookup: unfilteredLookup as any,
});

export interface RammerheadYoutubeHooks {
  fetchYoutubeVrPlayer?: (videoId: string) => Promise<Record<string, any> | null>;
  patchYtInitialPlayerResponseHtml?: (html: string, vrData: Record<string, any>) => string | null;
  streamYoutubeVideo?: (req: express.Request, res: express.Response, videoId: string) => Promise<void>;
}

const sessionStore = new Map<string, RammerheadSession>();
let globalCookieStore: Record<string, { cookies: Record<string, RammerheadCookieEntry>; updatedAt: number }> = {};
let sessionStoreFilePath = '';
let cookieStoreFilePath = '';
let saveSessionsTimer: NodeJS.Timeout | null = null;
let saveCookiesTimer: NodeJS.Timeout | null = null;

// Rammerhead Config matching user spec (10-year timeout, saveSessions=true, enableIpCheck=false)
export const RAMMERHEAD_SERVER_CONFIG = {
  sessionTimeout: 315360000000, // 10 years in ms
  saveSessions: true,
  enableIpCheck: false,
};

function atomicWriteJson(filePath: string, data: unknown) {
  if (!filePath) return;
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch {}
}

function scheduleSaveSessions() {
  if (!sessionStoreFilePath || !RAMMERHEAD_SERVER_CONFIG.saveSessions) return;
  if (saveSessionsTimer) return;
  saveSessionsTimer = setTimeout(() => {
    saveSessionsTimer = null;
    atomicWriteJson(sessionStoreFilePath, Array.from(sessionStore.values()));
  }, 400);
}

function scheduleSaveCookies() {
  if (!cookieStoreFilePath) return;
  if (saveCookiesTimer) return;
  saveCookiesTimer = setTimeout(() => {
    saveCookiesTimer = null;
    atomicWriteJson(cookieStoreFilePath, globalCookieStore);
  }, 300);
}

function loadStoresFromDisk() {
  if (cookieStoreFilePath && fs.existsSync(cookieStoreFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(cookieStoreFilePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        globalCookieStore = parsed;
      }
    } catch {}
  }

  if (sessionStoreFilePath && fs.existsSync(sessionStoreFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(sessionStoreFilePath, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.id && isValidRammerheadSessionId(item.id)) {
            const id = item.id.toLowerCase();
            const restoredJar = mergeCookieRecordMap(
              globalCookieStore['default']?.cookies,
              mergeCookieRecordMap(globalCookieStore[id]?.cookies, item.cookieJar)
            );
            sessionStore.set(id, {
              id,
              createdAt: item.createdAt || Date.now(),
              lastUsedAt: Date.now(),
              httpProxy: item.httpProxy || '',
              enableShuffling: Boolean(item.enableShuffling),
              cookies: item.cookies || {},
              cookieJar: restoredJar,
            });
          }
        }
      }
    } catch {}
  }
}

export function getOrCreateRammerheadSession(id?: string): RammerheadSession {
  const cleanId = id && isValidRammerheadSessionId(id) ? id.toLowerCase() : '';
  if (cleanId && sessionStore.has(cleanId)) {
    const sess = sessionStore.get(cleanId)!;
    sess.lastUsedAt = Date.now();
    // Always ensure default persistent cookies are merged cleanly (never reset)
    if (globalCookieStore['default']?.cookies) {
      sess.cookieJar = mergeCookieRecordMap(sess.cookieJar, globalCookieStore['default'].cookies);
    }
    return sess;
  }

  const newId = cleanId || generateRammerheadSessionId();
  const baseJar = mergeCookieRecordMap(
    globalCookieStore['default']?.cookies,
    globalCookieStore[newId]?.cookies
  );
  const session: RammerheadSession = {
    id: newId,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    cookies: {},
    cookieJar: baseJar,
  };
  sessionStore.set(newId, session);
  scheduleSaveSessions();
  return session;
}

export function getActiveFallbackSessionId(): string {
  let bestId = '';
  let bestTs = -1;
  for (const [id, sess] of sessionStore.entries()) {
    if ((sess.lastUsedAt || 0) > bestTs) {
      bestTs = sess.lastUsedAt || 0;
      bestId = id;
    }
  }
  return bestId || getOrCreateRammerheadSession().id;
}

function persistUpstreamSetCookies(
  session: RammerheadSession,
  rawSetCookies: string | string[] | undefined,
  requestHost: string
): Record<string, RammerheadCookieEntry> {
  if (!rawSetCookies) return {};
  const arr = Array.isArray(rawSetCookies) ? rawSetCookies : [rawSetCookies];
  const parsedBatch: Record<string, RammerheadCookieEntry> = {};
  let addedCount = 0;

  for (const raw of arr) {
    const parsed = parseSetCookieHeader(String(raw), requestHost);
    if (parsed) {
      parsedBatch[parsed.key] = parsed.entry;
      addedCount++;
    }
  }
  if (addedCount === 0) return {};

  session.cookieJar = mergeCookieRecordMap(session.cookieJar, parsedBatch);
  const now = Date.now();
  globalCookieStore['default'] = {
    cookies: mergeCookieRecordMap(globalCookieStore['default']?.cookies, parsedBatch),
    updatedAt: now,
  };
  globalCookieStore[session.id] = {
    cookies: mergeCookieRecordMap(globalCookieStore[session.id]?.cookies, parsedBatch),
    updatedAt: now,
  };
  scheduleSaveSessions();
  scheduleSaveCookies();
  return parsedBatch;
}

function isJsResponse(rawCt: string, pathname: string): boolean {
  if (rawCt.includes('javascript') || rawCt.includes('ecmascript')) return true;
  if (!rawCt && /\.(?:m?js|cjs)(\?|$)/i.test(pathname)) return true;
  return false;
}

function isMediaOrBinaryStream(targetUrl: URL, req: express.Request, upstreamHeaders: http.IncomingHttpHeaders): boolean {
  const host = targetUrl.hostname.toLowerCase();
  const pathname = targetUrl.pathname.toLowerCase();
  const ct = String(upstreamHeaders['content-type'] || '').toLowerCase();

  if (ct.includes('text/html') || ct.includes('text/css') || isJsResponse(ct, pathname)) {
    return false;
  }
  if (
    host.includes('googlevideo.com') ||
    pathname.includes('/videoplayback') ||
    Boolean(req.headers['range']) ||
    ct.startsWith('video/') ||
    ct.startsWith('audio/') ||
    ct === 'application/octet-stream' ||
    /\.(mp4|webm|m4s|m4a|mp3|ogg|wav|ts|m3u8|wasm|bin|pak|dat|zip)(\?|$)/i.test(pathname)
  ) {
    return true;
  }
  return false;
}

function isAbortOrResetError(err: any): boolean {
  const code = String(err?.code || '');
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  return (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    code === 'ERR_HTTP2_PROTOCOL_ERROR' ||
    code === 'ABORT_ERR' ||
    name === 'AbortError' ||
    msg.includes('aborted') ||
    msg.includes('premature close')
  );
}

export function initRammerheadEngine(
  app: express.Express,
  baseDir: string,
  youtubeHooks?: RammerheadYoutubeHooks
) {
  const uploadsDir = path.resolve(baseDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  sessionStoreFilePath = path.join(uploadsDir, 'rammerhead_sessions.json');
  cookieStoreFilePath = path.join(uploadsDir, 'rammerhead_cookies_store.json');
  loadStoresFromDisk();

  const setCorsHeaders = (res: express.Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
  };

  // 1. Static asset: /rammerhead.js
  const rammerheadJsPath = path.resolve(baseDir, 'public', 'rammerhead.js');
  const serveRammerheadJs = (_req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, max-age=60');
    if (fs.existsSync(rammerheadJsPath)) {
      res.sendFile(rammerheadJsPath);
    } else {
      res.status(404).send('// rammerhead.js not found');
    }
  };
  app.get('/rammerhead.js', serveRammerheadJs);
  app.get('/api/rammerhead/rammerhead.js', serveRammerheadJs);

  // 2. Persistent Additive Cookie API (NEVER resets cookies)
  app.get('/api/rammerhead/cookies', (req, res) => {
    setCorsHeaders(res);
    try {
      const userId = String(req.query.userId || 'default').trim() || 'default';
      const sessionId = String(req.query.sessionId || '').trim().toLowerCase();
      const baseEntry = globalCookieStore['default']?.cookies || {};
      const userEntry = globalCookieStore[userId]?.cookies || {};
      const sessEntry = isValidRammerheadSessionId(sessionId)
        ? sessionStore.get(sessionId)?.cookieJar || globalCookieStore[sessionId]?.cookies || {}
        : {};
      const combined = mergeCookieRecordMap(mergeCookieRecordMap(baseEntry, userEntry), sessEntry);
      res.json({ success: true, cookies: combined, updatedAt: Date.now() });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to read Rammerhead cookies', message: err?.message });
    }
  });

  app.post('/api/rammerhead/cookies', express.json({ limit: '10mb' }), (req, res) => {
    setCorsHeaders(res);
    try {
      const { userId = 'default', sessionId = '', cookies } = req.body || {};
      if (!cookies || typeof cookies !== 'object') {
        return res.status(400).json({ error: 'Missing cookies object' });
      }
      const now = Date.now();
      const mergedDefault = mergeCookieRecordMap(globalCookieStore['default']?.cookies, cookies);
      globalCookieStore['default'] = { cookies: mergedDefault, updatedAt: now };

      const cleanUserId = String(userId || 'default').trim() || 'default';
      const mergedUser = mergeCookieRecordMap(globalCookieStore[cleanUserId]?.cookies, cookies);
      globalCookieStore[cleanUserId] = { cookies: mergedUser, updatedAt: now };

      const cleanSessionId = String(sessionId || '').trim().toLowerCase();
      if (isValidRammerheadSessionId(cleanSessionId)) {
        const sess = getOrCreateRammerheadSession(cleanSessionId);
        sess.cookieJar = mergeCookieRecordMap(sess.cookieJar, cookies);
        globalCookieStore[cleanSessionId] = { cookies: sess.cookieJar, updatedAt: now };
        scheduleSaveSessions();
      }
      scheduleSaveCookies();
      res.json({ success: true, cookies: mergedUser, updatedAt: now });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save Rammerhead cookies', message: err?.message });
    }
  });

  // 3. Rammerhead Session API Endpoints
  const handleNewSession = (_req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    const session = getOrCreateRammerheadSession();
    res.send(session.id);
  };
  app.get('/newsession', handleNewSession);
  app.post('/newsession', handleNewSession);
  app.get('/api/rammerhead/newsession', handleNewSession);
  app.post('/api/rammerhead/newsession', handleNewSession);

  const handleSessionExists = (req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    const id = String(req.query.id || req.query.sessionId || '').trim().toLowerCase();
    if (!id) {
      return res.status(400).send('Must specify id parameter');
    }
    if (isValidRammerheadSessionId(id)) {
      getOrCreateRammerheadSession(id);
      return res.send('exists');
    }
    res.send('not found');
  };
  app.get('/sessionexists', handleSessionExists);
  app.get('/api/rammerhead/sessionexists', handleSessionExists);

  const handleEditSession = (req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    const id = String(req.query.id || '').trim().toLowerCase();
    if (!id || !isValidRammerheadSessionId(id)) {
      return res.status(400).send('not found');
    }
    const sess = getOrCreateRammerheadSession(id);
    if (typeof req.query.httpProxy === 'string') {
      sess.httpProxy = req.query.httpProxy.replace(/^http:\/\//, '');
    }
    if (req.query.enableShuffling === '1') sess.enableShuffling = true;
    if (req.query.enableShuffling === '0') sess.enableShuffling = false;
    scheduleSaveSessions();
    res.send('Success');
  };
  app.get('/editsession', handleEditSession);
  app.get('/api/rammerhead/editsession', handleEditSession);

  // Never wipe cookies even if client calls deletesession
  const handleDeleteSession = (_req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    res.send('Success');
  };
  app.get('/deletesession', handleDeleteSession);
  app.get('/api/rammerhead/deletesession', handleDeleteSession);

  const handleNeedPassword = (_req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    res.send('false');
  };
  app.get('/needpassword', handleNeedPassword);
  app.get('/api/rammerhead/needpassword', handleNeedPassword);

  // Return empty string so Rammerhead never injects `:3000` or localhost port into HTTPS origins
  const handleMainPort = (_req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    res.send('');
  };
  app.get('/mainport', handleMainPort);
  app.get('/api/rammerhead/mainport', handleMainPort);

  // 4. Rammerhead Core Proxy Request Handler (HTTP/HTTPS streaming + YouTube stability + zero localhost)
  const handleProxyRequest = async (req: express.Request, res: express.Response) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    const referer = req.headers['referer'] as string | undefined;
    const extracted = extractRammerheadSessionAndUrl(req.originalUrl || req.url, referer);

    if (!extracted || !isValidRammerheadSessionId(extracted.sessionId)) {
      return res.status(400).send('Invalid Rammerhead session or URL');
    }

    const { sessionId, targetUrl } = extracted;
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      return res.status(400).send('Missing or invalid target URL for Rammerhead proxy');
    }

    const session = getOrCreateRammerheadSession(sessionId);

    const requestHostHeader = String(req.get('x-forwarded-host') || req.get('host') || '')
      .split(',')[0]
      .trim()
      .split(':')[0]
      .toLowerCase();
    const refererInfo = referer ? extractRammerheadSessionAndUrl(referer) : null;

    let parsedTarget: URL;
    try {
      parsedTarget = normalizeCaptchaChallengeUrl(
        enforceSafeSearchOffUrl(new URL(targetUrl)),
        refererInfo?.targetUrl,
        requestHostHeader
      );
    } catch {
      return res.status(400).send('Invalid target URL structure');
    }

    const host = parsedTarget.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      (requestHostHeader && host === requestHostHeader) ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return res.status(403).send('Self or private network proxy request disallowed');
    }

    // Intercept FrostHub resilient YouTube video stream inside Rammerhead session
    if (
      youtubeHooks?.streamYoutubeVideo &&
      host.includes('youtube.com') &&
      parsedTarget.pathname.includes('__frost_yt_stream__')
    ) {
      const vid = parsedTarget.searchParams.get('v') || '';
      if (vid) {
        return youtubeHooks.streamYoutubeVideo(req, res, vid);
      }
    }

    const isLikelyMedia =
      host.includes('googlevideo.com') ||
      parsedTarget.pathname.toLowerCase().includes('/videoplayback') ||
      Boolean(req.headers['range']);

    // Collect request body safely if POST/PUT/PATCH
    let reqBodyBuf: Buffer | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (Buffer.isBuffer(req.body)) {
        reqBodyBuf = req.body;
      } else if (typeof req.body === 'string') {
        reqBodyBuf = Buffer.from(req.body, 'utf8');
      } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        reqBodyBuf = Buffer.from(JSON.stringify(req.body), 'utf8');
      } else if (!req.readableEnded) {
        reqBodyBuf = await new Promise<Buffer | null>((resolve) => {
          const chunks: Buffer[] = [];
          let total = 0;
          req.on('data', (c: Buffer) => {
            total += c.length;
            if (total <= 32 * 1024 * 1024) chunks.push(c);
          });
          req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : null));
          req.on('error', () => resolve(null));
        });
      }
    }

    const forwardHeaders: Record<string, string> = {};
    for (const [hdrKey, hdrVal] of Object.entries(req.headers)) {
      if (hdrVal === undefined) continue;
      const lower = hdrKey.toLowerCase();
      if (
        FORBIDDEN_FORWARD_HEADERS.has(lower) ||
        lower === 'cookie' ||
        lower === 'referer' ||
        lower === 'origin' ||
        lower.startsWith('sec-') ||
        lower.startsWith('x-forwarded-') ||
        lower.startsWith('cf-') ||
        lower === 'x-real-ip'
      ) {
        continue;
      }
      forwardHeaders[hdrKey] = Array.isArray(hdrVal) ? hdrVal.join(', ') : String(hdrVal);
    }

    forwardHeaders['User-Agent'] =
      (req.headers['user-agent'] as string) ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    forwardHeaders['Accept'] = (req.headers['accept'] as string) || '*/*';
    forwardHeaders['Accept-Language'] = (req.headers['accept-language'] as string) || 'en-US,en;q=0.9';
    forwardHeaders['Accept-Encoding'] = isLikelyMedia ? 'identity' : 'gzip, deflate, br';

    if (reqBodyBuf) {
      forwardHeaders['Content-Length'] = String(reqBodyBuf.length);
    }

    // Domain-scoped additive Cookie header (NEVER leaks proxy cookies, preserves logins)
    const matchedCookies = buildCookieHeaderForUrl(session.cookieJar, session.cookies, parsedTarget);
    if (matchedCookies) {
      forwardHeaders['Cookie'] = matchedCookies;
    }

    if (host.includes('youtube.com') || host.includes('googlevideo.com') || host.includes('ytimg.com')) {
      forwardHeaders['Referer'] = 'https://www.youtube.com/';
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        forwardHeaders['Origin'] = 'https://www.youtube.com';
      }
    } else {
      let upstreamRef = parsedTarget.origin + '/';
      let upstreamReqOrigin = parsedTarget.origin;
      if (refererInfo?.targetUrl && /^https?:\/\//i.test(refererInfo.targetUrl)) {
        try {
          const refU = new URL(refererInfo.targetUrl);
          upstreamRef = refU.href;
          upstreamReqOrigin = refU.origin;
        } catch {}
      }
      forwardHeaders['Referer'] = upstreamRef;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        forwardHeaders['Origin'] = upstreamReqOrigin;
      }
    }

    const isHttps = parsedTarget.protocol === 'https:';
    const lib = isHttps ? https : http;
    const timeoutMs = isLikelyMedia ? 120000 : 30000;

    let upstreamReq: http.ClientRequest | null = null;
    let upstreamResStream: http.IncomingMessage | null = null;
    let closed = false;

    const cleanupUpstream = () => {
      if (closed) return;
      closed = true;
      try {
        upstreamResStream?.removeAllListeners('data');
        upstreamResStream?.destroy();
      } catch {}
      try {
        upstreamReq?.destroy();
      } catch {}
    };

    req.on('aborted', cleanupUpstream);
    res.on('close', () => {
      if (!res.writableEnded) {
        cleanupUpstream();
      }
    });

    try {
      upstreamReq = lib.request(
        {
          protocol: parsedTarget.protocol,
          hostname: parsedTarget.hostname,
          port: Number(parsedTarget.port || (isHttps ? 443 : 80)),
          path: parsedTarget.pathname + parsedTarget.search,
          method: req.method,
          headers: forwardHeaders,
          agent: isHttps ? rhHttpsAgent : rhHttpAgent,
          maxHeaderSize: 131072,
        } as any,
        async (upRes) => {
          upstreamResStream = upRes;
          upRes.on('error', (err) => {
            cleanupUpstream();
            if (!isAbortOrResetError(err)) {
              console.warn('[Rammerhead upstream stream error]:', err?.message || err);
            }
            if (!res.headersSent) {
              try { res.status(502).end(); } catch {}
            } else {
              try { res.end(); } catch {}
            }
          });

          try {
            // Capture and persistently merge Set-Cookie headers
            const capturedCookies = upRes.headers['set-cookie']
              ? persistUpstreamSetCookies(session, upRes.headers['set-cookie'], host)
              : {};
            const hasCapturedCookies = Object.keys(capturedCookies).length > 0;

            const attachCookieSyncHeaders = () => {
              if (!hasCapturedCookies) return;
              res.setHeader('X-Rammerhead-Has-Cookies', '1');
              try {
                const encoded = encodeURIComponent(JSON.stringify(capturedCookies));
                if (encoded.length <= 3600) {
                  res.setHeader('X-Rammerhead-Cookie-Sync', encoded);
                }
              } catch {}
            };

            const statusCode = upRes.statusCode || 200;

            // Handle 3xx redirects manually so cookies persist and Location never points to localhost
            if ([301, 302, 303, 307, 308].includes(statusCode) && upRes.headers.location) {
              upRes.resume();
              try {
                const resolvedLoc = normalizeCaptchaChallengeUrl(
                  enforceSafeSearchOffUrl(new URL(String(upRes.headers.location), parsedTarget.href)),
                  refererInfo?.targetUrl,
                  requestHostHeader
                ).href;
                setCorsHeaders(res);
                attachCookieSyncHeaders();
                res.setHeader('Location', `/api/rammerhead/${sessionId}/${resolvedLoc}`);
                res.setHeader('Cache-Control', 'no-store');
                return res.status(statusCode).end();
              } catch {}
            }

            const rawCt = String(upRes.headers['content-type'] || '').toLowerCase();
            const isHtml = rawCt.includes('text/html');
            const isCss = rawCt.includes('text/css');
            const isJs = !isHtml && !isCss && isJsResponse(rawCt, parsedTarget.pathname.toLowerCase());
            const streamDirectly =
              req.method === 'HEAD' ||
              statusCode === 204 ||
              statusCode === 304 ||
              (!isHtml && !isCss && !isJs) ||
              isMediaOrBinaryStream(parsedTarget, req, upRes.headers) ||
              statusCode === 206 ||
              Number(upRes.headers['content-length'] || 0) > MAX_REWRITE_TEXT_BYTES;

            // Fast streaming pass-through for media/JSON/binary (strip upstream Set-Cookie from FrostHub origin!)
            if (streamDirectly) {
              setCorsHeaders(res);
              attachCookieSyncHeaders();
              for (const [k, v] of Object.entries(upRes.headers)) {
                if (v === undefined) continue;
                const lower = k.toLowerCase();
                if (lower === 'set-cookie' || STRIPPED_STREAM_HEADERS.has(lower) || FORBIDDEN_FORWARD_HEADERS.has(lower)) {
                  continue;
                }
                res.setHeader(k, v);
              }
              res.setHeader('X-Accel-Buffering', 'no');
              if (!res.getHeader('Cache-Control')) {
                res.setHeader('Cache-Control', 'no-transform');
              }
              res.status(statusCode);
              if (req.method === 'HEAD' || statusCode === 204 || statusCode === 304) {
                upRes.resume();
                return res.end();
              }
              upRes.pipe(res);
              res.on('error', () => cleanupUpstream());
              return;
            }

            // Buffer text/html, text/css, and JavaScript cleanly up to cap for rewriting
            const chunks: Buffer[] = [];
            let totalBytes = 0;
            let overflowed = false;

            await new Promise<void>((resolve, reject) => {
              upRes.on('data', (chunk: Buffer) => {
                totalBytes += chunk.length;
                if (totalBytes > MAX_REWRITE_TEXT_BYTES) {
                  overflowed = true;
                  resolve();
                  return;
                }
                chunks.push(chunk);
              });
              upRes.on('end', () => resolve());
              upRes.on('error', (err) => reject(err));
            });

            if (closed) return;

            if (overflowed) {
              setCorsHeaders(res);
              attachCookieSyncHeaders();
              res.status(statusCode);
              for (const b of chunks) {
                if (!res.writableEnded) res.write(b);
              }
              upRes.pipe(res);
              return;
            }

            let rawBuf: Buffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, totalBytes);
            chunks.length = 0;
            const enc = String(upRes.headers['content-encoding'] || '').toLowerCase().trim();
            if (rawBuf.length > 0 && enc) {
              try {
                if (enc === 'gzip' || enc === 'x-gzip') rawBuf = Buffer.from(await gunzipAsync(rawBuf));
                else if (enc === 'deflate') rawBuf = Buffer.from(await inflateAsync(rawBuf));
                else if (enc === 'br') rawBuf = Buffer.from(await brotliDecompressAsync(rawBuf));
              } catch {}
            }

            setCorsHeaders(res);
            attachCookieSyncHeaders();
            for (const [k, v] of Object.entries(upRes.headers)) {
              if (v === undefined) continue;
              const lower = k.toLowerCase();
              if (lower === 'set-cookie' || STRIPPED_UPSTREAM_HEADERS.has(lower) || FORBIDDEN_FORWARD_HEADERS.has(lower)) {
                continue;
              }
              res.setHeader(k, v);
            }

            let textBody = rawBuf.toString('utf8');

            if (isHtml) {
              // Automatically recover YouTube /watch pages from bot-gate or unstable player formats
              if (
                (host === 'www.youtube.com' || host === 'm.youtube.com') &&
                parsedTarget.pathname === '/watch' &&
                youtubeHooks?.fetchYoutubeVrPlayer &&
                youtubeHooks?.patchYtInitialPlayerResponseHtml
              ) {
                const videoId = parsedTarget.searchParams.get('v') || '';
                const looksBlocked =
                  textBody.includes('"status":"LOGIN_REQUIRED"') ||
                  textBody.includes('"status":"UNPLAYABLE"') ||
                  !textBody.includes('"streamingData"');
                if (videoId && looksBlocked) {
                  try {
                    const vrData = await youtubeHooks.fetchYoutubeVrPlayer(videoId);
                    if (vrData) {
                      const patched = youtubeHooks.patchYtInitialPlayerResponseHtml(textBody, vrData);
                      if (patched) textBody = patched;
                    }
                  } catch {}
                }
              }

              const hostCookies = extractHostMatchedCookies(session.cookieJar, parsedTarget);
              const rewrittenHtml = rewriteHtmlForRammerhead(textBody, sessionId, parsedTarget.href, { hostCookies });
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              return res.status(statusCode).send(rewrittenHtml);
            }

            if (isJs) {
              const rewrittenJs = rewriteJsForRammerhead(textBody, sessionId, parsedTarget.href);
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              return res.status(statusCode).send(rewrittenJs);
            }

            const rewrittenCss = rewriteCssForRammerhead(textBody, sessionId, parsedTarget.href);
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            return res.status(statusCode).send(rewrittenCss);
          } catch (innerErr: any) {
            cleanupUpstream();
            if (!isAbortOrResetError(innerErr) && !res.headersSent) {
              res.status(502).json({
                error: 'Rammerhead response processing failed',
                message: innerErr?.message || 'Stream error',
              });
            }
          }
        }
      );

      upstreamReq.setTimeout(timeoutMs, () => {
        upstreamReq?.destroy(new Error('Upstream request timeout'));
      });

      upstreamReq.on('error', (err) => {
        cleanupUpstream();
        if (isAbortOrResetError(err) || res.headersSent) {
          try { if (!res.writableEnded) res.end(); } catch {}
          return;
        }
        res.status(502).json({
          error: 'Rammerhead upstream fetch failed',
          message: err?.message || 'Error communicating with target host',
        });
      });

      if (reqBodyBuf && reqBodyBuf.length > 0) {
        upstreamReq.write(reqBodyBuf);
      }
      upstreamReq.end();
    } catch (err: any) {
      cleanupUpstream();
      if (res.headersSent || isAbortOrResetError(err)) return;
      res.status(502).json({
        error: 'Rammerhead upstream fetch failed',
        message: err?.message || 'Error communicating with target host',
      });
    }
  };

  // Register Rammerhead proxy routes
  app.all('/api/rammerhead/:sessionId/*', handleProxyRequest);
  app.all('/api/rammerhead/:sessionId', handleProxyRequest);
  app.all('/:sessionId/*', (req, res, next) => {
    const rawSessionId = req.params.sessionId;
    if (isValidRammerheadSessionId(rawSessionId)) {
      return handleProxyRequest(req, res);
    }
    next();
  });
}
