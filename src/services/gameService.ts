import { RawGame, GameItem, GameCategory } from '../types/game';
import localCatalog from '../data/gnMathCatalog.json';

// RawGitHack CDNs for gn-math repository
const GN_HTML_BASE = 'https://rawcdn.githack.com/gn-math/html/main';
const GN_COVER_BASE = 'https://rawcdn.githack.com/gn-math/covers/main';

const GN_ZONES_URL = 'https://rawcdn.githack.com/gn-math/assets/main/zones.json';
const GN_ZONES_FALLBACK = 'https://raw.githubusercontent.com/gn-math/assets/main/zones.json';

const FEATURED_NAMES = new Set([
  'Slope',
  'Subway Surfers',
  '1v1.LOL',
  'Retro Bowl',
  'Drive Mad',
  'Moto X3M',
  'Cookie Clicker',
  'Geometry Dash',
  'Flappy Bird',
  'Super Mario 64',
  'Bitlife',
  'Bad Ice Cream',
  'Crossy Road',
  'Among Us',
  '2048',
  'Bowmasters',
  'OvO',
  'Gladihoppers',
  'Temple Run 2',
  'Stickman Hook',
]);

export function detectCategory(name: string): GameCategory {
  const lower = name.toLowerCase();
  if (lower.includes('drive') || lower.includes('moto') || lower.includes('car') || lower.includes('racing') || lower.includes('drift') || lower.includes('kart') || lower.includes('speed') || lower.includes('rider')) {
    return 'Driving & Racing';
  }
  if (lower.includes('1v1') || lower.includes('shoot') || lower.includes('gun') || lower.includes('war') || lower.includes('battle') || lower.includes('bullet') || lower.includes('strike') || lower.includes('tank') || lower.includes('combat') || lower.includes('sniper') || lower.includes('bowmaster') || lower.includes('gladihopper')) {
    return 'Action & Shooters';
  }
  if (lower.includes('slope') || lower.includes('run') || lower.includes('jump') || lower.includes('fall') || lower.includes('flappy') || lower.includes('geometry') || lower.includes('subway') || lower.includes('parkour') || lower.includes('vex') || lower.includes('ovo') || lower.includes('hook')) {
    return 'Skill & Platformer';
  }
  if (lower.includes('mario') || lower.includes('sonic') || lower.includes('pac') || lower.includes('retro') || lower.includes('arcade') || lower.includes('sm64') || lower.includes('pokemon') || lower.includes('zelda') || lower.includes('nes') || lower.includes('gba') || lower.includes('atari') || lower.includes('doom')) {
    return 'Retro & Arcade';
  }
  if (lower.includes('horror') || lower.includes('fnaf') || lower.includes('freddy') || lower.includes('slender') || lower.includes('granny') || lower.includes('bendy') || lower.includes('scary') || lower.includes('creep')) {
    return 'Horror & Mystery';
  }
  if (lower.includes('soccer') || lower.includes('bowl') || lower.includes('basketball') || lower.includes('football') || lower.includes('sports') || lower.includes('golf') || lower.includes('tennis') || lower.includes('baseball') || lower.includes('billiards') || lower.includes('8 ball')) {
    return 'Sports & Physics';
  }
  if (lower.includes('puzzle') || lower.includes('clicker') || lower.includes('2048') || lower.includes('chess') || lower.includes('word') || lower.includes('candy') || lower.includes('match') || lower.includes('sudoku') || lower.includes('mahjong')) {
    return 'Puzzle & Casual';
  }
  return 'Action & Shooters';
}

export function resolveCoverUrl(rawCover?: string): string {
  if (!rawCover) return '';
  return rawCover.replace('{COVER_URL}', GN_COVER_BASE);
}

export function resolveGameUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl.replace('{HTML_URL}', GN_HTML_BASE);
}

function transformRawGnMathItem(raw: any, index: number): GameItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'number' ? raw.id : index;
  // Skip discord promotion / suggestion placeholders
  if (id < 0 || !raw.name || raw.name.includes('.gg/')) return null;

  const name = String(raw.name).trim();
  if (!name || name.length <= 1) return null;

  const rawUrl = raw.url || '';
  const gameUrl = rawUrl.startsWith('http')
    ? rawUrl
    : rawUrl.replace('{HTML_URL}', GN_HTML_BASE);

  const rawCover = raw.cover || '';
  const coverUrl = rawCover.startsWith('http')
    ? rawCover
    : rawCover.replace('{COVER_URL}', GN_COVER_BASE);

  const fallbackCover = rawCover.startsWith('http')
    ? rawCover
    : rawCover.replace('{COVER_URL}', 'https://raw.githubusercontent.com/gn-math/covers/main');

  const category = detectCategory(name);
  const isFeatured = FEATURED_NAMES.has(name) || (id < 12);

  return {
    id,
    name,
    url: gameUrl,
    cover: coverUrl,
    fallbackCover,
    localCover: coverUrl,
    resolvedCover: coverUrl,
    resolvedUrl: gameUrl,
    category,
    featured: isFeatured,
    author: raw.author,
    authorLink: raw.authorLink,
  };
}

// Transform the local backup catalog immediately for instant load
const initialCatalog: GameItem[] = (Array.isArray(localCatalog) ? localCatalog : [])
  .map((item, idx) => transformRawGnMathItem(item, idx))
  .filter((g): g is GameItem => g !== null);

let cachedGames: GameItem[] = initialCatalog;

export async function fetchGames(): Promise<GameItem[]> {
  try {
    let res = await fetch(GN_ZONES_URL).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(GN_ZONES_FALLBACK).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const transformed = data
          .map((item, idx) => transformRawGnMathItem(item, idx))
          .filter((g): g is GameItem => g !== null);

        if (transformed.length > 0) {
          cachedGames = transformed;
        }
      }
    }
  } catch (error) {
    console.warn('Using local gn-math catalog fallback:', error);
  }

  return cachedGames;
}

export function getAllGames(): GameItem[] {
  return cachedGames;
}
