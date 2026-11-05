import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Film, Tv, Search, Star, Play, Sparkles, X, Server, Settings, ExternalLink } from 'lucide-react';
import { tmdbService, TMDBMedia, getPosterUrl, getBackdropUrl } from '../services/tmdbService';
import {
  JellyfinConfig,
  JellyfinEpisode,
  JellyfinItem,
  JellyfinSeason,
  findJellyfinItemByTmdbId,
  getJellyfinEpisodes,
  getJellyfinSeasons,
  getJellyfinStreamUrl,
} from '../services/jellyfinService';

interface MovieViewProps {
  onActiveMediaChange?: (info: { title: string; mediaType: 'movie' | 'tv'; season?: number; episode?: number } | null) => void;
}

type CatalogTab = 'all' | 'movies' | 'tv';
const SESSION_CONFIG_KEY = 'melted_jellyfin_session';

function loadSessionConfig(): JellyfinConfig | null {
  try {
    const value = sessionStorage.getItem(SESSION_CONFIG_KEY);
    return value ? JSON.parse(value) as JellyfinConfig : null;
  } catch {
    return null;
  }
}

export const MovieView: React.FC<MovieViewProps> = ({ onActiveMediaChange }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TMDBMedia[]>([]);
  const [featuredItem, setFeaturedItem] = useState<TMDBMedia | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [config, setConfig] = useState<JellyfinConfig | null>(loadSessionConfig);
  const [serverUrl, setServerUrl] = useState(() => loadSessionConfig()?.serverUrl || '');
  const [apiKey, setApiKey] = useState(() => loadSessionConfig()?.apiKey || '');
  const [settingsOpen, setSettingsOpen] = useState(!loadSessionConfig());
  const [setupError, setSetupError] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<TMDBMedia | null>(null);
  const [jellyfinItem, setJellyfinItem] = useState<JellyfinItem | null>(null);
  const [seasons, setSeasons] = useState<JellyfinSeason[]>([]);
  const [episodes, setEpisodes] = useState<JellyfinEpisode[]>([]);
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [episode, setEpisode] = useState<JellyfinEpisode | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const isTV = selectedMedia?.media_type === 'tv' || !!selectedMedia?.first_air_date;

  const closePlayer = () => {
    setSelectedMedia(null);
    setJellyfinItem(null);
    setSeasons([]);
    setEpisodes([]);
    setEpisode(null);
    setStreamUrl('');
    setPlaybackError('');
  };

  useEffect(() => {
    onActiveMediaChange?.(selectedMedia ? {
      title: selectedMedia.title || selectedMedia.name || 'Untitled',
      mediaType: isTV ? 'tv' : 'movie',
      season: isTV ? seasonNumber : undefined,
      episode: isTV ? episode?.IndexNumber : undefined,
    } : null);
  }, [selectedMedia, isTV, seasonNumber, episode, onActiveMediaChange]);

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
        if (!cancelled) {
          setItems(results);
          setFeaturedItem(results[0] || null);
        }
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
    void loadCatalog();
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

  useEffect(() => {
    if (!selectedMedia) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePlayer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMedia]);

  const saveConfig = (event: React.FormEvent) => {
    event.preventDefault();
    setSetupError('');
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(cleanUrl)) {
      setSetupError('Enter your Jellyfin server URL, including https:// (or http:// for a trusted local network).');
      return;
    }
    if (!apiKey.trim()) {
      setSetupError('Enter an API key created in your own Jellyfin dashboard.');
      return;
    }
    const next = { serverUrl: cleanUrl, apiKey: apiKey.trim() };
    try {
      sessionStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(next));
    } catch {
      setSetupError('Could not save this session configuration in this browser.');
      return;
    }
    setConfig(next);
    setSettingsOpen(false);
  };

  const clearConfig = () => {
    sessionStorage.removeItem(SESSION_CONFIG_KEY);
    setConfig(null);
    setApiKey('');
    setServerUrl('');
    setSettingsOpen(true);
  };

  const startPlayback = async (media: TMDBMedia) => {
    if (!config) {
      setSettingsOpen(true);
      setSetupError('Connect your Jellyfin server first.');
      return;
    }
    setSelectedMedia(media);
    setJellyfinItem(null);
    setSeasons([]);
    setEpisodes([]);
    setEpisode(null);
    setStreamUrl('');
    setPlaybackError('');
    setPlaybackLoading(true);
    try {
      const mediaType = media.media_type === 'tv' || !!media.first_air_date ? 'tv' : 'movie';
      const title = media.title || media.name || '';
      const match = await findJellyfinItemByTmdbId(config, media.id, mediaType, title);
      if (!match) {
        setPlaybackError(`“${title}” was not found in your Jellyfin library. Add the title to your library and make sure its TMDb provider ID is matched in Jellyfin.`);
        return;
      }
      setJellyfinItem(match);
      if (mediaType === 'tv') {
        const availableSeasons = (await getJellyfinSeasons(config, match.Id)).filter(item => item.IndexNumber > 0);
        if (!availableSeasons.length) {
          setPlaybackError('No playable seasons were found for this series in Jellyfin.');
          return;
        }
        setSeasons(availableSeasons);
        const firstSeason = availableSeasons[0];
        setSeasonNumber(firstSeason.IndexNumber);
        const seasonEpisodes = await getJellyfinEpisodes(config, match.Id, firstSeason.IndexNumber);
        setEpisodes(seasonEpisodes);
        if (seasonEpisodes[0]) {
          setEpisode(seasonEpisodes[0]);
          setStreamUrl(getJellyfinStreamUrl(config, seasonEpisodes[0].Id));
        } else {
          setPlaybackError('No episodes were found for this season in Jellyfin.');
        }
      } else {
        setStreamUrl(getJellyfinStreamUrl(config, match.Id));
      }
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not connect to Jellyfin. Check the URL, API key, and server CORS settings.');
    } finally {
      setPlaybackLoading(false);
    }
  };

  const changeSeason = async (value: number) => {
    if (!config || !jellyfinItem) return;
    setSeasonNumber(value);
    setPlaybackLoading(true);
    setPlaybackError('');
    setStreamUrl('');
    try {
      const nextEpisodes = await getJellyfinEpisodes(config, jellyfinItem.Id, value);
      setEpisodes(nextEpisodes);
      const firstEpisode = nextEpisodes[0] || null;
      setEpisode(firstEpisode);
      if (firstEpisode) setStreamUrl(getJellyfinStreamUrl(config, firstEpisode.Id));
      else setPlaybackError('No episodes were found for this season in Jellyfin.');
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : 'Could not load episodes from Jellyfin.');
    } finally {
      setPlaybackLoading(false);
    }
  };

  const changeEpisode = (episodeId: string) => {
    const next = episodes.find(item => item.Id === episodeId);
    if (!next || !config) return;
    setEpisode(next);
    setStreamUrl(getJellyfinStreamUrl(config, next.Id));
    setPlaybackError('');
  };

  const tabButton = (tab: CatalogTab, label: string, Icon: typeof Film) => (
    <button key={tab} type="button" onClick={() => { setActiveTab(tab); setQuery(''); }}
      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}>
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pb-28">
      {!selectedMedia && <>
        <header className="sticky top-20 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <nav aria-label="Movie categories" className="flex items-center bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              {tabButton('all', 'Trending', Sparkles)}{tabButton('movies', 'Movies', Film)}{tabButton('tv', 'TV Shows', Tv)}
            </nav>
            <div className="flex w-full sm:w-auto gap-2">
              <div className="relative flex-1 sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies and TV shows..." aria-label="Search movies and TV shows"
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="button" onClick={() => setSettingsOpen(open => !open)} className="px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200" aria-label="Jellyfin settings" title="Jellyfin settings">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-28 w-full space-y-8">
          {settingsOpen && <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div><h2 className="text-lg font-black flex items-center gap-2"><Server className="w-5 h-5 text-blue-600" />Connect your Jellyfin library</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">TMDB provides discovery metadata; playback comes from your own Jellyfin server and media.</p></div>
              {config && <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>}
            </div>
            <form onSubmit={saveConfig} className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Jellyfin server URL
                <input value={serverUrl} onChange={event => setServerUrl(event.target.value)} placeholder="https://jellyfin.example.com" autoComplete="url" className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Jellyfin API key
                <input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Create a key in Jellyfin Dashboard → API Keys" autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Connect for this session</button>
                {config && <><span className="text-xs text-emerald-600 dark:text-emerald-400">Connected: {config.serverUrl}</span><button type="button" onClick={clearConfig} className="text-xs text-red-600 hover:underline">Disconnect</button></>}
              </div>
              {setupError && <p role="alert" className="sm:col-span-2 text-sm text-red-600">{setupError}</p>}
            </form>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">Your API key is kept in this tab’s session storage, not sent to Melted. Configure Jellyfin’s allowed origins/CORS for this site. Use HTTPS for remote access; only use HTTP on a trusted local network.</p>
          </section>}

          {!query && featuredItem && !isLoading && <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative w-full h-[340px] sm:h-[440px] rounded-3xl overflow-hidden shadow-2xl group">
            <img src={getBackdropUrl(featuredItem.backdrop_path)} alt={featuredItem.title || featuredItem.name || 'Featured'} className="w-full h-full object-cover brightness-75" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-6 sm:p-10 space-y-3 text-white">
              <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full w-fit">Featured {featuredItem.media_type === 'tv' ? 'Series' : 'Movie'}</span>
              <div className="flex items-center gap-2 text-amber-300"><Star className="w-4 h-4 fill-current" /><span>{featuredItem.vote_average?.toFixed(1) || '—'}</span></div>
              <h1 className="text-3xl sm:text-4xl font-black text-white">{featuredItem.title || featuredItem.name}</h1>
              <p className="text-sm text-slate-200 line-clamp-2 max-w-2xl">{featuredItem.overview}</p>
              <button type="button" onClick={() => void startPlayback(featuredItem)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 w-fit"><Play className="w-4 h-4 fill-current" />Play from my library</button>
            </div>
          </motion.section>}

          <section className="space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black flex items-center gap-2"><Film className="w-5 h-5 text-blue-600" />{query ? `Search Results for “${query}”` : activeTab === 'all' ? 'Trending Titles' : activeTab === 'movies' ? 'Popular Movies' : 'Popular Series'}</h2><span className="text-xs text-slate-500">{items.length} titles</span></div>
            {isLoading || searchLoading ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{Array.from({ length: 12 }, (_, index) => <div key={index} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-900 animate-pulse" />)}</div>
              : items.length === 0 ? <div className="text-center py-16 text-slate-500">No movies or TV shows found.</div>
              : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{items.map(item => <motion.button type="button" key={`${item.id}-${item.media_type}`} whileHover={{ y: -4 }} onClick={() => void startPlayback(item)} className="text-left bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md group">
                <div className="relative aspect-[2/3] bg-slate-200 dark:bg-slate-950"><img src={getPosterUrl(item.poster_path)} alt={item.title || item.name || 'Title poster'} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /><span className="absolute top-2 left-2 bg-slate-950/80 text-white text-[9px] font-bold px-2 py-1 rounded-lg">{item.media_type === 'tv' || item.first_air_date ? 'TV' : 'MOVIE'}</span><span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"><Play className="w-9 h-9 text-white opacity-0 group-hover:opacity-100 fill-current" /></span></div>
                <div className="p-3"><h3 className="text-xs font-black truncate">{item.title || item.name}</h3><p className="text-[10px] text-slate-500 mt-1">{(item.release_date || item.first_air_date)?.slice(0, 4) || '—'} <span className="mx-1">·</span> ★ {item.vote_average?.toFixed(1) || '—'}</p></div>
              </motion.button>)}</div>}
          </section>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">Metadata provided by TMDB. <a className="underline" href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">About TMDB <ExternalLink className="inline w-3 h-3" /></a> · Playback is served only from your configured Jellyfin library.</p>
        </main>
      </>}

      {selectedMedia && createPortal(<div className="fixed inset-0 z-[999999] bg-black flex flex-col h-[100dvh] w-[100dvw]">
        <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center">
          {streamUrl && !playbackLoading && <video key={streamUrl} src={streamUrl} controls autoPlay playsInline className="w-full h-full object-contain" onError={() => setPlaybackError('The selected item could not be played by this browser. Check Jellyfin playback compatibility or enable transcoding in your own Jellyfin server.')} />}
          {playbackLoading && <div className="text-white text-sm">Connecting to your Jellyfin library…</div>}
          {playbackError && <div role="alert" className="max-w-xl mx-5 rounded-2xl border border-white/15 bg-slate-950 p-6 text-center text-white"><Server className="w-8 h-8 mx-auto mb-3 text-blue-400" /><p className="font-bold">Unable to play this title</p><p className="text-sm text-slate-300 mt-2">{playbackError}</p><button type="button" onClick={() => setSettingsOpen(true)} className="mt-4 text-sm text-blue-300 underline">Check Jellyfin connection</button></div>}
        </div>
        <div className="px-4 py-3 bg-black/95 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0"><button type="button" onClick={closePlayer} aria-label="Close player" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><X className="w-5 h-5" /></button><span className="hidden sm:flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-black px-2.5 py-1 rounded-lg"><Film className="w-3.5 h-3.5" />MELTED</span><h1 className="text-sm font-bold text-white truncate">{selectedMedia.title || selectedMedia.name}</h1></div>
          {isTV && <div className="flex items-center gap-2"><label className="text-xs text-slate-300" htmlFor="season-select">Season</label><select id="season-select" value={seasonNumber} onChange={event => void changeSeason(Number(event.target.value))} className="max-w-32 rounded-lg bg-white/10 text-white border border-white/15 px-2 py-2 text-xs">{seasons.map(season => <option key={season.Id} value={season.IndexNumber} className="text-black">{season.Name || `Season ${season.IndexNumber}`}</option>)}</select><label className="sr-only" htmlFor="episode-select">Episode</label><select id="episode-select" value={episode?.Id || ''} onChange={event => changeEpisode(event.target.value)} className="max-w-52 rounded-lg bg-white/10 text-white border border-white/15 px-2 py-2 text-xs"><option value="" className="text-black">Choose episode</option>{episodes.map(item => <option key={item.Id} value={item.Id} className="text-black">{item.IndexNumber ? `${item.IndexNumber}. ` : ''}{item.Name}</option>)}</select></div>}
          {config && <span className="hidden md:inline text-[11px] text-emerald-300">Source: {new URL(config.serverUrl).host} · Your library</span>}
        </div>
      </div>, document.body)}
    </div>
  );
};
