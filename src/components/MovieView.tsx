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
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const MOVIE_SERVERS: MovieServer[] = [
  { id: 'vidsrc', name: 'VidSrc (Recommended)', domain: 'vidsrc.mov', getMovieUrl: id => `https://vidsrc.mov/embed/movie/${id}`, getTVUrl: (id, season, episode) => `https://vidsrc.mov/embed/tv/${id}/${season}/${episode}` },
  { id: 'xpass', name: 'XPass', domain: 'play.xpass.top', getMovieUrl: id => `https://play.xpass.top/e/movie/${id}?autostart=false`, getTVUrl: (id, season, episode) => `https://play.xpass.top/e/tv/${id}/${season}/${episode}?autostart=false` },
];

type CatalogTab = 'all' | 'movies' | 'tv';

export const MovieView: React.FC<MovieViewProps> = ({ onActiveMediaChange, searchQuery, onSearchChange }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>('all');
  const [internalQuery, setInternalQuery] = useState('');
  const query = searchQuery ?? internalQuery;
  const setQuery = onSearchChange ?? setInternalQuery;
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
    if (!query.trim()) {
      setSearchLoading(false);
      return;
    }
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
    <div className="w-full min-h-full bg-slate-50 dark:bg-[#08090b] text-slate-900 dark:text-white flex flex-col font-sans pb-8 lg:pb-12">
      {!isPlayerOpen && <>
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#08090b]/95 border-b border-slate-200 dark:border-white/10 px-3 sm:px-8 py-3 sm:py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
            <nav aria-label="Movie categories" className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full w-full sm:w-auto scrollbar-none">
              {tabs.map(({ id, label, Icon }) => (
                <button key={id} type="button" onClick={() => { setActiveTab(id); setQuery(''); }} className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeTab === id ? 'bg-[var(--brand-blue)] text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-white/75 dark:hover:text-white dark:hover:bg-white/10'}`}>
                  <Icon className="inline w-4 h-4 mr-1.5 sm:mr-2" />{label}
                </button>
              ))}
            </nav>
            <div className="relative w-full sm:w-[22rem]">
              <Search className="w-4 h-4 text-slate-400 dark:text-white/60 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies and TV shows..." className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full pl-11 pr-10 py-2 sm:py-2.5 text-base sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/50 focus:outline-none focus:border-slate-400 dark:focus:border-white/30" />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-900 dark:text-white/60 dark:hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="w-full">
          {!query && featuredHeroMovie && !isLoading && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full h-[340px] sm:h-[480px] md:h-[560px] overflow-hidden">
              <img src={getBackdropUrl(featuredHeroMovie.backdrop_path)} alt={featuredHeroMovie.title || featuredHeroMovie.name || 'Featured'} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#08090b] via-black/75 to-black/25" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-transparent to-black/25" />
              <div className="relative z-10 flex h-full items-end max-w-7xl mx-auto px-4 sm:px-10 pb-6 sm:pb-14">
                <div className="max-w-3xl">
                  <h1 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] leading-[1.02] max-w-2xl text-white">{featuredHeroMovie.title || featuredHeroMovie.name}</h1>
                  <div className="mt-2.5 sm:mt-4 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/80">
                    {featuredHeroMovie.vote_average !== undefined && <span className="inline-flex items-center gap-1 text-amber-400 tabular-nums"><Star className="w-4 h-4 fill-current" />{featuredHeroMovie.vote_average.toFixed(1)}</span>}
                    {featuredHeroMovie.release_date && <span className="tabular-nums">{featuredHeroMovie.release_date.slice(0, 4)}</span>}
                    <span className="text-white/40">•</span><span>Movie</span>
                  </div>
                  {featuredHeroMovie.overview && <p className="mt-2.5 sm:mt-4 max-w-xl text-xs sm:text-base text-white/75 leading-relaxed line-clamp-2 sm:line-clamp-3">{featuredHeroMovie.overview}</p>}
                  <div className="mt-4 sm:mt-6 flex flex-wrap gap-2.5 sm:gap-3">
                    <button type="button" onClick={() => void selectMedia(featuredHeroMovie)} className="press inline-flex items-center gap-2 rounded-xl bg-[var(--brand-blue)] px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-[var(--brand-blue-hover)] cursor-pointer"><Play className="w-4 h-4 fill-current" />Play now</button>
                    <button type="button" onClick={() => void selectMedia(featuredHeroMovie)} className="press inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 cursor-pointer"><Info className="w-4 h-4" />More info</button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          <section className="max-w-7xl mx-auto px-3 sm:px-8 space-y-4 py-5 sm:py-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2"><Film className="w-5 h-5 text-[var(--brand-blue)]" />{query ? `Search Results for “${query}”` : activeTab === 'all' ? 'Trending' : activeTab === 'movies' ? 'Movies' : 'Popular Series'}</h2>
              <span className="text-xs text-slate-500 dark:text-white/50 tabular-nums">{items.length} titles</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-5">
              {items.map(item => (
                <button key={`${item.id}-${item.media_type || (item.title ? 'movie' : 'tv')}`} type="button" onClick={() => void selectMedia(item)} className="press group text-left bg-white dark:bg-[#141519] rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/40 hover:-translate-y-0.5 transition-[transform,border-color] duration-200 cursor-pointer">
                  <div className="relative aspect-[2/3] bg-slate-200 dark:bg-slate-900">
                    <img src={getPosterUrl(item.poster_path)} alt={item.title || item.name || 'Title poster'} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute top-2 left-2 bg-black/80 text-white text-[9px] font-bold px-2 py-0.5 rounded">{item.media_type === 'tv' || item.first_air_date ? 'TV' : 'MOVIE'}</span>
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-8 h-8 text-[var(--brand-blue)] fill-current" /></span>
                  </div>
                  <div className="p-2.5 sm:p-3"><h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.title || item.name}</h3><p className="text-[10px] text-slate-500 dark:text-white/50 mt-0.5 tabular-nums">{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ''}</p></div>
                </button>
              ))}
              {(isLoading || searchLoading) && Array.from({ length: 12 }, (_, index) => <div key={`loading-${index}`} className="aspect-[2/3] rounded-xl bg-slate-200 dark:bg-white/5 animate-pulse" />)}
              {isMoreLoading && Array.from({ length: 6 }, (_, index) => <div key={`more-${index}`} className="aspect-[2/3] rounded-xl bg-slate-200 dark:bg-white/5 animate-pulse" />)}
            </div>
            {items.length === 0 && !isLoading && !searchLoading && <div className="text-center py-16 text-sm text-slate-500 dark:text-white/50">Nothing found. Try a different title or browse another tab.</div>}
            <div ref={observerTarget} className="h-20 w-full flex items-center justify-center">{isMoreLoading && <div className="w-6 h-6 border-2 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin" />}</div>
          </section>
        </main>
      </>}

      {isPlayerOpen && selectedMedia && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black flex flex-col h-[100dvh] w-[100dvw] overflow-hidden select-none">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 pt-[max(0.625rem,env(safe-area-inset-top))] bg-white dark:bg-[#090d16] border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0 z-30">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
              <button type="button" onClick={() => setSelectedMedia(null)} aria-label="Close player" className="min-w-[40px] min-h-[40px] w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white flex items-center justify-center cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedMedia.title || selectedMedia.name}</h1>
                {(selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date) && <p className="text-[11px] text-[var(--brand-blue)] font-bold tabular-nums">Season {season} · Episode {episode}</p>}
              </div>
            </div>
            <div className="relative shrink-0 sm:order-3">
              <button type="button" onClick={() => setServerMenuOpen(open => !open)} className="min-h-[38px] px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white text-xs font-bold flex items-center gap-1.5 sm:gap-2 cursor-pointer"><Server className="w-4 h-4 text-[var(--brand-blue)]" /><span className="max-w-[90px] sm:max-w-none truncate">{activeServer.name}</span><ChevronDown className="w-3.5 h-3.5" /></button>
              <AnimatePresence>{serverMenuOpen && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#14141d] border border-slate-200 dark:border-white/15 rounded-xl p-1.5 z-40 shadow-2xl"><div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">Streaming Source</div>{MOVIE_SERVERS.map((server, index) => <button key={server.id} type="button" onClick={() => { setServerIndex(index); setServerMenuOpen(false); }} className={`w-full text-left text-xs p-2.5 rounded-lg cursor-pointer ${serverIndex === index ? 'bg-[var(--brand-blue)] text-slate-950 font-extrabold' : 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10'}`}>{server.name}</button>)}</motion.div>}</AnimatePresence>
            </div>
            {(selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date) && (
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto sm:order-2">
                <button type="button" onClick={handlePrevEpisode} disabled={season === 1 && episode === 1} className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 disabled:opacity-40 text-xs font-bold text-slate-900 dark:text-white cursor-pointer">Prev</button>
                <label className="text-xs text-slate-900 dark:text-white flex items-center gap-1">S <select value={season} onChange={event => { setSeason(Number(event.target.value)); setEpisode(1); }} className="bg-slate-100 dark:bg-slate-900 text-[var(--brand-blue)] rounded px-2 py-1.5">{Array.from({ length: Math.max(1, totalSeasons) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
                <label className="text-xs text-slate-900 dark:text-white flex items-center gap-1">E <select value={episode} onChange={event => setEpisode(Number(event.target.value))} className="bg-slate-100 dark:bg-slate-900 text-[var(--brand-blue)] rounded px-2 py-1.5">{Array.from({ length: Math.max(1, episodeCount) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
                <button type="button" onClick={handleNextEpisode} disabled={season === totalSeasons && episode === episodeCount} className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 disabled:opacity-40 text-xs font-bold text-slate-900 dark:text-white cursor-pointer">Next</button>
              </div>
            )}
          </div>
          <div className="relative flex-1 bg-black w-full min-h-0"><iframe data-frosthub-embed="true" key={`${selectedMedia.id}-${season}-${episode}-${serverIndex}`} src={playerUrl} title={selectedMedia.title || selectedMedia.name || 'Media player'} className="w-full h-full border-0" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" /></div>
        </div>, document.body
      )}
    </div>
  );
};
