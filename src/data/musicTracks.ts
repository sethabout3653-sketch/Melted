export interface Track {
  id: string;
  videoId?: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  url: string;
  coverUrl: string;
  genre: string;
  vibe: string;
  isCustom?: boolean;
}

export const INITIAL_TRACKS: Track[] = [];
