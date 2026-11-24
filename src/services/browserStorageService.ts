import { enforceSafeSearchOffUrl } from '../utils/safeSearchOff';

export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'brave' | 'startpage' | 'wikipedia';

export interface SearchEngineConfig {
  id: SearchEngineId;
  name: string;
  shortName: string;
  searchUrl: (query: string) => string;
  homeUrl: string;
}

export const SEARCH_ENGINES: SearchEngineConfig[] = [
  {
    id: 'google',
    name: 'Google',
    shortName: 'G',
    searchUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&safe=off&hl=en&gl=us`,
    homeUrl: 'https://www.google.com/?safe=off&hl=en&gl=us',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    shortName: 'D',
    searchUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}&kp=-2&kl=us-en`,
    homeUrl: 'https://duckduckgo.com/?kp=-2&kl=us-en',
  },
  {
    id: 'bing',
    name: 'Bing',
    shortName: 'B',
    searchUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&adlt=off&setlang=en-US&cc=US`,
    homeUrl: 'https://www.bing.com/?adlt=off&setlang=en-US&cc=US',
  },
  {
    id: 'brave',
    name: 'Brave Search',
    shortName: 'Br',
    searchUrl: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}&safesearch=off`,
    homeUrl: 'https://search.brave.com/?safesearch=off',
  },
  {
    id: 'startpage',
    name: 'Startpage',
    shortName: 'S',
    searchUrl: (q) => `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}&ff=0`,
    homeUrl: 'https://www.startpage.com',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    shortName: 'W',
    searchUrl: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(q)}`,
    homeUrl: 'https://en.wikipedia.org',
  },
];

export interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
  folder: string;
  createdAt: number;
}

export interface BrowserHistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

const BOOKMARKS_KEY = 'frosthub_browser_bookmarks_v1';
const BOOKMARKS_UPDATED_KEY = 'frosthub_browser_bookmarks_updated_v1';
const HISTORY_KEY = 'frosthub_browser_history_v1';
const ENGINE_KEY = 'frosthub_browser_engine_v1';
const BOOKMARKS_BAR_KEY = 'frosthub_browser_bar_v1';
const USER_ID_KEY = 'frosthub_chat_user_id';

export const DEFAULT_BOOKMARKS: BrowserBookmark[] = [
  { id: 'bm_google', title: 'Google', url: 'https://www.google.com', folder: 'Bookmarks Bar', createdAt: 1 },
  { id: 'bm_yt', title: 'YouTube', url: 'https://www.youtube.com', folder: 'Bookmarks Bar', createdAt: 2 },
  { id: 'bm_tiktok', title: 'TikTok', url: 'https://www.tiktok.com', folder: 'Bookmarks Bar', createdAt: 3 },
  { id: 'bm_twitch', title: 'Twitch', url: 'https://www.twitch.tv', folder: 'Bookmarks Bar', createdAt: 4 },
  { id: 'bm_ddg', title: 'DuckDuckGo', url: 'https://duckduckgo.com', folder: 'Bookmarks Bar', createdAt: 5 },
  { id: 'bm_wiki', title: 'Wikipedia', url: 'https://en.wikipedia.org', folder: 'Bookmarks Bar', createdAt: 6 },
  { id: 'bm_discord', title: 'Discord', url: 'https://discord.com/app', folder: 'Bookmarks Bar', createdAt: 7 },
  { id: 'bm_github', title: 'GitHub', url: 'https://github.com', folder: 'Bookmarks Bar', createdAt: 8 },
];

function getBrowserUserId(): string {
  try {
    return localStorage.getItem(USER_ID_KEY) || 'default';
  } catch {
    return 'default';
  }
}

export function getSavedSearchEngine(): SearchEngineId {
  try {
    const raw = localStorage.getItem(ENGINE_KEY) as SearchEngineId | null;
    if (raw && SEARCH_ENGINES.some((e) => e.id === raw)) {
      return raw;
    }
  } catch {}
  return 'duckduckgo';
}

export function saveSearchEngine(engine: SearchEngineId): void {
  try {
    localStorage.setItem(ENGINE_KEY, engine);
  } catch {}
}

export function getBookmarksBarVisible(): boolean {
  try {
    const raw = localStorage.getItem(BOOKMARKS_BAR_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function saveBookmarksBarVisible(visible: boolean): void {
  try {
    localStorage.setItem(BOOKMARKS_BAR_KEY, String(visible));
  } catch {}
}

export function loadBookmarks(): BrowserBookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_BOOKMARKS;
}

export function saveBookmarks(bookmarks: BrowserBookmark[]): void {
  const updatedAt = Date.now();
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    localStorage.setItem(BOOKMARKS_UPDATED_KEY, String(updatedAt));
  } catch {}

  const userId = getBrowserUserId();
  fetch('/api/browser-bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, bookmarks, updatedAt }),
  }).catch(() => {});
}

export async function syncRemoteBookmarks(): Promise<BrowserBookmark[] | null> {
  try {
    const userId = getBrowserUserId();
    const res = await fetch(`/api/browser-bookmarks?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const remoteList = Array.isArray(data?.bookmarks) ? data.bookmarks : [];
    const remoteUpdated = Number(data?.updatedAt) || 0;
    const localUpdated = Number(localStorage.getItem(BOOKMARKS_UPDATED_KEY) || 0);

    if (remoteList.length > 0 && remoteUpdated > localUpdated) {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(remoteList));
      localStorage.setItem(BOOKMARKS_UPDATED_KEY, String(remoteUpdated));
      return remoteList;
    }
  } catch {}
  return null;
}

export function loadBrowserHistory(): BrowserHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveBrowserHistory(history: BrowserHistoryItem[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 200)));
  } catch {}
}

export function resolveOmniboxInput(rawInput: string, engineId: SearchEngineId): string {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed === 'about:newtab') {
    return 'about:newtab';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return enforceSafeSearchOffUrl(new URL(trimmed)).href;
    } catch {
      return trimmed;
    }
  }
  // Treat domain-like inputs without spaces as URLs (e.g., "discord.com", "en.wikipedia.org/wiki/Cat")
  const hasSpaces = /\s/.test(trimmed);
  const looksLikeDomain = /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed) || /^localhost(:\d+)?(\/.*)?$/i.test(trimmed);
  if (!hasSpaces && looksLikeDomain) {
    try {
      return enforceSafeSearchOffUrl(new URL(`https://${trimmed}`)).href;
    } catch {
      return `https://${trimmed}`;
    }
  }

  const engine = SEARCH_ENGINES.find((e) => e.id === engineId) || SEARCH_ENGINES[0];
  return engine.searchUrl(trimmed);
}

export function getDisplayTitleFromUrl(url: string): string {
  if (!url || url === 'about:newtab') return 'New Tab';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

export type ClientDeviceProfile = 'desktop';
const CLIENT_PROFILE_KEY = 'frosthub_client_profile_v1';

export function getClientDeviceProfile(): ClientDeviceProfile {
  try {
    const raw = localStorage.getItem(CLIENT_PROFILE_KEY);
    if (raw && raw !== 'desktop') {
      localStorage.removeItem(CLIENT_PROFILE_KEY);
    }
  } catch {}
  return 'desktop';
}

export function setClientDeviceProfile(_profile: ClientDeviceProfile): void {
  try {
    localStorage.setItem(CLIENT_PROFILE_KEY, 'desktop');
  } catch {}
}

export function getFaviconForUrl(url: string): string {
  if (!url || url === 'about:newtab') return '';
  try {
    const parsed = new URL(url);
    return `/api/proxy-image?url=${encodeURIComponent(`https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`)}`;
  } catch {
    return '';
  }
}
