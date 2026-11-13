import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Film, Tv, Search, Star, Play, Sparkles, X, Server, ChevronDown, Info } from 'lucide-react';
import { tmdbService, TMDBMedia, getPosterUrl, getBackdropUrl } from '../services/tmdbService';

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
  { id: 'vidsrc', name: 'VidSrc (Recommended)', domain: 'vidsrc.mov', getMovieUrl: id => `https://vidsrc.mov/embed/movie/${id}`, getTVUrl: (id, season, episode) => `https://vidsrc.mov/embed/tv/${id}/${season}/${episode}` },
  { id: 'xpass', name: 'XPass', domain: 'play.xpass.top', getMovieUrl: id => `https://play.xpass.top/e/movie/${id}?autostart=false`, getTVUrl: (id, season, episode) => `https://play.xpass.top/e/tv/${id}/${season}/${episode}?autostart=false` },
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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tvDetails, setTvDetails] = useState<{ number_of_seasons?: number; seasons?: { season_number: number; episode_count: number }[] } | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const activeServer = MOVIE_SERVERS[serverIndex] || MOVIE_SERVERS[0];
  const isPlayerOpen = selectedMedia !== null;

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setItems([]);
    setFeaturedItem(null);
  }, [activeTab, query]);

  useEffect(() => {
    if (!selectedMedia) {
      onActiveMediaChange?.(null);
      return;
    }
    const isTV = selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date;
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
      if (event.key === 'Escape') setSelectedMedia(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlayerOpen]);

  useEffect(() => {
    if (query.trim()) return;
    let cancelled = false;
    if (page === 1) setIsLoading(true);
    else setIsMoreLoading(true);

    const loadCatalog = async () => {
      try {
        const results = activeTab === 'all'
          ? await tmdbService.getTrending('movie', 'week', page)
          : activeTab === 'movies'
            ? await tmdbService.getPopularMovies(page)
            : await tmdbService.getPopularTV(page);
        if (cancelled) return;
        if (page === 1) {
          setItems(results);
          setFeaturedItem(activeTab === 'all' ? results[0] || null : null);
        } else {
          setItems(previous => {
            const seen = new Set(previous.map(item => `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`));
            return [...previous, ...results].filter(item => {
              const key = `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          });
        }
        if (results.length < 20) setHasMore(false);
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
    void loadCatalog();
    return () => { cancelled = true; };
  }, [activeTab, page, query]);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    if (page === 1) setSearchLoading(true);
    else setIsMoreLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await tmdbService.searchMulti(query, page);
        if (!cancelled) {
          if (page === 1) setItems(results);
          else {
            setItems(previous => {
              const seen = new Set(previous.map(item => `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`));
              return [...previous, ...results].filter(item => {
                const key = `${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            });
          }
          if (results.length < 20) setHasMore(false);
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

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading && !isMoreLoading && !searchLoading) {
        setPage(previous => previous + 1);
      }
    }, { threshold: 0.1 });
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isMoreLoading, searchLoading]);

  const playerUrl = useMemo(() => {
    if (!selectedMedia) return '';
    const isTV = selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date;
    return isTV
      ? activeServer.getTVUrl(selectedMedia.id, season, episode)
      : activeServer.getMovieUrl(selectedMedia.id);
  }, [selectedMedia, activeServer, season, episode]);

  const selectMedia = async (media: TMDBMedia) => {
    setSeason(1);
    setEpisode(1);
    setServerIndex(0);
    setSelectedMedia(media);
    setTvDetails(null);
    if (media.media_type === 'tv' || media.first_air_date) {
      try {
        setTvDetails(await tmdbService.getTVDetails(media.id));
      } catch (error) {
        console.warn('Failed to load TV details:', error);
      }
    }
  };

  const totalSeasons = tvDetails?.number_of_seasons || selectedMedia?.number_of_seasons || 5;
  const episodeCount = tvDetails?.seasons?.find(item => item.season_number === season)?.episode_count || 24;
  const featuredHeroMovie = !query && activeTab === 'all' ? featuredItem : null;
  const tabs: { id: CatalogTab; label: string; Icon: typeof Film }[] = [
    { id: 'all', label: 'Trending', Icon: Sparkles },
    { id: 'movies', label: 'Movies', Icon: Film },
    { id: 'tv', label: 'TV Shows', Icon: Tv },
  ];

  const handleNextEpisode = () => {
    if (episode < episodeCount) {
      setEpisode((e) => e + 1);
    } else if (season < totalSeasons) {
      setSeason((s) => s + 1);
      setEpisode(1);
    }
  };

  const handlePrevEpisode = () => {
    if (episode > 1) {
      setEpisode((e) => e - 1);
    } else if (season > 1) {
      const prevSeason = season - 1;
      const prevCount = tvDetails?.seasons?.find(item => item.season_number === prevSeason)?.episode_count || 24;
      setSeason(prevSeason);
      setEpisode(Math.max(1, prevCount));
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#08090b] text-white flex flex-col font-sans pb-28">
      {!isPlayerOpen && <>
        <header className="relative z-30 bg-[#08090b] border-b border-white/10 px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav aria-label="Movie categories" className="flex items-center gap-2 overflow-x-auto max-w-full scrollbar-none">
              {tabs.map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => { setActiveTab(id); setQuery(''); }} className={`px-4 sm:px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${activeTab === id ? 'bg-[var(--brand-blue)] text-white' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>
                  <Icon className="inline w-4 h-4 mr-2" />{label}
                </button>
              ))}
            </nav>
            <div className="relative w-full sm:w-[22rem]">
              <Search className="w-4 h-4 text-white/60 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies and TV shows..." className="w-full bg-white/5 border border-white/10 rounded-full pl-11 pr-10 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-white/30" />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="w-full">
          {!query && featuredHeroMovie && !isLoading && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full h-[400px] sm:h-[500px] md:h-[580px] overflow-hidden">
              <img src={getBackdropUrl(featuredHeroMovie.backdrop_path)} alt={featuredHeroMovie.title || featuredHeroMovie.name || 'Featured'} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#08090b] via-black/70 to-black/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-transparent to-black/20" />
              <div className="relative z-10 flex h-full items-end max-w-7xl mx-auto px-6 sm:px-10 pb-10 sm:pb-14">
                <div className="max-w-3xl">
                  <h1 className="text-3xl sm:text-5xl lg:text-[4.5rem] font-black uppercase tracking-[-0.04em] leading-[0.95] max-w-2xl">{featuredHeroMovie.title || featuredHeroMovie.name}</h1>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
                    {featuredHeroMovie.vote_average !== undefined && <span className="inline-flex items-center gap-1 text-amber-400 tabular-nums"><Star className="w-4 h-4 fill-current" />{featuredHeroMovie.vote_average.toFixed(1)}</span>}
                    {featuredHeroMovie.release_date && <span className="tabular-nums">{featuredHeroMovie.release_date.slice(0, 4)}</span>}
                    <span className="text-white/40">•</span><span>Movie</span>
                  </div>
                  {featuredHeroMovie.overview && <p className="mt-4 max-w-xl text-sm sm:text-base text-white/75 leading-relaxed line-clamp-3">{featuredHeroMovie.overview}</p>}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void selectMedia(featuredHeroMovie)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-7 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-[var(--brand-blue-hover)] cursor-pointer"><Play className="w-4 h-4 fill-current" />Play Now</button>
                    <button type="button" onClick={() => void selectMedia(featuredHeroMovie)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-white/20 cursor-pointer"><Info className="w-4 h-4" />Episodes & Sources</button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          <section className="max-w-7xl mx-auto px-4 sm:px-8 space-y-4 py-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><Film className="w-5 h-5 text-[var(--brand-blue)]" />{query ? `Search Results for “${query}”` : activeTab === 'all' ? 'Trending' : activeTab === 'movies' ? 'Movies' : 'Popular Series'}</h2>
              <span className="text-xs text-white/50 tabular-nums">{items.length} titles</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
              {items.map(item => (
                <button key={`${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`} type="button" onClick={() => void selectMedia(item)} className="group text-left bg-[#141519] rounded-xl overflow-hidden border border-white/10 hover:border-white/40 transition-colors cursor-pointer">
                  <div className="relative aspect-[2/3] bg-slate-900">
                    <img src={getPosterUrl(item.poster_path)} alt={item.title || item.name || 'Title poster'} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute top-2 left-2 bg-black/80 text-white text-[9px] font-bold px-2 py-0.5 rounded">{item.media_type === 'tv' || item.first_air_date ? 'TV' : 'MOVIE'}</span>
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-8 h-8 text-[var(--brand-blue)] fill-current" /></span>
                  </div>
                  <div className="p-3"><h3 className="text-xs font-bold text-white truncate">{item.title || item.name}</h3><p className="text-[10px] text-white/50 mt-1 tabular-nums">{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ''}</p></div>
                </button>
              ))}
              {(isLoading || searchLoading) && Array.from({ length: 12 }, (_, index) => <div key={`loading-${index}`} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />)}
              {isMoreLoading && Array.from({ length: 6 }, (_, index) => <div key={`more-${index}`} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />)}
            </div>
            {items.length === 0 && !isLoading && !searchLoading && <div className="text-center py-16 text-white/50">No movies or TV shows found.</div>}
            <div ref={observerTarget} className="h-20 w-full flex items-center justify-center">{isMoreLoading && <div className="w-6 h-6 border-2 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin" />}</div>
          </section>
        </main>
      </>}

      {isPlayerOpen && selectedMedia && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black flex flex-col h-[100dvh] w-[100dvw] overflow-hidden select-none">
          <div className="px-4 py-3 bg-[#090d16] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" onClick={() => setSelectedMedia(null)} aria-label="Close player" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white truncate">{selectedMedia.title || selectedMedia.name}</h1>
                {(selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date) && <p className="text-[11px] text-[var(--brand-blue)] font-bold tabular-nums">Season {season} · Episode {episode}</p>}
              </div>
            </div>
            {(selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date) && (
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={handlePrevEpisode} disabled={season === 1 && episode === 1} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold text-white cursor-pointer">Prev</button>
                <label className="text-xs text-white flex items-center gap-1">S <select value={season} onChange={event => { setSeason(Number(event.target.value)); setEpisode(1); }} className="bg-slate-900 text-[var(--brand-blue)] rounded px-2 py-1">{Array.from({ length: Math.max(1, totalSeasons) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
                <label className="text-xs text-white flex items-center gap-1">E <select value={episode} onChange={event => setEpisode(Number(event.target.value))} className="bg-slate-900 text-[var(--brand-blue)] rounded px-2 py-1">{Array.from({ length: Math.max(1, episodeCount) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
                <button type="button" onClick={handleNextEpisode} disabled={season === totalSeasons && episode === episodeCount} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold text-white cursor-pointer">Next</button>
              </div>
            )}
            <div className="relative">
              <button type="button" onClick={() => setServerMenuOpen(open => !open)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"><Server className="w-4 h-4 text-[var(--brand-blue)]" /><span>{activeServer.name}</span><ChevronDown className="w-3.5 h-3.5" /></button>
              <AnimatePresence>{serverMenuOpen && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-2 w-52 bg-[#14141d] border border-white/15 rounded-xl p-1.5 z-40 shadow-2xl"><div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">Streaming Source</div>{MOVIE_SERVERS.map((server, index) => <button key={server.id} type="button" onClick={() => { setServerIndex(index); setServerMenuOpen(false); }} className={`w-full text-left text-xs p-2 rounded-lg cursor-pointer ${serverIndex === index ? 'bg-[var(--brand-blue)] text-slate-950 font-extrabold' : 'text-white hover:bg-white/10'}`}>{server.name}</button>)}</motion.div>}</AnimatePresence>
            </div>
          </div>
          <div className="relative flex-1 bg-black w-full min-h-0"><iframe key={`${selectedMedia.id}-${season}-${episode}-${serverIndex}`} src={playerUrl} title={selectedMedia.title || selectedMedia.name || 'Media player'} className="w-full h-full border-0" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" /></div>
        </div>, document.body
      )}
    </div>
  );
};