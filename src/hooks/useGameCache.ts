import { useState, useEffect, useCallback, useRef } from 'react';
import { GameItem } from '../types/game';
import { resolveGameUrl } from '../services/gameService';

const CACHE_NAME = 'melted-offline-games-v1';
const CACHED_IDS_STORAGE_KEY = 'melted_cached_game_ids';

export function useGameCache() {
  const [cachedIds, setCachedIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(CACHED_IDS_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [isPreCaching, setIsPreCaching] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const isCancelledRef = useRef(false);

  // Sync cached IDs with Cache Storage on mount
  useEffect(() => {
    if (!('caches' in window)) return;

    const verifyCache = async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        const foundIds = new Set<number>();

        keys.forEach((request) => {
          const match = request.url.match(/\/api\/raw\/(\d+)/);
          if (match && match[1]) {
            foundIds.add(parseInt(match[1], 10));
          }
        });

        if (foundIds.size > 0) {
          setCachedIds((prev) => {
            const merged = new Set([...prev, ...foundIds]);
            localStorage.setItem(CACHED_IDS_STORAGE_KEY, JSON.stringify([...merged]));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Cache verification check:', err);
      }
    };

    verifyCache();
  }, []);

  // Cache a single game silently without blocking UI
  const cacheSingleGame = useCallback(async (game: GameItem): Promise<boolean> => {
    if (!('caches' in window)) return false;
    try {
      const url = resolveGameUrl(game.url);
      const cache = await caches.open(CACHE_NAME);

      // Check if already in cache
      const existing = await cache.match(url);
      if (existing) {
        setCachedIds((prev) => {
          const next = new Set(prev).add(game.id);
          localStorage.setItem(CACHED_IDS_STORAGE_KEY, JSON.stringify([...next]));
          return next;
        });
        return true;
      }

      // Fetch game and store in cache
      const response = await fetch(url, { cache: 'force-cache' });
      if (response.ok) {
        await cache.put(url, response.clone());
        setCachedIds((prev) => {
          const next = new Set(prev).add(game.id);
          localStorage.setItem(CACHED_IDS_STORAGE_KEY, JSON.stringify([...next]));
          return next;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`Failed to cache ${game.name}:`, err);
      return false;
    }
  }, []);

  // Pre-cache top games smoothly in non-blocking idle batches (NEVER freezes or lags UI)
  const preCacheGames = useCallback(async (gamesToCache: GameItem[]) => {
    if (!('caches' in window) || isPreCaching || gamesToCache.length === 0) return;

    setIsPreCaching(true);
    isCancelledRef.current = false;
    const total = gamesToCache.length;
    setCacheProgress({ current: 0, total });

    const cache = await caches.open(CACHE_NAME);

    for (let i = 0; i < total; i++) {
      if (isCancelledRef.current) break;

      const game = gamesToCache[i];
      const url = resolveGameUrl(game.url);

      try {
        const match = await cache.match(url);
        if (!match) {
          const res = await fetch(url, { cache: 'default' });
          if (res.ok) {
            await cache.put(url, res.clone());
          }
        }

        setCachedIds((prev) => {
          const next = new Set(prev).add(game.id);
          localStorage.setItem(CACHED_IDS_STORAGE_KEY, JSON.stringify([...next]));
          return next;
        });
      } catch (e) {
        // Silently continue
      }

      setCacheProgress({ current: i + 1, total });

      // Yield execution to the browser event loop between fetches so 60 FPS is maintained
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    setIsPreCaching(false);
  }, [isPreCaching]);

  const cancelPreCaching = useCallback(() => {
    isCancelledRef.current = true;
    setIsPreCaching(false);
  }, []);

  return {
    cachedIds,
    isGameCached: (id: number) => cachedIds.has(id),
    cacheSingleGame,
    preCacheGames,
    isPreCaching,
    cacheProgress,
    cancelPreCaching,
  };
}
