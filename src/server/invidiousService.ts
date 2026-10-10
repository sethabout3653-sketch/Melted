export interface InvidiousConfig {
  instanceUrl: string;
}

export interface MusicTrack {
  videoId: string;
  title: string;
  author: string;
  url: string;
  thumbnail: string;
  duration: number;
}

const DEFAULT_INSTANCE = 'https://inv.nadeko.net';
let activeInstance = process.env.INVIDIOUS_INSTANCE_URL || DEFAULT_INSTANCE;

function normalizeInstance(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Invidious instance must use HTTP or HTTPS');
  }
  return url.origin;
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Melted/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Invidious request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function getInvidiousConfig(): InvidiousConfig {
  return { instanceUrl: activeInstance };
}

export function updateInvidiousConfig(input: unknown): InvidiousConfig {
  if (!input || typeof input !== 'object' || !('instanceUrl' in input)) {
    throw new Error('Provide an Invidious instance URL');
  }
  const instanceUrl = (input as { instanceUrl?: unknown }).instanceUrl;
  if (typeof instanceUrl !== 'string' || !instanceUrl.trim()) {
    throw new Error('Provide a valid Invidious instance URL');
  }
  activeInstance = normalizeInstance(instanceUrl);
  return getInvidiousConfig();
}

export function extractVideoId(value: string): string | null {
  const trimmed = value.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const id = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function toTrack(item: Record<string, any>): MusicTrack {
  const videoId = String(item.videoId || item.video_id || '');
  return {
    videoId,
    title: String(item.title || 'Untitled video'),
    author: String(item.author || item.authorId || 'Unknown artist'),
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
    thumbnail: String(item.videoThumbnails?.find((image: any) => image.quality === 'medium')?.url || item.videoThumbnails?.[0]?.url || ''),
    duration: Number(item.lengthSeconds || 0),
  };
}

export async function searchYouTubeMusic(query: string): Promise<MusicTrack[]> {
  const url = `${activeInstance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
  const results = await requestJson<Array<Record<string, any>>>(url);
  return results.filter((item) => item.type === 'video' || item.videoId).map(toTrack);
}

export async function getDiscoverYouTubeMusic(): Promise<MusicTrack[]> {
  const url = `${activeInstance}/api/v1/trending?region=US`;
  const results = await requestJson<Array<Record<string, any>>>(url);
  return results.filter((item) => item.type === 'video' || item.videoId).slice(0, 24).map(toTrack);
}

export function getFriendVibeMessage(): string {
  const messages = [
    'A little music can make the moment feel lighter.',
    'Take a breath, find a track, and make this your moment.',
    'Good sounds, good company. What are you in the mood for?',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export async function extractAudioWithInvidious(value: string): Promise<MusicTrack> {
  const videoId = extractVideoId(value);
  if (!videoId) throw new Error('Could not find a valid YouTube video ID');

  const video = await requestJson<Record<string, any>>(`${activeInstance}/api/v1/videos/${videoId}`);
  const audio = Array.isArray(video.adaptiveFormats)
    ? video.adaptiveFormats.find((format: any) => format.type?.startsWith('audio/') && format.url)
    : undefined;
  if (!audio?.url) throw new Error('No playable audio stream was returned by the Invidious instance');

  return {
    videoId,
    title: String(video.title || 'Untitled video'),
    author: String(video.author || 'Unknown artist'),
    url: String(audio.url),
    thumbnail: String(video.videoThumbnails?.[0]?.url || ''),
    duration: Number(video.lengthSeconds || 0),
  };
}
