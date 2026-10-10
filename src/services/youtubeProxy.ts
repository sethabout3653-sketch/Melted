import fetch from 'node-fetch';

export interface InnerTubeFormat {
  itag: number;
  url: string;
  mimeType: string;
  bitrate?: number;
  width?: number;
  height?: number;
  contentLength?: string;
  quality?: string;
  audioQuality?: string;
  averageBitrate?: number;
}

export interface InnerTubeStreamData {
  formats?: InnerTubeFormat[];
  adaptiveFormats?: InnerTubeFormat[];
  expiresInSeconds?: string;
}

export interface StreamResolutionResult {
  audioUrl: string | null;
  videoUrl: string | null;
  title?: string;
  author?: string;
  duration?: number;
  thumbnail?: string;
}

const ANDROID_CLIENT_HEADERS = {
  'User-Agent': 'com.google.android.youtube/19.29.35 (Linux; U; Android 14; en_US; Pixel 8 Build/UP1A.231005.007)',
  'X-YouTube-Client-Name': '3',
  'X-YouTube-Client-Version': '19.29.35',
  'Content-Type': 'application/json',
};

const WEB_CLIENT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'X-YouTube-Client-Name': '1',
  'X-YouTube-Client-Version': '2.20240313.01.00',
  'Content-Type': 'application/json',
};

/**
 * Secure InnerTube Proxy Utility
 * Fetches streamingData.adaptiveFormats via InnerTube API, bypassing restricted browser embeds
 * and returning direct CDN URLs to the frontend.
 */
export async function fetchInnerTubeStreamingData(videoId: string): Promise<InnerTubeStreamData | null> {
  const clients = [
    {
      context: { client: { clientName: 'ANDROID', clientVersion: '19.29.35', hl: 'en', gl: 'US' } },
      headers: ANDROID_CLIENT_HEADERS,
    },
    {
      context: { client: { clientName: 'WEB', clientVersion: '2.20240313.01.00', hl: 'en', gl: 'US' } },
      headers: WEB_CLIENT_HEADERS,
    },
  ];

  for (const clientConfig of clients) {
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/player?prettyPrint=false`, {
        method: 'POST',
        headers: clientConfig.headers,
        body: JSON.stringify({
          context: clientConfig.context,
          videoId: videoId,
          playbackContext: {
            contentPlaybackContext: {
              html5Preference: 'HTML5_PREF_WANTS',
              lactMilliseconds: '1500',
            },
          },
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) continue;
      const data: any = await res.json();

      if (data && data.streamingData) {
        return data.streamingData as InnerTubeStreamData;
      }
    } catch {
      // Try next client config
    }
  }

  return null;
}

/**
 * Resolves direct raw audio and video CDN streaming URLs for a YouTube video ID
 */
export async function resolveDirectCdnStreams(videoId: string): Promise<StreamResolutionResult> {
  const streamingData = await fetchInnerTubeStreamingData(videoId);

  let audioUrl: string | null = null;
  let videoUrl: string | null = null;

  const formats = [...(streamingData?.adaptiveFormats || []), ...(streamingData?.formats || [])];

  if (formats.length > 0) {
    // Find best audio format (.m4a, .webm, audio/mp4, audio/webm)
    const audioFormat = formats.find(
      (f) => f.url && (f.mimeType?.includes('audio') || f.mimeType?.includes('mp4') || f.mimeType?.includes('webm')) && !f.mimeType?.includes('video')
    ) || formats.find((f) => f.url && f.mimeType?.includes('audio'));

    if (audioFormat?.url) {
      audioUrl = audioFormat.url;
    }

    // Find best video format (muxed or adaptive video/mp4)
    const videoFormat = formats.find(
      (f) => f.url && f.mimeType?.includes('video/mp4') && f.width && f.width >= 720
    ) || formats.find((f) => f.url && f.mimeType?.includes('video')) || formats[0];

    if (videoFormat?.url) {
      videoUrl = videoFormat.url;
    }
  }

  // Fallback to Invidious / Piped CDN if InnerTube didn't return direct URLs
  if (!audioUrl || !videoUrl) {
    audioUrl = audioUrl || `https://yewtu.be/latest_version?id=${videoId}&itag=140`;
    videoUrl = videoUrl || `https://yewtu.be/latest_version?id=${videoId}&itag=22`;
  }

  return {
    audioUrl,
    videoUrl,
  };
}
