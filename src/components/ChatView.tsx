import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  RotateCw, 
  AlertCircle, 
  X, 
  Users, 
  Gamepad2, 
  MessageSquare, 
  Download, 
  FileText,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Music
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

// Helper mapping every single audio extension to bespoke styling and metadata
export function getAudioExtensionDetails(url?: string, name?: string) {
  const target = (name || url || '').toLowerCase();
  const match = target.match(/\.([a-z0-9]{2,5})(?:\?.*)?$/i);
  const ext = match ? match[1].toLowerCase() : 'audio';

  switch (ext) {
    case 'mp3':
      return { badge: 'MP3 AUDIO', label: 'MPEG-3 Audio', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'wav':
      return { badge: 'WAV LOSSLESS', label: 'PCM Studio Master', color: 'bg-sky-600/20 text-sky-400 border-sky-500/30' };
    case 'flac':
      return { badge: 'FLAC HI-RES', label: 'Free Lossless Audio', color: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' };
    case 'ogg':
    case 'oga':
    case 'ogv':
      return { badge: 'OGG VORBIS', label: 'Ogg Vorbis Audio', color: 'bg-blue-500/20 text-blue-300 border-blue-400/30' };
    case 'm4a':
      return { badge: 'M4A AUDIO', label: 'MPEG-4 Audio', color: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30' };
    case 'aac':
      return { badge: 'AAC STEREO', label: 'Advanced Audio Coding', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'opus':
      return { badge: 'OPUS STREAM', label: 'Interactive Internet Audio', color: 'bg-blue-700/20 text-blue-300 border-blue-600/30' };
    case 'weba':
      return { badge: 'WEBA AUDIO', label: 'WebM Audio Stream', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'aiff':
    case 'aif':
      return { badge: 'AIFF STUDIO', label: 'Audio Interchange Master', color: 'bg-sky-600/20 text-sky-400 border-sky-500/30' };
    case 'wma':
      return { badge: 'WMA AUDIO', label: 'Windows Media Audio', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'alac':
      return { badge: 'ALAC LOSSLESS', label: 'Apple Lossless Audio', color: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30' };
    case 'mid':
    case 'midi':
      return { badge: 'MIDI TRACK', label: 'Synthesizer Instrument', color: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30' };
    case 'amr':
      return { badge: 'AMR VOICE', label: 'Adaptive Multi-Rate Speech', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'ac3':
      return { badge: 'AC3 DOLBY', label: 'Dolby Digital Surround', color: 'bg-blue-500/20 text-blue-300 border-blue-400/30' };
    case 'dts':
      return { badge: 'DTS SURROUND', label: 'DTS Surround Audio', color: 'bg-blue-500/20 text-blue-300 border-blue-400/30' };
    case 'ape':
      return { badge: 'APE MONKEY', label: "Monkey's Audio Lossless", color: 'bg-sky-600/20 text-sky-400 border-sky-500/30' };
    case 'ra':
    case 'ram':
      return { badge: 'REALAUDIO', label: 'RealMedia Streaming', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'caf':
      return { badge: 'CORE AUDIO', label: 'Apple Core Audio Format', color: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30' };
    case 'mka':
      return { badge: 'MATROSKA', label: 'Matroska Audio Container', color: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' };
    case 'spx':
      return { badge: 'SPEEX VOICE', label: 'Speex Voice Codec', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'voc':
      return { badge: 'VOC AUDIO', label: 'Creative Voice File', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    case 'mod':
    case 'xm':
    case 'it':
    case 's3m':
      return { badge: `${ext.toUpperCase()} MODULE`, label: 'Chiptune Tracker Module', color: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' };
    case '3gp':
      return { badge: '3GP AUDIO', label: 'Mobile Audio Stream', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
    default:
      return { badge: `${ext.toUpperCase()} AUDIO`, label: `${ext.toUpperCase()} Audio Track`, color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' };
  }
}

// Dedicated Audio Player Component tailored for every audio extension
const AudioAttachmentPlayer: React.FC<{
  url: string;
  name?: string;
  onDownload?: () => void;
  showDownload?: boolean;
}> = ({ url, name, onDownload, showDownload = true }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const bar1Ref = useRef<HTMLSpanElement | null>(null);
  const bar2Ref = useRef<HTMLSpanElement | null>(null);
  const bar3Ref = useRef<HTMLSpanElement | null>(null);
  const bar4Ref = useRef<HTMLSpanElement | null>(null);
  const bar5Ref = useRef<HTMLSpanElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const extInfo = getAudioExtensionDetails(url, name);

  const initAudioAnalyser = () => {
    if (!audioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.65;
        analyserRef.current = analyser;
      }

      if (!sourceRef.current && audioRef.current) {
        try {
          const source = ctx.createMediaElementSource(audioRef.current);
          source.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
          sourceRef.current = source;
        } catch {
          // Handled if already connected or restricted
        }
      }
    } catch {
      // AudioCtx creation handled
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    initAudioAnalyser();
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

  // Real-time Audio Frequency Visualizer: actively samples audio levels and adjusts bar heights
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      [bar1Ref, bar2Ref, bar3Ref, bar4Ref, bar5Ref].forEach((ref) => {
        if (ref.current) ref.current.style.height = '15%';
      });
      return;
    }

    initAudioAnalyser();

    const dataArray = new Uint8Array(32);

    const updateBars = () => {
      let b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
      let hasData = false;

      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);

        const calcBand = (start: number, end: number) => {
          let sum = 0;
          for (let i = start; i <= end; i++) {
            sum += dataArray[i] || 0;
          }
          return sum / (end - start + 1);
        };

        // Real frequency bands: Bass, Low-Mid, Mid, High-Mid, Treble
        b1 = calcBand(1, 3);
        b2 = calcBand(4, 7);
        b3 = calcBand(8, 13);
        b4 = calcBand(14, 20);
        b5 = calcBand(21, 28);

        if ((b1 + b2 + b3 + b4 + b5) > 0) {
          hasData = true;
        }
      }

      if (hasData) {
        const toHeight = (val: number) => `${Math.max(12, Math.min(100, Math.round((val / 255) * 100)))}%`;
        if (bar1Ref.current) bar1Ref.current.style.height = toHeight(b1);
        if (bar2Ref.current) bar2Ref.current.style.height = toHeight(b2);
        if (bar3Ref.current) bar3Ref.current.style.height = toHeight(b3);
        if (bar4Ref.current) bar4Ref.current.style.height = toHeight(b4);
        if (bar5Ref.current) bar5Ref.current.style.height = toHeight(b5);
      } else {
        // Dynamic rhythmic fallback if analyser stream is suspended or cross-origin
        const t = Date.now() / 150;
        const h1 = 20 + Math.abs(Math.sin(t)) * 40;
        const h2 = 30 + Math.abs(Math.cos(t * 1.3)) * 60;
        const h3 = 45 + Math.abs(Math.sin(t * 0.8)) * 50;
        const h4 = 25 + Math.abs(Math.cos(t * 1.6)) * 55;
        const h5 = 15 + Math.abs(Math.sin(t * 1.2)) * 35;
        if (bar1Ref.current) bar1Ref.current.style.height = `${Math.round(h1)}%`;
        if (bar2Ref.current) bar2Ref.current.style.height = `${Math.round(h2)}%`;
        if (bar3Ref.current) bar3Ref.current.style.height = `${Math.round(h3)}%`;
        if (bar4Ref.current) bar4Ref.current.style.height = `${Math.round(h4)}%`;
        if (bar5Ref.current) bar5Ref.current.style.height = `${Math.round(h5)}%`;
      }

      animFrameRef.current = requestAnimationFrame(updateBars);
    };

    updateBars();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  return (
    <div className="p-3.5 bg-[#0e0e14] border border-[#1f1f2c] rounded-2xl max-w-md w-full shadow-lg space-y-3">
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

      {/* Header: Extension pill badge & Track title */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider uppercase border shrink-0 ${extInfo.color}`}>
            {extInfo.badge}
          </span>
          <span className="text-xs font-bold text-white truncate">
            {name || 'Audio Track'}
          </span>
        </div>

        {/* Real-time Audio Frequency Visualizer */}
        <div className="flex items-end gap-1 h-4 shrink-0 px-1.5 py-0.5 bg-[#14141f] rounded-lg border border-white/5" title={isPlaying ? 'Live Audio Output' : extInfo.label}>
          <span ref={bar1Ref} className="w-1 bg-blue-400 rounded-full transition-all duration-75" style={{ height: '15%' }} />
          <span ref={bar2Ref} className="w-1 bg-sky-400 rounded-full transition-all duration-75" style={{ height: '15%' }} />
          <span ref={bar3Ref} className="w-1 bg-blue-500 rounded-full transition-all duration-75" style={{ height: '15%' }} />
          <span ref={bar4Ref} className="w-1 bg-cyan-400 rounded-full transition-all duration-75" style={{ height: '15%' }} />
          <span ref={bar5Ref} className="w-1 bg-indigo-400 rounded-full transition-all duration-75" style={{ height: '15%' }} />
        </div>
      </div>

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

// Dedicated audio player for WebRTC voice peers
const RemoteAudioPlayer: React.FC<{ stream: MediaStream | undefined; isDeafened: boolean; volume?: number }> = ({ stream, isDeafened, volume = 1 }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = isDeafened;
    el.volume = Math.max(0, Math.min(1, volume));

    const tryPlay = () => {
      el.play().catch(() => {});
    };

    tryPlay();

    const onUserGesture = () => {
      tryPlay();
    };

    window.addEventListener('click', onUserGesture, { once: true });
    window.addEventListener('keydown', onUserGesture, { once: true });

    return () => {
      window.removeEventListener('click', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
    };
  }, [stream, isDeafened, volume]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
};

// Remote Video Player
const RemoteVideoPlayer: React.FC<{ stream: MediaStream | undefined }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover bg-black rounded-3xl"
    />
  );
};

// Local Video Player
const LocalVideoPlayer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-full object-cover bg-black rounded-3xl transform scale-x-[-1]"
    />
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
    setEditColor(currentUser.avatar_color || '#0066ff');
  }, [currentUser.username, currentUser.avatar_color]);

  const saveProfile = () => {
    const updatedUser = { ...currentUser, username: editName, avatar_color: editColor };
    setCurrentUser(updatedUser);
    localStorage.setItem('frosted_chat_username', editName);
    localStorage.setItem('frosted_chat_usercolor', editColor);
    
    updateUser({ username: editName, avatar_color: editColor });
    registerUser(updatedUser);
    
    setIsProfileModalOpen(false);
  };

  // Voice & Video Call States
  const [isInVideo, setIsInVideo] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // Local Reactive Media Streams
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [activeVideoStream, setActiveVideoStream] = useState<MediaStream | null>(null);

  // Media Stream refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [micError, setMicError] = useState<string | null>(null);

  // Connected peers in voice and video channels
  const voiceUsers = useMemo(() => {
    return users.filter(
      (u: any) =>
        (u.current_channel === 'video-general' || u.current_channel === 'voice-general') &&
        u.id !== currentUser.id
    );
  }, [users, currentUser.id]);

  const isMediaActive = activeChannel === 'video-general' || isInVideo;

  const activePeers = useMemo(() => {
    if (!isMediaActive) return [];
    return voiceUsers;
  }, [voiceUsers, isMediaActive]);

  const { remoteStreams, remoteSpeaking } = useWebRTC({
    currentUserId: currentUser.id,
    activeChannel: isMediaActive ? 'video-general' : 'text-general',
    localAudioStream,
    localVideoStream: activeVideoStream,
    peers: activePeers,
    sendRtcSignal,
    setRtcSignalHandler,
    setMediaHandlers,
  });

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

        const speakingThreshold = 14;
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

  // Join Voice Channel
  const joinVoiceChannel = async (withVideo: boolean = false) => {
    setMicError(null);
    setCameraError(null);

    let audioStream: MediaStream | null = null;
    let videoStream: MediaStream | null = null;

    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      micStreamRef.current = audioStream;
      setLocalAudioStream(audioStream);
      setIsMuted(false);
    } catch (err: any) {
      setMicError('Could not access microphone.');
    }

    if (withVideo) {
      setIsCameraStarting(true);
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        cameraStreamRef.current = videoStream;
        setActiveVideoStream(videoStream);
        setIsVideoEnabled(true);
      } catch (err: any) {
        setCameraError('Could not access camera.');
        setIsVideoEnabled(false);
      } finally {
        setIsCameraStarting(false);
      }
    }

    setIsInVideo(true);
    setActiveChannel('video-general');

    updateUser({
      current_channel: 'video-general',
      has_video: !!videoStream,
      is_speaking: false,
      is_muted: false,
      is_deafened: false,
    });
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (isVideoEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      setIsVideoEnabled(false);
      if (!isScreenSharing) {
        setActiveVideoStream(null);
      }
      updateUser({ has_video: false });
    } else {
      setIsCameraStarting(true);
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        cameraStreamRef.current = stream;
        setIsVideoEnabled(true);
        if (!isScreenSharing) {
          setActiveVideoStream(stream);
        }
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
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      setActiveVideoStream(cameraStreamRef.current || null);
      updateUser({ is_screen_sharing: false, has_video: isVideoEnabled });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        setActiveVideoStream(screenStream);
        updateUser({ is_screen_sharing: true, has_video: true });

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setActiveVideoStream(cameraStreamRef.current || null);
          updateUser({ is_screen_sharing: false, has_video: isVideoEnabled });
        };
      } catch {
        // Screen share dismissed
      }
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
    setActiveVideoStream(null);
    setIsInVideo(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setIsUserSpeaking(false);

    updateUser({
      current_channel: 'text-general',
      has_video: false,
      is_speaking: false,
      is_screen_sharing: false,
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
    setIsDeafened(!isDeafened);
  };

  const handleChannelSelect = (channel: 'text-general' | 'video-general') => {
    setActiveChannel(channel);
    updateUser({ current_channel: channel });
    if (channel === 'video-general' && !isInVideo) {
      joinVoiceChannel(false);
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
    <div className="flex h-screen bg-[#08080a] text-zinc-100 font-sans antialiased overflow-hidden select-none">
      
      {/* Hidden Global File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        style={{ display: 'none' }} 
        accept="*"
      />

      {/* Render Remote WebRTC Peer Audio Elements for all active streams */}
      {Object.entries(remoteStreams).map(([peerId, stream]) => (
        <RemoteAudioPlayer
          key={peerId}
          stream={stream}
          isDeafened={isDeafened}
        />
      ))}

      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className="w-64 bg-[#0c0c0f] border-r border-[#1a1a20] flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-6">
          
          {/* Header Branding */}
          <div className="flex items-center justify-between pb-2 border-b border-[#18181f]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-600/30">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-white text-sm tracking-wide">Frosted</h1>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-400' : 'bg-amber-400'}`} />
              </div>
            </div>
          </div>

          {/* CHANNELS SECTION */}
          <div className="space-y-4">
            
            {/* Text Channels */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold text-blue-400/80 tracking-wider uppercase">
                TEXT CHANNELS
              </div>

              <button
                onClick={() => handleChannelSelect('text-general')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                  activeChannel === 'text-general'
                    ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Hash className="w-4 h-4" />
                  <span className="text-xs">general</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/30 font-bold">
                  {messages.length}
                </span>
              </button>
            </div>

            {/* Voice Channels */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold text-blue-400/80 tracking-wider uppercase flex items-center justify-between">
                <span>VOICE CHANNELS</span>
                {isInVideo && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 font-black">
                    Connected
                  </span>
                )}
              </div>

              <button
                onClick={() => handleChannelSelect('video-general')}
                className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                  activeChannel === 'video-general'
                    ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-600/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 font-semibold'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Mic className="w-4 h-4 text-blue-400" />
                  <span className="text-xs">General Voice</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30">
                  {voiceUsers.length + (isInVideo ? 1 : 0)}
                </span>
              </button>
            </div>

          </div>

        </div>

        {/* CURRENT USER FOOTER */}
        <div className="p-3 bg-[#0a0a0d] border-t border-[#1a1a20] flex items-center justify-between">
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer p-1.5 rounded-xl hover:bg-white/5 transition-colors flex-1"
          >
            <div className="relative shrink-0">
              <div 
                className="w-9 h-9 rounded-full text-black font-extrabold flex items-center justify-center text-xs shadow-md"
                style={{ backgroundColor: currentUser.avatar_color || '#0066ff' }}
              >
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#0a0a0d]" />
            </div>

            <div className="min-w-0">
              <div className="font-extrabold text-white text-xs truncate">
                {currentUser.username}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-lg hover:bg-[#17171a] transition-colors cursor-pointer ${
                isMuted ? 'text-red-400 bg-red-500/10' : 'hover:text-white text-zinc-400'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleDeafen}
              className={`p-1.5 rounded-lg hover:bg-[#17171a] transition-colors cursor-pointer ${
                isDeafened ? 'text-amber-400' : 'hover:text-white text-zinc-400'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              <Headphones className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b0e] p-6 rounded-2xl border border-[#1f1f1f] w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Profile</h2>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#121215] border border-[#222226] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Username"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Avatar Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-12 h-12 bg-transparent border-none p-0 cursor-pointer"
                  />
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black text-black"
                    style={{ backgroundColor: editColor }}
                  >
                    {editName.slice(0, 2).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsProfileModalOpen(false)} 
                className="flex-1 py-2.5 rounded-xl bg-[#1c1c1f] text-zinc-300 hover:text-white hover:bg-[#25252a] font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={saveProfile} 
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold text-xs shadow-md shadow-blue-600/30 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col bg-[#050507] min-w-0 relative">
        
        {/* TEXT CHANNEL VIEW */}
        {activeChannel === 'text-general' && (
          <div className="flex-1 flex overflow-hidden">
            
            {/* Center Chat Messages Column */}
            <div className="flex-1 flex flex-col min-w-0 relative">
              
              {/* Top Header */}
              <header className="h-14 px-4 border-b border-[#1a1a20] flex items-center justify-between bg-[#08080a] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Hash className="w-5 h-5 text-white" />
                  <span className="font-extrabold text-white text-base">general</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600/15 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {users.length} online
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search messages"
                      className="bg-[#121215] border border-[#222228] text-xs text-white placeholder-zinc-500 rounded-xl pl-9 pr-3 py-2 w-48 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </header>

              {/* Chat Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Channel Welcome Banner */}
                <div className="space-y-3 pb-6 border-b border-[#1a1a20]">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-blue-600/30">
                    #
                  </div>
                  <h1 className="text-3xl font-black text-white tracking-tight">
                    Welcome to #general!
                  </h1>
                  <p className="text-sm text-zinc-400 font-medium">
                    This is the start of the #general channel.
                  </p>
                </div>

                {/* Messages List */}
                {messages.map((msg: any) => (
                  <div key={msg.id} className="flex items-start gap-3.5 group hover:bg-white/[0.02] -mx-4 px-4 py-1.5 rounded-xl transition-colors">
                    <div 
                      className="w-10 h-10 rounded-full text-black font-extrabold flex items-center justify-center shrink-0 text-xs shadow-sm"
                      style={{ backgroundColor: msg.avatar_color || '#0066ff' }}
                    >
                      {msg.sender_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-extrabold text-white text-sm hover:underline cursor-pointer">
                          {msg.sender_name}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {msg.timestamp}
                        </span>
                      </div>
                      
                      {msg.content && (
                        <p className="text-sm text-zinc-200 leading-relaxed break-words whitespace-pre-wrap mt-0.5">
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
                            <span className="text-xs text-zinc-400">cant show preview for this attachment</span>
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
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                        title="Delete message"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Attachment Preview Before Sending */}
              {pendingFile && (
                <div className="mx-4 mb-2 p-3 bg-[#0e0e13] border border-[#20202c] rounded-2xl relative shadow-lg">
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
                      <div className="flex items-center gap-2.5 p-2.5 bg-[#14141c] rounded-xl border border-white/5">
                        <FileText className="w-6 h-6 text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate max-w-xs">{pendingFile.filename}</p>
                          <p className="text-[11px] text-zinc-400">{(pendingFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                    )}

                    {/* Upload progress & info */}
                    {pendingFile.isUploading && (
                      <div className="flex-1 min-w-0 self-center">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-zinc-300">
                            <span>Uploading...</span>
                            <span>{pendingFile.uploadProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#1c1c28] rounded-full overflow-hidden">
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
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      title="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* GIPHY POPOVER MODAL */}
              {isGiphyOpen && (
                <div className="absolute bottom-20 left-4 right-4 z-50 bg-[#0c0c12]/95 border border-[#222230] rounded-2xl shadow-2xl p-4 max-w-xl mx-auto flex flex-col space-y-3 backdrop-blur-xl">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#1f1f2d]">
                    <span className="text-sm font-bold text-white">GIFs</span>
                    <button 
                      onClick={() => setIsGiphyOpen(false)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search Bar Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input 
                      type="text" 
                      value={giphySearch}
                      onChange={(e) => {
                        setGiphySearch(e.target.value);
                        setActiveCategoryLabel('');
                      }}
                      placeholder="Search GIFs..."
                      className="w-full bg-[#161622] border border-[#2a2a3c] text-xs text-white placeholder-zinc-500 rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
                      autoFocus
                    />
                    {giphySearch && (
                      <button 
                        onClick={() => {
                          setGiphySearch('');
                          setActiveCategoryLabel('🔥 Trending');
                        }}
                        className="absolute right-3 top-2.5 p-1 text-zinc-400 hover:text-white cursor-pointer"
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
                              : 'bg-[#181824] hover:bg-[#222232] text-zinc-300 border-white/5 hover:border-blue-500/30'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Native GIF Grid */}
                  <div className="max-h-80 overflow-y-auto pr-1 bg-[#08080c] p-2 rounded-xl border border-white/5">
                    {isGifsLoading ? (
                      <div className="py-12 flex items-center justify-center text-xs text-zinc-500">
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
                              className="relative aspect-video rounded-xl overflow-hidden bg-[#161622] hover:opacity-90 hover:scale-[1.02] transition-all cursor-pointer group border border-white/5"
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
                      <div className="py-12 text-center text-xs text-zinc-500">
                        No GIFs found
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Message Input Box */}
              <div className="p-4 pt-0">
                <form onSubmit={handleSendMessage} className="bg-[#121215] border border-[#222228] focus-within:border-blue-500 rounded-2xl px-4 py-3 flex items-center gap-3 transition-colors shadow-lg">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Message #general..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                  />

                  {/* File Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                    title="Upload File or Media"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>

                  {/* GIF Button */}
                  <button
                    type="button"
                    onClick={() => setIsGiphyOpen(!isGiphyOpen)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      isGiphyOpen 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                    title="GIFs"
                  >
                    GIF
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!inputText.trim() && !pendingFile}
                    className={`px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      (inputText.trim() || pendingFile)
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                        : 'bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4 fill-current" />
                  </button>
                </form>
              </div>

            </div>

            {/* Right Sidebar: Member List */}
            <aside className="w-64 bg-[#08080a] border-l border-[#1a1a20] p-4 flex flex-col space-y-6 shrink-0">
              
              {/* ONLINE MEMBERS LIST */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-500 tracking-wider">
                  <span>ONLINE — {users.length}</span>
                </div>

                <div className="space-y-2">
                  {users.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <div className="relative shrink-0">
                        <div 
                          className="w-8 h-8 rounded-full text-black font-extrabold flex items-center justify-center text-xs"
                          style={{ backgroundColor: u.avatar_color || '#0066ff' }}
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
                          {u.id === currentUser.id && (
                            <span className="text-[10px] text-zinc-500 font-medium">
                              (you)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </aside>

          </div>
        )}

        {/* VOICE & CALL ROOM VIEW */}
        {activeChannel === 'video-general' && (
          <div className="flex-1 flex overflow-hidden">
            
            {/* Main Stage Area */}
            <div className="flex-1 flex flex-col bg-[#050507] relative overflow-hidden">
              
              {/* Top Header */}
              <div className="px-6 py-3.5 border-b border-[#1a1a20] bg-[#08080a] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base">General Voice</span>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium">
                      {voiceUsers.length + (isInVideo ? 1 : 0)} connected
                    </span>
                  </div>
                </div>

                <button
                  onClick={toggleScreenShare}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                    isScreenSharing ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-200'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
                </button>
              </div>

              {/* Voice / Video Stage Grid */}
              <div className="flex-1 p-6 pb-28 flex items-center justify-center overflow-y-auto">
                
                {isInVideo ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                    
                    {/* Local User Tile */}
                    <div className={`relative rounded-3xl overflow-hidden bg-[#121215] border transition-all duration-300 aspect-video flex flex-col items-center justify-center shadow-2xl ${
                      isUserSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-white/10'
                    }`}>
                      {isVideoEnabled && activeVideoStream ? (
                        <LocalVideoPlayer stream={activeVideoStream} />
                      ) : (
                        <div className="relative flex items-center justify-center">
                          <div 
                            className={`w-28 h-28 rounded-full flex items-center justify-center text-3xl font-black text-black shadow-2xl transition-all ${
                              isUserSpeaking ? 'ring-4 ring-amber-500 shadow-[0_0_30px_#f59e0b]' : 'ring-2 ring-white/10'
                            }`}
                            style={{ backgroundColor: currentUser.avatar_color || '#0066ff' }}
                          >
                            {currentUser.username.slice(0, 2).toUpperCase()}
                          </div>
                        </div>
                      )}

                      {/* Bottom-Left Overlay */}
                      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between">
                        <div className="text-sm font-extrabold text-white">
                          {currentUser.username} (You)
                        </div>

                        {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>

                    {/* Remote Peers Tiles */}
                    {voiceUsers.map((u: any) => {
                      const stream = remoteStreams[u.id];
                      const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                      const hasPeerVideo = stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

                      return (
                        <div key={u.id} className={`relative rounded-3xl overflow-hidden bg-[#121215] border transition-all duration-300 aspect-video flex flex-col items-center justify-center shadow-2xl ${
                          isPeerSpeaking ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.3)]' : 'border-white/10'
                        }`}>
                          {hasPeerVideo ? (
                            <RemoteVideoPlayer stream={stream} />
                          ) : (
                            <div className="relative flex items-center justify-center">
                              <div 
                                className={`w-28 h-28 rounded-full flex items-center justify-center text-3xl font-black text-black shadow-2xl transition-all ${
                                  isPeerSpeaking ? 'ring-4 ring-amber-500 shadow-[0_0_30px_#f59e0b]' : 'ring-2 ring-white/10'
                                }`}
                                style={{ backgroundColor: u.avatar_color || '#0066ff' }}
                              >
                                {u.username.slice(0, 2).toUpperCase()}
                              </div>
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between">
                            <div className="text-sm font-extrabold text-white">
                              {u.username}
                            </div>

                            {u.is_muted && <MicOff className="w-4 h-4 text-zinc-400" />}
                          </div>
                        </div>
                      );
                    })}

                  </div>
                ) : (
                  /* Join Prompt Card when not connected */
                  <div className="text-center space-y-4 max-w-sm">
                    <div className="w-20 h-20 rounded-3xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-xl shadow-blue-600/20">
                      <Mic className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-white">General Voice</h2>
                    <p className="text-xs text-zinc-400">Join to talk with voice, turn your camera on/off, or share screen in real-time.</p>
                    <button 
                      onClick={() => joinVoiceChannel(false)}
                      className="px-8 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      Connect to Voice
                    </button>
                  </div>
                )}

              </div>

              {/* Floating Bottom In-Call Control Bar */}
              {isInVideo && (
                <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-4 z-30">
                  
                  {/* Mic Button */}
                  <button 
                    onClick={toggleMute}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                      isMuted ? 'bg-red-600 text-white shadow-red-600/30' : 'bg-blue-600 text-white shadow-blue-600/30'
                    }`}
                    title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>

                  {/* Camera Toggle Button */}
                  <button 
                    onClick={() => toggleCamera()}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500"
                    title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </button>

                  {/* Screen Share Button */}
                  <button 
                    onClick={toggleScreenShare}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer bg-blue-600 text-white shadow-blue-600/30 hover:bg-blue-500"
                    title="Share Screen"
                  >
                    <Monitor className="w-6 h-6" />
                  </button>

                  {/* Disconnect Button */}
                  <button 
                    onClick={stopVoiceChannel}
                    className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all cursor-pointer"
                    title="Disconnect"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>

                </div>
              )}

            </div>

            {/* Right Sidebar in Voice Channel */}
            <aside className="w-64 bg-[#08080a] border-l border-[#1a1a20] p-4 flex flex-col space-y-6 shrink-0">
              
              {/* VOICE USERS LIST */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 tracking-wider uppercase">
                  <Mic className="w-4 h-4" />
                  <span>VOICE — {voiceUsers.length + (isInVideo ? 1 : 0)}</span>
                </div>

                <div className="space-y-2">
                  {isInVideo && (
                    <div className="p-2.5 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div 
                            className="w-8 h-8 rounded-full text-black font-extrabold flex items-center justify-center text-xs"
                            style={{ backgroundColor: currentUser.avatar_color || '#0066ff' }}
                          >
                            {currentUser.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#08080a]" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="font-extrabold text-white text-xs truncate">{currentUser.username}</span>
                            <span className="text-[10px] text-zinc-500">(you)</span>
                          </div>
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  )}

                  {voiceUsers.map((u: any) => (
                    <div key={u.id} className="p-2.5 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div 
                            className="w-8 h-8 rounded-full text-black font-extrabold flex items-center justify-center text-xs"
                            style={{ backgroundColor: u.avatar_color || '#0066ff' }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#08080a]" />
                        </div>
                        <div className="min-w-0 leading-tight">
                          <span className="font-extrabold text-white text-xs truncate block">{u.username}</span>
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* ONLINE MEMBERS */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-500 tracking-wider">
                  <span>ONLINE — {users.length - (voiceUsers.length + (isInVideo ? 1 : 0))}</span>
                </div>
              </div>

            </aside>

          </div>
        )}

      </main>

      {/* INCOMING CALL MODAL */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#0e0e13] p-7 rounded-3xl border border-[#262630] w-full max-w-sm flex flex-col items-center text-center space-y-5 shadow-2xl">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue-600 text-black font-black text-2xl flex items-center justify-center ring-4 ring-blue-500/40 animate-pulse shadow-lg shadow-blue-600/30">
                {(incomingCall.fromUserName || 'P').slice(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-blue-500 text-white shadow-md">
                <Mic className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white">
                {incomingCall.fromUserName || 'Friend'}
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call...
              </p>
            </div>

            <div className="flex gap-4 w-full pt-2">
              <button
                onClick={() => dismissIncomingCall && dismissIncomingCall()}
                className="flex-1 py-3 rounded-2xl bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 font-extrabold text-xs transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#0e0e13] p-7 rounded-3xl border border-[#262630] w-full max-w-sm flex flex-col items-center text-center space-y-5 shadow-2xl">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue-600 text-black font-black text-2xl flex items-center justify-center ring-4 ring-blue-500/40 animate-pulse shadow-lg shadow-blue-600/30">
                {(outgoingCall.targetUserName || 'P').slice(0, 2).toUpperCase()}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white">
                Calling {outgoingCall.targetUserName}...
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
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

    </div>
  );
};
