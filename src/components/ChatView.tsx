import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Hash, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Headphones, 
  PhoneOff, 
  Send, 
  Smile, 
  PlusCircle, 
  Search, 
  Monitor, 
  RotateCw, 
  AlertCircle, 
  X, 
  PhoneCall, 
  Users, 
  Gamepad2, 
  MessageSquare, 
  LogOut, 
  Trash2, 
  ChevronDown, 
  User as UserIcon,
  Volume2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Download,
  Loader2,
  Play,
  CheckCircle2
} from 'lucide-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { useWebRTC } from '../services/useWebRTC';

interface ChatViewProps {
  globalChat: any;
}

// Official Giphy SDK Client with verified active API Key
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

// Dedicated audio player for WebRTC voice peers
const RemoteAudioPlayer: React.FC<{ stream: MediaStream | undefined; isDeafened: boolean; volume?: number }> = ({ stream, isDeafened, volume = 1 }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
      }
      audioRef.current.muted = isDeafened;
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
      audioRef.current.play().catch((err) => {
        console.warn('Autoplay handled on voice stream:', err);
      });
    }
  }, [stream, isDeafened, volume]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
};

// Stable Remote Video Player
const RemoteVideoPlayer: React.FC<{ stream: MediaStream | undefined }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.warn('Remote video playback notice:', err);
      });
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};

// Stable Local Video Player
const LocalVideoPlayer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch((err) => {
        console.warn('Local video preview notice:', err);
      });
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-full object-cover -scale-x-100"
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
    callUser,
    sendRtcSignal,
    setRtcSignalHandler,
    setUserCallHandler,
    setMediaHandlers,
    incomingCall,
    outgoingCall,
    initiateCall,
    dismissIncomingCall,
    dismissOutgoingCall,
    isConnected,
  } = globalChat;

  const [activeChannel, setActiveChannel] = useState<'text-general' | 'video-general'>('text-general');
  const [inputText, setInputText] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // REAL Attachment Uploading States with Upload Progress
  const [pendingFile, setPendingFile] = useState<{
    fileObj: File;
    filename: string;
    mimeType: string;
    size: number;
    previewUrl?: string;
    type: 'image' | 'video' | 'audio' | 'file';
    uploadProgress: number; // 0 to 100%
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

  // Real connected peers in channels
  const videoUsers = users.filter((u: any) => u.current_channel === 'video-general' && u.id !== currentUser.id);

  // WebRTC Mesh Manager
  const activePeers = (activeChannel === 'video-general' || isInVideo) ? videoUsers : [];

  const { remoteStreams, remoteSpeaking } = useWebRTC({
    currentUserId: currentUser.id,
    activeChannel: (activeChannel === 'video-general' || isInVideo) ? 'video-general' : 'text-general',
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

  // Direct GiphyFetch SDK Function for Official @giphy/react-components Grid
  const fetchGifsForGrid = useCallback(
    (offset: number) => {
      const query = giphySearch.trim();
      if (query) {
        return gf.search(query, { offset, limit: 12 });
      }
      return gf.trending({ offset, limit: 12 });
    },
    [giphySearch]
  );

  const handleCategorySelect = (category: { label: string; query: string }) => {
    setActiveCategoryLabel(category.label);
    setGiphySearch(category.query);
  };

  // Voice Detection Logic
  useEffect(() => {
    if (!localAudioStream || isMuted) {
      if (!isMicTesting) {
        setIsUserSpeaking(false);
        setAudioLevel(0);
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

      let speakingTimeout: any = null;

      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(1, average / 45);

        setAudioLevel(normalized);

        const isSpeakingNow = normalized > 0.12;

        if (isSpeakingNow) {
          if (speakingTimeout) clearTimeout(speakingTimeout);
          setIsUserSpeaking(true);
          updateUserRef.current({ is_speaking: true });
        } else {
          if (!speakingTimeout) {
            speakingTimeout = setTimeout(() => {
              setIsUserSpeaking(false);
              updateUserRef.current({ is_speaking: false });
            }, 350);
          }
        }

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (speakingTimeout) clearTimeout(speakingTimeout);
      };
    } catch (err) {
      console.warn('Audio level analyser error:', err);
    }
  }, [localAudioStream, isMuted, isMicTesting]);

  // Voice Channel Join Function
  const joinVoiceChannel = async (withVideo: boolean = false) => {
    setMicError(null);
    setCameraError(null);

    try {
      if (!micStreamRef.current) {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        micStreamRef.current = audioStream;
        setLocalAudioStream(audioStream);
      }

      if (withVideo && !cameraStreamRef.current) {
        try {
          setIsCameraStarting(true);
          const vidStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          cameraStreamRef.current = vidStream;
          setActiveVideoStream(vidStream);
          setIsVideoEnabled(true);
        } catch (vErr: any) {
          console.warn('Camera request error:', vErr);
          setCameraError('Camera unavailable or permission denied.');
          setIsVideoEnabled(false);
        } finally {
          setIsCameraStarting(false);
        }
      }

      setIsInVideo(true);
      setActiveChannel('video-general');
      updateUser({
        current_channel: 'video-general',
        is_muted: false,
        is_video: withVideo && !!cameraStreamRef.current,
      });

    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      setMicError('Microphone permission denied or device error.');
    }
  };

  // Disconnect from Voice
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
    setIsMuted(false);
    setIsDeafened(false);

    updateUser({
      current_channel: activeChannel === 'video-general' ? 'text-general' : activeChannel,
      is_muted: false,
      is_video: false,
      is_speaking: false,
    });

    if (activeChannel === 'video-general') {
      setActiveChannel('text-general');
    }
  };

  // Toggle Camera inside Call
  const toggleCamera = async () => {
    if (isVideoEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setActiveVideoStream(null);
      setIsVideoEnabled(false);
      updateUser({ is_video: false });
    } else {
      try {
        setIsCameraStarting(true);
        const vidStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        cameraStreamRef.current = vidStream;
        setActiveVideoStream(vidStream);
        setIsVideoEnabled(true);
        updateUser({ is_video: true });
      } catch (err: any) {
        console.error('Camera toggle error:', err);
        setCameraError('Camera error or permission denied');
      } finally {
        setIsCameraStarting(false);
      }
    }
  };

  // Screen Share Toggle
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      if (isVideoEnabled && cameraStreamRef.current) {
        setActiveVideoStream(cameraStreamRef.current);
      } else {
        setActiveVideoStream(null);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        setActiveVideoStream(screenStream);
        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (isVideoEnabled && cameraStreamRef.current) {
            setActiveVideoStream(cameraStreamRef.current);
          } else {
            setActiveVideoStream(null);
          }
        };
      } catch (err) {
        console.warn('Screen share cancelled:', err);
      }
    }
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

  // REAL FILE UPLOAD WITH PROGRESS BAR BEFORE SENDING
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let attachmentType: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/')) attachmentType = 'image';
    else if (file.type.startsWith('video/')) attachmentType = 'video';
    else if (file.type.startsWith('audio/')) attachmentType = 'audio';

    const localPreview = attachmentType === 'image' ? URL.createObjectURL(file) : undefined;

    // Read file as base64 then upload via XHR with REAL progress tracking
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
        uploadProgress: 0,
        isUploading: true,
        uploadedUrl: null,
        error: null,
        xhrRef: xhr,
      });

      // Track REAL HTTP upload progress
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
            error: 'Server upload error',
            uploadedUrl: base64Data,
          } : null);
        }
      };

      xhr.onerror = () => {
        setPendingFile((prev) => prev ? {
          ...prev,
          isUploading: false,
          error: 'Network upload error',
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
      } catch (err) {
        console.warn('XHR abort notice:', err);
      }
    }
    setPendingFile(null);
  };

  // Submit Message immediately with uploaded file URL
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !pendingFile) return;
    if (pendingFile && pendingFile.isUploading) return; // Wait for upload completion

    let finalAttachment: { url: string; type: 'image' | 'video' | 'audio' | 'file' | 'gif'; name?: string } | undefined = undefined;

    if (pendingFile && pendingFile.uploadedUrl) {
      finalAttachment = {
        url: pendingFile.uploadedUrl,
        type: pendingFile.type,
        name: pendingFile.filename,
      };
    }

    insertMessage(inputText, activeChannel, finalAttachment);
    setInputText('');
    setPendingFile(null);
  };

  // Select Giphy GIF from Official SDK Grid
  const selectGiphyGif = (gif: any) => {
    const gifUrl = gif.images?.original?.url || gif.images?.downsized_medium?.url || gif.images?.fixed_height?.url;
    if (!gifUrl) return;
    
    insertMessage('', activeChannel, {
      url: gifUrl,
      type: 'gif',
      name: gif.title || 'GIPHY GIF',
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

      {/* Render Remote WebRTC Peer Audio Elements */}
      {videoUsers.map((u: any) => (
        <RemoteAudioPlayer
          key={u.id}
          stream={remoteStreams[u.id]}
          isDeafened={isDeafened}
        />
      ))}

      {/* LEFT NAVIGATION SIDEBAR */}
      <aside className="w-64 bg-[#0c0c0f] border-r border-[#1a1a20] flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-6">
          
          {/* App Header Branding */}
          <div className="flex items-center justify-between pb-2 border-b border-[#18181f]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-600/30">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-black text-white text-sm tracking-wide">FROSTED MESH</h1>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-blue-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span>{isConnected ? 'ONLINE SERVER' : 'RECONNECTING'}</span>
                </div>
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
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 font-black animate-pulse">
                    CONNECTED
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
                  {videoUsers.length + (isInVideo ? 1 : 0)}
                </span>
              </button>
            </div>

          </div>

        </div>

        {/* CURRENT USER FOOTER CARD */}
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
              <div className="text-[10px] text-blue-400 font-semibold truncate">
                Click to Edit Profile
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
              <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#121215] border border-[#222226] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Username"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Avatar Color</label>
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
                Save Changes
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
                  <span className="text-xs text-zinc-500 font-medium">main room</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600/15 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {users.length} Online
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
                  <button className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30 cursor-pointer hover:bg-blue-500 transition-colors">
                    <Users className="w-4 h-4" />
                  </button>
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
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {msg.timestamp}
                        </span>
                      </div>
                      
                      {msg.content && (
                        <p className="text-sm text-zinc-200 leading-relaxed break-words whitespace-pre-wrap mt-0.5">
                          {msg.content}
                        </p>
                      )}

                      {/* Attachment Rendering */}
                      {msg.attachment_url && (
                        <div className="mt-2">
                          {msg.attachment_type === 'image' && (
                            <div className="relative inline-block max-w-sm rounded-2xl overflow-hidden border border-white/10 shadow-lg group/img">
                              <img 
                                src={msg.attachment_url} 
                                alt="Attachment" 
                                className="max-h-80 w-auto object-cover rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.attachment_url, '_blank')}
                              />
                            </div>
                          )}

                          {msg.attachment_type === 'video' && (
                            <div className="relative inline-block max-w-md rounded-2xl overflow-hidden border border-white/10 shadow-lg bg-black">
                              <video 
                                src={msg.attachment_url} 
                                controls 
                                className="max-h-80 w-full rounded-2xl"
                              />
                            </div>
                          )}

                          {msg.attachment_type === 'audio' && (
                            <div className="p-2 bg-[#121216] border border-[#22222a] rounded-xl max-w-sm">
                              <audio src={msg.attachment_url} controls className="w-full" />
                            </div>
                          )}

                          {msg.attachment_type === 'gif' && (
                            <div className="relative inline-block rounded-2xl overflow-hidden border border-blue-500/30 shadow-xl bg-black/40 group/gif">
                              <img 
                                src={msg.attachment_url} 
                                alt="GIF" 
                                className="max-h-72 w-auto object-cover rounded-2xl hover:scale-[1.01] transition-transform"
                              />
                              <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-[10px] font-black text-blue-400 tracking-wider flex items-center gap-1.5 border border-blue-500/30 shadow-md">
                                <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
                                <span>GIPHY</span>
                              </div>
                            </div>
                          )}

                          {msg.attachment_type === 'file' && (
                            <a 
                              href={msg.attachment_url} 
                              download={msg.attachment_name || 'file'}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-3 p-3 bg-[#121216] border border-[#22222a] hover:border-blue-500/50 rounded-xl max-w-xs transition-colors group/file"
                            >
                              <div className="w-10 h-10 rounded-lg bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover/file:bg-blue-600 group-hover/file:text-white transition-colors">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate">{msg.attachment_name || 'Download File'}</div>
                                <div className="text-[10px] text-blue-400 font-semibold flex items-center gap-1 mt-0.5">
                                  <Download className="w-3 h-3" />
                                  Click to download
                                </div>
                              </div>
                            </a>
                          )}
                        </div>
                      )}

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

              {/* REAL ATTACHMENT UPLOADING PROGRESS BAR CARD */}
              {pendingFile && (
                <div className="px-4 py-3 bg-[#0d0d12] border-t border-[#1a1a24] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {pendingFile.previewUrl ? (
                        <img src={pendingFile.previewUrl} alt="Preview" className="w-11 h-11 rounded-xl object-cover border border-white/10 shadow-md shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-extrabold text-white truncate">{pendingFile.filename}</div>
                        <div className="text-[10px] text-zinc-400 font-semibold mt-0.5 flex items-center gap-2">
                          <span>{(pendingFile.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          {pendingFile.isUploading ? (
                            <span className="text-blue-400 font-bold flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Uploading to server... {pendingFile.uploadProgress}%
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Uploaded to server • Ready to send
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={cancelPendingFile}
                      className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Cancel attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* REAL Upload Progress Bar */}
                  <div className="h-1.5 w-full bg-[#181822] rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-200 ease-out rounded-full"
                      style={{ width: `${pendingFile.uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* OFFICIAL GIPHY SDK POPOVER MODAL */}
              {isGiphyOpen && (
                <div className="absolute bottom-20 left-4 right-4 z-50 bg-[#0c0c12]/95 border border-[#222230] rounded-2xl shadow-2xl p-4 max-w-xl mx-auto flex flex-col space-y-3 backdrop-blur-xl">
                  
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#1f1f2d]">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-xs tracking-wider shadow-md shadow-blue-600/30 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 fill-current" />
                        GIPHY SDK
                      </span>
                      <span className="text-xs font-extrabold text-white">Official Giphy Library</span>
                    </div>
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
                      placeholder="Search every GIF on GIPHY..."
                      className="w-full bg-[#161622] border border-[#2a2a3c] text-xs text-white placeholder-zinc-500 rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
                      autoFocus
                    />
                    {giphySearch && (
                      <button 
                        onClick={() => {
                          setGiphySearch('');
                          setActiveCategoryLabel('🔥 Trending');
                        }}
                        className="absolute right-3 top-2.5 p-1 text-zinc-400 hover:text-white"
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

                  {/* OFFICIAL GIPHY SDK GRID COMPONENT */}
                  <div className="max-h-80 overflow-y-auto pr-1 flex justify-center bg-[#08080c] p-2 rounded-xl border border-white/5">
                    <Grid
                      key={giphySearch}
                      width={480}
                      columns={3}
                      gutter={6}
                      fetchGifs={fetchGifsForGrid}
                      onGifClick={(gif, e) => {
                        e.preventDefault();
                        selectGiphyGif(gif);
                      }}
                      noLink
                    />
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

                  {/* File Attachment Button (Supports ANY file on system) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                    title="Upload Any File or Media"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>

                  {/* Original GIF Text Button */}
                  <button
                    type="button"
                    onClick={() => setIsGiphyOpen(!isGiphyOpen)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                      isGiphyOpen 
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30 ring-2 ring-blue-500/40' 
                        : 'bg-[#181820] hover:bg-[#222230] text-blue-400 border-blue-500/30 hover:border-blue-500/60'
                    }`}
                    title="Open GIPHY GIF Library"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>GIF</span>
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !pendingFile) || (pendingFile?.isUploading ?? false)}
                    className={`px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      (inputText.trim() || (pendingFile && !pendingFile.isUploading))
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
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500 tracking-wider">
                  <span>ONLINE — {users.length}</span>
                  <Trash2 className="w-3.5 h-3.5 cursor-pointer hover:text-white transition-colors" />
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
                          <span className="text-[10px] text-blue-400 font-mono font-bold">#6761</span>
                          {u.id === currentUser.id && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[9px] font-black">
                              YOU
                            </span>
                          )}
                        </div>

                        <div className="mt-1">
                          <span className="px-2 py-0.5 rounded-md bg-blue-600/15 text-blue-400 border border-blue-500/25 text-[10px] font-bold inline-flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            In #general
                          </span>
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
                      <span className="font-extrabold text-white text-base">General Voice #general</span>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium">
                      {videoUsers.length + (isInVideo ? 1 : 0)} connected
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

                      {/* Top-Left Speaking Status Tag */}
                      {isUserSpeaking && (
                        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-[10px] tracking-wider uppercase flex items-center gap-1.5 shadow-md">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          SPEAKING
                        </div>
                      )}

                      {/* Bottom-Left Overlay */}
                      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-extrabold text-white">
                            {currentUser.username} (You)
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 text-[10px] font-bold inline-flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            In #general
                          </span>
                        </div>

                        {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>

                    {/* Remote Peers Tiles */}
                    {videoUsers.map((u: any) => {
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

                          {isPeerSpeaking && (
                            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-[10px] tracking-wider uppercase flex items-center gap-1.5 shadow-md">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                              SPEAKING
                            </div>
                          )}

                          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between">
                            <div className="space-y-1">
                              <div className="text-sm font-extrabold text-white">
                                {u.username}
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 text-[10px] font-bold inline-flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                In #general
                              </span>
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
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                      isVideoEnabled ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-blue-600 text-white shadow-blue-600/30'
                    }`}
                    title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                  </button>

                  {/* Screen Share Button */}
                  <button 
                    onClick={toggleScreenShare}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                      isScreenSharing ? 'bg-blue-600 text-white shadow-blue-600/30' : 'bg-blue-600 text-white shadow-blue-600/30'
                    }`}
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
              
              {/* IN VOICE & CALLS LIST */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 tracking-wider uppercase">
                  <Mic className="w-4 h-4" />
                  <span>IN VOICE & CALLS — {videoUsers.length + (isInVideo ? 1 : 0)}</span>
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
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[9px] font-black">YOU</span>
                          </div>
                          <div className="text-[10px] text-blue-400 font-bold">General Voice</div>
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  )}

                  {videoUsers.map((u: any) => (
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
                          <div className="text-[10px] text-blue-400 font-bold">General Voice</div>
                        </div>
                      </div>
                      <Mic className="w-4 h-4 text-blue-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              {/* ONLINE — OTHER MEMBERS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500 tracking-wider">
                  <span>ONLINE — {users.length - (videoUsers.length + (isInVideo ? 1 : 0))}</span>
                  <Trash2 className="w-3.5 h-3.5 cursor-pointer hover:text-white transition-colors" />
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
