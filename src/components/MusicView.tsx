import React, { useState, useEffect, useRef } from 'react';
import { 
  Music, 
  Search, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Heart, 
  Shuffle, 
  Repeat, 
  Sparkles, 
  Flame, 
  Loader2
} from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number; // in seconds
  previewUrl: string;
}

const DEFAULT_PLAYLISTS: { title: string; subtitle: string; query: string }[] = [
  { title: 'Today’s Top Hits', subtitle: 'The biggest hits right now', query: 'pop hits 2026' },
  { title: 'Lo-Fi & Chill', subtitle: 'Relax, study, and code', query: 'lofi chill study beats' },
  { title: 'Electronic & EDM', subtitle: 'High energy anthems', query: 'electronic edm dance' },
  { title: 'Gaming OSTs', subtitle: 'Epic soundtracks', query: 'gaming synthwave ost' },
];

export const MusicView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState('Today’s Top Hits');
  const [provider, setProvider] = useState('all');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchTracks = async (term: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(term)}&provider=${provider}&limit=30`);
      const data = await res.json();
      if (data && (data.results || data.tracks)) {
        const results = data.results || data.tracks;
        const mapped = results.map((item: any) => ({
          id: item.id || `track-${Math.random()}`,
          title: item.title || 'Unknown',
          artist: item.artist || 'Unknown',
          album: item.album || 'Unknown',
          artwork: item.artwork || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
          duration: item.rawDuration || (typeof item.duration === 'number' ? item.duration : 30),
          previewUrl: item.streamUrl || item.previewUrl || '',
        })).filter((t: Track) => t.previewUrl);
        setTracks(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch music:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks('top pop hits 2026');
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    fetchTracks(searchQuery);
  };

  const playTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = track.previewUrl;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  };

  const togglePlayPause = () => {
    if (!currentTrack && tracks.length > 0) {
      playTrack(tracks[0]);
      return;
    }
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg-navy)] text-[var(--text-white)] relative overflow-hidden">
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 30);
          }
        }}
        onEnded={() => {
          if (isRepeat && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
        }}
      />

      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--vibrant-cyan)]/20 bg-[var(--bg-black)] flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--vibrant-cyan)] flex items-center justify-center text-[var(--bg-black)] shadow-lg shadow-[var(--vibrant-cyan)]/30">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">Music</h1>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-[var(--bg-navy)] border border-[var(--vibrant-cyan)]/30 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--vibrant-cyan)]"
          >
            <option value="all">All Providers</option>
            <option value="tidal">Tidal</option>
            <option value="youtube">YouTube Music</option>
          </select>
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists..."
              className="w-full bg-[var(--bg-navy)] border border-[var(--vibrant-cyan)]/30 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--vibrant-cyan)] transition-all"
            />
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-32 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {DEFAULT_PLAYLISTS.map((cat) => (
            <div
              key={cat.title}
              onClick={() => { setActiveCategory(cat.title); setSearchQuery(cat.query); fetchTracks(cat.query); }}
              className={`p-5 rounded-2xl bg-[var(--bg-black)] border ${activeCategory === cat.title ? 'border-[var(--vibrant-cyan)]' : 'border-[var(--vibrant-cyan)]/20'} cursor-pointer hover:border-[var(--vibrant-cyan)] transition-all`}
            >
              <h3 className="text-sm font-bold text-white mb-1">{cat.title}</h3>
              <p className="text-xs text-zinc-400">{cat.subtitle}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-sm font-bold text-white mb-4">Tracks</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-[var(--vibrant-cyan)]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tracks.map((track) => {
                const isSelected = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track)}
                    className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-[var(--vibrant-cyan)]/20 border-[var(--vibrant-cyan)]' 
                        : 'bg-[var(--bg-black)] border-[var(--vibrant-cyan)]/10 hover:border-[var(--vibrant-cyan)]/40'
                    }`}
                  >
                    <img src={track.artwork} className="w-12 h-12 rounded-lg" />
                    <div className="flex-1 truncate">
                      <div className="text-sm font-bold truncate text-white">{track.title}</div>
                      <div className="text-xs text-zinc-400 truncate">{track.artist}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {currentTrack && (
        <div className="absolute inset-x-0 bottom-0 bg-[var(--bg-black)] border-t border-[var(--vibrant-cyan)]/20 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <img src={currentTrack.artwork} className="w-12 h-12 rounded-lg" />
            <div className="flex-1 truncate">
              <div className="text-sm font-bold text-white truncate">{currentTrack.title}</div>
              <div className="text-xs text-zinc-400 truncate">{currentTrack.artist}</div>
            </div>
            <button onClick={togglePlayPause} className="p-3 bg-[var(--vibrant-cyan)] rounded-full text-[var(--bg-black)]">
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span>{formatDuration(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={currentTrack.duration}
              value={currentTime}
              onChange={(e) => {
                if (audioRef.current) audioRef.current.currentTime = parseFloat(e.target.value);
              }}
              className="flex-1 h-1.5 accent-[var(--vibrant-cyan)] cursor-pointer"
            />
            <span>{formatDuration(currentTrack.duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
