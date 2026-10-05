import rawGamesData from '../data/gnMathGames.json';
import { RawGame, GameItem, GameCategory } from '../types/game';

export const RAWGITHACK_BASE = 'https://raw.githack.com/freebuisness/html/main';
export const COVER_BASE = 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main';

export function resolveCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  return rawCover.replace('{COVER_URL}', COVER_BASE);
}

// Seamless streaming endpoint via backend proxy with RawGitHack engine
export function resolveGameUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const filename = rawUrl.replace('{HTML_URL}/', '');
  return `/api/raw/${filename}`;
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
    const resolvedUrl = resolveGameUrl(game.url);

    return {
      ...game,
      featured: isFeatured,
      category,
      resolvedCover,
      resolvedUrl,
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
