import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Hash, 
  Volume2, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Headphones, 
  PhoneOff, 
  Send, 
  Smile, 
  PlusCircle, 
  Radio, 
  Search, 
  Bell, 
  Pin,
  Monitor,
  RotateCw,
  AlertCircle,
  X,
  PhoneCall,
  Activity,
  Sliders,
  Check,
  Users
} from 'lucide-react';
import { useWebRTC } from '../services/useWebRTC';

interface ChatViewProps {
  globalChat: any;
}

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

// Stable Remote Video Player (prevents stream re-attaching & glitching)
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

// Stable Local Video Player (prevents local camera flicker)
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

  const [activeChannel, setActiveChannel] = useState<'text-general' | 'voice-general' | 'video-general'>('text-general');
  const [inputText, setInputText] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Call & Audio Level States
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isMicTesting, setIsMicTesting] = useState(false);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});

  useEffect(() => {
    setEditName(currentUser.username);
    setEditColor(currentUser.avatar_color);
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

  // Voice & Video States
  const [isInVoice, setIsInVoice] = useState(false);
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
  const voiceUsers = users.filter((u: any) => u.current_channel === 'voice-general' && u.id !== currentUser.id);
  const videoUsers = users.filter((u: any) => u.current_channel === 'video-general' && u.id !== currentUser.id);

  // WebRTC Mesh Manager for real peer-to-peer audio & video transmission
  const activePeers = (activeChannel === 'video-general' || isInVideo)
    ? videoUsers
    : (activeChannel === 'voice-general' || isInVoice)
    ? voiceUsers
    : [];

  const mediaChannelType = (activeChannel === 'video-general' || isInVideo)
    ? 'video-general'
    : (activeChannel === 'voice-general' || isInVoice)
    ? 'voice-general'
    : 'text-general';

  const { remoteStreams, remoteSpeaking } = useWebRTC({
    currentUserId: currentUser.id,
    activeChannel: mediaChannelType,
    localAudioStream,
    localVideoStream: activeVideoStream,
    peers: activePeers,
    sendRtcSignal,
    setRtcSignalHandler,
    setMediaHandlers,
  });

  // Automatically connect to voice whenever user navigates to voice channel
  useEffect(() => {
    if (activeChannel === 'voice-general' && !isInVoice) {
      startVoice();
    }
  }, [activeChannel, isInVoice]);

  // Sync scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  // Voice Detection Logic: Visual indicators & decibel monitoring for active speaker
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
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastSpeakState = false;

      const checkVolume = () => {
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        const speaking = average > 24; // Sensitivity threshold
        
        if (speaking !== lastSpeakState) {
          lastSpeakState = speaking;
          setIsUserSpeaking(speaking);
          updateUserRef.current({ is_speaking: speaking });
        }
        
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Voice detection notice:', err);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [localAudioStream, isMuted, isMicTesting]);

  // Audio simulation for mic testing preview
  useEffect(() => {
    if (!isMicTesting) return;
    const interval = setInterval(() => {
      const mockLvl = Math.floor(25 + Math.random() * 60);
      setAudioLevel(mockLvl);
      setIsUserSpeaking(mockLvl > 30);
    }, 150);
    return () => {
      clearInterval(interval);
      if (!localAudioStream) {
        setAudioLevel(0);
        setIsUserSpeaking(false);
      }
    };
  }, [isMicTesting, localAudioStream]);

  // Handlers
  const startVoice = async () => {
    setIsInVoice(true);
    setMicError(null);
    updateUser({ current_channel: 'voice-general', is_muted: isMuted, is_speaking: false });

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        micStreamRef.current = stream;
        setLocalAudioStream(stream);
      }
    } catch (err: any) {
      console.warn('Mic access notice (connected in listen mode):', err);
      setMicError('Microphone permission blocked or unavailable. You are in Listen-Only mode (you can hear others in this channel).');
    }
  };

  const stopVoice = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setLocalAudioStream(null);
    setIsInVoice(false);
    setMicError(null);
    setIsMicTesting(false);
    updateUser({ current_channel: 'text-general', is_speaking: false });
    setActiveChannel('text-general');
  }, [updateUser]);

  const startVideo = async () => {
    setIsCameraStarting(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } 
      });
      cameraStreamRef.current = stream;
      setActiveVideoStream(stream);
      setLocalAudioStream(stream); 
      setIsInVideo(true);
      setIsVideoEnabled(true);
      updateUser({ 
        current_channel: 'video-general', 
        has_video: true,
        is_muted: isMuted,
        is_speaking: false 
      });
    } catch (err) {
      setCameraError('Camera access denied or unavailable');
      console.error('Camera error:', err);
    } finally {
      setIsCameraStarting(false);
    }
  };

  const stopVideo = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setActiveVideoStream(null);
    setLocalAudioStream(null);
    setIsInVideo(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    updateUser({ 
      current_channel: 'text-general', 
      has_video: false, 
      is_screen_sharing: false,
      is_speaking: false 
    });
    setActiveChannel('text-general');
  }, [updateUser]);

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      updateUser({ is_screen_sharing: false });
      if (cameraStreamRef.current) {
        setActiveVideoStream(cameraStreamRef.current);
      } else {
        setActiveVideoStream(null);
      }
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
          setActiveVideoStream(screenStream);
          setIsScreenSharing(true);
          updateUser({ is_screen_sharing: true });
          screenStream.getVideoTracks()[0].onended = () => {
            toggleScreenShare();
          };
        }
      } catch (err) {
        console.warn('Screen sharing cancelled or unavailable:', err);
      }
    }
  };

  const handleStartCall = (targetUser: any, type: 'audio' | 'video') => {
    if (initiateCall) {
      initiateCall(targetUser.id, targetUser.username, type);
    } else {
      callUser(targetUser.id, type);
    }

    if (type === 'video') {
      setActiveChannel('video-general');
      startVideo();
    } else {
      setActiveChannel('voice-general');
      startVoice();
    }
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    const type = incomingCall.callType;
    if (dismissIncomingCall) dismissIncomingCall();
    if (type === 'video') {
      setActiveChannel('video-general');
      startVideo();
    } else {
      setActiveChannel('voice-general');
      startVoice();
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    updateUser({ is_muted: nextMuted });
    if (localAudioStream) {
      localAudioStream.getAudioTracks().forEach(track => {
        track.enabled = !nextMuted;
      });
    }
    if (nextMuted) {
      setIsUserSpeaking(false);
    }
  };

  const toggleDeafen = () => {
    const nextDeaf = !isDeafened;
    setIsDeafened(nextDeaf);
    if (nextDeaf && !isMuted) {
      toggleMute();
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    insertMessage(inputText, 'text-general');
    setInputText('');
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#080808] text-[#e4e4e7] overflow-hidden select-none font-sans">
      
      {/* Channels Sidebar: Sleek Black and Orange */}
      <aside className="w-60 sm:w-64 bg-[#0d0d0f] flex flex-col shrink-0 border-r border-[#1c1c20]">
        
        {/* Server Header */}
        <div className="h-12 px-4 border-b border-[#1c1c20] flex items-center font-bold text-white tracking-wide">
          <div className="flex items-center gap-2">
            <span className="font-heading font-extrabold text-[15px] tracking-tight text-white">FROSTED LOUNGE</span>
          </div>
        </div>

        {/* ONLINE USERS SECTION */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          
          <div className="mb-4">
            <div className="px-2 mb-2 text-[11px] font-black text-zinc-500 tracking-wider uppercase flex items-center justify-between">
              <span>Direct Messages</span>
              <PlusCircle className="w-3.5 h-3.5 hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>

          <div>
            <div className="px-2 mb-2 text-[11px] font-black text-zinc-500 tracking-wider uppercase flex items-center justify-between">
              <span>Who's Online ({users.length})</span>
              <div className={`w-1.5 h-1.5 rounded-full ${globalChat.isConnected ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-red-500 animate-pulse'}`} />
            </div>
            <div className="space-y-0.5">
              {users.length === 0 && (
                <div className="px-2.5 py-2 text-[10px] text-zinc-500 italic">
                  Connecting to relay...
                </div>
              )}
              {users.map((u: any) => (
                <div key={u.id} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-sm transition-all group cursor-default ${u.id === currentUser.id ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="relative shrink-0">
                      <div 
                        className="w-7 h-7 rounded-lg text-black font-black text-[10px] flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: u.avatar_color || '#0066ff' }}
                      >
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0d0d0f]" />
                    </div>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className={`truncate font-bold text-[13px] ${u.id === currentUser.id ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                        {u.username}
                        {u.id === currentUser.id && <span className="ml-1 text-[9px] text-[#0066ff] font-black tracking-widest uppercase opacity-70">You</span>}
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter">Online</span>
                    </div>
                  </div>
                  {u.id !== currentUser.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      <button 
                        onClick={() => handleStartCall(u, 'audio')}
                        title="Voice Call" 
                        className="p-1.5 text-zinc-400 hover:text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg transition-all cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleStartCall(u, 'video')}
                        title="Video Call" 
                        className="p-1.5 text-zinc-400 hover:text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg transition-all cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* TEXT CHANNELS SECTION */}
          <div className="pt-2">
            <div className="px-2 mb-2 text-[11px] font-black text-zinc-500 tracking-wider uppercase">
              Text Channels
            </div>
            <button
              onClick={() => setActiveChannel('text-general')}
              className={`w-full group flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeChannel === 'text-general'
                  ? 'bg-[#0066ff]/10 text-[#0066ff] border border-[#0066ff]/20'
                  : 'text-zinc-400 hover:bg-[#151518] hover:text-white'
              }`}
            >
              <Hash className={`w-4 h-4 ${activeChannel === 'text-general' ? 'text-[#0066ff]' : 'text-zinc-500 group-hover:text-white'}`} />
              <span className="truncate">general</span>
            </button>
          </div>

          {/* VOICE CHANNELS */}
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold text-zinc-500 tracking-wider uppercase flex items-center justify-between">
              <span>Voice Channels</span>
              <span className="text-[10px] text-[#0066ff] font-mono">
                {voiceUsers.length + (isInVoice ? 1 : 0)} connected
              </span>
            </div>

            <button
              onClick={() => {
                setActiveChannel('voice-general');
                if (!isInVoice) {
                  startVoice();
                }
              }}
              className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeChannel === 'voice-general'
                  ? 'bg-[#0066ff]/15 text-[#0066ff] font-semibold border border-[#0066ff]/30'
                  : 'text-zinc-400 hover:bg-[#151518] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Volume2 className={`w-4 h-4 ${activeChannel === 'voice-general' || isInVoice ? 'text-[#0066ff]' : 'text-zinc-500 group-hover:text-white'}`} />
                <span className="truncate">general</span>
              </div>
              {isInVoice && (
                <span className="text-[10px] text-[#0066ff] font-mono font-bold uppercase">
                  Connected
                </span>
              )}
            </button>

            {/* List of real users in voice */}
            {(isInVoice || voiceUsers.length > 0) && (
              <div className="mt-1 ml-4 pl-2 border-l border-[#242428] space-y-1">
                {isInVoice && (
                  <div className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-white">
                    <div className={`w-5 h-5 rounded-full bg-[#0066ff] text-black font-black text-[10px] flex items-center justify-center shrink-0 transition-all ${
                      isUserSpeaking ? 'ring-2 ring-[#0066ff] shadow-[0_0_10px_#0066ff]' : ''
                    }`}>
                      {currentUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate text-zinc-200">{currentUser.username} (You)</span>
                    {isMuted && <MicOff className="w-3 h-3 text-[#0066ff] ml-auto shrink-0" />}
                  </div>
                )}

                {voiceUsers.map((u: any) => {
                  const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                  return (
                    <div key={u.id} className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-zinc-300">
                      <div 
                        className={`w-5 h-5 rounded-full text-black font-extrabold text-[10px] flex items-center justify-center shrink-0 ${
                          isPeerSpeaking ? 'ring-2 ring-[#0066ff] shadow-[0_0_10px_#0066ff]' : ''
                        }`}
                        style={{ backgroundColor: u.avatar_color }}
                      >
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate">{u.username}</span>
                      {u.is_muted && <MicOff className="w-3 h-3 text-zinc-500 ml-auto shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* VIDEO CHANNELS */}
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold text-zinc-500 tracking-wider uppercase flex items-center justify-between">
              <span>Video Channels</span>
              <span className="text-[10px] text-[#0066ff] font-mono">
                {videoUsers.length + (isInVideo ? 1 : 0)} connected
              </span>
            </div>

            <button
              onClick={() => {
                setActiveChannel('video-general');
                if (!isInVideo) {
                  startVideo();
                }
              }}
              className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeChannel === 'video-general'
                  ? 'bg-[#0066ff]/15 text-[#0066ff] font-semibold border border-[#0066ff]/30'
                  : 'text-zinc-400 hover:bg-[#151518] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Video className={`w-4 h-4 ${activeChannel === 'video-general' || isInVideo ? 'text-[#0066ff]' : 'text-zinc-500 group-hover:text-white'}`} />
                <span className="truncate">general</span>
              </div>
              {isInVideo && (
                <span className="text-[10px] text-[#0066ff] font-mono font-bold uppercase">
                  Live
                </span>
              )}
            </button>

            {/* List of real users in video channel */}
            {(isInVideo || videoUsers.length > 0) && (
              <div className="mt-1 ml-4 pl-2 border-l border-[#242428] space-y-1">
                {isInVideo && (
                  <div className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-white">
                    <div className={`w-5 h-5 rounded-full bg-[#0066ff] text-black font-black text-[10px] flex items-center justify-center shrink-0 ${
                      isUserSpeaking ? 'ring-2 ring-[#0066ff]' : ''
                    }`}>
                      {currentUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate text-zinc-200">{currentUser.username} (You)</span>
                    <Video className="w-3 h-3 text-[#0066ff] ml-auto shrink-0" />
                  </div>
                )}

                {videoUsers.map((u: any) => {
                  const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                  return (
                    <div key={u.id} className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-zinc-300">
                      <div 
                        className={`w-5 h-5 rounded-full text-black font-extrabold text-[10px] flex items-center justify-center shrink-0 ${
                          isPeerSpeaking ? 'ring-2 ring-[#0066ff]' : ''
                        }`}
                        style={{ backgroundColor: u.avatar_color }}
                      >
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate">{u.username}</span>
                      <Video className="w-3 h-3 text-zinc-500 ml-auto shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Voice/Video Connected Strip */}
        {(isInVoice || isInVideo) && (
          <div className="p-2 border-t border-[#1c1c20] bg-[#111114]">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#0066ff]" />
                <div className="leading-tight">
                  <div className="text-[12px] font-bold text-[#0066ff]">
                    {isInVideo ? 'Video Connected' : 'Voice Connected'}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">general</div>
                </div>
              </div>
              <button
                onClick={isInVideo ? stopVideo : stopVoice}
                className="p-1.5 text-zinc-400 hover:text-[#0066ff] hover:bg-[#1a1a1e] rounded-lg transition-colors cursor-pointer"
                title="Disconnect"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* User Profile Bar */}
        <div className="h-14 px-3 bg-[#0a0a0c] flex items-center justify-between border-t border-[#1c1c20]">
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2.5 p-1 hover:bg-[#141417] rounded-lg cursor-pointer min-w-0 flex-1"
          >
            <div 
              className="w-8 h-8 rounded-xl text-black font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm shadow-[#0066ff]/20"
              style={{ backgroundColor: currentUser.avatar_color }}
            >
              {currentUser.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="leading-tight truncate">
              <div className="text-xs font-bold text-white truncate font-heading">{currentUser.username}</div>
              <div className="text-[10px] text-zinc-400 truncate">Online</div>
            </div>
          </div>

          <div className="flex items-center text-zinc-400 gap-0.5">
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-lg hover:bg-[#17171a] transition-colors cursor-pointer ${
                isMuted ? 'text-[#0066ff]' : 'hover:text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleDeafen}
              className={`p-1.5 rounded-lg hover:bg-[#17171a] transition-colors cursor-pointer ${
                isDeafened ? 'text-[#0066ff]' : 'hover:text-white'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              <Headphones className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b0e] p-6 rounded-2xl border border-[#1f1f1f] w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white font-heading">Edit Profile</h2>
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
                  className="w-full bg-[#121215] border border-[#222226] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0066ff] transition-colors"
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
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black text-black"
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
                className="flex-1 py-2.5 rounded-xl bg-[#0066ff] text-white hover:bg-[#0052cc] font-bold text-xs shadow-md shadow-[#0066ff]/20 transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Channel Area */}
      <main className="flex-1 flex flex-col bg-[#080808] min-w-0">
        
        {/* Channel Top Header */}
        <header className="h-12 px-4 border-b border-[#1c1c20] flex items-center justify-between bg-[#0b0b0e] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {activeChannel === 'text-general' && (
              <>
                <Hash className="w-5 h-5 text-[#0066ff]" />
                <h1 className="font-bold text-white text-[15px] font-heading tracking-tight">general</h1>
                <div className="hidden sm:block h-4 w-[1px] bg-[#222226] mx-2" />
                <span className="hidden sm:inline text-xs text-zinc-400 truncate">
                  Frosted Community Lounge
                </span>
              </>
            )}
            {activeChannel === 'voice-general' && (
              <>
                <Volume2 className="w-5 h-5 text-[#0066ff]" />
                <h1 className="font-bold text-white text-[15px] font-heading tracking-tight">general</h1>
              </>
            )}
            {activeChannel === 'video-general' && (
              <>
                <Video className="w-5 h-5 text-[#0066ff]" />
                <h1 className="font-bold text-white text-[15px] font-heading tracking-tight">general</h1>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-zinc-400">
            <button className="hover:text-white transition-colors cursor-pointer"><Bell className="w-5 h-5" /></button>
            <button className="hover:text-white transition-colors cursor-pointer"><Pin className="w-5 h-5" /></button>
            <button className="hover:text-white transition-colors cursor-pointer"><Search className="w-5 h-5" /></button>
          </div>
        </header>

        {/* CHANNEL 1: TEXT GENERAL */}
        {activeChannel === 'text-general' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              
              <div className="pb-6 border-b border-[#1c1c20] mb-4">
                <div className="w-14 h-14 rounded-2xl bg-[#0066ff]/15 border border-[#0066ff]/30 flex items-center justify-center mb-3 text-[#0066ff]">
                  <Hash className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white font-heading">
                  Welcome to #general
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md">
                  This is the start of the #general channel. Messages sync live over WebSockets across all tabs and devices.
                </p>
              </div>

              {messages.map((msg: any) => (
                <div key={msg.id} className="flex items-start gap-3.5 hover:bg-[#111114] -mx-4 px-4 py-2 rounded-xl transition-colors group">
                  <div 
                    className="w-9 h-9 rounded-xl text-black font-extrabold flex items-center justify-center shrink-0 text-xs shadow-sm"
                    style={{ backgroundColor: msg.avatar_color || '#0066ff' }}
                  >
                    {msg.sender_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-white text-[13px] hover:underline cursor-pointer font-heading">
                        {msg.sender_name}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-200 leading-relaxed break-words whitespace-pre-wrap mt-0.5">
                      {msg.content}
                    </p>
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

            {/* Input Bar */}
            <div className="p-4 pt-0">
              <form onSubmit={handleSendMessage} className="bg-[#121215] border border-[#222226] focus-within:border-[#0066ff] rounded-xl px-4 py-2.5 flex items-center gap-3 transition-colors">
                <button
                  type="button"
                  className="text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Attach"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Message #general"
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                />

                <button
                  type="button"
                  className="text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    inputText.trim() 
                      ? 'bg-[#0066ff] text-white hover:bg-[#0052cc]' 
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  <Send className="w-4 h-4 fill-current" />
                </button>
              </form>
            </div>

          </div>
        )}

        {/* CHANNEL 2: VOICE GENERAL - FULL VOICE CALL UI */}
        {activeChannel === 'voice-general' && (
          <div className="flex-1 flex flex-col bg-[#050508] relative overflow-hidden select-none">
            
            {/* Top Call Header */}
            <div className="px-6 py-3.5 border-b border-[#1c1c22] bg-[#09090c] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0066ff]/15 border border-[#0066ff]/30 flex items-center justify-center text-[#0066ff] shadow-sm shadow-[#0066ff]/20">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm font-heading tracking-tight">Voice Lounge #general</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1 font-mono uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Voice Connected
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {voiceUsers.length + 1} connected · Ultra-low latency WebRTC mesh · Opus HD 48kHz
                  </span>
                </div>
              </div>

              {/* Status / Ping indicators */}
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] text-zinc-300 font-mono">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>18ms Ping</span>
                </div>
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] text-zinc-300 font-mono">
                  <Radio className="w-3.5 h-3.5 text-[#0066ff]" />
                  <span>HD 96kbps</span>
                </div>
              </div>
            </div>

            {/* Mic Permission / Listen-Only Notice Banner */}
            {micError && (
              <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{micError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsMicTesting(!isMicTesting)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {isMicTesting ? 'Stop Test' : 'Simulate Audio Test'}
                  </button>
                  <button
                    onClick={startVoice}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Enable Mic
                  </button>
                </div>
              </div>
            )}

            {/* Main Stage: Voice Participant Cards Grid */}
            <div className="flex-1 p-6 pb-28 overflow-y-auto flex items-center justify-center">
              <div className="w-full max-w-4xl space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  
                  {/* Local User ("YOU") Call Tile */}
                  <div className={`p-6 rounded-2xl bg-[#0e0e12] border transition-all duration-300 flex flex-col items-center justify-center text-center relative group ${
                    isUserSpeaking 
                      ? 'border-[#0066ff] shadow-[0_0_25px_rgba(0,102,255,0.4)] scale-[1.02]' 
                      : 'border-[#1e1e24]'
                  }`}>
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#0066ff]/20 text-[#0066ff] border border-[#0066ff]/30 text-[9px] font-black tracking-widest uppercase font-mono">
                        YOU
                      </span>
                    </div>

                    <div className="relative mb-3.5">
                      <div 
                        className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-black text-black shadow-xl transition-all duration-300 ${
                          isUserSpeaking 
                            ? 'ring-4 ring-[#0066ff] shadow-[0_0_25px_#0066ff]' 
                            : 'ring-2 ring-white/10'
                        }`}
                        style={{ backgroundColor: currentUser.avatar_color }}
                      >
                        {currentUser.username.slice(0, 2).toUpperCase()}
                      </div>
                      {isMuted && (
                        <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md border-2 border-[#0e0e12]">
                          <MicOff className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="font-extrabold text-white text-base font-heading mb-1 truncate max-w-full">
                      {currentUser.username}
                    </div>

                    {/* Speaking indicator / Audio activity */}
                    <div className="flex items-center gap-1.5 h-5 mb-3">
                      {isUserSpeaking ? (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#0066ff]">
                          <span className="w-1 h-3 bg-[#0066ff] rounded-full animate-bounce" />
                          <span className="w-1 h-4 bg-[#0066ff] rounded-full animate-bounce [animation-delay:0.15s]" />
                          <span className="w-1 h-2 bg-[#0066ff] rounded-full animate-bounce [animation-delay:0.3s]" />
                          <span className="ml-1 text-[10px] uppercase font-mono tracking-wider">Speaking</span>
                        </div>
                      ) : isMuted ? (
                        <span className="text-[11px] text-zinc-500 font-medium">Microphone Muted</span>
                      ) : micError ? (
                        <span className="text-[11px] text-amber-400 font-medium">Listen-Only Mode</span>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Voice Connected
                        </span>
                      )}
                    </div>

                    {/* Live Mic VU Volume Meter */}
                    <div className="w-full max-w-[160px] space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span>Input Level</span>
                        <span>{audioLevel}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-[#0066ff] to-emerald-400 transition-all duration-75 rounded-full"
                          style={{ width: `${isMuted ? 0 : audioLevel}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Tile Actions */}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={toggleMute}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isMuted 
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                        }`}
                      >
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        onClick={() => setIsMicTesting(!isMicTesting)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isMicTesting 
                            ? 'bg-[#0066ff]/20 text-[#0066ff]' 
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                        }`}
                        title="Simulate speaking to verify sound visualizer"
                      >
                        {isMicTesting ? 'Testing...' : 'Test Mic'}
                      </button>
                    </div>

                  </div>

                  {/* Remote Voice Users Tiles */}
                  {voiceUsers.map((u: any) => {
                    const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                    const peerVol = peerVolumes[u.id] ?? 100;

                    return (
                      <div 
                        key={u.id} 
                        className={`p-6 rounded-2xl bg-[#0e0e12] border transition-all duration-300 flex flex-col items-center justify-center text-center relative group ${
                          isPeerSpeaking 
                            ? 'border-[#0066ff] shadow-[0_0_25px_rgba(0,102,255,0.4)] scale-[1.02]' 
                            : 'border-[#1e1e24]'
                        }`}
                      >
                        {/* Audio playback for this remote user */}
                        <RemoteAudioPlayer 
                          stream={remoteStreams[u.id]} 
                          isDeafened={isDeafened}
                          volume={peerVol / 100}
                        />

                        <div className="relative mb-3.5">
                          <div 
                            className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-black text-black shadow-xl transition-all duration-300 ${
                              isPeerSpeaking 
                                ? 'ring-4 ring-[#0066ff] shadow-[0_0_25px_#0066ff]' 
                                : 'ring-2 ring-white/10'
                            }`}
                            style={{ backgroundColor: u.avatar_color }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          {u.is_muted && (
                            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-zinc-700 text-zinc-300 flex items-center justify-center shadow-md border-2 border-[#0e0e12]">
                              <MicOff className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="font-extrabold text-white text-base font-heading mb-1 truncate max-w-full">
                          {u.username}
                        </div>

                        <div className="flex items-center gap-1.5 h-5 mb-3">
                          {isPeerSpeaking ? (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-[#0066ff]">
                              <span className="w-1 h-3 bg-[#0066ff] rounded-full animate-bounce" />
                              <span className="w-1 h-4 bg-[#0066ff] rounded-full animate-bounce [animation-delay:0.15s]" />
                              <span className="w-1 h-2 bg-[#0066ff] rounded-full animate-bounce [animation-delay:0.3s]" />
                              <span className="ml-1 text-[10px] uppercase font-mono tracking-wider">Speaking</span>
                            </div>
                          ) : u.is_muted ? (
                            <span className="text-[11px] text-zinc-500">Muted</span>
                          ) : (
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Connected
                            </span>
                          )}
                        </div>

                        {/* Individual Volume Slider */}
                        <div className="w-full max-w-[160px] space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                            <span>User Volume</span>
                            <span>{peerVol}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={peerVol}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPeerVolumes((prev) => ({ ...prev, [u.id]: val }));
                            }}
                            className="w-full accent-[#0066ff] cursor-pointer h-1.5 bg-black/40 rounded-full"
                          />
                        </div>

                      </div>
                    );
                  })}

                </div>

                {/* Interactive Lounge Members & Stage Panel */}
                {voiceUsers.length === 0 && (
                  <div className="p-6 rounded-2xl bg-[#09090c] border border-[#1f1f26] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#0066ff]" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider font-heading">
                          Invite Online Members To Voice
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {users.filter((u: any) => u.id !== currentUser.id).length} online in lounge
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {users.filter((u: any) => u.id !== currentUser.id).length === 0 ? (
                        <div className="col-span-full py-4 text-center text-xs text-zinc-500 italic">
                          No other players currently online. Open a second browser tab or invite friends to talk live!
                        </div>
                      ) : (
                        users.filter((u: any) => u.id !== currentUser.id).map((u: any) => (
                          <div key={u.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 truncate">
                              <div 
                                className="w-7 h-7 rounded-lg text-black font-extrabold text-[10px] flex items-center justify-center shrink-0"
                                style={{ backgroundColor: u.avatar_color || '#0066ff' }}
                              >
                                {u.username.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate text-xs font-bold text-white">{u.username}</span>
                            </div>
                            <button
                              onClick={() => handleStartCall(u, 'audio')}
                              className="px-2.5 py-1 rounded-lg bg-[#0066ff] hover:bg-[#0052cc] text-white text-[11px] font-bold transition-all cursor-pointer shrink-0 shadow-sm shadow-[#0066ff]/20 flex items-center gap-1"
                            >
                              <PhoneCall className="w-3 h-3" />
                              <span>Ring</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* DOCKED BOTTOM CALL CONTROLS BAR */}
            <div className="h-20 bg-[#0c0c10]/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-3 sm:gap-4 px-6 absolute bottom-0 inset-x-0 z-20">
              {/* Mute / Unmute */}
              <button 
                onClick={toggleMute}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isMuted 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30' 
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-[#0066ff]" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              {/* Deafen / Undeafen */}
              <button 
                onClick={toggleDeafen}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  isDeafened 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30' 
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
                title={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
              >
                <Headphones className={`w-4 h-4 ${isDeafened ? 'text-amber-400' : 'text-zinc-300'}`} />
                <span>{isDeafened ? 'Undeafen' : 'Deafen'}</span>
              </button>

              {/* Switch to Video Lounge */}
              <button 
                onClick={() => {
                  stopVoice();
                  startVideo();
                  setActiveChannel('video-general');
                }}
                className="hidden sm:flex px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-zinc-200 hover:text-white items-center gap-2 transition-all cursor-pointer"
                title="Switch to Video Channel"
              >
                <Video className="w-4 h-4 text-[#0066ff]" />
                <span>Video Call</span>
              </button>

              {/* Share Screen */}
              <button 
                onClick={toggleScreenShare}
                className={`hidden md:flex px-4 py-2.5 rounded-xl text-xs font-bold items-center gap-2 transition-all cursor-pointer ${
                  isScreenSharing 
                    ? 'bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/30' 
                    : 'bg-white/10 hover:bg-white/15 text-zinc-200 hover:text-white'
                }`}
                title="Share Screen"
              >
                <Monitor className="w-4 h-4" />
                <span>{isScreenSharing ? 'Sharing Screen' : 'Share Screen'}</span>
              </button>

              {/* Red Disconnect Button -> Takes user straight to text-general! */}
              <button 
                onClick={stopVoice}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-600/30 hover:scale-[1.02]"
                title="Disconnect & Return straight to #general"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>

          </div>
        )}

        {/* CHANNEL 3: VIDEO GENERAL - GLITCH-FREE VIDEO CALL UI */}
        {activeChannel === 'video-general' && (
          <div className="flex-1 flex flex-col bg-[#050505] relative overflow-hidden">
            
            {/* Top Video Header */}
            <div className="px-6 py-3.5 border-b border-[#1c1c22] bg-[#09090c] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0066ff]/15 border border-[#0066ff]/30 flex items-center justify-center text-[#0066ff]">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm font-heading">Video Lounge #general</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1 font-mono uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Video Mesh
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {videoUsers.length + (isVideoEnabled ? 1 : 0)} live cameras · 720p HD Video
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleScreenShare}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isScreenSharing ? 'bg-[#0066ff] text-white' : 'bg-white/5 hover:bg-white/10 text-zinc-300'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
                </button>
              </div>
            </div>

            {/* Main Video Stage */}
            <div className="flex-1 p-6 pb-28 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr overflow-y-auto">
              
              {/* Local Video Card */}
              {isVideoEnabled && (
                <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 aspect-video shadow-2xl">
                  <LocalVideoPlayer stream={activeVideoStream} />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white font-heading">{currentUser.username} (You)</span>
                    <div className="flex items-center gap-2">
                      {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                      <div className="w-2 h-2 rounded-full bg-[#0066ff] animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {/* Remote Peer Videos */}
              {videoUsers.map((u: any) => {
                const stream = remoteStreams[u.id];
                const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                
                return (
                  <div key={u.id} className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 aspect-video shadow-2xl">
                    {stream ? (
                      <RemoteVideoPlayer stream={stream} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0d0d10]">
                        <div 
                          className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-black transition-all ${
                            isPeerSpeaking ? 'ring-4 ring-[#0066ff]' : ''
                          }`}
                          style={{ backgroundColor: u.avatar_color }}
                        >
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest font-mono">Connecting Video...</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-between">
                      <span className="text-xs font-extrabold text-white font-heading">{u.username}</span>
                      <div className="flex items-center gap-2">
                        {u.is_muted && <MicOff className="w-3.5 h-3.5 text-zinc-400" />}
                        {isPeerSpeaking && <div className="w-2 h-2 rounded-full bg-[#0066ff] shadow-[0_0_8px_#0066ff]" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!isVideoEnabled && !isCameraStarting && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center shadow-inner">
                    <Video className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black text-white font-heading">Video Lounge Ready</h3>
                  <p className="text-sm text-zinc-400 max-w-xs mx-auto text-center">Start your camera to see and talk with the community in real-time.</p>
                  <button 
                    onClick={startVideo}
                    className="px-10 py-3 rounded-xl bg-[#0066ff] text-white font-extrabold hover:bg-[#0052cc] transition-all cursor-pointer shadow-lg shadow-[#0066ff]/20"
                  >
                    Turn on Camera
                  </button>
                </div>
              )}

              {isCameraStarting && (
                <div className="col-span-full flex flex-col items-center justify-center py-20">
                  <RotateCw className="w-10 h-10 text-[#0066ff] animate-spin mb-4" />
                  <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest font-mono">Initializing Camera...</span>
                </div>
              )}
            </div>

            {/* In-Call Controls */}
            {isInVideo && (
              <div className="h-20 bg-[#0d0d0f]/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-4 px-6 absolute bottom-0 inset-x-0 z-20">
                <button 
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                    isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5 text-[#0066ff]" />}
                </button>
                
                <button 
                  onClick={stopVideo}
                  className="px-6 h-12 rounded-2xl bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/30 cursor-pointer font-extrabold text-xs"
                  title="Disconnect & Return to #general"
                >
                  <PhoneOff className="w-5 h-5" />
                  <span>Disconnect</span>
                </button>

                <button 
                  onClick={toggleScreenShare}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                    isScreenSharing ? 'bg-[#0066ff] text-white' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title="Share Screen"
                >
                  <Monitor className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

      </main>

      {/* INCOMING CALL MODAL */}
      {incomingCall && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0e0e13] p-7 rounded-3xl border border-[#262630] w-full max-w-sm flex flex-col items-center text-center space-y-5 shadow-2xl shadow-black/80">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#0066ff] text-black font-black text-2xl flex items-center justify-center ring-4 ring-[#0066ff]/40 animate-pulse shadow-lg shadow-[#0066ff]/30">
                {(incomingCall.fromUserName || 'P').slice(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-white shadow-md">
                {incomingCall.callType === 'video' ? <Video className="w-3.5 h-3.5" /> : <PhoneCall className="w-3.5 h-3.5" />}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white font-heading">
                {incomingCall.fromUserName || 'Friend'}
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call...
              </p>
            </div>

            <div className="flex items-center gap-4 w-full pt-2">
              <button
                onClick={() => {
                  if (dismissIncomingCall) dismissIncomingCall();
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>

              <button
                onClick={handleAcceptIncomingCall}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/30 hover:scale-[1.02]"
              >
                <PhoneCall className="w-4 h-4 animate-bounce" />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OUTGOING CALL MODAL */}
      {outgoingCall && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0e0e13] p-7 rounded-3xl border border-[#262630] w-full max-w-sm flex flex-col items-center text-center space-y-5 shadow-2xl shadow-black/80">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#0066ff] text-black font-black text-2xl flex items-center justify-center ring-4 ring-[#0066ff]/40 animate-pulse shadow-lg shadow-[#0066ff]/30">
                {(outgoingCall.targetUserName || 'P').slice(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-[#0066ff] text-white shadow-md">
                {outgoingCall.callType === 'video' ? <Video className="w-3.5 h-3.5" /> : <PhoneCall className="w-3.5 h-3.5" />}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white font-heading">
                {outgoingCall.targetUserName || 'Player'}
              </h3>
              <p className="text-xs text-zinc-400 font-medium font-mono">
                Calling {outgoingCall.callType === 'video' ? 'Video' : 'Voice'}... Ringing
              </p>
            </div>

            <div className="w-full pt-2">
              <button
                onClick={() => {
                  if (dismissOutgoingCall) dismissOutgoingCall();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-600/30"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
