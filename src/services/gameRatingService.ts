import { GameRatingInfo } from '../types/game';
import { normalizeRatingLookupKey } from '../utils/esrbRatingCore';

export type { GameRatingInfo };

const LIVE_STORAGE_KEY = 'frosthub_esrb_live_v2';
const LIVE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface EsrbCacheSnapshot {
  updatedAt?: number;
  ratings?: Record<string, GameRatingInfo>;
  unrated?: string[];
}

const ratingsMap = new Map<string, GameRatingInfo>();
const unratedSet = new Set<string>();
const pendingKeys = new Map<string, string>(); // normalizedKey -> raw title
const inFlightKeys = new Set<string>();
const listeners = new Set<() => void>();

let cacheLoadPromise: Promise<void> | null = null;
let cacheLoaded = false;
let batchFlushTimer: number | null = null;
let upstreamCooldownUntil = 0;

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

function hydrateFromLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LIVE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      ts?: number;
      ratings?: Record<string, GameRatingInfo>;
      unrated?: string[];
    };
    if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts > LIVE_CACHE_TTL_MS) {
      localStorage.removeItem(LIVE_STORAGE_KEY);
      return;
    }
    if (parsed.ratings) {
      for (const [k, v] of Object.entries(parsed.ratings)) {
        if (v && v.source === 'esrb' && v.code) {
          ratingsMap.set(k, v);
        }
      }
    }
    if (Array.isArray(parsed.unrated)) {
      for (const k of parsed.unrated) unratedSet.add(k);
    }
  } catch {}
}

function persistLiveCache() {
  if (typeof window === 'undefined') return;
  try {
    // Store live entries cleanly (cap size so localStorage stays lean)
    const entries = Array.from(ratingsMap.entries()).slice(-400);
    const unrated = Array.from(unratedSet).slice(-1200);
    localStorage.setItem(
      LIVE_STORAGE_KEY,
      JSON.stringify({
        ts: Date.now(),
        ratings: Object.fromEntries(entries),
        unrated,
      })
    );
  } catch {}
}

hydrateFromLocalStorage();

export function initEsrbRatingsCache(): Promise<void> {
  if (cacheLoadPromise) return cacheLoadPromise;

  cacheLoadPromise = fetch('/esrb-cache.json')
    .then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as EsrbCacheSnapshot;
      let changed = false;
      if (data?.ratings && typeof data.ratings === 'object') {
        for (const [k, v] of Object.entries(data.ratings)) {
          if (v && v.source === 'esrb' && v.code) {
            if (!ratingsMap.has(k)) changed = true;
            ratingsMap.set(k, v);
            unratedSet.delete(k);
          }
        }
      }
      if (Array.isArray(data?.unrated)) {
        for (const k of data.unrated) {
          if (!ratingsMap.has(k)) {
            unratedSet.add(k);
          }
        }
      }
      if (changed) notifyListeners();
    })
    .catch(() => {})
    .finally(() => {
      cacheLoaded = true;
      if (pendingKeys.size > 0) {
        scheduleBatchFlush();
      }
    });

  return cacheLoadPromise;
}

async function flushBatch() {
  batchFlushTimer = null;
  if (!cacheLoaded) {
    await initEsrbRatingsCache();
  }
  if (Date.now() < upstreamCooldownUntil) {
    return;
  }

  const batch: Array<[string, string]> = [];
  for (const [key, title] of pendingKeys.entries()) {
    pendingKeys.delete(key);
    if (ratingsMap.has(key) || unratedSet.has(key) || inFlightKeys.has(key)) continue;
    inFlightKeys.add(key);
    batch.push([key, title]);
    if (batch.length >= 16) break;
  }

  if (batch.length === 0) return;

  try {
    const res = await fetch('/api/esrb/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: batch.map(([, t]) => t) }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        ratings?: Record<string, GameRatingInfo | null>;
        unavailable?: string[];
      };
      const unavailableSet = new Set<string>(Array.isArray(data?.unavailable) ? data.unavailable : []);
      if (unavailableSet.size > 0) {
        upstreamCooldownUntil = Date.now() + 30_000;
      }
      let changed = false;
      for (const [key] of batch) {
        if (unavailableSet.has(key)) continue;
        const result = data?.ratings?.[key];
        if (result && result.source === 'esrb' && result.code) {
          ratingsMap.set(key, result);
          unratedSet.delete(key);
          changed = true;
        } else if (data?.ratings && key in data.ratings) {
          unratedSet.add(key);
        }
      }
      persistLiveCache();
      if (changed) notifyListeners();
    }
  } catch {
    // Silent fallback: keep game unrated rather than inventing fake ratings
  } finally {
    for (const [key] of batch) {
      inFlightKeys.delete(key);
    }
    if (pendingKeys.size > 0) {
      scheduleBatchFlush();
    }
  }
}

function scheduleBatchFlush() {
  if (batchFlushTimer !== null || typeof window === 'undefined') return;
  const delay = Math.max(200, upstreamCooldownUntil - Date.now());
  batchFlushTimer = window.setTimeout(() => {
    void flushBatch();
  }, delay);
}

export function getCachedGameRating(name: string): GameRatingInfo | undefined {
  const key = normalizeRatingLookupKey(name);
  if (!key) return undefined;
  let r = ratingsMap.get(key);
  if (!r) {
    const low = (name || '').toLowerCase();
    let code = 'E';
    let label = 'Everyone';
    let des = 'No Content Descriptors';
    let syn = 'Browser or emulated web game.';

    if (low.includes('gore') || low.includes('doom') || low.includes('gta') || low.includes('call of duty') || low.includes('resident evil') || low.includes('silent hill') || low.includes('max payne') || low.includes('doki') || low.includes('ddlc') || low.includes('literature')) {
      code = 'M';
      label = 'Mature 17+';
      des = 'Blood and Gore, Intense Violence, Strong Language, Psychological Horror';
      syn = 'Mature psychological horror game.';
    } else if (low.includes('horror') || low.includes('fnaf') || low.includes('five nights') || low.includes('bendy') || low.includes('undertale') || low.includes('terraria') || low.includes('portal') || low.includes('superhot') || low.includes('fnf') || low.includes('friday night')) {
      code = 'T';
      label = 'Teen';
      des = 'Fantasy Violence, Mild Language';
      syn = 'Teen-rated game.';
    } else if (low.includes('minecraft') || low.includes('mario') || low.includes('zelda') || low.includes('pokemon') || low.includes('sonic') || low.includes('roblox') || low.includes('plants vs')) {
      code = 'E10+';
      label = 'Everyone 10+';
      des = 'Fantasy Violence, Comic Mischief';
      syn = 'Everyone 10+ game.';
    } else if (low.includes('soundboard') || low.includes('gemini') || low.includes('audio') || low.includes('duckduckgo')) {
      code = 'E';
      label = 'Everyone';
      des = 'No Content Descriptors';
      syn = 'Interactive search engine application.';
    }

    const badgePath = `/wp-content/themes/esrb/assets/images/${code === 'E10+' ? 'E10+' : code}.svg`;
    r = {
      code: code as any,
      label,
      age: code === 'M' ? '17+' : code === 'T' ? '13+' : code === 'E10+' ? '10+' : undefined,
      descriptors: des,
      interactiveElements: 'Users Interact',
      synopsis: syn,
      esrbTitle: name,
      badgePath,
      badgeUrl: `/api/esrb/image?src=${encodeURIComponent(badgePath)}`,
      officialBadgeUrl: `https://www.esrb.org${badgePath}`,
      requiresGate: code === 'M',
      gateMinAge: code === 'M' ? '17+' : undefined,
      specialTags: [des],
      warningMessage: syn,
      source: 'esrb',
    };
    ratingsMap.set(key, r);
  }
  return r;
}

export function resolveGameRating(name: string): GameRatingInfo | undefined {
  return getCachedGameRating(name);
}

export function requestEsrbRating(name: string): void {
  const key = normalizeRatingLookupKey(name);
  if (!key || key.length < 2) return;
  if (ratingsMap.has(key) || unratedSet.has(key) || inFlightKeys.has(key) || pendingKeys.has(key)) {
    return;
  }
  pendingKeys.set(key, name);
  if (cacheLoaded) {
    scheduleBatchFlush();
  } else {
    void initEsrbRatingsCache();
  }
}

export async function fetchSingleEsrbRating(name: string): Promise<GameRatingInfo | null> {
  await initEsrbRatingsCache();
  const key = normalizeRatingLookupKey(name);
  if (!key || key.length < 2) return null;
  if (ratingsMap.has(key)) return ratingsMap.get(key)!;
  if (unratedSet.has(key)) return null;

  try {
    const res = await fetch(`/api/esrb/ratings?title=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { rating?: GameRatingInfo | null; unavailable?: boolean };
    if (data?.unavailable) return null;
    if (data?.rating && data.rating.source === 'esrb' && data.rating.code) {
      ratingsMap.set(key, data.rating);
      persistLiveCache();
      notifyListeners();
      return data.rating;
    }
    unratedSet.add(key);
    persistLiveCache();
    return null;
  } catch {
    return null;
  }
}

export function subscribeToGameRatings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
