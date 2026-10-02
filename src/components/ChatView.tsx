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
  AlertCircle
} from 'lucide-react';
import { useWebSocketDatabase } from '../services/wsDatabaseClient';
import { useWebRTC } from '../services/useWebRTC';

export const ChatView: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<'text-general' | 'voice-general' | 'video-general'>('text-general');
  const [inputText, setInputText] = useState('');

  // Persistent user identity
  const [currentUser] = useState(() => {
    const savedId = localStorage.getItem('melted_chat_user_id') || ('u_' + Math.random().toString(36).substr(2, 6));
    const savedName = localStorage.getItem('melted_chat_username') || ('Player_' + Math.floor(100 + Math.random() * 900));
    localStorage.setItem('melted_chat_user_id', savedId);
    localStorage.setItem('melted_chat_username', savedName);
    return {
      id: savedId,
      username: savedName,
      avatar_color: '#ff5500',
    };
  });

  // Reactive WebSocket Database Client
  const {
    users,
    messages,
    updateUser,
    insertMessage,
    sendRtcSignal,
    registerRtcHandlers,
  } = useWebSocketDatabase(currentUser);

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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Real connected peers in channels
  const voiceUsers = users.filter((u) => u.current_channel === 'voice-general' && u.id !== currentUser.id);
  const videoUsers = users.filter((u) => u.current_channel === 'video-general' && u.id !== currentUser.id);

  // WebRTC Mesh Manager for real peer-to-peer audio & video transmission
  const activePeers = activeChannel === 'voice-general' 
    ? voiceUsers 
    : activeChannel === 'video-general' 
    ? videoUsers 
    : [];

  const { remoteStreams, remoteSpeaking } = useWebRTC({
    currentUserId: currentUser.id,
    activeChannel,
    localAudioStream,
    localVideoStream: activeVideoStream,
    peers: activePeers,
    sendRtcSignal,
    registerRtcHandlers,
  });

  // Video Ref Callback: Guarantees video stream attaches when the <video> DOM node mounts
  const setLocalVideoRef = useCallback((videoElement: HTMLVideoElement | null) => {
    localVideoRef.current = videoElement;
    if (videoElement && activeVideoStream) {
      videoElement.srcObject = activeVideoStream;
      videoElement.play().catch(() => {});
    }
  }, [activeVideoStream]);

  // Sync speaking state to WebSocket Database
  useEffect(() => {
    updateUser({ is_speaking: isUserSpeaking });
  }, [isUserSpeaking, updateUser]);

  // Sync mute state to WebSocket Database
  useEffect(() => {
    updateUser({ is_muted: isMuted, is_deafened: isDeafened });
  }, [isMuted, isDeafened, updateUser]);

  // Sync channel state to WebSocket Database
  useEffect(() => {
    updateUser({
      current_channel: activeChannel,
      has_video: isInVideo && isVideoEnabled,
      is_screen_sharing: isScreenSharing,
    });
  }, [activeChannel, isInVideo, isVideoEnabled, isScreenSharing, updateUser]);

  // Auto scroll messages
  useEffect(() => {
    if (activeChannel === 'text-general') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeChannel]);

  // 1. Microphone capture & volume analyzer
  const initAudioProcessing = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return true;
      if (micStreamRef.current) return true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setLocalAudioStream(stream);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!micStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Orange speaking detection threshold
        const speaking = average > 18 && !isMuted;
        setIsUserSpeaking(speaking);

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
      return true;
    } catch (err) {
      console.warn('Microphone permission skipped or blocked, continuing in listen mode:', err);
      return false;
    }
  };

  const stopAudioProcessing = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    setLocalAudioStream(null);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsUserSpeaking(false);
  };

  // Dedicated Voice Channel Start/Stop
  const startVoice = async () => {
    if (isInVideo) {
      stopVideoTracks();
      setIsInVideo(false);
    }
    await initAudioProcessing();
    setIsInVoice(true);
    setIsInVideo(false);
    setActiveChannel('voice-general');
  };

  const stopVoice = () => {
    stopAudioProcessing();
    setIsInVoice(false);
    setIsUserSpeaking(false);
    setActiveChannel('text-general');
  };

  const stopVideoTracks = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    setActiveVideoStream(null);
  };

  // 2. Camera capture for Video Channel
  const startVideo = async () => {
    if (isInVoice) {
      stopAudioProcessing();
      setIsInVoice(false);
    }
    setIsInVideo(true);
    setIsInVoice(false);
    setActiveChannel('video-general');
    setIsCameraStarting(true);
    setCameraError(null);

    // Audio for video stream
    initAudioProcessing().catch(() => {});

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera is not supported on this browser.');
      }

      let camStream: MediaStream;
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });
      } catch {
        camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      cameraStreamRef.current = camStream;
      setActiveVideoStream(camStream);
      setIsVideoEnabled(true);
      setIsCameraStarting(false);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = camStream;
        localVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.info('Camera access not granted or unavailable, falling back to avatar mode:', err?.message || err);
      setIsCameraStarting(false);
      setIsVideoEnabled(false);
      setCameraError(
        err?.name === 'NotAllowedError' 
          ? 'Camera permission was not granted. Showing your avatar tile instead.'
          : err?.name === 'NotFoundError'
          ? 'No camera was detected. Showing your avatar tile instead.'
          : 'Camera unavailable. Showing your avatar tile instead.'
      );
    }
  };

  const stopVideo = () => {
    setIsCameraStarting(false);
    setCameraError(null);
    stopVideoTracks();
    stopAudioProcessing();
    setIsInVideo(false);
    setIsInVoice(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setActiveChannel('text-general');
  };

  const toggleCamera = async () => {
    if (isVideoEnabled && cameraStreamRef.current) {
      cameraStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      setIsVideoEnabled(false);
    } else if (cameraStreamRef.current) {
      cameraStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      setIsVideoEnabled(true);
      if (localVideoRef.current && activeVideoStream) {
        localVideoRef.current.play().catch(() => {});
      }
    } else {
      await startVideo();
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices?.getDisplayMedia) {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
          setActiveVideoStream(screenStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
            localVideoRef.current.play().catch(() => {});
          }

          screenStream.getVideoTracks()[0].onended = () => {
            if (cameraStreamRef.current) {
              setActiveVideoStream(cameraStreamRef.current);
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = cameraStreamRef.current;
                localVideoRef.current.play().catch(() => {});
              }
            }
            setIsScreenSharing(false);
          };
          setIsScreenSharing(true);
        }
      } catch (err) {
        console.warn('Screen share canceled:', err);
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (cameraStreamRef.current) {
        setActiveVideoStream(cameraStreamRef.current);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
      }
      setIsScreenSharing(false);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
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
            <span className="font-heading font-extrabold text-[15px] tracking-tight text-white">MELTED LOUNGE</span>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          
          {/* TEXT CHANNELS */}
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
              Text Channels
            </div>

            <button
              onClick={() => setActiveChannel('text-general')}
              className={`w-full group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeChannel === 'text-general'
                  ? 'bg-[#ff5500]/15 text-[#ff5500] font-semibold border border-[#ff5500]/30'
                  : 'text-zinc-400 hover:bg-[#151518] hover:text-white'
              }`}
            >
              <Hash className={`w-4 h-4 ${activeChannel === 'text-general' ? 'text-[#ff5500]' : 'text-zinc-500 group-hover:text-white'}`} />
              <span className="truncate">general</span>
            </button>
          </div>

          {/* VOICE CHANNELS */}
          <div>
            <div className="px-2 mb-1.5 text-[11px] font-bold text-zinc-500 tracking-wider uppercase flex items-center justify-between">
              <span>Voice Channels</span>
              <span className="text-[10px] text-[#ff5500] font-mono">
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
                  ? 'bg-[#ff5500]/15 text-[#ff5500] font-semibold border border-[#ff5500]/30'
                  : 'text-zinc-400 hover:bg-[#151518] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Volume2 className={`w-4 h-4 ${activeChannel === 'voice-general' || isInVoice ? 'text-[#ff5500]' : 'text-zinc-500 group-hover:text-white'}`} />
                <span className="truncate">general</span>
              </div>
              {isInVoice && (
                <span className="text-[10px] text-[#ff5500] font-mono font-bold uppercase">
                  Connected
                </span>
              )}
            </button>

            {/* List of real users in voice */}
            {(isInVoice || voiceUsers.length > 0) && (
              <div className="mt-1 ml-4 pl-2 border-l border-[#242428] space-y-1">
                {isInVoice && (
                  <div className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-white">
                    <div className={`w-5 h-5 rounded-full bg-[#ff5500] text-black font-black text-[10px] flex items-center justify-center shrink-0 transition-all ${
                      isUserSpeaking ? 'ring-2 ring-[#ff5500] shadow-[0_0_10px_#ff5500]' : ''
                    }`}>
                      {currentUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate text-zinc-200">{currentUser.username} (You)</span>
                    {isMuted && <MicOff className="w-3 h-3 text-[#ff5500] ml-auto shrink-0" />}
                  </div>
                )}

                {voiceUsers.map((u) => {
                  const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                  return (
                    <div key={u.id} className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-zinc-300">
                      <div 
                        className={`w-5 h-5 rounded-full text-black font-extrabold text-[10px] flex items-center justify-center shrink-0 ${
                          isPeerSpeaking ? 'ring-2 ring-[#ff5500] shadow-[0_0_10px_#ff5500]' : ''
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
              <span className="text-[10px] text-[#ff5500] font-mono">
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
                  ? 'bg-[#ff5500]/15 text-[#ff5500] font-semibold border border-[#ff5500]/30'
                  : 'text-zinc-400 hover:bg-[#151518] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Video className={`w-4 h-4 ${activeChannel === 'video-general' || isInVideo ? 'text-[#ff5500]' : 'text-zinc-500 group-hover:text-white'}`} />
                <span className="truncate">general</span>
              </div>
              {isInVideo && (
                <span className="text-[10px] text-[#ff5500] font-mono font-bold uppercase">
                  Live
                </span>
              )}
            </button>

            {/* List of real users in video channel */}
            {(isInVideo || videoUsers.length > 0) && (
              <div className="mt-1 ml-4 pl-2 border-l border-[#242428] space-y-1">
                {isInVideo && (
                  <div className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-white">
                    <div className={`w-5 h-5 rounded-full bg-[#ff5500] text-black font-black text-[10px] flex items-center justify-center shrink-0 ${
                      isUserSpeaking ? 'ring-2 ring-[#ff5500]' : ''
                    }`}>
                      {currentUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate text-zinc-200">{currentUser.username} (You)</span>
                    <Video className="w-3 h-3 text-[#ff5500] ml-auto shrink-0" />
                  </div>
                )}

                {videoUsers.map((u) => {
                  const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                  return (
                    <div key={u.id} className="flex items-center gap-2 py-1 px-1.5 rounded text-xs text-zinc-300">
                      <div 
                        className={`w-5 h-5 rounded-full text-black font-extrabold text-[10px] flex items-center justify-center shrink-0 ${
                          isPeerSpeaking ? 'ring-2 ring-[#ff5500]' : ''
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
                <Radio className="w-4 h-4 text-[#ff5500]" />
                <div className="leading-tight">
                  <div className="text-[12px] font-bold text-[#ff5500]">
                    {isInVideo ? 'Video Connected' : 'Voice Connected'}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">general</div>
                </div>
              </div>
              <button
                onClick={isInVideo ? stopVideo : stopVoice}
                className="p-1.5 text-zinc-400 hover:text-[#ff5500] hover:bg-[#1a1a1e] rounded-lg transition-colors cursor-pointer"
                title="Disconnect"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* User Profile Bar */}
        <div className="h-14 px-3 bg-[#0a0a0c] flex items-center justify-between border-t border-[#1c1c20]">
          <div className="flex items-center gap-2.5 p-1 hover:bg-[#141417] rounded-lg cursor-pointer min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#ff5500] text-black font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm shadow-[#ff5500]/20">
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
                isMuted ? 'text-[#ff5500]' : 'hover:text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleDeafen}
              className={`p-1.5 rounded-lg hover:bg-[#17171a] transition-colors cursor-pointer ${
                isDeafened ? 'text-[#ff5500]' : 'hover:text-white'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              <Headphones className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* Main Channel Area */}
      <main className="flex-1 flex flex-col bg-[#080808] min-w-0">
        
        {/* Channel Top Header */}
        <header className="h-12 px-4 border-b border-[#1c1c20] flex items-center justify-between bg-[#0b0b0e] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {activeChannel === 'text-general' && (
              <>
                <Hash className="w-5 h-5 text-[#ff5500]" />
                <h1 className="font-bold text-white text-[15px] font-heading tracking-tight">general</h1>
                <div className="hidden sm:block h-4 w-[1px] bg-[#222226] mx-2" />
                <span className="hidden sm:inline text-xs text-zinc-400 truncate">
                  Community chat and discussion
                </span>
              </>
            )}
            {activeChannel === 'voice-general' && (
              <>
                <Volume2 className="w-5 h-5 text-[#ff5500]" />
                <h1 className="font-bold text-white text-[15px] font-heading tracking-tight">general</h1>
                <div className="hidden sm:block h-4 w-[1px] bg-[#222226] mx-2" />
                <span className="hidden sm:inline text-xs text-zinc-400 truncate">
                  Voice Room ({voiceUsers.length + (isInVoice ? 1 : 0)} connected)
                </span>
              </>
            )}
            {activeChannel === 'video-general' && (
              <>
                <Video className="w-5 h-5 text-[#ff5500]" />
                <h1 className="font-bold text-white text-[15px] font-heading tracking-tight">general</h1>
                <div className="hidden sm:block h-4 w-[1px] bg-[#222226] mx-2" />
                <span className="hidden sm:inline text-xs text-zinc-400 truncate">
                  Video Channel ({videoUsers.length + (isInVideo ? 1 : 0)} connected)
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-zinc-400">
            <Bell className="w-4 h-4 hover:text-white cursor-pointer" />
            <Pin className="w-4 h-4 hover:text-white cursor-pointer" />
            <div className="relative">
              <input
                type="text"
                placeholder="Search"
                className="bg-[#141417] text-xs text-white rounded-lg px-2.5 py-1 pr-6 w-28 sm:w-36 focus:w-44 transition-all focus:outline-none placeholder-zinc-500 border border-[#222226] focus:border-[#ff5500]"
              />
              <Search className="w-3 h-3 text-zinc-500 absolute right-2 top-2" />
            </div>
          </div>
        </header>

        {/* CHANNEL 1: TEXT GENERAL */}
        {activeChannel === 'text-general' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              
              <div className="pb-6 border-b border-[#1c1c20] mb-4">
                <div className="w-14 h-14 rounded-2xl bg-[#ff5500]/15 border border-[#ff5500]/30 flex items-center justify-center mb-3 text-[#ff5500]">
                  <Hash className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white font-heading">
                  Welcome to #general
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-md">
                  This is the start of the #general channel. Messages sync live over WebSockets across all tabs and devices.
                </p>
              </div>

              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3.5 hover:bg-[#111114] -mx-4 px-4 py-2 rounded-xl transition-colors group">
                  <div 
                    className="w-9 h-9 rounded-xl text-black font-extrabold flex items-center justify-center shrink-0 text-xs shadow-sm"
                    style={{ backgroundColor: msg.avatar_color || '#ff5500' }}
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
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 pt-0">
              <form onSubmit={handleSendMessage} className="bg-[#121215] border border-[#222226] focus-within:border-[#ff5500] rounded-xl px-4 py-2.5 flex items-center gap-3 transition-colors">
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
                      ? 'bg-[#ff5500] text-black hover:bg-[#e64d00]' 
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        )}

        {/* CHANNEL 2: VOICE GENERAL (With Real WebRTC Peer Audio) */}
        {activeChannel === 'voice-general' && (
          <div className="flex-1 flex flex-col p-6 bg-[#080808] overflow-y-auto justify-between">
            
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-5xl">
                
                {/* Current User Card */}
                {isInVoice && (
                  <div className="relative aspect-video sm:aspect-square max-h-56 bg-[#121215] rounded-3xl border border-[#26262a] flex flex-col items-center justify-center p-4 transition-all">
                    <div className="relative mb-3">
                      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#ff5500] text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-[#ff5500]/25 transition-all ${
                        isUserSpeaking ? 'ring-4 ring-[#ff5500] shadow-[0_0_25px_#ff5500]/60' : ''
                      }`}>
                        {currentUser.username.slice(0, 2).toUpperCase()}
                      </div>
                      {isMuted && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#18181b] border-2 border-[#ff5500] flex items-center justify-center text-[#ff5500]">
                          <MicOff className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-white font-heading truncate max-w-[140px]">
                      {currentUser.username} (You)
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      {isUserSpeaking ? 'Speaking' : isMuted ? 'Muted' : 'Listening'}
                    </span>
                  </div>
                )}

                {/* Other Real Users Connected via WebSockets + WebRTC Audio Stream */}
                {voiceUsers.map((u) => {
                  const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                  return (
                    <div key={u.id} className="relative aspect-video sm:aspect-square max-h-56 bg-[#121215] rounded-3xl border border-[#26262a] flex flex-col items-center justify-center p-4 transition-all">
                      
                      {/* WebRTC Live Audio Element: Plays peer's real microphone audio */}
                      {remoteStreams[u.id] && (
                        <audio
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && remoteStreams[u.id]) {
                              el.srcObject = remoteStreams[u.id];
                              el.play().catch(() => {});
                            }
                          }}
                        />
                      )}

                      <div className="relative mb-3">
                        <div 
                          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl text-black font-black text-2xl flex items-center justify-center shadow-lg transition-all ${
                            isPeerSpeaking ? 'ring-4 ring-[#ff5500] shadow-[0_0_25px_#ff5500]/60' : ''
                          }`}
                          style={{ backgroundColor: u.avatar_color }}
                        >
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        {u.is_muted && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#18181b] border-2 border-zinc-600 flex items-center justify-center text-zinc-400">
                            <MicOff className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white font-heading truncate max-w-[140px]">
                        {u.username}
                      </span>
                      <span className="text-[11px] text-zinc-400 mt-0.5">
                        {isPeerSpeaking ? 'Speaking' : u.is_muted ? 'Muted' : 'Listening'}
                      </span>
                    </div>
                  );
                })}

                {/* Clean prompt if nobody else is in voice */}
                {isInVoice && voiceUsers.length === 0 && (
                  <div className="border border-dashed border-[#222226] rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                    <Volume2 className="w-6 h-6 text-zinc-600 mb-2" />
                    <span className="text-xs font-semibold text-zinc-400">
                      Waiting for other players to join voice
                    </span>
                  </div>
                )}

              </div>
            </div>

            {/* Bottom In-Voice Dock */}
            <div className="pt-6 flex justify-center">
              {!isInVoice ? (
                <button
                  onClick={startVoice}
                  className="flex items-center gap-2 px-6 py-3 bg-[#ff5500] hover:bg-[#e64d00] text-black font-black text-sm rounded-xl shadow-lg shadow-[#ff5500]/20 transition-all cursor-pointer font-heading"
                >
                  <Mic className="w-4 h-4" />
                  <span>Join Voice</span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-3 bg-[#111114] border border-[#242428] px-4 py-2.5 rounded-2xl shadow-xl">
                  <button
                    onClick={toggleMute}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isMuted 
                        ? 'bg-[#ff5500]/20 text-[#ff5500] border-[#ff5500]/40' 
                        : 'bg-[#18181b] text-zinc-300 hover:text-white border-[#2c2c30]'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={toggleDeafen}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isDeafened 
                        ? 'bg-[#ff5500]/20 text-[#ff5500] border-[#ff5500]/40' 
                        : 'bg-[#18181b] text-zinc-300 hover:text-white border-[#2c2c30]'
                    }`}
                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                  >
                    <Headphones className="w-4 h-4" />
                  </button>

                  <button
                    onClick={stopVoice}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#18181b] hover:bg-[#202024] text-[#ff5500] font-bold text-xs rounded-xl border border-[#2c2c32] hover:border-[#ff5500]/50 transition-all cursor-pointer font-heading"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>Disconnect</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* CHANNEL 3: VIDEO GENERAL (With Real WebRTC Live Video & Audio) */}
        {activeChannel === 'video-general' && (
          <div className="flex-1 flex flex-col p-6 bg-[#080808] overflow-y-auto justify-between">
            
            {/* Video Grid */}
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-6xl">
                
                {/* Current User Video Box */}
                {isInVideo && (
                  <div className="relative aspect-video bg-[#121215] rounded-3xl border border-[#26262a] overflow-hidden shadow-2xl flex items-center justify-center group">
                    
                    {/* Camera Loading Screen */}
                    {isCameraStarting && (
                      <div className="absolute inset-0 bg-[#0e0e11] z-20 flex flex-col items-center justify-center space-y-3">
                        <div className="w-8 h-8 border-2 border-[#ff5500] border-t-transparent rounded-full animate-spin" />
                        <div className="text-center">
                          <p className="text-sm font-bold text-white font-heading">
                            Starting camera...
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Connecting video stream
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Camera Notice Banner */}
                    {cameraError && !isCameraStarting && (
                      <div className="absolute top-3 left-3 right-3 bg-[#141418]/90 backdrop-blur-md border border-[#26262a] rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px] text-zinc-300 z-20 shadow-lg">
                        <div className="flex items-center gap-1.5 truncate">
                          <AlertCircle className="w-3.5 h-3.5 text-[#ff5500] shrink-0" />
                          <span className="truncate">{cameraError}</span>
                        </div>
                        <button
                          onClick={startVideo}
                          className="ml-2 text-[#ff5500] hover:text-white font-bold shrink-0 cursor-pointer flex items-center gap-1 text-[10px]"
                        >
                          <RotateCw className="w-2.5 h-2.5" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    {/* Local Live Video Element */}
                    <video
                      ref={setLocalVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${(!isVideoEnabled && !isScreenSharing) || isCameraStarting ? 'hidden' : 'block'}`}
                    />

                    {/* Local Avatar Tile */}
                    {!isVideoEnabled && !isScreenSharing && !isCameraStarting && (
                      <div className="flex flex-col items-center justify-center">
                        <div className={`w-20 h-20 rounded-2xl bg-[#ff5500] text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-[#ff5500]/25 transition-all ${
                          isUserSpeaking ? 'ring-4 ring-[#ff5500] shadow-[0_0_25px_#ff5500]/60' : ''
                        }`}>
                          {currentUser.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-zinc-400 mt-2 font-medium">
                          {cameraError ? 'Avatar Mode' : 'Camera is Off'}
                        </span>
                      </div>
                    )}

                    {/* Overlay Label */}
                    <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white border border-white/10 flex items-center gap-2 z-10">
                      <span>{currentUser.username} (You)</span>
                      {isScreenSharing && (
                        <span className="text-[10px] bg-[#ff5500] text-black px-1.5 py-0.2 rounded font-black">
                          Screen
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Other Real Users: Real WebRTC Video Feed & Audio */}
                {videoUsers.map((u) => {
                  const peerStream = remoteStreams[u.id];
                  const hasRemoteVideo = peerStream && peerStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
                  const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;

                  return (
                    <div key={u.id} className="relative aspect-video bg-[#121215] rounded-3xl border border-[#26262a] overflow-hidden shadow-2xl flex items-center justify-center">
                      
                      {/* WebRTC Live Audio for peer */}
                      {peerStream && (
                        <audio
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && peerStream) {
                              el.srcObject = peerStream;
                              el.play().catch(() => {});
                            }
                          }}
                        />
                      )}

                      {/* WebRTC Live Video Stream */}
                      {hasRemoteVideo ? (
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && peerStream) {
                              el.srcObject = peerStream;
                              el.play().catch(() => {});
                            }
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <div 
                            className={`w-20 h-20 rounded-2xl text-black font-black text-2xl flex items-center justify-center shadow-lg transition-all ${
                              isPeerSpeaking ? 'ring-4 ring-[#ff5500] shadow-[0_0_20px_#ff5500]' : ''
                            }`}
                            style={{ backgroundColor: u.avatar_color }}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs text-zinc-400 mt-2">
                            {u.has_video ? 'Connecting feed...' : 'Avatar Mode'}
                          </span>
                        </div>
                      )}

                      {/* Overlay Label */}
                      <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-white border border-white/10 flex items-center gap-2">
                        <span>{u.username}</span>
                        {hasRemoteVideo ? (
                          <Video className="w-3.5 h-3.5 text-[#ff5500]" />
                        ) : u.is_muted ? (
                          <MicOff className="w-3.5 h-3.5 text-zinc-500" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-[#ff5500]" />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Clean prompt if only 1 user */}
                {isInVideo && videoUsers.length === 0 && (
                  <div className="border border-dashed border-[#222226] rounded-3xl p-6 flex flex-col items-center justify-center text-center aspect-video">
                    <Video className="w-6 h-6 text-zinc-600 mb-2" />
                    <span className="text-xs font-semibold text-zinc-400">
                      Waiting for other players to join video
                    </span>
                  </div>
                )}

              </div>
            </div>

            {/* Bottom Video Controls Dock */}
            <div className="pt-6 flex justify-center">
              {!isInVideo ? (
                <button
                  onClick={startVideo}
                  className="flex items-center gap-2 px-6 py-3 bg-[#ff5500] hover:bg-[#e64d00] text-black font-black text-sm rounded-xl shadow-lg shadow-[#ff5500]/20 transition-all cursor-pointer font-heading"
                >
                  <Video className="w-4 h-4" />
                  <span>Join Video</span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-3 bg-[#111114] border border-[#242428] px-4 py-2.5 rounded-2xl shadow-xl">
                  {/* Camera Toggle */}
                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isVideoEnabled 
                        ? 'bg-[#18181b] text-white border-[#2c2c30]' 
                        : 'bg-[#ff5500]/20 text-[#ff5500] border-[#ff5500]/40'
                    }`}
                    title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>

                  {/* Screen Share Toggle */}
                  <button
                    onClick={toggleScreenShare}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isScreenSharing 
                        ? 'bg-[#ff5500] text-black border-[#ff5500] font-bold' 
                        : 'bg-[#18181b] text-zinc-300 hover:text-white border-[#2c2c30]'
                    }`}
                    title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>

                  {/* Mic Toggle */}
                  <button
                    onClick={toggleMute}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isMuted 
                        ? 'bg-[#ff5500]/20 text-[#ff5500] border-[#ff5500]/40' 
                        : 'bg-[#18181b] text-zinc-300 hover:text-white border-[#2c2c30]'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Deafen Toggle */}
                  <button
                    onClick={toggleDeafen}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isDeafened 
                        ? 'bg-[#ff5500]/20 text-[#ff5500] border-[#ff5500]/40' 
                        : 'bg-[#18181b] text-zinc-300 hover:text-white border-[#2c2c30]'
                    }`}
                    title={isDeafened ? 'Undeafen' : 'Deafen'}
                  >
                    <Headphones className="w-4 h-4" />
                  </button>

                  {/* Disconnect Video */}
                  <button
                    onClick={stopVideo}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#18181b] hover:bg-[#202024] text-[#ff5500] font-bold text-xs rounded-xl border border-[#2c2c32] hover:border-[#ff5500]/50 transition-all cursor-pointer font-heading"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>Disconnect</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

    </div>
  );
};
