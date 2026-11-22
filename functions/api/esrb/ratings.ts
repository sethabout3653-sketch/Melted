import { GameRatingInfo } from '../../../src/types/game';
import {
  fetchEsrbRatingDetailed,
  normalizeRatingLookupKey,
} from '../../../src/utils/esrbRatingCore';

interface EsrbCacheSnapshot {
  updatedAt?: number;
  ratings?: Record<string, GameRatingInfo>;
  unrated?: string[];
}

interface EsrbContext {
  request: Request;
  env?: { ASSETS?: { fetch(request: Request): Promise<Response> } };
}

let snapshotCachePromise: Promise<{
  ratings: Record<string, GameRatingInfo>;
  unrated: Set<string>;
}> | null = null;

const liveMemoryCache = new Map<string, GameRatingInfo | null>();
const unavailableRetryUntil = new Map<string, number>();

async function loadSnapshot(context: EsrbContext) {
  if (!snapshotCachePromise) {
    const assetUrl = new URL('/esrb-cache.json', context.request.url);
    const fetcher = context.env?.ASSETS
      ? context.env.ASSETS.fetch(new Request(assetUrl.toString()))
      : fetch(assetUrl.toString());

    snapshotCachePromise = fetcher
      .then(async (res) => {
        if (!res.ok) {
          return { ratings: {}, unrated: new Set<string>() };
        }
        const data = (await res.json()) as EsrbCacheSnapshot;
        return {
          ratings: data.ratings || {},
          unrated: new Set<string>(data.unrated || []),
        };
      })
      .catch(() => {
        snapshotCachePromise = null;
        return { ratings: {}, unrated: new Set<string>() };
      });
  }
  return snapshotCachePromise;
}

async function resolveTitle(
  title: string,
  snapshot: { ratings: Record<string, GameRatingInfo>; unrated: Set<string> }
): Promise<{ key: string; rating: GameRatingInfo | null; status: 'matched' | 'unrated' | 'unavailable' }> {
  const key = normalizeRatingLookupKey(title);
  if (!key || key.length < 2) {
    return { key, rating: null, status: 'unrated' };
  }

  if (key in snapshot.ratings) {
    return { key, rating: snapshot.ratings[key], status: 'matched' };
  }
  if (snapshot.unrated.has(key)) {
    return { key, rating: null, status: 'unrated' };
  }
  if (liveMemoryCache.has(key)) {
    const cached = liveMemoryCache.get(key) || null;
    return { key, rating: cached, status: cached ? 'matched' : 'unrated' };
  }
  const retryAt = unavailableRetryUntil.get(key);
  if (retryAt && Date.now() < retryAt) {
    return { key, rating: null, status: 'unavailable' };
  }

  const fetched = await fetchEsrbRatingDetailed(title);
  if (fetched.status === 'unavailable') {
    unavailableRetryUntil.set(key, Date.now() + 60_000);
    return { key, rating: null, status: 'unavailable' };
  }
  unavailableRetryUntil.delete(key);
  liveMemoryCache.set(key, fetched.rating);
  return { key, rating: fetched.rating, status: fetched.status };
}

export async function onRequest(context: EsrbContext): Promise<Response> {
  const snapshot = await loadSnapshot(context);
  const url = new URL(context.request.url);

  if (context.request.method === 'GET') {
    const title = (url.searchParams.get('title') || '').trim();
    if (!title) {
      return Response.json({ error: 'Missing title query param' }, { status: 400 });
    }
    const { key, rating, status } = await resolveTitle(title, snapshot);
    return Response.json(
      { key, rating, unavailable: status === 'unavailable', source: 'esrb' },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': status === 'unavailable' ? 'no-store' : 'public, max-age=3600',
        },
      }
    );
  }

  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let titles: string[] = [];
  try {
    const body = (await context.request.json()) as { titles?: unknown };
    if (Array.isArray(body?.titles)) {
      titles = body.titles
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .slice(0, 20);
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ratings: Record<string, GameRatingInfo | null> = {};
  const unavailable: string[] = [];
  const CONCURRENCY = 2;
  let cursor = 0;

  async function worker() {
    while (cursor < titles.length) {
      const idx = cursor++;
      const title = titles[idx];
      const { key, rating, status } = await resolveTitle(title, snapshot);
      if (key) {
        if (status === 'unavailable') {
          unavailable.push(key);
        } else {
          ratings[key] = rating;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, titles.length) }, () => worker()));

  return Response.json(
    { ratings, unavailable, source: 'esrb' },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': unavailable.length > 0 ? 'no-store' : 'public, max-age=3600',
      },
    }
  );
}
