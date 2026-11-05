export interface JellyfinConfig {
  serverUrl: string;
  apiKey: string;
}

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  IndexNumber?: number;
  ProviderIds?: Record<string, string>;
}

export interface JellyfinSeason extends JellyfinItem {
  IndexNumber: number;
}

export interface JellyfinEpisode extends JellyfinItem {
  IndexNumber?: number;
}

interface JellyfinItemsResponse {
  Items?: JellyfinItem[];
}

function endpoint(config: JellyfinConfig, path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${config.serverUrl.replace(/\/+$/, '')}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

async function jellyfinFetch<T>(config: JellyfinConfig, path: string, params: Record<string, string> = {}): Promise<T> {
  const response = await fetch(endpoint(config, path, params), {
    headers: {
      Accept: 'application/json',
      'X-Emby-Token': config.apiKey,
    },
    mode: 'cors',
  });
  if (!response.ok) {
    throw new Error(`Jellyfin returned ${response.status}. Check the server URL, API key, and CORS configuration.`);
  }
  return response.json() as Promise<T>;
}

function matchesTmdbId(item: JellyfinItem, tmdbId: number): boolean {
  const ids = item.ProviderIds || {};
  const matchedId = Object.entries(ids).find(([provider]) => provider.toLowerCase() === 'tmdb')?.[1];
  return matchedId === String(tmdbId);
}

export async function findJellyfinItemByTmdbId(
  config: JellyfinConfig,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  title: string,
): Promise<JellyfinItem | null> {
  const result = await jellyfinFetch<JellyfinItemsResponse>(config, '/Items', {
    Recursive: 'true',
    IncludeItemTypes: mediaType === 'movie' ? 'Movie' : 'Series',
    Fields: 'ProviderIds',
    SearchTerm: title,
    Limit: '100',
  });
  return result.Items?.find(item => matchesTmdbId(item, tmdbId)) || null;
}

export async function getJellyfinSeasons(config: JellyfinConfig, seriesId: string): Promise<JellyfinSeason[]> {
  const result = await jellyfinFetch<JellyfinItemsResponse>(config, `/Shows/${encodeURIComponent(seriesId)}/Seasons`, {
    Fields: 'ProviderIds,ChildCount',
  });
  return (result.Items || []) as JellyfinSeason[];
}

export async function getJellyfinEpisodes(config: JellyfinConfig, seriesId: string, season: number): Promise<JellyfinEpisode[]> {
  const result = await jellyfinFetch<JellyfinItemsResponse>(config, `/Shows/${encodeURIComponent(seriesId)}/Episodes`, {
    Season: String(season),
    Fields: 'ProviderIds,MediaSources',
  });
  return (result.Items || []) as JellyfinEpisode[];
}

export function getJellyfinStreamUrl(config: JellyfinConfig, itemId: string): string {
  const url = new URL(endpoint(config, `/Videos/${encodeURIComponent(itemId)}/stream`, { static: 'true' }));
  // Native <video> playback cannot attach the Jellyfin auth header, so Jellyfin's
  // supported stream-token query parameter is used for this user's own server.
  url.searchParams.set('api_key', config.apiKey);
  return url.toString();
}
