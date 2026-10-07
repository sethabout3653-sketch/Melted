// Universal Background Game Save Protection
// Automatically persists and restores game progress silently across school Chromebook wipes

export interface GameSaveData {
  gameId: string;
  gameName: string;
  timestamp: string;
  savedAt: number;
  localStorageData: Record<string, string>;
  version: number;
}

const SAVE_PREFIX = 'frosted_auto_save_';
const DB_NAME = 'FrostedAutoSaveDB';
const DB_VERSION = 1;
const STORE_NAME = 'game_saves';

function openSaveDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'gameId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

// Retrieve saved data from LocalStorage synchronously
export function getStoredGameSave(gameId: string | number): GameSaveData | null {
  try {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${gameId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Debounced batch storage to eliminate CPU lag and frame drops on school Chromebooks
const saveDebounceTimers: Map<string, number> = new Map();
const pendingPayloads: Map<string, Record<string, string>> = new Map();

// Synchronously flush pending saves
export function flushPendingSaves(gameId: string | number, gameName: string): void {
  try {
    const idStr = String(gameId);
    const toFlush = pendingPayloads.get(idStr);
    if (!toFlush) return;

    const timer = saveDebounceTimers.get(idStr);
    if (timer) clearTimeout(timer);
    saveDebounceTimers.delete(idStr);
    pendingPayloads.delete(idStr);

    const existing = getStoredGameSave(idStr);
    const mergedData = { ...(existing?.localStorageData || {}), ...toFlush };
    const payload: GameSaveData = {
      gameId: idStr,
      gameName,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      savedAt: Date.now(),
      localStorageData: mergedData,
      version: 1,
    };
    localStorage.setItem(`${SAVE_PREFIX}${idStr}`, JSON.stringify(payload));
  } catch {
    // Silent fail
  }
}

// Persist save data into LocalStorage AND persistent IndexedDB silently with high-performance batching
export function storeGameSave(gameId: string | number, gameName: string, data: Record<string, string>): void {
  try {
    const idStr = String(gameId);
    const existingPending = pendingPayloads.get(idStr) || {};
    pendingPayloads.set(idStr, { ...existingPending, ...data });

    const existingTimer = saveDebounceTimers.get(idStr);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(async () => {
      saveDebounceTimers.delete(idStr);
      const toFlush = pendingPayloads.get(idStr);
      pendingPayloads.delete(idStr);
      if (!toFlush) return;

      try {
        const existing = getStoredGameSave(idStr);
        const mergedData = { ...(existing?.localStorageData || {}), ...toFlush };

        const payload: GameSaveData = {
          gameId: idStr,
          gameName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          savedAt: Date.now(),
          localStorageData: mergedData,
          version: 1,
        };

        // 1. Synchronous LocalStorage backup
        localStorage.setItem(`${SAVE_PREFIX}${idStr}`, JSON.stringify(payload));

        // 2. Persistent IndexedDB backup (survives Chromebook profile wipes)
        const db = await openSaveDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(payload);
      } catch {
        // Silent fail
      }
    }, 1000);

    saveDebounceTimers.set(idStr, timer);
  } catch {
    // Silent fail
  }
}

// Automatically restore save data to game iframe on load
export async function restoreAutoSaveToIframe(gameId: string | number, iframeWin: Window): Promise<boolean> {
  try {
    const idStr = String(gameId);
    let save = getStoredGameSave(idStr);

    // Fallback to IndexedDB if LocalStorage was wiped
    if (!save) {
      try {
        const db = await openSaveDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(idStr);
        save = await new Promise((resolve) => {
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
        if (save) {
          localStorage.setItem(`${SAVE_PREFIX}${idStr}`, JSON.stringify(save));
        }
      } catch (err) {}
    }

    if (save && save.localStorageData && iframeWin) {
      iframeWin.postMessage({ type: 'FROSTED_RESTORE_SAVES', saves: save.localStorageData }, '*');
      return true;
    }
  } catch (e) {
    // Silent
  }
  return false;
}
