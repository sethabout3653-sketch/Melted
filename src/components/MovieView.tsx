import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Film, Tv, Search, Star, Play, Sparkles, X, Server, ChevronDown } from 'lucide-react';
import { tmdbService, TMDBMedia, getPosterUrl, getBackdropUrl } from '../services/tmdbService';
import { entryVariants, containerVariants } from '../utils/animations';

interface MovieServer {
  id: string;
  name: string;
  domain: string;
  getMovieUrl: (id: number) => string;
  getTVUrl: (id: number, season: number, episode: number) => string;
}

interface MovieViewProps {
  onActiveMediaChange?: (info: { title: string; mediaType: 'movie' | 'tv'; season?: number; episode?: number } | null) => void;
}

const MOVIE_SERVERS: MovieServer[] = [
  { id: 'sethsrc', name: 'Sethsrc (Native Engine)', domain: 'sethsrc', getMovieUrl: id => `/embed/movie/${id}`, getTVUrl: (id, s, e) => `/embed/tv/${id}/${s}/${e}` },
  { id: 'vidlink', name: 'VidLink', domain: 'vidlink.pro', getMovieUrl: id => `https://vidlink.pro/movie/${id}`, getTVUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { id: 'autoembed', name: 'AutoEmbed', domain: 'player.autoembed.cc', getMovieUrl: id => `https://player.autoembed.cc/embed/movie/${id}`, getTVUrl: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { id: 'vidcore', name: 'Vidcore', domain: 'vidcore.io', getMovieUrl: id => `https://vidcore.io/movie/${id}`, getTVUrl: (id, s, e) => `https://vidcore.io/tv/${id}/${s}/${e}` },
  { id: 'xpass', name: 'XPass', domain: 'play.xpass.top', getMovieUrl: id => `https://play.xpass.top/e/movie/${id}?autostart=false`, getTVUrl: (id, s, e) => `https://play.xpass.top/e/tv/${id}/${s}/${e}?autostart=false` },
];

type CatalogTab = 'all' | 'movies' | 'tv';

export const MovieView: React.FC<MovieViewProps> = ({ onActiveMediaChange }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [featuredItem, setFeaturedItem] = useState<TMDBMedia | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<TMDBMedia | null>(null);
  const [serverIndex, setServerIndex] = useState(0);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const activeServer = MOVIE_SERVERS[serverIndex] || MOVIE_SERVERS[0];
  const isPlayerOpen = selectedMedia !== null;

  const handleClosePlayer = () => {
    setSelectedMedia(null);
  };

  // Reset pagination on tab or query change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setItems([]);
  }, [activeTab, query]);

  useEffect(() => {
    if (!selectedMedia) {
      onActiveMediaChange?.(null);
      return;
    }
    const type = selectedMedia.media_type || (selectedMedia.first_air_date ? 'tv' : 'movie');
    const isTV = type === 'tv';
    onActiveMediaChange?.({
      title: selectedMedia.title || selectedMedia.name || 'Untitled',
      mediaType: isTV ? 'tv' : 'movie',
      season: isTV ? season : undefined,
      episode: isTV ? episode : undefined,
    });
  }, [selectedMedia, season, episode, onActiveMediaChange]);

  useEffect(() => {
    if (!isPlayerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClosePlayer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlayerOpen]);

  // Main catalog loading effect
  useEffect(() => {
    if (query.trim()) return;

    let cancelled = false;
    if (page === 1) setIsLoading(true);
    else setIsMoreLoading(true);

    const loadCatalog = async () => {
      try {
        const results = activeTab === 'all'
          ? await tmdbService.getTrending('all', 'week', page)
          : activeTab === 'movies'
            ? await tmdbService.getPopularMovies(page)
            : await tmdbService.getPopularTV(page);
            
        if (cancelled) return;
        
        if (page === 1) {
          setItems(results);
          setFeaturedItem(results[0] || null);
        } else {
          setItems(prev => {
            const next = [...prev, ...results];
            // Deduplicate to prevent key errors
            const seen = new Set();
            return next.filter(item => {
              const key = `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          });
        }
        
        if (results.length < 20) {
          setHasMore(false);
        }
      } catch (error) {
        console.error('Failed to load movie catalogue:', error);
        if (!cancelled) {
          if (page === 1) {
            setItems([]);
            setFeaturedItem(null);
          }
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsMoreLoading(false);
        }
      }
    };
    loadCatalog();
    return () => { cancelled = true; };
  }, [activeTab, page, query]);

  // Search effect
  useEffect(() => {
    if (!query.trim()) return;
    
    let cancelled = false;
    if (page === 1) setSearchLoading(true);
    else setIsMoreLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const results = await tmdbService.searchMulti(query, page);
        if (!cancelled) {
          if (page === 1) {
            setItems(results);
          } else {
            setItems(prev => {
              const next = [...prev, ...results];
              const seen = new Set();
              return next.filter(item => {
                const key = `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            });
          }
          if (results.length < 20) {
            setHasMore(false);
          }
        }
      } catch (error) {
        console.error('Movie search failed:', error);
        if (!cancelled) setHasMore(false);
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
          setIsMoreLoading(false);
        }
      }
    }, page === 1 ? 350 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isMoreLoading && !searchLoading) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, isMoreLoading, searchLoading]);

  const playerUrl = useMemo(() => {
    if (!selectedMedia) return '';
    const isTV = selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date;
    return isTV
      ? activeServer.getTVUrl(selectedMedia.id, season, episode)
      : activeServer.getMovieUrl(selectedMedia.id);
  }, [selectedMedia, activeServer, season, episode]);

  const [tvDetails, setTvDetails] = useState<{ number_of_seasons?: number; seasons?: { season_number: number; episode_count: number }[] } | null>(null);

  const selectMedia = async (media: TMDBMedia) => {
    setSeason(1);
    setEpisode(1);
    setServerIndex(0);
    setSelectedMedia(media);
    setTvDetails(null);

    const isTV = media.media_type === 'tv' || !!media.first_air_date;
    if (isTV) {
      try {
        const details = await tmdbService.getTVDetails(media.id);
        setTvDetails(details);
      } catch (err) {
        console.warn('Failed to fetch TV details for accurate seasons/episodes:', err);
      }
    }
  };

  const totalSeasons = tvDetails?.number_of_seasons || (selectedMedia?.number_of_seasons ?? 5);
  
  // Calculate accurate episode count for the currently selected season
  const currentSeasonEpisodes = useMemo(() => {
    if (tvDetails?.seasons && Array.isArray(tvDetails.seasons)) {
      const match = tvDetails.seasons.find(s => s.season_number === season);
      if (match && match.episode_count) {
        return match.episode_count;
      }
    }
    return 24; // Default fallback per season
  }, [tvDetails, season]);

  const tabButton = (tab: CatalogTab, label: string, Icon: typeof Film) => (
    <button
      key={tab}
      type="button"
      onClick={() => { 
        setActiveTab(tab); 
        setQuery(''); 
      }}
      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
    >
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-28">
      {!isPlayerOpen && <>
        <header className="sticky top-20 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav aria-label="Movie categories" className="flex items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
              {tabButton('all', 'Trending', Sparkles)}
              {tabButton('movies', 'Movies', Film)}
              {tabButton('tv', 'TV Shows', Tv)}
            </nav>
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                value={query} 
                onChange={event => {
                  setQuery(event.target.value);
                }} 
                placeholder="Search movies and TV shows..." 
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm" 
              />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-28 w-full space-y-10">
          {!query && featuredItem && !isLoading && page === 1 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full h-[340px] sm:h-[440px] rounded-3xl overflow-hidden shadow-2xl group">
              <img src={getBackdropUrl(featuredItem.backdrop_path)} alt={featuredItem.title || featuredItem.name || 'Featured'} className="w-full h-full object-cover brightness-75 group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-6 sm:p-10 space-y-3 text-white">
                <span className="bg-cyan-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg w-fit">Featured {featuredItem.media_type === 'tv' ? 'Series' : 'Movie'}</span>
                <div className="flex items-center gap-2 text-amber-300"><Star className="w-4 h-4 fill-current" /><span>{featuredItem.vote_average?.toFixed(1) || '—'}</span></div>
                <h1 className="text-3xl sm:text-4xl font-black text-white">{featuredItem.title || featuredItem.name}</h1>
                <p className="text-sm text-slate-200 line-clamp-2 max-w-2xl">{featuredItem.overview}</p>
                <button type="button" onClick={() => selectMedia(featuredItem)} className="bg-cyan-500 hover:bg-cyan-400 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 w-fit"><Play className="w-4 h-4 fill-current" />Watch Now</button>
              </div>
            </motion.section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Film className="w-5 h-5 text-cyan-500" />
                {query ? `Search Results for “${query}”` : activeTab === 'all' ? 'Trending Titles' : activeTab === 'movies' ? 'Popular Movies' : 'Popular Series'}
              </h2>
              <span className="text-xs text-slate-500">{items.length} titles</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {items.map((item) => (
                <button 
                  key={`${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`} 
                  type="button"
                  onClick={() => selectMedia(item)} 
                  className="text-left bg-[#14141d] rounded-2xl overflow-hidden border border-[#222232] hover:border-[#00f0ff] hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all duration-200 transform-gpu hover:-translate-y-1 group cursor-pointer"
                >
                  <div className="relative aspect-[2/3] bg-[#0d0d12]">
                    <img 
                      src={getPosterUrl(item.poster_path)} 
                      alt={item.title || item.name || 'Title poster'} 
                      loading="lazy" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out" 
                    />
                    <span className="absolute top-2 left-2 bg-[#0d0d12]/90 text-[#00f0ff] text-[9px] font-bold px-2 py-0.5 rounded-md border border-[#00f0ff]/30">
                      {item.media_type === 'tv' || item.first_air_date ? 'TV' : 'MOVIE'}
                    </span>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-xl bg-[#00f0ff] text-[#090d16] flex items-center justify-center shadow-xl transform scale-95 group-hover:scale-100 transition-transform duration-200">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-bold text-white group-hover:text-[#00f0ff] transition-colors truncate">{item.title || item.name}</h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ''}</p>
                  </div>
                </button>
              ))}
              
              {(isLoading || searchLoading) && Array.from({ length: 12 }, (_, index) => <div key={index} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-900" />)}
              
              {isMoreLoading && Array.from({ length: 6 }, (_, index) => <div key={`more-${index}`} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-900" />)}
            </div>

            {items.length === 0 && !isLoading && !searchLoading && (
                <div className="text-center py-16 text-slate-500">No movies or TV shows found.</div>
            )}

            <div ref={observerTarget} className="h-20 w-full flex items-center justify-center">
                {isMoreLoading && <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-sm animate-spin" />}
            </div>
          </section>
        </main>
      </>}

      {isPlayerOpen && selectedMedia && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black flex flex-col h-[100dvh] w-[100dvw] overflow-hidden select-none">
          {/* Iframe Viewport */}
          <div className="relative flex-1 bg-black w-full h-full">
            <iframe 
              key={`${selectedMedia.id}-${season}-${episode}-${serverIndex}`} 
              src={playerUrl} 
              title={selectedMedia.title || selectedMedia.name || 'Media player'} 
              className="w-full h-full border-0" 
              allowFullScreen 
              allow="autoplay; encrypted-media; picture-in-picture" 
            />
          </div>

          {/* Top Control Bar */}
          <div className="absolute top-0 inset-x-0 z-30 px-4 py-3 bg-[#090d16]/95 backdrop-blur-xl border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Close Button & Title Lockup */}
            <div className="flex items-center gap-3 min-w-0">
              <button 
                type="button" 
                onClick={handleClosePlayer} 
                aria-label="Close player" 
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="hidden sm:flex items-center shrink-0">
                <img 
                  src="/assets/aistudio/Screenshot_2026-11-04_190053-removebg-preview_82d6e6a3.png" 
                  alt="FrostHub" 
                  className="h-7 w-auto object-contain"
                />
              </div>

              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-xs">
                  {selectedMedia.title || selectedMedia.name}
                </h1>
                {(selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date) && (
                  <p className="text-[10px] text-[#00f0ff] font-extrabold uppercase tracking-wider">
                    Season {season} · Episode {episode}
                  </p>
                )}
              </div>
            </div>

            {/* Center: Season & Episode Switcher Dropdowns */}
            {(selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date) && (
              <div className="flex items-center gap-2 bg-[#181824] p-1.5 rounded-xl border border-[#2a2a3c]">
                {/* Season Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">Season</span>
                  <select
                    value={season}
                    onChange={(e) => {
                      setSeason(Number(e.target.value));
                      setEpisode(1); // Reset to ep 1 when season changes
                    }}
                    className="bg-[#090d16] text-[#00f0ff] font-black text-xs px-2.5 py-1 rounded-lg border border-[#2a2a3c] focus:border-[#00f0ff] focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: Math.max(1, totalSeasons) }, (_, i) => i + 1).map((s) => (
                      <option key={s} value={s}>Season {s}</option>
                    ))}
                  </select>
                </div>

                <div className="w-px h-4 bg-[#2a2a3c]" />

                {/* Episode Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">Episode</span>
                  <select
                    value={episode}
                    onChange={(e) => setEpisode(Number(e.target.value))}
                    className="bg-[#090d16] text-[#00f0ff] font-black text-xs px-2.5 py-1 rounded-lg border border-[#2a2a3c] focus:border-[#00f0ff] focus:outline-none cursor-pointer"
                  >
                    {Array.from({ length: Math.max(1, currentSeasonEpisodes) }, (_, i) => i + 1).map((ep) => (
                      <option key={ep} value={ep}>Ep {ep}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Right: Server Selector Dropdown */}
            <div className="relative shrink-0">
              <button 
                type="button" 
                onClick={() => setServerMenuOpen(open => !open)} 
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 border border-white/10 transition-colors cursor-pointer"
              >
                <Server className="w-4 h-4 text-[#00f0ff]" />
                <span>{activeServer.name}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              <AnimatePresence>
                {serverMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 8 }} 
                    className="absolute right-0 mt-2 w-44 bg-[#14141d] border border-white/15 rounded-xl p-1.5 z-30 shadow-2xl"
                  >
                    <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">Streaming Source</div>
                    {MOVIE_SERVERS.map((server, index) => (
                      <button 
                        key={server.id} 
                        type="button" 
                        onClick={() => { setServerIndex(index); setServerMenuOpen(false); }} 
                        className={`w-full text-left text-xs p-2 rounded-lg transition-colors cursor-pointer ${
                          serverIndex === index ? 'bg-[#00f0ff] text-slate-950 font-extrabold' : 'text-white hover:bg-white/10'
                        }`}
                      >
                        {server.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};
