export function isGoogleSearchDomain(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  return /^(www\.|encrypted\.)?google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(h);
}

export function isGoogleBotChallenge(
  targetUrl: URL,
  status: number,
  locationHeader: string,
  bodyText: string
): boolean {
  const host = targetUrl.hostname.toLowerCase();
  const locLower = (locationHeader || '').toLowerCase();
  const pathLower = targetUrl.pathname.toLowerCase();

  if (locLower.includes('/sorry/') || locLower.includes('ipv4.google.com/sorry') || locLower.includes('ipv6.google.com/sorry')) {
    return true;
  }
  if (pathLower.startsWith('/sorry')) {
    return true;
  }
  if (!isGoogleSearchDomain(host)) return false;

  if (status === 429 || status === 403 || status === 503) {
    return true;
  }

  const lower = (bodyText || '').slice(0, 24000).toLowerCase();
  return (
    lower.includes('our systems have detected unusual traffic') ||
    lower.includes('/sorry/index') ||
    lower.includes('unusual traffic from your computer network') ||
    (lower.includes('about this page') && lower.includes('g-recaptcha')) ||
    lower.includes('sorry/image')
  );
}

export interface GoogleBypassProfile {
  name: string;
  userAgent: string;
  secChUa?: string;
  secChUaMobile?: string;
  secChUaPlatform?: string;
  secChUaModel?: string;
  secChUaPlatformVersion?: string;
  useGbv?: boolean;
}

export function getGoogleBypassProfiles(): GoogleBypassProfile[] {
  return [
    {
      name: 'desktop-clean',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      secChUaMobile: '?0',
      secChUaPlatform: '"Windows"',
      useGbv: false,
    },
    {
      name: 'android-vr-quest',
      userAgent:
        'Mozilla/5.0 (Linux; Android 12L; Quest 3 Build/SQ3A.220605.009.A1) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/36.0.0.10.22 Chrome/131.0.6778.135 Mobile VR Safari/537.36',
      secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      secChUaMobile: '?1',
      secChUaPlatform: '"Android"',
      secChUaModel: '"Quest 3"',
      secChUaPlatformVersion: '"12.0.0"',
      useGbv: false,
    },
    {
      name: 'android-mobile',
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36',
      secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      secChUaMobile: '?1',
      secChUaPlatform: '"Android"',
      secChUaModel: '"SM-S928B"',
      secChUaPlatformVersion: '"14.0.0"',
      useGbv: true,
    },
  ];
}

export function isYoutubeBotGateText(text: string): boolean {
  if (!text) return false;
  let sample = text;
  const markerIdx = text.indexOf('ytInitialPlayerResponse');
  if (markerIdx !== -1) {
    sample = text.slice(markerIdx, markerIdx + 120000);
  } else if (text.length > 512000) {
    sample = text.slice(0, 512000);
  }
  const lower = sample.toLowerCase();
  return (
    lower.includes('"status":"login_required"') ||
    lower.includes('"status": "login_required"') ||
    lower.includes('"status":"unplayable"') ||
    lower.includes('"status": "unplayable"') ||
    lower.includes("sign in to confirm you're not a bot") ||
    lower.includes('sign in to confirm you’re not a bot') ||
    lower.includes('confirm you\\u0027re not a bot') ||
    lower.includes('confirm you&#39;re not a bot') ||
    lower.includes('api.invalidparam') ||
    lower.includes('invalidvideodata')
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYoutubePlayerBypassEdge(videoId: string): Promise<Record<string, any> | null> {
  if (!videoId || !/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) return null;

  const clientConfigs = [
    {
      ua: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
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
    {
      ua: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
      client: {
        clientName: 'IOS',
        clientVersion: '19.29.1',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '17.5.1.21F90',
        hl: 'en',
        gl: 'US',
      },
    },
  ];

  for (const cfg of clientConfigs) {
    try {
      const res = await fetchWithTimeout(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': cfg.ua,
          },
          body: JSON.stringify({
            videoId,
            context: { client: cfg.client },
          }),
        },
        7000
      );
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, any>;
      const formats = Array.isArray(json?.streamingData?.formats) ? json.streamingData.formats : [];
      const adaptive = Array.isArray(json?.streamingData?.adaptiveFormats) ? json.streamingData.adaptiveFormats : [];
      if (json?.playabilityStatus?.status === 'OK' && (formats.length > 0 || adaptive.length > 0)) {
        return json;
      }
    } catch {}
  }

  return null;
}

export function patchYtWatchPlayerHtml(html: string, playerData: Record<string, any>): string | null {
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
    if (ch === '{') depth++;
    else if (ch === '}') {
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
      playabilityStatus: playerData.playabilityStatus || { status: 'OK', playableInEmbed: true },
      streamingData: playerData.streamingData || parsed.streamingData,
      videoDetails: parsed.videoDetails || playerData.videoDetails,
      captions: parsed.captions || playerData.captions,
      storyboards: parsed.storyboards || playerData.storyboards,
    };
    return html.slice(0, start) + JSON.stringify(patched) + html.slice(end);
  } catch {
    return null;
  }
}
