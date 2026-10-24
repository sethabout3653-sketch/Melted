import rawGamesData from '../data/gnMathGames.json';
import { RawGame, GameItem, GameCategory } from '../types/game';

import fileMapData from '../data/gnMathFileMap.json';

const fileMap = fileMapData as Record<string, string>;

// ============================================================================
// 1. GAME COVERS RESOLUTION SYSTEM (IMAGES ONLY)
// ============================================================================
export const COVER_BASE = 'https://raw.githubusercontent.com/gn-math/covers/main';
export const COVER_PRIMARY_BASE = 'https://raw.githubusercontent.com/gn-math/covers/main';
export const FALLBACK_COVER_BASE = 'https://cdn.statically.io/gh/gn-math/covers/main';
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

export function getAllGames(): GameItem[] {
  const validGames = (rawGamesData as RawGame[]).filter(
    (g) => g.id >= 0 && g.name && !g.name.includes('.gg/')
  );

  return validGames.map((game) => {
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
