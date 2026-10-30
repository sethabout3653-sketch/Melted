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
  Phone,
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
  Hand
} from 'lucide-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { useWebRTC } from '../services/useWebRTC';

interface ChatViewProps {
  globalChat: any;
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

// Dedicated Audio Player Component
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

// Single Audio Track Player - plays a specific track with full volume, unmute detection, and autoplay resilience
const SingleAudioTrackPlayer: React.FC<{ track: MediaStreamTrack; isDeafened: boolean; volume: number }> = ({ track, isDeafened, volume }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track) return;

    // Check if the element already has a stream with this track
    const currentStream = el.srcObject as MediaStream | null;
    const currentTrackId = currentStream?.getAudioTracks()[0]?.id;

    if (currentTrackId !== track.id) {
      el.srcObject = new MediaStream([track]);
    }

    el.muted = isDeafened;
    el.volume = Math.max(0, Math.min(1, volume));

    const tryPlay = () => {
      if (el) {
        el.play().catch(() => {});
      }
    };

    tryPlay();
    track.addEventListener('unmute', tryPlay);

    const onUserGesture = () => {
      tryPlay();
    };

    window.addEventListener('click', onUserGesture, { once: true });
    window.addEventListener('touchstart', onUserGesture, { once: true });
    window.addEventListener('keydown', onUserGesture, { once: true });

    return () => {
      track.removeEventListener('unmute', tryPlay);
      window.removeEventListener('click', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
    };
  }, [track, isDeafened, volume]);

  return <audio ref={audioRef} autoPlay playsInline style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, pointerEvents: 'none' }} />;
};

// Dedicated audio player for WebRTC voice peers (plays both microphone and screen share audio tracks!)
const RemoteAudioPlayer: React.FC<{ stream: MediaStream | undefined; isDeafened: boolean; volume?: number }> = ({ stream, isDeafened, volume = 1 }) => {
  const [tracks, setTracks] = useState<MediaStreamTrack[]>([]);

  useEffect(() => {
    if (!stream) {
      setTracks([]);
      return;
    }

    const updateTracks = () => {
      const live = stream.getAudioTracks().filter((t) => t.readyState === 'live');
      setTracks(live);
    };

    updateTracks();
    stream.onaddtrack = updateTracks;
    stream.onremovetrack = updateTracks;

    return () => {
      stream.onaddtrack = null;
      stream.onremovetrack = null;
    };
  }, [stream]);

  if (!stream || tracks.length === 0) return null;

  return (
    <>
      {tracks.map((track) => (
        <SingleAudioTrackPlayer
          key={track.id}
          track={track}
          isDeafened={isDeafened}
          volume={volume}
        />
      ))}
    </>
  );
};

// Remote Video Player with robust frame detection, orientation checking, and black screen prevention
const RemoteVideoPlayer: React.FC<{ 
  stream: MediaStream | undefined;
  username: string;
  avatarColor?: string;
  onOrientationChange?: (isVertical: boolean) => void;
  isScreen?: boolean;
  isVertical?: boolean;
}> = ({ stream, username, avatarColor, onOrientationChange, isScreen = false, isVertical = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideoFrame, setHasVideoFrame] = useState(false);

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
      setHasVideoFrame(false);
      return;
    }

    const liveTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
    if (liveTracks.length === 0) {
      video.srcObject = null;
      setHasVideoFrame(false);
      return;
    }

    liveTracks.forEach((t) => { t.enabled = true; });

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.muted = true;
    video.defaultMuted = true;

    const checkFrame = () => {
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        setHasVideoFrame(true);
        checkOrientationRef.current();
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
      liveTracks.forEach((t) => { t.enabled = true; });
      tryPlay();
    };

    liveTracks.forEach((t) => {
      t.addEventListener('unmute', handleUnmute);
    });

    const handleAddTrack = (e: MediaStreamTrackEvent) => {
      if (e.track.kind === 'video') {
        e.track.enabled = true;
        e.track.addEventListener('unmute', handleUnmute);
        tryPlay();
      }
    };
    stream.addEventListener('addtrack', handleAddTrack);

    video.addEventListener('loadeddata', checkFrame);
    video.addEventListener('loadedmetadata', checkFrame);
    video.addEventListener('canplay', checkFrame);
    video.addEventListener('playing', checkFrame);

    const onUserGesture = () => {
      tryPlay();
    };

    window.addEventListener('click', onUserGesture, { once: true });
    window.addEventListener('touchstart', onUserGesture, { once: true });
    window.addEventListener('keydown', onUserGesture, { once: true });

    return () => {
      liveTracks.forEach((t) => {
        t.removeEventListener('unmute', handleUnmute);
      });
      stream.removeEventListener('addtrack', handleAddTrack);
      video.removeEventListener('loadeddata', checkFrame);
      video.removeEventListener('loadedmetadata', checkFrame);
      video.removeEventListener('canplay', checkFrame);
      video.removeEventListener('playing', checkFrame);
      window.removeEventListener('click', onUserGesture);
      window.removeEventListener('touchstart', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-3xl bg-[#0f0f12]">
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
            setHasVideoFrame(true);
          }
        }}
        onCanPlay={() => {
          const video = videoRef.current;
          if (video && video.videoWidth > 0) {
            setHasVideoFrame(true);
          }
        }}
        onPlaying={() => {
          setHasVideoFrame(true);
          checkOrientation();
        }}
        onResize={checkOrientation}
        className={`w-full h-full ${isScreen ? 'object-contain' : 'object-cover'} rounded-3xl opacity-100 transition-opacity duration-200`}
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
  isMirrored?: boolean;
  isScreen?: boolean;
}> = ({ stream, user, renderAvatar, onOrientationChange, isMirrored = true, isScreen = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasFrame, setHasFrame] = useState(false);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      video.srcObject = null;
      setHasFrame(false);
      return;
    }

    const liveTracks = stream.getVideoTracks().filter((t) => t.readyState === 'live');
    if (liveTracks.length === 0) {
      video.srcObject = null;
      setHasFrame(false);
      return;
    }

    liveTracks.forEach((t) => { t.enabled = true; });

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.muted = true;
    video.defaultMuted = true;

    const checkFrame = () => {
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        setHasFrame(true);
        checkOrientation();
      }
    };

    video.play().then(() => {
      checkFrame();
    }).catch(() => {});

    video.addEventListener('loadeddata', checkFrame);
    video.addEventListener('loadedmetadata', checkFrame);
    video.addEventListener('playing', checkFrame);

    return () => {
      video.removeEventListener('loadeddata', checkFrame);
      video.removeEventListener('loadedmetadata', checkFrame);
      video.removeEventListener('playing', checkFrame);
    };
  }, [stream, checkOrientation]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-3xl bg-black">
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c22]">
          {renderAvatar(user, 'w-24 h-24 text-3xl')}
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
        className={`w-full h-full ${isScreen ? 'object-contain' : 'object-cover'} rounded-3xl ${isMirrored && !isScreen ? 'transform scale-x-[-1]' : ''} ${stream ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
      />
    </div>
  );
};

export const ChatView: React.FC<ChatViewProps> = ({ globalChat }) => {
  const {
    currentUser,
    setCurrentUser,
    users,
    messages,
    updateUser,
    insertMessage,
    deleteMessage,
    registerUser,
    sendRtcSignal,
    setRtcSignalHandler,
    setMediaHandlers,
    incomingCall,
    outgoingCall,
    dismissIncomingCall,
    dismissOutgoingCall,
    isConnected,
  } = globalChat;

  const [activeChannel, setActiveChannel] = useState<'text-general' | 'video-general'>('text-general');
  const [inputText, setInputText] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

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

  useEffect(() => {
    setEditName(currentUser.username);
    setEditColor(currentUser.avatar_color || 'var(--vibrant-cyan)');
    setEditAvatarUrl(currentUser.avatar_url || '');
  }, [currentUser.username, currentUser.avatar_color, currentUser.avatar_url]);

  const handleProfileAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64Data, mimeType: file.type }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          setEditAvatarUrl(data.url);
        } else {
          setEditAvatarUrl(base64Data);
        }
      } catch {
        setEditAvatarUrl(base64Data);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveProfile = () => {
    const updatedUser = { ...currentUser, username: editName, avatar_color: editColor, avatar_url: editAvatarUrl };
    setCurrentUser(updatedUser);
    localStorage.setItem('frosted_chat_username', editName);
    localStorage.setItem('frosted_chat_usercolor', editColor);
    localStorage.setItem('frosted_chat_avatar_url', editAvatarUrl);
    
    updateUser({ username: editName, avatar_color: editColor, avatar_url: editAvatarUrl });
    registerUser(updatedUser);
    
    setIsProfileModalOpen(false);
  };

  // Helper to render user avatar (supports custom image upload / URL or colored initials fallback)
  const renderAvatar = (u: { username: string; avatar_color?: string; avatar_url?: string }, sizeClass: string = 'w-9 h-9 text-xs') => {
    if (u.avatar_url && u.avatar_url.trim()) {
      return (
        <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 border border-white/10 bg-black`}>
          <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div 
        className={`${sizeClass} rounded-full text-black font-extrabold flex items-center justify-center shrink-0 shadow-sm`}
        style={{ backgroundColor: u.avatar_color || 'var(--vibrant-cyan)' }}
      >
        {(u.username || 'P').slice(0, 2).toUpperCase()}
      </div>
    );
  };

  // Voice & Video Call States
  const [isInVideo, setIsInVideo] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [localIsVertical, setLocalIsVertical] = useState(() => {
    return typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  });
  const [peerOrientations, setPeerOrientations] = useState<Record<string, boolean>>({});

  // Standard robust camera streamer
  const acquireCameraStream = async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    }
  };

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  // Mobile Drawer toggles for adapting to mobile devices
  const [isMobileChannelsOpen, setIsMobileChannelsOpen] = useState(false);
  const [isMobileMembersOpen, setIsMobileMembersOpen] = useState(false);

  // Local Reactive Media Streams
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [activeVideoStream, setActiveVideoStream] = useState<MediaStream | null>(null); // For WebRTC hook (combined)

  // Media Stream refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Combine streams for WebRTC
  const activeVideoStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const cameraTracks = cameraStream?.getVideoTracks() || [];
    const screenTracks = screenStream?.getVideoTracks() || [];
    
    // Check if tracks have actually changed
    const currentTrackIds = [...cameraTracks, ...screenTracks].map(t => t.id).join(',');
    const previousTrackIds = activeVideoStreamRef.current ? 
        activeVideoStreamRef.current.getVideoTracks().map(t => t.id).join(',') : '';

    if (currentTrackIds !== previousTrackIds) {
        const combined = new MediaStream();
        cameraTracks.forEach(t => combined.addTrack(t));
        screenTracks.forEach(t => combined.addTrack(t));
        activeVideoStreamRef.current = combined;
        setActiveVideoStream(combined);
    }
  }, [cameraStream, screenStream]);

  // Keep microphone and screen share audio strictly separated!
  // localAudioStream contains purely the microphone stream with echo cancellation.
  useEffect(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);


  const [micError, setMicError] = useState<string | null>(null);
  const [micPermissionStatus, setMicPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);

  // Probe browser microphone permission state
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as any })
        .then((status) => {
          setMicPermissionStatus(status.state as any);
          status.onchange = () => {
            setMicPermissionStatus(status.state as any);
          };
        })
        .catch(() => {
          setMicPermissionStatus('prompt');
        });
    } else {
      setMicPermissionStatus('prompt');
    }
  }, []);

  // Explicit microphone permission requester with instant browser prompt
  const requestMicrophonePermission = async (withVideo: boolean = false) => {
    // Unlock AudioContext inside user gesture
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    }

    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: true,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googHighpassFilter: false,
          googTypingNoiseDetection: false,
          googAudioMirroring: false,
        } as any,
        video: false,
      });

      setMicPermissionStatus('granted');
      setShowMicPermissionModal(false);
      micStreamRef.current = stream;
      setLocalAudioStream(stream);
      setIsMuted(false);
      setIsInVideo(true);
      setActiveChannel('video-general');

      setCurrentUser((prev: any) => ({
        ...prev,
        current_channel: 'video-general',
        activity: 'In General Voice',
      }));

      updateUser({
        current_channel: 'video-general',
        activity: 'In General Voice',
        has_video: false,
        is_speaking: false,
        is_muted: false,
        is_deafened: false,
        is_screen_sharing: false,
      });

      if (withVideo) {
        toggleCamera();
      }
    } catch (err: any) {
      console.warn('Microphone permission request result:', err);
      setMicPermissionStatus('denied');
      setMicError('Microphone permission was not allowed. Please click the site settings/lock icon in your browser URL bar to allow microphone access.');
    }
  };

  // Helper rendering live presence activities (e.g. playing "Slope", searching games, in #general)
  const renderUserActivity = (activity?: string) => {
    if (!activity) return null;
    const isPlaying = activity.startsWith('Playing');
    const isSearching = activity.includes('Searching');
    const isVoice = activity.includes('Voice');
    const isChat = activity.includes('#general');

    if (isPlaying) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold truncate mt-0.5" title={activity}>
          <Gamepad2 className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate">{activity}</span>
        </div>
      );
    }

    if (isSearching) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold truncate mt-0.5" title={activity}>
          <Search className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="truncate">{activity}</span>
        </div>
      );
    }

    if (isVoice) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-blue-400 font-semibold truncate mt-0.5" title={activity}>
          <Mic className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">{activity}</span>
        </div>
      );
    }

    if (isChat) {
      return (
        <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-medium truncate mt-0.5" title={activity}>
          <MessageSquare className="w-3 h-3 text-zinc-500 shrink-0" />
          <span className="truncate">{activity}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-medium truncate mt-0.5" title={activity}>
        <span className="truncate">{activity}</span>
      </div>
    );
  };

  // Connected peers in voice and video channels
  const voiceUsers = useMemo(() => {
    return users.filter(
      (u: any) =>
        (u.current_channel === 'video-general' || u.current_channel === 'voice-general') &&
        u.id !== currentUser.id
    );
  }, [users, currentUser.id]);
  
  const lastHandRaisedStates = useRef<Map<string, boolean>>(new Map());

  const playHandRaiseSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playChime = (time: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.1);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, time + 0.3);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.4);
      };

      // Double chime for maximum attention
      playChime(ctx.currentTime, 660);
      playChime(ctx.currentTime + 0.15, 880);
    } catch (e) {
      console.warn('Failed to play hand raise sound:', e);
    }
  }, []);

  useEffect(() => {
    voiceUsers.forEach((u: any) => {
      const wasRaised = lastHandRaisedStates.current.get(u.id) || false;
      const isRaised = !!u.is_hand_raised;
      
      if (!wasRaised && isRaised) {
        playHandRaiseSound();
      }
      
      lastHandRaisedStates.current.set(u.id, isRaised);
    });

    // Cleanup stale users
    const currentIds = new Set(voiceUsers.map((u: any) => u.id));
    Array.from(lastHandRaisedStates.current.keys()).forEach(id => {
      if (!currentIds.has(id)) lastHandRaisedStates.current.delete(id);
    });
  }, [voiceUsers, playHandRaiseSound]);

  const toggleHandRaise = () => {
    const nextState = !currentUser.is_hand_raised;
    setCurrentUser((prev: any) => ({ ...prev, is_hand_raised: nextState }));
    updateUser({ is_hand_raised: nextState });
  };

  const isMediaActive = activeChannel === 'video-general' || isInVideo;

  const activePeers = useMemo(() => {
    if (!isMediaActive) return [];
    return voiceUsers;
  }, [voiceUsers, isMediaActive]);

  const { remoteStreams, remoteScreenAudioStreams, remoteCameraStreams, remoteScreenStreams, remoteSpeaking } = useWebRTC({
    currentUserId: currentUser.id,
    activeChannel: isMediaActive ? 'video-general' : 'text-general',
    localAudioStream,
    localVideoStream: activeVideoStream,
    cameraStream,
    screenStream,
    isVertical: localIsVertical,
    peers: activePeers,
    sendRtcSignal,
    setRtcSignalHandler,
    setMediaHandlers,
  });

  // Enforce single screen share: if another user starts screen sharing, instantly stop our screen share
  useEffect(() => {
    if (isScreenSharing) {
      const activeOtherSharer = users.find((u: any) => u.is_screen_sharing && u.id !== currentUser.id);
      if (activeOtherSharer) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }
        setIsScreenSharing(false);
        setScreenStream(null);
        updateUser({ is_screen_sharing: false, has_video: isVideoEnabled });
      }
    }
  }, [users, isScreenSharing, currentUser.id, isVideoEnabled, updateUser]);

  // Sync scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  // GIF items state
  const [gifs, setGifs] = useState<any[]>([]);
  const [isGifsLoading, setIsGifsLoading] = useState(false);

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

    return () => {
      isCurrent = false;
    };
  }, [isGiphyOpen, giphySearch]);

  const handleCategorySelect = (category: { label: string; query: string }) => {
    setActiveCategoryLabel(category.label);
    setGiphySearch(category.query);
  };

  // Voice Detection Logic
  useEffect(() => {
    if (!localAudioStream || isMuted) {
      if (!isMicTesting) {
        setIsUserSpeaking((prev) => (prev ? false : prev));
        setAudioLevel((prev) => (prev !== 0 ? 0 : prev));
        updateUserRef.current({ is_speaking: false });
      }
      return;
    }

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(localAudioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingCounter = 0;
      let lastSpeaking = false;

      const detectSpeaking = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        if (isMicTesting) {
          setAudioLevel(normalized);
        }

        const speakingThreshold = 8;
        if (normalized > speakingThreshold) {
          speakingCounter = Math.min(speakingCounter + 1, 8);
        } else {
          speakingCounter = Math.max(speakingCounter - 1, 0);
        }

        const currentlySpeaking = speakingCounter > 2;
        if (lastSpeaking !== currentlySpeaking) {
          lastSpeaking = currentlySpeaking;
          setIsUserSpeaking(currentlySpeaking);
          updateUserRef.current({ is_speaking: currentlySpeaking });
        }

        animFrameRef.current = requestAnimationFrame(detectSpeaking);
      };

      detectSpeaking();

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        source.disconnect();
        analyser.disconnect();
      };
    } catch {
      // Audio analysis error handled gracefully
    }
  }, [localAudioStream, isMuted, isMicTesting]);

  // Robust media acquisition allowing any noise with echo cancellation
  const acquireAudioStream = async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: true,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googHighpassFilter: false,
          googTypingNoiseDetection: false,
          googAudioMirroring: false,
        } as any,
        video: false,
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
          },
          video: false,
        });
      } catch (err) {
        console.error('[WebRTC] Audio acquisition failed:', err);
        throw err;
      }
    }
  };

  // Re-acquire stream if device change occurs
  useEffect(() => {
    const handleDeviceChange = async () => {
      if (isInVideo) {
        console.log('[WebRTC] Audio device change detected, re-initializing...');
        try {
          const newStream = await acquireAudioStream();
          micStreamRef.current = newStream;
          setLocalAudioStream(newStream);
        } catch (e) {
          console.error('[WebRTC] Failed to re-acquire audio after device change:', e);
        }
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [isInVideo]);

  // Updated joinVoiceChannel using robust acquisition
  const joinVoiceChannel = async (withVideo: boolean = false) => {
    // Unlock AudioContext inside user gesture
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    }

    setMicError(null);
    setCameraError(null);

    let audioStream: MediaStream | null = null;
    let videoStream: MediaStream | null = null;

    try {
      audioStream = await acquireAudioStream();
      setMicPermissionStatus('granted');
      micStreamRef.current = audioStream;
      setLocalAudioStream(audioStream);
      setIsMuted(false);
    } catch (err: any) {
      setMicPermissionStatus('denied');
      setMicError('Could not access microphone. Please check your connection and allow microphone permission.');
    }

    if (withVideo) {
      setIsCameraStarting(true);
      try {
        videoStream = await acquireCameraStream();

        cameraStreamRef.current = videoStream;
        setIsVideoEnabled(true);
        setCameraStream(videoStream);
        updateUser({ has_video: true });
      } catch (err: any) {
        setCameraError('Could not access camera.');
        setIsVideoEnabled(false);
      } finally {
        setIsCameraStarting(false);
      }
    }

    setIsInVideo(true);
    setActiveChannel('video-general');

    setCurrentUser((prev: any) => ({
      ...prev,
      current_channel: 'video-general',
      activity: 'In General Voice',
    }));

    updateUser({
      current_channel: 'video-general',
      activity: 'In General Voice',
      has_video: !!videoStream,
      is_speaking: false,
      is_muted: false,
      is_deafened: false,
      is_screen_sharing: false,
    });
  };

  // Sync call acceptance from global overlay
  useEffect(() => {
    if (globalChat.callAccepted && incomingCall) {
      joinVoiceChannel(incomingCall.callType === 'video');
      if (dismissIncomingCall) dismissIncomingCall();
    }
  }, [globalChat.callAccepted, incomingCall, dismissIncomingCall]);

  // Toggle Camera
  const toggleCamera = async () => {
    if (isVideoEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      setIsVideoEnabled(false);
      setCameraStream(null);
      updateUser({ has_video: false });
    } else {
      setIsCameraStarting(true);
      setCameraError(null);
      try {
        const stream = await acquireCameraStream();

        cameraStreamRef.current = stream;
        setIsVideoEnabled(true);
        setCameraStream(stream);
        updateUser({ has_video: true });
      } catch (err: any) {
        setCameraError('Camera access denied or unavailable.');
        setIsVideoEnabled(false);
      } finally {
        setIsCameraStarting(false);
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    // Synchronously resume/create audio context inside user interaction click
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    }

    setScreenShareError(null);

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      setScreenStream(null);
      updateUser({ is_screen_sharing: false, has_video: isVideoEnabled });
    } else {
      if (!isInVideo) {
        await joinVoiceChannel(false);
      }

      // Feature detection for iOS Apple OS limitation
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        setScreenShareError('Screen sharing is not supported by web browsers on iOS due to Apple OS restrictions.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setScreenShareError('Screen sharing is not supported by this browser.');
        return;
      }

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      let stream: MediaStream | null = null;

      try {
        if (isMobile) {
          // Android Chrome requires simple/flexible constraints with lower framerate
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 15 },
            },
            audio: false,
          });
        } else {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              } as any,
            });
          } catch {
            try {
              stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
              });
            } catch {
              stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Screen share cancelled or failed:', err);
        if (err.name !== 'NotAllowedError') {
          setScreenShareError(err.message || 'Could not start screen sharing.');
        }
        return;
      }

      if (!stream) return;

      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      setScreenStream(stream);
      updateUser({ is_screen_sharing: true, has_video: isVideoEnabled });

      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
          }
          setIsScreenSharing(false);
          setScreenStream(null);
          updateUser({ is_screen_sharing: false, has_video: isVideoEnabled });
        };
      });
    }
  };

  // Stop / Disconnect Voice Channel
  const stopVoiceChannel = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    setLocalAudioStream(null);
    setCameraStream(null);
    setScreenStream(null);
    setIsInVideo(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setIsUserSpeaking(false);

    setCurrentUser((prev: any) => ({
      ...prev,
      current_channel: 'text-general',
      activity: 'In #general',
      is_hand_raised: false,
    }));

    updateUser({
      current_channel: 'text-general',
      activity: 'In #general',
      has_video: false,
      is_speaking: false,
      is_screen_sharing: false,
      is_hand_raised: false,
    });
    setActiveChannel('text-general');
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    }
    updateUser({ is_muted: nextMuted });
  };

  const toggleDeafen = () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    updateUser({ is_deafened: nextDeafened });
  };

  const handleChannelSelect = (channel: 'text-general' | 'video-general') => {
    setActiveChannel(channel);
    // If user is currently active in voice, browsing to text chat shouldn't kick them out of voice!
    if (!isInVideo) {
      const newActivity = channel === 'video-general' ? 'In General Voice' : 'In #general';
      setCurrentUser((prev: any) => ({ ...prev, current_channel: channel, activity: newActivity }));
      updateUser({ current_channel: channel, activity: newActivity });
    }
    if (channel === 'video-general' && !isInVideo) {
      if (micPermissionStatus === 'prompt') {
        setShowMicPermissionModal(true);
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

  // Accept Call
  const handleAcceptIncomingCall = () => {
    if (incomingCall) {
      joinVoiceChannel(incomingCall.callType === 'video');
      if (dismissIncomingCall) dismissIncomingCall();
    }
  };

  return (
    <div className="flex flex-1 min-h-0 h-full w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden select-none transition-colors">
      
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
        <div className="p-6 space-y-8 shrink-0">
          
          {/* Header Branding */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
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
                  {messages.length}
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
        
        {/* TEXT CHANNEL VIEW */}
        {activeChannel === 'text-general' && (
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
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative hidden sm:block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search messages"
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-9 pr-3 py-2 w-36 sm:w-48 focus:outline-none focus:border-blue-500"
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
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                


                {/* Messages List */}
                {messages.map((msg: any) => {
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
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
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
                    placeholder="Message #general..."
                    className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
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

                    {/* Desktop Direct Call Button */}
                    {u.id !== currentUser.id && (
                      <button
                        onClick={() => globalChat.initiateCall(u.id, u.username, 'audio')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        title={`Call ${u.username}`}
                      >
                        <Phone className="w-4 h-4" />
                      </button>
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
                          <div 
                            className="w-9 h-9 rounded-full text-black font-extrabold flex items-center justify-center text-xs shadow-sm"
                            style={{ backgroundColor: u.avatar_color || 'var(--vibrant-cyan)' }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
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

                        {/* Mobile Direct Call Button */}
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => globalChat.initiateCall(u.id, u.username, 'audio')}
                            className="p-2 rounded-xl text-zinc-400 hover:text-emerald-500 hover:bg-white/5 transition-all cursor-pointer"
                            title={`Call ${u.username}`}
                          >
                            <Phone className="w-5 h-5" />
                          </button>
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
                    
                    {/* Camera Tile */}
                    {isVideoEnabled && cameraStream && (
                      <div className={`relative rounded-3xl overflow-hidden bg-slate-900 dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-2xl ${
                        localIsVertical 
                          ? 'aspect-[9/16] w-full max-w-[280px] sm:max-w-[320px] max-h-[520px]' 
                          : 'aspect-video w-full max-w-[500px]'
                      } ${
                        isUserSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                      }`}>
                        <LocalVideoPlayer 
                          stream={cameraStream} 
                          user={currentUser}
                          renderAvatar={renderAvatar}
                          onOrientationChange={setLocalIsVertical}
                          isMirrored={true}
                        />

                        {/* Orientation Badge */}
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
                            {currentUser.username} (You - Camera)
                          </div>
                          {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                        </div>
                      </div>
                    )}

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

                    {/* Avatar Tile (ALWAYS shown when camera is off, even if screen sharing!) */}
                    {(!isVideoEnabled || !cameraStream) && (
                      <div className={`relative rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-xl aspect-video w-full max-w-[500px] ${
                        isUserSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                      }`}>
                        <div className="relative flex items-center justify-center">
                          <div className={`transition-all ${isUserSpeaking ? 'ring-4 ring-amber-500 rounded-full shadow-[0_0_30px_#f59e0b]' : ''}`}>
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

                    {/* Remote Peers Tiles */}
                    {voiceUsers.map((u: any) => {
                      const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                      const camStream = remoteCameraStreams[u.id];
                      const scrStream = remoteScreenStreams[u.id];

                      const hasCamera = Boolean(camStream && camStream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled));
                      const hasScreen = Boolean(scrStream && scrStream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled));
                      const isPeerCameraVertical = Boolean(peerOrientations[`${u.id}-camera`]);

                      return (
                        <React.Fragment key={u.id}>
                          {/* Dedicated Remote Camera Tile (when camera is on) */}
                          {hasCamera && (
                            <div className={`relative rounded-3xl overflow-hidden bg-slate-900 dark:bg-slate-900 border transition-all duration-300 flex flex-col items-center justify-center shadow-2xl ${
                              isPeerCameraVertical 
                                ? 'aspect-[9/16] w-full max-w-[280px] sm:max-w-[320px] max-h-[520px]' 
                                : 'aspect-video w-full max-w-[500px]'
                            } ${
                              isPeerSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-slate-200 dark:border-slate-800'
                            }`}>
                              <RemoteVideoPlayer 
                                stream={camStream} 
                                username={u.username}
                                avatarColor={u.avatar_color}
                                onOrientationChange={(vert) => setPeerOrientations((prev) => ({ ...prev, [`${u.id}-camera`]: vert }))}
                                isScreen={false}
                              />

                              {/* Orientation Badge */}
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

                              {/* Hand Raised Indicator */}
                              {u.is_hand_raised && (
                                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-amber-500/90 backdrop-blur-md border border-amber-400 text-white text-[11px] font-bold flex items-center gap-1.5 z-20 shadow-lg pointer-events-none animate-bounce">
                                  <Hand className="w-3.5 h-3.5" />
                                  <span>Hand Raised</span>
                                </div>
                              )}

                              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                                <div className="text-sm font-extrabold text-white">
                                  {u.username} (Camera)
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
                  /* Join Prompt Card when not connected */
                  <div className="text-center space-y-5 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl">
                    <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
                      <Mic className="w-10 h-10" />
                    </div>
                    <div className="space-y-1.5">
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white font-heading">General Voice</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">
                        Talk with players with crystal-clear voice, share your camera, or stream gameplay with low latency.
                      </p>
                    </div>

                    {micError ? (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-800 rounded-2xl flex items-start gap-2.5 text-left text-xs text-red-600 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Microphone access required</p>
                          <p className="text-[11px] text-red-500/80 dark:text-red-300/80 mt-0.5">
                            Please click the permissions/lock icon in your browser URL bar and allow microphone.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-2xl flex items-center justify-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Requires microphone permission</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <button 
                        onClick={() => requestMicrophonePermission(false)}
                        className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-xl shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Allow Microphone & Join Voice</span>
                      </button>
                    </div>
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
                      onClick={stopVoiceChannel}
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
                          <div 
                            className="w-8 h-8 rounded-full text-black font-extrabold flex items-center justify-center text-xs"
                            style={{ backgroundColor: currentUser.avatar_color || 'var(--vibrant-cyan)' }}
                          >
                            {currentUser.username.slice(0, 2).toUpperCase()}
                          </div>
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
                          <div 
                            className="w-8 h-8 rounded-full text-black font-extrabold flex items-center justify-center text-xs"
                            style={{ backgroundColor: u.avatar_color || 'var(--vibrant-cyan)' }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
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
                    <div key={u.id} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="relative shrink-0">
                        <div 
                          className="w-7 h-7 rounded-full text-black font-extrabold flex items-center justify-center text-[10px]"
                          style={{ backgroundColor: u.avatar_color || 'var(--vibrant-cyan)' }}
                        >
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
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
                              <div 
                                className="w-8 h-8 rounded-full text-black font-extrabold flex items-center justify-center text-xs"
                                style={{ backgroundColor: currentUser.avatar_color || 'var(--vibrant-cyan)' }}
                              >
                                {currentUser.username.slice(0, 2).toUpperCase()}
                              </div>
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
                              <div 
                                className="w-8 h-8 rounded-full text-black font-extrabold flex items-center justify-center text-xs"
                                style={{ backgroundColor: u.avatar_color || 'var(--vibrant-cyan)' }}
                              >
                                {u.username.slice(0, 2).toUpperCase()}
                              </div>
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
                        <div key={u.id} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="relative shrink-0">
                            <div 
                              className="w-7 h-7 rounded-full text-black font-extrabold flex items-center justify-center text-[10px]"
                              style={{ backgroundColor: u.avatar_color || 'var(--vibrant-cyan)' }}
                            >
                              {u.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
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

      {/* INCOMING CALL MODAL */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-sm flex flex-col items-center text-center space-y-5 shadow-2xl">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue-600 text-white font-black text-2xl flex items-center justify-center ring-4 ring-blue-500/40 animate-pulse shadow-lg shadow-blue-600/30">
                {(incomingCall.fromUserName || 'P').slice(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-blue-500 text-white shadow-md">
                <Mic className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {incomingCall.fromUserName || 'Friend'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call...
              </p>
            </div>

            <div className="flex gap-4 w-full pt-2">
              <button
                onClick={() => dismissIncomingCall && dismissIncomingCall()}
                className="flex-1 py-3 rounded-2xl bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-600/30 hover:bg-red-100 dark:hover:bg-red-600/30 font-extrabold text-xs transition-colors cursor-pointer"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptIncomingCall}
                className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
              >
                Accept Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUTGOING CALL MODAL */}
      {outgoingCall && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-sm flex flex-col items-center text-center space-y-5 shadow-2xl">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue-600 text-white font-black text-2xl flex items-center justify-center ring-4 ring-blue-500/40 animate-pulse shadow-lg shadow-blue-600/30">
                {(outgoingCall.targetUserName || 'P').slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Calling {outgoingCall.targetUserName}...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Waiting for answer...
              </p>
            </div>

            <button
              onClick={() => dismissOutgoingCall && dismissOutgoingCall()}
              className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
            >
              Cancel Call
            </button>
          </div>
        </div>
      )}

      {/* PROFILE EDIT MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl space-y-6">
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
                onClick={() => profileAvatarInputRef.current?.click()}
                className="relative cursor-pointer group"
                title="Click to upload custom avatar image"
              >
                {renderAvatar({ username: editName || 'P', avatar_color: editColor, avatar_url: editAvatarUrl }, 'w-20 h-20 text-xl')}
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                  Upload
                </div>
              </div>
              <button
                type="button"
                onClick={() => profileAvatarInputRef.current?.click()}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Change Avatar Image
              </button>
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

      {/* Remote Peer Voice Audio (Microphone Speech) */}
      {Object.entries(remoteStreams).map(([peerId, stream]) => (
        <RemoteAudioPlayer
          key={`mic-${peerId}`}
          stream={stream}
          isDeafened={isDeafened}
        />
      ))}

      {/* Remote Screen Share Audio (Separate stream, pristine audio, no mic echo) */}
      {Object.entries(remoteScreenAudioStreams).map(([peerId, stream]) => (
        <RemoteAudioPlayer
          key={`screen-audio-${peerId}`}
          stream={stream}
          isDeafened={isDeafened}
        />
      ))}

    </div>
  );
};
