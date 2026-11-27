import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hash, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Headphones, 
  PhoneOff, 
  Send, 
  PlusCircle, 
  Search, 
  Monitor, 
  Smartphone,
  RotateCw, 
  AlertCircle, 
  X, 
  Menu,
  Users, 
  Gamepad2, 
  MessageSquare, 
  Download, 
  FileText,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ShieldAlert,
  ShieldCheck,
  Check,
  Hand,
  MessageCircle,
  Trash2,
  Maximize2,
  Minimize2,
  User
} from 'lucide-react';

import { UserAvatar } from './UserAvatar';
import { processAvatarImage, persistAvatarUrl } from '../utils/avatarUtils';
import { FontSettingsSection } from './FontSettingsSection';
import { FrostHubLogo } from './FrostHubLogo';

interface ChatViewProps {
  globalChat: any;
  initialChannel?: string | null;
}
import { GiphyFetch } from '@giphy/js-fetch-api';

// Official Giphy SDK Client with active Web API Key
const gf = new GiphyFetch('sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh');

const GIPHY_CATEGORIES = [
  { label: '🔥 Trending', query: '' },
  { label: '🎮 Gaming', query: 'gaming' },
  { label: '😂 Memes', query: 'memes' },
  { label: '💥 Reactions', query: 'reactions' },
  { label: '⚡ Anime', query: 'anime' },
  { label: '👏 GG', query: 'gg victory' },
  { label: '🐱 Cats', query: 'cats' },
  { label: '🎉 Party', query: 'party' },
  { label: '🤯 Mind Blown', query: 'mind blown' },
  { label: '🍿 Popcorn', query: 'popcorn' },
  { label: '💃 Dance', query: 'dance' },
  { label: '🤝 Respect', query: 'respect' },
];

// Audio attachment player remains local to ChatView for message history context
const AudioAttachmentPlayer: React.FC<{
  url: string;
  name?: string;
  onDownload?: () => void;
  showDownload?: boolean;
}> = ({ url, name, onDownload, showDownload = true }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-lg space-y-2">
      <audio
        ref={audioRef}
        src={url}
        crossOrigin="anonymous"
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Attachment Name */}
      {name && (
        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-full">
          {name}
        </p>
      )}

      {/* Player Controls Bar */}
      <div className="flex items-center gap-3">
        {/* Play / Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/30 transition-all cursor-pointer"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Scrubber Range Bar */}
        <div className="flex-1 min-w-0 space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!duration}
            className="w-full h-1.5 bg-slate-200 dark:bg-[#1f1f2e] rounded-lg appearance-none cursor-pointer accent-[var(--brand-blue)] transition-all"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Mute Button */}
        <button
          type="button"
          onClick={toggleMute}
          className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Download Button */}
        {showDownload && onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Download Audio"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Shared offscreen canvas for lightweight, real-time black frame detection
let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;

function checkIsVideoFrameBlack(video: HTMLVideoElement | null): boolean {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2 || video.paused || video.ended) {
    return true; // Not ready, 0 dimensions, paused, or ended -> treat as black
  }
  try {
    if (!sampleCanvas && typeof document !== 'undefined') {
      sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 16;
      sampleCanvas.height = 16;
      sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (!sampleCtx || !sampleCanvas) return true;
    sampleCtx.drawImage(video, 0, 0, 16, 16);
    const data = sampleCtx.getImageData(0, 0, 16, 16).data;
    let totalLuminance = 0;
    let maxLuma = 0;
    // Sample 256 pixels (16x16)
    for (let i = 0; i < data.length; i += 4) {
      const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      totalLuminance += luma;
      if (luma > maxLuma) maxLuma = luma;
    }
    const avgLuminance = totalLuminance / 256;
    // If average brightness is less than 10 (out of 255) and max pixel brightness < 20,
    // the frame is black / dark void
    return avgLuminance < 10 && maxLuma < 20;
  } catch {
    return true; // If error reading canvas, treat as black so avatar shows!
  }
}

// Remote Video Player with robust black frame detection, orientation checking, and avatar fallback
const RemoteVideoPlayer: React.FC<{ 
  stream: MediaStream | undefined;
  username: string;
  avatarColor?: string;
  user?: any;
  renderAvatar?: (u: any, sizeClass: string) => React.ReactNode;
  onOrientationChange?: (isVertical: boolean) => void;
  onBlackStateChange?: (isBlack: boolean) => void;
  onToggleFullscreen?: () => void;
  isScreen?: boolean;
  isVertical?: boolean;
  isSpeaking?: boolean;
}> = ({ stream, username, user, renderAvatar, onOrientationChange, onBlackStateChange, onToggleFullscreen, isScreen = false, isSpeaking = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideoFrame, setHasVideoFrame] = useState(false);
  const [isBlack, setIsBlack] = useState(!isScreen);

  const onOrientationChangeRef = useRef(onOrientationChange);
  useEffect(() => {
    onOrientationChangeRef.current = onOrientationChange;
  }, [onOrientationChange]);

  const onBlackStateChangeRef = useRef(onBlackStateChange);
  useEffect(() => {
    onBlackStateChangeRef.current = onBlackStateChange;
  }, [onBlackStateChange]);

  const lastReportedBlackRef = useRef<boolean | null>(null);
  const reportBlackState = useCallback((nextBlack: boolean) => {
    setIsBlack((prev) => (prev === nextBlack ? prev : nextBlack));
    if (lastReportedBlackRef.current !== nextBlack) {
      lastReportedBlackRef.current = nextBlack;
      onBlackStateChangeRef.current?.(nextBlack);
    }
  }, []);

  const checkOrientation = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setHasVideoFrame(true);
      const vertical = video.videoHeight > video.videoWidth;
      onOrientationChangeRef.current?.(vertical);
      return;
    }
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    if (settings && settings.width && settings.height) {
      setHasVideoFrame(true);
      const vertical = settings.height > settings.width;
      onOrientationChangeRef.current?.(vertical);
    }
  }, [stream]);

  const checkOrientationRef = useRef(checkOrientation);
  useEffect(() => {
    checkOrientationRef.current = checkOrientation;
  }, [checkOrientation]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.pause();
      video.srcObject = null;
      setHasVideoFrame(false);
      reportBlackState(true);
      return;
    }

    const allVideoTracks = stream.getVideoTracks();
    const liveTracks = allVideoTracks.filter((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted);

    if (liveTracks.length === 0) {
      setHasVideoFrame(false);
      reportBlackState(true);
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.muted = true;
    video.defaultMuted = true;

    let confirmedLiveNonBlack = false;

    const checkFrame = () => {
      const vid = videoRef.current;
      if (!vid || !stream) return;

      const currentTracks = stream.getVideoTracks();
      const hasLiveEnabledTrack = currentTracks.some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled);
      if (!hasLiveEnabledTrack) {
        confirmedLiveNonBlack = false;
        setHasVideoFrame(false);
        reportBlackState(true);
        return;
      }

      if (isScreen) {
        const hasUnmutedScreenTrack = currentTracks.some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted);
        if (!hasUnmutedScreenTrack) {
          confirmedLiveNonBlack = false;
          setHasVideoFrame(false);
          reportBlackState(true);
          return;
        }
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          confirmedLiveNonBlack = true;
          setHasVideoFrame(true);
          reportBlackState(false);
          checkOrientationRef.current();
        }
        return;
      }

      if (vid.videoWidth > 0 && vid.videoHeight > 0 && vid.readyState >= 2 && !vid.paused && !vid.ended) {
        if (confirmedLiveNonBlack) {
          reportBlackState(false);
          setHasVideoFrame(true);
          return;
        }
        const frameIsBlack = checkIsVideoFrameBlack(vid);
        reportBlackState(frameIsBlack);
        if (!frameIsBlack) {
          confirmedLiveNonBlack = true;
          setHasVideoFrame(true);
          checkOrientationRef.current();
        }
      } else {
        confirmedLiveNonBlack = false;
        reportBlackState(true);
      }
    };

    const tryPlay = () => {
      if (video && video.srcObject) {
        video.play().then(() => {
          checkFrame();
        }).catch((err) => {
          console.warn('[RemoteVideoPlayer] Play waiting for user interaction:', err);
        });
      }
    };

    tryPlay();

    const handleUnmute = () => {
      confirmedLiveNonBlack = false;
      allVideoTracks.forEach((t: MediaStreamTrack) => { t.enabled = true; });
      tryPlay();
    };

    const handleMuteOrEnd = () => {
      confirmedLiveNonBlack = false;
      setHasVideoFrame(false);
      reportBlackState(true);
    };

    allVideoTracks.forEach((t: MediaStreamTrack) => {
      t.addEventListener('unmute', handleUnmute);
      t.addEventListener('mute', handleMuteOrEnd);
      t.addEventListener('ended', handleMuteOrEnd);
    });

    const handleAddTrack = (e: MediaStreamTrackEvent) => {
      if (e.track.kind === 'video') {
        confirmedLiveNonBlack = false;
        e.track.enabled = true;
        e.track.addEventListener('unmute', handleUnmute);
        e.track.addEventListener('mute', handleMuteOrEnd);
        e.track.addEventListener('ended', handleMuteOrEnd);
        tryPlay();
      }
    };
    stream.addEventListener('addtrack', handleAddTrack);

    video.addEventListener('loadeddata', checkFrame);
    video.addEventListener('loadedmetadata', checkFrame);
    video.addEventListener('canplay', checkFrame);
    video.addEventListener('playing', checkFrame);
    video.addEventListener('pause', checkFrame);
    video.addEventListener('emptied', handleMuteOrEnd);

    const freezeWatchdog = setInterval(() => {
      if (video) {
        if (video.paused && video.srcObject) {
          video.play().catch(() => {});
        }
        if (!confirmedLiveNonBlack) {
          checkFrame();
        }
      }
    }, 1500);

    const onUserGesture = () => {
      tryPlay();
    };

    window.addEventListener('click', onUserGesture, { once: true });
    window.addEventListener('touchstart', onUserGesture, { once: true });
    window.addEventListener('keydown', onUserGesture, { once: true });

    return () => {
      clearInterval(freezeWatchdog);
      allVideoTracks.forEach((t: MediaStreamTrack) => {
        t.removeEventListener('unmute', handleUnmute);
        t.removeEventListener('mute', handleMuteOrEnd);
        t.removeEventListener('ended', handleMuteOrEnd);
      });
      stream.removeEventListener('addtrack', handleAddTrack);
      video.removeEventListener('loadeddata', checkFrame);
      video.removeEventListener('loadedmetadata', checkFrame);
      video.removeEventListener('canplay', checkFrame);
      video.removeEventListener('playing', checkFrame);
      video.removeEventListener('pause', checkFrame);
      video.removeEventListener('emptied', handleMuteOrEnd);
      window.removeEventListener('click', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
      video.pause();
      video.srcObject = null;
    };
  }, [stream, isScreen, reportBlackState]);

  const enterFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }
    const target = videoRef.current?.closest('[data-screen-tile]') ?? videoRef.current?.parentElement;
    if (!target || !document.fullscreenEnabled) return;
    target.requestFullscreen().catch((error) => {
      console.warn('[RemoteVideoPlayer] Fullscreen request was not allowed:', error);
    });
  };

  return (
    <div 
      onDoubleClick={enterFullscreen}
      className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-3xl bg-white dark:bg-slate-900 cursor-pointer"
    >
      {(isScreen || onToggleFullscreen) && (
        <button
          type="button"
          onClick={enterFullscreen}
          aria-label={`View ${username} in fullscreen`}
          title={isScreen ? 'View shared screen fullscreen' : 'View camera fullscreen'}
          className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-xl border border-white/20 bg-slate-950/75 text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 cursor-pointer"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {!isScreen && renderAvatar && user && (isBlack || !hasVideoFrame || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-900 z-10 transition-opacity duration-200">
          <div className="relative flex items-center justify-center">
            <div className={`transition-all ${isSpeaking ? 'ring-4 ring-amber-500 rounded-2xl shadow-[0_0_30px_#f59e0b]' : ''}`}>
              {renderAvatar(user, 'w-20 h-20 sm:w-28 sm:h-28 text-2xl sm:text-3xl')}
            </div>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(e) => {
          checkOrientation();
          (e.target as HTMLVideoElement).play().catch(() => {});
        }}
        onLoadedData={() => {
          const video = videoRef.current;
          if (video && video.videoWidth > 0) {
            if (isScreen) {
              setHasVideoFrame(true);
              reportBlackState(false);
            } else {
              const black = checkIsVideoFrameBlack(video);
              reportBlackState(black);
              if (!black) setHasVideoFrame(true);
            }
          }
        }}
        onCanPlay={() => {
          const video = videoRef.current;
          if (video && video.videoWidth > 0) {
            if (isScreen) {
              setHasVideoFrame(true);
              reportBlackState(false);
            } else {
              const black = checkIsVideoFrameBlack(video);
              reportBlackState(black);
              if (!black) setHasVideoFrame(true);
            }
          }
        }}
        onPlaying={() => {
          const video = videoRef.current;
          if (video) {
            if (isScreen) {
              setHasVideoFrame(true);
              reportBlackState(false);
            } else {
              const black = checkIsVideoFrameBlack(video);
              reportBlackState(black);
              if (!black) setHasVideoFrame(true);
            }
          }
          checkOrientation();
        }}
        onResize={checkOrientation}
        className={`w-full h-full ${isScreen ? 'object-contain' : 'object-cover'} rounded-3xl ${(!isBlack && hasVideoFrame && stream) ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-200`}
      />
    </div>
  );
};

// Local Video Player
const LocalVideoPlayer: React.FC<{ 
  stream: MediaStream | null;
  user: any;
  renderAvatar: (u: any, sizeClass: string) => React.ReactNode;
  onOrientationChange?: (isVertical: boolean) => void;
  onBlackStateChange?: (isBlack: boolean) => void;
  onToggleFullscreen?: () => void;
  isMirrored?: boolean;
  isScreen?: boolean;
  isSpeaking?: boolean;
}> = ({ stream, user, renderAvatar, onOrientationChange, onBlackStateChange, onToggleFullscreen, isMirrored = true, isScreen = false, isSpeaking = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [isBlack, setIsBlack] = useState(!isScreen);

  const onOrientationChangeRef = useRef(onOrientationChange);
  useEffect(() => {
    onOrientationChangeRef.current = onOrientationChange;
  }, [onOrientationChange]);

  const onBlackStateChangeRef = useRef(onBlackStateChange);
  useEffect(() => {
    onBlackStateChangeRef.current = onBlackStateChange;
  }, [onBlackStateChange]);

  const lastReportedBlackRef = useRef<boolean | null>(null);
  const reportBlackState = useCallback((nextBlack: boolean) => {
    setIsBlack((prev) => (prev === nextBlack ? prev : nextBlack));
    if (lastReportedBlackRef.current !== nextBlack) {
      lastReportedBlackRef.current = nextBlack;
      onBlackStateChangeRef.current?.(nextBlack);
    }
  }, []);

  const checkOrientation = useCallback(() => {
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setHasFrame(true);
      const vertical = video.videoHeight > video.videoWidth;
      onOrientationChangeRef.current?.(vertical);
      return;
    }
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    if (settings && settings.width && settings.height) {
      setHasFrame(true);
      const vertical = settings.height > settings.width;
      onOrientationChangeRef.current?.(vertical);
      return;
    }
    if (isMobile && typeof window !== 'undefined' && window.innerHeight > window.innerWidth) {
      onOrientationChangeRef.current?.(true);
    }
  }, [stream]);

  const checkOrientationRef = useRef(checkOrientation);
  useEffect(() => {
    checkOrientationRef.current = checkOrientation;
  }, [checkOrientation]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.pause();
      video.srcObject = null;
      setHasFrame(false);
      reportBlackState(true);
      return;
    }

    const allVideoTracks = stream.getVideoTracks();
    const liveTracks = allVideoTracks.filter((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted);
    if (liveTracks.length === 0) {
      setHasFrame(false);
      reportBlackState(true);
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.muted = true;
    video.defaultMuted = true;

    let confirmedLiveNonBlack = false;

    const checkFrame = () => {
      const vid = videoRef.current;
      if (!vid || !stream) return;

      const hasLiveEnabledTrack = stream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled);
      if (!hasLiveEnabledTrack) {
        confirmedLiveNonBlack = false;
        setHasFrame(false);
        reportBlackState(true);
        return;
      }

      if (isScreen) {
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          confirmedLiveNonBlack = true;
          setHasFrame(true);
          reportBlackState(false);
          checkOrientationRef.current();
        }
        return;
      }

      if (vid.videoWidth > 0 && vid.videoHeight > 0 && vid.readyState >= 2 && !vid.paused && !vid.ended) {
        if (confirmedLiveNonBlack) {
          reportBlackState(false);
          setHasFrame(true);
          return;
        }
        const frameIsBlack = checkIsVideoFrameBlack(vid);
        reportBlackState(frameIsBlack);
        if (!frameIsBlack) {
          confirmedLiveNonBlack = true;
          setHasFrame(true);
          checkOrientationRef.current();
        }
      } else {
        confirmedLiveNonBlack = false;
        reportBlackState(true);
      }
    };

    video.play().then(() => {
      checkFrame();
    }).catch(() => {});

    const handleMuteOrEnd = () => {
      confirmedLiveNonBlack = false;
      setHasFrame(false);
      reportBlackState(true);
    };

    const handleUnmute = () => {
      confirmedLiveNonBlack = false;
      checkFrame();
    };

    allVideoTracks.forEach((t: MediaStreamTrack) => {
      t.addEventListener('unmute', handleUnmute);
      t.addEventListener('mute', handleMuteOrEnd);
      t.addEventListener('ended', handleMuteOrEnd);
    });

    video.addEventListener('loadeddata', checkFrame);
    video.addEventListener('loadedmetadata', checkFrame);
    video.addEventListener('canplay', checkFrame);
    video.addEventListener('playing', checkFrame);
    video.addEventListener('pause', checkFrame);
    video.addEventListener('emptied', handleMuteOrEnd);

    const freezeWatchdog = setInterval(() => {
      if (video) {
        if (video.paused && video.srcObject) {
          video.play().catch(() => {});
        }
        if (!confirmedLiveNonBlack) {
          checkFrame();
        }
      }
    }, 1500);

    return () => {
      clearInterval(freezeWatchdog);
      allVideoTracks.forEach((t: MediaStreamTrack) => {
        t.removeEventListener('unmute', handleUnmute);
        t.removeEventListener('mute', handleMuteOrEnd);
        t.removeEventListener('ended', handleMuteOrEnd);
      });
      video.removeEventListener('loadeddata', checkFrame);
      video.removeEventListener('loadedmetadata', checkFrame);
      video.removeEventListener('canplay', checkFrame);
      video.removeEventListener('playing', checkFrame);
      video.removeEventListener('pause', checkFrame);
      video.removeEventListener('emptied', handleMuteOrEnd);
      video.pause();
      video.srcObject = null;
    };
  }, [stream, isScreen, reportBlackState]);

  return (
    <div 
      onDoubleClick={onToggleFullscreen}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden rounded-3xl bg-white dark:bg-slate-900 ${onToggleFullscreen ? 'cursor-pointer' : ''}`}
    >
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFullscreen();
          }}
          aria-label="View your camera in fullscreen"
          title="View camera fullscreen"
          className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-xl border border-white/20 bg-slate-950/75 text-white shadow-lg transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 cursor-pointer"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {!isScreen && (isBlack || !stream || !hasFrame) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-900 z-10 transition-opacity duration-200">
          <div className="relative flex items-center justify-center">
            <div className={`transition-all ${isSpeaking ? 'ring-4 ring-amber-500 rounded-2xl shadow-[0_0_30px_#f59e0b]' : ''}`}>
              {renderAvatar(user, 'w-20 h-20 sm:w-28 sm:h-28 text-2xl sm:text-3xl')}
            </div>
          </div>
        </div>
      )}
      {/* Local Video Stream with optional mirror preview */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={(e) => {
          checkOrientation();
          (e.target as HTMLVideoElement).play().catch(() => {});
        }}
        onResize={checkOrientation}
        className={`w-full h-full ${isScreen ? 'object-contain' : 'object-cover'} rounded-3xl ${isMirrored && !isScreen ? 'transform scale-x-[-1]' : ''} ${(!isBlack && stream && hasFrame) ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-200`}
      />
    </div>
  );
};

// Fullscreen Stage Portal Overlay (supports Camera video, Screen Share, and Avatar "Myself" / Peer modes)
const FullscreenStageOverlay: React.FC<{
  media: {
    key: string;
    type: 'self' | 'remote-cam' | 'remote-screen' | 'remote-peer';
    stream?: MediaStream | null;
    hasLiveVideo: boolean;
    label: string;
    user: any;
    isMirrored: boolean;
    isScreen: boolean;
    isSpeaking: boolean;
    isMuted: boolean;
    isSelf: boolean;
  };
  renderAvatar: (u: any, sizeClass: string) => React.ReactNode;
  onClose: () => void;
  toggleMute?: () => void;
  toggleCamera?: () => void;
  isMuted?: boolean;
  isVideoEnabled?: boolean;
  toggleHandRaise?: () => void;
  isHandRaised?: boolean;
}> = ({
  media,
  renderAvatar,
  onClose,
  toggleMute,
  toggleCamera,
  isMuted = false,
  isVideoEnabled = false,
  toggleHandRaise,
  isHandRaised = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [isBlackFrame, setIsBlackFrame] = useState(false);
  const [isNativeFs, setIsNativeFs] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!media.stream || !media.hasLiveVideo) {
      el.pause();
      el.srcObject = null;
      setIsBlackFrame(true);
      return;
    }

    if (el.srcObject !== media.stream) {
      el.srcObject = media.stream;
    }
    el.muted = true;
    el.defaultMuted = true;

    let confirmedLiveNonBlack = false;

    const checkFrame = () => {
      const vid = videoRef.current;
      if (!vid || !media.stream) return;
      if (vid.videoWidth > 0 && vid.videoHeight > 0) {
        if (media.isScreen) {
          confirmedLiveNonBlack = true;
          setIsBlackFrame(false);
        } else if (!confirmedLiveNonBlack) {
          const black = checkIsVideoFrameBlack(vid);
          if (!black) confirmedLiveNonBlack = true;
          setIsBlackFrame(black);
        }
      }
    };

    el.play().then(checkFrame).catch(() => {});

    el.addEventListener('loadeddata', checkFrame);
    el.addEventListener('canplay', checkFrame);
    el.addEventListener('playing', checkFrame);

    const interval = setInterval(() => {
      if (el.paused && el.srcObject) {
        el.play().catch(() => {});
      }
      if (!confirmedLiveNonBlack) {
        checkFrame();
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      el.removeEventListener('loadeddata', checkFrame);
      el.removeEventListener('canplay', checkFrame);
      el.removeEventListener('playing', checkFrame);
      el.pause();
      el.srcObject = null;
    };
  }, [media.stream, media.hasLiveVideo, media.isScreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleFsChange = () => {
      setIsNativeFs(Boolean(document.fullscreenElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [onClose]);

  const toggleNativeFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          document.documentElement.requestFullscreen?.().catch(() => {});
        });
      } else {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const shouldRenderVideo = Boolean(
    media.hasLiveVideo &&
    media.stream &&
    (!isBlackFrame || media.isScreen)
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[999999] bg-slate-950 text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Top Floating Glass Bar */}
      <div className="absolute top-0 inset-x-0 p-3 sm:p-5 z-30 flex items-center justify-between bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-2.5 pointer-events-auto min-w-0">
          {/* Mode Pill */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/10 text-white text-xs font-bold flex items-center gap-2 shadow-xl shrink-0">
            {media.isScreen ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-cyan-200">Screen Share</span>
              </>
            ) : media.isSelf ? (
              <>
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-200">Myself</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-200">Camera</span>
              </>
            )}
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-xl truncate max-w-[160px] sm:max-w-md">
            <span className="truncate">{media.label}</span>
          </div>

          {/* Speaking Indicator */}
          {media.isSpeaking && (
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-lg animate-pulse shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
              <span className="hidden sm:inline">Speaking</span>
            </div>
          )}

          {/* Muted Indicator */}
          {media.isMuted && (
            <div className="px-2.5 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shrink-0">
              <MicOff className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Muted</span>
            </div>
          )}
        </div>

        {/* Action Controls Top Right */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0 ml-2">
          {shouldRenderVideo && (
            <button
              type="button"
              onClick={() => setFitMode((m) => (m === 'contain' ? 'cover' : 'contain'))}
              aria-label="Toggle fit mode"
              title={fitMode === 'contain' ? 'Switch to Fill screen' : 'Switch to Fit screen'}
              className="px-3 py-2 rounded-xl border border-white/20 bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-bold shadow-xl backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{fitMode === 'contain' ? 'Fill' : 'Fit'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleNativeFullscreen}
            aria-label="Toggle native fullscreen"
            title="Toggle native fullscreen"
            className="p-2 rounded-xl border border-white/20 bg-slate-900/80 hover:bg-slate-800 text-white shadow-xl backdrop-blur-md transition cursor-pointer"
          >
            {isNativeFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Exit fullscreen"
            title="Exit fullscreen (Esc)"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-red-600/90 hover:bg-red-500 text-white text-xs font-black shadow-xl backdrop-blur-md transition cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Main Center Stage */}
      <div
        onDoubleClick={() => {
          if (shouldRenderVideo) {
            setFitMode((m) => (m === 'contain' ? 'cover' : 'contain'));
          }
        }}
        className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-slate-950"
      >
        {/* Live Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${
            fitMode === 'contain' ? 'object-contain' : 'object-cover'
          } ${media.isMirrored && !media.isScreen ? 'transform scale-x-[-1]' : ''} ${
            shouldRenderVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
          } transition-opacity duration-300`}
        />

        {/* Fallback / Avatar Display (when video is off, black, or loading) */}
        {!shouldRenderVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 animate-fadeIn">
            <div className="relative flex items-center justify-center mb-6">
              <div
                className={`transition-all duration-300 rounded-full ${
                  media.isSpeaking
                    ? 'ring-4 ring-amber-500 shadow-[0_0_60px_rgba(245,158,11,0.5)] animate-pulse'
                    : 'shadow-2xl'
                }`}
              >
                {renderAvatar(media.user, 'w-32 h-32 sm:w-48 sm:h-48 text-5xl sm:text-7xl')}
              </div>
              {media.isSpeaking && (
                <div className="absolute -bottom-2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                  Speaking
                </div>
              )}
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white font-heading tracking-tight mb-2">
              {media.label}
            </h2>

            <p className="text-sm sm:text-base text-slate-400 max-w-md font-medium">
              {media.isSelf ? (
                isVideoEnabled ? (
                  'Starting camera video stream...'
                ) : (
                  'Your camera is currently turned off. You can turn it on using the button below.'
                )
              ) : media.isScreen ? (
                'Screen share is loading or stopped.'
              ) : (
                'Camera is currently turned off.'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Floating Action Bar */}
      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 z-30 flex items-center justify-center bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent pointer-events-none">
        {media.isSelf ? (
          <div className="flex items-center gap-2 sm:gap-3 p-2 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl pointer-events-auto">
            {/* Quick Mic Toggle */}
            {toggleMute && (
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span>{isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
              </button>
            )}

            {/* Quick Camera Toggle */}
            {toggleCamera && (
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  isVideoEnabled
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                }`}
              >
                {isVideoEnabled ? <VideoOff className="w-4 h-4 text-white" /> : <Video className="w-4 h-4 text-cyan-400" />}
                <span>{isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}</span>
              </button>
            )}

            {/* Quick Hand Raise Toggle */}
            {toggleHandRaise && (
              <button
                type="button"
                onClick={toggleHandRaise}
                aria-label={isHandRaised ? 'Lower hand' : 'Raise hand'}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  isHandRaised
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                }`}
              >
                <Hand className={`w-4 h-4 ${isHandRaised ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl pointer-events-auto text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${media.isSpeaking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              {media.isSpeaking ? 'Speaking right now' : media.isMuted ? 'Participant muted' : 'Connected'}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

interface ChatInputFormProps {
  onSendMessage: (text: string) => void;
  pendingFile: any;
  onOpenFileUpload: () => void;
  isGiphyOpen: boolean;
  onToggleGiphy: () => void;
  activeChannel: string;
  updateUser: (data: any) => void;
}

const ChatInputForm: React.FC<ChatInputFormProps> = React.memo(({
  onSendMessage,
  pendingFile,
  onOpenFileUpload,
  isGiphyOpen,
  onToggleGiphy,
  activeChannel,
  updateUser,
}) => {
  const [localText, setLocalText] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastTypingSentRef.current = 0;
    updateUser({ activity: 'Online', typing_channel: undefined, typing_at: 0 });
    if (!localText.trim() && !pendingFile) return;
    onSendMessage(localText);
    setLocalText('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalText(value);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (value.trim().length > 0) {
      const now = Date.now();
      if (now - lastTypingSentRef.current >= 2000) {
        lastTypingSentRef.current = now;
        updateUser({
          typing_channel: activeChannel,
          typing_at: now,
          activity: 'Typing...'
        });
      }

      typingTimeoutRef.current = setTimeout(() => {
        lastTypingSentRef.current = 0;
        updateUser({
          typing_channel: undefined,
          typing_at: 0,
          activity: 'Online'
        });
      }, 2200);
    } else {
      lastTypingSentRef.current = 0;
      updateUser({ 
        typing_channel: undefined, 
        typing_at: 0, 
        activity: 'Online' 
      });
    }
  };

  const canSubmit = Boolean(localText.trim() || pendingFile);

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:border-cyan-400 dark:focus-within:border-cyan-400 rounded-2xl px-2.5 sm:px-4 py-2 sm:py-3 flex items-center gap-1.5 sm:gap-3 transition-colors shadow-lg">
      <input
        type="text"
        value={localText}
        onChange={handleInputChange}
        placeholder={activeChannel.startsWith('dm-') ? 'Message private chat...' : 'Message #general...'}
        className="flex-1 min-w-0 bg-transparent text-base md:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-1.5 sm:py-2"
      />

      {/* File Attachment Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        type="button"
        onClick={onOpenFileUpload}
        className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer border border-transparent will-change-transform"
        title="Upload File or Media"
      >
        <PlusCircle className="w-5 h-5" />
      </motion.button>

      {/* GIF Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={onToggleGiphy}
        className={`shrink-0 min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold transition-colors duration-150 cursor-pointer flex items-center justify-center border will-change-transform ${
          isGiphyOpen 
            ? 'bg-cyan-500 text-white shadow-sm border-cyan-300' 
            : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
        }`}
        title="GIFs"
      >
        GIF
      </motion.button>

      {/* Send Button */}
      <motion.button
        whileHover={canSubmit ? { scale: 1.05 } : {}}
        whileTap={canSubmit ? { scale: 0.95 } : {}}
        type="submit"
        disabled={!canSubmit}
        className={`shrink-0 min-w-[38px] min-h-[38px] px-3 sm:px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer border will-change-transform ${
          canSubmit
            ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30 border-cyan-300' 
            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed border-transparent'
        }`}
      >
        <Send className="w-4 h-4 fill-current" />
      </motion.button>
    </form>
  );
});

export const ChatView: React.FC<ChatViewProps> = ({ globalChat, initialChannel }) => {
  const {
    currentUser,
    setCurrentUser,
    users,
    messages,
    updateUser,
    insertMessage,
    deleteMessage,
    deleteChannelMessages,
    registerUser,
    sendRtcSignal,
    setRtcSignalHandler,
    setMediaHandlers,
    isConnected,
    isInVideo,
    isVideoEnabled,
    isScreenSharing,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    localAudioStream,
    cameraStream,
    screenStream,
    activeVideoStream,
    remoteStreams,
    remoteScreenAudioStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking,
    joinVoiceChannel,
    stopVoiceChannel,
    micPermissionStatus,
    requestMicrophonePermission,
    micError,
    setMicError,
    cameraError,
    setCameraError,
    screenShareError,
    setScreenShareError,
    toggleCamera,
    toggleScreenShare,
  } = globalChat;

  const toggleMute = () => setIsMuted(!isMuted);

  const voiceUsers = useMemo(() => {
    return users.filter((u: any) => (u.current_channel === 'video-general' || u.current_channel === 'voice-general') && u.id !== currentUser.id);
  }, [users, currentUser.id]);

  const isUserSpeaking = useCallback((userId: string) => {
    if (userId === currentUser.id) return Boolean(globalChat.is_speaking || globalChat.isSpeaking);
    const peer = users.find((u: any) => u.id === userId);
    return Boolean(peer?.is_speaking || remoteSpeaking[userId]);
  }, [currentUser.id, globalChat.is_speaking, globalChat.isSpeaking, users, remoteSpeaking]);

  const renderUserActivity = useCallback((u: any) => {
    if (!u) return <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate block">In #general</span>;
    if (typeof u === 'string') {
      return <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate block">{u}</span>;
    }
    let text = 'In #general';
    let textColor = 'text-slate-400 dark:text-slate-500';
    if (u.is_hand_raised) {
      text = '✋ Hand Raised';
      textColor = 'text-amber-500 font-bold';
    } else if (u.current_channel === 'video-general' || u.current_channel === 'voice-general') {
      text = 'In General Voice';
      textColor = 'text-cyan-500 dark:text-cyan-400 font-semibold';
    } else if (u.current_channel && u.current_channel.startsWith('dm-')) {
      text = 'In Private Chat';
      textColor = 'text-emerald-500 font-semibold';
    } else if (u.activity === 'Typing...') {
      text = 'Typing...';
      textColor = 'text-cyan-500 dark:text-cyan-400 font-semibold animate-pulse';
    } else if (u.activity && u.activity !== 'Online' && u.activity !== 'Browsing Games' && u.activity !== 'In #general') {
      text = u.activity;
      textColor = 'text-purple-500 font-semibold';
    } else {
      text = 'In #general';
      textColor = 'text-slate-400 dark:text-slate-500';
    }
    return <span className={`text-[11px] ${textColor} font-medium truncate block`}>{text}</span>;
  }, []);

  const { activeChannel, setActiveChannel } = globalChat;
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);

  useEffect(() => {
    if (initialChannel) {
      setActiveChannel(initialChannel);
    }
  }, [initialChannel, setActiveChannel]);

  const handleStopVoice = useCallback(() => {
    stopVoiceChannel();
    setActiveChannel('text-general');
  }, [stopVoiceChannel, setActiveChannel]);

  // Automatically join voice when opening General Voice channel if not already in video
  useEffect(() => {
    if (activeChannel === 'video-general' && !isInVideo) {
      joinVoiceChannel(false);
    }
  }, [activeChannel, isInVideo, joinVoiceChannel]);





  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');



  const [messageSearch, setMessageSearch] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Filter messages for currently selected channel and active search query
  const activeChannelMessages = useMemo(() => {
    let channelMessages: any[] = [];
    if (activeChannel === 'text-general') {
      channelMessages = messages.filter((m: any) => !m.channel_id || m.channel_id === 'text-general' || m.channel_id === 'general');
    } else if (activeChannel.startsWith('dm-')) {
      channelMessages = messages.filter((m: any) => m.channel_id === activeChannel);
    }

    const q = messageSearch.trim().toLowerCase();
    if (!q) return channelMessages;

    return channelMessages.filter((m: any) => {
      const content = (m.content || '').toLowerCase();
      const sender = (m.sender_name || '').toLowerCase();
      const attachmentName = (m.attachment_name || '').toLowerCase();
      return content.includes(q) || sender.includes(q) || attachmentName.includes(q);
    });
  }, [messages, activeChannel, messageSearch]);

  // Active Typing Users for currently selected channel (General or DM)
  const typingUsers = useMemo(() => {
    const now = Date.now();
    return users.filter((u: any) => {
      if (!u || !u.id || u.id === currentUser.id) return false;

      // Direct channel typing match
      const isChannelMatch = u.typing_channel === activeChannel;
      const isTypingRecently = u.typing_at && (now - u.typing_at < 4000);

      // Fallback match for legacy/general activity
      const isFallbackMatch = u.current_channel === activeChannel && u.activity === 'Typing...' && u.updated_at && (now - u.updated_at < 4000);

      return (isChannelMatch && isTypingRecently) || isFallbackMatch;
    });
  }, [users, currentUser.id, activeChannel]);

  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Attachment Uploading States with Real Progress
  const [pendingFile, setPendingFile] = useState<{
    id: string;
    fileObj: File;
    filename: string;
    mimeType: string;
    size: number;
    previewUrl?: string;
    type: 'image' | 'video' | 'audio' | 'file';
    uploadProgress: number;
    isUploading: boolean;
    uploadedUrl: string | null;
    error: string | null;
    xhrRef?: XMLHttpRequest;
    uploadPromise: Promise<string>;
    abortUpload: () => void;
    subscribeProgress: (cb: (pct: number) => void) => () => void;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Giphy Search & Modal State using Official SDK
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [giphySearch, setGiphySearch] = useState('');
  const [activeCategoryLabel, setActiveCategoryLabel] = useState('🔥 Trending');

  // Call & Audio Level States
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const handRaiseAudioRef = useRef<HTMLAudioElement | null>(null);
  const raisedUsersRef = useRef<Set<string> | null>(null);

  const playHandRaiseSound = useCallback(() => {
    const audio = handRaiseAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  useEffect(() => {
    const raisedUsers = new Set<string>((users as any[]).filter((user) => user.is_hand_raised).map((user) => String(user.id)));
    if (raisedUsersRef.current) {
      const someoneNewRaised = [...raisedUsers].some((userId) => userId !== currentUser.id && !raisedUsersRef.current?.has(userId));
      if (someoneNewRaised) playHandRaiseSound();
    }
    raisedUsersRef.current = raisedUsers;
  }, [users, currentUser.id, playHandRaiseSound]);

  // Mobile Drawer toggles
  const [isMobileChannelsOpen, setIsMobileChannelsOpen] = useState(false);
  const [isMobileMembersOpen, setIsMobileMembersOpen] = useState(false);

  // Refs for scrolling and canvas
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Orientation and sync states
  const [localIsVertical, setLocalIsVertical] = useState(() => {
    return typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });
  const [peerOrientations, setPeerOrientations] = useState<Record<string, boolean>>({});
  const [peerCameraBlack, setPeerCameraBlack] = useState<Record<string, boolean>>({});
  const [localCameraBlack, setLocalCameraBlack] = useState<boolean>(true);
  const [fullscreenKey, setFullscreenKey] = useState<string | null>(null);

  const handleEnterFullscreen = useCallback((key: string) => {
    setFullscreenKey((prev) => (prev === key ? null : key));
    if (typeof document !== 'undefined' && document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const activeFullscreenMedia = useMemo(() => {
    if (!fullscreenKey || !isInVideo) return null;

    // You cannot full screen yourself
    if (fullscreenKey === 'self' || fullscreenKey === 'local-camera' || fullscreenKey === 'local-avatar') {
      return null;
    }

    if (fullscreenKey.startsWith('remote-cam:')) {
      const peerId = fullscreenKey.slice('remote-cam:'.length);
      const peer = voiceUsers.find((u: any) => u.id === peerId);
      if (!peer) return null;
      const camStream = remoteCameraStreams[peerId];
      const isLive = Boolean(
        camStream &&
        camStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled)
      );
      // When camera is not on, do not allow fullscreen
      if (!isLive || !camStream) return null;
      return {
        key: fullscreenKey,
        type: 'remote-cam' as const,
        stream: camStream,
        hasLiveVideo: true,
        label: `${peer.username}'s Camera`,
        user: peer,
        isScreen: false,
        isMirrored: false,
        isSpeaking: Boolean(remoteSpeaking[peerId] || peer.is_speaking),
        isMuted: Boolean(peer.is_muted),
        isSelf: false,
      };
    }

    if (fullscreenKey.startsWith('remote-screen:')) {
      const peerId = fullscreenKey.slice('remote-screen:'.length);
      const peer = voiceUsers.find((u: any) => u.id === peerId);
      if (!peer) return null;
      const scrStream = remoteScreenStreams[peerId];
      const isLive = Boolean(
        scrStream &&
        scrStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled)
      );
      if (!isLive || !scrStream) return null;
      return {
        key: fullscreenKey,
        type: 'remote-screen' as const,
        stream: scrStream,
        hasLiveVideo: true,
        label: `${peer.username}'s Screen`,
        user: peer,
        isScreen: true,
        isMirrored: false,
        isSpeaking: Boolean(remoteSpeaking[peerId] || peer.is_speaking),
        isMuted: Boolean(peer.is_muted),
        isSelf: false,
      };
    }

    return null;
  }, [
    fullscreenKey,
    isInVideo,
    voiceUsers,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking
  ]);

  useEffect(() => {
    if (fullscreenKey && !activeFullscreenMedia) {
      setFullscreenKey(null);
    }
  }, [fullscreenKey, activeFullscreenMedia]);

  // GIF items state
  const [gifs, setGifs] = useState<any[]>([]);
  const [isGifsLoading, setIsGifsLoading] = useState(false);

  const handleCategorySelect = (category: { label: string; query: string }) => {
    setActiveCategoryLabel(category.label);
    setGiphySearch(category.query);
  };

  const toggleHandRaise = () => {
    const nextState = !currentUser.is_hand_raised;
    if (nextState) playHandRaiseSound();
    setCurrentUser((prev: any) => ({ ...prev, is_hand_raised: nextState }));
    updateUser({ is_hand_raised: nextState });
  };

  // Fetch GIFs effect
  useEffect(() => {
    if (!isGiphyOpen) return;
    
    // Custom blocklist
    const blocklist = ['twerk'];
    const query = giphySearch.trim().toLowerCase();
    
    if (blocklist.some(term => query.includes(term))) {
      setGifs([]);
      setIsGifsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsGifsLoading(true);
    
    const loadGifs = async () => {
      try {
        const res = query 
          ? await gf.search(query, { limit: 24, rating: 'g' })
          : await gf.trending({ limit: 24, rating: 'g' });
        
        if (isCurrent && res?.data) {
          setGifs(res.data);
        }
      } catch (err) {
        console.warn('Giphy fetch error:', err);
      } finally {
        if (isCurrent) setIsGifsLoading(false);
      }
    };
    loadGifs();
    return () => { isCurrent = false; };
  }, [isGiphyOpen, giphySearch]);

  // Sync scroll to bottom on new messages - Smart Scroll Logic
  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;

    // Even smaller threshold for mobile to avoid jumping while reading
    const threshold = 60; 
    const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
    const lastMsg = messages[messages.length - 1];
    const isFromMe = lastMsg?.sender_id === currentUser.id;

    // Only auto-scroll if near bottom or if I sent the message
    if (isNearBottom || isFromMe) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, currentUser.id]);

  useEffect(() => {
    setEditName(currentUser.username);
    setEditColor(currentUser.avatar_color || 'var(--vibrant-cyan)');
    setEditAvatarUrl(currentUser.avatar_url || '');
  }, [currentUser.username, currentUser.avatar_color, currentUser.avatar_url]);

  const [isAvatarProcessing, setIsAvatarProcessing] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);

  const handleProfileAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploadError(null);
    setIsAvatarProcessing(true);
    try {
      const optimizedDataUrl = await processAvatarImage(file, 256);
      setEditAvatarUrl(optimizedDataUrl);
    } catch (err: any) {
      console.error('[Avatar upload error]:', err);
      setAvatarUploadError(err?.message || 'Failed to process avatar image. Please try another file.');
    } finally {
      setIsAvatarProcessing(false);
      e.target.value = '';
    }
  };

  const saveProfile = () => {
    const updatedUser = { ...currentUser, username: editName, avatar_color: editColor, avatar_url: editAvatarUrl };
    setCurrentUser(updatedUser);
    localStorage.setItem('frosthub_chat_username', editName);
    localStorage.setItem('frosthub_chat_usercolor', editColor);
    persistAvatarUrl(editAvatarUrl);
    
    updateUser({ username: editName, avatar_color: editColor, avatar_url: editAvatarUrl });
    registerUser(updatedUser);
    
    setIsProfileModalOpen(false);
  };

  // Helper to render user avatar (supports custom image upload / URL or colored initials fallback with robust error handling)
  const renderAvatar = (u: { username: string; avatar_color?: string; avatar_url?: string }, sizeClass: string = 'w-9 h-9 text-xs') => {
    return (
      <UserAvatar
        username={u.username}
        avatarColor={u.avatar_color}
        avatarUrl={u.avatar_url}
        sizeClass={sizeClass}
      />
    );
  };

  const isMediaActive = activeChannel === 'video-general' || isInVideo;

  const handleChannelSelect = (channel: string) => {
    setActiveChannel(channel);
    setIsMobileChannelsOpen(false);
    if (channel === 'video-general') {
      const newActivity = 'In General Voice';
      setCurrentUser((prev: any) => ({ ...prev, current_channel: 'video-general', activity: newActivity }));
      updateUser({ current_channel: 'video-general', activity: newActivity });
      if (!isInVideo) {
        joinVoiceChannel(false);
      }
    } else if (!isInVideo) {
      let newActivity = 'In #general';
      if (channel.startsWith('dm-')) newActivity = 'In Private Chat';
      setCurrentUser((prev: any) => ({ ...prev, current_channel: channel as any, activity: newActivity }));
      updateUser({ current_channel: channel as any, activity: newActivity });
    }
  };

  // FILE SELECTION AND FAST BINARY UPLOAD (0ms instant preview + parallel upload)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Abort any previous unsubmitted upload
    if (pendingFile?.isUploading) {
      try {
        pendingFile.abortUpload();
      } catch {}
    }

    // Search comprehensive list of literally every audio extension
    const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|oga|ogv|flac|aac|m4a|opus|weba|aiff?|wma|alac|midi?|amr|ac3|dts|ape|ra|ram|caf|mka|spx|voc|xm|it|mod|s3m|3gp)$/i;

    let attachmentType: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name)) attachmentType = 'image';
    else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogg|m4v|avi)$/i.test(file.name)) attachmentType = 'video';
    else if (file.type.startsWith('audio/') || AUDIO_EXT_REGEX.test(file.name)) attachmentType = 'audio';

    const localPreview =
      attachmentType === 'image' || attachmentType === 'video' || attachmentType === 'audio'
        ? URL.createObjectURL(file)
        : undefined;

    const pendingId = 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const xhr = new XMLHttpRequest();
    const progressListeners = new Set<(pct: number) => void>();

    const subscribeProgress = (cb: (pct: number) => void) => {
      progressListeners.add(cb);
      return () => {
        progressListeners.delete(cb);
      };
    };

    const readSmallFileFallback = (): Promise<string> =>
      new Promise((resolve, reject) => {
        if (file.size > 600 * 1024) {
          reject(new Error('Upload failed. Files over 600 KB require server upload availability.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read attachment file.'));
        reader.readAsDataURL(file);
      });

    let settled = false;
    const uploadPromise = new Promise<string>((resolve, reject) => {
      const emitProgress = (pct: number) => {
        progressListeners.forEach((cb) => {
          try {
            cb(pct);
          } catch {}
        });
        setPendingFile((prev) =>
          prev && prev.id === pendingId ? { ...prev, uploadProgress: pct } : prev
        );
      };

      const handleSuccess = (finalUrl: string) => {
        if (settled) return;
        settled = true;
        emitProgress(100);
        setPendingFile((prev) =>
          prev && prev.id === pendingId
            ? { ...prev, uploadProgress: 100, isUploading: false, uploadedUrl: finalUrl, error: null }
            : prev
        );
        resolve(finalUrl);
      };

      const handleFailure = async (statusMsg: string) => {
        if (settled) return;
        try {
          const dataUrl = await readSmallFileFallback();
          handleSuccess(dataUrl);
        } catch (fallbackErr: any) {
          if (settled) return;
          settled = true;
          const errMessage = fallbackErr?.message || statusMsg || 'Upload failed';
          setPendingFile((prev) =>
            prev && prev.id === pendingId
              ? { ...prev, isUploading: false, error: errMessage }
              : prev
          );
          reject(new Error(errMessage));
        }
      };

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percentComplete = Math.min(99, Math.round((event.loaded / event.total) * 100));
          emitProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response?.url) {
              handleSuccess(response.url);
              return;
            }
          } catch {}
        }
        void handleFailure(`Upload failed (${xhr.status || 'server error'})`);
      };

      xhr.onerror = () => {
        void handleFailure('Network error while uploading');
      };

      xhr.onabort = () => {
        if (settled) return;
        settled = true;
        reject(new Error('Upload cancelled'));
      };

      xhr.open(
        'POST',
        `/api/upload?filename=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type || 'application/octet-stream')}`
      );
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
      xhr.setRequestHeader('X-Mime-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });

    const abortUpload = () => {
      try {
        xhr.abort();
      } catch {}
    };

    // Show preview in 0ms immediately (no waiting on FileReader base64!)
    setPendingFile({
      id: pendingId,
      fileObj: file,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      previewUrl: localPreview,
      type: attachmentType,
      uploadProgress: 0,
      isUploading: true,
      uploadedUrl: null,
      error: null,
      xhrRef: xhr,
      uploadPromise,
      abortUpload,
      subscribeProgress,
    });

    e.target.value = '';
  };

  const cancelPendingFile = () => {
    if (pendingFile) {
      pendingFile.abortUpload();
    }
    setPendingFile(null);
  };

  // Submit Message immediately (0ms optimistic render; completes upload in background if still uploading)
  const handleSendMessage = useCallback(
    (textToSend: string) => {
      updateUser({ activity: 'Online', typing_channel: undefined, typing_at: 0 });
      if (!textToSend.trim() && !pendingFile) return;

      if (pendingFile) {
        if (pendingFile.error && !pendingFile.uploadedUrl) {
          return;
        }

        const currentPending = pendingFile;
        setPendingFile(null);

        if (currentPending.uploadedUrl) {
          void insertMessage(textToSend, activeChannel, {
            url: currentPending.uploadedUrl,
            type: currentPending.type,
            name: currentPending.filename,
          });
        } else {
          void insertMessage(textToSend, activeChannel, {
            url: currentPending.previewUrl || '',
            type: currentPending.type,
            name: currentPending.filename,
            uploadPromise: currentPending.uploadPromise,
            abortUpload: currentPending.abortUpload,
            subscribeProgress: currentPending.subscribeProgress,
          });
        }
        return;
      }

      void insertMessage(textToSend, activeChannel);
    },
    [pendingFile, activeChannel, insertMessage, updateUser]
  );

  // Helper to reliably download image, video, audio, or any file attachment
  const downloadAttachment = useCallback((url: string, filename: string) => {
    if (!url) return;
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename || 'download')}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Helper to categorize attachment into image, video, audio, or unknown
  const getAttachmentCategory = useCallback((url?: string, name?: string, type?: string): 'image' | 'video' | 'audio' | 'unknown' => {
    const cleanUrl = (url || '').toLowerCase();
    const cleanName = (name || '').toLowerCase();
    const cleanType = (type || '').toLowerCase();

    // Comprehensive audio file extension detection
    const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|oga|ogv|flac|aac|m4a|opus|weba|aiff?|wma|alac|midi?|amr|ac3|dts|ape|ra|ram|caf|mka|spx|voc|xm|it|mod|s3m|3gp)(\?.*)?$/i;

    if (
      cleanType === 'video' ||
      cleanUrl.startsWith('data:video/') ||
      /\.(mp4|webm|mov|mkv|ogg|m4v|avi)(\?.*)?$/i.test(cleanUrl) ||
      /\.(mp4|webm|mov|mkv|ogg|m4v|avi)$/i.test(cleanName)
    ) {
      return 'video';
    }

    if (
      cleanType === 'image' ||
      cleanType === 'gif' ||
      cleanUrl.startsWith('data:image/') ||
      cleanUrl.includes('giphy.com') ||
      /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(cleanUrl) ||
      /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(cleanName)
    ) {
      return 'image';
    }

    if (
      cleanType === 'audio' ||
      cleanUrl.startsWith('data:audio/') ||
      AUDIO_EXT_REGEX.test(cleanUrl) ||
      AUDIO_EXT_REGEX.test(cleanName)
    ) {
      return 'audio';
    }

    return 'unknown';
  }, []);

  // Select Giphy GIF from Official SDK Grid
  const selectGiphyGif = (gif: any) => {
    const gifUrl = gif.images?.original?.url || gif.images?.downsized_medium?.url || gif.images?.fixed_height?.url;
    if (!gifUrl) return;
    
    insertMessage('', activeChannel, {
      url: gifUrl,
      type: 'image',
      name: 'gif.gif',
    });
    setIsGiphyOpen(false);
  };

  return (
    <div className="flex flex-1 min-h-0 h-full w-full bg-[var(--bg-white)]/95 dark:bg-[var(--brand-navy-bg)] text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden select-none transition-colors">
      <audio ref={handRaiseAudioRef} src="/hand-raise.mp3" preload="auto" className="hidden" aria-hidden="true" />
      
      {/* Hidden Global File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        style={{ display: 'none' }} 
        accept="*"
      />

      {/* LEFT NAVIGATION SIDEBAR - Desktop & Tablet view */}
      <aside className="hidden md:flex w-60 lg:w-72 bg-[var(--bg-light)] dark:bg-[var(--brand-navy-surface)] border-r border-slate-200 dark:border-[var(--brand-navy-border)] flex-col justify-between shrink-0 overflow-hidden">
        <div className="p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
          
          {/* Header Branding */}
          <div className="flex items-center justify-center py-4 pb-6 border-b border-slate-200 dark:border-slate-800 shrink-0 w-full">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
              className="cursor-pointer"
            >
              <FrostHubLogo variant="community" size="lg" />
            </motion.div>
          </div>

          {/* CHANNELS SECTION */}
          <div className="space-y-6">
            
            {/* Text Channels */}
            <div className="space-y-2">
              <div className="px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase">
                Text Channels
              </div>

              {/* General Text Channel */}
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChannelSelect('text-general')}
                className={`w-full px-4 py-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                  activeChannel === 'text-general'
                    ? 'bg-cyan-500 text-white font-black shadow-xl shadow-cyan-500/20 border-cyan-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Hash className="w-4 h-4 opacity-70" />
                  <span className="text-sm font-bold">general</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black border ${
                  activeChannel === 'text-general' ? 'bg-white/20 border-white/20' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  {messages.filter((m: any) => !m.channel_id || m.channel_id === 'text-general' || m.channel_id === 'general').length}
                </span>
              </motion.button>
            </div>

            {/* Voice Channels */}
            <div className="space-y-2">
              <div className="px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase flex items-center justify-between">
                <span>Voice Channels</span>
              </div>

              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleChannelSelect('video-general')}
                className={`w-full px-4 py-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                  activeChannel === 'video-general'
                    ? 'bg-cyan-500 text-white font-black shadow-xl shadow-cyan-500/20 border-cyan-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Mic className={`w-4 h-4 ${activeChannel === 'video-general' ? 'text-white' : 'text-cyan-500 dark:text-cyan-400'}`} />
                  <span className="text-sm font-bold">General Voice</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black border ${
                  activeChannel === 'video-general' ? 'bg-white/20 border-white/20' : 'bg-blue-50 dark:bg-blue-900/40 border-blue-100 dark:border-blue-800 text-cyan-500 dark:text-cyan-300'
                }`}>
                  {voiceUsers.length + (isInVideo ? 1 : 0)}
                </span>
              </motion.button>
            </div>


            
            
            
          </div>
        </div>

        {/* CURRENT USER FOOTER */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <motion.div 
            whileHover={{ scale: 1.01 }}
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-3 min-w-0 cursor-pointer p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex-1"
          >
            <div className="relative shrink-0">
              {renderAvatar(currentUser, 'w-10 h-10 text-xs')}
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-sm bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </div>

            <div className="min-w-0">
              <div className="font-black text-slate-900 dark:text-white text-sm truncate tracking-tight">
                {currentUser.username}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Active Now</div>
            </div>
          </motion.div>

          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isMuted ? 'text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>

      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col bg-[var(--bg-white)] dark:bg-[var(--brand-navy-bg)] min-w-0 min-h-0 relative overflow-hidden">
        
        {/* TEXT CHANNEL & PRIVATE CHAT VIEW */}
        {(activeChannel === 'text-general' || activeChannel.startsWith('dm-')) && (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            
            {/* Center Chat Messages Column */}
            <div className="flex-1 min-h-0 flex flex-col min-w-0 relative overflow-hidden">
              
              {/* Top Header */}
              <header className="hub-glass-header h-14 sm:h-16 md:h-20 px-3 sm:px-6 flex items-center justify-between shrink-0 gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Channels button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileChannelsOpen(true)}
                    className="md:hidden min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Open Channels"
                  >
                    <Menu className="w-5 h-5" />
                  </button>

                  {activeChannel.startsWith('dm-') ? (
                    <>
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">Private Chat</span>
                    </>
                  ) : (
                    <>
                      <Hash className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 dark:text-white shrink-0" />
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">general</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsMobileMembersOpen(true)}
                    className="px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-cyan-500 dark:text-cyan-300 border border-blue-100 dark:border-blue-800 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    title="View Online Members"
                  >
                    <span className="w-1.5 h-1.5 rounded-sm bg-cyan-400" />
                    <span>{users.length} online</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {/* Mobile Search Toggle */}
                  <button
                    type="button"
                    onClick={() => setIsMobileSearchOpen((prev) => !prev)}
                    className={`sm:hidden min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-xl transition-colors cursor-pointer ${
                      isMobileSearchOpen || messageSearch
                        ? 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                        : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Search Messages"
                  >
                    <Search className="w-4 h-4" />
                  </button>

                  {/* Desktop/Tablet Search Input */}
                  <div className="relative hidden sm:block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input 
                      type="text"
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Search messages"
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-base md:text-xs text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-9 pr-7 py-2 w-36 md:w-44 lg:w-52 focus:outline-none focus:border-cyan-400 transition-all"
                    />
                    {messageSearch && (
                      <button
                        type="button"
                        onClick={() => setMessageSearch('')}
                        className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Mobile / Tablet Members drawer toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileMembersOpen(true)}
                    className="lg:hidden min-w-[38px] min-h-[38px] flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer gap-1 text-xs font-bold"
                    title="View Members"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline text-[11px] text-slate-400">{users.length}</span>
                  </button>
                </div>
              </header>

              {/* Mobile Expandable Search Bar */}
              {isMobileSearchOpen && (
                <div className="sm:hidden px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Search messages..."
                      autoFocus
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-base text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-cyan-400"
                    />
                    {messageSearch && (
                      <button
                        type="button"
                        onClick={() => setMessageSearch('')}
                        className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Chat Scroll Area (Messages) */}
              <div 
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 sm:space-y-6"
              >
                {messageSearch.trim() && (
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-cyan-50/98 dark:bg-slate-900/98 border border-cyan-200 dark:border-cyan-500/30 shadow-sm text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {activeChannelMessages.length} {activeChannelMessages.length === 1 ? 'match' : 'matches'} for &ldquo;{messageSearch}&rdquo;
                    </span>
                    <button
                      type="button"
                      onClick={() => setMessageSearch('')}
                      className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {messageSearch.trim() && activeChannelMessages.length === 0 && (
                  <div className="py-12 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                    No messages matching &ldquo;{messageSearch}&rdquo;
                  </div>
                )}

                {/* Messages List */}
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {activeChannelMessages.map((msg: any) => {
                      const msgUser = users.find((u: any) => u.id === msg.sender_id);
                      const displayUsername = msgUser?.username || msg.sender_name;
                      const displayAvatarColor = msgUser?.avatar_color || msg.avatar_color;
                      const displayAvatarUrl = msgUser?.avatar_url || msg.sender_avatar_url;

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-start gap-2.5 sm:gap-3.5 group hover:bg-slate-50 dark:hover:bg-slate-900/40 -mx-2 sm:-mx-4 px-2 sm:px-4 py-1.5 rounded-xl transition-colors"
                        >
                          <div className="shrink-0">
                            {renderAvatar({ username: displayUsername, avatar_color: displayAvatarColor, avatar_url: displayAvatarUrl }, 'w-8 h-8 sm:w-10 sm:h-10 text-xs')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="font-extrabold text-slate-900 dark:text-white text-sm hover:underline cursor-pointer truncate max-w-full">
                                {displayUsername}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                                {msg.timestamp}
                              </span>
                            </div>
                          
                          {msg.content && (
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words whitespace-pre-wrap mt-0.5">
                              {msg.content}
                            </p>
                          )}

                          {/* Attachment Rendering */}
                          {(msg.attachment_url || msg.is_uploading || msg.upload_error) && (() => {
                            const category = getAttachmentCategory(msg.attachment_url, msg.attachment_name, msg.attachment_type);

                            if (category === 'audio' && msg.attachment_url) {
                              return (
                                <div className="mt-2 max-w-full">
                                  <AudioAttachmentPlayer
                                    url={msg.attachment_url}
                                    name={msg.attachment_name}
                                    onDownload={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'audio.mp3')}
                                  />
                                </div>
                              );
                            }

                            if (category === 'video' && msg.attachment_url) {
                              return (
                                <div className="mt-2 space-y-2 max-w-full sm:max-w-lg">
                                  {msg.attachment_name && (
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                      {msg.attachment_name}
                                    </p>
                                  )}
                                  <video
                                    src={msg.attachment_url}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="max-h-60 sm:max-h-80 max-w-full w-auto rounded-xl bg-black border border-slate-200 dark:border-white/10"
                                  />
                                  {!msg.is_uploading && !msg.upload_error && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'video.mp4')}
                                        className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-[#1a1a24] hover:bg-slate-200 dark:hover:bg-[#252534] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            if (category === 'image' && msg.attachment_url) {
                              return (
                                <div className="mt-2 space-y-2 block max-w-full sm:max-w-md">
                                  {msg.attachment_name && msg.attachment_name !== 'gif.gif' && (
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                      {msg.attachment_name}
                                    </p>
                                  )}
                                  <img
                                    src={msg.attachment_url}
                                    alt={msg.attachment_name || 'Attachment'}
                                    className="max-h-60 sm:max-h-80 max-w-full w-auto object-contain rounded-xl border border-slate-200 dark:border-white/10 bg-black/5 dark:bg-black/20"
                                  />
                                  {!msg.is_uploading && !msg.upload_error && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'image.png')}
                                        className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-[#1a1a24] hover:bg-slate-200 dark:hover:bg-[#252534] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div className="mt-2 p-2.5 sm:p-3 bg-slate-100 dark:bg-[#121218] border border-slate-200 dark:border-[#22222e] rounded-xl w-full max-w-full sm:max-w-sm flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate min-w-0 flex-1">
                                  {msg.attachment_name || 'Attachment'}
                                </span>
                                {msg.attachment_url && !msg.is_uploading && !msg.upload_error && (
                                  <button
                                    type="button"
                                    onClick={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'attachment')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {msg.is_uploading && (
                            <div className="mt-2 max-w-xs space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                                <span>Sending attachment...</span>
                                <span>{msg.upload_progress ?? 0}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-sm overflow-hidden">
                                <div
                                  className="h-full bg-cyan-500 transition-all duration-150 rounded-sm"
                                  style={{ width: `${msg.upload_progress ?? 0}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {msg.upload_error && (
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{msg.upload_error}</span>
                            </div>
                          )}

                        </div>
                        <div className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => deleteMessage(msg.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Delete message"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* Attachment Preview Before Sending */}
              {pendingFile && (
                <div className="shrink-0 mx-2.5 sm:mx-4 mb-2 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl relative shadow-lg">
                  <div className="flex flex-wrap sm:flex-nowrap items-start gap-2.5 sm:gap-3">
                    {/* If Image: Show actual image preview */}
                    {pendingFile.type === 'image' && pendingFile.previewUrl && (
                      <div className="relative max-w-full">
                        <img 
                          src={pendingFile.previewUrl} 
                          alt="Attachment preview" 
                          className="max-h-36 sm:max-h-40 max-w-full sm:max-w-xs rounded-xl object-contain bg-black/40 border border-slate-200 dark:border-white/10" 
                        />
                      </div>
                    )}

                    {/* If Video: Show actual video player */}
                    {pendingFile.type === 'video' && pendingFile.previewUrl && (
                      <div className="relative max-w-full">
                        <video 
                          src={pendingFile.previewUrl} 
                          controls 
                          playsInline 
                          className="max-h-36 sm:max-h-40 max-w-full sm:max-w-xs rounded-xl bg-black border border-slate-200 dark:border-white/10" 
                        />
                      </div>
                    )}

                    {/* If Audio: Show actual audio player tailored for that extension */}
                    {pendingFile.type === 'audio' && pendingFile.previewUrl && (
                      <div className="flex-1 min-w-0">
                        <AudioAttachmentPlayer
                          url={pendingFile.previewUrl}
                          name={pendingFile.filename}
                          showDownload={false}
                        />
                      </div>
                    )}

                    {/* If File/Other: Clean file info */}
                    {pendingFile.type === 'file' && (
                      <div className="flex-1 min-w-0 flex items-center gap-2.5 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <FileText className="w-6 h-6 text-cyan-500 dark:text-cyan-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{pendingFile.filename}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{(pendingFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    )}

                    {/* Upload progress & error info */}
                    {pendingFile.isUploading && (
                      <div className="flex-1 min-w-[140px] self-center">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Uploading... (you can send now)</span>
                            <span>{pendingFile.uploadProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-sm overflow-hidden">
                            <div 
                              className="h-full bg-cyan-400 transition-all duration-150 rounded-sm" 
                              style={{ width: `${pendingFile.uploadProgress}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {pendingFile.error && (
                      <div className="flex-1 min-w-[140px] self-center text-xs font-semibold text-red-500 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{pendingFile.error}</span>
                      </div>
                    )}

                    {/* Remove button */}
                    <button 
                      type="button"
                      onClick={cancelPendingFile}
                      className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* GIPHY POPOVER MODAL */}
              {isGiphyOpen && (
                <div className="absolute bottom-16 sm:bottom-20 left-2 right-2 sm:left-4 sm:right-4 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 sm:p-4 max-w-xl mx-auto max-h-[min(60dvh,26rem)] flex flex-col space-y-2.5 sm:space-y-3">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">GIFs</span>
                    <button 
                      onClick={() => setIsGiphyOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search Bar Input */}
                  <div className="relative shrink-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input 
                      type="text" 
                      value={giphySearch}
                      onChange={(e) => {
                        setGiphySearch(e.target.value);
                        setActiveCategoryLabel('');
                      }}
                      placeholder="Search GIFs..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-base md:text-xs text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:border-cyan-400 transition-all"
                      autoFocus
                    />
                    {giphySearch && (
                      <button 
                        onClick={() => {
                          setGiphySearch('');
                          setActiveCategoryLabel('🔥 Trending');
                        }}
                        className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category Pills Bar */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none shrink-0">
                    {GIPHY_CATEGORIES.map((cat) => {
                      const isActive = activeCategoryLabel === cat.label || (cat.query && giphySearch.toLowerCase() === cat.query.toLowerCase());
                      return (
                        <button
                          key={cat.label}
                          onClick={() => handleCategorySelect(cat)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shrink-0 border ${
                            isActive
                              ? 'bg-cyan-500 border-cyan-400 text-white shadow-md shadow-cyan-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Native GIF Grid */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    {isGifsLoading ? (
                      <div className="py-12 flex items-center justify-center text-xs text-slate-400">
                        Loading GIFs...
                      </div>
                    ) : gifs.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {gifs.map((gif) => (
                          <button
                            key={gif.id}
                            type="button"
                            onClick={() => selectGiphyGif(gif)}
                            className="relative aspect-video rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer group border border-slate-200 dark:border-slate-700"
                          >
                            <img
                              src={gif.images?.fixed_width?.url}
                              alt={gif.title || 'GIF'}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No GIFs found
                      </div>
                    )}
                  </div>

                </div>
              )}

              <div className="px-2.5 sm:px-4 pb-2.5 sm:pb-4 pt-0 shrink-0">
                {/* Active Typing Indicator Bar */}
                <AnimatePresence>
                  {typingUsers.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: 4, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="px-2 pb-2 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 overflow-hidden select-none"
                    >
                      {/* Animated Bouncing Dots */}
                      <span className="flex items-center gap-1 shrink-0 px-1.5 py-1 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:text-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:text-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:text-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>

                      {/* Formatted Typing String - Shows names and count for clarity */}
                      <span className="truncate">
                        {typingUsers.length === 1 && (
                          <span>
                            <strong className="text-slate-900 dark:text-white font-bold">{typingUsers[0].username}</strong> is typing...
                          </span>
                        )}
                        {typingUsers.length > 1 && (
                          <span>
                            <strong className="text-slate-900 dark:text-white font-bold">{typingUsers.length} people</strong> are typing: {typingUsers.map((u: any) => u.username).join(', ')}
                          </span>
                        )}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <ChatInputForm
                  onSendMessage={handleSendMessage}
                  pendingFile={pendingFile}
                  onOpenFileUpload={() => fileInputRef.current?.click()}
                  isGiphyOpen={isGiphyOpen}
                  onToggleGiphy={() => setIsGiphyOpen(!isGiphyOpen)}
                  activeChannel={activeChannel}
                  updateUser={updateUser}
                />
              </div>


            </div>

            {/* Right Sidebar: Member List - Desktop */}
            <aside className="hidden lg:flex w-64 bg-slate-50 dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 p-4 flex-col shrink-0 overflow-hidden">
              
              {/* ONLINE MEMBERS HEADER */}
              <div className="shrink-0 pb-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                  <span>ONLINE — {users.length}</span>
                </div>
              </div>

              {/* ONLY ONLINE LIST IS SCROLLABLE */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pt-3 pr-1">
                {users.map((u: any) => (
                  <div key={u.id} className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="relative shrink-0">
                      {renderAvatar(u, 'w-9 h-9 text-xs')}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                          {u.username}
                        </span>
                        {u.is_hand_raised && <Hand className="w-3 h-3 text-amber-500 shrink-0" />}
                        {u.id === currentUser.id && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                            (you)
                          </span>
                        )}
                      </div>
                      {/* Live User Presence Activity */}
                      {renderUserActivity(u.activity || (u.current_channel === 'video-general' ? 'In General Voice' : 'In #general'))}
                    </div>


                  </div>
                ))}
              </div>



            </aside>

            {/* Mobile / Tablet Members Drawer Overlay */}
            {isMobileMembersOpen && (
              <div className="fixed inset-0 z-[250] lg:hidden flex justify-end animate-in fade-in duration-200">
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setIsMobileMembersOpen(false)}
                />
                <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
                  <div className="shrink-0 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      <span>ONLINE — {users.length}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMembersOpen(false)}
                      className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pt-3 pr-1">
                    {users.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="relative shrink-0">
                          {renderAvatar(u, 'w-9 h-9 text-xs')}
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">
                              {u.username}
                            </span>
                            {u.is_hand_raised && <Hand className="w-3 h-3 text-amber-500 shrink-0" />}
                            {u.id === currentUser.id && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                                (you)
                              </span>
                            )}
                          </div>
                          {renderUserActivity(u.activity || (u.current_channel === 'video-general' ? 'In General Voice' : 'In #general'))}
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            )}

          </div>
        )}

        {/* VOICE & CALL ROOM VIEW */}
        {activeChannel === 'video-general' && (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            
            {/* Main Stage Area */}
            <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors">
              
              {/* Top Header */}
              <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 gap-2 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Channels button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileChannelsOpen(true)}
                    className="md:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Open Channels"
                  >
                    <Menu className="w-5 h-5" />
                  </button>

                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-500 dark:text-cyan-300 shrink-0">
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate font-heading">General Voice</span>
                    </div>
                    <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate block">
                      {voiceUsers.length + (isInVideo ? 1 : 0)} connected
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    onClick={toggleScreenShare}
                    className={`px-2.5 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border transition-all cursor-pointer ${
                      isScreenSharing ? 'bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-500/30' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span className="hidden sm:inline">{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
                  </button>

                  {/* Mobile / Tablet Members drawer toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileMembersOpen(true)}
                    className="lg:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="View Members"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400">{voiceUsers.length + (isInVideo ? 1 : 0)}</span>
                  </button>
                </div>
              </div>

              {(micError || cameraError || screenShareError) && (
                <div className="mx-3 sm:mx-6 mt-3 p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-start justify-between gap-3 text-xs text-amber-700 dark:text-amber-200 shrink-0">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      {micError && <span>Microphone: {micError}</span>}
                      {cameraError && <span>Camera: {cameraError}</span>}
                      {screenShareError && <span>Screen share: {screenShareError}</span>}
                      {micError && (
                        <button type="button" onClick={() => void requestMicrophonePermission()} className="mt-1 w-fit underline font-bold cursor-pointer">
                          Retry microphone access
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMicError(null); setCameraError(null); setScreenShareError(null); }}
                    aria-label="Dismiss media warning"
                    className="p-1 text-slate-400 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Voice / Video Stage Grid */}
              <div className="flex-1 min-h-0 p-3 sm:p-6 pb-24 sm:pb-28 flex flex-col items-center justify-start sm:justify-center overflow-y-auto">
                
                {isInVideo ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center justify-center gap-3 sm:gap-6 w-full max-w-6xl my-auto p-1 sm:p-2">
                    
                    {/* Local Camera Tile & Local Avatar Tile */}
                    {(() => {
                      const isLocalCameraActive = Boolean(
                        isVideoEnabled && 
                        cameraStream && 
                        cameraStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled)
                      );
                      const isLocalDisplayingVideo = isLocalCameraActive && !localCameraBlack;

                      return (
                        <>
                          {isLocalCameraActive && (
                            <div className={`relative mx-auto rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-2xl ${
                              isLocalDisplayingVideo && localIsVertical 
                                ? 'aspect-[9/16] w-full max-w-[260px] sm:max-w-[320px] max-h-[520px]' 
                                : 'aspect-video w-full max-w-[500px]'
                            } ${
                              isUserSpeaking(currentUser.id) ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                            }`}>
                              <LocalVideoPlayer 
                                stream={cameraStream} 
                                user={currentUser}
                                renderAvatar={renderAvatar}
                                onOrientationChange={setLocalIsVertical}
                                onBlackStateChange={setLocalCameraBlack}
                                isMirrored={true}
                                isSpeaking={isUserSpeaking(currentUser.id)}
                              />

                              {/* Orientation Badge */}
                              {isLocalDisplayingVideo && (
                                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none">
                                  {localIsVertical ? (
                                    <>
                                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Portrait</span>
                                    </>
                                  ) : (
                                    <>
                                      <Monitor className="w-3.5 h-3.5 text-cyan-300" />
                                      <span>Landscape</span>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Hand Raised Indicator */}
                              {currentUser.is_hand_raised && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-amber-500/90 backdrop-blur-md border border-amber-400 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none animate-bounce">
                                  <Hand className="w-3.5 h-3.5" />
                                  <span>Hand Raised</span>
                                </div>
                              )}

                              {/* Bottom-Left Overlay */}
                              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                  {currentUser.username} {isLocalDisplayingVideo ? '(You - Camera)' : '(You)'}
                                </div>
                                {isMuted && <MicOff className="w-4 h-4 text-red-400 shrink-0" />}
                              </div>
                            </div>
                          )}

                          {/* Avatar Tile (shown when camera is completely off) */}
                          {!isLocalCameraActive && (
                            <div className={`relative mx-auto rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-xl aspect-video w-full max-w-[500px] ${
                              isUserSpeaking(currentUser.id) ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                            }`}>
                              <div className="relative flex items-center justify-center">
                                <div className={`transition-all ${isUserSpeaking(currentUser.id) ? 'ring-4 ring-amber-500 rounded-2xl shadow-[0_0_30px_#f59e0b]' : ''}`}>
                                  {renderAvatar(currentUser, 'w-20 h-20 sm:w-28 sm:h-28 text-2xl sm:text-3xl')}
                                </div>
                              </div>

                              {/* Hand Raised Indicator */}
                              {currentUser.is_hand_raised && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-amber-500/90 backdrop-blur-md border border-amber-400 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none animate-bounce">
                                  <Hand className="w-3.5 h-3.5" />
                                  <span>Hand Raised</span>
                                </div>
                              )}
                              {/* Bottom-Left Overlay */}
                              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-sm font-extrabold text-white">
                                  {currentUser.username} (You)
                                </div>
                                {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Local Screen Share Tile - Shows you are sharing (no video preview for self) */}
                    {isScreenSharing && (
                      <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-cyan-400/40 transition-all duration-300 flex flex-col items-center justify-center shadow-xl aspect-video w-full max-w-[500px]">
                        <div className="flex flex-col items-center justify-center gap-4 text-cyan-500 dark:text-cyan-300">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center shadow-lg shadow-cyan-400/10">
                            <Monitor className="w-8 h-8 text-cyan-500 dark:text-cyan-300" />
                          </div>
                          <div className="text-center px-4">
                            <span className="text-base font-bold text-slate-900 dark:text-white block font-heading">You are sharing your screen</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block font-medium">Live stream is visible to other participants</span>
                          </div>
                        </div>

                        {/* Bottom-Left Overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-auto">
                          <div className="text-sm font-extrabold text-white flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-cyan-300" />
                            <span>Your Screen (Sharing)</span>
                          </div>
                          <button
                            type="button"
                            onClick={toggleScreenShare}
                            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all cursor-pointer"
                          >
                            Stop Sharing
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Remote Peers Tiles */}
                    {voiceUsers.map((u: any) => {
                      const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                      const camStream = remoteCameraStreams[u.id];
                      const scrStream = remoteScreenStreams[u.id];

                      const hasCamera = Boolean(
                        camStream &&
                        camStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled)
                      );
                      const hasScreen = Boolean(
                        scrStream &&
                        scrStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled)
                      );
                      const isPeerCameraVertical = Boolean(peerOrientations[`${u.id}-camera`]);
                      const isPeerCameraBlack = Boolean(peerCameraBlack[u.id]);
                      const isPeerDisplayingVideo = hasCamera && !isPeerCameraBlack;

                      return (
                        <React.Fragment key={u.id}>
                          {/* Dedicated Remote Camera Tile (when camera is on) */}
                          {hasCamera && (
                            <div 
                              onDoubleClick={() => handleEnterFullscreen(`remote-cam:${u.id}`)}
                              className={`relative mx-auto rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-2xl cursor-pointer ${
                              isPeerDisplayingVideo && isPeerCameraVertical 
                                ? 'aspect-[9/16] w-full max-w-[260px] sm:max-w-[320px] max-h-[520px]' 
                                : 'aspect-video w-full max-w-[500px]'
                            } ${
                              isPeerSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                            }`}>
                              <RemoteVideoPlayer 
                                stream={camStream} 
                                username={u.username}
                                avatarColor={u.avatar_color}
                                user={u}
                                renderAvatar={renderAvatar}
                                onOrientationChange={(vert) => setPeerOrientations((prev) => (prev[`${u.id}-camera`] === vert ? prev : { ...prev, [`${u.id}-camera`]: vert }))}
                                onBlackStateChange={(isBlack) => setPeerCameraBlack((prev) => (prev[u.id] === isBlack ? prev : { ...prev, [u.id]: isBlack }))}
                                onToggleFullscreen={() => handleEnterFullscreen(`remote-cam:${u.id}`)}
                                isScreen={false}
                                isSpeaking={isPeerSpeaking}
                              />

                              {/* Orientation Badge (shifted left of fullscreen button) */}
                              {isPeerDisplayingVideo && (
                                <div className="absolute top-3 right-14 px-2.5 py-1 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none">
                                  {isPeerCameraVertical ? (
                                    <>
                                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Portrait</span>
                                    </>
                                  ) : (
                                    <>
                                      <Monitor className="w-3.5 h-3.5 text-cyan-300" />
                                      <span>Landscape</span>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Hand Raised Indicator */}
                              {u.is_hand_raised && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-amber-500/90 backdrop-blur-md border border-amber-400 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none animate-bounce">
                                  <Hand className="w-3.5 h-3.5" />
                                  <span>Hand Raised</span>
                                </div>
                              )}

                              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                  {u.username} {isPeerDisplayingVideo ? '(Camera)' : ''}
                                </div>
                                {u.is_muted && <MicOff className="w-4 h-4 text-zinc-400 shrink-0" />}
                              </div>
                            </div>
                          )}

                          {/* Dedicated Remote Screen Share Tile (when screen share is on) */}
                          {hasScreen && (
                            <div 
                              data-screen-tile 
                              onDoubleClick={() => handleEnterFullscreen(`remote-screen:${u.id}`)}
                              className="relative mx-auto rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-cyan-400/30 transition-all duration-300 flex flex-col items-center justify-center shadow-2xl aspect-video w-full max-w-[500px] cursor-pointer"
                            >
                              <RemoteVideoPlayer 
                                stream={scrStream} 
                                username={`${u.username}'s Screen`}
                                avatarColor={u.avatar_color}
                                onOrientationChange={(vert) => setPeerOrientations((prev) => (prev[`${u.id}-screen`] === vert ? prev : { ...prev, [`${u.id}-screen`]: vert }))}
                                onToggleFullscreen={() => handleEnterFullscreen(`remote-screen:${u.id}`)}
                                isScreen={true}
                              />
                              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2 truncate">
                                  <Monitor className="w-4 h-4 text-cyan-300 shrink-0" />
                                  <span className="truncate">{u.username}&apos;s Screen</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Dedicated Remote Avatar Tile (shown when camera is off so peer is ALWAYS visible, even during screen share) */}
                          {!hasCamera && (
                            <div className={`relative mx-auto rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-xl aspect-video w-full max-w-[500px] ${
                              isPeerSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                            }`}>
                              <div className="relative flex items-center justify-center">
                                <div className={`transition-all ${isPeerSpeaking ? 'ring-4 ring-amber-500 rounded-2xl shadow-[0_0_30px_#f59e0b]' : ''}`}>
                                  {renderAvatar(u, 'w-20 h-20 sm:w-28 sm:h-28 text-2xl sm:text-3xl')}
                                </div>
                              </div>

                              {/* Hand Raised Indicator */}
                              {u.is_hand_raised && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-amber-500/90 backdrop-blur-md border border-amber-400 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none animate-bounce">
                                  <Hand className="w-3.5 h-3.5" />
                                  <span>Hand Raised</span>
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                                  {u.username}
                                </div>
                                {u.is_muted && <MicOff className="w-4 h-4 text-slate-300 shrink-0" />}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                  </div>
                ) : (
                  /* Connecting State while auto-joining */
                  <div className="my-auto text-center space-y-4 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 mx-2 rounded-3xl shadow-xl">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-cyan-500 dark:text-cyan-300 flex items-center justify-center mx-auto shadow-sm">
                      <Mic className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">Connecting to General Voice...</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Please allow microphone access when prompted.</p>
                  </div>
                )}

              </div>

              {/* Floating Bottom In-Call Control Bar - Adapts to Mobile, Console, and Desktop */}
              {isInVideo && (
                <div className="absolute bottom-3 sm:bottom-6 inset-x-0 flex items-center justify-center z-30 px-2 sm:px-3 pointer-events-auto">
                  <div className="flex items-center gap-1.5 sm:gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl transition-colors max-w-[calc(100vw-1rem)]">
                    {/* Mic Button */}
                    <button 
                      onClick={toggleMute}
                      className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer shrink-0 ${
                        isMuted ? 'bg-red-600 text-white shadow-red-600/30' : 'bg-cyan-500 text-white shadow-cyan-500/30'
                      }`}
                      title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                    >
                      {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>

                    {/* Camera Toggle Button */}
                    <button 
                      onClick={() => toggleCamera()}
                      className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer shrink-0 ${
                        isVideoEnabled 
                          ? 'bg-cyan-500 text-white shadow-cyan-500/30 hover:bg-cyan-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                      title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                      {isVideoEnabled ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>

                    {/* Screen Share Button */}
                    <button 
                      onClick={toggleScreenShare}
                      className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer shrink-0 ${
                        isScreenSharing 
                          ? 'bg-cyan-500 text-white shadow-cyan-500/30 hover:bg-cyan-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                      title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                    >
                      <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {/* Raise Hand Button */}
                    <button 
                      onClick={toggleHandRaise}
                      className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer shrink-0 ${
                        currentUser.is_hand_raised 
                          ? 'bg-amber-500 text-white shadow-amber-600/30 hover:bg-amber-400' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                      title={currentUser.is_hand_raised ? 'Lower Hand' : 'Raise Hand'}
                    >
                      <Hand className={`w-5 h-5 sm:w-6 sm:h-6 ${currentUser.is_hand_raised ? 'animate-bounce' : ''}`} />
                    </button>

                    {/* Disconnect Button */}
                    <button 
                      onClick={handleStopVoice}
                      className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all cursor-pointer shrink-0"
                      title="Disconnect"
                    >
                      <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Right Sidebar in Voice Channel - Desktop */}
            <aside className="hidden lg:flex w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex-col shrink-0 overflow-hidden">
              
              {/* VOICE USERS LIST */}
              <div className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-500 dark:text-cyan-300 tracking-wider uppercase">
                  <Mic className="w-4 h-4" />
                  <span>VOICE — {voiceUsers.length + (isInVideo ? 1 : 0)}</span>
                </div>
              </div>

              {/* SCROLLABLE ONLINE & VOICE MEMBERS */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-3 pr-1">
                <div className="space-y-2">
                  {isInVideo && (
                    <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-400/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {renderAvatar(currentUser, 'w-8 h-8 text-xs')}
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{currentUser.username}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">(you)</span>
                          </div>
                          {renderUserActivity('In General Voice')}
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-cyan-500 dark:text-cyan-300 shrink-0" />
                    </div>
                  )}

                  {voiceUsers.map((u: any) => (
                    <div key={u.id} className="p-2.5 rounded-2xl bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-400/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {renderAvatar(u, 'w-8 h-8 text-xs')}
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate block">{u.username}</span>
                          {renderUserActivity(u.activity || 'In General Voice')}
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-cyan-500 dark:text-cyan-300 shrink-0" />
                    </div>
                  ))}
                </div>

                {/* ONLINE MEMBERS IN VOICE */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    <span>ONLINE — {Math.max(0, users.length - (voiceUsers.length + (isInVideo ? 1 : 0)))}</span>
                  </div>
                  {users.filter((u: any) => u.id !== currentUser.id && !voiceUsers.some((vu: any) => vu.id === u.id)).map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group">
                      <div className="relative shrink-0">
                        {renderAvatar(u, 'w-7 h-7 text-[10px]')}
                        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate block">{u.username}</span>
                        {renderUserActivity(u.activity || 'In #general')}
                      </div>
                      

                    </div>
                  ))}
                </div>
              </div>

            </aside>

            {/* Mobile / Tablet Members Drawer Overlay for Voice Channel */}
            {isMobileMembersOpen && (
              <div className="fixed inset-0 z-[250] lg:hidden flex justify-end animate-in fade-in duration-200">
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setIsMobileMembersOpen(false)}
                />
                <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
                  <div className="shrink-0 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-500 dark:text-cyan-300 tracking-wider uppercase">
                      <Mic className="w-4 h-4" />
                      <span>VOICE — {voiceUsers.length + (isInVideo ? 1 : 0)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMembersOpen(false)}
                      className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-3 pr-1">
                    <div className="space-y-2">
                      {isInVideo && (
                        <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-400/30 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              {renderAvatar(currentUser, 'w-8 h-8 text-xs')}
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                            </div>
                            <div className="min-w-0 leading-tight">
                              <div className="flex items-center gap-1">
                                <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{currentUser.username}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">(you)</span>
                              </div>
                              {renderUserActivity('In General Voice')}
                            </div>
                          </div>
                          <Mic className="w-4 h-4 text-cyan-500 dark:text-cyan-300 shrink-0" />
                        </div>
                      )}

                      {voiceUsers.map((u: any) => (
                        <div key={u.id} className="p-2.5 rounded-2xl bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-400/30 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              {renderAvatar(u, 'w-8 h-8 text-xs')}
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                            </div>
                            <div className="min-w-0 leading-tight">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate block">{u.username}</span>
                              {renderUserActivity(u.activity || 'In General Voice')}
                            </div>
                          </div>
                          <Mic className="w-4 h-4 text-cyan-500 dark:text-cyan-300 shrink-0" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        <span>ONLINE — {Math.max(0, users.length - (voiceUsers.length + (isInVideo ? 1 : 0)))}</span>
                      </div>
                      {users.filter((u: any) => u.id !== currentUser.id && !voiceUsers.some((vu: any) => vu.id === u.id)).map((u: any) => (
                        <div key={u.id} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group">
                          <div className="relative shrink-0">
                            {renderAvatar(u, 'w-7 h-7 text-[10px]')}
                            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-sm bg-cyan-400 border-2 border-white dark:border-slate-900" />
                          </div>
                          <div className="min-w-0 flex-1 leading-tight">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate block">{u.username}</span>
                            {renderUserActivity(u.activity || 'In #general')}
                          </div>


                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            )}

          </div>
        )}

      </main>

      {/* MOBILE CHANNELS DRAWER OVERLAY */}
      <AnimatePresence>
        {isMobileChannelsOpen && (
          <div className="fixed inset-0 z-[250] md:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsMobileChannelsOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-72 max-w-[85vw] h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col z-10 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 180, damping: 18 }}
                    className="cursor-pointer"
                  >
                    <FrostHubLogo variant="community" size="md" />
                  </motion.div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileChannelsOpen(false)}
                  className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-6 flex-1 min-h-0 overflow-y-auto pr-1">
                {/* Text Channels Section */}
                <div className="space-y-2">
                  <div className="px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase">
                    Text Channels
                  </div>
                  
                  {/* General channel */}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleChannelSelect('text-general')}
                    className={`w-full px-4 py-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                      activeChannel === 'text-general'
                        ? 'bg-cyan-500 text-white font-black shadow-lg shadow-cyan-500/20 border-cyan-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Hash className="w-4 h-4 opacity-70" />
                      <span className="text-sm font-bold">general</span>
                    </div>
                  </motion.button>
                </div>

                {/* Voice Channels Section */}
                <div className="space-y-2">
                  <div className="px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase">
                    Voice Channels
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleChannelSelect('video-general')}
                    className={`w-full px-4 py-3 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                      activeChannel === 'video-general'
                        ? 'bg-cyan-500 text-white font-black shadow-lg shadow-cyan-500/20 border-cyan-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Mic className={`w-4 h-4 ${activeChannel === 'video-general' ? 'text-white' : 'text-cyan-500 dark:text-cyan-400'}`} />
                      <span className="text-sm font-bold">General Voice</span>
                    </div>
                  </motion.button>
                </div>


              </div>

              {/* Mobile User Footer */}
              <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileChannelsOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {renderAvatar(currentUser, 'w-9 h-9 text-xs')}
                  <div className="min-w-0">
                    <div className="font-black text-slate-900 dark:text-white text-xs truncate">{currentUser.username}</div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Edit Profile</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-2 rounded-xl border shrink-0 cursor-pointer ${isMuted ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'}`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* PROFILE EDIT MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-y-auto custom-scrollbar shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                User Profile Settings
              </h3>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Avatar Preview & Upload */}
            <div className="flex flex-col items-center gap-3">
              <input
                type="file"
                ref={profileAvatarInputRef}
                onChange={handleProfileAvatarFileSelect}
                accept="image/*"
                className="hidden"
              />
              <div 
                onClick={() => !isAvatarProcessing && profileAvatarInputRef.current?.click()}
                className="relative cursor-pointer group"
                title="Click to upload custom avatar image"
              >
                {renderAvatar({ username: editName || 'P', avatar_color: editColor, avatar_url: editAvatarUrl }, 'w-20 h-20 text-xl')}
                <div className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                  {isAvatarProcessing ? 'Optimizing...' : (editAvatarUrl ? 'Change' : 'Upload')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isAvatarProcessing}
                  onClick={() => profileAvatarInputRef.current?.click()}
                  className="text-xs font-bold text-cyan-500 dark:text-cyan-300 hover:underline cursor-pointer disabled:opacity-50"
                >
                  {isAvatarProcessing ? 'Processing image...' : (editAvatarUrl ? 'Change Avatar Image' : 'Upload Avatar Image')}
                </button>
                {editAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditAvatarUrl('');
                      setAvatarUploadError(null);
                    }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Remove Avatar
                  </button>
                )}
              </div>
              {avatarUploadError && (
                <p className="text-[11px] text-rose-500 font-semibold text-center max-w-xs">{avatarUploadError}</p>
              )}
            </div>

            {/* Display Name Input */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Display Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter username..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-base md:text-sm text-slate-900 dark:text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-cyan-400 transition-colors font-bold"
              />
            </div>

            {/* Avatar Color Picker */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Avatar Theme Accent
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {['var(--vibrant-cyan)', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditColor(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer ${
                      editColor === color ? 'border-slate-900 dark:border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* App Typography & Custom Font Settings */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <FontSettingsSection />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                className="px-6 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-black shadow-lg shadow-cyan-500/30 transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Stage (Camera / Myself / Peer / Screen Share) Portal */}
      {activeFullscreenMedia && (
        <FullscreenStageOverlay
          media={activeFullscreenMedia}
          renderAvatar={renderAvatar}
          onClose={() => setFullscreenKey(null)}
          toggleMute={() => {
            const hasLiveMic = globalChat.localAudioStream?.getAudioTracks().some((track: MediaStreamTrack) => track.readyState === 'live');
            if (!hasLiveMic) void globalChat.requestMicrophonePermission();
            else globalChat.setIsMuted(!globalChat.isMuted);
          }}
          toggleCamera={() => void globalChat.toggleCamera()}
          isMuted={isMuted}
          isVideoEnabled={isVideoEnabled}
          toggleHandRaise={toggleHandRaise}
          isHandRaised={Boolean(currentUser.is_hand_raised)}
        />
      )}

    </div>
  );
};
