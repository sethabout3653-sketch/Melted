import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Tv,
  Search,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCw,
  Star,
  AlertCircle,
  SlidersHorizontal,
  X,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { TV_CHANNELS, TVChannel } from '../data/channels';
import { searchChannels } from '../utils/channelSearch';
import { classifyChannel } from '../utils/channelOrganization';

const EXTRA_CATEGORIES = [
  'All',
  'Favorites',
  'Kids',
  'Comedy',
  'Entertainment',
  'Series',
  'Movies',
  'Sports',
  'News',
  'Crime',
  'Documentary',
  'Anime',
  'Sci-Fi & Horror',
  'Reality',
  'Game Show',
  'Lifestyle',
  'Music',
  'Gaming & Tech',
  'Ambiance',
];

const TV_FAVORITES_KEY = 'frosthub_tv_favorites';
const TV_LAST_CHANNEL_KEY = 'frosthub_tv_last_channel';

const getDisplayCategory = (channel: TVChannel) => classifyChannel(channel).category;

const resolvePlayableUrl = (rawUrl: string) => {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('/api/proxy-stream') || rawUrl.startsWith('/stream')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return `/api/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
};

const NON_ENGLISH_CODES = new Set([
  'es', 'spa', 'fr', 'fra', 'fre', 'de', 'deu', 'ger', 'it', 'ita',
  'pt', 'por', 'ru', 'rus', 'ar', 'ara', 'zh', 'zho', 'chi', 'hi', 'hin',
  'ja', 'jpn', 'ko', 'kor', 'nl', 'nld', 'dut', 'pl', 'pol', 'tr', 'tur',
  'vi', 'vie', 'sv', 'swe', 'no', 'nor', 'da', 'dan', 'fi', 'fin',
  'el', 'ell', 'gre', 'he', 'heb', 'th', 'tha', 'id', 'ind', 'uk', 'ukr',
]);

const NON_ENGLISH_NAME_REGEX =
  /\b(spanish|español|espanol|castellano|french|français|francais|german|deutsch|italian|italiano|portuguese|português|portugues|russian|arabic|chinese|mandarin|cantonese|hindi|japanese|korean|dutch|polish|turkish|vietnamese|ukrainian)\b/i;

const isForeignLangTag = (lang: string, label: string) => {
  const l = lang.toLowerCase().trim();
  const n = label.toLowerCase().trim();
  if (l) {
    const base = l.split(/[-_]/)[0];
    if (base === 'en' || base === 'eng') return false;
    if (NON_ENGLISH_CODES.has(l) || NON_ENGLISH_CODES.has(base)) return true;
  }
  return Boolean(n && NON_ENGLISH_NAME_REGEX.test(n));
};

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

const ChannelLogo: React.FC<{ logo?: string; name: string }> = React.memo(({ logo, name }) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(logo);
  const [triedProxy, setTriedProxy] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(logo);
    setTriedProxy(false);
    setHasError(false);
  }, [logo]);

  const handleError = () => {
    if (logo && logo.startsWith('http') && !triedProxy) {
      setTriedProxy(true);
      setImgSrc(`/api/proxy-image?url=${encodeURIComponent(logo)}`);
    } else {
      setHasError(true);
    }
  };

  if (!imgSrc || hasError) {
    const initials = name
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 3)
      .join('')
      .toUpperCase();
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80 rounded-md text-[10px] font-bold tracking-wider text-slate-400 select-none">
        {initials || <Tv className="w-4 h-4 text-slate-500" />}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={name}
      className="w-full h-full object-contain filter brightness-95 group-hover:brightness-105"
      loading="lazy"
      onError={handleError}
    />
  );
});

interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
  desc?: string;
  rating?: string;
}

interface ChannelNowNext {
  now?: EpgProgramme;
  next?: EpgProgramme;
}

const formatEpgTime = (ms: number): string => {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

const ChannelListItem: React.FC<{
  channel: TVChannel;
  isSelected: boolean;
  isFavorite: boolean;
  epg?: ChannelNowNext;
  onSelect: (channel: TVChannel) => void;
  onToggleFavorite: (channelId: string) => void;
}> = React.memo(({ channel, isSelected, isFavorite, epg, onSelect, onToggleFavorite }) => {
  const meta = classifyChannel(channel);
  const subtitle =
    meta.subType && meta.subType.toLowerCase() !== meta.category.toLowerCase()
      ? `${meta.category} • ${meta.subType} • ${meta.network}`
      : `${meta.category} • ${meta.network}`;

  return (
    <div
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors border group ${
        isSelected
          ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)] text-white shadow-sm'
          : 'border-[#1f1f2e] bg-[#12151e] text-slate-300 hover:bg-[#1a1e2b] hover:border-slate-700 hover:text-white'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(channel)}
        className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer focus:outline-none"
      >
        <div className="w-14 h-10 sm:w-16 sm:h-11 rounded-lg bg-black/60 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 p-1">
          <ChannelLogo logo={channel.logo} name={channel.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-xs truncate font-bold transition-colors ${isSelected ? 'text-[var(--brand-blue)]' : 'text-slate-200 group-hover:text-white'}`}>
            {channel.name}
          </div>
          <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{subtitle}</div>
          {(epg?.now || epg?.next) && (
            <div className="mt-1 space-y-0.5 text-[11px] leading-tight">
              {epg.now && (
                <div className="text-slate-200 truncate tabular-nums flex items-center gap-1.5">
                  <span className="text-[var(--brand-blue)] font-semibold shrink-0">Now</span>
                  <span className="text-slate-500 shrink-0">·</span>
                  <span className="text-slate-400 shrink-0">{formatEpgTime(epg.now.start)}</span>
                  <span className="truncate">{epg.now.title}</span>
                  {epg.now.rating && (
                    <span className="shrink-0 px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[9px] font-bold text-slate-300">
                      {epg.now.rating}
                    </span>
                  )}
                </div>
              )}
              {epg.next && (
                <div className="text-slate-400 truncate tabular-nums flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold shrink-0">Next</span>
                  <span className="text-slate-600 shrink-0">·</span>
                  <span className="text-slate-500 shrink-0">{formatEpgTime(epg.next.start)}</span>
                  <span className="truncate">{epg.next.title}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(channel.id);
        }}
        aria-label={isFavorite ? `Remove ${channel.name} from favorites` : `Save ${channel.name} to favorites`}
        className={`p-2 rounded-lg transition-colors cursor-pointer shrink-0 ${
          isFavorite
            ? 'text-amber-400 hover:text-amber-300'
            : 'text-slate-600 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-400'
        }`}
        title={isFavorite ? 'Remove favorite' : 'Favorite channel'}
      >
        <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>
  );
});

export interface LiveTVViewProps {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const LiveTVView: React.FC<LiveTVViewProps> = ({
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}) => {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(TV_FAVORITES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedChannel, setSelectedChannel] = useState<TVChannel | null>(() => {
    try {
      const lastId = localStorage.getItem(TV_LAST_CHANNEL_KEY);
      if (lastId) {
        const found = TV_CHANNELS.find((c) => c.id === lastId);
        if (found) return found;
      }
    } catch {}
    return TV_CHANNELS[0] || null;
  });

  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalOnSearchChange || setInternalSearchQuery;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [activeCaptions, setActiveCaptions] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [visibleCount, setVisibleCount] = useState<number>(80);
  const [isGuideVisible, setIsGuideVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [epgMap, setEpgMap] = useState<Record<string, ChannelNowNext>>({});

  useEffect(() => {
    let active = true;
    let retryTimer: number | null = null;
    const loadEpg = async () => {
      try {
        const res = await fetch('/api/epg/now-next', { signal: AbortSignal.timeout(20000) });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && typeof data.programs === 'object') {
          setEpgMap(data.programs);
          if (Object.keys(data.programs).length === 0) {
            retryTimer = window.setTimeout(loadEpg, 4000);
          }
        }
      } catch {
        if (active) {
          retryTimer = window.setTimeout(loadEpg, 4000);
        }
      }
    };
    void loadEpg();
    const interval = window.setInterval(loadEpg, 60000);
    return () => {
      active = false;
      if (retryTimer !== null) clearTimeout(retryTimer);
      window.clearInterval(interval);
    };
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const qualityMenuRef = useRef<HTMLDivElement>(null);
  const captionsEnabledRef = useRef(captionsEnabled);
  captionsEnabledRef.current = captionsEnabled;

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavorite = useCallback((channelId: string) => {
    setFavoriteIds((prev) => {
      const updated = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [channelId, ...prev];
      try {
        localStorage.setItem(TV_FAVORITES_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      try {
        localStorage.setItem(TV_LAST_CHANNEL_KEY, selectedChannel.id);
      } catch {}
    }
  }, [selectedChannel]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const randomizedChannels = useMemo(() => TV_CHANNELS, []);

  const categories = useMemo(
    () => Array.from(new Set([...EXTRA_CATEGORIES, ...randomizedChannels.map((c) => getDisplayCategory(c))])),
    [randomizedChannels]
  );

  const channelsByCategory = useMemo(() => {
    const map = new Map<string, TVChannel[]>();
    for (const ch of randomizedChannels) {
      const cat = getDisplayCategory(ch);
      let list = map.get(cat);
      if (!list) {
        list = [];
        map.set(cat, list);
      }
      list.push(ch);
    }
    return map;
  }, [randomizedChannels]);

  const filteredChannels = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) {
      if (selectedCategory === 'All') return randomizedChannels;
      if (selectedCategory === 'Favorites') return randomizedChannels.filter((ch) => favoriteSet.has(ch.id));
      return channelsByCategory.get(selectedCategory) || [];
    }

    const pool =
      selectedCategory === 'Favorites'
        ? randomizedChannels.filter((channel) => favoriteSet.has(channel.id))
        : selectedCategory === 'All'
        ? randomizedChannels
        : channelsByCategory.get(selectedCategory) || randomizedChannels;

    return searchChannels(pool, q, {
      boostPredicate: (channel) =>
        selectedCategory !== 'All' &&
        selectedCategory !== 'Favorites' &&
        getDisplayCategory(channel) === selectedCategory,
    });
  }, [deferredSearchQuery, selectedCategory, favoriteSet, channelsByCategory, randomizedChannels]);

  const visibleChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount]
  );

  const handleSelectChannel = useCallback((channel: TVChannel) => {
    setSelectedChannel(channel);
  }, []);

  const handleRetryStream = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let stallTimer: number | null = null;
    let initTimer: number | null = null;

    if (selectedChannel && videoRef.current) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = 'disabled';
      }
      videoRef.current.querySelectorAll('track').forEach((el) => el.remove());
      setActiveCaptions([]);
      setPlaybackError(null);
      setQualityLevels([]);
      setSelectedQuality(-1);
      setActiveHeight(null);
      setShowQualityMenu(false);
      setIsLoading(true);

      const video = videoRef.current;
      const rawUrl = selectedChannel.url;
      const url = resolvePlayableUrl(rawUrl);
      let usedProxyFallback = url.startsWith('/api/proxy-stream');
      let networkRetryCount = 0;
      let mediaErrorCount = 0;
      let lastTime = -1;
      let stuckTicks = 0;
      let hasStartedPlaying = false;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const clearInitTimer = () => {
        if (initTimer !== null) {
          clearTimeout(initTimer);
          initTimer = null;
        }
      };

      initTimer = window.setTimeout(() => {
        if (isCancelled || hasStartedPlaying) return;
        setIsLoading(false);
        setIsPlaying(false);
        setPlaybackError('This stream took too long to initialize. Try Reload or Next Channel.');
      }, 16000);

      const tryPlayVideo = () => {
        if (isCancelled) return;
        video
          .play()
          .then(() => {
            if (isCancelled) return;
            hasStartedPlaying = true;
            clearInitTimer();
            setIsPlaying(true);
            setIsLoading(false);
            setPlaybackError(null);
          })
          .catch((e) => {
            if (isCancelled) return;
            if (e.name === 'NotAllowedError') {
              video.muted = true;
              setIsMuted(true);
              video
                .play()
                .then(() => {
                  if (isCancelled) return;
                  hasStartedPlaying = true;
                  clearInitTimer();
                  setIsPlaying(true);
                  setIsLoading(false);
                  setPlaybackError(null);
                })
                .catch(() => {
                  clearInitTimer();
                  setIsPlaying(false);
                  setIsLoading(false);
                });
            } else if (e.name !== 'AbortError') {
              clearInitTimer();
              setIsPlaying(false);
              setIsLoading(false);
            }
          });
      };

      const onCanPlay = () => {
        if (isCancelled) return;
        hasStartedPlaying = true;
        clearInitTimer();
        setIsLoading(false);
        setPlaybackError(null);
      };
      const onWaiting = () => {
        if (!isCancelled) setIsLoading(true);
      };
      const onPlaying = () => {
        if (isCancelled) return;
        hasStartedPlaying = true;
        clearInitTimer();
        setIsLoading(false);
        setIsPlaying(true);
        setPlaybackError(null);
        stuckTicks = 0;
      };

      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('playing', onPlaying);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          liveSyncDurationCount: 8,
          liveMaxLatencyDurationCount: 20,
          maxLiveSyncPlaybackRate: 1.0,
          maxBufferLength: 45,
          maxMaxBufferLength: 90,
          backBufferLength: 30,
          highBufferWatchdogPeriod: 2,
          nudgeMaxRetry: 6,
          fragLoadingMaxRetry: 3,
          fragLoadingRetryDelay: 750,
          manifestLoadingMaxRetry: 2,
          manifestLoadingTimeOut: 8000,
          levelLoadingMaxRetry: 2,
          autoStartLoad: true,
          capLevelToPlayerSize: false,
          startLevel: -1,
          abrEwmaDefaultEstimate: 5000000,
          xhrSetup: (xhr: any) => {
            xhr.withCredentials = false;
          },
        } as any);
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCancelled) return;
          tryPlayVideo();
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (isCancelled) return;
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (!usedProxyFallback && rawUrl.startsWith('http')) {
                  usedProxyFallback = true;
                  hls.loadSource(`/api/proxy-stream?url=${encodeURIComponent(rawUrl)}`);
                  break;
                }
                clearInitTimer();
                setIsLoading(false);
                setIsPlaying(false);
                setPlaybackError('This stream is temporarily unreachable or offline.');
                break;
              default:
                clearInitTimer();
                hls.destroy();
                setIsLoading(false);
                setIsPlaying(false);
                setPlaybackError('Unable to play this channel right now.');
                break;
            }
          }
        });

        return () => {
          isCancelled = true;
          clearInitTimer();
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('waiting', onWaiting);
          video.removeEventListener('playing', onPlaying);
          hls.destroy();
          if (hlsRef.current === hls) hlsRef.current = null;
        };
      }
    }
  }, [selectedChannel, reloadNonce]);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-[#0b0e14] text-slate-100 overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#12151e] border-b border-[#1f1f2e] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-[var(--brand-blue)]" />
            <h1 className="text-sm font-bold tracking-wide">Live TV Guide</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#0b0e14] border border-[#1f1f2e] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsGuideVisible(!isGuideVisible)}
            className="p-2 rounded-lg bg-[#1a1e2b] hover:bg-[#252b3b] text-slate-300 transition-colors"
            title={isGuideVisible ? 'Hide Guide Sidebar' : 'Show Guide Sidebar'}
          >
            {isGuideVisible ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Video Player Main View */}
        <div className="flex-1 flex flex-col min-w-0 bg-black relative">
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {selectedChannel ? (
              <video
                ref={videoRef}
                playsInline
                autoPlay
                className="w-full h-full object-contain"
                onClick={togglePlay}
              />
            ) : (
              <div className="text-slate-500 text-sm">Select a channel from the guide to start watching</div>
            )}

            {isLoading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 border-2 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {playbackError && (
              <div className="absolute inset-0 bg-[#0b0e14]/90 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
                <p className="text-sm font-semibold text-slate-200 mb-4">{playbackError}</p>
                <button
                  type="button"
                  onClick={handleRetryStream}
                  className="px-4 py-2 bg-[var(--brand-blue)] hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Retry Stream
                </button>
              </div>
            )}
          </div>

          {/* Player Controls Bar */}
          <div className="h-14 bg-[#12151e] border-t border-[#1f1f2e] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {selectedChannel && (
                <>
                  <div className="w-10 h-7 rounded bg-black/50 border border-slate-800 p-0.5 shrink-0">
                    <ChannelLogo logo={selectedChannel.logo} name={selectedChannel.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200 truncate">{selectedChannel.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {epgMap[selectedChannel.id]?.now?.title || classifyChannel(selectedChannel).category}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors text-xs font-medium"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Channels & Guide Sidebar */}
        {isGuideVisible && (
          <div className="w-80 sm:w-96 bg-[#12151e] border-l border-[#1f1f2e] flex flex-col shrink-0">
            {/* Category Filter Pills */}
            <div className="px-3 py-2.5 border-b border-[#1f1f2e] flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[var(--brand-blue)] text-white font-bold'
                      : 'bg-[#1a1e2b] text-slate-400 hover:text-slate-200 hover:bg-[#252b3b]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {visibleChannels.map((channel) => (
                <ChannelListItem
                  key={channel.id}
                  channel={channel}
                  isSelected={selectedChannel?.id === channel.id}
                  isFavorite={favoriteSet.has(channel.id)}
                  epg={epgMap[channel.id]}
                  onSelect={handleSelectChannel}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
              {visibleChannels.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">No channels found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTVView;
