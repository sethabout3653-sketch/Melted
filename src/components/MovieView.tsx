import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Film, Tv, Search, Play, X, Server, ChevronDown, Star, Info } from 'lucide-react';
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

// VidSrc is the recommended/default source; XPass remains available as an alternative.
const MOVIE_SERVERS: MovieServer[] = [
  { id: 'vidsrc', name: 'VidSrc (Recommended)', domain: 'vidsrc.mov', getMovieUrl: id => `https://vidsrc.mov/embed/movie/${id}`, getTVUrl: (id, season, episode) => `https://vidsrc.mov/embed/tv/${id}/${season}/${episode}` },
  { id: 'xpass', name: 'XPass', domain: 'play.xpass.top', getMovieUrl: id => `https://play.xpass.top/e/movie/${id}?autostart=false`, getTVUrl: (id, season, episode) => `https://play.xpass.top/e/tv/${id}/${season}/${episode}?autostart=false` },
];

type CatalogTab = 'all' | 'movies' | 'tv';

export const MovieView: React.FC<MovieViewProps> = ({ onActiveMediaChange }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<TMDBMedia | null>(null);
  const [serverIndex, setServerIndex] = useState(0);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tvDetails, setTvDetails] = useState<{ number_of_seasons?: number; seasons?: { season_number: number; episode_count: number }[] } | null>(null);
  const activeServer = MOVIE_SERVERS[serverIndex] || MOVIE_SERVERS[0];
  const isTV = !!selectedMedia && (selectedMedia.media_type === 'tv' || !!selectedMedia.first_air_date);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = query.trim()
          ? await tmdbService.searchMulti(query, 1)
          : activeTab === 'all'
            ? await tmdbService.getTrending('all', 'week', 1)
            : activeTab === 'movies'
              ? await tmdbService.getPopularMovies(1)
              : await tmdbService.getPopularTV(1);
        if (!cancelled) setItems(results);
      } catch (error) {
        console.error('Failed to load movie catalogue:', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query.trim() ? 350 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeTab, query]);

  useEffect(() => {
    if (!selectedMedia) {
      onActiveMediaChange?.(null);
      return;
    }
    onActiveMediaChange?.({
      title: selectedMedia.title || selectedMedia.name || 'Untitled',
      mediaType: isTV ? 'tv' : 'movie',
      season: isTV ? season : undefined,
      episode: isTV ? episode : undefined,
    });
  }, [selectedMedia, isTV, season, episode, onActiveMediaChange]);

  const playerUrl = useMemo(() => {
    if (!selectedMedia) return '';
    return isTV
      ? activeServer.getTVUrl(selectedMedia.id, season, episode)
      : activeServer.getMovieUrl(selectedMedia.id);
  }, [selectedMedia, isTV, activeServer, season, episode]);

  const selectMedia = async (media: TMDBMedia) => {
    setSeason(1);
    setEpisode(1);
    setServerIndex(0);
    setSelectedMedia(media);
    setTvDetails(null);
    if (media.media_type === 'tv' || media.first_air_date) {
      try { setTvDetails(await tmdbService.getTVDetails(media.id)); }
      catch (error) { console.warn('Failed to load TV details:', error); }
    }
  };

  const totalSeasons = Math.max(1, tvDetails?.number_of_seasons || selectedMedia?.number_of_seasons || 5);
  const episodeCount = tvDetails?.seasons?.find(item => item.season_number === season)?.episode_count || 24;
  const featuredMovie = items.find(item => item.media_type !== 'tv' && !item.first_air_date) || null;
  const tabs: { id: CatalogTab; label: string }[] = [
    { id: 'all', label: 'Trending' },
    { id: 'movies', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
  ];

  return (
    <div className="w-full min-h-screen bg-[#08090b] text-white flex flex-col font-sans pb-20">
      {!selectedMedia && <>
        <header className="sticky top-20 z-30 bg-[#08090b]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav aria-label="Movie categories" className="flex items-center gap-2">
              {tabs.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${activeTab === id ? 'bg-white text-black' : 'text-white/75 hover:text-white hover:bg-white/10'}`}>
                  {label}
                </button>
              ))}
            </nav>
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-white/60 absolute left-4 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies and TV shows..." className="w-full bg-white/10 border border-white/15 rounded-full pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-white/40" />
            </div>
          </div>
        </header>
        <main className="w-full pb-20">
          {!query && activeTab === 'movies' && featuredMovie && !loading && (
            <section className="relative min-h-[520px] sm:min-h-[650px] flex items-end overflow-hidden">
              <img src={getBackdropUrl(featuredMovie.backdrop_path)} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090b] via-transparent to-black/20" />
              <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 pb-16 sm:pb-20 pt-24">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/85 mb-4"><Film className="w-4 h-4" /><span>Movies</span></div>
                <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight max-w-3xl leading-[0.95]">{featuredMovie.title || featuredMovie.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-white/85 mt-5">
                  {typeof featuredMovie.vote_average === 'number' && <span className="flex items-center gap-1 text-amber-400"><Star className="w-4 h-4 fill-current" />{featuredMovie.vote_average.toFixed(1)}</span>}
                  {(featuredMovie.release_date || '').slice(0, 4) && <><span className="text-white/40">•</span><span>{featuredMovie.release_date?.slice(0, 4)}</span></>}
                  <span className="text-white/40">•</span><span>Movie</span>
                </div>
                {featuredMovie.overview && <p className="max-w-2xl text-sm sm:text-base text-white/80 leading-7 mt-4 line-clamp-3">{featuredMovie.overview}</p>}
                <div className="flex flex-wrap gap-3 mt-7">
                  <button type="button" onClick={() => void selectMedia(featuredMovie)} className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3 text-sm font-black uppercase tracking-wide text-black hover:bg-white/85"><Play className="w-4 h-4 fill-current" />Play</button>
                  <button type="button" onClick={() => void selectMedia(featuredMovie)} className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-7 py-3 text-sm font-black uppercase tracking-wide text-white backdrop-blur hover:bg-white/25"><Info className="w-4 h-4" />Details</button>
                </div>
              </div>
            </section>
          )}
          <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-10">
            <h2 className="text-xl sm:text-2xl font-black mb-5">{query ? `Search Results for “${query}”` : activeTab === 'all' ? 'Trending Titles' : activeTab === 'movies' ? 'Popular Movies' : 'Popular Series'}</h2>
            {loading ? <div className="text-center py-16 text-white/50">Loading titles…</div> : items.length === 0 ? <div className="text-center py-16 text-white/50">No movies or TV shows found.</div> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {items.map(item => <button key={`${item.id}-${item.media_type || item.title || 'tv'}`} type="button" onClick={() => void selectMedia(item)} className="group text-left bg-[#141519] rounded-xl overflow-hidden border border-white/10 hover:border-white/40 transition-colors">
                  <div className="relative aspect-[2/3] bg-slate-900"><img src={getPosterUrl(item.poster_path)} alt={item.title || item.name || 'Title poster'} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /><span className="absolute top-2 left-2 bg-black/80 text-white text-[9px] font-bold px-2 py-1 rounded">{item.media_type === 'tv' || item.first_air_date ? 'TV' : 'MOVIE'}</span><span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-8 h-8 text-white fill-current" /></span></div>
                  <div className="p-3"><h3 className="text-xs font-bold text-white truncate">{item.title || item.name}</h3><p className="text-[10px] text-white/50 mt-1">{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ''}</p></div>
                </button>)}
              </div>
            )}
          </section>
        </main>
      </>}
      {selectedMedia && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black flex flex-col h-[100dvh] w-[100dvw] overflow-hidden">
          <div className="relative flex-1 bg-black w-full h-full"><iframe key={`${selectedMedia.id}-${season}-${episode}-${serverIndex}`} src={playerUrl} title={selectedMedia.title || selectedMedia.name || 'Media player'} className="w-full h-full border-0" allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" /></div>
          <div className="absolute top-0 inset-x-0 z-30 px-4 py-3 bg-[#090d16]/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0"><button type="button" onClick={() => setSelectedMedia(null)} aria-label="Close player" className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center"><X className="w-5 h-5" /></button><div className="text-sm font-bold text-white truncate">{selectedMedia.title || selectedMedia.name}</div></div>
            {isTV && <div className="flex items-center gap-2"><label className="text-xs text-white">Season <select value={season} onChange={event => { setSeason(Number(event.target.value)); setEpisode(1); }} className="bg-slate-900 text-cyan-300 rounded p-1">{Array.from({ length: totalSeasons }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><label className="text-xs text-white">Episode <select value={episode} onChange={event => setEpisode(Number(event.target.value))} className="bg-slate-900 text-cyan-300 rounded p-1">{Array.from({ length: Math.max(1, episodeCount) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label></div>}
            <div className="relative"><button type="button" onClick={() => setServerMenuOpen(open => !open)} className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center gap-2"><Server className="w-4 h-4 text-cyan-300" /><span>{activeServer.name}</span><ChevronDown className="w-3.5 h-3.5" /></button>{serverMenuOpen && <div className="absolute right-0 mt-2 w-52 bg-[#14141d] border border-white/15 rounded-xl p-1.5 z-30"><div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">Streaming Source</div>{MOVIE_SERVERS.map((server, index) => <button key={server.id} type="button" onClick={() => { setServerIndex(index); setServerMenuOpen(false); }} className={`w-full text-left text-xs p-2 rounded-lg ${serverIndex === index ? 'bg-cyan-400 text-slate-950 font-extrabold' : 'text-white hover:bg-white/10'}`}>{server.name}</button>)}</div>}</div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};
