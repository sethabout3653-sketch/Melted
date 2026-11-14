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
                </div>
              )}
              {epg.next && (
                <div className="text-slate-400 truncate tabular-nums">
                  <span className="text-slate-500 font-semibold">Next</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-500 mr-1">{formatEpgTime(epg.next.start)}</span>
                  <span>{epg.next.title}</span>
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
    const loadEpg = async () => {
      try {
        const res = await fetch('/api/epg/now-next', { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && typeof data.programs === 'object') {
          setEpgMap(data.programs);
        }
      } catch {}
    };
    void loadEpg();
    const interval = window.setInterval(loadEpg, 60000);
    return () => {
      active = false;
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

  const categories = useMemo(
    () => Array.from(new Set([...EXTRA_CATEGORIES, ...TV_CHANNELS.map((c) => getDisplayCategory(c))])),
    []
  );

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  const filteredChannels = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) {
      return TV_CHANNELS.filter((channel) => {
        if (selectedCategory === 'Favorites') return favoriteSet.has(channel.id);
        const channelCat = getDisplayCategory(channel);
        return selectedCategory === 'All' || channelCat === selectedCategory;
      }).sort((a, b) => compareClassifiedChannels(a, b, selectedCategory === 'All' || selectedCategory === 'Favorites'));
    }

    const pool =
      selectedCategory === 'Favorites'
        ? TV_CHANNELS.filter((channel) => favoriteSet.has(channel.id))
        : TV_CHANNELS;

    return searchChannels(pool, q, {
      boostPredicate: (channel) =>
        selectedCategory !== 'All' &&
        selectedCategory !== 'Favorites' &&
        getDisplayCategory(channel) === selectedCategory,
      tieBreaker: (a, b) =>
        compareClassifiedChannels(a, b, selectedCategory === 'All' || selectedCategory === 'Favorites'),
    });
  }, [deferredSearchQuery, selectedCategory, favoriteSet]);

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

      // Prevent infinite loading spinner if a live stream hangs before first frame
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
          // Deduplicate identical height labels keeping highest bitrate
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

        // Watchdog to auto-nudge stalled live buffers or catch streams stuck loading
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
    if (!video) {
      setActiveCaptions([]);
      return;
    }

    const handleSync = () => {
      syncCaptions(hlsRef.current, video, captionsEnabled);
    };

    const bindTrackListeners = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.removeEventListener('cuechange', handleSync);
        track.addEventListener('cuechange', handleSync);
      }
      handleSync();
    };

    bindTrackListeners();
    video.textTracks.addEventListener('addtrack', bindTrackListeners);
    video.textTracks.addEventListener('removetrack', handleSync);

    return () => {
      video.textTracks.removeEventListener('addtrack', bindTrackListeners);
      video.textTracks.removeEventListener('removetrack', handleSync);
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].removeEventListener('cuechange', handleSync);
      }
    };
  }, [captionsEnabled, selectedChannel, syncCaptions]);

  const ensureLivePlayback = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else if (isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen();
    } else if ((containerRef.current as any).webkitRequestFullscreen) {
      (containerRef.current as any).webkitRequestFullscreen();
    }
  }, []);

  // Keyboard surfing & playback shortcuts (ignored while typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'PageDown' || (e.key === 'ArrowDown' && e.altKey)) {
        e.preventDefault();
        stepChannel(1);
      } else if (e.key === 'PageUp' || (e.key === 'ArrowUp' && e.altKey)) {
        e.preventDefault();
        stepChannel(-1);
      } else if (e.key === 'm') {
        toggleMute();
      } else if (e.key === 'f') {
        toggleFullscreen();
      } else if (e.key === 'c') {
        setCaptionsEnabled((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepChannel, toggleMute, toggleFullscreen]);

  const selectedMeta = selectedChannel ? classifyChannel(selectedChannel) : null;
  const activeQualityLabel =
    selectedQuality === -1
      ? activeHeight
        ? `Auto (${activeHeight}p)`
        : 'Auto'
      : qualityLevels.find((q) => q.index === selectedQuality)?.label || 'Auto';

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full bg-[#0b0e14] text-slate-100 overflow-hidden font-sans">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 bg-[#0e121b] border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/25 flex items-center justify-center text-[var(--brand-blue)] shrink-0">
            <Tv className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
                {selectedChannel?.name || 'Live TV'}
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-medium truncate">
              {selectedMeta
                ? `${selectedMeta.category} • ${selectedMeta.subType} • ${selectedMeta.network}`
                : 'Select a channel from the guide'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedChannel && (
            <button
              type="button"
              onClick={() => toggleFavorite(selectedChannel.id)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                favoriteSet.has(selectedChannel.id)
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-slate-800/80 border-slate-700/70 text-slate-300 hover:text-white'
              }`}
              title={favoriteSet.has(selectedChannel.id) ? 'Remove from Favorites' : 'Save Channel'}
              aria-label="Toggle favorite channel"
            >
              <Star className={`w-4 h-4 ${favoriteSet.has(selectedChannel.id) ? 'fill-current' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsGuideVisible((v) => !v)}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded-lg text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            title={isGuideVisible ? 'Hide Channel Guide' : 'Show Channel Guide'}
          >
            {isGuideVisible ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            <span>{isGuideVisible ? 'Hide Guide' : 'Show Guide'}</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Split: Stacked (Mobile/Tablet) -> Side-by-side (Desktop lg+) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Video Viewport */}
        <div
          className={`${
            selectedChannel ? 'aspect-video max-h-[38dvh] sm:max-h-[45dvh] lg:aspect-auto lg:max-h-none lg:flex-1' : 'py-10 lg:flex-1'
          } bg-[#07090e] relative flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/60 shrink-0 lg:shrink`}
        >
          {selectedChannel ? (
            <div
              ref={containerRef}
              className="w-full h-full max-w-5xl mx-auto relative group flex items-center justify-center bg-black rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 cursor-default"
              onMouseMove={(e) => {
                const container = e.currentTarget as HTMLElement;
                container.style.cursor = 'default';
                const controls = container.querySelector('.hide-in-fullscreen') as HTMLElement;
                if (controls) controls.style.opacity = '1';

                clearTimeout((container as any).hideTimer);
                (container as any).hideTimer = setTimeout(() => {
                  if (document.fullscreenElement) {
                    container.style.cursor = 'none';
                    if (controls) controls.style.opacity = '0';
                  }
                }, 2200);
              }}
            >
              <video
                ref={videoRef}
                onClick={ensureLivePlayback}
                className="w-full h-full object-contain"
                playsInline
                autoPlay
                controls={false}
              />

              {captionsEnabled && activeCaptions.length > 0 && (
                <div
                  className="absolute inset-x-4 bottom-16 sm:bottom-20 z-20 flex flex-col items-center gap-1.5 pointer-events-none select-none"
                  aria-live="polite"
                >
                  {activeCaptions.map((line, idx) => (
                    <span
                      key={idx}
                      className="max-w-3xl px-3.5 py-1.5 rounded-lg bg-black/85 backdrop-blur-sm text-white text-xs sm:text-base md:text-lg font-semibold leading-snug text-center shadow-xl border border-white/10 whitespace-pre-line"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              )}

              {/* Bottom Control Bar */}
              <div className="absolute inset-x-0 bottom-0 px-3 sm:px-5 py-3 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-10 flex items-center justify-between gap-2 sm:gap-4 hide-in-fullscreen transition-opacity duration-300">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-2 text-white hover:text-[var(--brand-blue)] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    aria-label="Volume"
                    className="hidden sm:block w-20 md:w-24 h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-[var(--brand-blue)]"
                  />
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Quality ABR Selector */}
                  <div className="relative" ref={qualityMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowQualityMenu((o) => !o)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 transition-colors cursor-pointer tabular-nums"
                      title="Video Quality"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
                      <span>{activeQualityLabel}</span>
                    </button>
                    {showQualityMenu && (
                      <div className="absolute right-0 bottom-full mb-2 w-40 rounded-xl bg-[#12151e] border border-slate-700 p-1 shadow-2xl z-30">
                        <button
                          type="button"
                          onClick={() => handleSelectQuality(-1)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            selectedQuality === -1 ? 'bg-[var(--brand-blue)] text-slate-950 font-bold' : 'text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          Auto (Adaptive)
                        </button>
                        {qualityLevels.map((lvl) => (
                          <button
                            key={lvl.index}
                            type="button"
                            onClick={() => handleSelectQuality(lvl.index)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer tabular-nums ${
                              selectedQuality === lvl.index ? 'bg-[var(--brand-blue)] text-slate-950 font-bold' : 'text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCaptionsEnabled((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors border cursor-pointer ${
                      captionsEnabled
                        ? 'bg-[var(--brand-blue)] text-slate-950 border-[var(--brand-blue)] shadow-sm'
                        : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'
                    }`}
                    aria-pressed={captionsEnabled}
                    title={captionsEnabled ? 'Disable Captions' : 'Enable Captions'}
                  >
                    CC
                  </button>

                  <button
                    type="button"
                    onClick={handleRetryStream}
                    className="p-2 text-white/90 hover:text-[var(--brand-blue)] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title="Reload Stream"
                    aria-label="Reload Stream"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-2 text-white hover:text-[var(--brand-blue)] hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                </div>
              </div>

              {isLoading && !playbackError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px] z-20 pointer-events-none">
                  <div className="w-9 h-9 border-2 border-[var(--brand-blue)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {playbackError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090c14]/92 backdrop-blur-sm z-20 p-5 text-center space-y-3">
                  <div className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedChannel.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">{playbackError}</p>
                  </div>
                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleRetryStream}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => stepChannel(1)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-xs font-bold text-slate-950 cursor-pointer"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      Next Channel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 text-sm font-medium">
              Select a station from the guide.
            </div>
          )}
        </div>

        {/* Channel Guide (Bottom on mobile/tablet, Right sidebar on desktop) */}
        {(isGuideVisible || (typeof window !== 'undefined' && window.innerWidth < 1024)) && (
          <aside className="flex-1 lg:flex-none lg:w-96 bg-[#0e121b] flex flex-col shrink-0 min-h-0 lg:border-l border-slate-800">
            <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-slate-200">Channel Guide</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700/70 tabular-nums shrink-0">
                  {filteredChannels.length === TV_CHANNELS.length
                    ? `${TV_CHANNELS.length.toLocaleString()} channels`
                    : `${filteredChannels.length.toLocaleString()} / ${TV_CHANNELS.length.toLocaleString()}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideVisible(false)}
                className="hidden lg:inline-flex p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Hide Guide"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-slate-800/60 shrink-0">
              <label className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus-within:border-[var(--brand-blue)] text-slate-400">
                <Search className="w-4 h-4 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels or topics..."
                  aria-label="Search channels"
                  className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500 pr-6"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear channel search"
                    className="absolute right-2.5 p-1 text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
            </div>

            <div className="px-3 py-2.5 border-b border-slate-800/60 shrink-0">
              <div
                onWheel={handleCategoryWheel}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 touch-pan-x cursor-grab active:cursor-grabbing select-none"
                role="group"
                aria-label="Channel categories"
              >
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  if (cat === 'Favorites' && favoriteIds.length === 0 && !isSelected) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      aria-pressed={isSelected}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--brand-blue)] text-slate-950 border-[var(--brand-blue)] font-extrabold shadow-md shadow-[var(--brand-blue-glow)]'
                          : 'bg-[#181822] hover:bg-[#20202e] text-slate-400 hover:text-white border-[#262638]'
                      }`}
                    >
                      {cat === 'Favorites' ? `Favorites (${favoriteIds.length})` : cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240 && visibleCount < filteredChannels.length) {
                  setVisibleCount((prev) => Math.min(filteredChannels.length, prev + 80));
                }
              }}
            >
              {visibleChannels.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-300">No matching channels</p>
                  <p className="text-xs text-slate-500">
                    Try another keyword or clear your category filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-[#181822] hover:bg-[#20202e] text-xs font-bold text-[var(--brand-blue)] border border-[#262638] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                visibleChannels.map((channel) => (
                  <ChannelListItem
                    key={channel.id}
                    channel={channel}
                    isSelected={selectedChannel?.id === channel.id}
                    isFavorite={favoriteSet.has(channel.id)}
                    epg={epgMap[channel.id]}
                    onSelect={handleSelectChannel}
                    onToggleFavorite={toggleFavorite}
                  />
                ))
              )}
              {visibleCount < filteredChannels.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => Math.min(filteredChannels.length, prev + 100))}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#181822] hover:bg-[#20202e] text-slate-300 border border-[#262638] transition-colors cursor-pointer tabular-nums"
                >
                  Show more ({filteredChannels.length - visibleCount} remaining)
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
