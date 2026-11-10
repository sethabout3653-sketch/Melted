import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Film, Tv, Search, Play, X, Server, ChevronDown } from 'lucide-react';
import { tmdbService, TMDBMedia, getPosterUrl } from '../services/tmdbService';

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

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-28">
      {!selectedMedia && <>
        <header className="sticky top-20 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav aria-label="Movie categories" className="flex items-center gap-2">
              {([['all', 'Trending'], ['movies', 'Movies'], ['tv', 'TV Shows']] as const).map(([tab, label]) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === tab ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-900'}`}>
                  {tab === 'tv' ? <Tv className="inline w-3.5 h-3.5 mr-2" /> : <Film className="inline w-3.5 h-3.5 mr-2" />}{label}
                </button>
              ))}
            </nav>
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies and TV shows..." className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm" />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-28 w-full">
          <h2 className="text-xl font-black mb-5">{query ? `Search Results for “${query}”` : activeTab === 'all' ? 'Trending Titles' : activeTab === 'movies' ? 'Popular Movies' : 'Popular Series'}</h2>
          {loading ? <div className="text-center py-16 text-slate-500">Loading titles…</div> : items.length === 0 ? <div className="text-center py-16 text-slate-500">No movies or TV shows found.</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
              {items.map(item => <button key={`${item.id}-${item.media_type || item.title || 'tv'}`} type="button" onClick={() => void selectMedia(item)} className="text-left bg-[#14141d] rounded-2xl overflow-hidden border border-[#222232] hover:border-cyan-400 transition-colors">
                <div className="relative aspect-[2/3] bg-slate-900"><img src={getPosterUrl(item.poster_path)} alt={item.title || item.name || 'Title poster'} loading="lazy" className="w-full h-full object-cover" /><span className="absolute top-2 left-2 bg-black/80 text-cyan-300 text-[9px] font-bold px-2 py-1 rounded">{item.media_type === 'tv' || item.first_air_date ? 'TV' : 'MOVIE'}</span><span className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="w-8 h-8 text-cyan-300" /></span></div>
                <div className="p-3"><h3 className="text-xs font-bold text-white truncate">{item.title || item.name}</h3><p className="text-[10px] text-slate-400 mt-1">{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ''}</p></div>
              </button>)}
            </div>
          )}
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
