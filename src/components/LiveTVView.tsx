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
import { classifyChannel, compareClassifiedChannels } from '../utils/channelOrganization';

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
                <div className="text-slate-200 truncate tabular-nums">
                  <span className="text-[var(--brand-blue)] font-semibold">Now</span>
                  <span className="text-slate-500 mx-1">·</span>
                  <span className="text-slate-400 mr-1">{formatEpgTime(epg.now.start)}</span>
                  <span>{epg.now.title}</span>
                  {epg.now.rating && (
                    <span className="ml-1.5 px-1 py-0.2 bg-slate-800 border border-slate-700 rounded text-[9px] font-bold text-slate-300">
                      {epg.now.rating}
                    </span>
                  )}
                </div>
              )}
              {epg.next && (
                <div className="text-slate-400 truncate tabular-nums">
                  <span className="text-slate-500 font-semibold">Next</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-500 mr-1">{formatEpgTime(epg.next.start)}</span>
                  <span>{epg.next.title}</span>
                  {epg.next.rating && (
                    <span className="ml-1.5 px-1 py-0.2 bg-slate-800/80 border border-slate-700/80 rounded text-[9px] font-bold text-slate-400">
                      {epg.next.rating}
                    </span>
                  )}
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

  const [selectedChannel, setSelectedChannel] = useState<TVChannel | null>(null);

  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalOnSearchChange || setInternalSearchQuery;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
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
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 = Auto ABR
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

  useEffect(() => {
    if (!showQualityMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showQualityMenu]);

  const pickBestCaptionIndex = <T,>(
    items: ArrayLike<T>,
    getLang: (item: T) => string,
    getLabel: (item: T) => string
  ): number => {
    if (!items || items.length === 0) return -1;
    for (let i = 0; i < items.length; i++) {
      const lang = getLang(items[i]).toLowerCase();
      const label = getLabel(items[i]).toLowerCase();
      if (lang.startsWith('en') || label.includes('english') || label.includes('eng')) {
        return i;
      }
    }
    for (let i = 0; i < items.length; i++) {
      const lang = getLang(items[i]).toLowerCase();
      const label = getLabel(items[i]).toLowerCase();
      if (!isForeignLangTag(lang, label)) {
        return i;
      }
    }
    return 0;
  };

  const extractCueLines = (track: TextTrack): string[] => {
    const cues = track.activeCues;
    if (!cues || cues.length === 0) return [];
    const lines: string[] = [];
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i] as VTTCue;
      const raw = (cue.text || '').trim();
      if (!raw) continue;
      const cleaned = raw
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
      if (cleaned && !lines.includes(cleaned)) {
        lines.push(cleaned);
      }
    }
    return lines;
  };

  const syncCaptions = useCallback((hlsInstance: Hls | null, videoEl: HTMLVideoElement | null, enabled: boolean) => {
    if (hlsInstance) {
      hlsInstance.subtitleDisplay = false;
      if (hlsInstance.subtitleTracks && hlsInstance.subtitleTracks.length > 0) {
        const bestSubIdx = pickBestCaptionIndex(
          hlsInstance.subtitleTracks,
          (t) => t.lang || '',
          (t) => t.name || ''
        );
        const targetTrack = enabled && bestSubIdx !== -1 ? bestSubIdx : -1;
        if (hlsInstance.subtitleTrack !== targetTrack) {
          hlsInstance.subtitleTrack = targetTrack;
        }
      }
    }

    if (!videoEl) {
      setActiveCaptions([]);
      return;
    }

    const tracks = videoEl.textTracks;
    if (!tracks || tracks.length === 0 || !enabled) {
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          if (tracks[i].mode !== 'disabled') {
            tracks[i].mode = 'disabled';
          }
        }
      }
      setActiveCaptions([]);
      return;
    }

    const bestIdx = pickBestCaptionIndex(
      tracks,
      (t) => t.language || '',
      (t) => t.label || ''
    );

    const collectedLines: string[] = [];
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (i === bestIdx) {
        if (track.mode !== 'hidden') {
          track.mode = 'hidden';
        }
        const lines = extractCueLines(track);
        lines.forEach((l) => {
          if (!collectedLines.includes(l)) collectedLines.push(l);
        });
      } else if (track.mode !== 'disabled') {
        track.mode = 'disabled';
      }
    }
    setActiveCaptions(collectedLines);
  }, []);

  const [randomizedChannels, setRandomizedChannels] = useState<TVChannel[]>(() => TV_CHANNELS);

  useEffect(() => {
    const shuffled = [...TV_CHANNELS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setRandomizedChannels(shuffled);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set([...EXTRA_CATEGORIES, ...randomizedChannels.map((c) => getDisplayCategory(c))])),
    [randomizedChannels]
  );

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

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

  useEffect(() => {
    setVisibleCount(80);
  }, [selectedCategory, deferredSearchQuery]);

  const visibleChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount]
  );

  const handleSelectChannel = useCallback((channel: TVChannel) => {
    setSelectedChannel(channel);
  }, []);

  const stepChannel = useCallback(
    (delta: number) => {
      const pool = filteredChannels.length > 0 ? filteredChannels : TV_CHANNELS;
      if (pool.length === 0) return;
      if (!selectedChannel) {
        setSelectedChannel(pool[0]);
        return;
      }
      const idx = pool.findIndex((c) => c.id === selectedChannel.id);
      const nextIdx = idx === -1 ? 0 : (idx + delta + pool.length) % pool.length;
      setSelectedChannel(pool[nextIdx]);
    },
    [filteredChannels, selectedChannel]
  );

  const handleRetryStream = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const handleSelectQuality = useCallback((levelIndex: number) => {
    setSelectedQuality(levelIndex);
    setShowQualityMenu(false);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      hlsRef.current.loadLevel = levelIndex;
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
          enableCEA708Captions: true,
          enableWebVTT: true,
          enableIMSC1: true,
          renderTextTracksNatively: true,
          subtitleDisplay: false,
          xhrSetup: (xhr: any) => {
            xhr.withCredentials = false;
          },
        } as any);
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        const refreshQualityList = () => {
          if (!hls.levels || hls.levels.length === 0) return;
          const mapped: QualityLevel[] = hls.levels
            .map((lvl, index) => ({
              index,
              height: lvl.height || 0,
              bitrate: lvl.bitrate || 0,
              label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}k`,
            }))
            .sort((a, b) => (b.height || b.bitrate) - (a.height || a.bitrate));
          const seenLabels = new Set<string>();
          const unique = mapped.filter((m) => {
            if (seenLabels.has(m.label)) return false;
            seenLabels.add(m.label);
            return true;
          });
          setQualityLevels(unique);
        };

        const selectEnglishAudioTrack = () => {
          if (hls.audioTracks && hls.audioTracks.length > 0) {
            const tracks = hls.audioTracks;
            let bestTrackIndex = -1;
            for (let i = 0; i < tracks.length; i++) {
              const lang = (tracks[i].lang || '').toLowerCase();
              const name = (tracks[i].name || '').toLowerCase();
              if (lang.startsWith('en') || name.includes('english') || name.includes('eng')) {
                bestTrackIndex = i;
                break;
              }
            }
            if (bestTrackIndex === -1) {
              for (let i = 0; i < tracks.length; i++) {
                const lang = tracks[i].lang || '';
                const name = tracks[i].name || '';
                if (!isForeignLangTag(lang, name)) {
                  bestTrackIndex = i;
                  break;
                }
              }
            }
            if (bestTrackIndex !== -1 && hls.audioTrack !== bestTrackIndex) {
              hls.audioTrack = bestTrackIndex;
            }
          }
        };

        const selectEnglishSubtitleTrack = () => {
          syncCaptions(hls, video, captionsEnabledRef.current);
        };

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, selectEnglishAudioTrack);
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, selectEnglishAudioTrack);
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          selectEnglishAudioTrack();
        });
        hls.on(Hls.Events.LEVELS_UPDATED, refreshQualityList);
        hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
          const lvl = hls.levels?.[data.level];
          if (lvl?.height) {
            setActiveHeight(lvl.height);
          }
        });
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, selectEnglishSubtitleTrack);
        hls.on(Hls.Events.CUES_PARSED, selectEnglishSubtitleTrack);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCancelled) return;
          refreshQualityList();
          selectEnglishAudioTrack();
          selectEnglishSubtitleTrack();
          tryPlayVideo();
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (isCancelled) return;
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (!usedProxyFallback && rawUrl.startsWith('http')) {
                  usedProxyFallback = true;
                  networkRetryCount = 0;
                  hls.loadSource(`/api/proxy-stream?url=${encodeURIComponent(rawUrl)}`);
                  break;
                }
                if (networkRetryCount < 2) {
                  networkRetryCount++;
                  setTimeout(() => {
                    if (!isCancelled && hlsRef.current === hls) hls.startLoad();
                  }, 500 * networkRetryCount);
                } else {
                  clearInitTimer();
                  setIsLoading(false);
                  setIsPlaying(false);
                  setPlaybackError('This stream is temporarily unreachable or offline.');
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                mediaErrorCount++;
                if (mediaErrorCount === 1) {
                  hls.recoverMediaError();
                } else if (mediaErrorCount === 2) {
                  hls.swapAudioCodec();
                  hls.recoverMediaError();
                } else {
                  clearInitTimer();
                  hls.destroy();
                  setIsLoading(false);
                  setIsPlaying(false);
                  setPlaybackError('Stream decoder encountered an error.');
                }
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

        stallTimer = window.setInterval(() => {
          if (isCancelled || !video) return;
          if (video.paused && hasStartedPlaying) return;
          const nowTime = video.currentTime;
          if (nowTime === lastTime && video.readyState < 3) {
            stuckTicks++;
            if (stuckTicks === 3) {
              hls.startLoad();
            } else if (stuckTicks >= 6) {
              clearInitTimer();
              setIsLoading(false);
              setIsPlaying(false);
              setPlaybackError('Stream timed out while buffering.');
              if (stallTimer) clearInterval(stallTimer);
            }
          } else {
            lastTime = nowTime;
            stuckTicks = 0;
          }
        }, 2500);

        return () => {
          isCancelled = true;
          clearInitTimer();
          if (stallTimer) clearInterval(stallTimer);
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('waiting', onWaiting);
          video.removeEventListener('playing', onPlaying);
          setActiveCaptions([]);
          for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = 'disabled';
          }
          video.querySelectorAll('track').forEach((el) => el.remove());
          hls.destroy();
          if (hlsRef.current === hls) hlsRef.current = null;
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        const enforceNativeEnglish = () => {
          const audioTracks = (video as any).audioTracks;
          if (audioTracks && audioTracks.length > 0) {
            let engIdx = -1;
            for (let i = 0; i < audioTracks.length; i++) {
              const lang = (audioTracks[i].language || '').toLowerCase();
              const label = (audioTracks[i].label || '').toLowerCase();
              if (lang.startsWith('en') || label.includes('english') || label.includes('eng')) {
                engIdx = i;
                break;
              }
            }
            if (engIdx !== -1) {
              for (let i = 0; i < audioTracks.length; i++) {
                audioTracks[i].enabled = i === engIdx;
              }
            }
          }
          syncCaptions(null, video, captionsEnabledRef.current);
        };

        const onLoaded = () => {
          if (isCancelled) return;
          hasStartedPlaying = true;
          clearInitTimer();
          enforceNativeEnglish();
          tryPlayVideo();
          setIsLoading(false);
        };
        const onNativeErr = () => {
          if (isCancelled) return;
          if (!usedProxyFallback && rawUrl.startsWith('http')) {
            usedProxyFallback = true;
            video.src = `/api/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
          } else {
            clearInitTimer();
            setIsLoading(false);
            setPlaybackError('This stream is temporarily unavailable.');
          }
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onNativeErr);
        if ((video as any).audioTracks) {
          (video as any).audioTracks.addEventListener('addtrack', enforceNativeEnglish);
          (video as any).audioTracks.addEventListener('change', enforceNativeEnglish);
        }
        return () => {
          isCancelled = true;
          clearInitTimer();
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('waiting', onWaiting);
          video.removeEventListener('playing', onPlaying);
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onNativeErr);
          if ((video as any).audioTracks) {
            (video as any).audioTracks.removeEventListener('addtrack', enforceNativeEnglish);
            (video as any).audioTracks.removeEventListener('change', enforceNativeEnglish);
          }
        };
      }
    }

    return () => {
      isCancelled = true;
      if (initTimer !== null) clearTimeout(initTimer);
      if (stallTimer) clearInterval(stallTimer);
      setActiveCaptions([]);
    };
  }, [selectedChannel, reloadNonce, syncCaptions]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    syncCaptions(hlsRef.current, video, captionsEnabled);

    const onCueChange = () => {
      syncCaptions(hlsRef.current, video, captionsEnabledRef.current);
    };

    const tracks = video.textTracks;
    const attachTrackListeners = () => {
      if (!tracks) return;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].removeEventListener('cuechange', onCueChange);
        tracks[i].addEventListener('cuechange', onCueChange);
      }
    };

    attachTrackListeners();
    if (tracks) {
      tracks.addEventListener('addtrack', attachTrackListeners);
      tracks.addEventListener('change', onCueChange);
    }

    const pollTimer = captionsEnabled ? window.setInterval(onCueChange, 400) : null;

    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (tracks) {
        tracks.removeEventListener('addtrack', attachTrackListeners);
        tracks.removeEventListener('change', onCueChange);
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].removeEventListener('cuechange', onCueChange);
        }
      }
    };
  }, [captionsEnabled, selectedChannel, syncCaptions]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleToggleCaptions = () => {
    setCaptionsEnabled((prev) => !prev);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepChannel(-1);
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        stepChannel(1);
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleToggleCaptions();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepChannel]);

  const currentQualityLabel = useMemo(() => {
    if (selectedQuality === -1) {
      return activeHeight ? `Auto (${activeHeight}p)` : 'Auto';
    }
    const found = qualityLevels.find((q) => q.index === selectedQuality);
    return found ? found.label : 'Auto';
  }, [selectedQuality, activeHeight, qualityLevels]);

  const selectedChannelMeta = useMemo(
    () => (selectedChannel ? classifyChannel(selectedChannel) : null),
    [selectedChannel]
  );

  const selectedEpg = selectedChannel ? epgMap[selectedChannel.id] : undefined;

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 bg-[#0b0e14] text-white overflow-hidden">
      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 px-3 sm:px-5 py-2.5 bg-[#0f131b] border-b border-[#1f1f2e] shrink-0">
        <div
          onWheel={handleCategoryWheel}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[var(--brand-blue)] text-white shadow-sm'
                  : 'bg-[#161b26] text-slate-400 hover:bg-[#1e2433] hover:text-slate-200 border border-[#242938]'
              }`}
            >
              {cat}
              {cat === 'Favorites' && favoriteIds.length > 0 && (
                <span className="ml-1.5 text-[10px] opacity-80">({favoriteIds.length})</span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsGuideVisible((prev) => !prev)}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#161b26] hover:bg-[#1e2433] border border-[#242938] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          title={isGuideVisible ? 'Hide channel guide' : 'Show channel guide'}
        >
          {isGuideVisible ? (
            <>
              <PanelRightClose className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
              <span>Hide Guide</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
              <span>Show Guide</span>
            </>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Video Player Container */}
        <div
          ref={containerRef}
          className="relative w-full aspect-video lg:aspect-auto lg:flex-1 bg-black flex flex-col justify-between overflow-hidden shrink-0 lg:shrink select-none group/player"
        >
          {selectedChannel ? (
            <>
              <video
                ref={videoRef}
                playsInline
                className="w-full h-full object-contain bg-black"
              />

              {/* Custom Captions Overlay */}
              {captionsEnabled && activeCaptions.length > 0 && (
                <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 z-20 max-w-[85%] flex flex-col items-center gap-1 text-center">
                  {activeCaptions.map((line, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded bg-black/80 text-white text-sm sm:text-base font-medium leading-snug shadow-lg"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              )}

              {/* Loading Spinner Overlay */}
              {isLoading && !playbackError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-10 pointer-events-none">
                  <div className="w-10 h-10 border-2 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-semibold text-slate-200 tracking-wide">
                    Tuning into {selectedChannel.name}...
                  </p>
                </div>
              )}

              {/* Playback Error Overlay */}
              {playbackError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b0e14]/95 z-20 p-6 text-center">
                  <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
                  <p className="text-sm font-bold text-white mb-1">{selectedChannel.name}</p>
                  <p className="text-xs text-slate-400 max-w-md mb-4">{playbackError}</p>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleRetryStream}
                      className="px-4 py-2 rounded-lg bg-[var(--brand-blue)] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Reload Stream</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => stepChannel(1)}
                      className="px-4 py-2 rounded-lg bg-[#1a1e2b] hover:bg-[#252b3b] border border-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Next Channel
                    </button>
                  </div>
                </div>
              )}

              {/* Top Overlay Bar (Channel Info + Now/Next + Rating) */}
              <div className="absolute top-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent flex items-start justify-between gap-3 z-20 opacity-100 lg:opacity-0 lg:group-hover/player:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="flex items-center gap-3 min-w-0 pointer-events-auto">
                  <div className="w-11 h-8 sm:w-12 sm:h-9 rounded-lg bg-black/70 border border-slate-700/80 p-1 flex items-center justify-center shrink-0">
                    <ChannelLogo logo={selectedChannel.logo} name={selectedChannel.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                        {selectedChannel.name}
                      </h2>
                      {selectedEpg?.now?.rating && (
                        <span className="px-1.5 py-0.5 bg-slate-900/90 border border-slate-600 rounded text-[10px] font-extrabold text-slate-200 shrink-0">
                          {selectedEpg.now.rating}
                        </span>
                      )}
                    </div>
                    {selectedEpg?.now ? (
                      <p className="text-xs text-slate-200 truncate mt-0.5">
                        <span className="text-[var(--brand-blue)] font-semibold">Now:</span>{' '}
                        {selectedEpg.now.title}
                        {selectedEpg.next && (
                          <span className="text-slate-400">
                            {' '}
                            • <span className="font-semibold">Next:</span> {selectedEpg.next.title}
                          </span>
                        )}
                      </p>
                    ) : (
                      selectedChannelMeta && (
                        <p className="text-xs text-slate-300 truncate mt-0.5">
                          {selectedChannelMeta.category} • {selectedChannelMeta.network}
                        </p>
                      )
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFavorite(selectedChannel.id)}
                  className={`p-2 rounded-lg bg-black/60 hover:bg-black/80 border border-slate-700/80 transition-colors cursor-pointer pointer-events-auto shrink-0 ${
                    favoriteSet.has(selectedChannel.id) ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'
                  }`}
                  title={favoriteSet.has(selectedChannel.id) ? 'Remove favorite' : 'Favorite channel'}
                >
                  <Star className={`w-4 h-4 ${favoriteSet.has(selectedChannel.id) ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Bottom Controls Overlay */}
              <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-3 z-20 opacity-100 lg:opacity-0 lg:group-hover/player:opacity-100 transition-opacity duration-200">
                <div className="flex items-center gap-2">
                  {/* Volume Controls */}
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (val > 0 && isMuted) setIsMuted(false);
                    }}
                    aria-label="Volume"
                    className="w-16 sm:w-24 accent-[var(--brand-blue)] cursor-pointer"
                  />

                  {/* Reload Stream */}
                  <button
                    type="button"
                    onClick={handleRetryStream}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Reload stream"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Captions Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleCaptions}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer border ${
                      captionsEnabled
                        ? 'bg-[var(--brand-blue)] border-[var(--brand-blue)] text-white'
                        : 'bg-white/10 hover:bg-white/20 border-transparent text-slate-200'
                    }`}
                    title="Closed Captions (C)"
                  >
                    CC
                  </button>

                  {/* Quality Selector */}
                  {qualityLevels.length > 0 && (
                    <div ref={qualityMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowQualityMenu((prev) => !prev)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer"
                        title="Video Quality"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{currentQualityLabel}</span>
                      </button>

                      {showQualityMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-36 rounded-xl bg-[#12151e] border border-slate-700 shadow-xl py-1.5 z-30">
                          <button
                            type="button"
                            onClick={() => handleSelectQuality(-1)}
                            className={`w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer ${
                              selectedQuality === -1 ? 'text-[var(--brand-blue)] font-bold' : 'text-slate-200'
                            }`}
                          >
                            Auto {activeHeight ? `(${activeHeight}p)` : ''}
                          </button>
                          {qualityLevels.map((lvl) => (
                            <button
                              key={lvl.index}
                              type="button"
                              onClick={() => handleSelectQuality(lvl.index)}
                              className={`w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer ${
                                selectedQuality === lvl.index ? 'text-[var(--brand-blue)] font-bold' : 'text-slate-200'
                              }`}
                            >
                              {lvl.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fullscreen Toggle */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#111520] to-[#0b0e14]">
              <div className="w-16 h-16 rounded-2xl bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/30 flex items-center justify-center mb-4">
                <Tv className="w-8 h-8 text-[var(--brand-blue)]" />
              </div>
              <h2 className="text-lg font-extrabold text-white mb-1">Select a Live Channel</h2>
              <p className="text-xs text-slate-400 max-w-sm">
                Pick any channel from the guide to start streaming live TV with real-time program schedules and ratings.
              </p>
            </div>
          )}
        </div>

        {/* Channel Guide Sidebar */}
        {isGuideVisible && (
          <div className="w-full lg:w-[390px] xl:w-[420px] flex-1 lg:flex-initial min-h-0 bg-[#0f131b] border-t lg:border-t-0 lg:border-l border-[#1f1f2e] flex flex-col overflow-hidden">
            {/* Search Header */}
            <div className="p-3 border-b border-[#1f1f2e] shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${filteredChannels.length} channels...`}
                  className="w-full pl-9 pr-8 py-2 bg-[#161b26] border border-[#242938] focus:border-[var(--brand-blue)] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Channel List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
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
                <div className="py-12 text-center">
                  <p className="text-xs font-semibold text-slate-400">No matching channels found.</p>
                </div>
              )}

              {visibleCount < filteredChannels.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 80)}
                  className="w-full py-2.5 rounded-xl bg-[#161b26] hover:bg-[#1e2433] border border-[#242938] text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Load More ({filteredChannels.length - visibleCount} remaining)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTVView;
