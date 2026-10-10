import React, { useState, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Heart, 
  Search, 
  X, 
  Music2, 
  Video, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Sparkles,
  Disc3,
  Server,
  Globe,
  ExternalLink
} from 'lucide-react';
import { Track } from '../data/musicTracks';
import { useMusicPlayer } from '../hooks/useMusicPlayer';

interface MusicViewProps {
  player: ReturnType<typeof useMusicPlayer>;
}

export const MusicView: React.FC<MusicViewProps> = ({ player }) => {
  const {
    tracks = [],
    setTracks,
    currentTrack = null,
    isPlaying = false,
    setIsPlaying,
    mediaMode = 'audio',
    setMediaMode,
    currentTime = 0,
    setCurrentTime,
    duration = 210,
    volume = 80,
    isMuted = false,
    isShuffle = false,
    isRepeat = false,
    likedTrackIds = [],
    isLoadingTracks = false,
    setIsLoadingTracks,
    vibeMessage = 'put some headphones on. found these tracks for you.',
    setVibeMessage,
    setIsShuffle,
    setIsRepeat,
    playTrack,
    togglePlay,
    handleNextTrack,
    handlePrevTrack,
    toggleLike,
    seekTo,
    toggleMute,
    setVolume,
    addCustomTrack,
    iframeRef,
    audioRef,
    videoRef,
  } = player || ({} as any);

  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'liked'>('all');
  const [activeGenreFilter, setActiveGenreFilter] = useState<string>('all');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [invidiousInstance, setInvidiousInstance] = useState<string>('https://yewtu.be');

  const INVIDIOUS_SERVERS = [
    { label: 'yewtu.be', url: 'https://yewtu.be' },
    { label: 'invidious.nerdvpn.de', url: 'https://invidious.nerdvpn.de' },
    { label: 'invidious.f5.si', url: 'https://invidious.f5.si' },
    { label: 'invidious.projectsegfau.lt', url: 'https://invidious.projectsegfau.lt' },
  ];

  const GENRE_PILLS = [
    { id: 'all', label: 'all tracks' },
    { id: 'lofi', label: 'lofi beats', query: 'lofi hip hop radio beats to relax' },
    { id: 'chillhop', label: 'chillhop', query: 'chillhop study beats essentials' },
    { id: 'synthwave', label: 'synthwave', query: 'synthwave retro chill' },
    { id: 'ambient', label: 'ambient', query: 'ambient deep focus electronic' },
    { id: 'gaming', label: 'late night', query: 'late night gaming chill music' },
  ];

  const handleSearchSubmit = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : searchInput).trim();
    if (!query) return;

    setIsSearching(true);
    setStatusMessage('finding music for you...');

    const isUrl = /(?:https?:\/\/|youtu\.be\/|youtube\.com\/)/i.test(query);

    if (isUrl) {
      try {
        const res = await fetch('/api/music/extract-invidious', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();
        if (data.success && data.track) {
          addCustomTrack(data.track);
          playTrack(data.track);
          setStatusMessage('playing your track now');
          setTimeout(() => setStatusMessage(''), 2500);
        } else {
          setStatusMessage('could not load that link, try another');
        }
      } catch {
        setStatusMessage('could not load that link, try another');
      } finally {
        setIsSearching(false);
      }
      return;
    }

    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setTracks(data.tracks);
        setVibeMessage('found these songs for you');
        setStatusMessage('');
      } else {
        setStatusMessage('no tracks found, try another title');
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch {
      setStatusMessage('brief connection hiccup, retrying');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePillClick = (pill: typeof GENRE_PILLS[0]) => {
    setActiveGenreFilter(pill.id);
    if (pill.id === 'all') {
      setIsLoadingTracks(true);
      fetch('/api/music/discover')
        .then((res) => res.json())
        .then((data) => {
          if (data?.tracks?.length) {
            setTracks(data.tracks);
            if (data.vibe) setVibeMessage(data.vibe);
          }
        })
        .finally(() => setIsLoadingTracks(false));
      return;
    }

    if (pill.query) {
      setSearchInput(pill.label);
      handleSearchSubmit(undefined, pill.query);
    }
  };

  const safeLikedTrackIds = useMemo(() => {
    return Array.isArray(likedTrackIds) ? likedTrackIds : [];
  }, [likedTrackIds]);

  const safeTracks = useMemo(() => {
    return Array.isArray(tracks) ? tracks : [];
  }, [tracks]);

  const displayedTracks = useMemo(() => {
    if (activeTab === 'liked') {
      return safeTracks.filter((t) => t && safeLikedTrackIds.includes(t.id));
    }
    return safeTracks;
  }, [safeTracks, activeTab, safeLikedTrackIds]);

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] text-zinc-100 select-none overflow-hidden font-sans">
      
      {/* Persistent HTML5 Audio Element (Zero YouTube iframe embeds, unblocked raw audio extraction) */}
      {currentTrack?.videoId && (
        <audio
          ref={audioRef}
          key={`html5-raw-audio-${currentTrack.videoId}`}
          src={`/api/music/stream?id=${currentTrack.videoId}`}
          onPlay={() => {
            if (mediaMode === 'audio') setIsPlaying(true);
          }}
          onPause={() => {
            if (mediaMode === 'audio') setIsPlaying(false);
          }}
          onEnded={() => {
            if (isRepeat) {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              }
            } else {
              handleNextTrack();
            }
          }}
          onTimeUpdate={(e) => {
            if (mediaMode === 'audio') {
              const target = e.currentTarget;
              if (!isNaN(target.currentTime)) {
                setCurrentTime(target.currentTime);
              }
            }
          }}
          className="hidden"
        />
      )}

      {/* Top Header & Search Area - 24px Container Padding */}
      <header className="p-6 border-b border-zinc-800/60 bg-[#0f1015]/90 backdrop-blur-md shrink-0">
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* Header Title & Empathic Friend Voice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-amber-500 shadow-sm">
                <Disc3 className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-zinc-100">music</h1>
                <p className="text-xs text-zinc-400 font-medium">
                  {vibeMessage}
                </p>
              </div>
            </div>

            {/* Filter Tabs - Self-Contained Pills */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center bg-zinc-900/90 p-1 rounded-full border border-zinc-800/80 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  discover
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('liked')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                    activeTab === 'liked'
                      ? 'bg-zinc-800 text-amber-500 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${(safeLikedTrackIds?.length ?? 0) > 0 ? 'fill-current' : ''}`} />
                  <span>saved ({safeLikedTrackIds?.length ?? 0})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Unified Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="search any song, artist, or paste a link..."
                className="w-full bg-zinc-900/70 hover:bg-zinc-900 focus:bg-zinc-900 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 rounded-2xl pl-11 pr-10 py-3 border border-zinc-800/80 focus:border-amber-500/60 focus:outline-none transition-all shadow-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchInput.trim()}
              className="px-5 py-3 bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-bold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer shadow-md shrink-0 flex items-center gap-2"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>play</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                const url = searchInput.trim();
                if(!url) return alert('Please enter a URL');
                setStatusMessage('Processing MP3 download...');
                try {
                  const response = await fetch('/api/music/cherri-download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                  });
                  const data = await response.json();
                  setStatusMessage(data.error ? `Error: ${data.error}` : "Download finished on server!");
                } catch (err) {
                  setStatusMessage("Could not connect to backend server.");
                }
              }}
              className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all cursor-pointer shadow-md shrink-0 flex items-center gap-2"
            >
              <span>MP3</span>
            </button>
          </form>

          {/* Quick Genre Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            {GENRE_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => handlePillClick(pill)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  activeGenreFilter === pill.id
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700 shadow-sm'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {statusMessage && (
            <p className="text-xs text-amber-500 font-medium">
              {statusMessage}
            </p>
          )}

        </div>
      </header>

      {/* Main Content Area - 24px Container Padding */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Active Player Card with YTMusic Song / Video Switcher */}
          {currentTrack && (
            <div className="bg-zinc-900/70 border border-zinc-800/70 rounded-3xl p-6 shadow-xl space-y-5">
              
              {/* Top Row: Mode Switcher (Song | Video) like YouTube Music */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`} />
                  <span className="text-xs font-bold text-zinc-300">
                    {mediaMode === 'audio' ? 'now listening' : 'now watching'}
                  </span>
                </div>

                {/* The YouTube Music Pill Switcher: Song | Video */}
                <div className="flex items-center bg-zinc-950/80 p-1 rounded-full border border-zinc-800/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setMediaMode('audio')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                      mediaMode === 'audio'
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Music2 className="w-3.5 h-3.5" />
                    <span>Song</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode('video')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                      mediaMode === 'video'
                        ? 'bg-zinc-800 text-amber-500 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video</span>
                  </button>
                </div>
              </div>

              {/* Mode 1: Song Mode (Audio Only - Editorial Asymmetric Split Card) */}
              {mediaMode === 'audio' ? (
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-1">
                  
                  {/* Left: High-Res Album Art with 16px border-radius */}
                  <div className="relative group shrink-0">
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl object-cover shadow-2xl bg-zinc-950 border border-zinc-800/80"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop&q=80';
                      }}
                    />
                    
                    {/* Animated Equalizer Wave Overlay when playing */}
                    {isPlaying && (
                      <div className="absolute bottom-3 right-3 flex items-end gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10">
                        <span className="w-1 bg-amber-500 h-3 animate-pulse rounded-full" />
                        <span className="w-1 bg-amber-500 h-4.5 animate-pulse rounded-full delay-75" />
                        <span className="w-1 bg-amber-500 h-2.5 animate-pulse rounded-full delay-150" />
                        <span className="w-1 bg-amber-500 h-4 animate-pulse rounded-full delay-100" />
                      </div>
                    )}
                  </div>

                  {/* Right: Typography Hierarchy & Metadata Pills */}
                  <div className="flex-1 min-w-0 space-y-4 text-center sm:text-left w-full">
                    <div className="space-y-1.5">
                      <h2 className="text-lg sm:text-xl font-extrabold text-zinc-100 truncate tracking-tight">
                        {currentTrack.title}
                      </h2>
                      <p className="text-sm text-zinc-400 font-medium truncate">
                        {currentTrack.artist}
                      </p>
                    </div>

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs font-semibold text-zinc-300">
                        {formatSeconds(duration)}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs font-semibold text-zinc-300">
                        audio stream
                      </span>
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-500">
                        youtube music
                      </span>
                    </div>

                    {/* Scrubbable Progress Bar */}
                    <div className="space-y-1.5 pt-2">
                      <div 
                        className="relative h-2 bg-zinc-800 rounded-full cursor-pointer overflow-hidden group"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const ratio = clickX / rect.width;
                          seekTo(ratio * duration);
                        }}
                      >
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all duration-150 group-hover:bg-amber-400"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                        <span>{formatSeconds(currentTime)}</span>
                        <span>{formatSeconds(duration)}</span>
                      </div>
                    </div>

                    {/* Inline Control Buttons */}
                    <div className="flex items-center justify-center sm:justify-start gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsShuffle((prev) => !prev)}
                        className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                          isShuffle ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-200'
                        }`}
                        title="shuffle"
                      >
                        <Shuffle className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handlePrevTrack}
                        className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                        title="previous"
                      >
                        <SkipBack className="w-5 h-5 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={togglePlay}
                        className="p-4 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                        title={isPlaying ? 'pause' : 'play'}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current translate-x-0.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleNextTrack}
                        className="p-2.5 rounded-full text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                        title="next"
                      >
                        <SkipForward className="w-5 h-5 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsRepeat((prev) => !prev)}
                        className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                          isRepeat ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-200'
                        }`}
                        title="repeat"
                      >
                        <Repeat className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleLike(currentTrack.id)}
                        className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                          safeLikedTrackIds.includes(currentTrack.id)
                            ? 'text-amber-500 bg-amber-500/10'
                            : 'text-zinc-500 hover:text-zinc-200'
                        }`}
                        title="save track"
                      >
                        <Heart className={`w-4 h-4 ${safeLikedTrackIds.includes(currentTrack.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                  </div>
                </div>
               ) : (
                /* Mode 2: Video Mode (Native HTML5 Video - Powered by yt-dlp & InnerTube video streams, Zero YouTube/Invidious iframe embeds!) */
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 px-3.5 py-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-semibold text-zinc-300">Native Video Player (yt-dlp stream)</span>
                    </div>
                    <a
                      href={`https://www.youtube.com/watch?v=${currentTrack.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-zinc-200 p-1 transition-colors flex items-center gap-1"
                      title="Open on YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>YouTube</span>
                    </a>
                  </div>

                  <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-zinc-800 flex items-center justify-center">
                    <iframe
                      src={`https://invidious.nerdvpn.de/embed/${currentTrack.videoId}?autoplay=1`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video player"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="truncate">
                      <h2 className="text-base font-extrabold text-zinc-100 truncate">
                        {currentTrack.title}
                      </h2>
                      <p className="text-xs text-zinc-400 font-medium truncate">
                        {currentTrack.artist}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleLike(currentTrack.id)}
                      className={`p-2 rounded-full cursor-pointer transition-colors ${
                        safeLikedTrackIds.includes(currentTrack.id) ? 'text-amber-500' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${safeLikedTrackIds.includes(currentTrack.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Track Collection Header */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h3 className="text-base font-extrabold text-zinc-100">
                {activeTab === 'liked' ? 'your collection' : 'recommended tracks'}
              </h3>
              <p className="text-xs text-zinc-400">
                {displayedTracks?.length ?? 0} tracks available
              </p>
            </div>
          </div>

          {/* Track List - 2-Column Split Cards with 16px Interior Padding */}
          {isLoadingTracks ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-400 font-medium">finding tracks for you...</p>
            </div>
          ) : (displayedTracks?.length ?? 0) === 0 ? (
            <div className="py-20 text-center space-y-2 bg-zinc-900/30 rounded-3xl border border-zinc-800/40 p-8">
              <p className="text-sm font-bold text-zinc-300">
                {activeTab === 'liked' ? 'no saved tracks yet' : 'no tracks found'}
              </p>
              <p className="text-xs text-zinc-500">
                {activeTab === 'liked' 
                  ? 'tap the heart on any song to save it.' 
                  : 'try a search above or tap any vibe chip.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayedTracks.map((track, i) => {
                const isCurrent = currentTrack?.id === track.id;
                const isLiked = safeLikedTrackIds.includes(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track)}
                    className={`group relative flex items-center justify-between gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-zinc-800/90 border-zinc-700 shadow-md'
                        : 'bg-zinc-900/50 hover:bg-zinc-900/90 border-zinc-800/70 hover:border-zinc-700/80'
                    }`}
                  >
                    {/* Left: 16px Border-Radius Thumbnail */}
                    <div className="relative shrink-0">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="w-16 h-16 rounded-2xl object-cover shadow-sm bg-zinc-950 border border-zinc-800/80"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&h=120&fit=crop&q=80';
                        }}
                      />
                      
                      {/* Hover / Current Play Overlay */}
                      <div className={`absolute inset-0 rounded-2xl flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity ${
                        isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {isCurrent && isPlaying ? (
                          <div className="flex items-end gap-0.5 h-3">
                            <span className="w-1 bg-amber-500 h-3 animate-pulse rounded-full" />
                            <span className="w-1 bg-amber-500 h-4 animate-pulse rounded-full delay-75" />
                            <span className="w-1 bg-amber-500 h-2 animate-pulse rounded-full delay-150" />
                          </div>
                        ) : (
                          <Play className="w-5 h-5 fill-current text-white translate-x-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Middle: Heavy Typography & Metadata Pill */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className={`text-sm font-bold truncate ${isCurrent ? 'text-amber-400' : 'text-zinc-100'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-zinc-400 font-medium truncate">
                        {track.artist}
                      </p>
                      
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/90 text-[10px] font-semibold text-zinc-400">
                          {formatSeconds(track.duration)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800/60 text-[10px] font-medium text-zinc-500">
                          audio
                        </span>
                      </div>
                    </div>

                    {/* Right: Like Button */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track.id);
                        }}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          isLiked ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500 hover:text-zinc-200'
                        }`}
                        title={isLiked ? 'unlike' : 'save'}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          <div className="h-28" />
        </div>
      </main>

      {/* Persistent Bottom Bar - 16px Interior Padding */}
      <footer className="bg-[#101116] border-t border-zinc-800/80 px-6 py-3.5 flex items-center justify-between gap-4 z-30 shrink-0">
        
        {/* Left: Current Track Thumbnail & Info */}
        <div className="flex items-center gap-3 w-1/3 min-w-[150px] max-w-[280px]">
          {currentTrack ? (
            <>
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-sm bg-zinc-950 border border-zinc-800"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&h=80&fit=crop&q=80';
                }}
              />
              <div className="truncate min-w-0">
                <p className="text-xs font-bold text-zinc-100 truncate">
                  {currentTrack.title}
                </p>
                <p className="text-[11px] text-zinc-400 font-medium truncate">
                  {currentTrack.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleLike(currentTrack.id)}
                className={`p-1.5 transition-colors cursor-pointer shrink-0 hidden sm:block ${
                  safeLikedTrackIds.includes(currentTrack.id) ? 'text-amber-500' : 'text-zinc-500 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${safeLikedTrackIds.includes(currentTrack.id) ? 'fill-current' : ''}`} />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5 text-zinc-500">
              <Disc3 className="w-5 h-5" />
              <span className="text-xs font-medium">choose a track</span>
            </div>
          )}
        </div>

        {/* Center: Play Controls & Seeker */}
        <div className="flex flex-col items-center gap-1 flex-1 max-w-lg">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsShuffle((prev) => !prev)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                isShuffle ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title="shuffle"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handlePrevTrack}
              disabled={!currentTrack}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="previous"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={!currentTrack}
              className="p-2.5 rounded-full bg-zinc-100 hover:bg-white disabled:opacity-30 text-zinc-950 font-bold transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md"
              title={isPlaying ? 'pause' : 'play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNextTrack}
              disabled={!currentTrack}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="next"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => setIsRepeat((prev) => !prev)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer hidden sm:block ${
                isRepeat ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title="repeat"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Seeker Slider */}
          <div className="w-full flex items-center gap-2 text-[10px] font-mono text-zinc-500">
            <span className="w-7 text-right">{formatSeconds(currentTime)}</span>
            <div
              className="relative flex-1 h-1.5 bg-zinc-800 rounded-full cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = clickX / rect.width;
                seekTo(ratio * duration);
              }}
            >
              <div
                className="h-full bg-zinc-300 group-hover:bg-amber-500 rounded-full transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="w-7">{formatSeconds(duration)}</span>
          </div>
        </div>

        {/* Right: Song/Video Pill & Volume */}
        <div className="flex items-center justify-end gap-3 w-1/3 min-w-[120px] max-w-[240px]">
          {/* Quick Song/Video toggle pill in footer */}
          <button
            type="button"
            onClick={() => setMediaMode((prev) => (prev === 'audio' ? 'video' : 'audio'))}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer hidden sm:flex items-center gap-1.5 ${
              mediaMode === 'video'
                ? 'bg-zinc-800 text-amber-500 border-zinc-700'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="toggle video / audio"
          >
            {mediaMode === 'video' ? <Video className="w-3.5 h-3.5" /> : <Music2 className="w-3.5 h-3.5" />}
            <span>{mediaMode === 'video' ? 'video' : 'song'}</span>
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="text-zinc-400 hover:text-zinc-100 p-1 cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              ) : volume < 50 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 sm:w-20 h-1 bg-zinc-800 accent-amber-500 rounded-lg cursor-pointer"
            />
          </div>
        </div>

      </footer>

    </div>
  );
};
