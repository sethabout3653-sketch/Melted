import {
  extractVideoId,
  getInvidiousConfig,
  type MusicTrack,
} from './invidiousService';

interface InvidiousVideo extends Record<string, any> {
  videoId?: string;
  title?: string;
  author?: string;
  description?: string;
  lengthSeconds?: number;
  viewCount?: number;
  videoThumbnails?: Array<{ url: string }>;
  recommendedVideos?: InvidiousVideo[];
}

async function requestVideos(path: string): Promise<InvidiousVideo[]> {
  const { instanceUrl } = getInvidiousConfig();
  const response = await fetch(`${instanceUrl}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Melted/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Video provider request failed (${response.status})`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Video provider returned an unexpected response');
  return data as InvidiousVideo[];
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatViews(views: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(views) + ' views';
}

function toVideo(item: InvidiousVideo): MusicTrack & { viewCount: number } {
  const videoId = String(item.videoId || '');
  return {
    videoId,
    title: String(item.title || 'Untitled video'),
    author: String(item.author || 'Unknown creator'),
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
    thumbnail: String(item.videoThumbnails?.[0]?.url || ''),
    duration: Number(item.lengthSeconds || 0),
    viewCount: Number(item.viewCount || 0),
  };
}

export async function getTrendingVideos() {
  return (await requestVideos('/api/v1/trending?region=US')).slice(0, 24).map(toVideo);
}

export async function searchVideos(query: string) {
  const results = await requestVideos(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
  return results.filter((item) => item.videoId).slice(0, 24).map(toVideo);
}

export async function extractVideoDetails(value: string) {
  const videoId = extractVideoId(value);
  if (!videoId) throw new Error('Could not find a valid YouTube video ID');
  const { instanceUrl } = getInvidiousConfig();
  const response = await fetch(`${instanceUrl}/api/v1/videos/${videoId}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Melted/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Video provider request failed (${response.status})`);
  const video = await response.json() as InvidiousVideo;
  const seconds = Number(video.lengthSeconds || 0);
  const views = Number(video.viewCount || 0);
  const formats = Array.isArray(video.adaptiveFormats)
    ? video.adaptiveFormats.filter((format: any) => format.url).map((format: any) => ({
      itag: format.itag,
      quality: format.qualityLabel || format.audioQuality || 'audio',
      mimeType: format.type,
      url: format.url,
    }))
    : [];
  const recommendedVideos = (video.recommendedVideos || []).slice(0, 12).map(toVideo);

  return {
    videoId,
    title: String(video.title || 'Untitled video'),
    description: String(video.description || ''),
    author: String(video.author || 'Unknown creator'),
    lengthSeconds: seconds,
    durationFormatted: formatDuration(seconds),
    viewCount: views,
    viewCountFormatted: formatViews(views),
    thumbnail: String(video.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
    formats,
    recommendedVideos,
    formatsFoundNotice: formats.length ? 'Available formats loaded' : 'No direct formats were returned',
  };
}
