import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Film, Tv, Search, Star, Play, Sparkles, X, Server, ChevronDown, Snowflake } from 'lucide-react';
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
  { id: 'vidsrc', name: 'VidSrc', domain: 'vidsrc.to', getMovieUrl: id => `https://vidsrc.to/embed/movie/${id}`, getTVUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
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
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<TMDBMedia | null>(null);
  const [serverIndex, setServerIndex] = useState(0);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const activeServer = MOVIE_SERVERS[serverIndex] || MOVIE_SERVERS[0];
  const isPlayerOpen = selectedMedia !== null;

  const handleClosePlayer = () => setSelectedMedia(null);

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
      if (event.key === 'Escape') handleClosePlayer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlayerOpen]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const loadCatalog = async () => {
      try {
        const results = activeTab === 'all'
          ? await tmdbService.getTrending('all', 'week', 1)
          : activeTab === 'movies'
            ? await tmdbService.getPopularMovies(1)
            : await tmdbService.getPopularTV(1);
        if (cancelled) return;
        setItems(results);
        setFeaturedItem(results[0] || null);
      } catch (error) {
        console.error('Failed to load movie catalogue:', error);
        if (!cancelled) {
          setItems([]);
          setFeaturedItem(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadCatalog();
    return () => { cancelled = true; };
  }, [activeTab]);

  useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await tmdbService.searchMulti(query, 1);
        if (!cancelled) setItems(results);
      } catch (error) {
        console.error('Movie search failed:', error);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const playerUrl = useMemo(() => {
    if (!selectedMedia) return '';
    const isTV = selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date;
    return isTV
      ? activeServer.getTVUrl(selectedMedia.id, season, episode)
      : activeServer.getMovieUrl(selectedMedia.id);
  }, [selectedMedia, activeServer, season, episode]);

  const selectMedia = (media: TMDBMedia) => {
    setSeason(1);
    setEpisode(1);
    setServerIndex(0);
    setSelectedMedia(media);
  };

  const tabButton = (tab: CatalogTab, label: string, Icon: typeof Film) => (
    <button
      key={tab}
      type="button"
      onClick={() => { setActiveTab(tab); setQuery(''); }}
      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
    >
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-28">
      {!isPlayerOpen && <>
        <header className="sticky top-20 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav aria-label="Movie categories" className="flex items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              {tabButton('all', 'Trending', Sparkles)}
              {tabButton('movies', 'Movies', Film)}
              {tabButton('tv', 'TV Shows', Tv)}
            </nav>
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies and TV shows..." className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm" />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-28 w-full space-y-10">
          {!query && featuredItem && !isLoading && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full h-[340px] sm:h-[440px] rounded-3xl overflow-hidden shadow-2xl group">
              <img src={getBackdropUrl(featuredItem.backdrop_path)} alt={featuredItem.title || featuredItem.name || 'Featured'} className="w-full h-full object-cover brightness-75 group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-6 sm:p-10 space-y-3 text-white">
                <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full w-fit">Featured {featuredItem.media_type === 'tv' ? 'Series' : 'Movie'}</span>
                <div className="flex items-center gap-2 text-amber-300"><Star className="w-4 h-4 fill-current" /><span>{featuredItem.vote_average?.toFixed(1) || '—'}</span></div>
                <h1 className="text-3xl sm:text-4xl font-black text-white">{featuredItem.title || featuredItem.name}</h1>
                <p className="text-sm text-slate-200 line-clamp-2 max-w-2xl">{featuredItem.overview}</p>
                <button type="button" onClick={() => selectMedia(featuredItem)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 w-fit"><Play className="w-4 h-4 fill-current" />Watch Now</button>
              </div>
            </motion.section>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black flex items-center gap-2"><Film className="w-5 h-5 text-blue-600" />{query ? `Search Results for “${query}”` : activeTab === 'all' ? 'Trending Titles' : activeTab === 'movies' ? 'Popular Movies' : 'Popular Series'}</h2>
              <span className="text-xs text-slate-500">{items.length} titles</span>
            </div>
            {isLoading || searchLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{Array.from({ length: 12 }, (_, index) => <div key={index} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-900 animate-pulse" />)}</div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 text-slate-500">No movies or TV shows found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {items.map(item => (
                  <motion.button type="button" key={`${item.id}-${item.media_type}`} whileHover={{ y: -4 }} onClick={() => selectMedia(item)} className="text-left bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md group">
                    <div className="relative aspect-[2/3] bg-slate-200 dark:bg-slate-950">
                      <img src={getPosterUrl(item.poster_path)} alt={item.title || item.name || 'Title poster'} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute top-2 left-2 bg-slate-950/80 text-white text-[9px] font-bold px-2 py-1 rounded-lg">{item.media_type === 'tv' || item.first_air_date ? 'TV' : 'MOVIE'}</span>
                    </div>
                    <div className="p-3"><h3 className="text-xs font-black truncate">{item.title || item.name}</h3><p className="text-[10px] text-slate-500 mt-1">{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ''}</p></div>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        </main>
      </>}

      {isPlayerOpen && selectedMedia && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black flex flex-col h-[100dvh] w-[100dvw]">
          <div className="relative flex-1 bg-black">
            <iframe key={`${activeServer.id}-${selectedMedia.id}-${season}-${episode}`} src={playerUrl} title={selectedMedia.title || selectedMedia.name || 'Media player'} className="w-full h-full border-0" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" />
          </div>
          <div className="absolute top-0 inset-x-0 z-20 px-4 py-3 bg-black/90 border-b border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" onClick={handleClosePlayer} aria-label="Close player" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
              <span className="hidden sm:flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-black px-2.5 py-1 rounded-lg"><Snowflake className="w-3.5 h-3.5" />FROSTED</span>
              <h1 className="text-sm font-bold text-white truncate">{selectedMedia.title || selectedMedia.name}</h1>
            </div>
            <div className="relative shrink-0">
              <button type="button" onClick={() => setServerMenuOpen(open => !open)} className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center gap-2"><Server className="w-4 h-4" />{activeServer.name}<ChevronDown className="w-4 h-4" /></button>
              <AnimatePresence>{serverMenuOpen && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-2 w-40 bg-slate-900 border border-white/15 rounded-xl p-2 z-30">{MOVIE_SERVERS.map((server, index) => <button key={server.id} type="button" onClick={() => { setServerIndex(index); setServerMenuOpen(false); }} className="w-full text-left text-white text-xs p-2 rounded-lg hover:bg-white/10">{server.name}</button>)}</motion.div>}</AnimatePresence>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};
