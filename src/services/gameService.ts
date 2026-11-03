import rawGamesData from '../data/gnMathGames.json';
import rawUgsData from '../data/ugsGames.json';
import rawCkvData from '../data/ckvGames.json';
import { RawGame, GameItem, GameCategory } from '../types/game';

import fileMapData from '../data/gnMathFileMap.json';

const fileMap = fileMapData as Record<string, string>;

export const UGS_INDEX_URL = 'https://raw.githack.com/gmshelf/ugs/main/ugs.json';
export const UGS_BASE_URL = 'https://raw.githack.com/gmshelf/ugs/main';

// ============================================================================
// 1. GAME COVERS RESOLUTION SYSTEM (IMAGES ONLY)
// ============================================================================
export const COVER_BASE = '/api/cover';
export const COVER_PRIMARY_BASE = '/api/cover';
export const FALLBACK_COVER_BASE = 'https://raw.githubusercontent.com/gn-math/covers/main';
export const COVER_PROXY_BASE = '/api/cover';

export function resolveCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  if (rawCover.startsWith('http://') || rawCover.startsWith('https://')) {
    if (rawCover.includes('covers@main') || rawCover.includes('/covers/')) {
      const filename = rawCover.split('/').pop() || '';
      return `${COVER_PRIMARY_BASE}/${filename}`;
    }
    return rawCover;
  }
  const clean = rawCover.replace('{COVER_URL}/', '').replace('{COVER_URL}', '').trim();
  return `${COVER_PRIMARY_BASE}/${clean}`;
}

export function getDirectCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  if (rawCover.startsWith('http://') || rawCover.startsWith('https://')) {
    const filename = rawCover.split('/').pop() || '';
    return `${FALLBACK_COVER_BASE}/${filename}`;
  }
  const clean = rawCover.replace('{COVER_URL}/', '').replace('{COVER_URL}', '').trim();
  return `${FALLBACK_COVER_BASE}/${clean}`;
}

export function getProxyCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  const clean = rawCover.replace('{COVER_URL}/', '').replace('{COVER_URL}', '').trim();
  const filename = clean.startsWith('http') ? clean.split('/').pop() || '' : clean;
  return `${COVER_PROXY_BASE}/${filename}`;
}

// ============================================================================
// 2. GAME PLAYABLE URL RESOLUTION SYSTEM (HTML & IFRAME GAME STREAMS ONLY)
// ============================================================================
export const RAWGITHACK_BASE = 'https://raw.githack.com/gn-math/html/main';
export const GAME_PROXY_BASE = '/api/raw';

/**
 * Resolves the canonical streaming URL for a game payload.
 * Strictly decoupled from image covers.
 */
export function resolveGameUrl(rawUrl: string, gameId?: number): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const clean = rawUrl.replace('{HTML_URL}/', '').replace('{HTML_URL}', '').trim();
  const numPrefix = clean.match(/^\d+/)?.[0];

  // 5-step fallback hierarchy against gnMathFileMap
  const mapped =
    fileMap[clean] ||
    fileMap[clean.replace(/\.html$/, '')] ||
    (gameId !== undefined && gameId !== null ? fileMap[String(gameId)] : null) ||
    (numPrefix ? fileMap[numPrefix] : null);

  const targetFile = mapped || (clean.includes('.') ? clean : `${clean}.html`);
  return `${RAWGITHACK_BASE}/${targetFile}`;
}

/**
 * Provides a local backend streaming proxy URL for the game payload,
 * ensuring seamless gameplay even if upstream CDN or school firewalls block rawgithack.
 */
export function getProxyGameUrl(rawUrl: string, gameId?: number): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const clean = rawUrl.replace('{HTML_URL}/', '').replace('{HTML_URL}', '').trim();
  const numPrefix = clean.match(/^\d+/)?.[0];

  const mapped =
    fileMap[clean] ||
    fileMap[clean.replace(/\.html$/, '')] ||
    (gameId !== undefined && gameId !== null ? fileMap[String(gameId)] : null) ||
    (numPrefix ? fileMap[numPrefix] : null);

  const targetFile = mapped || (clean.includes('.') ? clean : `${clean}.html`);
  return `${GAME_PROXY_BASE}/${targetFile}`;
}

export function getDirectRawGitHackUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  return rawUrl.replace('{HTML_URL}', RAWGITHACK_BASE);
}

const FEATURED_NAMES = new Set([
  'Drive Mad',
  'OvO',
  'OvO 2',
  'Bowmasters',
  "Five Nights at Freddy's",
  'Friday Night Funkin',
  'Jetpack Joyride',
  'Gladihoppers',
  'Retro Bowl',
  'Slope',
  '1v1.lol',
  'Subway Surfers',
  'Cookie Clicker',
  'Moto X3M',
  'Crossy Road',
  'Bitlife',
  'Superhot',
  'Basketball Stars',
  'Bad Time Simulator (Sans Fight)',
  'Smash Karts',
  'Duck Life 4',
  'Undertale',
  'Vex 7',
  'Geometry Dash',
  'FNAF 2',
]);

export function detectCategory(game: RawGame): GameCategory {
  const name = game.name.toLowerCase();
  const special = (game.special || []).map((s) => s.toLowerCase());

  if (
    special.some((s) =>
      ['n64', 'gba', 'nds', 'nes', 'psx', 'dos', 'emulator', 'port'].includes(s)
    )
  ) {
    return 'Emulators & Ports';
  }

  if (
    name.includes('freddy') ||
    name.includes('fnaf') ||
    name.includes('granny') ||
    name.includes('horror') ||
    name.includes('slender') ||
    name.includes('bendy') ||
    name.includes('neighbor') ||
    name.includes('backrooms') ||
    name.includes('baldi') ||
    name.includes('zombie')
  ) {
    return 'Horror & Mystery';
  }

  if (
    name.includes('drive') ||
    name.includes('moto') ||
    name.includes('car') ||
    name.includes('racer') ||
    name.includes('racing') ||
    name.includes('drift') ||
    name.includes('kart') ||
    name.includes('truck') ||
    name.includes('bike') ||
    name.includes('speed')
  ) {
    return 'Driving & Racing';
  }

  if (
    name.includes('1v1') ||
    name.includes('gun') ||
    name.includes('shoot') ||
    name.includes('doom') ||
    name.includes('quake') ||
    name.includes('bowmaster') ||
    name.includes('combat') ||
    name.includes('strike') ||
    name.includes('tank') ||
    name.includes('war') ||
    name.includes('sniper') ||
    name.includes('gladihopper') ||
    name.includes('smash') ||
    name.includes('bullet')
  ) {
    return 'Action & Shooters';
  }

  if (
    name.includes('bowl') ||
    name.includes('basketball') ||
    name.includes('soccer') ||
    name.includes('football') ||
    name.includes('tennis') ||
    name.includes('golf') ||
    name.includes('hockey') ||
    name.includes('physics') ||
    name.includes('pool') ||
    name.includes('baseball')
  ) {
    return 'Sports & Physics';
  }

  if (
    name.includes('ovo') ||
    name.includes('slope') ||
    name.includes('run ') ||
    name.includes('run 2') ||
    name.includes('run 3') ||
    name.includes('vex') ||
    name.includes('jump') ||
    name.includes('fall') ||
    name.includes('geometry') ||
    name.includes('parkour') ||
    name.includes('flappy') ||
    name.includes('tower') ||
    name.includes('subway') ||
    name.includes('climb')
  ) {
    return 'Skill & Platformer';
  }

  if (
    name.includes('pac') ||
    name.includes('mario') ||
    name.includes('sonic') ||
    name.includes('tetris') ||
    name.includes('arcade') ||
    name.includes('retro') ||
    name.includes('galaga') ||
    name.includes('asteroids') ||
    name.includes('pinball') ||
    name.includes('snake') ||
    name.includes('pong') ||
    name.includes('space') ||
    special.includes('flash')
  ) {
    return 'Retro & Arcade';
  }

  if (
    name.includes('clicker') ||
    name.includes('2048') ||
    name.includes('chess') ||
    name.includes('sudoku') ||
    name.includes('candy') ||
    name.includes('cut the rope') ||
    name.includes('block') ||
    name.includes('word') ||
    name.includes('puzzle') ||
    name.includes('crossword') ||
    name.includes('match')
  ) {
    return 'Puzzle & Casual';
  }

  return 'Action & Shooters';
}

export function convertToGitHack(url: string): string {
  if (!url) return '';
  if (url.includes('jsdelivr.net')) {
    return url
      .replace('https://cdn.jsdelivr.net/gh/', 'https://raw.githack.com/')
      .replace('https://cdn.jsdelivr.net', 'https://raw.githack.com')
      .replace('https://jsdelivr.net', 'https://raw.githack.com')
      .replace('@main/', '/main/');
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${UGS_BASE_URL}${cleanPath}`;
}

export function resolveUgsUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/ckv/')) {
    return `https://wanocapy.github.io/ChickenKingsVault/${url.replace('/ckv/', '')}`;
  }
  return convertToGitHack(url);
}

export function generateGameSvgCover(title: string, category: string): string {
  const palettes = [
    ['#2563eb', '#1d4ed8'],
    ['#7c3aed', '#5b21b6'],
    ['#db2777', '#9d174d'],
    ['#059669', '#065f46'],
    ['#d97706', '#92400e'],
    ['#0891b2', '#155e75'],
    ['#dc2626', '#991b1b'],
    ['#4f46e5', '#3730a3'],
  ];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const [c1, c2] = palettes[Math.abs(hash) % palettes.length];
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeCat = (category || 'ARCADE').toUpperCase().replace(/&/g, '&amp;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
      <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.25" />
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#g)" />
    <rect width="400" height="300" fill="url(#overlay)" />
    <circle cx="340" cy="50" r="100" fill="#ffffff" fill-opacity="0.08" />
    <circle cx="60" cy="250" r="80" fill="#000000" fill-opacity="0.15" />
    <text x="28" y="44" fill="#ffffff" fill-opacity="0.8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="11" letter-spacing="2">${safeCat}</text>
    <text x="28" y="145" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="26" letter-spacing="-0.5">
      ${safeTitle.length > 22 ? safeTitle.slice(0, 20) + '...' : safeTitle}
    </text>
    <rect x="28" y="235" width="80" height="28" rx="14" fill="#ffffff" fill-opacity="0.25" />
    <text x="68" y="253" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="11" letter-spacing="1">PLAY</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function transformUgsEntry(
  entry: { name: string; url: string; img?: string },
  index: number,
  existingNames: Set<string>,
  coverLookupByName: Map<string, string>
): GameItem | null {
  if (!entry || !entry.name || !entry.url) return null;
  const trimmedName = entry.name.trim();
  if (!trimmedName || trimmedName.includes('.gg/')) return null;

  const normalized = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (existingNames.has(normalized)) return null;

  existingNames.add(normalized);

  const id = 10000 + index;
  const category = detectCategory({ name: trimmedName, special: [] } as any);
  const isCkv = entry.url.startsWith('/ckv/');
  const resolvedUrl = resolveUgsUrl(entry.url);
  const proxyUrl = isCkv 
    ? `/api/ckv/${entry.url.replace(/^\/ckv\//, '')}`
    : `/api/ugs/${entry.url.replace(/^\//, '')}`;

  let resolvedCover = '';
  if (coverLookupByName.has(normalized)) {
    resolvedCover = coverLookupByName.get(normalized)!;
  } else if (entry.img && !entry.img.includes('placeholder.png') && (entry.img.startsWith('http://') || entry.img.startsWith('https://'))) {
    resolvedCover = entry.img;
  } else if (entry.img && entry.img.startsWith('/ckv/')) {
    resolvedCover = `https://wanocapy.github.io/ChickenKingsVault/${entry.img.replace('/ckv/', '')}`;
  } else {
    resolvedCover = generateGameSvgCover(trimmedName, category);
  }

  return {
    id,
    name: trimmedName,
    cover: resolvedCover,
    url: entry.url,
    category,
    resolvedCover,
    fallbackCover: resolvedCover,
    localCover: resolvedCover,
    resolvedUrl,
    proxyUrl,
    featured: false,
    source: (isCkv ? 'CKV' : 'ugs'),
  };
}

/**
 * Fetches the game list directly from raw.githack.com UGS index,
 * with fallback to jsDelivr and local bundled mirror.
 */
export async function getUGSGames(): Promise<Array<{ name: string; url: string; img?: string }>> {
  try {
    const res = await fetch(UGS_INDEX_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return rawUgsData as Array<{ name: string; url: string; img?: string }>;
  } catch (err) {
    try {
      const fallbackRes = await fetch('https://cdn.jsdelivr.net/gh/gmshelf/ugs@main/ugs.json');
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        if (Array.isArray(fallbackData) && fallbackData.length > 0) {
          return fallbackData;
        }
      }
    } catch {}
    return rawUgsData as Array<{ name: string; url: string; img?: string }>;
  }
}

/**
 * Fetches latest games dynamically from ChickenKingsVault games.js
 */
export async function getCKVGames(): Promise<Array<{ name: string; url: string; img?: string }>> {
  try {
    const res = await fetch('https://raw.githubusercontent.com/WanoCapy/ChickenKingsVault/main/games.js');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const matches = [...text.matchAll(/<a class="game-link" href="([^"]+)">\s*<img src="([^"]+)"[^>]*>\s*<div>([^<]+)<\/div>/g)];
    if (matches.length > 0) {
      return matches.map((m) => ({
        name: m[3].trim(),
        url: `/ckv/${m[1].trim().replace(/^\//, '')}`,
        img: `https://wanocapy.github.io/ChickenKingsVault/${m[2].trim().replace(/^\//, '')}`,
      }));
    }
    return rawCkvData as Array<{ name: string; url: string; img?: string }>;
  } catch {
    return rawCkvData as Array<{ name: string; url: string; img?: string }>;
  }
}

export function mergeUgsGames(
  baseGames: GameItem[],
  dynamicList: Array<{ name: string; url: string; img?: string }>
): GameItem[] {
  const existingNames = new Set<string>();
  const coverLookupByName = new Map<string, string>();

  for (const g of baseGames) {
    const norm = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    existingNames.add(norm);
    if (g.resolvedCover && !g.resolvedCover.startsWith('data:image/svg+xml')) {
      coverLookupByName.set(norm, g.resolvedCover);
    }
  }

  const newGames: GameItem[] = [];
  for (let i = 0; i < dynamicList.length; i++) {
    const transformed = transformUgsEntry(dynamicList[i], i, existingNames, coverLookupByName);
    if (transformed) {
      newGames.push(transformed);
    }
  }

  if (newGames.length === 0) return baseGames;
  return [...baseGames, ...newGames];
}

export function getAllGames(): GameItem[] {
  // 1. ALL EXISTING GN-MATH GAMES PRESERVED EXACTLY AS-IS (ZERO TOUCHED)
  const validGames = (rawGamesData as RawGame[]).filter(
    (g) => g.id >= 0 && g.name && !g.name.includes('.gg/')
  );

  const gnGames: GameItem[] = validGames.map((game) => {
    const isFeatured = FEATURED_NAMES.has(game.name) || Boolean(game.featured);
    const category = detectCategory(game);
    const resolvedCover = resolveCoverUrl(game.cover);
    const fallbackCover = getDirectCoverUrl(game.cover);
    const localCover = getProxyCoverUrl(game.cover);
    const resolvedUrl = resolveGameUrl(game.url, game.id);
    const proxyUrl = getProxyGameUrl(game.url, game.id);

    return {
      ...game,
      featured: isFeatured,
      category,
      resolvedCover,
      fallbackCover,
      localCover,
      resolvedUrl,
      proxyUrl,
    };
  });

  // 2. Track existing names and high-quality covers to avoid duplicate entries
  const existingNames = new Set<string>();
  const coverLookupByName = new Map<string, string>();
  for (const g of gnGames) {
    const norm = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    existingNames.add(norm);
    if (g.resolvedCover) {
      coverLookupByName.set(norm, g.resolvedCover);
    }
  }

  // 3. Append UGS games from the bundled mirror repository
  const ugsGames: GameItem[] = [];
  const ugsList = rawUgsData as Array<{ name: string; url: string; img?: string }>;
  for (let i = 0; i < ugsList.length; i++) {
    const transformed = transformUgsEntry(ugsList[i], i, existingNames, coverLookupByName);
    if (transformed) {
      ugsGames.push(transformed);
    }
  }

  // 4. Append CKV games from ChickenKingsVault (all of them, deduplicated)
  const ckvGames: GameItem[] = [];
  const ckvList = rawCkvData as Array<{ name: string; url: string; img?: string }>;
  for (let i = 0; i < ckvList.length; i++) {
    const transformed = transformUgsEntry(ckvList[i], i + 20000, existingNames, coverLookupByName);
    if (transformed) {
      ckvGames.push(transformed);
    }
  }

  return [...gnGames, ...ugsGames, ...ckvGames];
}

export async function fetchGames(): Promise<GameItem[]> {
  return getAllGames();
}

const FAVORITES_KEY = 'melted_favorite_ids';
const RECENT_KEY = 'melted_recent_ids';

export function getFavorites(): number[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(id: number): boolean {
  try {
    const current = getFavorites();
    const index = current.indexOf(id);
    let updated: number[];
    let added = false;
    if (index >= 0) {
      updated = current.filter((x) => x !== id);
    } else {
      updated = [id, ...current];
      added = true;
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return added;
  } catch {
    return false;
  }
}

export function getRecentPlayed(): number[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function recordRecentPlay(id: number): void {
  try {
    const current = getRecentPlayed().filter((x) => x !== id);
    const updated = [id, ...current].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}
