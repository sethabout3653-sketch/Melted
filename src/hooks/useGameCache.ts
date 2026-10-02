import { useState, useEffect, useCallback, useRef } from 'react';
import { GameItem } from '../types/game';
import { resolveGameUrl } from '../services/gameService';

const CACHE_NAME = 'melted-offline-games-v1';
const CACHED_IDS_STORAGE_KEY = 'melted_cached_game_ids';

export function useGameCache(allGames?: GameItem[]) {
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
  const autoCacheStartedRef = useRef(false);

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
        console.warn('Cache check:', err);
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

      const existing = await cache.match(url);
      if (existing) {
        setCachedIds((prev) => {
          const next = new Set(prev).add(game.id);
          localStorage.setItem(CACHED_IDS_STORAGE_KEY, JSON.stringify([...next]));
          return next;
        });
        return true;
      }

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
      console.warn(`Cache notice ${game.name}:`, err);
      return false;
    }
  }, []);

  // Silent background auto-caching: caches all games seamlessly during browser idle time
  useEffect(() => {
    if (!allGames || allGames.length === 0 || autoCacheStartedRef.current) return;
    if (!('caches' in window)) return;

    autoCacheStartedRef.current = true;

    let isMounted = true;

    const startBackgroundCaching = async () => {
      // Delay initial start by 2.5 seconds to let UI hydrate and render with zero hitch
      await new Promise((r) => setTimeout(r, 2500));
      if (!isMounted) return;

      setIsPreCaching(true);
      const cache = await caches.open(CACHE_NAME);
      const total = allGames.length;
      setCacheProgress({ current: 0, total });

      for (let i = 0; i < total; i++) {
        if (!isMounted || isCancelledRef.current) break;

        const game = allGames[i];
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
        } catch {
          // Continue silently
        }

        setCacheProgress({ current: i + 1, total });

        // Non-blocking yield to browser event loop
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      if (isMounted) {
        setIsPreCaching(false);
      }
    };

    startBackgroundCaching();

    return () => {
      isMounted = false;
      isCancelledRef.current = true;
    };
  }, [allGames]);

  return {
    cachedIds,
    isGameCached: (id: number) => cachedIds.has(id),
    cacheSingleGame,
    isPreCaching,
    cacheProgress,
  };
}
