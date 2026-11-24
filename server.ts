import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import https from 'https';
import tls from 'tls';
import zlib from 'zlib';
import { promisify } from 'util';
import { Readable } from 'stream';
import { initWebSocketDatabase, globalWsDb, broadcastTable, broadcastWss, sendToUserSockets } from './src/server/wsDatabase';
import { server as wispServer } from '@mercuryworkshop/wisp-js/server';
import { createSplitRoutingWispTCPSocket, dialSocks5Tunnel } from './src/server/wispSocks5Socket';
import { Ytdl, Client as YtdlClient } from '@distube/ytdl-core';
import { processGameHtml, getScaffoldingBuffer } from './src/server/scaffoldingLoader';
import { FALLBACK_OPENROUTER_MODELS, OPENROUTER_CHAT_URL, OPENROUTER_MODEL } from './src/utils/openRouterEdgeHelper';
import { buildAISystemInstruction } from './src/data/aiAssistantPrompt';
import { initSethsrcEngine } from './src/server/sethsrcEngine';
import {
  ESRB_ORIGIN,
  OFFICIAL_ESRB_IMAGE_PATHS,
  fetchEsrbRatingDetailed,
  isValidEsrbBadgePath,
  normalizeRatingLookupKey,
} from './src/utils/esrbRatingCore';
import type { EsrbRatingCode, GameRatingInfo } from './src/types/game';

// Prevent server crashes from unhandled fetch terminations / ECONNRESET errors
process.on('uncaughtException', (err) => {
  console.warn('[Server Uncaught Exception - Handled]:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Unhandled Rejection - Handled]:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? process.argv[portArgIdx + 1] : undefined;
const PORT = cliPort || process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Initialize Sethsrc HLS Streaming & Reverse Proxy Engine
initSethsrcEngine(app, __dirname);

// Mount Scramjet 2.0.67-alpha.2 runtime, WASM, Controller, and Epoxy v3 / Libcurl v2 transport assets locally
const scramjetDistDir = path.resolve(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist');
const controllerDistDir = path.resolve(__dirname, 'node_modules/@mercuryworkshop/scramjet-controller/dist');
const epoxyDistDir = path.resolve(__dirname, 'node_modules/@mercuryworkshop/epoxy-transport/dist');
const libcurlDistDir = path.resolve(__dirname, 'node_modules/@mercuryworkshop/libcurl-transport/dist');

const setStaticAssetHeaders = (res: express.Response, reqPath: string) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  if (reqPath.endsWith('.wasm')) {
    res.setHeader('Content-Type', 'application/wasm');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
  } else if (reqPath.endsWith('.js') || reqPath.endsWith('.mjs')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
};

app.use('/scramjet', (req, res, next) => {
  setStaticAssetHeaders(res, req.path);
  next();
}, express.static(scramjetDistDir, { maxAge: '7d' }));

app.use('/epoxy', (req, res, next) => {
  setStaticAssetHeaders(res, req.path);
  next();
}, express.static(epoxyDistDir, { maxAge: '7d' }));

app.use('/libcurl', (req, res, next) => {
  setStaticAssetHeaders(res, req.path);
  next();
}, express.static(libcurlDistDir, { maxAge: '7d' }));

app.use('/controller', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  if (req.path.endsWith('.js') || req.path.endsWith('.mjs')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  next();
}, express.static(controllerDistDir, { maxAge: 0 }));

app.get('/sj-sw.js', (_req, res) => {
  const swPath = IS_PROD
    ? path.resolve(__dirname, 'dist/sj-sw.js')
    : path.resolve(__dirname, 'public/sj-sw.js');
  const fallbackSwPath = path.resolve(__dirname, 'public/sj-sw.js');
  const targetSwPath = fs.existsSync(swPath) ? swPath : fallbackSwPath;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(targetSwPath);
});

interface ResolvedYoutubeStream {
  videoId: string;
  url: string;
  proxyUrlStr: string | null;
  contentType: string;
  contentLength?: number;
  playerResponse: Record<string, any>;
  expiresAt: number;
}

const ytStreamCache = new Map<string, ResolvedYoutubeStream>();
const ytStreamPending = new Map<string, Promise<ResolvedYoutubeStream | null>>();
const YT_STICKY_PROXY_SLOTS: Array<string | null> = [
  'socks5h://vncwbxva:d65j8vqe2th9@45.38.107.97:6014',
  'http://vncwbxva-3:d65j8vqe2th9@p.webshare.io:80/',
  'http://vncwbxva-4:d65j8vqe2th9@p.webshare.io:80/',
  'http://vncwbxva-6:d65j8vqe2th9@p.webshare.io:80/',
  'http://vncwbxva-1:d65j8vqe2th9@p.webshare.io:80/',
  null,
];

function openProxyHttpStream(
  rawUrl: string,
  proxyUrlStr: string | null,
  method: string,
  headersObj: Record<string, string>,
  bodyBuf: Buffer | null,
  timeoutMs = 15000,
  maxRedirects = 5
): Promise<{ status: number; statusText: string; headers: http.IncomingHttpHeaders; stream: http.IncomingMessage; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    let targetUrl: URL;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return reject(new Error('Invalid stream URL'));
    }

    const doSingleRequest = (currentUrl: URL, hopsLeft: number) => {
      const isHttps = currentUrl.protocol === 'https:';
      const targetPort = Number(currentUrl.port || (isHttps ? 443 : 80));

      const handleUpstreamResponse = (upRes: http.IncomingMessage, upReqRef: http.ClientRequest, cleanupFn: () => void) => {
        const status = upRes.statusCode || 200;
        const loc = upRes.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && loc && hopsLeft > 0) {
          upReqRef.removeAllListeners('error');
          upReqRef.on('error', () => {});
          upRes.resume();
          cleanupFn();
          try {
            const nextUrl = new URL(loc, currentUrl);
            doSingleRequest(nextUrl, hopsLeft - 1);
          } catch (err) {
            reject(err);
          }
          return;
        }
        resolve({
          status,
          statusText: upRes.statusMessage || '',
          headers: upRes.headers,
          stream: upRes,
          cleanup: cleanupFn,
        });
      };

      if (!proxyUrlStr) {
        const lib = isHttps ? https : http;
        const upReq = lib.request(
          {
            protocol: currentUrl.protocol,
            hostname: currentUrl.hostname,
            port: targetPort,
            path: currentUrl.pathname + currentUrl.search,
            method,
            headers: headersObj,
            maxHeaderSize: 131072,
          } as any,
          (upRes) => handleUpstreamResponse(upRes, upReq, () => {
            try { upReq.destroy(); } catch {}
          })
        );
        upReq.setTimeout(timeoutMs, () => upReq.destroy(new Error('Direct stream timeout')));
        upReq.on('error', reject);
        if (bodyBuf && bodyBuf.length > 0) upReq.write(bodyBuf);
        upReq.end();
        return;
      }

      let proxyUrl: URL;
      try {
        proxyUrl = new URL(proxyUrlStr);
      } catch {
        return reject(new Error('Invalid proxy URL'));
      }
      if (proxyUrl.protocol === 'socks5:' || proxyUrl.protocol === 'socks5h:') {
        dialSocks5Tunnel(proxyUrl, currentUrl.hostname, targetPort, 8000)
          .then((tunnelSocket) => {
            if (isHttps) {
              const tlsSocket = tls.connect({
                socket: tunnelSocket,
                servername: currentUrl.hostname,
                rejectUnauthorized: false,
              });
              tlsSocket.on('error', () => {
                try { tlsSocket.destroy(); } catch {}
              });
              const upReq = https.request(
                {
                  protocol: currentUrl.protocol,
                  hostname: currentUrl.hostname,
                  port: targetPort,
                  path: currentUrl.pathname + currentUrl.search,
                  method,
                  headers: headersObj,
                  maxHeaderSize: 131072,
                  createConnection: () => tlsSocket,
                } as any,
                (upRes) => handleUpstreamResponse(upRes, upReq, () => {
                  try { upReq.destroy(); } catch {}
                  try { tlsSocket.destroy(); } catch {}
                })
              );
              upReq.setTimeout(timeoutMs, () => upReq.destroy(new Error('SOCKS5H stream timeout')));
              upReq.on('error', reject);
              if (bodyBuf && bodyBuf.length > 0) upReq.write(bodyBuf);
              upReq.end();
            } else {
              const upReq = http.request(
                {
                  protocol: currentUrl.protocol,
                  hostname: currentUrl.hostname,
                  port: targetPort,
                  path: currentUrl.pathname + currentUrl.search,
                  method,
                  headers: headersObj,
                  maxHeaderSize: 131072,
                  createConnection: () => tunnelSocket,
                } as any,
                (upRes) => handleUpstreamResponse(upRes, upReq, () => {
                  try { upReq.destroy(); } catch {}
                  try { tunnelSocket.destroy(); } catch {}
                })
              );
              upReq.setTimeout(timeoutMs, () => upReq.destroy(new Error('SOCKS5H HTTP stream timeout')));
              upReq.on('error', reject);
              if (bodyBuf && bodyBuf.length > 0) upReq.write(bodyBuf);
              upReq.end();
            }
          })
          .catch(reject);
        return;
      }

      const proxyIsHttps = proxyUrl.protocol === 'https:';
      const proxyLib = proxyIsHttps ? https : http;
      const proxyAuth =
        proxyUrl.username || proxyUrl.password
          ? `Basic ${Buffer.from(
              `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`
            ).toString('base64')}`
          : '';

      if (isHttps) {
        const connectHeaders: Record<string, string> = {
          Host: `${currentUrl.hostname}:${targetPort}`,
        };
        if (proxyAuth) connectHeaders['Proxy-Authorization'] = proxyAuth;
        const connectReq = proxyLib.request({
          hostname: proxyUrl.hostname,
          port: Number(proxyUrl.port || (proxyIsHttps ? 443 : 80)),
          method: 'CONNECT',
          path: `${currentUrl.hostname}:${targetPort}`,
          headers: connectHeaders,
        });
        connectReq.setTimeout(8000, () => {
          connectReq.destroy(new Error('Proxy CONNECT timeout'));
        });
        connectReq.on('error', reject);
        connectReq.on('connect', (res, tunnelSocket) => {
          if (res.statusCode !== 200) {
            tunnelSocket.destroy();
            reject(new Error(`Proxy CONNECT HTTP ${res.statusCode}`));
            return;
          }
          const tlsSocket = tls.connect({
            socket: tunnelSocket,
            servername: currentUrl.hostname,
            rejectUnauthorized: false,
          });
          tlsSocket.on('error', () => {
            try { tlsSocket.destroy(); } catch {}
          });
          const upReq = https.request(
            {
              protocol: currentUrl.protocol,
              hostname: currentUrl.hostname,
              port: targetPort,
              path: currentUrl.pathname + currentUrl.search,
              method,
              headers: headersObj,
              maxHeaderSize: 131072,
              createConnection: () => tlsSocket,
            } as any,
            (upRes) => handleUpstreamResponse(upRes, upReq, () => {
              try { upReq.destroy(); } catch {}
              try { tlsSocket.destroy(); } catch {}
            })
          );
          upReq.setTimeout(timeoutMs, () => {
            upReq.destroy(new Error('Proxied stream timeout'));
          });
          upReq.on('error', reject);
          if (bodyBuf && bodyBuf.length > 0) upReq.write(bodyBuf);
          upReq.end();
        });
        connectReq.end();
      } else {
        const proxiedHeaders: Record<string, string> = { ...headersObj };
        if (proxyAuth) proxiedHeaders['proxy-authorization'] = proxyAuth;
        const upReq = proxyLib.request(
          {
            hostname: proxyUrl.hostname,
            port: Number(proxyUrl.port || (proxyIsHttps ? 443 : 80)),
            path: currentUrl.href,
            method,
            headers: proxiedHeaders,
            maxHeaderSize: 131072,
          } as any,
          (upRes) => handleUpstreamResponse(upRes, upReq, () => {
            try { upReq.destroy(); } catch {}
          })
        );
        upReq.setTimeout(timeoutMs, () => upReq.destroy(new Error('Proxied HTTP timeout')));
        upReq.on('error', reject);
        if (bodyBuf && bodyBuf.length > 0) upReq.write(bodyBuf);
        upReq.end();
      }
    };

    doSingleRequest(targetUrl, maxRedirects);
  });
}

function createTunnelFetch(proxyUrlStr: string | null): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET').toUpperCase();
    const hdrObj: Record<string, string> = {};
    const addHeader = (k: string, v: string) => {
      const lower = k.toLowerCase();
      if (lower === 'host' || lower === 'content-length' || lower === 'connection') return;
      hdrObj[lower] = v;
    };
    if (typeof input !== 'string' && !(input instanceof URL) && input.headers) {
      input.headers.forEach((v, k) => addHeader(k, v));
    }
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => addHeader(k, v));
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) addHeader(k, v);
      } else {
        for (const [k, v] of Object.entries(init.headers)) {
          if (v !== undefined) addHeader(k, String(v));
        }
      }
    }
    if (!hdrObj['accept-language']) hdrObj['accept-language'] = 'en-US,en;q=0.9';
    hdrObj['accept-encoding'] = 'gzip, deflate, br';

    let bodyBuf: Buffer | null = null;
    if (init?.body && method !== 'GET' && method !== 'HEAD') {
      if (typeof init.body === 'string') bodyBuf = Buffer.from(init.body, 'utf8');
      else if (Buffer.isBuffer(init.body)) bodyBuf = init.body;
      else if (init.body instanceof ArrayBuffer) bodyBuf = Buffer.from(init.body);
      else if (ArrayBuffer.isView(init.body)) bodyBuf = Buffer.from(init.body.buffer, init.body.byteOffset, init.body.byteLength);
      if (bodyBuf) hdrObj['content-length'] = String(bodyBuf.length);
    }

    const upstream = await openProxyHttpStream(rawUrl, proxyUrlStr, method, hdrObj, bodyBuf, 12000, 5);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      upstream.stream.on('data', (c: Buffer) => chunks.push(c));
      upstream.stream.on('error', reject);
      upstream.stream.on('end', () => resolve());
    });
    let rawBuf: Buffer = Buffer.concat(chunks);
    const enc = String(upstream.headers['content-encoding'] || '').toLowerCase().trim();
    if (rawBuf.length > 0) {
      try {
        if (enc === 'gzip' || enc === 'x-gzip') rawBuf = Buffer.from(await gunzipAsync(rawBuf));
        else if (enc === 'deflate') rawBuf = Buffer.from(await inflateAsync(rawBuf));
        else if (enc === 'br') rawBuf = Buffer.from(await brotliDecompressAsync(rawBuf));
      } catch {}
    }

    const outHeaders = new Headers();
    for (const [k, v] of Object.entries(upstream.headers)) {
      const lower = k.toLowerCase();
      if (lower === 'content-encoding' || lower === 'content-length' || lower === 'transfer-encoding') continue;
      if (Array.isArray(v)) {
        for (const item of v) outHeaders.append(k, item);
      } else if (v !== undefined) {
        outHeaders.set(k, String(v));
      }
    }
    const isNullStatus = upstream.status === 204 || upstream.status === 205 || upstream.status === 304 || upstream.status === 101;
    return new Response(isNullStatus ? null : new Uint8Array(rawBuf), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  };
}

async function verifyYoutubeStreamUrl(
  streamUrl: string,
  proxyUrlStr: string | null
): Promise<{ ok: boolean; contentType: string; contentLength?: number }> {
  try {
    const res = await openProxyHttpStream(
      streamUrl,
      proxyUrlStr,
      'GET',
      {
        Range: 'bytes=0-127',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Referer: 'https://www.youtube.com/',
        'Accept-Encoding': 'identity',
      },
      null,
      7000,
      5
    );
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve) => {
      res.stream.on('data', (c: Buffer) => chunks.push(c));
      res.stream.on('end', () => resolve());
      res.stream.on('error', () => resolve());
    });
    res.cleanup();
    const ct = String(res.headers['content-type'] || 'video/mp4').split(';')[0].trim() || 'video/mp4';
    const contentRange = String(res.headers['content-range'] || '');
    const totalMatch = contentRange.match(/\/(\d+)$/);
    const totalLen = totalMatch ? Number(totalMatch[1]) : undefined;
    const byteCount = Buffer.concat(chunks).length;
    const isVideoOrOctet = ct.startsWith('video/') || ct.startsWith('audio/') || ct === 'application/octet-stream';
    if ((res.status === 200 || res.status === 206) && byteCount > 0 && isVideoOrOctet) {
      return { ok: true, contentType: ct, contentLength: totalLen };
    }
    return { ok: false, contentType: ct };
  } catch {
    return { ok: false, contentType: 'video/mp4' };
  }
}

async function resolvePlayableYoutubeStream(videoId: string, forceRefresh = false): Promise<ResolvedYoutubeStream | null> {
  if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    return null;
  }

  if (!forceRefresh) {
    const cached = ytStreamCache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
  } else {
    ytStreamCache.delete(videoId);
  }

  const inflight = ytStreamPending.get(videoId);
  if (inflight) return inflight;

  const task = (async (): Promise<ResolvedYoutubeStream | null> => {
    for (const proxyUrlStr of YT_STICKY_PROXY_SLOTS) {
      const tunnelFetch = createTunnelFetch(proxyUrlStr);

      // Strategy 1: ANDROID_VR client over this sticky slot (excels on music & Vevo videos without PO token)
      try {
        const vrRes = await tunnelFetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
          },
          body: JSON.stringify({
            videoId,
            context: {
              client: {
                clientName: 'ANDROID_VR',
                clientVersion: '1.60.19',
                deviceMake: 'Oculus',
                deviceModel: 'Quest 3',
                osName: 'Android',
                osVersion: '12L',
                hl: 'en',
                gl: 'US',
              },
            },
          }),
        });
        if (vrRes.ok) {
          const vrJson = (await vrRes.json()) as Record<string, any>;
          const formats = Array.isArray(vrJson?.streamingData?.formats) ? vrJson.streamingData.formats : [];
          const bestMuxed = formats.find((f: any) => f?.url && String(f.mimeType || '').includes('video/mp4')) || formats.find((f: any) => f?.url);
          if (vrJson?.playabilityStatus?.status === 'OK' && bestMuxed?.url) {
            const check = await verifyYoutubeStreamUrl(bestMuxed.url, proxyUrlStr);
            if (check.ok) {
              const entry: ResolvedYoutubeStream = {
                videoId,
                url: bestMuxed.url,
                proxyUrlStr,
                contentType: check.contentType,
                contentLength: check.contentLength,
                playerResponse: vrJson,
                expiresAt: Date.now() + 20 * 60 * 1000,
              };
              ytStreamCache.set(videoId, entry);
              return entry;
            }
          }
        }
      } catch {}

      // Strategy 2: @distube/ytdl-core over the exact same sticky slot (handles cipher + PO token + standard/embed videos)
      try {
        const ytdl = new Ytdl({
          fetch: tunnelFetch,
          clients: [YtdlClient.WebEmbedded, YtdlClient.Tv, YtdlClient.Mweb],
          lang: 'en',
          country: 'US',
          timeoutMs: 8000,
        });
        const info = await ytdl.getInfo(videoId);
        const muxedMp4 = info.formats.filter(
          (f) => f.hasVideo && f.hasAudio && f.url && (f.mimeType || '').includes('mp4')
        );
        const muxedAny = info.formats.filter((f) => f.hasVideo && f.hasAudio && f.url);
        const candidates = [...muxedMp4, ...muxedAny];
        for (const fmt of candidates) {
          if (!fmt.url) continue;
          const check = await verifyYoutubeStreamUrl(fmt.url, proxyUrlStr);
          if (check.ok) {
            const syntheticPlayer: Record<string, any> = {
              playabilityStatus: { status: 'OK', playableInEmbed: true },
              videoDetails: {
                videoId,
                title: info.videoDetails?.title || 'YouTube Video',
                author: info.videoDetails?.author?.name || '',
                lengthSeconds: String(info.videoDetails?.lengthSeconds || 0),
                isLiveContent: Boolean(info.videoDetails?.isLive),
              },
              streamingData: {
                expiresInSeconds: '21540',
                formats: [
                  {
                    itag: fmt.itag || 18,
                    url: `https://www.youtube.com/__frost_yt_stream__?v=${encodeURIComponent(videoId)}`,
                    mimeType: fmt.mimeType || 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
                    width: fmt.width || 640,
                    height: fmt.height || 360,
                    qualityLabel: fmt.qualityLabel || '360p',
                    contentLength: check.contentLength ? String(check.contentLength) : undefined,
                  },
                ],
                adaptiveFormats: [],
              },
            };
            const entry: ResolvedYoutubeStream = {
              videoId,
              url: fmt.url,
              proxyUrlStr,
              contentType: check.contentType,
              contentLength: check.contentLength,
              playerResponse: syntheticPlayer,
              expiresAt: Date.now() + 20 * 60 * 1000,
            };
            ytStreamCache.set(videoId, entry);
            return entry;
          }
        }
      } catch {}
    }

    return null;
  })();

  ytStreamPending.set(videoId, task);
  try {
    return await task;
  } finally {
    ytStreamPending.delete(videoId);
  }
}



async function fetchYoutubeVrPlayer(videoId: string): Promise<Record<string, any> | null> {
  const resolved = await resolvePlayableYoutubeStream(videoId);
  if (!resolved) return null;
  // Always return a copy whose muxed URL routes via __frost_yt_stream__ so client playback never hits IP-bound 403s
  const cloned = JSON.parse(JSON.stringify(resolved.playerResponse)) as Record<string, any>;
  if (Array.isArray(cloned?.streamingData?.formats)) {
    cloned.streamingData.formats = cloned.streamingData.formats.map((f: any) => ({
      ...f,
      url: `https://www.youtube.com/__frost_yt_stream__?v=${encodeURIComponent(videoId)}`,
    }));
  }
  return cloned;
}

function patchYtInitialPlayerResponseHtml(
  html: string,
  vrData: Record<string, any>
): string | null {
  const marker = 'var ytInitialPlayerResponse = ';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) return null;
  try {
    const parsed = JSON.parse(html.slice(start, end)) as Record<string, any>;
    const patched = {
      ...parsed,
      playabilityStatus: vrData.playabilityStatus || { status: 'OK', playableInEmbed: true },
      streamingData: vrData.streamingData || parsed.streamingData,
      videoDetails: parsed.videoDetails || vrData.videoDetails,
      captions: parsed.captions || vrData.captions,
      storyboards: parsed.storyboards || vrData.storyboards,
    };
    return html.slice(0, start) + JSON.stringify(patched) + html.slice(end);
  } catch {
    return null;
  }
}

const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);
const MAX_SC_FETCH_BYTES = 40 * 1024 * 1024;

// Persistent Keep-Alive agents for warm TCP/TLS socket reuse across requests
const stickyHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 64,
});
const stickyHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 64,
  rejectUnauthorized: false,
});

function getProxyPoolList(): string[] {
  const envRaw = [process.env.SOCKS5_URL || '', process.env.RESIDENTIAL_PROXY_URL || '', process.env.PROXY_POOL_URLS || '']
    .join(',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return envRaw;
}

function hashSessionIndex(sessionId: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % mod;
}

function resolveStickyProxyUrl(sessionId: string, slotOffset = 0): URL | null {
  const pool = getProxyPoolList();
  if (pool.length === 0) return null;
  let idx = 0;
  if (pool.length === 1) {
    idx = 0;
  } else if (slotOffset === 0) {
    // Slot 0 uses the primary user-configured Webshare SOCKS5H proxy
    idx = 0;
  } else {
    idx = 1 + ((hashSessionIndex(sessionId || 'default', pool.length - 1) + slotOffset - 1) % (pool.length - 1));
  }
  const rawTemplate = pool[idx].replace(/\{session\}/gi, encodeURIComponent(sessionId || 'default'));
  try {
    return new URL(rawTemplate);
  } catch {
    return null;
  }
}

function readUpstreamResponseStream(
  upRes: http.IncomingMessage,
  upReq: http.ClientRequest,
  resolve: (val: { status: number; statusText: string; rawHeaders: string[]; body: Buffer }) => void,
  reject: (err: unknown) => void,
  cleanupSocket?: () => void
) {
  let settled = false;
  const fail = (err: unknown) => {
    if (settled) return;
    settled = true;
    cleanupSocket?.();
    reject(err);
  };

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  upRes.on('data', (chunk: Buffer) => {
    if (settled) return;
    totalBytes += chunk.length;
    if (totalBytes > MAX_SC_FETCH_BYTES) {
      upRes.destroy();
      upReq.destroy();
      fail(new Error('Upstream response exceeded size limit'));
      return;
    }
    chunks.push(chunk);
  });
  upRes.on('error', fail);
  upRes.on('end', async () => {
    if (settled) return;
    let rawBuf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, totalBytes);
    chunks.length = 0;
    const enc = String(upRes.headers['content-encoding'] || '').toLowerCase().trim();
    if (rawBuf.length > 0) {
      try {
        if (enc === 'gzip' || enc === 'x-gzip') {
          rawBuf = await gunzipAsync(rawBuf);
        } else if (enc === 'deflate') {
          rawBuf = await inflateAsync(rawBuf);
        } else if (enc === 'br') {
          rawBuf = await brotliDecompressAsync(rawBuf);
        }
      } catch {
        // Keep raw bytes if decompression fails or body is already plain/empty
      }
    }
    if (settled) return;
    settled = true;
    resolve({
      status: upRes.statusCode || 200,
      statusText: upRes.statusMessage || '',
      rawHeaders: upRes.rawHeaders || [],
      body: rawBuf,
    });
  });

  return fail;
}

function performDirectUpstreamRequest(
  targetUrl: URL,
  method: string,
  headersObj: Record<string, string>,
  bodyBuf: Buffer | null,
  timeoutMs = 60000
): Promise<{
  status: number;
  statusText: string;
  rawHeaders: string[];
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const isHttps = targetUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    const reqOpts: http.RequestOptions & { maxHeaderSize?: number } = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method,
      headers: headersObj,
      agent: isHttps ? stickyHttpsAgent : stickyHttpAgent,
      maxHeaderSize: 131072, // Allow 128KB+ response headers (fixes YouTube UND_ERR_HEADERS_OVERFLOW)
    };

    const upReq = lib.request(reqOpts, (upRes) => {
      readUpstreamResponseStream(upRes, upReq, resolve, reject);
    });

    upReq.setTimeout(timeoutMs, () => {
      upReq.destroy(new Error('Upstream request timeout'));
    });
    upReq.on('error', reject);
    if (bodyBuf && bodyBuf.length > 0) {
      upReq.write(bodyBuf);
    }
    upReq.end();
  });
}

function performRawUpstreamRequest(
  targetUrl: URL,
  method: string,
  headersObj: Record<string, string>,
  bodyBuf: Buffer | null,
  timeoutMs = 60000,
  sessionId = 'default',
  slotOffset = 0
): Promise<{
  status: number;
  statusText: string;
  rawHeaders: string[];
  body: Buffer;
}> {
  const isHttps = targetUrl.protocol === 'https:';
  const proxyUrl = resolveStickyProxyUrl(sessionId, slotOffset);

  if (!proxyUrl) {
    return performDirectUpstreamRequest(targetUrl, method, headersObj, bodyBuf, timeoutMs);
  }

  if (proxyUrl.protocol === 'socks5:' || proxyUrl.protocol === 'socks5h:') {
    const targetPort = Number(targetUrl.port || (isHttps ? 443 : 80));
    return new Promise((resolve, reject) => {
      let settled = false;
      const fallbackToDirect = () => {
        if (settled) return;
        settled = true;
        performDirectUpstreamRequest(targetUrl, method, headersObj, bodyBuf, timeoutMs)
          .then(resolve)
          .catch(reject);
      };

      dialSocks5Tunnel(proxyUrl, targetUrl.hostname, targetPort, 8000)
        .then((tunnelSocket) => {
          if (isHttps) {
            const tlsSocket = tls.connect({
              socket: tunnelSocket,
              servername: targetUrl.hostname,
              rejectUnauthorized: false,
            });
            tlsSocket.on('error', () => {
              try {
                tlsSocket.destroy();
              } catch {}
              fallbackToDirect();
            });
            const upReq = https.request(
              {
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                port: targetPort,
                path: targetUrl.pathname + targetUrl.search,
                method,
                headers: headersObj,
                maxHeaderSize: 131072,
                createConnection: () => tlsSocket,
              } as any,
              (upRes) => {
                if (settled) return;
                settled = true;
                readUpstreamResponseStream(upRes, upReq, resolve, reject, () => {
                  try {
                    tlsSocket.destroy();
                  } catch {}
                });
              }
            );
            upReq.setTimeout(timeoutMs, () => {
              upReq.destroy(new Error('Upstream SOCKS5H request timeout'));
            });
            upReq.on('error', (err) => {
              if (settled) reject(err);
              else fallbackToDirect();
            });
            if (bodyBuf && bodyBuf.length > 0) upReq.write(bodyBuf);
            upReq.end();
          } else {
            const upReq = http.request(
              {
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                port: targetPort,
                path: targetUrl.pathname + targetUrl.search,
                method,
                headers: headersObj,
                maxHeaderSize: 131072,
                createConnection: () => tunnelSocket,
              } as any,
              (upRes) => {
                if (settled) return;
                settled = true;
                readUpstreamResponseStream(upRes, upReq, resolve, reject, () => {
                  try {
                    tunnelSocket.destroy();
                  } catch {}
                });
              }
            );
            upReq.setTimeout(timeoutMs, () => {
              upReq.destroy(new Error('Upstream SOCKS5H HTTP timeout'));
            });
            upReq.on('error', (err) => {
              if (settled) reject(err);
              else fallbackToDirect();
            });
            if (bodyBuf && bodyBuf.length > 0) upReq.write(bodyBuf);
            upReq.end();
          }
        })
        .catch(() => fallbackToDirect());
    });
  }

  if (proxyUrl.protocol !== 'http:' && proxyUrl.protocol !== 'https:') {
    return performDirectUpstreamRequest(targetUrl, method, headersObj, bodyBuf, timeoutMs);
  }

  return new Promise((resolve, reject) => {
    const proxyIsHttps = proxyUrl.protocol === 'https:';
    const proxyLib = proxyIsHttps ? https : http;
    const proxyAuth =
      proxyUrl.username || proxyUrl.password
        ? `Basic ${Buffer.from(
            `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`
          ).toString('base64')}`
        : '';

    let settled = false;
    const fallbackToDirect = () => {
      if (settled) return;
      settled = true;
      performDirectUpstreamRequest(targetUrl, method, headersObj, bodyBuf, timeoutMs)
        .then(resolve)
        .catch(reject);
    };

    if (isHttps) {
      const targetPort = Number(targetUrl.port || 443);
      const connectHeaders: Record<string, string> = {
        Host: `${targetUrl.hostname}:${targetPort}`,
      };
      if (proxyAuth) {
        connectHeaders['Proxy-Authorization'] = proxyAuth;
      }
      const connectReq = proxyLib.request({
        hostname: proxyUrl.hostname,
        port: Number(proxyUrl.port || (proxyIsHttps ? 443 : 80)),
        method: 'CONNECT',
        path: `${targetUrl.hostname}:${targetPort}`,
        headers: connectHeaders,
      });
      connectReq.setTimeout(6000, () => {
        connectReq.destroy();
        fallbackToDirect();
      });
      connectReq.on('error', fallbackToDirect);
      connectReq.on('connect', (res, tunnelSocket) => {
        if (res.statusCode !== 200) {
          tunnelSocket.destroy();
          fallbackToDirect();
          return;
        }
        const tlsSocket = tls.connect({
          socket: tunnelSocket,
          servername: targetUrl.hostname,
          rejectUnauthorized: false,
        });
        tlsSocket.on('error', () => {
          try {
            tlsSocket.destroy();
          } catch {}
          fallbackToDirect();
        });
        const upReq = https.request(
          {
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetPort,
            path: targetUrl.pathname + targetUrl.search,
            method,
            headers: headersObj,
            maxHeaderSize: 131072,
            createConnection: () => tlsSocket,
          } as any,
          (upRes) => {
            if (settled) return;
            settled = true;
            readUpstreamResponseStream(upRes, upReq, resolve, reject, () => {
              try {
                tlsSocket.destroy();
              } catch {}
            });
          }
        );
        upReq.setTimeout(timeoutMs, () => {
          upReq.destroy(new Error('Upstream request timeout'));
        });
        upReq.on('error', (err) => {
          if (settled) {
            reject(err);
          } else {
            fallbackToDirect();
          }
        });
        if (bodyBuf && bodyBuf.length > 0) {
          upReq.write(bodyBuf);
        }
        upReq.end();
      });
      connectReq.end();
      return;
    }

    // Plain HTTP target via HTTP proxy
    const proxiedHeaders: Record<string, string> = { ...headersObj };
    if (proxyAuth) {
      proxiedHeaders['proxy-authorization'] = proxyAuth;
    }
    const upReq = proxyLib.request(
      {
        hostname: proxyUrl.hostname,
        port: Number(proxyUrl.port || (proxyIsHttps ? 443 : 80)),
        path: targetUrl.href,
        method,
        headers: proxiedHeaders,
        maxHeaderSize: 131072,
      } as any,
      (upRes) => {
        if (settled) return;
        settled = true;
        readUpstreamResponseStream(upRes, upReq, resolve, reject);
      }
    );
    upReq.setTimeout(timeoutMs, () => {
      upReq.destroy(new Error('Upstream request timeout'));
    });
    upReq.on('error', () => fallbackToDirect());
    if (bodyBuf && bodyBuf.length > 0) {
      upReq.write(bodyBuf);
    }
    upReq.end();
  });
}

const SERVER_AD_AND_TRACKING_HOST_SUBSTRINGS = [
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
  'googleadservices',
  'googlesyndication',
  'doubleclick.net',
  'adservice.google',
  'c.amazon-adsystem.com',
  'adnxs.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'casalemedia.com',
  'crwdcntrl.net',
  'adroll.com',
  'smartadserver.com',
  'taboola.com',
  'outbrain.com',
  'scorecardresearch.com',
  'quantserve.com',
  'btloader.com',
  'id5-sync.com',
  'confiant-integrations',
  'criteo.com',
  'criteo.net',
  'lijit.com',
  'sonobi.com',
  'bidswitch.net',
  'yieldmo.com',
  'sharethrough.com',
  '3lift.com',
  'triplelift.com',
  'adform.net',
  'googletagservices.com',
  'google-analytics.com',
  'hotjar.com',
  'clarity.ms',
  'statcounter.com',
  'adobedtm.com',
  'advertising.com',
  'chartbeat.com',
  'exponential.com',
  'infolinks.com',
];

function isServerAdOrTrackingHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  for (const sub of SERVER_AD_AND_TRACKING_HOST_SUBSTRINGS) {
    if (host.includes(sub)) return true;
  }
  return false;
}

// Server-side raw HTTP/1.1+HTTPS fallback for Scramjet when Epoxy WASM HTTP/2 hits PROTOCOL_ERROR or Wisp is blocked
app.options('/api/scramjet-fetch', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-SJ-Url, X-SJ-Method, X-SJ-Headers, X-SJ-Session');
  res.setHeader('Access-Control-Expose-Headers', 'X-SJ-Meta, X-SJ-Meta-In-Body');
  return res.sendStatus(204);
});

app.post('/api/scramjet-fetch', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-SJ-Url, X-SJ-Method, X-SJ-Headers, X-SJ-Session');
  res.setHeader('Access-Control-Expose-Headers', 'X-SJ-Meta, X-SJ-Meta-In-Body');

  try {
    const rawUrl = String(req.headers['x-sj-url'] || '').trim();
    const method = String(req.headers['x-sj-method'] || 'GET').toUpperCase();
    const rawHeadersB64 = String(req.headers['x-sj-headers'] || '').trim();
    const stickySessionId = String(req.headers['x-sj-session'] || 'default').trim();

    if (!rawUrl) {
      return res.status(400).json({ error: 'Missing X-SJ-Url' });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid target URL' });
    }

    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Unsupported protocol' });
    }

    const host = targetUrl.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return res.status(403).json({ error: 'Private/loopback host blocked' });
    }

    if (isServerAdOrTrackingHost(host)) {
      const blockedMeta = Buffer.from(
        JSON.stringify({
          status: 204,
          statusText: 'No Content',
          headers: [['content-type', 'text/plain; charset=utf-8']],
        }),
        'utf8'
      ).toString('base64');
      res.setHeader('X-SJ-Meta', blockedMeta);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(Buffer.alloc(0));
    }

    let parsedHeaders: [string, string][] = [];
    if (rawHeadersB64) {
      try {
        const json = Buffer.from(rawHeadersB64, 'base64').toString('utf8');
        const arr = JSON.parse(json);
        if (Array.isArray(arr)) {
          parsedHeaders = arr.filter(
            (pair): pair is [string, string] =>
              Array.isArray(pair) && pair.length >= 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string'
          );
        }
      } catch {}
    }

    const forbiddenForwardHeaders = new Set([
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

    const forwardMap = new Map<string, string>();
    const cookieParts: string[] = [];
    for (const [k, v] of parsedHeaders) {
      const lower = k.toLowerCase().trim();
      if (!lower || lower.startsWith(':') || forbiddenForwardHeaders.has(lower)) continue;
      const cleanVal = v.replace(/[\r\n\0]+/g, ' ').trim();
      if (lower === 'cookie') {
        if (cleanVal) cookieParts.push(cleanVal);
      } else {
        forwardMap.set(lower, cleanVal);
      }
    }
    if (cookieParts.length > 0) {
      forwardMap.set('cookie', cookieParts.join('; '));
    }
    // Preserve genuine client fingerprints (User-Agent & Sec-CH-UA* client hints) without conflicting overrides
    const incomingUa = String(req.headers['user-agent'] || '').trim();
    const existingUa = forwardMap.get('user-agent') || '';
    if (!existingUa || existingUa.includes('Headless') || existingUa.includes('Scramjet')) {
      forwardMap.set(
        'user-agent',
        incomingUa ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      );
    }
    const effectiveUaLower = (forwardMap.get('user-agent') || '').toLowerCase();
    const inferredPlatform = effectiveUaLower.includes('macintosh') || effectiveUaLower.includes('mac os')
      ? '"macOS"'
      : effectiveUaLower.includes('cros')
      ? '"Chrome OS"'
      : effectiveUaLower.includes('android')
      ? '"Android"'
      : effectiveUaLower.includes('iphone') || effectiveUaLower.includes('ipad')
      ? '"iOS"'
      : effectiveUaLower.includes('linux')
      ? '"Linux"'
      : '"Windows"';
    const inferredMobile = effectiveUaLower.includes('mobile') || effectiveUaLower.includes('android') ? '?1' : '?0';
    if (!forwardMap.has('sec-ch-ua')) {
      forwardMap.set('sec-ch-ua', '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"');
    }
    if (!forwardMap.has('sec-ch-ua-mobile')) {
      forwardMap.set('sec-ch-ua-mobile', inferredMobile);
    }
    if (!forwardMap.has('sec-ch-ua-platform')) {
      forwardMap.set('sec-ch-ua-platform', inferredPlatform);
    }
    // Force US English unconditionally so regional IPs never switch websites to Japanese/Chinese
    forwardMap.set('accept-language', 'en-US,en;q=0.9');
    forwardMap.set('accept-encoding', 'gzip, deflate, br');
    forwardMap.delete('youtube-restrict');

    // Disable SafeSearch at header/cookie/URL level for search engines
    if (host.includes('duckduckgo.com')) {
      const filteredCookies = (forwardMap.get('cookie') || '')
        .split(';')
        .map((c) => c.trim())
        .filter((c) => c && !/^p=/i.test(c) && !/^kl=/i.test(c));
      filteredCookies.push('p=-2', 'kl=us-en');
      forwardMap.set('cookie', filteredCookies.join('; '));
    } else if (host.includes('bing.com')) {
      const rawCookie = forwardMap.get('cookie') || '';
      if (/ADLT=(STRICT|DEMOTE)/i.test(rawCookie)) {
        forwardMap.set('cookie', rawCookie.replace(/ADLT=(STRICT|DEMOTE)/gi, 'ADLT=OFF'));
      } else if (!rawCookie.includes('ADLT=')) {
        forwardMap.set('cookie', rawCookie ? `${rawCookie}; SRCHHPGUSR=ADLT=OFF` : 'SRCHHPGUSR=ADLT=OFF');
      }
    } else if (host.includes('search.brave.com')) {
      const filteredCookies = (forwardMap.get('cookie') || '')
        .split(';')
        .map((c) => c.trim())
        .filter((c) => c && !/^safesearch=/i.test(c));
      filteredCookies.push('safesearch=off');
      forwardMap.set('cookie', filteredCookies.join('; '));
    }

    // Sanitize Origin/Referer if they accidentally leaked the Cloud Run / Pages / localhost proxy host
    const proxyHost = String(req.headers.host || '').split(':')[0].toLowerCase();
    for (const hName of ['origin', 'referer']) {
      const val = forwardMap.get(hName);
      if (val && proxyHost && val.toLowerCase().includes(proxyHost)) {
        if (hName === 'origin') {
          forwardMap.set('origin', targetUrl.origin);
        } else {
          forwardMap.set('referer', `${targetUrl.origin}/`);
        }
      }
    }

    // Set genuine origin/referer for YouTube & TikTok video endpoints to prevent 403 Forbidden
    if (host.includes('youtube.com') || host.includes('googlevideo.com') || host.includes('ytimg.com')) {
      if (!forwardMap.has('referer')) forwardMap.set('referer', 'https://www.youtube.com/');
      if (!forwardMap.has('origin') && method !== 'GET' && method !== 'HEAD') {
        forwardMap.set('origin', 'https://www.youtube.com');
      }
    } else if (host.includes('tiktok.com') || host.includes('tiktokcdn.com') || host.includes('byteoversea.com')) {
      if (!forwardMap.has('referer')) forwardMap.set('referer', 'https://www.tiktok.com/');
      if (!forwardMap.has('origin') && method !== 'GET' && method !== 'HEAD') {
        forwardMap.set('origin', 'https://www.tiktok.com');
      }
    }

    const hasBody = method !== 'GET' && method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length > 0;
    const reqBodyBuf = hasBody ? Buffer.from(req.body) : null;
    const upstreamHeadersObj: Record<string, string> = {};
    for (const [k, v] of forwardMap.entries()) {
      upstreamHeadersObj[k] = v;
    }
    if (reqBodyBuf) {
      upstreamHeadersObj['content-length'] = String(reqBodyBuf.length);
    }

    let upstreamRes = await performRawUpstreamRequest(
      targetUrl,
      method,
      upstreamHeadersObj,
      reqBodyBuf,
      60000,
      stickySessionId,
      0
    );

    const isSearchChallengeHost =
      host === 'duckduckgo.com' ||
      host.endsWith('.duckduckgo.com') ||
      host === 'startpage.com' ||
      host.endsWith('.startpage.com') ||
      host === 'search.brave.com';

    if (isSearchChallengeHost) {
      const isDdgSoftBlock = (r: typeof upstreamRes) => {
        if (r.status === 202 || r.status === 403 || r.status === 429) return true;
        if (r.status === 200 && host.includes('links.duckduckgo.com')) {
          const preview = r.body.subarray(0, 512).toString('utf8');
          if (preview.includes('anomalyDetectionBlock')) return true;
        }
        return false;
      };
      const poolLen = getProxyPoolList().length;
      for (let slotOffset = 1; slotOffset < Math.min(poolLen, 4) && isDdgSoftBlock(upstreamRes); slotOffset++) {
        try {
          const retryRes = await performRawUpstreamRequest(
            targetUrl,
            method,
            upstreamHeadersObj,
            reqBodyBuf,
            25000,
            stickySessionId,
            slotOffset
          );
          if (!isDdgSoftBlock(retryRes) || retryRes.status === 200) {
            upstreamRes = retryRes;
            if (!isDdgSoftBlock(retryRes)) break;
          }
        } catch {}
      }
    }

    const outHeaders: [string, string][] = [];

    // Strip iframe-breaking framing policies, CSP, and oversized reporting headers that blow proxy header limits
    const strippedUpstreamHeaders = new Set([
      'set-cookie',
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
      'origin-agent-cluster',
      'report-to',
      'reporting-endpoints',
      'nel',
      'alt-svc',
      'strict-transport-security',
      'origin-trial',
      'p3p',
      'server-timing',
      'link',
    ]);

    for (let i = 0; i + 1 < upstreamRes.rawHeaders.length; i += 2) {
      const k = upstreamRes.rawHeaders[i];
      const v = upstreamRes.rawHeaders[i + 1];
      const lower = k.toLowerCase().trim();
      if (strippedUpstreamHeaders.has(lower)) {
        continue;
      }
      outHeaders.push([k, v]);
    }
    for (let i = 0; i + 1 < upstreamRes.rawHeaders.length; i += 2) {
      if (upstreamRes.rawHeaders[i].toLowerCase().trim() === 'set-cookie') {
        outHeaders.push(['set-cookie', upstreamRes.rawHeaders[i + 1]]);
      }
    }

    let finalStatus = upstreamRes.status;
    let finalStatusText = upstreamRes.statusText || '';

    let rawBodyBuf = upstreamRes.body;
    const isNullBodyStatus =
      finalStatus === 101 ||
      finalStatus === 204 ||
      finalStatus === 205 ||
      finalStatus === 304 ||
      method === 'HEAD';



    // Bypass YouTube bot-gate ("Sign in to confirm you're not a bot" / LOGIN_REQUIRED) cleanly via resolved stream fallback
    if (!isNullBodyStatus && finalStatus === 200 && (host === 'youtube.com' || host.endsWith('.youtube.com'))) {
      const isPlayerEndpoint = targetUrl.pathname.startsWith('/youtubei/v1/player');
      const isWatchPage = targetUrl.pathname === '/watch';
      if (isPlayerEndpoint) {
        try {
          const text = rawBodyBuf.toString('utf8');
          const hasBotBlock =
            text.includes('LOGIN_REQUIRED') ||
            text.includes('UNPLAYABLE') ||
            text.includes('not a bot') ||
            text.includes('invalidparam') ||
            text.includes('invalidVideodata') ||
            text.includes('api.invalidparam') ||
            !text.includes('streamingData');

          if (hasBotBlock) {
            let parsed: any = {};
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = { videoDetails: { videoId: 'dQw4w9WgXcQ', title: 'YouTube Video' } };
            }
            let videoId = String(parsed?.videoDetails?.videoId || '');
            if (!videoId && hasBody && req.body) {
              try {
                const reqJson = JSON.parse(req.body.toString('utf8'));
                videoId = String(reqJson?.videoId || '');
              } catch {}
            }
            if (!videoId) {
              videoId = targetUrl.searchParams.get('v') || '';
            }
            if (videoId) {
              const vrData = await fetchYoutubeVrPlayer(videoId);
              if (vrData?.streamingData) {
                const merged = {
                  ...parsed,
                  playabilityStatus: vrData.playabilityStatus || { status: 'OK', playableInEmbed: true },
                  streamingData: vrData.streamingData,
                  videoDetails: parsed.videoDetails || vrData.videoDetails,
                  captions: parsed.captions || vrData.captions,
                  storyboards: parsed.storyboards || vrData.storyboards,
                };
                rawBodyBuf = Buffer.from(JSON.stringify(merged), 'utf8');
                for (let i = outHeaders.length - 1; i >= 0; i--) {
                  if (outHeaders[i][0].toLowerCase() === 'set-cookie') outHeaders.splice(i, 1);
                }
              }
            }
          }
        } catch {}
      } else if (isWatchPage) {
        try {
          const html = rawBodyBuf.toString('utf8');
          if (html.includes('LOGIN_REQUIRED') || html.includes('not a bot')) {
            const videoId = targetUrl.searchParams.get('v') || '';
            if (videoId) {
              const vrData = await fetchYoutubeVrPlayer(videoId);
              if (vrData?.streamingData) {
                const patchedHtml = patchYtInitialPlayerResponseHtml(html, vrData);
                if (patchedHtml) {
                  rawBodyBuf = Buffer.from(patchedHtml, 'utf8');
                  for (let i = outHeaders.length - 1; i >= 0; i--) {
                    if (outHeaders[i][0].toLowerCase() === 'set-cookie') outHeaders.splice(i, 1);
                  }
                }
              }
            }
          }
        } catch {}
      }
    }

    const bodyBuf = isNullBodyStatus ? Buffer.alloc(0) : rawBodyBuf;
    if (!isNullBodyStatus) {
      outHeaders.push(['content-length', String(bodyBuf.length)]);
    }

    let metaJson = JSON.stringify({
      status: finalStatus,
      statusText: finalStatusText,
      headers: outHeaders,
    });
    let metaB64 = Buffer.from(metaJson, 'utf8').toString('base64');

    // Keep X-SJ-Meta compact (< 3KB) so upstream reverse proxies never fail with 502 header overflow
    if (metaB64.length > 3000) {
      const critical = outHeaders.filter(([k]) => {
        const l = k.toLowerCase();
        return (
          l === 'set-cookie' ||
          l === 'location' ||
          l === 'content-type' ||
          l === 'content-range' ||
          l === 'accept-ranges' ||
          l === 'content-length' ||
          l === 'referrer-policy' ||
          l === 'cache-control' ||
          l === 'access-control-allow-origin'
        );
      });
      metaJson = JSON.stringify({
        status: finalStatus,
        statusText: finalStatusText,
        headers: critical,
      });
      metaB64 = Buffer.from(metaJson, 'utf8').toString('base64');
    }

    // If metadata is still > 3KB (e.g. large set-cookie headers), embed it in a binary envelope
    if (metaB64.length > 3000) {
      const metaBuf = Buffer.from(metaJson, 'utf8');
      const lenBuf = Buffer.allocUnsafe(4);
      lenBuf.writeUInt32BE(metaBuf.length, 0);
      res.setHeader('X-SJ-Meta-In-Body', '1');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(Buffer.concat([lenBuf, metaBuf, bodyBuf]));
    }

    res.setHeader('X-SJ-Meta', metaB64);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(bodyBuf);
  } catch (err: any) {
    const cleanMsg = String(err?.message || err || 'Upstream fetch failed').replace(/<[^>]+>/g, '').slice(0, 150);
    return res.status(502).json({ error: 'Upstream proxy fetch failed', message: cleanMsg });
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global CORS middleware for published & preview apps
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SJ-Url, X-SJ-Method, X-SJ-Headers, X-Filename, X-Mime-Type');
  res.setHeader('Access-Control-Expose-Headers', 'X-SJ-Meta, X-SJ-Meta-In-Body');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// YouTube player fallback for Epoxy/Wisp client requests that encounter bot-gate LOGIN_REQUIRED
app.post('/api/yt-player-fallback', async (req, res) => {
  try {
    const videoId = String(req.body?.videoId || '').trim();
    if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return res.status(400).json({ ok: false, error: 'Invalid videoId' });
    }
    const playerResponse = await fetchYoutubeVrPlayer(videoId);
    if (!playerResponse?.streamingData) {
      return res.status(404).json({ ok: false });
    }
    return res.json({ ok: true, playerResponse });
  } catch (err: any) {
    return res.status(502).json({ ok: false, error: String(err?.message || err || 'Fallback failed') });
  }
});

// Direct Range-supporting YouTube MP4 video+audio proxy stream (matches IP used to sign URL)
app.all('/api/yt-stream', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).end();
  }
  const videoId = String(req.query.v || '').trim();
  if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid videoId' });
  }

  const pipeAttempt = async (forceRefresh: boolean): Promise<boolean> => {
    const resolved = await resolvePlayableYoutubeStream(videoId, forceRefresh);
    if (!resolved) return false;

    const reqHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Referer: 'https://www.youtube.com/',
      'Accept-Encoding': 'identity',
    };
    const range = req.headers.range;
    if (range) reqHeaders['Range'] = String(range);

    const upstream = await openProxyHttpStream(
      resolved.url,
      resolved.proxyUrlStr,
      req.method,
      reqHeaders,
      null,
      30000,
      5
    );

    if ((upstream.status === 403 || upstream.status === 410) && !forceRefresh) {
      upstream.stream.resume();
      upstream.cleanup();
      return false;
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', String(upstream.headers['content-type'] || resolved.contentType || 'video/mp4'));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store');
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', String(upstream.headers['content-length']));
    }
    if (upstream.headers['content-range']) {
      res.setHeader('Content-Range', String(upstream.headers['content-range']));
    }

    if (req.method === 'HEAD') {
      upstream.stream.resume();
      upstream.cleanup();
      res.end();
      return true;
    }

    res.on('close', () => {
      upstream.cleanup();
    });
    upstream.stream.on('error', () => {
      upstream.cleanup();
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    upstream.stream.pipe(res);
    return true;
  };

  try {
    let ok = await pipeAttempt(false);
    if (!ok) {
      ok = await pipeAttempt(true);
    }
    if (!ok && !res.headersSent) {
      return res.status(502).json({ error: 'Unable to resolve playable video stream' });
    }
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(502).json({ error: String(err?.message || 'YouTube stream failed') });
    }
    res.end();
  }
});



// Ensure uploads directory exists for persistent local file hosting
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
}, express.static(uploadsDir));

// File Upload Endpoint (supports fast raw binary streaming and JSON base64 fallback)
app.post(
  '/api/upload',
  express.raw({
    type: (req) => !String(req.headers['content-type'] || '').toLowerCase().includes('application/json'),
    limit: '100mb',
  }),
  async (req, res) => {
    try {
      let filename = '';
      let mimeType = 'application/octet-stream';
      let buffer: Buffer;

      if (Buffer.isBuffer(req.body)) {
        const rawHeaderName = String(req.headers['x-filename'] || req.query.filename || 'upload.bin');
        try {
          filename = decodeURIComponent(rawHeaderName);
        } catch {
          filename = rawHeaderName;
        }
        mimeType = String(req.headers['x-mime-type'] || req.query.mimeType || 'application/octet-stream');
        buffer = req.body;
      } else {
        const { filename: jsonName, base64Data, mimeType: jsonMime } = req.body || {};
        filename = String(jsonName || '');
        mimeType = String(jsonMime || 'application/octet-stream');
        if (!filename || !base64Data) {
          return res.status(400).json({ error: 'Missing filename or file data' });
        }
        const cleanBase64 = String(base64Data).replace(/^data:[^;]+;base64,/, '');
        buffer = Buffer.from(cleanBase64, 'base64');
      }

      if (!filename || !buffer || buffer.length === 0) {
        return res.status(400).json({ error: 'Empty upload payload' });
      }

      const safeBase = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_') || 'file';
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeBase}`;
      const filePath = path.join(uploadsDir, safeName);

      await fs.promises.writeFile(filePath, buffer);

      const publicUrl = `/uploads/${safeName}`;
      res.json({
        success: true,
        url: publicUrl,
        filename,
        size: buffer.length,
        mimeType,
      });
    } catch (err: any) {
      console.error('File upload error:', err);
      res.status(500).json({ error: 'Failed to upload file to server', message: err?.message });
    }
  }
);

// User Favorites Persistent Storage Endpoint
const favoritesStorePath = path.join(uploadsDir, 'favorites_store.json');
const getFavoritesData = (): Record<string, { gameIds: number[]; channelIds: string[]; updatedAt: number }> => {
  try {
    if (fs.existsSync(favoritesStorePath)) {
      return JSON.parse(fs.readFileSync(favoritesStorePath, 'utf8'));
    }
  } catch {}
  return {};
};

const saveFavoritesData = (data: Record<string, any>) => {
  try {
    fs.writeFileSync(favoritesStorePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write favorites store:', e);
  }
};

app.get('/api/favorites', (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'guest';
    const store = getFavoritesData();
    const userFavs = store[userId] || { gameIds: [], channelIds: [], updatedAt: 0 };
    res.json(userFavs);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch favorites', message: err?.message });
  }
});

app.post('/api/favorites', (req, res) => {
  try {
    const { userId, gameIds, channelIds, updatedAt } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    const store = getFavoritesData();
    const existing = store[userId];
    const nextTs = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : Date.now();
    if (existing && typeof existing.updatedAt === 'number' && existing.updatedAt > nextTs) {
      return res.json({ success: true, ...existing });
    }
    const updated = {
      gameIds: Array.isArray(gameIds) ? Array.from(new Set(gameIds.map(Number).filter((n) => !Number.isNaN(n)))) : [],
      channelIds: Array.isArray(channelIds) ? Array.from(new Set(channelIds.map(String).filter(Boolean))) : [],
      updatedAt: nextTs,
    };
    store[userId] = updated;
    saveFavoritesData(store);
    res.json({ success: true, ...updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save favorites', message: err?.message });
  }
});

// Scramjet Persistent Website Cookies Store (merge-only, never resets cookies)
const scramjetCookiesStorePath = path.join(uploadsDir, 'scramjet_cookies_store.json');
const getScramjetCookiesStore = (): Record<string, { cookies: Record<string, any>; updatedAt: number }> => {
  if (!fs.existsSync(scramjetCookiesStorePath)) return {};
  return JSON.parse(fs.readFileSync(scramjetCookiesStorePath, 'utf8'));
};

const saveScramjetCookiesStore = (data: Record<string, any>) => {
  const tmpPath = `${scramjetCookiesStorePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf8');
  fs.renameSync(tmpPath, scramjetCookiesStorePath);
};

app.get('/api/scramjet-cookies', (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'default';
    const store = getScramjetCookiesStore();
    const entry = store[userId] || { cookies: {}, updatedAt: 0 };
    res.json({ success: true, cookies: entry.cookies || {}, updatedAt: entry.updatedAt || 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read Scramjet cookies', message: err?.message });
  }
});

app.post('/api/scramjet-cookies', (req, res) => {
  try {
    const { userId = 'default', cookies } = req.body || {};
    if (!cookies || typeof cookies !== 'object') {
      return res.status(400).json({ error: 'Missing cookies object' });
    }
    const store = getScramjetCookiesStore();
    const existing = store[userId]?.cookies || {};
    const merged: Record<string, any> = { ...existing };
    for (const [k, v] of Object.entries(cookies)) {
      if (!v || typeof v !== 'object') continue;
      const ex = merged[k] || {};
      const incoming = v as Record<string, any>;
      const combined: Record<string, any> = { ...ex, ...incoming };
      if (
        typeof ex.value === 'string' &&
        ex.value.length > 0 &&
        (incoming.value === '' || incoming.value === undefined || incoming.value === null)
      ) {
        combined.value = ex.value;
      }
      if (typeof combined.maxAge === 'number' && combined.maxAge <= 0) {
        delete combined.maxAge;
      }
      if (combined.expires !== undefined) {
        const parsed = typeof combined.expires === 'string' ? Date.parse(combined.expires) : Number(combined.expires);
        const minFuture = Date.now() + 365 * 24 * 3600 * 1000;
        combined.expires = Number.isFinite(parsed) ? Math.max(parsed, minFuture) : minFuture;
      }
      merged[k] = combined;
    }
    const updatedAt = Date.now();
    store[userId] = { cookies: merged, updatedAt };
    saveScramjetCookiesStore(store);
    res.json({ success: true, cookies: merged, updatedAt });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save Scramjet cookies', message: err?.message });
  }
});

// Persistent Browser Bookmarks Store
const browserBookmarksStorePath = path.join(uploadsDir, 'browser_bookmarks_store.json');
const getBrowserBookmarksStore = (): Record<string, { bookmarks: any[]; updatedAt: number }> => {
  try {
    if (fs.existsSync(browserBookmarksStorePath)) {
      return JSON.parse(fs.readFileSync(browserBookmarksStorePath, 'utf8'));
    }
  } catch {}
  return {};
};

const saveBrowserBookmarksStore = (data: Record<string, any>) => {
  try {
    fs.writeFileSync(browserBookmarksStorePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write browser bookmarks store:', e);
  }
};

app.get('/api/browser-bookmarks', (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'default';
    const store = getBrowserBookmarksStore();
    const entry = store[userId] || { bookmarks: [], updatedAt: 0 };
    res.json({ success: true, bookmarks: entry.bookmarks || [], updatedAt: entry.updatedAt || 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read bookmarks', message: err?.message });
  }
});

app.post('/api/browser-bookmarks', (req, res) => {
  try {
    const { userId = 'default', bookmarks, updatedAt } = req.body || {};
    if (!Array.isArray(bookmarks)) {
      return res.status(400).json({ error: 'Missing bookmarks array' });
    }
    const store = getBrowserBookmarksStore();
    const existing = store[userId];
    const nextTs = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : Date.now();
    if (existing && typeof existing.updatedAt === 'number' && existing.updatedAt > nextTs) {
      return res.json({ success: true, ...existing });
    }
    store[userId] = { bookmarks, updatedAt: nextTs };
    saveBrowserBookmarksStore(store);
    res.json({ success: true, bookmarks, updatedAt: nextTs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save bookmarks', message: err?.message });
  }
});

// File Download Endpoint
app.get('/api/download', async (req, res) => {
  try {
    const fileUrl = (req.query.url as string) || '';
    const rawFilename = (req.query.filename as string) || 'download';
    const filename = path.basename(rawFilename).replace(/[^\w.-]/g, '_') || 'download';

    if (!fileUrl) {
      return res.status(400).send('Missing url parameter');
    }

    if (fileUrl.startsWith('/uploads/')) {
      const safeBasename = path.basename(fileUrl);
      const localPath = path.join(uploadsDir, safeBasename);
      if (fs.existsSync(localPath)) {
        return res.download(localPath, filename);
      }
    }

    const extRes = await fetch(fileUrl);
    if (!extRes.ok) {
      return res.status(extRes.status).send('Failed to fetch remote attachment');
    }

    const contentType = extRes.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await extRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (err: any) {
    console.error('Download endpoint error:', err);
    res.status(500).send('Failed to download file');
  }
});

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function fetchImageBuffer(imageUrl: string, redirectsRemaining = 5): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (redirectsRemaining <= 0) return null;
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(imageUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;
      const options: any = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      };

      if (isHttps) {
        options.agent = httpsAgent;
      }

      const req = lib.request(options, (res: http.IncomingMessage) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, imageUrl).toString();
          return fetchImageBuffer(redirectUrl, redirectsRemaining - 1).then(resolve);
        }

        if (res.statusCode && res.statusCode >= 400) {
          return resolve(null);
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer | Uint8Array | string) => chunks.push(Buffer.from(chunk as any)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = (res.headers['content-type'] as string) || 'image/png';
          resolve({ buffer, contentType });
        });
        res.on('error', () => resolve(null));
      });

      req.on('error', () => resolve(null));
      req.setTimeout(8000, () => {
        req.destroy();
        resolve(null);
      });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

// Image Reverse Proxy (Bypasses CORS, Hotlinking blocks, and SSL Cert Mismatches)
app.get('/api/proxy-image', async (req, res) => {
  try {
    const imageUrl = (req.query.url as string) || '';
    if (!imageUrl) {
      return res.status(400).send('Missing url parameter');
    }

    const result = await fetchImageBuffer(imageUrl);
    if (!result) {
      return res.status(404).send('Failed to fetch image');
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(result.buffer);
  } catch (err: any) {
    res.status(500).send('Failed to proxy image');
  }
});

// Official ESRB Rating Image Proxy (fetches real ESRB SVGs directly from esrb.org)
const esrbImageCache = new Map<string, { contentType: string; buffer: Buffer }>();
app.get('/api/esrb/image', async (req, res) => {
  try {
    const srcParam = String(req.query.src || '').trim();
    const codeParam = String(req.query.code || '').trim().toUpperCase() as EsrbRatingCode;
    let badgePath = isValidEsrbBadgePath(srcParam);
    if (!badgePath && codeParam && OFFICIAL_ESRB_IMAGE_PATHS[codeParam]) {
      badgePath = OFFICIAL_ESRB_IMAGE_PATHS[codeParam];
    }
    if (!badgePath) {
      return res.status(400).send('Invalid ESRB image path');
    }

    const cached = esrbImageCache.get(badgePath);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(cached.buffer);
    }

    const encodedPath = badgePath.replace(/\+/g, '%2B');
    const upstream = await fetch(`${ESRB_ORIGIN}${encodedPath}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/svg+xml,image/png,image/webp,image/*,*/*;q=0.8',
        Referer: `${ESRB_ORIGIN}/`,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(404).send('ESRB badge not found upstream');
    }

    const contentType =
      upstream.headers.get('content-type') ||
      (badgePath.endsWith('.svg') ? 'image/svg+xml; charset=utf-8' : 'image/png');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    esrbImageCache.set(badgePath, { contentType, buffer });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.send(buffer);
  } catch {
    return res.status(502).send('Failed to fetch ESRB badge');
  }
});

// Real ESRB Rating Lookup Endpoint (queries official esrb.org search & caches verified results)
const esrbDiskCacheState: { mtimeMs: number; ratings: Record<string, GameRatingInfo>; unrated: Set<string> } = {
  mtimeMs: 0,
  ratings: {},
  unrated: new Set<string>(),
};
const esrbLiveMemoryCache = new Map<string, GameRatingInfo | null>();
const esrbUnavailableRetryUntil = new Map<string, number>();

function ensureEsrbDiskCacheLoaded() {
  const candidates = [
    path.resolve(__dirname, 'public/esrb-cache.json'),
    path.resolve(__dirname, 'dist/esrb-cache.json'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const stat = fs.statSync(p);
      if (stat.mtimeMs === esrbDiskCacheState.mtimeMs) return;
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      esrbDiskCacheState.ratings = parsed?.ratings && typeof parsed.ratings === 'object' ? parsed.ratings : {};
      esrbDiskCacheState.unrated = new Set<string>(Array.isArray(parsed?.unrated) ? parsed.unrated.map(String) : []);
      esrbDiskCacheState.mtimeMs = stat.mtimeMs;
      break;
    } catch {}
  }
}

async function resolveEsrbTitleServer(
  title: string
): Promise<{ key: string; rating: GameRatingInfo | null; status: 'matched' | 'unrated' | 'unavailable' }> {
  ensureEsrbDiskCacheLoaded();
  const key = normalizeRatingLookupKey(title);
  if (!key || key.length < 2) {
    return { key, rating: null, status: 'unrated' };
  }
  if (key in esrbDiskCacheState.ratings) {
    return { key, rating: esrbDiskCacheState.ratings[key], status: 'matched' };
  }
  if (esrbDiskCacheState.unrated.has(key)) {
    return { key, rating: null, status: 'unrated' };
  }
  if (esrbLiveMemoryCache.has(key)) {
    const cached = esrbLiveMemoryCache.get(key) || null;
    return { key, rating: cached, status: cached ? 'matched' : 'unrated' };
  }
  const retryAt = esrbUnavailableRetryUntil.get(key);
  if (retryAt && Date.now() < retryAt) {
    return { key, rating: null, status: 'unavailable' };
  }

  const fetched = await fetchEsrbRatingDetailed(title);
  if (fetched.status === 'unavailable') {
    esrbUnavailableRetryUntil.set(key, Date.now() + 60_000);
    return { key, rating: null, status: 'unavailable' };
  }
  esrbUnavailableRetryUntil.delete(key);
  esrbLiveMemoryCache.set(key, fetched.rating);
  return { key, rating: fetched.rating, status: fetched.status };
}

app.get('/api/esrb/ratings', async (req, res) => {
  const title = String(req.query.title || '').trim();
  if (!title) {
    return res.status(400).json({ error: 'Missing title query param' });
  }
  const { key, rating, status } = await resolveEsrbTitleServer(title);
  res.setHeader('Cache-Control', status === 'unavailable' ? 'no-store' : 'public, max-age=3600');
  return res.json({ key, rating, unavailable: status === 'unavailable', source: 'esrb' });
});

app.post('/api/esrb/ratings', async (req, res) => {
  const body = req.body as { titles?: unknown } | undefined;
  const titles = Array.isArray(body?.titles)
    ? body.titles.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 20)
    : [];

  const ratings: Record<string, GameRatingInfo | null> = {};
  const unavailable: string[] = [];
  const CONCURRENCY = 2;
  let cursor = 0;
  async function worker() {
    while (cursor < titles.length) {
      const idx = cursor++;
      const { key, rating, status } = await resolveEsrbTitleServer(titles[idx]);
      if (key) {
        if (status === 'unavailable') {
          unavailable.push(key);
        } else {
          ratings[key] = rating;
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, titles.length) }, () => worker()));

  res.setHeader('Cache-Control', unavailable.length > 0 ? 'no-store' : 'public, max-age=3600');
  return res.json({ ratings, unavailable, source: 'esrb' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'FrostHub - Entertainment & Chat',
  });
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// --- WebSocket Database REST API Fallback Endpoints ---
app.get('/api/ws-db/snapshot', (req, res) => {
  res.json({
    success: true,
    users: globalWsDb.getUsers(),
    channels: globalWsDb.channels,
    timestamp: Date.now(),
  });
});

app.post('/api/ws-db/register', (req, res) => {
  try {
    const { user } = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ error: 'Missing user object or user.id' });
    }
    const existingUser = globalWsDb.getUser(user.id);
    const oldChannel = existingUser?.current_channel || 'text-general';
    const userObj = {
      id: user.id,
      username: user.username || existingUser?.username || 'Player',
      avatar_color: user.avatar_color || existingUser?.avatar_color || '#0066ff',
      avatar_url: user.avatar_url ?? existingUser?.avatar_url ?? '',
      current_channel: user.current_channel || existingUser?.current_channel || 'text-general',
      is_speaking: user.is_speaking !== undefined ? Boolean(user.is_speaking) : Boolean(existingUser?.is_speaking),
      is_muted: user.is_muted !== undefined ? Boolean(user.is_muted) : Boolean(existingUser?.is_muted),
      is_deafened: user.is_deafened !== undefined ? Boolean(user.is_deafened) : Boolean(existingUser?.is_deafened),
      has_video: user.has_video !== undefined ? Boolean(user.has_video) : Boolean(existingUser?.has_video),
      is_screen_sharing: user.is_screen_sharing !== undefined ? Boolean(user.is_screen_sharing) : Boolean(existingUser?.is_screen_sharing),
      activity: user.activity ?? existingUser?.activity ?? '',
      typing_channel: user.typing_channel ?? existingUser?.typing_channel ?? undefined,
      typing_at: user.typing_at ?? existingUser?.typing_at ?? undefined,
      updated_at: Date.now(),
    };
    globalWsDb.upsertUser(userObj as any);
    broadcastTable('users', globalWsDb.getUsers());
    if (
      userObj.current_channel !== oldChannel &&
      (userObj.current_channel === 'voice-general' || userObj.current_channel === 'video-general')
    ) {
      broadcastWss({
        type: 'USER_JOINED_MEDIA',
        userId: user.id,
        channel: userObj.current_channel,
        timestamp: Date.now(),
      });
    }
    res.json({ success: true, user: userObj, users: globalWsDb.getUsers() });
  } catch (err: any) {
    res.status(500).json({ error: 'Register failed', message: err?.message });
  }
});

app.post('/api/ws-db/update-user', (req, res) => {
  try {
    const { id, set } = req.body;
    if (!id || !set) {
      return res.status(400).json({ error: 'Missing id or set parameters' });
    }
    const existing = globalWsDb.getUser(id);
    const oldChannel = existing?.current_channel || 'text-general';
    const updated = {
      id,
      username: existing?.username || 'Player',
      avatar_color: existing?.avatar_color || '#0066ff',
      avatar_url: existing?.avatar_url || '',
      current_channel: existing?.current_channel || 'text-general',
      is_speaking: existing?.is_speaking || false,
      is_muted: existing?.is_muted || false,
      is_deafened: existing?.is_deafened || false,
      has_video: existing?.has_video || false,
      is_screen_sharing: existing?.is_screen_sharing || false,
      activity: existing?.activity || '',
      ...existing,
      ...set,
      updated_at: Date.now(),
    };
    if (updated.current_channel === 'text-general' || updated.current_channel === 'offline') {
      updated.has_video = false;
      updated.is_screen_sharing = false;
      updated.is_speaking = false;
    }
    globalWsDb.upsertUser(updated as any);
    broadcastTable('users', globalWsDb.getUsers());
    if (set?.current_channel !== undefined && set.current_channel !== oldChannel) {
      if (set.current_channel === 'voice-general' || set.current_channel === 'video-general') {
        broadcastWss({
          type: 'USER_JOINED_MEDIA',
          userId: id,
          channel: set.current_channel,
          timestamp: Date.now(),
        });
      }
      if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
        broadcastWss({
          type: 'USER_LEFT_MEDIA',
          userId: id,
          channel: oldChannel,
          timestamp: Date.now(),
        });
      }
    }
    res.json({ success: true, user: updated, users: globalWsDb.getUsers() });
  } catch (err: any) {
    res.status(500).json({ error: 'Update user failed', message: err?.message });
  }
});

app.post('/api/ws-db/leave', (req, res) => {
  try {
    const { id } = req.body;
    if (id) {
      const user = globalWsDb.getUser(id);
      const oldChannel = user?.current_channel;
      globalWsDb.deleteUser(id);
      broadcastTable('users', globalWsDb.getUsers());
      if (oldChannel === 'video-general' || oldChannel === 'voice-general') {
        broadcastWss({
          type: 'USER_LEFT_MEDIA',
          userId: id,
          channel: oldChannel,
          timestamp: Date.now(),
        });
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Leave failed', message: err?.message });
  }
});

app.post('/api/ws-db/message', (req, res) => {
  try {
    const { row } = req.body;
    if (!row || !row.id) {
      return res.status(400).json({ error: 'Missing message row' });
    }
    if (globalWsDb.deletedMessageIds.has(row.id)) {
      return res.json({ success: true, deleted: true });
    }
    const newMsg = {
      id: row.id,
      channel_id: row.channel_id || 'text-general',
      sender_id: row.sender_id || 'anon',
      sender_name: row.sender_name || 'Player',
      avatar_color: row.avatar_color || '#0066ff',
      sender_avatar_url: row.sender_avatar_url || '',
      content: row.content || '',
      attachment_url: row.attachment_url,
      attachment_type: row.attachment_type,
      attachment_name: row.attachment_name,
      timestamp: row.timestamp || ('Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
      created_at: Number(row.created_at) || Date.now(),
    };
    broadcastTable('messages', [newMsg]);
    res.json({ success: true, message: newMsg });
  } catch (err: any) {
    res.status(500).json({ error: 'Insert message failed', message: err?.message });
  }
});

app.delete('/api/ws-db/message/:id', (req, res) => {
  try {
    const messageId = req.params.id;
    if (messageId) {
      globalWsDb.markMessageDeleted(messageId);
      broadcastWss({ type: 'SQL_DELETE', table: 'messages', id: messageId });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Delete message failed', message: err?.message });
  }
});

app.delete('/api/ws-db/channel-messages/:channelId', (req, res) => {
  try {
    const channelId = req.params.channelId;
    if (channelId) {
      broadcastWss({ type: 'SQL_DELETE_CHANNEL', table: 'messages', channel_id: channelId });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Delete channel messages failed', message: err?.message });
  }
});

app.delete('/api/ws-db/messages/all', (req, res) => {
  try {
    globalWsDb.deletedMessageIds.clear();
    broadcastWss({ type: 'DB_CLEAR_MESSAGES' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Global delete failed', message: err?.message });
  }
});

app.post('/api/ws-db/signal', (req, res) => {
  try {
    const { fromUserId, targetUserId, signal, sigId } = req.body;
    if (!targetUserId || targetUserId === fromUserId) {
      return res.status(400).json({ error: 'Invalid targetUserId' });
    }

    const payload = {
      type: 'RTC_SIGNAL' as const,
      fromUserId,
      targetUserId,
      signal,
      sigId: sigId || `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    const delivered = sendToUserSockets(targetUserId, payload);
    if (!delivered) {
      globalWsDb.addPendingSignal({
        id: payload.sigId,
        ...payload,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Signal failed', message: err?.message });
  }
});

app.get('/api/ws-db/signals/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const signals = userId ? globalWsDb.popPendingSignals(userId) : [];
    res.json({ success: true, signals });
  } catch (err: any) {
    res.status(500).json({ error: 'Get signals failed', message: err?.message });
  }
});

// Giphy Search & Trending API Proxy
app.get('/api/giphy/search', async (req, res) => {
  const query = (req.query.q as string) || '';
  const limit = (req.query.limit as string) || '50';
  const offset = (req.query.offset as string) || '0';
  const apiKey = process.env.GIPHY_API_KEY || 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';

  const endpoint = !query.trim() || query === 'trending'
    ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}`
    : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch Giphy GIFs', message: err?.message });
  }
});

function readOpenRouterApiKey(requestKey?: string): string {
  try {
    const keyFilePath = path.resolve(__dirname, 'keyforopenrouter.txt');
    if (fs.existsSync(keyFilePath)) {
      const fileKey = fs.readFileSync(keyFilePath, 'utf8').replace(/^["']|["']$/g, '').trim();
      if (fileKey) return fileKey;
    }
  } catch {}

  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.VITE_OPENROUTER_API_KEY ||
    requestKey ||
    ''
  ).replace(/^["']|["']$/g, '').trim();
}

app.get('/api/ai/models', (req, res) => {
  const hasKey = Boolean(readOpenRouterApiKey(req.query.apiKey as string));
  res.json({ success: true, hasKey, models: FALLBACK_OPENROUTER_MODELS, source: 'curated-free' });
});

// Web Search helper: DuckDuckGo HTML with Wikipedia Fallback
interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  const cleanQ = query.replace(/[?.,!]+$/, '').trim();
  if (!cleanQ) return results;

  // 1. Try DuckDuckGo HTML
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQ)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const html = await res.text();
      const regex = /<a[^>]+class="result__snippet"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = regex.exec(html)) !== null && results.length < 5) {
        let rawUrl = m[1];
        let url = rawUrl;
        if (rawUrl.includes('uddg=')) {
          const match = rawUrl.match(/uddg=([^&]+)/);
          if (match) url = decodeURIComponent(match[1]);
        }
        const snippet = m[2]
          .replace(/<[^>]+>/g, '')
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();

        let domain = 'Web';
        try {
          domain = new URL(url).hostname.replace(/^www\./, '');
        } catch {}

        if (snippet && !results.some((r) => r.url === url)) {
          results.push({ url, title: domain, snippet });
        }
      }
    }
  } catch (err: any) {
    console.warn('[Web Search] DuckDuckGo search warning:', err?.message || err);
  }

  // 2. Fallback to Wikipedia Query Search if DDG returned no snippets
  if (results.length === 0) {
    try {
      const wikiRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQ)}&utf8=&format=json`,
        {
          headers: { 'User-Agent': 'FrostedAI/1.0' },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (wikiRes.ok) {
        const data = await wikiRes.json();
        const hits = data?.query?.search || [];
        for (const hit of hits.slice(0, 4)) {
          const snippet = (hit.snippet || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&#x27;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
          results.push({
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, '_'))}`,
            title: hit.title,
            snippet,
          });
        }
      }
    } catch (wikiErr: any) {
      console.warn('[Web Search] Wikipedia fallback warning:', wikiErr?.message || wikiErr);
    }
  }

  return results;
}

function shouldSearchWeb(prompt: string, searchMode?: 'auto' | 'always' | 'off'): boolean {
  if (searchMode === 'off') return false;
  if (searchMode === 'always') return true;

  const p = prompt.toLowerCase();
  // Check for search trigger words or factual inquiries
  const searchTriggers = [
    'who is', 'who was', 'who won', 'who created', 'who played', 'when was', 'when did', 'when will',
    'where is', 'where was', 'latest', 'current', 'news', 'score', 'winner', 'weather', 'price',
    'release date', 'super bowl', 'champion', 'championship', 'today', 'yesterday', 'update',
    'president', 'ceo', 'stats', 'movie', 'film', 'born', 'died', 'how many', 'population',
    'search', 'google', 'look up', 'find out', 'history of', 'what is happening', 'record'
  ];

  return searchTriggers.some((t) => p.includes(t)) || p.length > 35;
}

// AI Assistant SSE Streaming Endpoint - Live step-by-step thinking & web search
app.post('/api/ai/assistant/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let isAborted = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      isAborted = true;
    }
  });

  const sendEvent = (event: any) => {
    if (isAborted) return;
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      (res as any).flush?.();
    } catch {}
  };

  try {
    const { prompt, history, openRouterApiKey, model: customModel, searchMode } = req.body;
    if (!prompt) {
      sendEvent({ type: 'error', error: 'Missing prompt' });
      return res.end();
    }

    const completedSteps: Array<{ id: string; title: string; detail: string; icon: string; timestamp: number }> = [];

    const recordStep = (id: string, title: string, detail: string, icon: string, extra: any = {}) => {
      const stepObj = { id, title, detail, icon, timestamp: Date.now(), ...extra };
      completedSteps.push(stepObj);
      sendEvent({ type: 'step', ...stepObj });
    };

    // Step 1: Logic starting...

    // Auto-detect OpenRouter API Key from keyforopenrouter.txt or environment
    const openRouterKey = readOpenRouterApiKey(openRouterApiKey as string);

    if (!openRouterKey) {
      sendEvent({
        type: 'error',
        error: 'OpenRouter API Key is not configured on the server. Please add OPENROUTER_API_KEY to your server environment secrets.',
      });
      return res.end();
    }

    // Step 2: Determine Web Search requirement
    let searchResults: WebSearchResult[] = [];
    const needsSearch = shouldSearchWeb(prompt, searchMode);

    if (needsSearch && !isAborted) {
      recordStep('searching', 'Searching the Web', `Querying live web sources for "${prompt}"...`, 'search', { query: prompt });
      searchResults = await searchWeb(prompt);

      if (searchResults.length > 0) {
        const sourceNames = searchResults.map((s) => s.title).join(', ');
        recordStep(
          'reading',
          'Reading Sources',
          `Scanned ${searchResults.length} live sources (${sourceNames}). Extracting relevant facts...`,
          'globe',
          { sources: searchResults.map((s) => ({ title: s.title, url: s.url })) }
        );
      } else {
        recordStep('reading', 'Direct Knowledge', 'Consulting OpenRouter model...', 'cpu');
      }
    }

    if (isAborted) return res.end();

    // Step 3: Synthesis with OpenRouter
    const targetModel = typeof customModel === 'string' && customModel.trim() ? customModel.trim() : OPENROUTER_MODEL;
    recordStep('synthesizing', 'Synthesizing Answer', `Formulating direct response with ${targetModel}...`, 'sparkles');

    const systemInstruction = buildAISystemInstruction();

    let searchContext = '';
    if (searchResults.length > 0) {
      searchContext = `\n\n[Live Web Search Context for "${prompt}"]:\n` +
        searchResults.map((r, i) => `[Source ${i + 1}] (${r.title} - ${r.url}): ${r.snippet}`).join('\n') +
        `\nUse the above live web facts to answer accurately and concisely.`;
    }

    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction + searchContext },
    ];

    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (msg.role && msg.text) {
          chatMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text,
          });
        }
      }
    }

    chatMessages.push({ role: 'user', content: prompt });

    let replyText = '';

    if (!isAborted) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const openRouterRes = await fetch(OPENROUTER_CHAT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: targetModel,
            messages: chatMessages,
            temperature: 0.3,
            max_tokens: 1024,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (openRouterRes.ok) {
          const data = await openRouterRes.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) replyText = text.trim();
        } else {
          const errBody = await openRouterRes.text().catch(() => '');
          console.warn(`[OpenRouter AI Stream] returned ${openRouterRes.status}:`, errBody.slice(0, 150));
        }
      } catch (mErr: any) {
        console.warn('[OpenRouter AI Stream] fetch failed:', mErr?.message || mErr);
      }
    }

    if (isAborted) return res.end();

    if (!replyText) {
      sendEvent({
        type: 'error',
        error: 'OpenRouter API request failed or timed out. Please check your OpenRouter API key.',
      });
      return res.end();
    }

    // Step 4: Done event
    sendEvent({
      type: 'done',
      reply: replyText,
      sources: searchResults.map((s) => ({ title: s.title, url: s.url })),
      steps: completedSteps,
    });
    res.end();
  } catch (err: any) {
    console.error('AI Stream Error:', err);
    sendEvent({ type: 'error', error: err?.message || 'Failed to stream response' });
    res.end();
  }
});

// AI Study Assistant Endpoint (Standard JSON) - Powered exclusively by OpenRouter with Web Search
app.post('/api/ai/assistant', async (req, res) => {
  try {
    const { prompt, history, openRouterApiKey, model: customModel, searchMode } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const systemInstruction = buildAISystemInstruction();

    // Auto-detect OpenRouter API Key from keyforopenrouter.txt or server environment secrets
    const openRouterKey = readOpenRouterApiKey(openRouterApiKey as string);

    if (!openRouterKey) {
      return res.status(503).json({
        error: 'OpenRouter API Key is not configured on the server. Please add OPENROUTER_API_KEY to your server environment secrets.',
      });
    }

    let searchResults: WebSearchResult[] = [];
    const steps: Array<{ id: string; title: string; detail: string; icon: string; timestamp: number }> = [];

    if (shouldSearchWeb(prompt, searchMode)) {
      steps.push({ id: 'searching', title: 'Searching the Web', detail: `Querying for "${prompt}"`, icon: 'search', timestamp: Date.now() });
      searchResults = await searchWeb(prompt);
      if (searchResults.length > 0) {
        steps.push({
          id: 'reading',
          title: 'Reading Sources',
          detail: `Analyzed ${searchResults.length} live sources`,
          icon: 'globe',
          timestamp: Date.now(),
        });
      }
    }

    let searchContext = '';
    if (searchResults.length > 0) {
      searchContext = `\n\n[Live Web Search Context for "${prompt}"]:\n` +
        searchResults.map((r, i) => `[Source ${i + 1}] (${r.title} - ${r.url}): ${r.snippet}`).join('\n') +
        `\nUse the above live web facts to answer accurately and concisely.`;
    }

    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemInstruction + searchContext },
    ];

    if (Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (msg.role && msg.text) {
          chatMessages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text,
          });
        }
      }
    }

    chatMessages.push({ role: 'user', content: prompt });

    const targetModel = typeof customModel === 'string' && customModel.trim() ? customModel.trim() : OPENROUTER_MODEL;
    let replyText = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const openRouterRes = await fetch(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          messages: chatMessages,
          temperature: 0.3,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (openRouterRes.ok) {
        const data = await openRouterRes.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) replyText = text.trim();
      } else {
        const errBody = await openRouterRes.text().catch(() => '');
        console.warn(`[OpenRouter AI] returned ${openRouterRes.status}:`, errBody.slice(0, 150));
      }
    } catch (mErr: any) {
      console.warn('[OpenRouter AI] fetch failed:', mErr?.message || mErr);
    }

    if (!replyText) {
      return res.status(502).json({
        error: 'OpenRouter API request failed or timed out. Please check your OpenRouter API key.',
      });
    }

    res.json({
      success: true,
      reply: replyText,
      sources: searchResults.map((s) => ({ title: s.title, url: s.url })),
      steps,
    });
  } catch (err: any) {
    console.error('AI Assistant API Error:', err);
    res.status(500).json({ error: 'AI Assistant error', message: err?.message || 'Failed to generate response' });
  }
});

// Cover Image Proxy with Memory Cache
const coverCache = new Map<string, { data: Buffer; contentType: string; timestamp: number }>();
const MAX_COVER_CACHE_SIZE = 1000;

app.get('/api/cover/:path(*)', async (req, res) => {
  const coverPath = req.params.path;
  if (!coverPath) {
    return res.status(400).send('Invalid cover path');
  }

  // Serve from memory cache if available
  const cached = coverCache.get(coverPath);
  if (cached && (Date.now() - cached.timestamp < 86400000 * 7)) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return res.send(cached.data);
  }

  const primaryUrl = `https://raw.githubusercontent.com/gn-math/covers/main/${coverPath}`;
  const fallbackUrl = `https://raw.githack.com/gn-math/covers/main/${coverPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });
    }

    if (!response.ok) {
      return res.status(response.status).send('Cover image not found');
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to memory cache (purge oldest if cache is full)
    if (coverCache.size >= MAX_COVER_CACHE_SIZE) {
      const firstKey = coverCache.keys().next().value;
      if (firstKey) coverCache.delete(firstKey);
    }
    coverCache.set(coverPath, { data: buffer, contentType, timestamp: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error fetching cover');
  }
});

// File map lookup
const fileMapPath = path.resolve(__dirname, 'src/data/gnMathFileMap.json');
let fileMap: Record<string, string> = {};
if (fs.existsSync(fileMapPath)) {
  try {
    fileMap = JSON.parse(fs.readFileSync(fileMapPath, 'utf8'));
  } catch {}
}

// Proxy UGS game files to force text/html MIME type and guarantee 100% playable iframe rendering
app.get('/api/ugs/:path(*)', async (req, res) => {
  const ugsPath = req.params.path;
  if (!ugsPath) {
    return res.status(400).send('Invalid UGS game path');
  }

  const cleanPath = ugsPath.startsWith('/') ? ugsPath : `/${ugsPath}`;
  const fullPath = cleanPath.startsWith('/ugs/') ? cleanPath : `/ugs${cleanPath}`;

  const primaryUrl = `https://cdn.jsdelivr.net/gh/gmshelf/ugs@main${fullPath}`;
  const fallbackUrl = `https://raw.githubusercontent.com/gmshelf/ugs/main${fullPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });
    }

    // Fallback for missing TurboWarp scaffolding script files (e.g., script.js, scaffolding.js)
    if (!response.ok) {
      const lower = fullPath.toLowerCase();
      if (
        lower.endsWith('script.js') ||
        lower.endsWith('scaffolding.js') ||
        lower.endsWith('scaffolding-full.js') ||
        lower.endsWith('scaffolding-min.js')
      ) {
        const scaffoldingBuffer = await getScaffoldingBuffer();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(scaffoldingBuffer);
      }

      return res.status(response.status).send('UGS game file not found');
    }

    const isHtml = fullPath.endsWith('.html') || fullPath.endsWith('.htm') || !fullPath.includes('.');

    if (isHtml) {
      const rawText = await response.text();
      let processedHtml = processGameHtml(rawText, '/api/ugs/script.js');
      const baseTag = `<base href="https://cdn.jsdelivr.net/gh/gmshelf/ugs@main/ugs/">`;
      if (processedHtml.includes('<head>')) {
        processedHtml = processedHtml.replace('<head>', `<head>${baseTag}`);
      } else if (processedHtml.includes('<html>')) {
        processedHtml = processedHtml.replace('<html>', `<html><head>${baseTag}</head>`);
      } else {
        processedHtml = `${baseTag}${processedHtml}`;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(processedHtml);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error proxying UGS game file');
  }
});

// Proxy CKV game files to force text/html MIME type and guarantee 100% playable iframe rendering
app.get('/api/ckv/:path(*)', async (req, res) => {
  const ckvPath = req.params.path;
  if (!ckvPath) {
    return res.status(400).send('Invalid CKV game path');
  }

  const cleanPath = ckvPath.startsWith('/') ? ckvPath : `/${ckvPath}`;
  const fullPath = cleanPath.startsWith('/ckv/') ? cleanPath.replace(/^\/ckv\//, '/') : cleanPath;

  const primaryUrl = `https://wanocapy.github.io/ChickenKingsVault${fullPath}`;
  const fallbackUrl = `https://raw.githubusercontent.com/WanoCapy/ChickenKingsVault/main${fullPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!response.ok) {
      return res.status(response.status).send('CKV game file not found');
    }

    const isHtml = fullPath.endsWith('.html') || fullPath.endsWith('.htm') || !fullPath.includes('.');

    if (isHtml) {
      const rawText = await response.text();
      const processedHtml = processGameHtml(rawText, '/api/ugs/script.js');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(processedHtml);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error proxying CKV game file');
  }
});

// Proxy game files to guarantee 100% reliable iframe loading
app.get('/api/raw/:filename(*)', async (req, res) => {
  let rawPath = req.params.filename || '';
  if (!rawPath) {
    return res.status(400).send('Invalid game filename');
  }

  // Look up in gnMathFileMap
  const mapped = fileMap[rawPath] || fileMap[`${rawPath}.html`] || fileMap[rawPath.replace(/\.html$/, '')];
  if (mapped) {
    rawPath = mapped;
  } else if (!rawPath.includes('.') && !rawPath.includes('/')) {
    rawPath = `${rawPath}.html`;
  }

  const isHtml = rawPath.endsWith('.html') || rawPath.endsWith('.htm');
  const baseNum = rawPath.match(/^\d+/)?.[0];
  const candidates = [
    rawPath,
    ...(baseNum ? [
      `${baseNum}-fix3.html`,
      `${baseNum}-fix2.html`,
      `${baseNum}-fix.html`,
      `${baseNum}-f.html`,
      `${baseNum}-fde.html`,
      `${baseNum}-pf.html`,
      `${baseNum}.html`
    ] : [])
  ];

  try {
    let response: Response | null = null;
    let successfulFile = rawPath;

    for (const cand of candidates) {
      const rawgithackUrl = `https://raw.githack.com/gn-math/html/main/${cand}`;
      try {
        const testRes = await fetch(rawgithackUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (testRes.ok) {
          response = testRes;
          successfulFile = cand;
          break;
        }
      } catch {}
    }

    if (!response || !response.ok) {
      const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/gn-math/html@main/${rawPath}`;
      response = await fetch(jsdelivrUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!response || !response.ok) {
      const lower = rawPath.toLowerCase();
      if (
        lower.endsWith('script.js') ||
        lower.endsWith('scaffolding.js') ||
        lower.endsWith('scaffolding-full.js') ||
        lower.endsWith('scaffolding-min.js')
      ) {
        const scaffoldingBuffer = await getScaffoldingBuffer();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(scaffoldingBuffer);
      }

      return res.status(response?.status || 404).send(`Failed to fetch game package: ${response?.statusText || 'Not found'}`);
    }

    rawPath = successfulFile;

    if (!isHtml) {
      // Pipe binary / JS / WASM / CSS asset with appropriate headers
      const contentType = response.headers.get('content-type') || 
        (rawPath.endsWith('.js') ? 'application/javascript' :
         rawPath.endsWith('.wasm') ? 'application/wasm' :
         rawPath.endsWith('.css') ? 'text/css' :
         rawPath.endsWith('.png') ? 'image/png' :
         rawPath.endsWith('.jpg') || rawPath.endsWith('.jpeg') ? 'image/jpeg' :
         rawPath.endsWith('.json') ? 'application/json' : 'application/octet-stream');

      const arrayBuffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(arrayBuffer));
    }

    let html = await response.text();
    html = processGameHtml(html, '/api/raw/script.js');

    // Determine directory base for relative asset resolution through raw.githack.com
    const dirBase = rawPath.includes('/') ? rawPath.substring(0, rawPath.lastIndexOf('/') + 1) : '';
    const rawgithackBaseTag = `<base href="https://raw.githack.com/gn-math/html/main/${dirBase}">`;

    // Desktop Spoofing & GPU Optimization script injection
    const desktopSpoof = `${rawgithackBaseTag}<script>(function(){try{
var u='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
Object.defineProperty(navigator,'userAgent',{get:function(){return u},configurable:true});
Object.defineProperty(navigator,'platform',{get:function(){return'Win32'},configurable:true});
Object.defineProperty(navigator,'vendor',{get:function(){return'Google Inc.'},configurable:true});
if(navigator.userAgentData){Object.defineProperty(navigator,'userAgentData',{get:function(){return{brands:[{brand:'Chromium',version:'124'},{brand:'Google Chrome',version:'124'}],mobile:false,platform:'Windows',getHighEntropyValues:function(){return Promise.resolve({architecture:'x86',bitness:'64',mobile:false,platform:'Windows'})}}},configurable:true});}

var s=document.createElement('style');
s.textContent='canvas,#canvas,body{image-rendering:pixelated;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;transform:translate3d(0,0,0);backface-visibility:hidden;}';
(document.head||document.documentElement).appendChild(s);

var origGetContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,attrs){
  attrs=attrs||{};
  if(type==='webgl'||type==='webgl2'||type==='experimental-webgl'){
    attrs.powerPreference='high-performance';
    attrs.desynchronized=true;
    attrs.antialias=false;
    attrs.preserveDrawingBuffer=false;
  }else if(type==='2d'){
    attrs.desynchronized=true;
  }
  return origGetContext.call(this,type,attrs);
};

var trackedAudio=[];
var OrigAudioCtx=window.AudioContext||window.webkitAudioContext;
if(OrigAudioCtx){
  var PatchedAudio=function(){
    var ctx=new OrigAudioCtx();
    trackedAudio.push(ctx);
    return ctx;
  };
  PatchedAudio.prototype=OrigAudioCtx.prototype;
  window.AudioContext=PatchedAudio;
  if(window.webkitAudioContext) window.webkitAudioContext=PatchedAudio;
}

function wakeGameEngine(){
  try{
    trackedAudio.forEach(function(ctx){
      if(ctx&&ctx.state==='suspended'){ctx.resume().catch(function(){});}
    });
    if(typeof window.g_isWindowBlurred!=='undefined') window.g_isWindowBlurred=false;
    if(typeof window.g_WindowHasFocus!=='undefined') window.g_WindowHasFocus=true;
    if(window.g_pGMEntityManager){
      if(typeof window.g_pGMEntityManager.Resume==='function') try{window.g_pGMEntityManager.Resume();}catch(e){}
      if(typeof window.g_pGMEntityManager.UnPause==='function') try{window.g_pGMEntityManager.UnPause();}catch(e){}
    }
    window.focus();
    var c=document.querySelector('canvas')||document.getElementById('canvas');
    if(c){
      if(c.focus) c.focus();
      c.dispatchEvent(new Event('focus'));
    }
    window.dispatchEvent(new Event('focus'));
  }catch(e){}
}

window.addEventListener('focus',wakeGameEngine,true);
window.addEventListener('click',wakeGameEngine,true);
window.addEventListener('pointerdown',wakeGameEngine,true);
window.addEventListener('mousedown',wakeGameEngine,true);
window.addEventListener('keydown',wakeGameEngine,true);
window.addEventListener('touchstart',wakeGameEngine,true);
document.addEventListener('visibilitychange',function(){if(!document.hidden)wakeGameEngine();});

setInterval(function(){
  if(!document.hidden){
    try{
      trackedAudio.forEach(function(ctx){
        if(ctx&&ctx.state==='suspended'){ctx.resume().catch(function(){});}
      });
      if(typeof window.g_isWindowBlurred!=='undefined'&&window.g_isWindowBlurred) window.g_isWindowBlurred=false;
      if(typeof window.g_WindowHasFocus!=='undefined'&&!window.g_WindowHasFocus) window.g_WindowHasFocus=true;
    }catch(e){}
  }
},1000);
}catch(e){}})();</script>`;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${desktopSpoof}`);
    } else if (html.includes('<html>')) {
      html = html.replace('<html>', `<html><head>${desktopSpoof}</head>`);
    } else {
      html = `${desktopSpoof}${html}`;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.send(html);
  } catch (error: any) {
    console.error(`Error loading game ${rawPath}:`, error);
    res.status(500).send(`Error streaming game: ${error?.message || error}`);
  }
});

// Catch-all for API routes to never return HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl || req.path} not found` });
});

// Serve frontend: Vite dev middlewares in development, static files in production
async function startServer() {
  const server = http.createServer(app);

  initWebSocketDatabase(server);

  // Configure wisp-js server options for optimal proxying and compatibility
  wispServer.options.allow_tcp_streams = true;
  wispServer.options.allow_udp_streams = true;
  wispServer.options.allow_direct_ip = true;

  // Unified WebSocket upgrade router (/ws-db and /wisp/) supporting secure wss:// connections
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    const reqUrl = req.url || '/';
    const pathname = reqUrl.split('?')[0];

    if (pathname.startsWith('/socket.io/')) {
      return;
    }

    // Route /wisp/ specifically to wisp-js with split-routing SOCKS5 support for Google/YouTube/CAPTCHA
    if (req.url && (req.url.endsWith('/wisp/') || pathname.endsWith('/wisp/') || pathname === '/wisp' || pathname.startsWith('/wisp/'))) {
      req.url = '/wisp/';
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const clientKey = forwarded || req.socket.remoteAddress || 'default';
      (wispServer.routeRequest as any)(req, socket, head, {
        TCPSocket: createSplitRoutingWispTCPSocket(clientKey),
      });
      return;
    }

    socket.destroy();
  });

  // Never serve FrostHub's SPA index.html for unclaimed /~/sj/* requests; recover Service Worker instead
  app.use('/~/sj', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(503).send(`<!doctype html><html><body style="background:#0f172a;color:#94a3b8;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;"><div style="text-align:center;"><p style="margin:0 0 8px;color:#e2e8f0;font-weight:600;">Initializing proxy service worker…</p><script>(async function(){try{if('serviceWorker' in navigator){await navigator.serviceWorker.register('/sj-sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){});var reg=await navigator.serviceWorker.ready;if(reg&&reg.active){try{reg.active.postMessage({$controller$swrevive:{}});}catch(e){}}if(!sessionStorage.getItem('sj_srv_recover')){sessionStorage.setItem('sj_srv_recover','1');setTimeout(function(){location.reload();},350);return;}sessionStorage.removeItem('sj_srv_recover');}}catch(e){}})();</script></div></body></html>`);
  });

  app.use('/keyforopenrouter.txt', (_req, res) => {
    res.status(404).send('Not found');
  });

  app.use(express.static(path.resolve(__dirname, 'public')));

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🔥 Frosted server running on http://0.0.0.0:${PORT} (Mode: ${IS_PROD ? 'Production' : 'Development'})`);
    console.log(`🛰️  Scramjet v2.0.67-alpha.2 & Wisp server mounted at /wisp/`);
  });
}

startServer();
