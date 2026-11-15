import { db, auth } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY_GAMES = 'frosthub_favorites';
const STORAGE_KEY_GAMES_LEGACY = 'melted_favorite_ids';
const STORAGE_KEY_CHANNELS = 'frosthub_tv_favorites';
const STORAGE_KEY_UPDATED_AT = 'frosthub_favorites_updated_at';
const STORAGE_KEY_USER_ID = 'frosthub_chat_user_id';

export interface FavoritesData {
  gameIds: number[];
  channelIds: string[];
  updatedAt?: number;
}

// In-memory cache for fast zero-latency access
let cachedGameFavorites: number[] | null = null;
let cachedChannelFavorites: string[] | null = null;
let cachedUpdatedAt: number | null = null;

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

export function getStoredFavoritesUpdatedAt(): number {
  if (cachedUpdatedAt !== null) {
    return cachedUpdatedAt;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UPDATED_AT);
    const parsed = raw ? Number(raw) : 0;
    cachedUpdatedAt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    return cachedUpdatedAt;
  } catch {
    cachedUpdatedAt = 0;
    return 0;
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
        cachedGameFavorites = Array.from(new Set(parsed.map((x) => Number(x)).filter((n) => !Number.isNaN(n))));
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
        cachedChannelFavorites = Array.from(new Set(parsed.map((x) => String(x).trim()).filter(Boolean)));
        return cachedChannelFavorites;
      }
    }
  } catch {}
  cachedChannelFavorites = [];
  return cachedChannelFavorites;
}

export function saveLocalFavorites(gameIds: number[], channelIds: string[], updatedAt: number = Date.now()) {
  const cleanGames = Array.from(new Set(gameIds.map(Number).filter((n) => !Number.isNaN(n))));
  const cleanChannels = Array.from(new Set(channelIds.map((x) => String(x).trim()).filter(Boolean)));
  cachedGameFavorites = cleanGames;
  cachedChannelFavorites = cleanChannels;
  cachedUpdatedAt = updatedAt;
  try {
    localStorage.setItem(STORAGE_KEY_GAMES, JSON.stringify(cleanGames));
    localStorage.setItem(STORAGE_KEY_GAMES_LEGACY, JSON.stringify(cleanGames));
    localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(cleanChannels));
    localStorage.setItem(STORAGE_KEY_UPDATED_AT, String(updatedAt));
  } catch (err) {
    console.warn('[Favorites] LocalStorage write error:', err);
  }

  // Notify active components across the application
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('frosthub:favorites_updated', {
        detail: { gameIds: cleanGames, channelIds: cleanChannels },
      })
    );
  }
}

export async function persistFavoritesRemote(
  userId: string,
  gameIds: number[],
  channelIds: string[],
  updatedAt: number = getStoredFavoritesUpdatedAt() || Date.now()
) {
  const payload: FavoritesData = {
    gameIds: Array.from(new Set(gameIds)),
    channelIds: Array.from(new Set(channelIds)),
    updatedAt,
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
  const now = Date.now();

  saveLocalFavorites(updated, channelIds, now);
  const userId = getEffectiveUserId();
  persistFavoritesRemote(userId, updated, channelIds, now).catch(() => {});
  return updated;
}

export function toggleChannelFavorite(channelId: string): string[] {
  const current = getStoredChannelFavorites();
  const exists = current.includes(channelId);
  const updated = exists ? current.filter((id) => id !== channelId) : [channelId, ...current];
  const gameIds = getStoredGameFavorites();
  const now = Date.now();

  saveLocalFavorites(gameIds, updated, now);
  const userId = getEffectiveUserId();
  persistFavoritesRemote(userId, gameIds, updated, now).catch(() => {});
  return updated;
}

function applyRemoteSnapshot(
  userId: string,
  remoteGamesRaw: unknown,
  remoteChannelsRaw: unknown,
  remoteUpdatedAtRaw: unknown,
  onUpdate: (data: { gameIds: number[]; channelIds: string[] }) => void
) {
  const remoteGames = Array.isArray(remoteGamesRaw)
    ? Array.from(new Set(remoteGamesRaw.map(Number).filter((n) => !Number.isNaN(n))))
    : [];
  const remoteChannels = Array.isArray(remoteChannelsRaw)
    ? Array.from(new Set(remoteChannelsRaw.map((x) => String(x).trim()).filter(Boolean)))
    : [];
  const remoteUpdatedAt = typeof remoteUpdatedAtRaw === 'number' && Number.isFinite(remoteUpdatedAtRaw) ? remoteUpdatedAtRaw : 0;

  const localGames = getStoredGameFavorites();
  const localChannels = getStoredChannelFavorites();
  const localUpdatedAt = getStoredFavoritesUpdatedAt();
  const hasAnyLocal = localGames.length > 0 || localChannels.length > 0 || localUpdatedAt > 0;

  if (!hasAnyLocal && (remoteGames.length > 0 || remoteChannels.length > 0)) {
    const ts = remoteUpdatedAt || Date.now();
    saveLocalFavorites(remoteGames, remoteChannels, ts);
    onUpdate({ gameIds: remoteGames, channelIds: remoteChannels });
    return;
  }

  if (remoteUpdatedAt > localUpdatedAt) {
    saveLocalFavorites(remoteGames, remoteChannels, remoteUpdatedAt);
    onUpdate({ gameIds: remoteGames, channelIds: remoteChannels });
  } else if (localUpdatedAt > remoteUpdatedAt && (remoteGames.length !== localGames.length || remoteChannels.length !== localChannels.length)) {
    // Push newer local state so un-favorites aren't resurrected by stale remote copies
    persistFavoritesRemote(userId, localGames, localChannels, localUpdatedAt).catch(() => {});
  }
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
        applyRemoteSnapshot(userId, data.gameIds, data.channelIds, data.updatedAt, onUpdate);
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
          applyRemoteSnapshot(userId, data.gameIds, data.channelIds, data.updatedAt, onUpdate);
        } else {
          // If Firestore document doesn't exist yet, seed it with current local favorites
          const localGames = getStoredGameFavorites();
          const localChannels = getStoredChannelFavorites();
          if (localGames.length > 0 || localChannels.length > 0) {
            persistFavoritesRemote(userId, localGames, localChannels, getStoredFavoritesUpdatedAt() || Date.now()).catch(() => {});
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
