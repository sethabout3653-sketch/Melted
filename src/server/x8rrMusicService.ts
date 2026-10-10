import { resolveDirectCdnStreams } from '../services/youtubeProxy';
import { getStreamUrlWithYtDlp } from './ytdlpService';

export interface StreamResolutionResult {
  streamUrl: string;
  format: 'audio' | 'video';
  mimeType?: string;
  contentLength?: number;
}

const INVIDIOUS_INSTANCES = [
  'https://yewtu.be',
  'https://invidious.nerdvpn.de',
  'https://invidious.f5.si',
  'https://inv.nadeko.net',
  'https://invidious.projectsegfau.lt',
  'https://invidious.tiekoetter.com',
  'https://vid.priv.au',
  'https://invidious.privacyredirect.com',
  'https://inv.us.projectsegfau.lt',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.privacy.com.de',
  'https://api.piped.privacydev.net',
  'https://pipedapi.drgns.space',
  'https://piped-api.garudalinux.org',
];

/**
 * Custom x8rr-inspired Self-Hosted Music API Stream Resolver
 * Extracts raw audio or video stream URLs directly via yt-dlp, InnerTube, and Invidious/Piped.
 */
export async function getX8rrMediaStreamUrl(videoId: string, isVideo: boolean = false): Promise<string> {
  // 0. Try Secure InnerTube Proxy utility first (fetching streamingData.adaptiveFormats directly)
  // This is the most reliable method that doesn't trigger bot reloads
  try {
    const cdn = await resolveDirectCdnStreams(videoId);
    if (isVideo && cdn.videoUrl) return cdn.videoUrl;
    if (!isVideo && cdn.audioUrl) return cdn.audioUrl;
  } catch {
    // Fall back to next method
  }

  // 1. Try Piped API instances next (cleanest direct stream delivery)
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${instance}/streams/${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) continue;
      const data: any = await res.json();

      if (isVideo) {
        const videoStreams = data.videoStreams || [];
        const muxed = videoStreams.find((s: any) => s.url && s.quality && !s.videoOnly);
        if (muxed?.url) return muxed.url;

        const anyVideo = videoStreams.find((s: any) => s.url);
        if (anyVideo?.url) return anyVideo.url;
      } else {
        const audioStreams = data.audioStreams || [];
        const bestAudio = audioStreams.find((s: any) => s.url && (s.mimeType?.includes('audio') || s.format?.includes('M4A') || s.format?.includes('WEBM'))) || audioStreams[0];
        if (bestAudio?.url) return bestAudio.url;
      }
    } catch {
      // Try next Piped instance
    }
  }

  // 2. Try Invidious API instances pool
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (!res.ok) continue;
      const data: any = await res.json();

      if (isVideo) {
        // Prioritize formatStreams (muxed video + audio with itag 22 or 18)
        const formatStreams = data.formatStreams || [];
        const muxedVideo = formatStreams.find((s: any) => s.url && (s.itag === '22' || s.itag === '18' || s.type?.includes('video/mp4')));
        if (muxedVideo?.url) return muxedVideo.url;
        if (formatStreams.length > 0 && formatStreams[formatStreams.length - 1].url) {
          return formatStreams[formatStreams.length - 1].url;
        }

        const adaptiveStreams = data.adaptiveFormats || [];
        const videoStream = adaptiveStreams.find((s: any) => s.type?.includes('video/mp4') && s.url);
        if (videoStream?.url) return videoStream.url;
      } else {
        const adaptiveStreams = data.adaptiveFormats || [];
        const audioStream = adaptiveStreams.find((s: any) => (s.type?.includes('audio/webm') || s.type?.includes('audio/mp4') || s.type?.includes('audio/mpeg')) && s.url);
        if (audioStream?.url) return audioStream.url;

        if (Array.isArray(data.formatStreams) && data.formatStreams.length > 0) {
          return data.formatStreams[0].url;
        }
      }
    } catch {
      // Try next Invidious instance
    }
  }

  // 3. Last Resort: Try yt-dlp only if everything else failed
  try {
    const ytdlpUrl = await getStreamUrlWithYtDlp(videoId, isVideo);
    if (ytdlpUrl) return ytdlpUrl;
  } catch {
    // Continue
  }

  // 4. Ultimate Fallback: Direct Invidious latest_version URL with fallback itags
  return `${INVIDIOUS_INSTANCES[Math.floor(Math.random() * INVIDIOUS_INSTANCES.length)]}/latest_version?id=${videoId}&itag=${isVideo ? '22' : '140'}`;
}
