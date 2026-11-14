import { db, auth } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY_GAMES = 'frosthub_favorites';
const STORAGE_KEY_GAMES_LEGACY = 'melted_favorite_ids';
const STORAGE_KEY_CHANNELS = 'frosthub_tv_favorites';
const STORAGE_KEY_USER_ID = 'frosthub_chat_user_id';

export interface FavoritesData {
  gameIds: number[];
  channelIds: string[];
  updatedAt?: number;
}

// In-memory cache for fast zero-latency access
let cachedGameFavorites: number[] | null = null;
let cachedChannelFavorites: string[] | null = null;

export function getEffectiveUserId(): string {
  try {
    if (auth.currentUser?.uid) {
      return auth.currentUser.uid;
    }
    const stored = localStorage.getItem(STORAGE_KEY_USER_ID);
    if (stored && stored.trim()) {
      return stored.trim();
    }
    const newId = 'u_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(STORAGE_KEY_USER_ID, newId);
    return newId;
  } catch {
    return 'default_user';
  }
}

export function getStoredGameFavorites(): number[] {
  if (cachedGameFavorites !== null) {
    return cachedGameFavorites;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAMES) || localStorage.getItem(STORAGE_KEY_GAMES_LEGACY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedGameFavorites = parsed.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
        return cachedGameFavorites;
      }
    }
  } catch {}
  cachedGameFavorites = [];
  return cachedGameFavorites;
}

export function getStoredChannelFavorites(): string[] {
  if (cachedChannelFavorites !== null) {
    return cachedChannelFavorites;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHANNELS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedChannelFavorites = parsed.map((x) => String(x).trim()).filter(Boolean);
        return cachedChannelFavorites;
      }
    }
  } catch {}
  cachedChannelFavorites = [];
  return cachedChannelFavorites;
}

export function saveLocalFavorites(gameIds: number[], channelIds: string[]) {
  cachedGameFavorites = [...gameIds];
  cachedChannelFavorites = [...channelIds];
  try {
    localStorage.setItem(STORAGE_KEY_GAMES, JSON.stringify(gameIds));
    localStorage.setItem(STORAGE_KEY_GAMES_LEGACY, JSON.stringify(gameIds));
    localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(channelIds));
  } catch (err) {
    console.warn('[Favorites] LocalStorage write error:', err);
  }

  // Notify active components across the application
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('frosthub:favorites_updated', {
        detail: { gameIds, channelIds },
      })
    );
  }
}

export async function persistFavoritesRemote(userId: string, gameIds: number[], channelIds: string[]) {
  const payload: FavoritesData = {
    gameIds,
    channelIds,
    updatedAt: Date.now(),
  };

  // 1. Sync to Firebase Firestore
  try {
    const favDocRef = doc(db, 'user_favorites', userId);
    await setDoc(favDocRef, { ...payload, userId }, { merge: true });
  } catch (err) {
    console.info('[Favorites] Cloud Firestore sync note:', err);
  }

  // 2. Sync to Backend Express API
  try {
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...payload }),
    });
  } catch {}
}

export function toggleGameFavorite(gameId: number): number[] {
  const current = getStoredGameFavorites();
  const exists = current.includes(gameId);
  const updated = exists ? current.filter((id) => id !== gameId) : [gameId, ...current];
  const channelIds = getStoredChannelFavorites();

  saveLocalFavorites(updated, channelIds);
  const userId = getEffectiveUserId();
  persistFavoritesRemote(userId, updated, channelIds).catch(() => {});
  return updated;
}

export function toggleChannelFavorite(channelId: string): string[] {
  const current = getStoredChannelFavorites();
  const exists = current.includes(channelId);
  const updated = exists ? current.filter((id) => id !== channelId) : [channelId, ...current];
  const gameIds = getStoredGameFavorites();

  saveLocalFavorites(gameIds, updated);
  const userId = getEffectiveUserId();
  persistFavoritesRemote(userId, gameIds, updated).catch(() => {});
  return updated;
}

/**
 * Subscribes to favorites from both Firestore and LocalStorage updates.
 */
export function subscribeToFavorites(
  userId: string,
  onUpdate: (data: { gameIds: number[]; channelIds: string[] }) => void
): () => void {
  // 1. Local custom event listener
  const handleLocalUpdate = (e: Event) => {
    const custom = e as CustomEvent<{ gameIds: number[]; channelIds: string[] }>;
    if (custom.detail) {
      onUpdate({
        gameIds: custom.detail.gameIds || [],
        channelIds: custom.detail.channelIds || [],
      });
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('frosthub:favorites_updated', handleLocalUpdate);
  }

  // 2. Initial fetch from backend API
  fetch(`/api/favorites?userId=${encodeURIComponent(userId)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && (Array.isArray(data.gameIds) || Array.isArray(data.channelIds))) {
        const localGames = getStoredGameFavorites();
        const localChannels = getStoredChannelFavorites();
        const mergedGames = Array.from(new Set([...localGames, ...(data.gameIds || [])]));
        const mergedChannels = Array.from(new Set([...localChannels, ...(data.channelIds || [])]));
        saveLocalFavorites(mergedGames, mergedChannels);
        onUpdate({ gameIds: mergedGames, channelIds: mergedChannels });
      }
    })
    .catch(() => {});

  // 3. Real-time Firestore document listener
  let unsubFirestore: (() => void) | null = null;
  try {
    const favDocRef = doc(db, 'user_favorites', userId);
    unsubFirestore = onSnapshot(
      favDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const remoteGames = Array.isArray(data.gameIds) ? data.gameIds.map(Number) : [];
          const remoteChannels = Array.isArray(data.channelIds) ? data.channelIds.map(String) : [];
          
          const localGames = getStoredGameFavorites();
          const localChannels = getStoredChannelFavorites();
          const mergedGames = Array.from(new Set([...localGames, ...remoteGames]));
          const mergedChannels = Array.from(new Set([...localChannels, ...remoteChannels]));

          saveLocalFavorites(mergedGames, mergedChannels);
          onUpdate({ gameIds: mergedGames, channelIds: mergedChannels });
        } else {
          // If Firestore document doesn't exist yet, seed it with current local favorites
          const localGames = getStoredGameFavorites();
          const localChannels = getStoredChannelFavorites();
          if (localGames.length > 0 || localChannels.length > 0) {
            persistFavoritesRemote(userId, localGames, localChannels).catch(() => {});
          }
        }
      },
      (err) => {
        console.info('[Favorites] Firestore listener note:', err?.message || err);
      }
    );
  } catch (err) {
    console.info('[Favorites] Firestore subscription error:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('frosthub:favorites_updated', handleLocalUpdate);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}
