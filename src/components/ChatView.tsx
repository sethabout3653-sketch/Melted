import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Snowflake,
  Hand,
  MessageCircle,
  Trash2
} from 'lucide-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { UserAvatar } from './UserAvatar';
import { processAvatarImage, persistAvatarUrl } from '../utils/avatarUtils';
import { FontSettingsSection } from './FontSettingsSection';

interface ChatViewProps {
  globalChat: any;
  initialChannel?: string | null;
}

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
          className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
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
            className="w-full h-1.5 bg-[#1f1f2e] rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all"
          />
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Mute Button */}
        <button
          type="button"
          onClick={toggleMute}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Download Button */}
        {showDownload && onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
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
  isScreen?: boolean;
  isVertical?: boolean;
  isSpeaking?: boolean;
}> = ({ stream, username, avatarColor, user, renderAvatar, onOrientationChange, onBlackStateChange, isScreen = false, isVertical = false, isSpeaking = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideoFrame, setHasVideoFrame] = useState(false);
  const [isBlack, setIsBlack] = useState(!isScreen);

  const checkOrientation = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setHasVideoFrame(true);
      const vertical = video.videoHeight > video.videoWidth;
      onOrientationChange?.(vertical);
      return;
    }
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    if (settings && settings.width && settings.height) {
      setHasVideoFrame(true);
      const vertical = settings.height > settings.width;
      onOrientationChange?.(vertical);
    }
  }, [onOrientationChange, stream]);

  const checkOrientationRef = useRef(checkOrientation);
  useEffect(() => {
    checkOrientationRef.current = checkOrientation;
  }, [checkOrientation]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      try {
        video.load();
      } catch {}
      setHasVideoFrame(false);
      setIsBlack(true);
      onBlackStateChange?.(true);
      return;
    }

    const allVideoTracks = stream.getVideoTracks();
    const liveTracks = allVideoTracks.filter((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted);
    
    if (liveTracks.length === 0) {
      setHasVideoFrame(false);
      setIsBlack(true);
      onBlackStateChange?.(true);
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.muted = true;
    video.defaultMuted = true;

    const checkFrame = () => {
      const vid = videoRef.current;
      if (!vid) return;

      if (isScreen) {
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          setHasVideoFrame(true);
          setIsBlack(false);
          onBlackStateChange?.(false);
          checkOrientationRef.current();
        }
        return;
      }

      if (vid.videoWidth > 0 && vid.videoHeight > 0 && vid.readyState >= 2 && !vid.paused && !vid.ended) {
        const frameIsBlack = checkIsVideoFrameBlack(vid);
        setIsBlack(frameIsBlack);
        onBlackStateChange?.(frameIsBlack);
        if (!frameIsBlack) {
          setHasVideoFrame(true);
          checkOrientationRef.current();
        }
      } else {
        setIsBlack(true);
        onBlackStateChange?.(true);
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
      allVideoTracks.forEach((t: MediaStreamTrack) => { t.enabled = true; });
      tryPlay();
    };

    const handleMuteOrEnd = () => {
      setIsBlack(true);
      setHasVideoFrame(false);
      onBlackStateChange?.(true);
    };

    allVideoTracks.forEach((t: MediaStreamTrack) => {
      t.addEventListener('unmute', handleUnmute);
      t.addEventListener('mute', handleMuteOrEnd);
      t.addEventListener('ended', handleMuteOrEnd);
    });

    const handleAddTrack = (e: MediaStreamTrackEvent) => {
      if (e.track.kind === 'video') {
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
        checkFrame();
      }
    }, 1000);

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
    };
  }, [stream, isScreen, onBlackStateChange]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-3xl bg-white dark:bg-slate-900">
      {!isScreen && renderAvatar && user && (isBlack || !hasVideoFrame || !stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-900 z-10 transition-opacity duration-200">
          <div className="relative flex items-center justify-center">
            <div className={`transition-all ${isSpeaking ? 'ring-4 ring-amber-500 rounded-full shadow-[0_0_30px_#f59e0b]' : ''}`}>
              {renderAvatar(user, 'w-28 h-28 text-3xl')}
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
              setIsBlack(false);
              onBlackStateChange?.(false);
            } else {
              const black = checkIsVideoFrameBlack(video);
              setIsBlack(black);
              onBlackStateChange?.(black);
              if (!black) setHasVideoFrame(true);
            }
          }
        }}
        onCanPlay={() => {
          const video = videoRef.current;
          if (video && video.videoWidth > 0) {
            if (isScreen) {
              setHasVideoFrame(true);
              setIsBlack(false);
              onBlackStateChange?.(false);
            } else {
              const black = checkIsVideoFrameBlack(video);
              setIsBlack(black);
              onBlackStateChange?.(black);
              if (!black) setHasVideoFrame(true);
            }
          }
        }}
        onPlaying={() => {
          const video = videoRef.current;
          if (video) {
            if (isScreen) {
              setHasVideoFrame(true);
              setIsBlack(false);
              onBlackStateChange?.(false);
            } else {
              const black = checkIsVideoFrameBlack(video);
              setIsBlack(black);
              onBlackStateChange?.(black);
              if (!black) setHasVideoFrame(true);
            }
          }
          checkOrientation();
        }}
        onResize={checkOrientation}
        className={`w-full h-full ${isScreen ? 'object-contain' : 'object-cover'} rounded-3xl ${isScreen || (!isBlack && hasVideoFrame && stream) ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-200`}
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
  isMirrored?: boolean;
  isScreen?: boolean;
  isSpeaking?: boolean;
}> = ({ stream, user, renderAvatar, onOrientationChange, onBlackStateChange, isMirrored = true, isScreen = false, isSpeaking = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [isBlack, setIsBlack] = useState(!isScreen);

  const checkOrientation = useCallback(() => {
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setHasFrame(true);
      const vertical = video.videoHeight > video.videoWidth;
      onOrientationChange?.(vertical);
      return;
    }
    const track = stream?.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    if (settings && settings.width && settings.height) {
      setHasFrame(true);
      const vertical = settings.height > settings.width;
      onOrientationChange?.(vertical);
      return;
    }
    if (isMobile && typeof window !== 'undefined' && window.innerHeight > window.innerWidth) {
      onOrientationChange?.(true);
    }
  }, [onOrientationChange, stream]);

  const checkOrientationRef = useRef(checkOrientation);
  useEffect(() => {
    checkOrientationRef.current = checkOrientation;
  }, [checkOrientation]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      try {
        video.load();
      } catch {}
      setHasFrame(false);
      setIsBlack(true);
      onBlackStateChange?.(true);
      return;
    }

    const allVideoTracks = stream.getVideoTracks();
    const liveTracks = allVideoTracks.filter((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted);
    if (liveTracks.length === 0) {
      setHasFrame(false);
      setIsBlack(true);
      onBlackStateChange?.(true);
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.muted = true;
    video.defaultMuted = true;

    const checkFrame = () => {
      const vid = videoRef.current;
      if (!vid) return;

      if (isScreen) {
        if (vid.videoWidth > 0 && vid.videoHeight > 0) {
          setHasFrame(true);
          setIsBlack(false);
          onBlackStateChange?.(false);
          checkOrientationRef.current();
        }
        return;
      }

      if (vid.videoWidth > 0 && vid.videoHeight > 0 && vid.readyState >= 2 && !vid.paused && !vid.ended) {
        const frameIsBlack = checkIsVideoFrameBlack(vid);
        setIsBlack(frameIsBlack);
        onBlackStateChange?.(frameIsBlack);
        if (!frameIsBlack) {
          setHasFrame(true);
          checkOrientationRef.current();
        }
      } else {
        setIsBlack(true);
        onBlackStateChange?.(true);
      }
    };

    video.play().then(() => {
      checkFrame();
    }).catch(() => {});

    const handleMuteOrEnd = () => {
      setIsBlack(true);
      setHasFrame(false);
      onBlackStateChange?.(true);
    };

    allVideoTracks.forEach((t: MediaStreamTrack) => {
      t.addEventListener('unmute', checkFrame);
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
        checkFrame();
      }
    }, 1000);

    return () => {
      clearInterval(freezeWatchdog);
      allVideoTracks.forEach((t: MediaStreamTrack) => {
        t.removeEventListener('unmute', checkFrame);
        t.removeEventListener('mute', handleMuteOrEnd);
        t.removeEventListener('ended', handleMuteOrEnd);
      });
      video.removeEventListener('loadeddata', checkFrame);
      video.removeEventListener('loadedmetadata', checkFrame);
      video.removeEventListener('canplay', checkFrame);
      video.removeEventListener('playing', checkFrame);
      video.removeEventListener('pause', checkFrame);
      video.removeEventListener('emptied', handleMuteOrEnd);
    };
  }, [stream, isScreen, onBlackStateChange]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-3xl bg-white dark:bg-slate-900">
      {!isScreen && (isBlack || !stream || !hasFrame) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-slate-900 z-10 transition-opacity duration-200">
          <div className="relative flex items-center justify-center">
            <div className={`transition-all ${isSpeaking ? 'ring-4 ring-amber-500 rounded-full shadow-[0_0_30px_#f59e0b]' : ''}`}>
              {renderAvatar(user, 'w-28 h-28 text-3xl')}
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
        className={`w-full h-full ${isScreen ? 'object-contain' : 'object-cover'} rounded-3xl ${isMirrored && !isScreen ? 'transform scale-x-[-1]' : ''} ${isScreen || (!isBlack && stream && hasFrame) ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-200`}
      />
    </div>
  );
};

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
    toggleCamera,
    toggleScreenShare,
  } = globalChat;

  const toggleMute = () => setIsMuted(!isMuted);

  const voiceUsers = useMemo(() => {
    return users.filter((u: any) => (u.current_channel === 'video-general' || u.current_channel === 'voice-general') && u.id !== currentUser.id);
  }, [users, currentUser.id]);

  const isUserSpeaking = useCallback((userId: string) => {
    if (userId === currentUser.id) return globalChat.is_speaking;
    const peer = users.find((u: any) => u.id === userId);
    return peer?.is_speaking || remoteSpeaking[userId];
  }, [currentUser.id, globalChat.is_speaking, users, remoteSpeaking]);

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
      textColor = 'text-blue-500 font-semibold';
    } else if (u.current_channel && u.current_channel.startsWith('dm-')) {
      text = 'In Private Chat';
      textColor = 'text-emerald-500 font-semibold';
    } else if (u.activity && u.activity !== 'Online' && u.activity !== 'Browsing Games' && u.activity !== 'In #general') {
      text = u.activity;
      textColor = 'text-purple-500 font-semibold';
    } else {
      text = 'In #general';
      textColor = 'text-slate-400 dark:text-slate-500';
    }
    return <span className={`text-[11px] ${textColor} font-medium truncate block`}>{text}</span>;
  }, []);

  const [activeChannel, setActiveChannel] = useState<string>(initialChannel || 'text-general');
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);

  useEffect(() => {
    if (initialChannel) {
      setActiveChannel(initialChannel);
    }
  }, [initialChannel]);

  const handleStopVoice = useCallback(() => {
    stopVoiceChannel();
    setActiveChannel('text-general');
  }, [stopVoiceChannel]);

  // Automatically join voice when opening General Voice channel if not already in video
  useEffect(() => {
    if (activeChannel === 'video-general' && !isInVideo) {
      joinVoiceChannel(false);
    }
  }, [activeChannel, isInVideo, joinVoiceChannel]);



  // Track message counts for DM channels to handle auto-closing deleted chats
  const prevDmCountsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (activeChannel.startsWith('dm-')) {
      const dmMsgCount = messages.filter((m: any) => m.channel_id === activeChannel).length;
      const prevCount = prevDmCountsRef.current[activeChannel];

      // If this DM channel previously had messages (>0) and now has 0 messages, automatically revert to general chat
      if (prevCount !== undefined && prevCount > 0 && dmMsgCount === 0) {
        setActiveChannel('text-general');
      }

      prevDmCountsRef.current[activeChannel] = dmMsgCount;
    }
  }, [messages, activeChannel]);

  const [inputText, setInputText] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  // Helper for 1-on-1 direct message channel ID
  const getDmChannelId = useCallback((peerId: string) => `dm-${[currentUser.id, peerId].sort().join('-')}`, [currentUser.id]);

  // Active DM peers list from messages
  const dmPeers = useMemo(() => {
    const peerMap = new Map<string, any>();
    messages.forEach((m: any) => {
      if (m.channel_id && m.channel_id.startsWith('dm-') && m.channel_id.includes(currentUser.id)) {
        const parts = m.channel_id.replace('dm-', '').split('-');
        const peerId = parts.find((p: string) => p !== currentUser.id);
        if (peerId) {
          const knownUser = users.find((u: any) => u.id === peerId);
          if (knownUser) {
            peerMap.set(peerId, { ...knownUser, lastMessage: m });
          } else {
            const fallbackName = m.sender_id === peerId ? m.sender_name : 'Player';
            peerMap.set(peerId, {
              id: peerId,
              username: fallbackName,
              avatar_color: m.avatar_color || '#0066ff',
              avatar_url: m.sender_avatar_url || '',
              lastMessage: m,
            });
          }
        }
      }
    });
    return Array.from(peerMap.values());
  }, [messages, users, currentUser.id]);

  // Current active DM peer if activeChannel is a dm-
  const activeDmPeerId = useMemo(() => {
    if (!activeChannel.startsWith('dm-')) return null;
    const parts = activeChannel.replace('dm-', '').split('-');
    return parts.find((p: string) => p !== currentUser.id) || null;
  }, [activeChannel, currentUser.id]);

  const activeDmPeer = useMemo(() => {
    if (!activeDmPeerId) return null;
    return users.find((u: any) => u.id === activeDmPeerId) || dmPeers.find((p: any) => p.id === activeDmPeerId) || {
      id: activeDmPeerId,
      username: 'Player',
      avatar_color: '#0066ff',
      avatar_url: '',
    };
  }, [activeDmPeerId, users, dmPeers]);

  // Filter messages for currently selected channel
  const activeChannelMessages = useMemo(() => {
    if (activeChannel === 'text-general') {
      return messages.filter((m: any) => !m.channel_id || m.channel_id === 'text-general' || m.channel_id === 'general');
    }
    if (activeChannel.startsWith('dm-')) {
      return messages.filter((m: any) => m.channel_id === activeChannel);
    }
    return [];
  }, [messages, activeChannel]);

  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Attachment Uploading States with Real Progress
  const [pendingFile, setPendingFile] = useState<{
    fileObj: File;
    filename: string;
    mimeType: string;
    size: number;
    previewUrl?: string;
    type: 'image' | 'video' | 'audio' | 'file';
    base64Data?: string;
    uploadProgress: number;
    isUploading: boolean;
    uploadedUrl: string | null;
    error: string | null;
    xhrRef?: XMLHttpRequest;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Giphy Search & Modal State using Official SDK
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [giphySearch, setGiphySearch] = useState('');
  const [activeCategoryLabel, setActiveCategoryLabel] = useState('🔥 Trending');

  // Call & Audio Level States
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMicTesting, setIsMicTesting] = useState(false);

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
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  // GIF items state
  const [gifs, setGifs] = useState<any[]>([]);
  const [isGifsLoading, setIsGifsLoading] = useState(false);

  const handleCategorySelect = (category: { label: string; query: string }) => {
    setActiveCategoryLabel(category.label);
    setGiphySearch(category.query);
  };

  const toggleHandRaise = () => {
    const nextState = !currentUser.is_hand_raised;
    setCurrentUser((prev: any) => ({ ...prev, is_hand_raised: nextState }));
    updateUser({ is_hand_raised: nextState });
  };

  // Fetch GIFs effect
  useEffect(() => {
    if (!isGiphyOpen) return;
    let isCurrent = true;
    setIsGifsLoading(true);
    const loadGifs = async () => {
      try {
        const query = giphySearch.trim();
        const res = query 
          ? await gf.search(query, { limit: 24 })
          : await gf.trending({ limit: 24 });
        if (isCurrent && res?.data) {
          setGifs(res.data);
        }
      } catch (err) {
        console.warn('Giphy fetch notice:', err);
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
    localStorage.setItem('frosted_chat_username', editName);
    localStorage.setItem('frosted_chat_usercolor', editColor);
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
    if (!isInVideo) {
      let newActivity = 'In #general';
      if (channel === 'video-general') newActivity = 'In General Voice';
      else if (channel.startsWith('dm-')) newActivity = 'In Private Chat';
      setCurrentUser((prev: any) => ({ ...prev, current_channel: channel as any, activity: newActivity }));
      updateUser({ current_channel: channel as any, activity: newActivity });
    }
    if (channel === 'video-general' && !isInVideo) {
      if (globalChat.micPermissionStatus === 'prompt') {
        globalChat.requestMicrophonePermission();
      } else {
        joinVoiceChannel(false);
      }
    }
  };

  // FILE SELECTION AND UPLOAD
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Search comprehensive list of literally every audio extension
    const AUDIO_EXT_REGEX = /\.(mp3|wav|ogg|oga|ogv|flac|aac|m4a|opus|weba|aiff?|wma|alac|midi?|amr|ac3|dts|ape|ra|ram|caf|mka|spx|voc|xm|it|mod|s3m|3gp)$/i;

    let attachmentType: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name)) attachmentType = 'image';
    else if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogg|m4v|avi)$/i.test(file.name)) attachmentType = 'video';
    else if (file.type.startsWith('audio/') || AUDIO_EXT_REGEX.test(file.name)) attachmentType = 'audio';

    const localPreview = (attachmentType === 'image' || attachmentType === 'video' || attachmentType === 'audio') ? URL.createObjectURL(file) : undefined;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const xhr = new XMLHttpRequest();

      setPendingFile({
        fileObj: file,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        previewUrl: localPreview,
        type: attachmentType,
        base64Data,
        uploadProgress: 0,
        isUploading: true,
        uploadedUrl: null,
        error: null,
        xhrRef: xhr,
      });

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setPendingFile((prev) => prev ? { ...prev, uploadProgress: percentComplete } : null);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            setPendingFile((prev) => prev ? {
              ...prev,
              uploadProgress: 100,
              isUploading: false,
              uploadedUrl: response.url,
            } : null);
          } catch {
            setPendingFile((prev) => prev ? {
              ...prev,
              uploadProgress: 100,
              isUploading: false,
              uploadedUrl: base64Data,
            } : null);
          }
        } else {
          setPendingFile((prev) => prev ? {
            ...prev,
            isUploading: false,
            uploadedUrl: base64Data,
          } : null);
        }
      };

      xhr.onerror = () => {
        setPendingFile((prev) => prev ? {
          ...prev,
          isUploading: false,
          uploadedUrl: base64Data,
        } : null);
      };

      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        filename: file.name,
        base64Data,
        mimeType: file.type,
      }));
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const cancelPendingFile = () => {
    if (pendingFile?.xhrRef) {
      try {
        pendingFile.xhrRef.abort();
      } catch {
        // Abort handled
      }
    }
    setPendingFile(null);
  };

  // Submit Message immediately with uploaded file
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !pendingFile) return;

    let finalAttachment: { url: string; type: 'image' | 'video' | 'audio' | 'file' | 'gif'; name?: string } | undefined = undefined;

    if (pendingFile) {
      const finalUrl = pendingFile.uploadedUrl || pendingFile.previewUrl || pendingFile.base64Data;
      if (finalUrl) {
        finalAttachment = {
          url: finalUrl,
          type: pendingFile.type,
          name: pendingFile.filename,
        };
      }
    }

    insertMessage(inputText, activeChannel, finalAttachment);
    setInputText('');
    setPendingFile(null);
  };

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
    <div className="flex flex-1 min-h-0 h-full w-full bg-white/90 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden select-none transition-colors max-h-[100dvh]">
      
      {/* Hidden Global File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        style={{ display: 'none' }} 
        accept="*"
      />

      {/* LEFT NAVIGATION SIDEBAR - Desktop view */}
      <aside className="hidden md:flex w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col justify-between shrink-0 overflow-hidden">
        <div className="p-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
          
          {/* Header Branding */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
              <Snowflake className="w-6 h-6 fill-none" />
            </div>
            <h1 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">Community</h1>
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
                    ? 'bg-blue-600 text-white font-black shadow-xl shadow-blue-600/20 border-blue-500'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Hash className="w-4 h-4 opacity-70" />
                  <span className="text-sm font-bold">general</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${
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
                    ? 'bg-blue-600 text-white font-black shadow-xl shadow-blue-600/20 border-blue-500'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Mic className={`w-4 h-4 ${activeChannel === 'video-general' ? 'text-white' : 'text-blue-500'}`} />
                  <span className="text-sm font-bold">General Voice</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${
                  activeChannel === 'video-general' ? 'bg-white/20 border-white/20' : 'bg-blue-50 dark:bg-blue-900/40 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                }`}>
                  {voiceUsers.length + (isInVideo ? 1 : 0)}
                </span>
              </motion.button>
            </div>

            {/* Direct Messages (Private Chats) */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
              <div className="px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase flex items-center justify-between">
                <span>Private Chats</span>
                {dmPeers.length > 0 && (
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                    {dmPeers.length}
                  </span>
                )}
              </div>

              {dmPeers.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Click the message icon on any member to start a private chat.
                </div>
              ) : (
                <div className="space-y-1">
                  {dmPeers.map((peer: any) => {
                    const dmChan = getDmChannelId(peer.id);
                    const isDmActive = activeChannel === dmChan;
                    const peerMessages = messages.filter((m: any) => m.channel_id === dmChan);
                    return (
                      <motion.button
                        key={peer.id}
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleChannelSelect(dmChan)}
                        className={`w-full px-3 py-2 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                          isDmActive
                            ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20 border-blue-500'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            {renderAvatar(peer, 'w-6 h-6 text-[10px]')}
                            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
                          </div>
                          <span className="text-xs font-bold truncate">{peer.username}</span>
                        </div>
                        {peerMessages.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isDmActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}>
                            {peerMessages.length}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
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
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
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
      <main className="flex-1 flex flex-col bg-white dark:bg-slate-950 min-w-0 min-h-0 relative overflow-hidden">
        
        {/* TEXT CHANNEL & PRIVATE CHAT VIEW */}
        {(activeChannel === 'text-general' || activeChannel.startsWith('dm-')) && (
          <div className="flex-1 min-h-0 flex overflow-hidden">
            
            {/* Center Chat Messages Column */}
            <div className="flex-1 min-h-0 flex flex-col min-w-0 relative overflow-hidden">
              
              {/* Top Header */}
              <header className="h-20 px-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shrink-0 gap-6">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Channels button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileChannelsOpen(true)}
                    className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Open Channels"
                  >
                    <Menu className="w-5 h-5" />
                  </button>

                  {activeChannel.startsWith('dm-') ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {renderAvatar(activeDmPeer, 'w-9 h-9 text-xs')}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">{activeDmPeer?.username}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Private Chat
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate block">
                          {activeDmPeer?.activity || 'Active Now'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Hash className="w-5 h-5 text-slate-900 dark:text-white shrink-0" />
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">general</span>
                      <button
                        type="button"
                        onClick={() => setIsMobileMembersOpen(true)}
                        className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                        title="View Online Members"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span>{users.length} online</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeChannel.startsWith('dm-') && activeDmPeer && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          deleteChannelMessages(activeChannel);
                          setActiveChannel('text-general');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200 dark:border-red-800"
                        title="Delete Chat for both participants"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete Chat</span>
                      </button>
                    </div>
                  )}

                  <div className="relative hidden sm:block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search messages"
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-base md:text-xs text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-9 pr-3 py-2 w-36 sm:w-48 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  {/* Mobile / Tablet Members drawer toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileMembersOpen(true)}
                    className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="View Members"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden xs:inline text-[11px] text-slate-400">{users.length}</span>
                  </button>
                </div>
              </header>

              {/* Chat Scroll Area (Messages) */}
              <div 
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6"
              >
                
                {/* Empty State for DMs */}
                {activeChannel.startsWith('dm-') && activeChannelMessages.length === 0 && (
                  <div className="py-16 text-center space-y-3 max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-md">
                      <MessageCircle className="w-8 h-8" />
                    </div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Direct Messages with {activeDmPeer?.username}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                      This is the start of your 1-on-1 private chat. You can send messages, audio clips, and files.
                    </p>
                  </div>
                )}

                {/* Messages List */}
                {activeChannelMessages.map((msg: any) => {
                  const msgUser = users.find((u: any) => u.id === msg.sender_id);
                  const displayUsername = msgUser?.username || msg.sender_name;
                  const displayAvatarColor = msgUser?.avatar_color || msg.avatar_color;
                  const displayAvatarUrl = msgUser?.avatar_url || msg.sender_avatar_url;

                  return (
                    <div key={msg.id} className="flex items-start gap-3.5 group hover:bg-slate-50 dark:hover:bg-slate-900/40 -mx-4 px-4 py-1.5 rounded-xl transition-colors">
                      <div className="shrink-0">
                        {renderAvatar({ username: displayUsername, avatar_color: displayAvatarColor, avatar_url: displayAvatarUrl }, 'w-10 h-10 text-xs')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm hover:underline cursor-pointer">
                            {displayUsername}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {msg.timestamp}
                          </span>
                        </div>
                      
                      {msg.content && (
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words whitespace-pre-wrap mt-0.5">
                          {msg.content}
                        </p>
                      )}

                      {/* Attachment Rendering */}
                      {msg.attachment_url && (() => {
                        const category = getAttachmentCategory(msg.attachment_url, msg.attachment_name, msg.attachment_type);

                        // Audio Attachment
                        if (category === 'audio') {
                          return (
                            <div className="mt-2">
                              <AudioAttachmentPlayer
                                url={msg.attachment_url}
                                name={msg.attachment_name}
                                onDownload={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'audio.mp3')}
                              />
                            </div>
                          );
                        }

                        // Video Attachment
                        if (category === 'video') {
                          return (
                            <div className="mt-2 space-y-2 max-w-lg">
                              {msg.attachment_name && (
                                <p className="text-xs font-semibold text-white truncate">
                                  {msg.attachment_name}
                                </p>
                              )}
                              <video
                                src={msg.attachment_url}
                                controls
                                playsInline
                                preload="metadata"
                                className="max-h-80 w-auto rounded-xl bg-black border border-white/10"
                              />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'video.mp4')}
                                  className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-[#1a1a24] hover:bg-[#252534] px-3 py-1.5 rounded-lg border border-white/10 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Image Attachment (including GIFs)
                        if (category === 'image') {
                          return (
                            <div className="mt-2 space-y-2 inline-block max-w-md">
                              {msg.attachment_name && (
                                <p className="text-xs font-semibold text-white truncate">
                                  {msg.attachment_name}
                                </p>
                              )}
                              <img
                                src={msg.attachment_url}
                                alt=""
                                className="max-h-80 w-auto object-contain rounded-xl border border-white/10 bg-black/20"
                              />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'image.png')}
                                  className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white bg-[#1a1a24] hover:bg-[#252534] px-3 py-1.5 rounded-lg border border-white/10 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Unknown attachment fallback
                        return (
                          <div className="mt-2 p-3 bg-[#121218] border border-[#22222e] rounded-xl max-w-sm flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                              {msg.attachment_name || 'Attachment'}
                            </span>
                            <button
                              type="button"
                              onClick={() => downloadAttachment(msg.attachment_url, msg.attachment_name || 'attachment')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                          </div>
                        );
                      })()}

                    </div>
                    {msg.sender_id === currentUser.id && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                        title="Delete message"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Attachment Preview Before Sending */}
              {pendingFile && (
                <div className="shrink-0 mx-4 mb-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl relative shadow-lg">
                  <div className="flex items-start gap-3">
                    {/* If Image: Show actual image preview */}
                    {pendingFile.type === 'image' && pendingFile.previewUrl && (
                      <div className="relative">
                        <img 
                          src={pendingFile.previewUrl} 
                          alt="Attachment preview" 
                          className="max-h-40 max-w-xs rounded-xl object-contain bg-black/40 border border-white/10" 
                        />
                      </div>
                    )}

                    {/* If Video: Show actual video player */}
                    {pendingFile.type === 'video' && pendingFile.previewUrl && (
                      <div className="relative">
                        <video 
                          src={pendingFile.previewUrl} 
                          controls 
                          playsInline 
                          className="max-h-40 max-w-xs rounded-xl bg-black border border-white/10" 
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
                      <div className="flex items-center gap-2.5 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <FileText className="w-6 h-6 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-xs">{pendingFile.filename}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{(pendingFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    )}

                    {/* Upload progress & info */}
                    {pendingFile.isUploading && (
                      <div className="flex-1 min-w-0 self-center">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span>Uploading...</span>
                            <span>{pendingFile.uploadProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-150 rounded-full" 
                              style={{ width: `${pendingFile.uploadProgress}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Remove button */}
                    <button 
                      type="button"
                      onClick={cancelPendingFile}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* GIPHY POPOVER MODAL */}
              {isGiphyOpen && (
                <div className="absolute bottom-20 left-4 right-4 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 max-w-xl mx-auto flex flex-col space-y-3 backdrop-blur-xl">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">GIFs</span>
                    <button 
                      onClick={() => setIsGiphyOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search Bar Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input 
                      type="text" 
                      value={giphySearch}
                      onChange={(e) => {
                        setGiphySearch(e.target.value);
                        setActiveCategoryLabel('');
                      }}
                      placeholder="Search GIFs..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-base md:text-xs text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:border-blue-500 transition-all"
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
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                    {GIPHY_CATEGORIES.map((cat) => {
                      const isActive = activeCategoryLabel === cat.label || (cat.query && giphySearch.toLowerCase() === cat.query.toLowerCase());
                      return (
                        <button
                          key={cat.label}
                          onClick={() => handleCategorySelect(cat)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer shrink-0 border ${
                            isActive
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Native GIF Grid */}
                  <div className="max-h-80 overflow-y-auto pr-1 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    {isGifsLoading ? (
                      <div className="py-12 flex items-center justify-center text-xs text-slate-400">
                        Loading GIFs...
                      </div>
                    ) : gifs.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {gifs.map((gif) => {
                          const previewImg = gif.images?.fixed_width?.url || gif.images?.fixed_height?.url || gif.images?.downsized?.url;
                          return (
                            <button
                              key={gif.id}
                              type="button"
                              onClick={() => selectGiphyGif(gif)}
                              className="relative aspect-video rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer group border border-slate-200 dark:border-slate-700"
                            >
                              <img
                                src={previewImg}
                                alt={gif.title || 'GIF'}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No GIFs found
                      </div>
                    )}
                  </div>

                </div>
              )}

              <div className="p-4 pt-0 shrink-0">
                <form onSubmit={handleSendMessage} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-2xl px-4 py-3 flex items-center gap-3 transition-colors shadow-lg">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={activeChannel.startsWith('dm-') ? `Message @${activeDmPeer?.username || 'user'} privately...` : "Message #general..."}
                    className="flex-1 bg-transparent text-base md:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-2"
                  />

                  {/* File Attachment Button */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer border border-transparent"
                    title="Upload File or Media"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </motion.button>

                  {/* GIF Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setIsGiphyOpen(!isGiphyOpen)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center border ${
                      isGiphyOpen 
                        ? 'bg-blue-600 text-white shadow-sm border-blue-400' 
                        : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                    title="GIFs"
                  >
                    GIF
                  </motion.button>

                  {/* Send Button */}
                  <motion.button
                    whileHover={(inputText.trim() || pendingFile) ? { scale: 1.05 } : {}}
                    whileTap={(inputText.trim() || pendingFile) ? { scale: 0.95 } : {}}
                    type="submit"
                    disabled={!inputText.trim() && !pendingFile}
                    className={`px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      (inputText.trim() || pendingFile)
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border-blue-400' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed border-transparent'
                    }`}
                  >
                    <Send className="w-4 h-4 fill-current" />
                  </motion.button>
                </form>
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
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
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

                    {/* Desktop Direct Action Buttons */}
                    {u.id !== currentUser.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleChannelSelect(getDmChannelId(u.id))}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all cursor-pointer"
                          title={`Private chat with ${u.username}`}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>



            </aside>

            {/* Mobile / Tablet Members Drawer Overlay */}
            {isMobileMembersOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex justify-end animate-in fade-in duration-200">
                <div 
                  className="fixed inset-0 bg-black/75 backdrop-blur-sm"
                  onClick={() => setIsMobileMembersOpen(false)}
                />
                <aside className="relative w-72 max-w-[85vw] h-full bg-[#08080a] border-l border-[#1a1a20] p-4 flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
                  <div className="shrink-0 pb-3 flex items-center justify-between border-b border-[#14141a]">
                    <div className="text-xs font-bold text-zinc-500 tracking-wider">
                      <span>ONLINE — {users.length}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMembersOpen(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pt-3 pr-1">
                    {users.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                        <div className="relative shrink-0">
                          {renderAvatar(u, 'w-9 h-9 text-xs')}
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#08080a]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-white text-xs truncate">
                              {u.username}
                            </span>
                            {u.is_hand_raised && <Hand className="w-3 h-3 text-amber-500 shrink-0" />}
                            {u.id === currentUser.id && (
                              <span className="text-[10px] text-zinc-500 font-medium shrink-0">
                                (you)
                              </span>
                            )}
                          </div>
                          {renderUserActivity(u.activity || (u.current_channel === 'video-general' ? 'In General Voice' : 'In #general'))}
                        </div>

                        {/* Mobile Direct Action Buttons */}
                        {u.id !== currentUser.id && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleChannelSelect(getDmChannelId(u.id));
                                setIsMobileMembersOpen(false);
                              }}
                              className="p-2 rounded-xl text-zinc-400 hover:text-blue-500 hover:bg-white/5 transition-all cursor-pointer"
                              title={`Private chat with ${u.username}`}
                            >
                              <MessageCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
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
              <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 gap-2 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Mobile Channels button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileChannelsOpen(true)}
                    className="md:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Open Channels"
                  >
                    <Menu className="w-5 h-5" />
                  </button>

                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleScreenShare}
                    className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border transition-all cursor-pointer ${
                      isScreenSharing ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span className="hidden sm:inline">{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
                  </button>

                  {/* Mobile / Tablet Members drawer toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileMembersOpen(true)}
                    className="lg:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    title="View Members"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden xs:inline text-[11px] text-slate-500 dark:text-slate-400">{voiceUsers.length + (isInVideo ? 1 : 0)}</span>
                  </button>
                </div>
              </div>

              {/* Screen Share Error Alert */}
              {screenShareError && (
                <div className="mx-4 sm:mx-6 mt-3 p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-200 shrink-0">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{screenShareError}</span>
                  </div>
                  <button 
                    onClick={() => setScreenShareError(null)} 
                    className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Voice / Video Stage Grid */}
              <div className="flex-1 min-h-0 p-6 pb-28 flex items-center justify-center overflow-hidden">
                
                {isInVideo ? (
                  <div className="flex flex-wrap items-center justify-center gap-6 w-full max-w-6xl max-h-full overflow-y-auto p-2">
                    
                    {/* Local Camera Tile & Local Avatar Tile */}
                    {(() => {
                      const isLocalCameraActive = Boolean(
                        isVideoEnabled && 
                        cameraStream && 
                        cameraStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted)
                      );
                      const isLocalDisplayingVideo = isLocalCameraActive && !localCameraBlack;

                      return (
                        <>
                          {isLocalCameraActive && (
                            <div className={`relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-2xl ${
                              isLocalDisplayingVideo && localIsVertical 
                                ? 'aspect-[9/16] w-full max-w-[280px] sm:max-w-[320px] max-h-[520px]' 
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

                              {/* Orientation Badge (only shown when live camera is visible and not black) */}
                              {isLocalDisplayingVideo && (
                                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none">
                                  {localIsVertical ? (
                                    <>
                                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Portrait</span>
                                    </>
                                  ) : (
                                    <>
                                      <Monitor className="w-3.5 h-3.5 text-blue-400" />
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
                              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-sm font-extrabold text-white">
                                  {currentUser.username} {isLocalDisplayingVideo ? '(You - Camera)' : '(You)'}
                                </div>
                                {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                              </div>
                            </div>
                          )}

                          {/* Avatar Tile (shown when camera is completely off) */}
                          {!isLocalCameraActive && (
                            <div className={`relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-xl aspect-video w-full max-w-[500px] ${
                              isUserSpeaking(currentUser.id) ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                            }`}>
                              <div className="relative flex items-center justify-center">
                                <div className={`transition-all ${isUserSpeaking(currentUser.id) ? 'ring-4 ring-amber-500 rounded-full shadow-[0_0_30px_#f59e0b]' : ''}`}>
                                  {renderAvatar(currentUser, 'w-28 h-28 text-3xl')}
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
                      <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-blue-500/40 transition-all duration-300 flex flex-col items-center justify-center shadow-xl aspect-video w-full max-w-[500px]">
                        <div className="flex flex-col items-center justify-center gap-4 text-blue-600 dark:text-blue-400">
                          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/10">
                            <Monitor className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
                          </div>
                          <div className="text-center px-4">
                            <span className="text-base font-bold text-slate-900 dark:text-white block font-heading">You are sharing your screen</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block font-medium">Live stream is visible to other participants</span>
                          </div>
                        </div>

                        {/* Bottom-Left Overlay */}
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-auto">
                          <div className="text-sm font-extrabold text-white flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-blue-400" />
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
                        u.has_video &&
                        camStream &&
                        camStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted)
                      );
                      const hasScreen = Boolean(
                        u.is_screen_sharing &&
                        scrStream &&
                        scrStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled && !t.muted)
                      );
                      const isPeerCameraVertical = Boolean(peerOrientations[`${u.id}-camera`]);
                      const isPeerCameraBlack = Boolean(peerCameraBlack[u.id]);
                      const isPeerDisplayingVideo = hasCamera && !isPeerCameraBlack;

                      return (
                        <React.Fragment key={u.id}>
                          {/* Dedicated Remote Camera Tile (when camera is on) */}
                          {hasCamera && (
                            <div className={`relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-2xl ${
                              isPeerDisplayingVideo && isPeerCameraVertical 
                                ? 'aspect-[9/16] w-full max-w-[280px] sm:max-w-[320px] max-h-[520px]' 
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
                                onOrientationChange={(vert) => setPeerOrientations((prev) => ({ ...prev, [`${u.id}-camera`]: vert }))}
                                onBlackStateChange={(isBlack) => setPeerCameraBlack((prev) => ({ ...prev, [u.id]: isBlack }))}
                                isScreen={false}
                                isSpeaking={isPeerSpeaking}
                              />

                              {/* Orientation Badge (only shown when camera is active and not black) */}
                              {isPeerDisplayingVideo && (
                                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-slate-950/70 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none">
                                  {isPeerCameraVertical ? (
                                    <>
                                      <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Portrait</span>
                                    </>
                                  ) : (
                                    <>
                                      <Monitor className="w-3.5 h-3.5 text-blue-400" />
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

                              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-sm font-extrabold text-white">
                                  {u.username} {isPeerDisplayingVideo ? '(Camera)' : ''}
                                </div>
                                {u.is_muted && <MicOff className="w-4 h-4 text-zinc-400" />}
                              </div>
                            </div>
                          )}

                          {/* Dedicated Remote Screen Share Tile (when screen share is on) */}
                          {hasScreen && (
                            <div className="relative rounded-3xl overflow-hidden bg-slate-900 dark:bg-slate-900 border border-blue-500/30 transition-all duration-300 flex flex-col items-center justify-center shadow-2xl aspect-video w-full max-w-[500px]">
                              <RemoteVideoPlayer 
                                stream={scrStream} 
                                username={`${u.username}'s Screen`}
                                avatarColor={u.avatar_color}
                                onOrientationChange={(vert) => setPeerOrientations((prev) => ({ ...prev, [`${u.id}-screen`]: vert }))}
                                isScreen={true}
                              />
                              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-sm font-extrabold text-white flex items-center gap-2">
                                  <Monitor className="w-4 h-4 text-blue-400" />
                                  <span>{u.username}&apos;s Screen</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Dedicated Remote Avatar Tile (shown when camera is off so peer is ALWAYS visible, even during screen share) */}
                          {!hasCamera && (
                            <div className={`relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-xl aspect-video w-full max-w-[500px] ${
                              isPeerSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                            }`}>
                              <div className="relative flex items-center justify-center">
                                <div className={`transition-all ${isPeerSpeaking ? 'ring-4 ring-amber-500 rounded-full shadow-[0_0_30px_#f59e0b]' : ''}`}>
                                  {renderAvatar(u, 'w-28 h-28 text-3xl')}
                                </div>
                              </div>

                              {/* Hand Raised Indicator */}
                              {u.is_hand_raised && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-amber-500/90 backdrop-blur-md border border-amber-400 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none animate-bounce">
                                  <Hand className="w-3.5 h-3.5" />
                                  <span>Hand Raised</span>
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-sm font-extrabold text-white">
                                  {u.username}
                                </div>
                                {u.is_muted && <MicOff className="w-4 h-4 text-slate-300" />}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                  </div>
                ) : (
                  /* Connecting State while auto-joining */
                  <div className="text-center space-y-4 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm animate-pulse">
                      <Mic className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white font-heading">Connecting to General Voice...</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Please allow microphone access when prompted.</p>
                  </div>
                )}

              </div>

              {/* Floating Bottom In-Call Control Bar - Adapts to Mobile, Console, and Desktop */}
              {isInVideo && (
                <div className="absolute bottom-4 sm:bottom-6 inset-x-0 flex items-center justify-center gap-2 sm:gap-4 z-30 px-3 pointer-events-auto">
                  <div className="flex items-center gap-2.5 sm:gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2.5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl transition-colors">
                    {/* Mic Button */}
                    <button 
                      onClick={toggleMute}
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                        isMuted ? 'bg-red-600 text-white shadow-red-600/30' : 'bg-blue-600 text-white shadow-blue-600/30'
                      }`}
                      title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                    >
                      {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>

                    {/* Camera Toggle Button */}
                    <button 
                      onClick={() => toggleCamera()}
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                        isVideoEnabled 
                          ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                      title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                      {isVideoEnabled ? <Video className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </button>

                    {/* Screen Share Button */}
                    <button 
                      onClick={toggleScreenShare}
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                        isScreenSharing 
                          ? 'bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                      title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                    >
                      <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {/* Raise Hand Button */}
                    <button 
                      onClick={toggleHandRaise}
                      className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
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
                      className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all cursor-pointer"
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
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
                  <Mic className="w-4 h-4" />
                  <span>VOICE — {voiceUsers.length + (isInVideo ? 1 : 0)}</span>
                </div>
              </div>

              {/* SCROLLABLE ONLINE & VOICE MEMBERS */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pt-3 pr-1">
                <div className="space-y-2">
                  {isInVideo && (
                    <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {renderAvatar(currentUser, 'w-8 h-8 text-xs')}
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{currentUser.username}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">(you)</span>
                          </div>
                          {renderUserActivity('In General Voice')}
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    </div>
                  )}

                  {voiceUsers.map((u: any) => (
                    <div key={u.id} className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {renderAvatar(u, 'w-8 h-8 text-xs')}
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate block">{u.username}</span>
                          {renderUserActivity(u.activity || 'In General Voice')}
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
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
                        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate block">{u.username}</span>
                        {renderUserActivity(u.activity || 'In #general')}
                      </div>
                      
                      {/* Action buttons on hover */}
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => {
                            const dmChan = getDmChannelId(u.id);
                            handleChannelSelect(dmChan);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all cursor-pointer"
                          title="Send Private Message"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </aside>

            {/* Mobile / Tablet Members Drawer Overlay for Voice Channel */}
            {isMobileMembersOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex justify-end animate-in fade-in duration-200">
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setIsMobileMembersOpen(false)}
                />
                <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
                  <div className="shrink-0 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
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
                        <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              {renderAvatar(currentUser, 'w-8 h-8 text-xs')}
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                            </div>
                            <div className="min-w-0 leading-tight">
                              <div className="flex items-center gap-1">
                                <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate">{currentUser.username}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">(you)</span>
                              </div>
                              {renderUserActivity('In General Voice')}
                            </div>
                          </div>
                          <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        </div>
                      )}

                      {voiceUsers.map((u: any) => (
                        <div key={u.id} className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              {renderAvatar(u, 'w-8 h-8 text-xs')}
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                            </div>
                            <div className="min-w-0 leading-tight">
                              <span className="font-extrabold text-slate-900 dark:text-white text-xs truncate block">{u.username}</span>
                              {renderUserActivity(u.activity || 'In General Voice')}
                            </div>
                          </div>
                          <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
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
                            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                          </div>
                          <div className="min-w-0 flex-1 leading-tight">
                            <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate block">{u.username}</span>
                            {renderUserActivity(u.activity || 'In #general')}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => {
                                const dmChan = getDmChannelId(u.id);
                                handleChannelSelect(dmChan);
                                setIsMobileMembersOpen(false);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all cursor-pointer"
                              title="Send Private Message"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsMobileChannelsOpen(false)}
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-72 max-w-[85vw] h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col z-10 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                    <Snowflake className="w-5 h-5 fill-none" />
                  </div>
                  <h1 className="font-black text-slate-900 dark:text-white text-base tracking-tight">Community</h1>
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
                        ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20 border-blue-500'
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
                        ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20 border-blue-500'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Mic className={`w-4 h-4 ${activeChannel === 'video-general' ? 'text-white' : 'text-blue-500'}`} />
                      <span className="text-sm font-bold">General Voice</span>
                    </div>
                  </motion.button>
                </div>

                {/* Private Chats Section */}
                {dmPeers.length > 0 && (
                  <div className="space-y-2">
                    <div className="px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase">
                      Private Chats
                    </div>
                    <div className="space-y-1">
                      {dmPeers.map((peer: any) => {
                        const dmChan = getDmChannelId(peer.id);
                        const isDmActive = activeChannel === dmChan;
                        return (
                          <motion.button
                            key={peer.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleChannelSelect(dmChan)}
                            className={`w-full px-3 py-2 rounded-2xl flex items-center gap-2.5 transition-all cursor-pointer border ${
                              isDmActive
                                ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20 border-blue-500'
                                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                            }`}
                          >
                            <div className="relative shrink-0">
                              {renderAvatar(peer, 'w-6 h-6 text-[10px]')}
                              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
                            </div>
                            <span className="text-xs font-bold truncate">{peer.username}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile User Footer */}
              <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {renderAvatar(currentUser, 'w-9 h-9 text-xs')}
                  <div className="min-w-0">
                    <div className="font-black text-slate-900 dark:text-white text-xs truncate">{currentUser.username}</div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Active</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-2 rounded-xl border ${isMuted ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-transparent'}`}
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl space-y-6">
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
                <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                  {isAvatarProcessing ? 'Optimizing...' : (editAvatarUrl ? 'Change' : 'Upload')}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isAvatarProcessing}
                  onClick={() => profileAvatarInputRef.current?.click()}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
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
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors font-bold"
              />
            </div>

            {/* Avatar Color Picker */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Avatar Theme Accent
              </label>
              <div className="flex items-center gap-2">
                {['var(--vibrant-cyan)', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
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
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
