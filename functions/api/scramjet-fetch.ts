// Cloudflare Pages Function: Proxy fetch fallback for Scramjet (/api/scramjet-fetch)
import {
  enforceSafeSearchOffUrl,
  enforceSafeSearchOffCookieString,
  sanitizeSafeSearchSetCookie,
  sanitizeSafeSearchLocation,
} from '../../src/utils/safeSearchOff';
import {
  isGoogleSearchDomain,
  isGoogleBotChallenge,
  isYoutubeBotGateText,
  getGoogleBypassProfiles,
  fetchYoutubePlayerBypassEdge,
  patchYtWatchPlayerHtml,
} from '../../src/utils/botBypassHelper';

interface CFContext {
  request: Request;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-SJ-Url, X-SJ-Method, X-SJ-Headers, X-SJ-Session',
  'Access-Control-Expose-Headers': 'X-SJ-Meta, X-SJ-Meta-In-Body',
};

const FORBIDDEN_FORWARD_HEADERS = new Set([
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

const STRIPPED_UPSTREAM_HEADERS = new Set([
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

function fromBase64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    bin += String.fromCharCode(...sub);
  }
  return btoa(bin);
}

const AD_AND_TRACKING_HOST_SUBSTRINGS = [
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

function isGoogleHost(host: string): boolean {
  return /(^|\.)google\.(com|[a-z]{2})(\.[a-z]{2})?$/.test(host);
}

function isAdOrTrackingHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  for (const sub of AD_AND_TRACKING_HOST_SUBSTRINGS) {
    if (host.includes(sub)) return true;
  }
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

export async function onRequest(context: CFContext): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawUrl = (request.headers.get('x-sj-url') || '').trim();
    const method = (request.headers.get('x-sj-method') || 'GET').toUpperCase();
    const rawHeadersB64 = (request.headers.get('x-sj-headers') || '').trim();

    if (!rawUrl) {
      return new Response(JSON.stringify({ error: 'Missing X-SJ-Url' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let targetUrl: URL;
    try {
      targetUrl = enforceSafeSearchOffUrl(new URL(rawUrl));
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return new Response(JSON.stringify({ error: 'Unsupported protocol' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const host = targetUrl.hostname.toLowerCase();
    if (isBlockedHost(host)) {
      return new Response(JSON.stringify({ error: 'Private/loopback host blocked' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let parsedHeaders: [string, string][] = [];
    if (rawHeadersB64) {
      try {
        const arr = JSON.parse(fromBase64Utf8(rawHeadersB64));
        if (Array.isArray(arr)) {
          parsedHeaders = arr.filter(
            (pair): pair is [string, string] =>
              Array.isArray(pair) && pair.length >= 2 && typeof pair[0] === 'string' && typeof pair[1] === 'string'
          );
        }
      } catch {}
    }

    if (isGoogleHost(host)) {
      targetUrl.searchParams.set('hl', 'en');
    }

    const forwardMap = new Map<string, string>();
    const cookieParts: string[] = [];
    for (const [k, v] of parsedHeaders) {
      const lower = k.toLowerCase().trim();
      if (!lower || lower.startsWith(':') || FORBIDDEN_FORWARD_HEADERS.has(lower)) continue;
      if (lower === 'youtube-restrict' || lower === 'x-youtube-restrict') continue;
      const cleanVal = v.replace(/[\r\n\0]+/g, ' ').trim();
      if (lower === 'prefer' && cleanVal.toLowerCase().includes('safe')) continue;
      if (lower === 'cookie') {
        if (cleanVal) cookieParts.push(cleanVal);
      } else {
        forwardMap.set(lower, cleanVal);
      }
    }
    const updatedCookie = enforceSafeSearchOffCookieString(host, cookieParts.join('; '));
    if (updatedCookie) {
      forwardMap.set('cookie', updatedCookie);
    }

    const incomingUa = (request.headers.get('user-agent') || '').trim();
    const ua = forwardMap.get('user-agent') || '';
    if (!ua || ua.includes('HeadlessChrome') || ua.includes('Scramjet')) {
      const safeUa =
        incomingUa && !incomingUa.includes('HeadlessChrome')
          ? incomingUa
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      forwardMap.set('user-agent', safeUa);
    }

    const effectiveUaLower = (forwardMap.get('user-agent') || '').toLowerCase();
    if (effectiveUaLower.includes('android')) {
      const isQuestVr = effectiveUaLower.includes('quest');
      forwardMap.set('sec-ch-ua', '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"');
      forwardMap.set('sec-ch-ua-mobile', '?1');
      forwardMap.set('sec-ch-ua-platform', '"Android"');
      if (!forwardMap.has('sec-ch-ua-platform-version')) {
        forwardMap.set('sec-ch-ua-platform-version', isQuestVr ? '"12.0.0"' : '"14.0.0"');
      }
      if (!forwardMap.has('sec-ch-ua-model')) {
        forwardMap.set('sec-ch-ua-model', isQuestVr ? '"Quest 3"' : '"SM-S928B"');
      }
      forwardMap.set('sec-ch-ua-arch', '"arm"');
      forwardMap.set('sec-ch-ua-bitness', '"64"');
      forwardMap.set('sec-ch-ua-wow64', '?0');
      if (!forwardMap.has('sec-ch-ua-full-version-list')) {
        forwardMap.set(
          'sec-ch-ua-full-version-list',
          '"Google Chrome";v="131.0.6778.135", "Chromium";v="131.0.6778.135", "Not_A Brand";v="24.0.0.0"'
        );
      }
    } else {
      const clientHintKeys = [
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'sec-ch-ua-full-version-list',
        'sec-ch-ua-arch',
        'sec-ch-ua-model',
      ];
      for (const chKey of clientHintKeys) {
        if (!forwardMap.has(chKey)) {
          const chVal = request.headers.get(chKey);
          if (chVal && chVal.trim()) {
            forwardMap.set(chKey, chVal.trim());
          }
        }
      }
    }

    if (!forwardMap.has('accept-language')) {
      const incomingLang = (request.headers.get('accept-language') || '').trim();
      forwardMap.set('accept-language', incomingLang || 'en-US,en;q=0.9');
    }
    if (isGoogleHost(host)) {
      forwardMap.set('accept-language', 'en-US,en;q=0.9');
    }

    // Prevent leaking the .pages.dev or proxy host in Origin/Referer
    let proxyHost = '';
    try {
      proxyHost = new URL(request.url).hostname.toLowerCase();
    } catch {}
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

    const forwardHeaders = new Headers();
    for (const [k, v] of forwardMap.entries()) {
      forwardHeaders.set(k, v);
    }

    const hasBody = method !== 'GET' && method !== 'HEAD';
    const bodyBuf = hasBody ? await request.arrayBuffer() : null;

    // Preserve HTTP redirects (301/302/303/307/308) with Location header so Scramjet updates client.url
    // on cross-domain redirects (e.g. DuckDuckGo /l/, shortlinks) instead of rendering under the old origin
    let upstreamRes = await fetch(targetUrl.href, {
      method,
      headers: forwardHeaders,
      body: hasBody && bodyBuf && bodyBuf.byteLength > 0 ? bodyBuf : undefined,
      redirect: 'manual',
    });
    if (upstreamRes.status === 0 || upstreamRes.type === 'opaqueredirect') {
      upstreamRes = await fetch(targetUrl.href, {
        method,
        headers: forwardHeaders,
        body: hasBody && bodyBuf && bodyBuf.byteLength > 0 ? bodyBuf : undefined,
        redirect: 'follow',
      });
    }

    const outHeaders: [string, string][] = [];
    for (const [k, v] of upstreamRes.headers.entries()) {
      const lower = k.toLowerCase().trim();
      if (STRIPPED_UPSTREAM_HEADERS.has(lower)) continue;
      if (lower.startsWith('x-goog-') || lower.startsWith('x-fb-')) continue;
      let nextVal = v;
      if (lower === 'location' && v) {
        try {
          nextVal = new URL(v, targetUrl.href).href;
        } catch {}
        nextVal = sanitizeSafeSearchLocation(nextVal, targetUrl.origin);
      }
      outHeaders.push([k, nextVal]);
    }

    if (upstreamRes.url && upstreamRes.url !== targetUrl.href) {
      outHeaders.push(['x-final-url', sanitizeSafeSearchLocation(upstreamRes.url, targetUrl.origin)]);
    }

    const setCookies =
      typeof (upstreamRes.headers as any).getSetCookie === 'function'
        ? ((upstreamRes.headers as any).getSetCookie() as string[])
        : [];
    if (setCookies.length > 0) {
      for (const sc of setCookies) {
        outHeaders.push(['set-cookie', sanitizeSafeSearchSetCookie(host, sc)]);
      }
    } else {
      const singleCookie = upstreamRes.headers.get('set-cookie');
      if (singleCookie) {
        outHeaders.push(['set-cookie', sanitizeSafeSearchSetCookie(host, singleCookie)]);
      }
    }

    const isDocument =
      forwardMap.get('sec-fetch-dest') === 'document' ||
      (forwardMap.get('accept') || '').includes('text/html');

    let rawStatus = upstreamRes.status;
    if (rawStatus <= 0 || !Number.isFinite(rawStatus)) {
      rawStatus = 200;
    }
    const finalStatus = rawStatus === 404 && !isDocument ? 204 : rawStatus;
    const finalStatusText = finalStatus === 204 ? 'No Content' : upstreamRes.statusText || 'OK';

    const isNullBodyStatus =
      finalStatus === 101 ||
      finalStatus === 204 ||
      finalStatus === 205 ||
      finalStatus === 304 ||
      method === 'HEAD';

    let rawBodyBytes = isNullBodyStatus ? new Uint8Array(0) : new Uint8Array(await upstreamRes.arrayBuffer());
    let finalOutStatus = finalStatus;
    let finalOutStatusText = finalStatusText;

    // 1. Real Google Search /sorry/ or 429 bot verification bypass (Android VR Quest 3 / Android / clean cookie-less retry — never fake HTML)
    if (!isNullBodyStatus && (isGoogleSearchDomain(host) || targetUrl.pathname.toLowerCase().startsWith('/sorry'))) {
      const probeText = new TextDecoder().decode(rawBodyBytes.subarray(0, 24000));
      const locHeader = upstreamRes.headers.get('location') || '';
      const finalResUrl = upstreamRes.url || '';
      if (
        finalResUrl.toLowerCase().includes('/sorry/') ||
        isGoogleBotChallenge(targetUrl, finalOutStatus, locHeader, probeText)
      ) {
        let retryTarget = targetUrl;
        if (targetUrl.pathname.toLowerCase().startsWith('/sorry')) {
          const cont = targetUrl.searchParams.get('continue');
          if (cont) {
            try {
              retryTarget = enforceSafeSearchOffUrl(new URL(cont));
            } catch {}
          }
        }

        for (const profile of getGoogleBypassProfiles()) {
          try {
            const cleanUrl = new URL(retryTarget.href);
            if (cleanUrl.pathname === '/search') {
              cleanUrl.searchParams.set('safe', 'off');
              cleanUrl.searchParams.set('hl', 'en');
              cleanUrl.searchParams.set('gl', 'US');
              if (profile.useGbv) {
                cleanUrl.searchParams.set('gbv', '1');
              }
            }
            const retryHeaders = new Headers(forwardHeaders);
            retryHeaders.delete('cookie');
            retryHeaders.set('user-agent', profile.userAgent);
            if (profile.secChUa) retryHeaders.set('sec-ch-ua', profile.secChUa);
            if (profile.secChUaMobile) retryHeaders.set('sec-ch-ua-mobile', profile.secChUaMobile);
            if (profile.secChUaPlatform) retryHeaders.set('sec-ch-ua-platform', profile.secChUaPlatform);
            if (profile.secChUaModel) retryHeaders.set('sec-ch-ua-model', profile.secChUaModel);
            else retryHeaders.delete('sec-ch-ua-model');
            if (profile.secChUaPlatformVersion) retryHeaders.set('sec-ch-ua-platform-version', profile.secChUaPlatformVersion);
            else retryHeaders.delete('sec-ch-ua-platform-version');

            const cleanRes = await fetch(cleanUrl.href, {
              method: 'GET',
              headers: retryHeaders,
              redirect: 'manual',
            });
            const cleanLoc = cleanRes.headers.get('location') || '';
            const cleanBytes = new Uint8Array(await cleanRes.arrayBuffer());
            const cleanProbe = new TextDecoder().decode(cleanBytes.subarray(0, 24000));
            if (
              cleanRes.status === 200 &&
              !(cleanRes.url || '').toLowerCase().includes('/sorry/') &&
              !isGoogleBotChallenge(cleanUrl, cleanRes.status, cleanLoc, cleanProbe)
            ) {
              rawBodyBytes = cleanBytes;
              finalOutStatus = 200;
              finalOutStatusText = cleanRes.statusText || 'OK';
              for (let i = outHeaders.length - 1; i >= 0; i--) {
                const hk = outHeaders[i][0].toLowerCase();
                if (hk === 'location' || hk === 'set-cookie' || hk === 'content-type' || hk === 'content-length') {
                  outHeaders.splice(i, 1);
                }
              }
              const ct = cleanRes.headers.get('content-type');
              outHeaders.push(['content-type', ct || 'text/html; charset=utf-8']);
              break;
            }
          } catch {}
        }
      }
    }

    // 2. YouTube bot-gate ("Sign in to confirm you're not a bot") bypass on Cloudflare Workers
    if (!isNullBodyStatus && finalOutStatus === 200 && (host === 'youtube.com' || host.endsWith('.youtube.com'))) {
      const isPlayerEndpoint = targetUrl.pathname.startsWith('/youtubei/v1/player');
      const isWatchPage = targetUrl.pathname === '/watch';
      if (isPlayerEndpoint || isWatchPage) {
        const ytText = new TextDecoder().decode(rawBodyBytes);
        if (isYoutubeBotGateText(ytText) || (isPlayerEndpoint && !ytText.includes('streamingData'))) {
          let videoId = targetUrl.searchParams.get('v') || '';
          if (!videoId && isPlayerEndpoint) {
            try {
              const parsed = JSON.parse(ytText);
              videoId = String(parsed?.videoDetails?.videoId || '');
            } catch {}
            if (!videoId && bodyBuf && bodyBuf.byteLength > 0) {
              try {
                const reqJson = JSON.parse(new TextDecoder().decode(bodyBuf));
                videoId = String(reqJson?.videoId || '');
              } catch {}
            }
          }
          if (videoId) {
            const bypassData = await fetchYoutubePlayerBypassEdge(videoId);
            if (bypassData?.streamingData) {
              if (isPlayerEndpoint) {
                let parsed: any = {};
                try {
                  parsed = JSON.parse(ytText);
                } catch {}
                const merged = {
                  ...parsed,
                  playabilityStatus: bypassData.playabilityStatus || { status: 'OK', playableInEmbed: true },
                  streamingData: bypassData.streamingData,
                  videoDetails: parsed.videoDetails || bypassData.videoDetails,
                  captions: parsed.captions || bypassData.captions,
                  storyboards: parsed.storyboards || bypassData.storyboards,
                };
                rawBodyBytes = new TextEncoder().encode(JSON.stringify(merged));
              } else {
                const patchedHtml = patchYtWatchPlayerHtml(ytText, bypassData);
                if (patchedHtml) {
                  rawBodyBytes = new TextEncoder().encode(patchedHtml);
                }
              }
              for (let i = outHeaders.length - 1; i >= 0; i--) {
                if (outHeaders[i][0].toLowerCase() === 'set-cookie') outHeaders.splice(i, 1);
              }
            }
          }
        }
      }
    }

    if (!isNullBodyStatus) {
      outHeaders.push(['content-length', String(rawBodyBytes.byteLength)]);
    }

    let metaJson = JSON.stringify({
      status: finalOutStatus,
      statusText: finalOutStatusText,
      headers: outHeaders,
    });
    let metaB64 = toBase64Utf8(metaJson);

    // Keep X-SJ-Meta compact (< 3KB) so reverse proxies never fail with 502 header overflow
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
          l === 'access-control-allow-origin' ||
          l === 'x-final-url'
        );
      });
      metaJson = JSON.stringify({
        status: finalStatus,
        statusText: finalStatusText,
        headers: critical,
      });
      metaB64 = toBase64Utf8(metaJson);
    }

    // Is cacheable static asset (audio files, images, fonts)
    const isStaticAsset =
      /\.(mp3|wav|ogg|m4a|webm|png|jpe?g|webp|gif|svg|woff2?|ttf|css)$/i.test(targetUrl.pathname) ||
      outHeaders.some(([k, v]) => k.toLowerCase() === 'content-type' && (v.includes('audio/') || v.includes('image/') || v.includes('font/')));
    const cacheControlVal = isStaticAsset ? 'public, max-age=86400, stale-while-revalidate=86400' : 'no-store';

    if (metaB64.length > 3000) {
      const metaBytes = new TextEncoder().encode(metaJson);
      const combined = new Uint8Array(4 + metaBytes.byteLength + rawBodyBytes.byteLength);
      const view = new DataView(combined.buffer);
      view.setUint32(0, metaBytes.byteLength, false);
      combined.set(metaBytes, 4);
      combined.set(rawBodyBytes, 4 + metaBytes.byteLength);

      return new Response(combined, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'X-SJ-Meta-In-Body': '1',
          'Content-Type': 'application/octet-stream',
          'Cache-Control': cacheControlVal,
        },
      });
    }

    return new Response(rawBodyBytes, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'X-SJ-Meta': metaB64,
        'Content-Type': 'application/octet-stream',
        'Cache-Control': cacheControlVal,
      },
    });
  } catch (err: any) {
    const cleanMsg = String(err?.message || err || 'Upstream fetch failed')
      .replace(/<[^>]+>/g, '')
      .slice(0, 150);
    return new Response(JSON.stringify({ error: 'Upstream proxy fetch failed', message: cleanMsg }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}
