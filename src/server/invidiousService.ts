import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtractedTrack {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  url: string;
  coverUrl: string;
  genre: string;
  vibe: string;
  isCustom?: boolean;
  source: 'youtube' | 'invidious';
}

export interface InvidiousConfig {
  instanceUrl: string;
  fallbackInstances: string[];
}

let invidiousConfig: InvidiousConfig = {
  instanceUrl: 'https://inv.nadeko.net',
  fallbackInstances: [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yt.chocolatemoo53.com',
    'https://invidious.tiekoetter.com',
    'https://invidious.f5.si',
  ],
};

export function getInvidiousConfig(): InvidiousConfig {
  return { ...invidiousConfig };
}

export function updateInvidiousConfig(newConfig: Partial<InvidiousConfig>): InvidiousConfig {
  invidiousConfig = { ...invidiousConfig, ...newConfig };
  return { ...invidiousConfig };
}

const INVIDIOUS_POOL = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://invidious.tiekoetter.com',
  'https://invidious.f5.si',
];

/**
 * Extract YouTube 11-char video ID from any YouTube/YouTube Music URL or direct ID
 */
export function extractVideoId(inputUrl: string): string | null {
  const trimmed = inputUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'youtu.be' || parsed.hostname.endsWith('.youtu.be')) {
      const id = parsed.pathname.slice(1).split('/')[0];
      if (id && id.length === 11) return id;
    }

    const vParam = parsed.searchParams.get('v');
    if (vParam && vParam.length === 11) {
      return vParam;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const prefixes = ['embed', 'v', 'shorts', 'live'];
    for (const prefix of prefixes) {
      const idx = pathParts.indexOf(prefix);
      if (idx !== -1 && pathParts[idx + 1] && pathParts[idx + 1].length === 11) {
        return pathParts[idx + 1];
      }
    }
  } catch {
    const match = trimmed.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
    );
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parse duration string (e.g. "3:45", "1:02:15") into seconds
 */
function parseDurationText(text: string): number {
  if (!text) return 210;
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 210;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 210;
}


/**
 * Secondary API: Invidious Instances Search Pool
 */
async function searchInvidiousPool(query: string): Promise<ExtractedTrack[]> {
  for (const instance of INVIDIOUS_POOL) {
    try {
      const endpoint = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      const tracks: ExtractedTrack[] = data
        .filter((item: any) => item.videoId && item.title)
        .slice(0, 24)
        .map((item: any) => {
          let coverUrl = `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`;
          if (Array.isArray(item.videoThumbnails) && item.videoThumbnails.length > 0) {
            const best = item.videoThumbnails[item.videoThumbnails.length - 1]?.url;
            if (best) coverUrl = best.startsWith('//') ? `https:${best}` : best;
          }

          return {
            id: `invidious_${item.videoId}`,
            videoId: item.videoId,
            title: item.title,
            artist: item.author || 'YouTube Artist',
            album: 'YouTube Music',
            duration: Number(item.lengthSeconds) || 200,
            url: `https://www.youtube.com/watch?v=${item.videoId}`,
            coverUrl,
            genre: 'Music',
            vibe: 'invidious stream',
            source: 'invidious',
          };
        });

      if (tracks.length > 0) {
        return tracks;
      }
    } catch {
      // Try next instance in pool
    }
  }

  return [];
}

/**
 * Tertiary API: YouTube oEmbed for fast metadata resolution
 */
async function fetchOEmbedMetadata(videoId: string): Promise<{ title: string; author: string; thumbnail: string }> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || 'YouTube Track',
        author: data.author_name || 'YouTube Artist',
        thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  } catch {
    // Continue
  }

  return {
    title: `YouTube Track (${videoId})`,
    author: 'YouTube Artist',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/**
 * Extract track metadata: tries Invidious first, and if Invidious doesn't know it,
 * automatically extracts the music via YouTube oEmbed, direct search, and YouTube scraping!
 */
export async function extractAudioWithInvidious(input: string): Promise<ExtractedTrack> {
  const trimmed = input.trim();
  let videoId = extractVideoId(trimmed);

  // If input is not a direct URL/ID, treat it as a search query to extract the exact music!
  if (!videoId) {
    const searchMatches = await searchYouTubeMusic(trimmed);
    if (searchMatches.length > 0) {
      return searchMatches[0];
    }
    throw new Error('could not find that music, try another title or link');
  }

  // 1. First attempt: Invidious video info if available
  let videoData: any = null;
  for (const instance of INVIDIOUS_POOL) {
    try {
      const endpoint = `${instance}/api/v1/videos/${videoId}`;
      const res = await fetch(endpoint, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && (json.title || json.author)) {
          videoData = json;
          break;
        }
      }
    } catch {
      // Continue to next or fallback
    }
  }

  // 2. Fallback if Invidious doesn't know the music: Extract via YouTube oEmbed & direct metadata!
  const oembed = await fetchOEmbedMetadata(videoId);

  let title = videoData?.title || oembed.title || `Track (${videoId})`;
  let artist = videoData?.author || oembed.author || 'YouTube Artist';
  let duration = Number(videoData?.lengthSeconds) || 210;

  // Clean title & artist if title is "Artist - Song Title"
  if (title.includes(' - ') && (!artist || artist === 'YouTube Artist' || artist.endsWith('VEVO') || artist.includes('Topic'))) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  }

  // Remove standard YouTube fluff like "(Official Audio)", "[Official Video]", etc.
  title = title
    .replace(/\s*[\(\[](?:Official\s*(?:Music\s*)?(?:Video|Audio)|Lyric\s*Video|Audio|HD|4K|Visualizer)[\)\]]/gi, '')
    .trim();

  let coverUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  if (videoData?.videoThumbnails?.length) {
    const bestThumb = videoData.videoThumbnails[videoData.videoThumbnails.length - 1]?.url;
    if (bestThumb) coverUrl = bestThumb.startsWith('//') ? `https:${bestThumb}` : bestThumb;
  } else if (oembed.thumbnail) {
    coverUrl = oembed.thumbnail;
  }

  return {
    id: `yt_${videoId}`,
    videoId,
    title,
    artist,
    album: 'YouTube Music',
    duration,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    coverUrl,
    genre: videoData?.genre || 'Music',
    vibe: 'extracted directly',
    isCustom: true,
    source: 'youtube',
  };
}

/**
 * Multi-API Automatic Search: tries all available APIs seamlessly
 */
export async function searchYouTubeMusic(query: string): Promise<ExtractedTrack[]> {
  const q = query.trim();
  if (!q) return [];

  // 1. Direct ID / link match attempt with Invidious extraction
  const directId = extractVideoId(q);
  if (directId) {
    try {
      const track = await extractAudioWithInvidious(directId);
      return [track];
    } catch {
      // Continue to search
    }
  }

  // 2. Search exclusively via Invidious API
  const invidiousResults = await searchInvidiousPool(q);
  if (invidiousResults.length > 0) {
    return invidiousResults;
  }

  return [];
}

/**
 * Automatic music discovery with rich rotation on initial load
 */
export async function getDiscoverYouTubeMusic(): Promise<ExtractedTrack[]> {
  const seeds = [
    'lofi hip hop radio beats to relax study',
    'synthwave chill retro beats',
    'chillhop music essentials',
    'ambient deep focus electronic',
    'late night gaming lofi chill',
  ];

  for (const seed of seeds) {
    const tracks = await searchYouTubeMusic(seed);
    if (tracks.length > 0) {
      return tracks;
    }
  }

  return [];
}

const FRIEND_VIBES = [
  'put some headphones on. found these tracks for you.',
  'late night beats for when you need to focus.',
  'take a breath and enjoy this rhythm.',
  'thought you might like this sound today.',
  'great tunes to keep you company while gaming.',
  'clean audio to relax your mind.',
  'here is something smooth to keep you locked in.',
  'press play whenever you need to zone in.',
];

export function getFriendVibeMessage(): string {
  return FRIEND_VIBES[Math.floor(Math.random() * FRIEND_VIBES.length)];
}
