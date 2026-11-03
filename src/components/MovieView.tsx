import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Film, 
  Tv, 
  Search, 
  Star, 
  Play, 
  RotateCw, 
  Sparkles, 
  X,
  Server,
  ChevronDown,
  Snowflake,
  BookmarkCheck,
  History,
  Clock,
  Trash2
} from 'lucide-react';
import { tmdbService, TMDBMedia, TMDBEpisode, getPosterUrl, getBackdropUrl, fetchContentRating } from '../services/tmdbService';
import { 
  ContinueWatchingEntry, 
  getContinueWatchingList, 
  saveContinueWatchingEntry, 
  removeContinueWatchingEntry,
  formatDuration 
} from '../utils/watchTracker';

interface MovieServer {
  id: string;
  name: string;
  domain: string;
  badge?: string;
  getMovieUrl: (tmdbId: number) => string;
  getTVUrl: (tmdbId: number, season: number, episode: number) => string;
}

interface MovieViewProps {
  onActiveMediaChange?: (info: { title: string; mediaType: 'movie' | 'tv'; season?: number; episode?: number } | null) => void;
}

// MOVIE SERVERS LIST - VidSrc is first (Recommended server used first time)
const MOVIE_SERVERS: MovieServer[] = [
  {
    id: 'vidsrc-to',
    name: 'VidSrc',
    domain: 'vidsrc.to',
    badge: 'Recommended',
    getMovieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidcore',
    name: 'Vidcore',
    domain: 'vidcore.io',
    badge: 'Fast',
    getMovieUrl: (id) => `https://vidcore.io/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidcore.io/tv/${id}/${s}/${e}`,
  },
  {
    id: 'xpass',
    name: 'XPass',
    domain: 'play.xpass.top',
    badge: 'Fast',
    getMovieUrl: (id) => `https://play.xpass.top/e/movie/${id}?autostart=false`,
    getTVUrl: (id, s, e) => `https://play.xpass.top/e/tv/${id}/${s}/${e}?autostart=false`,
  },
  {
    id: 'vidy',
    name: 'Vidy',
    domain: 'vidy.st',
    badge: 'Pro',
    getMovieUrl: (id) => `https://www.vidy.st/movie/${id}?color=DC2626`,
    getTVUrl: (id, s, e) => `https://www.vidy.st/tv/${id}/${s}/${e}?color=DC2626&nextEpisode=true&episodeSelector=true`,
  },
  {
    id: 'vidly',
    name: 'Vidly',
    domain: 'vidly.pro',
    badge: 'HD',
    getMovieUrl: (id) => `https://vidly.pro/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidly.pro/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'embedsu',
    name: 'EmbedSu',
    domain: 'embed.su',
    badge: 'Multi-Sub',
    getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrc-me',
    name: 'VidSrc.me',
    domain: 'vidsrc.me',
    getMovieUrl: (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
    getTVUrl: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    id: 'autoembed',
    name: 'AutoEmbed',
    domain: 'player.autoembed.cc',
    getMovieUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: '2embed',
    name: '2Embed',
    domain: '2embed.cc',
    getMovieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    getTVUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  }
];

export const MovieView: React.FC<MovieViewProps> = ({ onActiveMediaChange }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'tv' | 'continue'>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [featuredItem, setFeaturedItem] = useState<TMDBMedia | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Continue Watching List State
  const [continueWatchingList, setContinueWatchingList] = useState<ContinueWatchingEntry[]>(() => getContinueWatchingList());

  // ... (inside the component's rendered JSX for tabs)
  
  // Update Tab Click Handlers
  const handleTabChange = (tab: 'all' | 'movies' | 'tv' | 'continue') => {
    setActiveTab(tab);
    setQuery(''); // Reset search query when switching tabs
  };

  // Selected Item for Theater / Detail
  const [selectedMedia, setSelectedMedia] = useState<TMDBMedia | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [activeServerIndex, setActiveServerIndex] = useState<number>(0); // Index 0 = Vidcore
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false);
  
  // TV Season & Episode state
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [loadErrorTimeout, setLoadErrorTimeout] = useState(false);

  // Real-time watch tracking refs
  const watchProgressRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(7200); // Default 2 hours
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Controls auto-hide
  const [showTopBar, setShowTopBar] = useState(true);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const activeServer = MOVIE_SERVERS[activeServerIndex] || MOVIE_SERVERS[0];

  // Notify parent app & chat activity tracker of currently playing media
  useEffect(() => {
    if (isPlayerOpen && selectedMedia) {
      const isTV = selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date;
      onActiveMediaChange?.({
        title: selectedMedia.title || selectedMedia.name || 'Untitled',
        mediaType: isTV ? 'tv' : 'movie',
        season: isTV ? selectedSeason : undefined,
        episode: isTV ? selectedEpisode : undefined
      });
    } else {
      onActiveMediaChange?.(null);
    }
  }, [isPlayerOpen, selectedMedia, selectedSeason, selectedEpisode, onActiveMediaChange]);

  // Prevent background body scrolling when player is open
  useEffect(() => {
    if (isPlayerOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isPlayerOpen]);

  // Event-driven real-time watch tracker listening to embed player postMessage events
  useEffect(() => {
    if (!isPlayerOpen || !selectedMedia) return;

    // Send periodic time query pings to embed iframe
    const pingIframe = () => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          iframeRef.current.contentWindow.postMessage({ action: 'get_time' }, '*');
          iframeRef.current.contentWindow.postMessage({ type: 'get_time' }, '*');
          iframeRef.current.contentWindow.postMessage('ping', '*');
        } catch {}
      }
    };

    const pingInterval = setInterval(pingIframe, 2000);

    // Listen for real player iframe messages from all embed providers (Vidcore, XPass, Vidy, Vidly, etc.)
    const handleMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch {}
        }

        if (data) {
          const time = typeof data === 'number' ? data : (
            data.currentTime ?? 
            data.time ?? 
            data.progress ?? 
            data.seconds ?? 
            data.position ?? 
            data.data?.time ?? 
            data.data?.currentTime ?? 
            data.detail?.currentTime ?? 
            data.detail?.time ??
            (data.event === 'timeupdate' ? data.data : undefined)
          );

          const dur = data.duration ?? data.totalTime ?? data.data?.duration ?? data.detail?.duration;

          if (typeof time === 'number' && !isNaN(time) && time >= 0) {
            const prog = Math.floor(time);
            watchProgressRef.current = prog;

            if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
              totalDurationRef.current = Math.floor(dur);
            }

            const currentDur = totalDurationRef.current || 7200;
            const pct = Math.min(Math.max(Math.round((prog / currentDur) * 100), 1), 99);
            const isTV = selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date;

            const entry: ContinueWatchingEntry = {
              id: selectedMedia.id,
              title: selectedMedia.title || selectedMedia.name || 'Untitled',
              posterPath: selectedMedia.poster_path,
              backdropPath: selectedMedia.backdrop_path,
              mediaType: isTV ? 'tv' : 'movie',
              season: isTV ? selectedSeason : undefined,
              episode: isTV ? selectedEpisode : undefined,
              progressSeconds: prog,
              durationSeconds: currentDur,
              percentage: pct,
              lastWatchedAt: Date.now(),
              serverName: activeServer.name
            };

            const updated = saveContinueWatchingEntry(entry);
            setContinueWatchingList(updated);
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('message', handleMessage);
    };
  }, [isPlayerOpen, selectedMedia, selectedSeason, selectedEpisode, activeServer.name]);

  // Auto-hide top bar on mouse idle
  const handleMouseMove = () => {
    setShowTopBar(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlayerOpen && !isServerDropdownOpen) {
        setShowTopBar(false);
      }
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, []);

  // Pagination State for unlimited title browsing
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Close player safely and instantly sync Continue Watching list
  const handleClosePlayer = () => {
    saveCurrentWatchState();
    setContinueWatchingList(getContinueWatchingList());
    if (iframeRef.current) {
      try { iframeRef.current.src = 'about:blank'; } catch {}
    }
    setIsPlayerOpen(false);
  };

  // Load Initial Catalog
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setPage(1);
    setHasMore(true);

    const loadCatalog = async () => {
      try {
        let results: TMDBMedia[] = [];
        if (activeTab === 'continue') {
            results = continueWatchingList.map(entry => ({
                id: entry.id,
                title: entry.title,
                overview: '',
                poster_path: entry.posterPath,
                backdrop_path: entry.backdropPath,
                media_type: entry.mediaType,
                vote_average: 0,
                vote_count: 0
            }));
            setHasMore(false);
        } else if (activeTab === 'all') {
          results = await tmdbService.getTrending('all', 'week', 1);
        } else if (activeTab === 'movies') {
          results = await tmdbService.getPopularMovies(1);
        } else {
          results = await tmdbService.getPopularTV(1);
        }

        if (!isMounted) return;
        setItems(results);
        if (results.length > 0) {
          setFeaturedItem(results[0]);
        }
      } catch (err) {
        console.error('Failed to fetch TMDB catalogue:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Handle Search Input
  useEffect(() => {
    if (!query.trim()) return;
    setPage(1);
    setHasMore(true);

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await tmdbService.searchMulti(query, 1);
        setItems(results);
      } catch (err) {
        console.error('Search TMDB error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Load More Titles for endless browsing
  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      let nextResults: TMDBMedia[] = [];
      if (query.trim()) {
        nextResults = await tmdbService.searchMulti(query, nextPage);
      } else if (activeTab === 'all') {
        nextResults = await tmdbService.getTrending('all', 'week', nextPage);
      } else if (activeTab === 'movies') {
        nextResults = await tmdbService.getPopularMovies(nextPage);
      } else {
        nextResults = await tmdbService.getPopularTV(nextPage);
      }

      if (nextResults.length > 0) {
        setItems(prev => {
          const existingIds = new Set(prev.map(i => i.id));
          const filtered = nextResults.filter(i => !existingIds.has(i.id));
          return [...prev, ...filtered];
        });
        setPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more titles:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Content Ratings Map (MPAA / TV ratings like PG, PG-13, R, G, TV-MA, TV-14, etc.)
  const [ratingsMap, setRatingsMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!items || items.length === 0) return;
    let isMounted = true;

    const loadRatings = async () => {
      const updatedRatings: Record<number, string> = { ...ratingsMap };
      const missingItems = items.filter(i => !updatedRatings[i.id]);
      if (missingItems.length === 0) return;

      const fetchPromises = missingItems.map(async (item) => {
        const type = item.media_type === 'tv' || !!item.first_air_date ? 'tv' : 'movie';
        const rating = await fetchContentRating(item.id, type);
        updatedRatings[item.id] = rating;
      });

      await Promise.all(fetchPromises);
      if (isMounted) {
        setRatingsMap({ ...updatedRatings });
      }
    };

    loadRatings();
    return () => {
      isMounted = false;
    };
  }, [items]);

  // Watchdog timeout for server response
  useEffect(() => {
    if (isIframeLoading && isPlayerOpen) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoadErrorTimeout(false);

      timeoutRef.current = setTimeout(() => {
        setLoadErrorTimeout(true);
      }, 8000);
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoadErrorTimeout(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isIframeLoading, activeServerIndex, isPlayerOpen, selectedSeason, selectedEpisode]);

  // Auto-persist active state to Continue Watching in localStorage
  const saveCurrentWatchState = (overrideMedia?: TMDBMedia | null, overrideS?: number, overrideE?: number) => {
    const targetMedia = overrideMedia !== undefined ? overrideMedia : selectedMedia;
    if (!targetMedia) return;

    const isTV = targetMedia.media_type === 'tv' || !!targetMedia.first_air_date;
    const activeS = overrideS ?? selectedSeason;
    const activeE = overrideE ?? selectedEpisode;
    const prog = watchProgressRef.current || 0;
    const dur = totalDurationRef.current || (isTV ? 2700 : 7200);
    const pct = Math.min(Math.max(Math.round((prog / dur) * 100), 1), 99);

    const entry: ContinueWatchingEntry = {
      id: targetMedia.id,
      title: targetMedia.title || targetMedia.name || 'Untitled',
      posterPath: targetMedia.poster_path,
      backdropPath: targetMedia.backdrop_path,
      mediaType: isTV ? 'tv' : 'movie',
      season: isTV ? activeS : undefined,
      episode: isTV ? activeE : undefined,
      progressSeconds: prog,
      durationSeconds: dur,
      percentage: pct,
      lastWatchedAt: Date.now(),
      serverName: activeServer.name
    };

    const updated = saveContinueWatchingEntry(entry);
    setContinueWatchingList(updated);
  };

  // Sync state to localStorage whenever player is active
  useEffect(() => {
    if (isPlayerOpen && selectedMedia) {
      saveCurrentWatchState();
    }
  }, [isPlayerOpen, selectedMedia, selectedSeason, selectedEpisode, activeServerIndex]);

  // Persist state on page reload / tab close
  useEffect(() => {
    const handleUnload = () => {
      if (isPlayerOpen && selectedMedia) {
        saveCurrentWatchState();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isPlayerOpen, selectedMedia, selectedSeason, selectedEpisode, activeServerIndex]);

  // Handle Opening Media Player / Details
  const handleSelectMedia = async (media: TMDBMedia) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setSelectedMedia(media);
    setFeaturedItem(media);
    setIsPlayerOpen(true);
    setIsIframeLoading(true);
    setActiveServerIndex(0); // Default to Vidcore (Recommended)
    setLoadErrorTimeout(false);
    setShowTopBar(true);

    // Initialize watch duration estimate & progress
    const existingEntry = continueWatchingList.find(c => c.id === media.id);
    watchProgressRef.current = existingEntry ? existingEntry.progressSeconds : 0;
    totalDurationRef.current = media.runtime ? media.runtime * 60 : (media.media_type === 'tv' || !!media.first_air_date ? 2700 : 7200);

    const isTV = media.media_type === 'tv' || !!media.first_air_date;
    const initialSeason = existingEntry?.season || 1;
    const initialEpisode = existingEntry?.episode || 1;
    setSelectedSeason(initialSeason);
    setSelectedEpisode(initialEpisode);

    // Immediately persist to Continue Watching
    saveCurrentWatchState(media, initialSeason, initialEpisode);

    // Fetch full details if available
    try {
      if (isTV) {
        const details = await tmdbService.getTVDetails(media.id);
        setSelectedMedia(details);
        if (details.seasons && details.seasons.length > 0) {
          const seasonExists = details.seasons.some(s => s.season_number === initialSeason);
          const activeS = seasonExists ? initialSeason : (details.seasons.find(s => s.season_number > 0)?.season_number || 1);
          setSelectedSeason(activeS);
          loadSeasonEpisodes(media.id, activeS);
          saveCurrentWatchState(details, activeS, initialEpisode);
        }
      } else {
        const details = await tmdbService.getMovieDetails(media.id);
        setSelectedMedia(details);
        if (details.runtime) {
          totalDurationRef.current = details.runtime * 60;
        }
        saveCurrentWatchState(details, undefined, undefined);
      }
    } catch (e) {
      console.warn('Failed to load deep details:', e);
    }
  };

  // Resume from Continue Watching
  const handleResumeWatching = (entry: ContinueWatchingEntry) => {
    const matchedMedia: TMDBMedia = {
      id: entry.id,
      title: entry.mediaType === 'movie' ? entry.title : undefined,
      name: entry.mediaType === 'tv' ? entry.title : undefined,
      overview: '',
      poster_path: entry.posterPath,
      backdrop_path: entry.backdropPath,
      media_type: entry.mediaType,
      vote_average: 8.5,
      vote_count: 100
    };
    handleSelectMedia(matchedMedia);
  };

  const handleRemoveFromContinueWatching = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const updated = removeContinueWatchingEntry(id);
    setContinueWatchingList(updated);
  };

  const loadSeasonEpisodes = async (tvId: number, seasonNum: number) => {
    try {
      const data = await tmdbService.getTVSeason(tvId, seasonNum);
      setEpisodes(data.episodes || []);
    } catch (err) {
      console.warn('Failed to load episodes:', err);
      setEpisodes([]);
    }
  };

  // Switch Season
  const handleSeasonChange = (sNum: number) => {
    setSelectedSeason(sNum);
    setSelectedEpisode(1);
    setIsIframeLoading(true);
    saveCurrentWatchState(selectedMedia, sNum, 1);
    if (selectedMedia) {
      loadSeasonEpisodes(selectedMedia.id, sNum);
    }
  };

  // Switch Episode
  const handleEpisodeChange = (epNum: number) => {
    setSelectedEpisode(epNum);
    setIsIframeLoading(true);
    setLoadErrorTimeout(false);
    saveCurrentWatchState(selectedMedia, selectedSeason, epNum);
  };

  // Try Next Server
  const handleTryNextServer = () => {
    const nextIndex = (activeServerIndex + 1) % MOVIE_SERVERS.length;
    setActiveServerIndex(nextIndex);
    setIsIframeLoading(true);
    setLoadErrorTimeout(false);
  };

  // Calculate current embed URL
  const currentEmbedUrl = useMemo(() => {
    if (!selectedMedia) return '';
    const isTV = selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date;
    if (isTV) {
      return activeServer.getTVUrl(selectedMedia.id, selectedSeason, selectedEpisode);
    }
    return activeServer.getMovieUrl(selectedMedia.id);
  }, [selectedMedia, activeServer, selectedSeason, selectedEpisode]);

  const handleRestart = () => {
    setIsIframeLoading(true);
    setLoadErrorTimeout(false);
    watchProgressRef.current = 0;
    if (iframeRef.current) {
      iframeRef.current.src = currentEmbedUrl;
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-28 transition-colors selection:bg-blue-600 selection:text-white">
      
      {/* CATALOG & NAVIGATION VIEW - COMPLETELY HIDDEN WHEN WATCHING AN EMBED */}
      {!isPlayerOpen && (
        <>
          {/* Sticky Header Bar */}
          <div className="sticky top-20 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-8 py-4 shadow-sm transition-colors">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Category Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleTabChange('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Trending</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('movies')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'movies' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Movies</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('tv')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'tv' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>TV Shows</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('continue')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'continue' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Continue</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search movies, TV shows, actors..."
                  className="w-full bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Catalog Container */}
          <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-28 w-full space-y-12">
            
            {/* REAL-TIME CONTINUE WATCHING SECTION */}
            {!query && continueWatchingList.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 font-heading">
                    <History className="w-5 h-5 text-blue-600 dark:text-blue-500 animate-pulse" />
                    <span>Continue Watching</span>
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Real-time Embed Watch Tracker
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {continueWatchingList.map((entry) => (
                    <motion.div
                      key={`continue-${entry.id}`}
                      whileHover={{ y: -4, scale: 1.01 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                      onClick={() => handleResumeWatching(entry)}
                      className="bg-white dark:bg-slate-900/90 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 shadow-md hover:shadow-xl cursor-pointer group flex flex-col justify-between relative transition-all"
                    >
                      {/* Image & Overlay Progress Bar */}
                      <div className="relative aspect-video overflow-hidden bg-slate-950">
                        <img
                          src={getBackdropUrl(entry.backdropPath) || getPosterUrl(entry.posterPath)}
                          alt={entry.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-90"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/50 transform scale-90 group-hover:scale-100 transition-transform">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Delete Entry Button */}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveFromContinueWatching(e, entry.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer shadow-md"
                          title="Remove from Continue Watching"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                          <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-md">
                            {entry.mediaType === 'tv' ? `S${entry.season} E${entry.episode}` : 'Movie'}
                          </span>
                        </div>

                        {/* Progress Bar at bottom of image */}
                        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-800/80 overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-300 rounded-r-full shadow-[0_0_10px_#3b82f6]"
                            style={{ width: `${Math.max(entry.percentage, 3)}%` }}
                          />
                        </div>
                      </div>

                      {/* Info Footer displaying exact formatted watched time (e.g. 18m 24s watched) */}
                      <div className="p-3.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {entry.title}
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-blue-500" />
                            <span>{formatDuration(entry.progressSeconds)} watched • {entry.percentage}%</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[11px] font-extrabold border border-blue-100 dark:border-blue-800 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"
                        >
                          Resume
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Featured Banner (When no search query) */}
            {!query && featuredItem && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative w-full h-[360px] sm:h-[440px] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800/80 group"
              >
                <img
                  src={getBackdropUrl(featuredItem.backdrop_path)}
                  alt={featuredItem.title || featuredItem.name}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-90 dark:brightness-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-6 sm:p-10 space-y-3 text-white">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider border border-blue-400/30 shadow-lg">
                      Featured #{featuredItem.media_type === 'tv' ? 'Series' : 'Movie'}
                    </span>
                    <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-md border border-amber-500/30">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{featuredItem.vote_average ? featuredItem.vote_average.toFixed(1) : '8.5'}</span>
                      </div>
                      <span className="text-amber-500/60 font-normal">|</span>
                      <span className="text-amber-200 font-extrabold uppercase text-[10px] tracking-wider">
                        {ratingsMap[featuredItem.id] || (featuredItem.media_type === 'tv' || featuredItem.first_air_date ? 'TV-14' : 'PG-13')}
                      </span>
                    </div>
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight line-clamp-1 font-heading">
                    {featuredItem.title || featuredItem.name}
                  </h1>

                  <p className="text-xs sm:text-sm text-slate-200 dark:text-slate-300 line-clamp-2 max-w-2xl leading-relaxed">
                    {featuredItem.overview}
                  </p>

                  <div className="pt-2 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleSelectMedia(featuredItem)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-blue-600/30 hover:scale-105 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Watch Now</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Catalog Grid Section */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 font-heading">
                  <Film className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  <span>{query ? `Search Results for "${query}"` : activeTab === 'all' ? 'Trending Titles' : activeTab === 'movies' ? 'Popular Movies' : 'Popular Series'}</span>
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {items.length} titles available
                </span>
              </div>

              {isLoading || searchLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <div key={idx} className="bg-slate-200 dark:bg-slate-900/60 h-64 rounded-2xl animate-pulse border border-slate-300 dark:border-slate-800/40" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-20 bg-slate-100 dark:bg-slate-900/30 rounded-3xl border border-slate-200 dark:border-slate-800/50 space-y-3">
                  <Film className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto" />
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">No movies or TV shows found</p>
                  <p className="text-xs text-slate-400 dark:text-slate-600">Try searching for a different title or keyword</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5 pt-1">
                  {items.map((item) => {
                    const history = continueWatchingList.find(c => c.id === item.id);
                    return (
                      <motion.div
                        key={`${item.id}-${item.media_type || 'movie'}`}
                        whileHover={{ y: -6, scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        onClick={() => handleSelectMedia(item)}
                        className="bg-white dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 shadow-md hover:shadow-xl cursor-pointer group flex flex-col justify-between relative transition-all"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden bg-slate-100 dark:bg-slate-950 rounded-t-2xl">
                          <img
                            src={getPosterUrl(item.poster_path)}
                            alt={item.title || item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/40 transform scale-75 group-hover:scale-100 transition-transform">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                          </div>
                          {item.vote_average > 0 && (
                            <div className="absolute top-2.5 right-2.5 bg-slate-950/85 backdrop-blur-md text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-800 flex items-center gap-1.5 shadow-md z-10">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-current" />
                                <span>{item.vote_average.toFixed(1)}</span>
                              </div>
                              <span className="text-slate-600 dark:text-slate-500 font-normal">|</span>
                              <span className="text-slate-100 dark:text-slate-200 font-black uppercase text-[9px] tracking-wide">
                                {ratingsMap[item.id] || (item.media_type === 'tv' || item.first_air_date ? 'TV-14' : 'PG-13')}
                              </span>
                            </div>
                          )}
                          <div className="absolute top-2.5 left-2.5 bg-slate-950/80 backdrop-blur-md text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-800 uppercase z-10">
                            {item.media_type === 'tv' || item.first_air_date ? 'TV' : 'Movie'}
                          </div>

                          {/* Saved Watch Badge */}
                          {history && (
                            <div className="absolute bottom-2.5 left-2.5 bg-blue-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-md border border-blue-400/40 backdrop-blur-md flex items-center gap-1 shadow-md z-10">
                              <BookmarkCheck className="w-3 h-3" />
                              <span>S{history.season} E{history.episode}</span>
                            </div>
                          )}
                        </div>

                        <div className="p-3.5">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.title || item.name}
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            {item.release_date ? item.release_date.split('-')[0] : item.first_air_date ? item.first_air_date.split('-')[0] : '2025'}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Load More Titles Button for Unlimited Browsing */}
              {hasMore && items.length > 0 && (
                <div className="pt-8 flex justify-center pb-6">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 border border-blue-400/30"
                  >
                    {loadingMore ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Loading More Titles...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Load More Titles ({items.length} Loaded)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* FULL-VIEWPORT CINEMATIC THEATER PLAYER - PORTALED DIRECTLY TO BODY FOR 100% UNTRUNCATED SCREEN FIT */}
      {isPlayerOpen && selectedMedia && createPortal(
        <AnimatePresence>
          <motion.div
            ref={playerContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseMove={handleMouseMove}
            className="fixed inset-0 z-[999999] bg-black flex flex-col h-[100dvh] w-[100dvw] overflow-hidden select-none"
            style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}
          >
            {/* Embed Stream Iframe - Fits 100% of screen without truncation */}
            <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden">
              
              {/* Center Loading Spinner when initializing */}
              {isIframeLoading && (
                <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin flex items-center justify-center">
                    <Play className="w-6 h-6 text-blue-400 fill-current ml-1 animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-black text-white uppercase tracking-widest font-heading">
                      Loading Stream...
                    </p>
                    <p className="text-xs text-slate-500">
                      Connecting to {activeServer.name} ({activeServer.domain})
                    </p>
                  </div>

                  {loadErrorTimeout && (
                    <button
                      type="button"
                      onClick={handleTryNextServer}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-xl transition-all cursor-pointer"
                    >
                      Try Next Server →
                    </button>
                  )}
                </div>
              )}

              <iframe
                key={`${activeServer.id}-${selectedMedia.id}-${selectedSeason}-${selectedEpisode}`}
                ref={iframeRef}
                src={currentEmbedUrl}
                title={selectedMedia.title || selectedMedia.name}
                className="w-full h-full border-0 relative z-0 object-cover"
                allowFullScreen
                allow="autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope"
                onLoad={() => {
                  setIsIframeLoading(false);
                  setLoadErrorTimeout(false);
                }}
              />
            </div>

            {/* TOP OVERLAY BAR - PERMANENT SOLID BLACK BAR */}
            <div className="absolute top-0 inset-x-0 z-20 px-4 sm:px-6 py-3.5 bg-black border-b border-white/10 shadow-2xl flex items-center justify-between opacity-100">
              
              {/* TOP LEFT: Close (X) Button + App Brand Badge + Title */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <button
                  type="button"
                  onClick={handleClosePlayer}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 backdrop-blur-md transition-all cursor-pointer shrink-0 shadow-lg"
                  title="Close Player"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* FROSTED App Brand Pill Badge */}
                <div className="flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-black tracking-widest px-2.5 py-1 rounded-lg uppercase shadow-md font-heading border border-blue-400/30 shrink-0">
                  <Snowflake className="w-3.5 h-3.5 fill-none" />
                  <span>FROSTED</span>
                </div>

                <h1 className="text-sm sm:text-base font-black text-white tracking-wide uppercase truncate max-w-xs sm:max-w-md font-heading">
                  {selectedMedia.title || selectedMedia.name}
                </h1>
              </div>

              {/* TOP RIGHT: Restart Button + Server Dropdown + Season/Episode Pickers */}
              <div className="flex items-center gap-3 shrink-0">
                
                {/* Restart Button */}
                <button
                  type="button"
                  onClick={handleRestart}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                  title="Restart Stream"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Restart</span>
                </button>

                {/* Server Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsServerDropdownOpen(!isServerDropdownOpen)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                  >
                    <Server className="w-3.5 h-3.5 text-blue-400" />
                    <span>{activeServer.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  </button>

                  {/* Server Dropdown Floating Menu */}
                  <AnimatePresence>
                    {isServerDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-slate-900/95 border border-white/15 backdrop-blur-2xl rounded-2xl p-2 shadow-2xl z-40 space-y-1"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-white/10">
                          Select Stream Server
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                          {MOVIE_SERVERS.map((server, idx) => {
                            const isSelected = activeServerIndex === idx;
                            return (
                              <button
                                key={server.id}
                                type="button"
                                onClick={() => {
                                  if (iframeRef.current) {
                                    try { iframeRef.current.src = 'about:blank'; } catch {}
                                  }
                                  setActiveServerIndex(idx);
                                  setIsServerDropdownOpen(false);
                                  setIsIframeLoading(true);
                                  setLoadErrorTimeout(false);
                                }}
                                className={`w-full px-3 py-2 text-xs font-bold text-left rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white font-black shadow-md'
                                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span>{server.name}</span>
                                {server.badge && (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-white/15 text-slate-300'
                                  }`}>
                                    {server.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* TV Series Season & Episode Picker */}
                {(selectedMedia.media_type === 'tv' || selectedMedia.first_air_date || (selectedMedia.seasons && selectedMedia.seasons.length > 0)) && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSeason}
                      onChange={(e) => handleSeasonChange(Number(e.target.value))}
                      className="bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-2 backdrop-blur-md focus:outline-none cursor-pointer"
                    >
                      {selectedMedia.seasons
                        ?.filter(s => s.season_number > 0)
                        .map(s => (
                          <option key={s.id} value={s.season_number} className="bg-slate-900 text-white">
                            Season {s.season_number}
                          </option>
                        ))}
                    </select>

                    {episodes.length > 0 && (
                      <select
                        value={selectedEpisode}
                        onChange={(e) => handleEpisodeChange(Number(e.target.value))}
                        className="bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold rounded-xl px-3 py-2 backdrop-blur-md focus:outline-none cursor-pointer"
                      >
                        {episodes.map(ep => (
                          <option key={ep.id} value={ep.episode_number} className="bg-slate-900 text-white">
                            Episode {ep.episode_number}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

            </div>

          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
