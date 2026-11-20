// Cloudflare HLS reverse proxy (/api/proxy-stream), mirrors the Express handler in src/server/sethsrcEngine.ts

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const HEADER_TIMEOUT_MS = 12000;
const CARTOON_FALLBACKS = [
  'https://cdn4.skygo.mn/live/disk1/Cartoon_Network/HLSv3-FTA/Cartoon_Network.m3u8',
  'https://turnerlive.warnermediacdn.com/hls/live/2023160/tooneast/noslate/VIDEO_3_1928000.m3u8',
];
const ADULT_SWIM_FALLBACK = 'https://turnerlive.warnermediacdn.com/hls/live/2023185/aswest/noslate/VIDEO_1_5128000.m3u8';

function fallbackUrlsFor(targetUrl: string): string[] {
  const lower = targetUrl.toLowerCase();
  if (targetUrl.includes('tooneast') || lower.includes('cartoon')) return CARTOON_FALLBACKS;
  if (lower.includes('adult') || targetUrl.includes('aswest')) return [ADULT_SWIM_FALLBACK];
  return [];
}

function buildUpstreamHeaders(targetUrl: string, range: string | null, referer: string): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: '*/*' };
  if (range) headers.Range = range;
  if (referer) {
    headers.Referer = referer;
    try {
      headers.Origin = new URL(referer).origin;
    } catch {
      headers.Origin = referer;
    }
  }
  if (targetUrl.includes('pluto.tv')) {
    headers['plutotv-device-dnt'] = '1';
    headers['plutotv-device-model'] = 'web';
  }
  return headers;
}

async function fetchUpstream(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, redirect: 'follow', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function proxied(absoluteUrl: string, refSuffix: string): string {
  return `/api/proxy-stream?url=${encodeURIComponent(absoluteUrl)}${refSuffix}`;
}

function rewritePlaylist(text: string, baseUrl: string, refSuffix: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#EXT-X-MEDIA:') && trimmed.includes('TYPE=AUDIO')) {
        line = line.replace('DEFAULT=NO', 'DEFAULT=YES').replace('AUTOSELECT=NO', 'AUTOSELECT=YES');
      }

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uriValue: string) => {
          try {
            return `URI="${proxied(new URL(uriValue, baseUrl).href, refSuffix)}"`;
          } catch {
            return `URI="${uriValue}"`;
          }
        });
      }

      try {
        return proxied(new URL(trimmed, baseUrl).href, refSuffix);
      } catch {
        return trimmed;
      }
    })
    .join('\n');
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const params = new URL(request.url).searchParams;
  const targetUrl = (params.get('url') || '').trim();
  if (!targetUrl) {
    return new Response('Missing target URL', { status: 400, headers: CORS_HEADERS });
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return new Response('Invalid target URL', { status: 400, headers: CORS_HEADERS });
  }
  if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
    return new Response('Unsupported protocol', { status: 400, headers: CORS_HEADERS });
  }

  const explicitReferer = (params.get('referer') || '').trim();
  const refSuffix = explicitReferer ? `&referer=${encodeURIComponent(explicitReferer)}` : '';
  const range = request.headers.get('range');

  let upstream: Response | null = null;
  try {
    upstream = await fetchUpstream(targetUrl, buildUpstreamHeaders(targetUrl, range, explicitReferer));
  } catch {
    upstream = null;
  }
  if (!upstream || !upstream.ok) {
    for (const fallback of fallbackUrlsFor(targetUrl)) {
      try {
        const candidate = await fetchUpstream(fallback, buildUpstreamHeaders(fallback, range, ''));
        if (candidate.ok) {
          upstream = candidate;
          break;
        }
      } catch {}
    }
  }
  if (!upstream) {
    return new Response('Upstream stream fetch failed', { status: 502, headers: CORS_HEADERS });
  }
  if (!upstream.ok) {
    return new Response(`Upstream returned status ${upstream.status}`, { status: upstream.status, headers: CORS_HEADERS });
  }

  const effectiveUrl = upstream.url || targetUrl;
  const lowerUrl = effectiveUrl.toLowerCase().split('?')[0];
  const rawContentType = (upstream.headers.get('content-type') || '').toLowerCase();

  const isMediaOrKey =
    /\.(ts|m4s|mp4|m4v|m4a|cmfv|cmfa|aac|mp3|key|bin)$/.test(lowerUrl) || lowerUrl.includes('keyaes');
  const isSubtitle =
    lowerUrl.endsWith('.vtt') || lowerUrl.endsWith('.webvtt') || lowerUrl.endsWith('.ttml') || rawContentType.includes('text/vtt');
  const isPlaylist =
    !isMediaOrKey &&
    !isSubtitle &&
    (lowerUrl.endsWith('.m3u8') ||
      lowerUrl.endsWith('.m3u') ||
      lowerUrl.includes('playlist') ||
      lowerUrl.includes('master') ||
      rawContentType.includes('mpegurl') ||
      rawContentType.includes('m3u'));

  if (isPlaylist) {
    const text = await upstream.text();
    if (text.includes('#EXTM3U') || text.includes('#EXTINF') || text.includes('#EXT-X-')) {
      return new Response(request.method === 'HEAD' ? null : rewritePlaylist(text, effectiveUrl, refSuffix), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    return new Response(request.method === 'HEAD' ? null : text, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': rawContentType || 'text/plain; charset=utf-8' },
    });
  }

  if (lowerUrl.endsWith('.key') || lowerUrl.includes('keyaes')) {
    return new Response(request.method === 'HEAD' ? null : await upstream.arrayBuffer(), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=300' },
    });
  }

  const headers: Record<string, string> = { ...CORS_HEADERS };
  const contentRange = upstream.headers.get('content-range');
  const contentLength = upstream.headers.get('content-length');
  const contentEncoding = upstream.headers.get('content-encoding');
  const acceptRanges = upstream.headers.get('accept-ranges');
  if (contentRange) headers['Content-Range'] = contentRange;
  if (contentLength && !contentEncoding) headers['Content-Length'] = contentLength;
  if (acceptRanges) headers['Accept-Ranges'] = acceptRanges;

  if (lowerUrl.endsWith('.ts')) {
    headers['Content-Type'] = 'video/mp2t';
    headers['Cache-Control'] = 'public, max-age=300';
  } else if (lowerUrl.endsWith('.m4s') || lowerUrl.endsWith('.cmfv') || lowerUrl.endsWith('.cmfa')) {
    headers['Content-Type'] = 'video/iso.segment';
    headers['Cache-Control'] = 'public, max-age=300';
  } else if (isSubtitle) {
    headers['Content-Type'] = 'text/vtt; charset=utf-8';
    headers['Cache-Control'] = 'public, max-age=120';
  } else {
    headers['Content-Type'] = rawContentType || 'application/octet-stream';
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers,
  });
}
