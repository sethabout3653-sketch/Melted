import rawGamesData from '../data/gnMathGames.json';
import rawUgsData from '../data/ugsGames.json';
import rawCkvData from '../data/ckvGames.json';
import { RawGame, GameItem, GameCategory } from '../types/game';
import { resolveGameRating } from './gameRatingService';

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
    featured: false,
    source: (isCkv ? 'CKV' : 'ugs'),
    rating: resolveGameRating(trimmedName),
  };
}

/**
 * Fetches the game list directly from raw.githack.com UGS index,
 * with fallback to jsDelivr and local bundled mirror.
 */
export async function getUGSGames(): Promise<Array<{ name: string; url: string; img?: string }>> {
  try {
    const res = await fetch(UGS_INDEX_URL, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return rawUgsData as Array<{ name: string; url: string; img?: string }>;
  } catch (err) {
    try {
      const fallbackRes = await fetch('https://cdn.jsdelivr.net/gh/gmshelf/ugs@main/ugs.json', { signal: AbortSignal.timeout(6000) });
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
    const res = await fetch('https://raw.githubusercontent.com/WanoCapy/ChickenKingsVault/main/games.js', { signal: AbortSignal.timeout(6000) });
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

export function getPlayableGameUrl(game: GameItem): string {
  if (!game) return '';
  // Native GN-Math games are fine and use standard resolution
  if (game.source === 'native') {
    return game.resolvedUrl || resolveGameUrl(game.url, game.id);
  }
  if (game.url && (game.url.startsWith('http://') || game.url.startsWith('https://'))) {
    return game.url;
  }
  const isStaticHost =
    typeof window !== 'undefined' &&
    (/\.(vercel\.app|pages\.dev|netlify\.app|github\.io)$/i.test(window.location.hostname) ||
      window.location.protocol === 'about:');
  if (game.source === 'ugs' || game.url.startsWith('/ugs/')) {
    if (isStaticHost) {
      return resolveUgsUrl(game.url);
    }
    const clean = game.url.replace(/^\/ugs\//, '').replace(/^\//, '');
    return `/api/ugs/${clean}`;
  }
  if (game.source === 'CKV' || game.url.startsWith('/ckv/')) {
    if (isStaticHost) {
      return resolveUgsUrl(game.url);
    }
    const clean = game.url.replace(/^\/ckv\//, '').replace(/^\//, '');
    return `/api/ckv/${clean}`;
  }
  return resolveGameUrl(game.url, game.id);
}

/**
 * GN-Math native games run directly by default ("except gn-math games they are fine").
 * External URLs (e.g. Undertale & Deltarune workers.dev), UGS, and CKV games run via Scramjet v2.
 */
export function shouldUseScramjetByDefault(game: GameItem): boolean {
  if (!game) return false;
  if (game.source === 'scramjet') return true;
  const name = (game.name || '').toLowerCase().trim();
  const scramjetAllowed = new Set([
    'undertale',
    'gemini',
    'soundboard 2',
    'soundboard 2 ',
    'soundboard',
    'deltarune',
    'duckduckgo',
  ]);
  return scramjetAllowed.has(name);
}

/**
 * Resolves the absolute upstream target URL required by Scramjet frame.go(url).
 */
export function getScramjetTargetUrl(game: GameItem): string {
  if (!game) return '';
  if (game.url && (game.url.startsWith('http://') || game.url.startsWith('https://'))) {
    return game.url;
  }
  if (game.source === 'CKV' || game.url.startsWith('/ckv/')) {
    const clean = game.url.replace(/^\/ckv\//, '').replace(/^\//, '');
    return `https://wanocapy.github.io/ChickenKingsVault/${clean}`;
  }
  if (game.source === 'ugs' || game.url.startsWith('/ugs/')) {
    return resolveUgsUrl(game.url);
  }
  return game.resolvedUrl || resolveGameUrl(game.url, game.id);
}

function generateSoundboardSvgCover(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <linearGradient id="sbBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="50%" stop-color="#1e1035" />
        <stop offset="100%" stop-color="#0b1120" />
      </linearGradient>
      <radialGradient id="sbGlow" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stop-color="#ec4899" stop-opacity="0.32" />
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="btnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ff4b4b" />
        <stop offset="100%" stop-color="#c81e1e" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect width="400" height="300" fill="url(#sbBg)" />
    <rect width="400" height="300" fill="url(#sbGlow)" />
    <!-- Audio Waveform decorative bars -->
    <g opacity="0.25">
      <rect x="52" y="90" width="8" height="36" rx="4" fill="#a855f7" />
      <rect x="68" y="74" width="8" height="68" rx="4" fill="#ec4899" />
      <rect x="84" y="82" width="8" height="52" rx="4" fill="#38bdf8" />
      <rect x="308" y="82" width="8" height="52" rx="4" fill="#38bdf8" />
      <rect x="324" y="74" width="8" height="68" rx="4" fill="#ec4899" />
      <rect x="340" y="90" width="8" height="36" rx="4" fill="#a855f7" />
    </g>
    <!-- Instant Button Base & Cap -->
    <ellipse cx="200" cy="128" rx="64" ry="34" fill="#334155" filter="url(#shadow)" />
    <ellipse cx="200" cy="122" rx="58" ry="30" fill="#475569" />
    <ellipse cx="200" cy="116" rx="52" ry="26" fill="url(#btnGrad)" />
    <ellipse cx="200" cy="112" rx="44" ry="20" fill="#ff6b6b" opacity="0.7" />
    <!-- Speaker / Sound icon highlight in button -->
    <path d="M192 108 L197 108 L203 103 L203 121 L197 116 L192 116 Z" fill="#ffffff" />
    <path d="M206 108 A4 4 0 0 1 206 116" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" />
    <path d="M209 105 A8 8 0 0 1 209 119" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none" />
    <text x="200" y="206" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" letter-spacing="-0.5">Soundboard</text>
    <rect x="136" y="222" width="128" height="22" rx="11" fill="#ec4899" fill-opacity="0.2" stroke="#ec4899" stroke-width="1" stroke-opacity="0.5" />
    <text x="200" y="237" text-anchor="middle" fill="#f472b6" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="10" letter-spacing="1.5">BY MYINSTANTS</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const FEATURED_APP_CONFIG = {
  tiktok: {
    name: 'Soundboard 2 ',
    url: 'https://www.soundboardguys.com',
    coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSV-0qsakVXtbgjO5dYAWUse_0I8vWZJwuE88NkBZY8Og&s',
  },
  soundboard: {
    name: 'Soundboard',
    url: 'https://www.myinstants.com/en/index/us/',
    coverUrl: 'https://cdn.aptoide.com/imgs/d/e/c/dec9bc1d63944581077bfa41b5188aa3_icon.png',
  },
  google: {
    name: 'Gemini',
    url: 'https://gemini.google.com',
    coverUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Google_Gemini_icon_2025.svg/960px-Google_Gemini_icon_2025.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
  },
  duckduckgo: {
    name: 'Duckduckgo',
    url: 'https://duckduckgo.com',
    coverUrl: '/assets/duckduckgo.svg',
    author: 'DuckDuckGo',
  },
  ddlc: {
    name: 'Doki Doki Literature Club',
    url: 'https://sethabout3653-sketch.github.io/EmeraldGreenR.github.io/',
    coverUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRMamlkw5KBVusv5915HUGcPYcq7bVp4q1bvP60VydMhw&s=10',
    author: 'By Steam',
  },
};

const BUILTIN_SCRAMJET_GAMES: GameItem[] = [
  {
    id: 900002,
    name: FEATURED_APP_CONFIG.tiktok.name,
    cover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    url: FEATURED_APP_CONFIG.tiktok.url,
    author: 'Soundboard Guys',
    special: ['tiktok', 'video', 'videos', 'short videos', 'scramjet'],
    featured: true,
    source: 'scramjet',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    fallbackCover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    localCover: FEATURED_APP_CONFIG.tiktok.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.tiktok.url,
  },
  {
    id: 900001,
    name: FEATURED_APP_CONFIG.soundboard.name,
    cover: FEATURED_APP_CONFIG.soundboard.coverUrl,
    url: FEATURED_APP_CONFIG.soundboard.url,
    author: 'Myinstants',
    special: ['soundboard', 'myinstants', 'audio', 'sound effects', 'buttons', 'scramjet'],
    featured: true,
    source: 'scramjet',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.soundboard.coverUrl,
    fallbackCover: generateSoundboardSvgCover(),
    localCover: FEATURED_APP_CONFIG.soundboard.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.soundboard.url,
  },
  {
    id: 900003,
    name: FEATURED_APP_CONFIG.google.name,
    cover: FEATURED_APP_CONFIG.google.coverUrl,
    url: FEATURED_APP_CONFIG.google.url,
    author: 'By Google',
    special: ['google', 'search', 'scramjet'],
    featured: true,
    source: 'scramjet',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.google.coverUrl,
    fallbackCover: FEATURED_APP_CONFIG.google.coverUrl,
    localCover: FEATURED_APP_CONFIG.google.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.google.url,
  },
  {
    id: 900005,
    name: FEATURED_APP_CONFIG.duckduckgo.name,
    cover: FEATURED_APP_CONFIG.duckduckgo.coverUrl,
    url: FEATURED_APP_CONFIG.duckduckgo.url,
    author: FEATURED_APP_CONFIG.duckduckgo.author,
    special: ['duckduckgo', 'duck duck go', 'search', 'privacy', 'browser', 'scramjet'],
    featured: true,
    source: 'scramjet',
    category: 'Featured',
    resolvedCover: FEATURED_APP_CONFIG.duckduckgo.coverUrl,
    fallbackCover: '/assets/duckduckgo.png',
    localCover: FEATURED_APP_CONFIG.duckduckgo.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.duckduckgo.url,
  },
  {
    id: 900004,
    name: FEATURED_APP_CONFIG.ddlc.name,
    cover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    url: FEATURED_APP_CONFIG.ddlc.url,
    author: FEATURED_APP_CONFIG.ddlc.author,
    special: ['doki doki', 'literature club', 'ddlc', 'steam', 'horror'],
    featured: true,
    source: 'native',
    category: 'Horror & Mystery',
    resolvedCover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    fallbackCover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    localCover: FEATURED_APP_CONFIG.ddlc.coverUrl,
    resolvedUrl: FEATURED_APP_CONFIG.ddlc.url,
  },
];

export function getAllGames(): GameItem[] {
  // 1. ALL EXISTING GN-MATH GAMES PRESERVED (EXCEPT deleted native soundboard id: 179)
  const validGames = (rawGamesData as RawGame[]).filter(
    (g) =>
      g.id >= 0 &&
      g.id !== 179 &&
      g.name &&
      !g.name.includes('.gg/') &&
      g.name.toLowerCase().trim() !== 'soundboard'
  );

  const gnGames: GameItem[] = validGames.map((game) => {
    const isFeatured = FEATURED_NAMES.has(game.name) || Boolean(game.featured);
    const category = detectCategory(game);
    const resolvedCover = resolveCoverUrl(game.cover);
    const fallbackCover = getDirectCoverUrl(game.cover);
    const resolvedUrl = resolveGameUrl(game.url, game.id);

    return {
      ...game,
      source: 'native',
      featured: isFeatured,
      category,
      resolvedCover,
      fallbackCover,
      localCover: resolvedCover,
      resolvedUrl,
      rating: resolveGameRating(game.name),
    };
  });

  // 2. Track existing names and high-quality covers to avoid duplicate entries
  const existingNames = new Set<string>(['soundboard', 'myinstants']);
  const coverLookupByName = new Map<string, string>();
  for (const g of gnGames) {
    const norm = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    existingNames.add(norm);
    const baseWord = norm.replace(/(game|play|online|free|unblocked)/g, '');
    if (baseWord.length >= 3) {
      existingNames.add(baseWord);
    }
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

  const builtInsWithRatings = BUILTIN_SCRAMJET_GAMES.map((g) => ({
    ...g,
    rating: g.rating || resolveGameRating(g.name),
  }));

  return [...builtInsWithRatings, ...gnGames, ...ugsGames, ...ckvGames];
}

export async function fetchGames(): Promise<GameItem[]> {
  return getAllGames();
}

import { getStoredGameFavorites, toggleGameFavorite as svcToggleGameFavorite } from './favoritesService';

const RECENT_KEY = 'melted_recent_ids';

export function getFavorites(): number[] {
  return getStoredGameFavorites();
}

export function toggleFavorite(id: number): boolean {
  const prev = getStoredGameFavorites();
  const wasFav = prev.includes(id);
  svcToggleGameFavorite(id);
  return !wasFav;
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
