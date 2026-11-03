export interface ContinueWatchingEntry {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  progressSeconds: number;
  durationSeconds: number;
  percentage: number;
  lastWatchedAt: number;
  serverName: string;
}

const STORAGE_KEY = 'frosted_continue_watching_list';

export function getContinueWatchingList(): ContinueWatchingEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveContinueWatchingEntry(entry: ContinueWatchingEntry): ContinueWatchingEntry[] {
  try {
    // Save as soon as playback starts, even before an embed reports its first time update.
    const current = getContinueWatchingList();
    const filtered = current.filter(item => item.id !== entry.id);
    const updated = [entry, ...filtered].slice(0, 15);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getContinueWatchingList();
  }
}

export function removeContinueWatchingEntry(id: number): ContinueWatchingEntry[] {
  try {
    const current = getContinueWatchingList();
    const filtered = current.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
}

export function formatDuration(totalSecs: number): string {
  if (!totalSecs || isNaN(totalSecs) || totalSecs <= 0) return '0s';
  const secs = Math.floor(totalSecs % 60);
  const mins = Math.floor((totalSecs / 60) % 60);
  const hrs = Math.floor(totalSecs / 3600);

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}
