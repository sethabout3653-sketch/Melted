import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Tv, Search, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { TV_CHANNELS, TVChannel } from '../data/channels';

const DEFAULT_CHANNEL_ID = 'cartoon-network';
const DEFAULT_CHANNEL = TV_CHANNELS.find(channel => channel.id === DEFAULT_CHANNEL_ID) ?? TV_CHANNELS[0] ?? null;

const EXTRA_CATEGORIES = [
  'All', 'Comedy', 'Entertainment', 'Series', 'Movies', 'Sports', 'News', 'Family & Kids', 'Lifestyle', 'Reality'
];

const getDisplayCategory = (cat: string) => (cat === 'Family' || cat === 'Kids' || cat === 'Family & Kids') ? 'Family & Kids' : cat;

const ChannelLogo: React.FC<{ logo?: string; name: string }> = ({ logo, name }) => {
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
      .map(w => w[0])
      .filter(Boolean)
      .slice(0, 3)
      .join('')
      .toUpperCase();
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80 rounded-md text-[9px] font-bold tracking-wider text-slate-400 select-none">
        {initials || <Tv className="w-4 h-4 text-slate-600" />}
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
};

export const LiveTVView: React.FC = () => {
  const [selectedChannel, setSelectedChannel] = useState<TVChannel | null>(DEFAULT_CHANNEL);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const categories = Array.from(new Set([...EXTRA_CATEGORIES, ...TV_CHANNELS.map(c => getDisplayCategory(c.category))]));

  const handleCategoryWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  // Truly random shuffle order generated on load for "All" category
  const randomSeedMapRef = useRef<Record<string, number>>({});

  if (Object.keys(randomSeedMapRef.current).length === 0) {
    const map: Record<string, number> = {};
    TV_CHANNELS.forEach(c => {
      map[c.id] = Math.random();
    });
    randomSeedMapRef.current = map;
  }

  const filteredChannels = TV_CHANNELS.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
    const channelCat = getDisplayCategory(channel.category);
    const matchesCategory = selectedCategory === 'All' || channelCat === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (selectedCategory === 'All' && !searchQuery) {
      if (a.id === 'afv-always-funny') return -1;
      if (b.id === 'afv-always-funny') return 1;
      // Truly random shuffle for 'All' category
      const randA = randomSeedMapRef.current[a.id] ?? 0;
      const randB = randomSeedMapRef.current[b.id] ?? 0;
      return randA - randB;
    }
    // Specific categories are sorted alphabetically A-Z
    return a.name.localeCompare(b.name);
  });

  useEffect(() => {
    let isCancelled = false;

    if (selectedChannel && videoRef.current) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = 'disabled';
      }

      setIsLoading(true);
      const video = videoRef.current;
      const url = selectedChannel.url;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          backBufferLength: 6,
          autoStartLoad: true,
          capLevelToPlayerSize: false,
          startLevel: -1,
          enableCEA708Captions: true,
          enableWebVTT: true,
          subtitleDisplay: false,
          xhrSetup: (xhr: any) => {
            xhr.withCredentials = false;
          }
        } as any);
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        const selectHighestQuality1080p = () => {
          if (hls.levels && hls.levels.length > 0) {
            let highest1080Idx = -1;
            let maxResIdx = -1;
            let maxHeight = 0;
            let maxBitrateIdx = -1;
            let maxBitrate = 0;

            for (let i = 0; i < hls.levels.length; i++) {
              const lvl = hls.levels[i];
              const h = lvl.height || 0;
              const bitrate = lvl.bitrate || 0;

              if (h >= 1080) {
                highest1080Idx = i;
              }
              if (h > maxHeight) {
                maxHeight = h;
                maxResIdx = i;
              }
              if (bitrate > maxBitrate) {
                maxBitrate = bitrate;
                maxBitrateIdx = i;
              }
            }

            // Always automatically select 1080p level, or highest available resolution / bitrate
            const targetIdx = highest1080Idx !== -1
              ? highest1080Idx
              : maxResIdx !== -1 && maxHeight > 0
              ? maxResIdx
              : maxBitrateIdx !== -1
              ? maxBitrateIdx
              : hls.levels.length - 1;

            if (targetIdx !== -1 && targetIdx < hls.levels.length) {
              hls.currentLevel = targetIdx;
              hls.loadLevel = targetIdx;
            }
          }
        };

        const selectEnglishAudioTrack = () => {
          if (hls.audioTracks && hls.audioTracks.length > 0) {
            const tracks = hls.audioTracks;
            const nonEnglish = [
              'es', 'spa', 'spanish', 'español', 'castellano',
              'fr', 'fra', 'french', 'français',
              'de', 'deu', 'ger', 'german', 'deutsch',
              'it', 'ita', 'italian', 'italiano',
              'pt', 'por', 'portuguese', 'português',
              'ru', 'rus', 'russian',
              'ar', 'ara', 'arabic',
              'zh', 'zho', 'chi', 'chinese',
              'hi', 'hin', 'hindi',
              'ja', 'jpn', 'japanese',
              'ko', 'kor', 'korean'
            ];

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
                const lang = (tracks[i].lang || '').toLowerCase();
                const name = (tracks[i].name || '').toLowerCase();
                const isForeign = nonEnglish.some(p => lang === p || lang.startsWith(p + '-') || name.includes(p));
                if (!isForeign) {
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
          if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
            let bestTrackIndex = -1;
            for (let i = 0; i < hls.subtitleTracks.length; i++) {
              const lang = (hls.subtitleTracks[i].lang || '').toLowerCase();
              const name = (hls.subtitleTracks[i].name || '').toLowerCase();
              if (lang.startsWith('en') || name.includes('english') || name.includes('eng') || name.includes('cc')) {
                bestTrackIndex = i;
                break;
              }
            }
            if (bestTrackIndex !== -1) {
              hls.subtitleTrack = bestTrackIndex;
              hls.subtitleDisplay = true;
            } else {
              hls.subtitleDisplay = false;
              hls.subtitleTrack = -1;
            }
          }
        };

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, selectEnglishAudioTrack);
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHING, selectEnglishAudioTrack);
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          selectEnglishAudioTrack();
          selectHighestQuality1080p();
        });
        hls.on(Hls.Events.LEVELS_UPDATED, selectHighestQuality1080p);
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, selectEnglishSubtitleTrack);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCancelled) return;
          selectEnglishAudioTrack();
          selectEnglishSubtitleTrack();
          selectHighestQuality1080p();
          video.play().then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          }).catch(e => {
            if (e.name === 'NotAllowedError') {
              video.muted = true;
              setIsMuted(true);
              video.play().then(() => {
                setIsPlaying(true);
                setIsLoading(false);
              }).catch(() => {
                setIsPlaying(false);
                setIsLoading(false);
              });
            } else {
              if (e.name !== 'AbortError') setIsPlaying(false);
              setIsLoading(false);
            }
          });
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (isCancelled) return;
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                setIsLoading(false);
                setIsPlaying(false);
                break;
            }
          }
        });
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
                audioTracks[i].enabled = (i === engIdx);
              }
            }
          }

          if (captionsEnabled) {
            const textTracks = video.textTracks;
            for (let i = 0; i < textTracks.length; i++) {
              const lang = (textTracks[i].language || '').toLowerCase();
              if (lang.startsWith('en')) {
                textTracks[i].mode = 'showing';
              }
            }
          }
        };

        const onLoaded = () => {
          if (isCancelled) return;
          enforceNativeEnglish();
          video.play().then(() => setIsPlaying(true)).catch((e) => {
            if (e.name === 'NotAllowedError') {
              video.muted = true;
              setIsMuted(true);
              video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            } else {
              setIsPlaying(false);
            }
          });
          setIsLoading(false);
        };
        video.addEventListener('loadedmetadata', onLoaded);
        if ((video as any).audioTracks) {
          (video as any).audioTracks.addEventListener('addtrack', enforceNativeEnglish);
          (video as any).audioTracks.addEventListener('change', enforceNativeEnglish);
        }
        return () => {
          isCancelled = true;
          video.removeEventListener('loadedmetadata', onLoaded);
          if ((video as any).audioTracks) {
            (video as any).audioTracks.removeEventListener('addtrack', enforceNativeEnglish);
            (video as any).audioTracks.removeEventListener('change', enforceNativeEnglish);
          }
        };
      }
    }

    return () => {
      isCancelled = true;
      if (videoRef.current) {
        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
          videoRef.current.textTracks[i].mode = 'disabled';
        }
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedChannel]);

  useEffect(() => {
    const applyEnglishCaptions = () => {
      if (!videoRef.current) return;
      const video = videoRef.current;
      let enabledEnglish = false;
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        const lang = (track.language || '').toLowerCase();
        const label = (track.label || '').toLowerCase();
        const isEnglish = lang.startsWith('en') || label.includes('english') || label.includes('eng');

        if (captionsEnabled && isEnglish && !enabledEnglish) {
          track.mode = 'showing';
          enabledEnglish = true;
        } else {
          track.mode = 'disabled';
        }
      }
    };

    applyEnglishCaptions();
    const video = videoRef.current;
    if (video) {
      video.textTracks.addEventListener('addtrack', applyEnglishCaptions);
      return () => video.textTracks.removeEventListener('addtrack', applyEnglishCaptions);
    }
  }, [captionsEnabled, selectedChannel]);

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

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

  const enterFullscreen = () => {
    if (containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      }
    }
  };

  const [isGuideVisible, setIsGuideVisible] = useState(true);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full w-full bg-[#0b0e14] text-slate-100 overflow-hidden font-sans">
      <div className="flex items-center justify-between gap-6 px-6 py-3.5 bg-[#0e121b] border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">
              {selectedChannel?.name || 'TV Player'}
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              {selectedChannel?.category || 'Channel Guide'}
            </p>
          </div>
        </div>
        {!isGuideVisible && (
          <button
            onClick={() => setIsGuideVisible(true)}
            className="p-2 bg-slate-800 rounded-lg text-white"
            title="Show Guide"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
        <div className="flex-1 bg-[#07090e] relative flex items-center justify-center p-4 sm:p-6 overflow-hidden border-r border-slate-800/60">
          {selectedChannel ? (
            <div
              ref={containerRef}
              className="w-full h-full max-w-5xl mx-auto relative group flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80"
            >
              <video
                ref={videoRef}
                className="w-full h-full object-contain filter contrast-[1.02]"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
                playsInline
                autoPlay
                controls={false}
              />

              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="p-2 text-white hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors" title={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    aria-label="Volume"
                    className="w-20 sm:w-28 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[var(--brand-blue)]"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCaptionsEnabled(!captionsEnabled)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${captionsEnabled ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20'}`}
                    aria-pressed={captionsEnabled}
                  >
                    CC
                  </button>
                  <button
                    onClick={enterFullscreen}
                    className="p-2 text-white hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs z-20">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 text-sm font-medium">
              Select a station from the guide.
            </div>
          )}
        </div>

        {isGuideVisible && (
          <aside className="w-80 sm:w-96 bg-[#0e121b] flex flex-col shrink-0 min-h-0 border-l border-slate-800">
            <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Channel Guide</h2>
              <button
                onClick={() => setIsGuideVisible(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Hide Guide"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-slate-800/60">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                <Search className="w-4 h-4 shrink-0" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search channels..."
                  aria-label="Search channels"
                  className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
                />
              </label>
            </div>

            <div className="p-3 border-b border-slate-800/60">
              <div 
                onWheel={handleCategoryWheel}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 touch-pan-x cursor-grab active:cursor-grabbing select-none" 
                role="group" 
                aria-label="Channel categories"
              >
                {categories.map(cat => {
                  const isSelected = selectedCategory === cat;
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
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {filteredChannels.map(channel => {
                const isSelected = selectedChannel?.id === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all border text-left group cursor-pointer ${
                      isSelected 
                        ? 'bg-[var(--brand-blue)]/10 border-[var(--brand-blue)] text-white font-semibold shadow-sm' 
                        : 'border-[#1f1f2e] bg-[#12151e] text-slate-300 hover:bg-[#1a1e2b] hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <div className="w-16 h-11 rounded-lg bg-black/60 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 p-1">
                      <ChannelLogo logo={channel.logo} name={channel.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs truncate font-bold transition-colors ${isSelected ? 'text-[var(--brand-blue)]' : 'text-slate-200 group-hover:text-white'}`}>
                        {channel.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">{getDisplayCategory(channel.category)}</div>
                    </div>
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand-blue)] shrink-0 shadow-[0_0_8px_var(--brand-blue-glow)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
