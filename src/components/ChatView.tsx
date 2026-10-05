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
  X
} from 'lucide-react';
import { useWebRTC } from '../services/useWebRTC';

interface ChatViewProps {
  globalChat: any; // Using any for brevity, should ideally be typed
}

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
  } = globalChat;

  const [activeChannel, setActiveChannel] = useState<'text-general' | 'voice-general' | 'video-general'>('text-general');
  const [inputText, setInputText] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

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
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Real connected peers in channels
  const voiceUsers = users.filter((u: any) => u.current_channel === 'voice-general' && u.id !== currentUser.id);
  const videoUsers = users.filter((u: any) => u.current_channel === 'video-general' && u.id !== currentUser.id);

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
    setRtcSignalHandler,
    setMediaHandlers,
  });

  // Video Ref Callback: Guarantees video stream attaches when the <video> DOM node mounts
  const setLocalVideoRef = useCallback((videoElement: HTMLVideoElement | null) => {
    localVideoRef.current = videoElement;
    if (videoElement && activeVideoStream) {
      videoElement.srcObject = activeVideoStream;
    }
  }, [activeVideoStream]);

  // Sync scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  // Voice Detection Logic: Visual indicators for active speaker
  useEffect(() => {
    if (!localAudioStream || isMuted) {
      setIsUserSpeaking(false);
      updateUserRef.current({ is_speaking: false });
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
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
        const speaking = average > 30; // Sensitivity threshold
        
        if (speaking !== lastSpeakState) {
          lastSpeakState = speaking;
          setIsUserSpeaking(speaking);
          updateUserRef.current({ is_speaking: speaking });
        }
        
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Voice detection error:', err);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [localAudioStream, isMuted]);

  // Handlers
  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setLocalAudioStream(stream);
      setIsInVoice(true);
      updateUser({ current_channel: 'voice-general', is_muted: isMuted });
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopVoice = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setLocalAudioStream(null);
    setIsInVoice(false);
    updateUser({ current_channel: 'text-general', is_speaking: false });
    setActiveChannel('text-general');
  };

  const startVideo = async () => {
    setIsCameraStarting(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 1280, height: 720 } 
      });
      cameraStreamRef.current = stream;
      setActiveVideoStream(stream);
      setLocalAudioStream(stream); 
      setIsInVideo(true);
      setIsVideoEnabled(true);
      updateUser({ 
        current_channel: 'video-general', 
        has_video: true,
        is_muted: isMuted 
      });
    } catch (err) {
      setCameraError('Camera access denied or unavailable');
      console.error('Camera error:', err);
    } finally {
      setIsCameraStarting(false);
    }
  };

  const stopVideo = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
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
                        onClick={() => callUser(u.id, 'audio')}
                        title="Audio Call" 
                        className="p-1.5 text-zinc-400 hover:text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg transition-all"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => callUser(u.id, 'video')}
                        title="Video Call" 
                        className="p-1.5 text-zinc-400 hover:text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg transition-all"
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

        {/* CHANNEL 2: VOICE GENERAL */}
        {activeChannel === 'voice-general' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 overflow-y-auto">
             {/* Grid of Users in Voice */}
             <div className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                
                {/* Local User */}
                <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#111114] border border-[#1c1c20] relative">
                   <div 
                    className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-2xl font-black text-black shadow-xl transition-all duration-300 ${
                      isUserSpeaking ? 'ring-4 ring-[#0066ff] scale-105 shadow-[0_0_20px_#0066ff]/40' : 'ring-2 ring-white/10'
                    }`}
                    style={{ backgroundColor: currentUser.avatar_color }}
                  >
                     {currentUser.username.slice(0, 2).toUpperCase()}
                   </div>
                   <div className="flex items-center gap-1.5">
                     <span className="text-sm font-bold text-white font-heading">{currentUser.username}</span>
                     {isMuted && <MicOff className="w-3 h-3 text-[#0066ff]" />}
                   </div>
                   <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <div className="px-2 py-0.5 rounded-full bg-black/40 text-[#0066ff] text-[9px] font-black uppercase tracking-widest">YOU</div>
                   </div>
                </div>

                {/* Remote Voice Users */}
                {voiceUsers.map((u: any) => {
                  const isPeerSpeaking = remoteSpeaking[u.id] || u.is_speaking;
                  return (
                    <div key={u.id} className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-[#0d0d0f] border border-[#1c1c20]">
                      <div 
                        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-2xl font-black text-black transition-all duration-300 ${
                          isPeerSpeaking ? 'ring-4 ring-[#0066ff] scale-105 shadow-[0_0_20px_#0066ff]/40' : 'ring-2 ring-white/10'
                        }`}
                        style={{ backgroundColor: u.avatar_color }}
                      >
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-zinc-200 font-heading">{u.username}</span>
                        {u.is_muted && <MicOff className="w-3 h-3 text-zinc-500" />}
                      </div>
                    </div>
                  );
                })}

             </div>

             {!isInVoice && (
                <div className="max-w-md space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center mx-auto mb-2">
                    <Volume2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-white font-heading">Voice Channel</h3>
                  <p className="text-sm text-zinc-400">Join the general voice channel to talk with other players in real-time.</p>
                  <button 
                    onClick={startVoice}
                    className="px-8 py-3 rounded-xl bg-[#0066ff] text-white font-black hover:bg-[#0052cc] transition-all cursor-pointer shadow-lg shadow-[#0066ff]/20"
                  >
                    Join Voice
                  </button>
                </div>
             )}
          </div>
        )}

        {/* CHANNEL 3: VIDEO GENERAL */}
        {activeChannel === 'video-general' && (
          <div className="flex-1 flex flex-col bg-[#050505] relative overflow-hidden">
            
            {/* Main Video Stage */}
            <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr overflow-y-auto">
              
              {/* Local Video Card */}
              {isVideoEnabled && (
                <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 aspect-video group">
                   <video 
                    ref={setLocalVideoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                   <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-heading">{currentUser.username} (You)</span>
                      <div className="flex items-center gap-2">
                        {isMuted && <MicOff className="w-3.5 h-3.5 text-[#0066ff]" />}
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
                  <div key={u.id} className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 aspect-video group">
                    {stream ? (
                      <video 
                        autoPlay 
                        playsInline 
                        ref={(el) => { if (el) el.srcObject = stream; }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                        <div 
                          className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-black transition-all ${
                            isPeerSpeaking ? 'ring-4 ring-[#0066ff]' : ''
                          }`}
                          style={{ backgroundColor: u.avatar_color }}
                        >
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Connecting...</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                      <span className="text-xs font-bold text-white font-heading">{u.username}</span>
                      <div className="flex items-center gap-2">
                        {u.is_muted && <MicOff className="w-3.5 h-3.5 text-zinc-500" />}
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
                  <h3 className="text-xl font-black text-white font-heading">Video Lounge</h3>
                  <p className="text-sm text-zinc-400 max-w-xs mx-auto">Start your camera to see and talk with the community.</p>
                  <button 
                    onClick={startVideo}
                    className="px-10 py-3 rounded-xl bg-[#0066ff] text-white font-black hover:bg-[#0052cc] transition-all cursor-pointer"
                  >
                    Turn on Camera
                  </button>
                </div>
              )}

              {isCameraStarting && (
                 <div className="col-span-full flex flex-col items-center justify-center py-20">
                    <RotateCw className="w-10 h-10 text-[#0066ff] animate-spin mb-4" />
                    <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Initializing Camera...</span>
                 </div>
              )}
            </div>

            {/* In-Call Controls */}
            {isInVideo && (
              <div className="h-20 bg-[#0d0d0f]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center gap-4 px-6 absolute bottom-0 inset-x-0 z-10">
                 <button 
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    isMuted ? 'bg-[#0066ff] text-white' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                   {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                 </button>
                 
                 <button 
                  onClick={stopVideo}
                  className="w-14 h-12 rounded-2xl bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-all shadow-lg shadow-red-500/20"
                >
                   <PhoneOff className="w-6 h-6" />
                 </button>

                 <button 
                  className="w-12 h-12 rounded-2xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
                >
                   <Monitor className="w-5 h-5" />
                 </button>
              </div>
            )}
          </div>
        )}

      </main>

    </div>
  );
};
