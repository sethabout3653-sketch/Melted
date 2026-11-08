import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebSocketDatabase } from '../services/wsDatabaseClient';
import { useDirectCallWebRTC } from '../services/useDirectCallWebRTC';
import { useWebRTC } from '../services/useWebRTC';

export interface ActiveCall {
  fromUserId?: string;
  fromUserName?: string;
  fromAvatarColor?: string;
  targetUserId?: string;
  targetUserName?: string;
  targetAvatarColor?: string;
  callType: 'audio' | 'video';
  status?: 'declined';
  declineMessage?: string;
}

export interface InAppNotification {
  id: string;
  sender_name: string;
  avatar_color: string;
  avatar_url?: string;
  content: string;
  timestamp: string;
  attachment_type?: string;
  attachment_name?: string;
  channel_id: string;
}

// Pure Web Audio API chime generator
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic Chime Note 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Harmonic Chime Note 2: B5 (987.77 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.08);
    gain2.gain.setValueAtTime(0.22, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.38);
  } catch {}
}

export function useGlobalChat({ 
  isChatTabActive, 
  firebaseUserId 
}: { 
  isChatTabActive: boolean;
  firebaseUserId?: string | null;
}) {
  const [currentUser, setCurrentUser] = useState(() => {
    // Clean up old/stale/corrupted localStorage keys while keeping valid ones
    try {
      const validKeys = ['frosthub_chat_user_id', 'frosthub_chat_username', 'frosthub_chat_usercolor', 'frosthub_chat_avatar_url', 'frosthub_db_messages'];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        if (key.startsWith('frosted_') || (key.startsWith('frosthub_') && !validKeys.includes(key))) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    // Priority: Firebase Auth UID > Stored Guest ID > Random New ID
    const storedId = localStorage.getItem('frosthub_chat_user_id');
    const savedId = firebaseUserId || storedId || ('u_' + Math.random().toString(36).substr(2, 6));
    
    const savedName = localStorage.getItem('frosthub_chat_username') || ('Player_' + Math.floor(100 + Math.random() * 900));
    const savedColor = localStorage.getItem('frosthub_chat_usercolor') || '#0066ff';
    let savedAvatarUrl = localStorage.getItem('frosthub_chat_avatar_url') || '';
    // Clean up any stale ephemeral /uploads/ links that were wiped during container restarts
    if (savedAvatarUrl && savedAvatarUrl.startsWith('/uploads/')) {
      savedAvatarUrl = '';
      localStorage.removeItem('frosthub_chat_avatar_url');
    }
    
    // Always persist to ensure stability across reloads
    localStorage.setItem('frosthub_chat_user_id', savedId);
    localStorage.setItem('frosthub_chat_username', savedName);
    localStorage.setItem('frosthub_chat_usercolor', savedColor);
    localStorage.setItem('frosthub_chat_avatar_url', savedAvatarUrl);
    
    return {
      id: savedId,
      username: savedName,
      avatar_color: savedColor,
      avatar_url: savedAvatarUrl,
      current_channel: 'text-general',
    };
  });

  // Sync state if firebaseUserId becomes available (user logs in)
  useEffect(() => {
    if (firebaseUserId && currentUser.id !== firebaseUserId) {
      setCurrentUser(prev => {
        const next = { ...prev, id: firebaseUserId };
        localStorage.setItem('frosthub_chat_user_id', firebaseUserId);
        return next;
      });
    }
  }, [firebaseUserId, currentUser.id]);

  const chat = useWebSocketDatabase(currentUser);
  const { 
    messages, 
    setUserCallHandler, 
    setCallAnsweredHandler, 
    setCallEndedHandler, 
    setDirectRtcSignalHandler, 
    setVoicemailNotificationHandler, 
    isConnected, 
    registerUser, 
    callUser: rawCallUser,
    answerCall: rawAnswerCall,
    endCallSignal: rawEndCallSignal,
    sendDirectRtcSignal: rawSendDirectRtcSignal,
    sendVoicemailNotification: rawSendVoicemailNotification,
    sendCallSync: rawSendCallSync,
    setCallSyncHandler,
  } = chat;

  const lastMessageId = useRef<string | null>(null);
  const registeredKeyRef = useRef<string>('');
  const pageStartTimeRef = useRef<number>(Date.now());
  const hasInitializedMessagesRef = useRef<boolean>(false);

  // Ringtone state
  const [ringtoneUrl, setRingtoneUrl] = useState(() => {
    return localStorage.getItem('frosthub_ringtone_url') || '/assets/aistudio/iphone_6_original_19117f02.mp3';
  });

  const updateRingtone = useCallback((url: string) => {
    setRingtoneUrl(url);
    localStorage.setItem('frosthub_ringtone_url', url);
  }, []);

  // Call & notification state
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<ActiveCall | null>(null);
  const [activeDirectCall, setActiveDirectCall] = useState<any>(null);
  const [peerSync, setPeerSync] = useState<{ hold?: boolean; muted?: boolean; video?: boolean }>({});

  const outgoingCallTimerRef = useRef<any>(null);
  const outgoingCallRef = useRef<ActiveCall | null>(null);
  outgoingCallRef.current = outgoingCall;
  const activeDirectCallRef = useRef<any>(null);
  activeDirectCallRef.current = activeDirectCall;

  // Auto-disconnect when leaving the app
  useEffect(() => {
    const handleUnload = () => {
      if (activeDirectCallRef.current?.peerId) {
        rawEndCallSignal(activeDirectCallRef.current.peerId);
      }
      if (outgoingCallRef.current?.targetUserId) {
        rawEndCallSignal(outgoingCallRef.current.targetUserId);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [rawEndCallSignal]);

  // Handle incoming sync signals
  useEffect(() => {
    setCallSyncHandler((fromUserId, data) => {
      setPeerSync((prev) => ({
        ...prev,
        ...(data.hold !== undefined ? { hold: Boolean(data.hold) } : {}),
        ...(data.muted !== undefined ? { muted: Boolean(data.muted) } : {}),
        ...(data.video !== undefined ? { video: Boolean(data.video) } : {}),
      }));
    });
  }, [setCallSyncHandler]);

  // Reset peer sync state when direct call terminates
  useEffect(() => {
    if (!activeDirectCall && !incomingCall && !outgoingCall) {
      setPeerSync({});
    }
  }, [activeDirectCall, incomingCall, outgoingCall]);

  // Mount dedicated 1-on-1 WebRTC Hook (Isolated from general voice channel)
  const directRtc = useDirectCallWebRTC({
    currentUserId: currentUser.id,
    activeDirectCall,
    isMuted: false,
    sendSignal: rawSendDirectRtcSignal,
    setDirectSignalHandler: setDirectRtcSignalHandler,
    onCallEnded: () => {
      setActiveDirectCall(null);
      setPeerSync({});
      chat.updateUser({
        current_channel: 'text-general',
        activity: 'Browsing Games',
      });
    },
  });

  // In-app message notification state
  const [activeNotification, setActiveNotification] = useState<InAppNotification | null>(null);

  const dismissNotification = useCallback(() => {
    setActiveNotification(null);
  }, []);

  // Sync user profile with server when user connects or profile attributes change
  useEffect(() => {
    const userKey = `${currentUser.id}:${currentUser.username}:${currentUser.avatar_color}:${currentUser.avatar_url}:${(currentUser as any).current_channel}`;
    if (isConnected && registeredKeyRef.current !== userKey) {
      registeredKeyRef.current = userKey;
      registerUser(currentUser);
    }
  }, [isConnected, currentUser.id, currentUser.username, currentUser.avatar_color, currentUser.avatar_url, (currentUser as any).current_channel, registerUser]);

  const activeRingtoneRef = useRef<HTMLAudioElement | null>(null);

  // Handle incoming call events from relay server
  useEffect(() => {
    setUserCallHandler((fromUserId, fromUserName, callType) => {
      // Ignore incoming call triggers originating from self
      if (!fromUserId || fromUserId === currentUser.id) return;

      const caller = chat.users.find(u => u.id === fromUserId);
      
      setIncomingCall({
        fromUserId,
        fromUserName,
        fromAvatarColor: caller?.avatar_color || '#0066ff',
        callType,
      });

      // Stop any existing ringtone first
      if (activeRingtoneRef.current) {
        try {
          activeRingtoneRef.current.pause();
          activeRingtoneRef.current = null;
        } catch {}
      }

      // Realistic ringtone playback
      try {
        const audio = new Audio(ringtoneUrl);
        audio.volume = 0.5;
        audio.loop = true;
        activeRingtoneRef.current = audio;
        audio.play().catch(() => {});
      } catch {}

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Incoming Call', {
          body: `${fromUserName} is calling you!`,
          icon: '/apple-touch-icon.png'
        });
      }
    });
  }, [setUserCallHandler, chat.users, currentUser.id, ringtoneUrl]);

  // Stop ringtone when incomingCall becomes null (answered or declined)
  useEffect(() => {
    if (!incomingCall && activeRingtoneRef.current) {
      try {
        activeRingtoneRef.current.pause();
        activeRingtoneRef.current = null;
      } catch {}
    }
  }, [incomingCall]);

  // Handle call answered: when callee answers, caller transitions into activeDirectCall immediately!
  useEffect(() => {
    setCallAnsweredHandler((fromUserId, fromUserName, callType) => {
      if (outgoingCallTimerRef.current) {
        clearTimeout(outgoingCallTimerRef.current);
        outgoingCallTimerRef.current = null;
      }
      setOutgoingCall(null);
      const peer = chat.users.find((u) => u.id === fromUserId);
      setActiveDirectCall({
        peerId: fromUserId,
        peerName: fromUserName || peer?.username || 'Player',
        peerAvatarColor: peer?.avatar_color || '#0066ff',
        callType: callType || 'audio',
        isInitiator: true,
        startTime: Date.now(),
      });

      chat.updateUser({
        current_channel: ('call-' + fromUserId) as any,
        activity: `In Call with ${fromUserName || 'Player'}`,
      });
    });
  }, [setCallAnsweredHandler, chat]);

  // Handle call ended by remote peer
  useEffect(() => {
    setCallEndedHandler((fromUserId) => {
      if (activeDirectCallRef.current?.peerId === fromUserId) {
        setActiveDirectCall(null);
        chat.updateUser({
          current_channel: 'text-general',
          activity: 'Browsing Games',
        });
      }
      if (incomingCall?.fromUserId === fromUserId) {
        setIncomingCall(null);
      }
  if (outgoingCallRef.current?.targetUserId === fromUserId) {
    if (outgoingCallTimerRef.current) {
      clearTimeout(outgoingCallTimerRef.current);
      outgoingCallTimerRef.current = null;
    }
    const declinedCall = outgoingCallRef.current;
    setOutgoingCall({
      ...declinedCall,
      status: 'declined',
      declineMessage: `${chat.users.find((user) => user.id === fromUserId)?.username || 'This user'} has declined`,
    });
    outgoingCallTimerRef.current = setTimeout(() => {
      setOutgoingCall(null);
      outgoingCallTimerRef.current = null;
    }, 2500);
  }
    });
  }, [setCallEndedHandler, incomingCall, chat]);

  const initiateCall = useCallback((targetUserId: string, targetUserName: string, callType: 'audio' | 'video' = 'audio') => {
    if (!targetUserId || targetUserId === currentUser.id || outgoingCall || activeDirectCall) return;
    const target = chat.users.find((user) => user.id === targetUserId);
    if (!target) return;
    const call: ActiveCall = {
      targetUserId,
      targetUserName,
      targetAvatarColor: target.avatar_color,
      callType,
    };
    setOutgoingCall(call);
    outgoingCallTimerRef.current = setTimeout(() => {
      setOutgoingCall(null);
      outgoingCallTimerRef.current = null;
    }, 30000);
    rawCallUser(targetUserId, callType);
  }, [activeDirectCall, chat.users, currentUser.id, outgoingCall, rawCallUser]);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  const dismissOutgoingCall = useCallback(() => {
    if (outgoingCallTimerRef.current) clearTimeout(outgoingCallTimerRef.current);
    setOutgoingCall(null);
  }, []);

  const acceptCall = useCallback(() => {
    if (!incomingCall?.fromUserId) return;
    const peer = chat.users.find((user) => user.id === incomingCall.fromUserId);
    rawAnswerCall(incomingCall.fromUserId, incomingCall.callType);
    setIncomingCall(null);
    setActiveDirectCall({
      peerId: incomingCall.fromUserId,
      peerName: incomingCall.fromUserName || peer?.username || 'Player',
      peerAvatarColor: incomingCall.fromAvatarColor || peer?.avatar_color,
      callType: incomingCall.callType,
      isInitiator: false,
      startTime: Date.now(),
    });
  }, [chat.users, incomingCall, rawAnswerCall]);

  const endDirectCall = useCallback(() => {
    const peerId = activeDirectCallRef.current?.peerId || incomingCall?.fromUserId || outgoingCallRef.current?.targetUserId;
    if (peerId) rawEndCallSignal(peerId);
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveDirectCall(null);
  }, [incomingCall, rawEndCallSignal]);

  // Message notifications: Only trigger for NEW messages sent during the active session!
  // Prevents historical messages sent an hour ago from triggering sounds or toasts when entering the site.
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];

    // On initial cold page load / first snapshot: mark initialized and do NOT fire notifications
    if (!hasInitializedMessagesRef.current) {
      hasInitializedMessagesRef.current = true;
      lastMessageId.current = lastMessage.id;
      return;
    }

    if (lastMessage.id !== lastMessageId.current) {
      lastMessageId.current = lastMessage.id;

      const messageCreatedAt = Number(lastMessage.created_at) || 0;
      const isCreatedDuringSession = messageCreatedAt >= pageStartTimeRef.current - 2000;
      const isFresh = (Date.now() - messageCreatedAt) < 15000;

      // Check channel type for notification targeting
      const isDmMsg = lastMessage.channel_id.startsWith('dm-') && lastMessage.channel_id.includes(currentUser.id);
      const isGeneralMsg = lastMessage.channel_id === 'text-general' || lastMessage.channel_id === 'general';

      if (isCreatedDuringSession && isFresh && lastMessage.sender_id !== currentUser.id && lastMessage.sender_name !== 'FrostHub System') {
        if (isDmMsg) {
          playNotificationSound();
          setActiveNotification({
            id: lastMessage.id,
            sender_name: lastMessage.sender_name,
            avatar_color: lastMessage.avatar_color,
            avatar_url: lastMessage.sender_avatar_url,
            content: lastMessage.content || (lastMessage.attachment_type ? `Sent an ${lastMessage.attachment_type}` : 'Sent a private message'),
            timestamp: lastMessage.timestamp,
            attachment_type: lastMessage.attachment_type,
            attachment_name: lastMessage.attachment_name,
            channel_id: lastMessage.channel_id,
          });
        } else if (isGeneralMsg && !isChatTabActive) {
          playNotificationSound();
          setActiveNotification({
            id: lastMessage.id,
            sender_name: lastMessage.sender_name,
            avatar_color: lastMessage.avatar_color,
            avatar_url: lastMessage.sender_avatar_url,
            content: lastMessage.content,
            timestamp: lastMessage.timestamp,
            attachment_type: lastMessage.attachment_type,
            attachment_name: lastMessage.attachment_name,
            channel_id: lastMessage.channel_id,
          });
        }

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && (isDmMsg || (!isChatTabActive && isGeneralMsg))) {
          new Notification(isDmMsg ? `Private Message from ${lastMessage.sender_name}` : 'New Message', {
            body: `${lastMessage.sender_name}: ${lastMessage.content || (lastMessage.attachment_type ? `Sent an ${lastMessage.attachment_type}` : 'Sent a message')}`,
            icon: '/apple-touch-icon.png'
          });
        }
      }
    }
  }, [messages, currentUser.id, isChatTabActive]);

  const [micError, setMicError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  const [micPermissionStatus, setMicPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as any }).then(status => {
        setMicPermissionStatus(status.state as any);
        status.onchange = () => setMicPermissionStatus(status.state as any);
      });
    }
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionStatus('granted');
    } catch {
      setMicPermissionStatus('denied');
    }
  }, []);
  const [isInVideo, setIsInVideo] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [activeVideoStream, setActiveVideoStream] = useState<MediaStream | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const activePeers = useMemo(() => {
    if (!isInVideo) return [];
    return chat.users.filter(u => 
      (u.current_channel === 'video-general' || u.current_channel === 'voice-general') && 
      u.id !== currentUser.id
    );
  }, [chat.users, currentUser.id, isInVideo]);

  const rtc = useWebRTC({
    currentUserId: currentUser.id,
    activeChannel: isInVideo ? 'video-general' : 'text-general',
    localAudioStream,
    cameraStream,
    screenStream,
    isMuted,
    peers: activePeers,
    sendRtcSignal: chat.sendRtcSignal,
    setRtcSignalHandler: chat.setRtcSignalHandler,
    setMediaHandlers: chat.setMediaHandlers,
  });

  // Sync isMuted to tracks
  useEffect(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(t => t.enabled = !isMuted);
    }
  }, [isMuted]);

  // Combine streams for activeVideoStream
  useEffect(() => {
    const combined = new MediaStream();
    cameraStream?.getVideoTracks().forEach(t => combined.addTrack(t));
    screenStream?.getVideoTracks().forEach(t => combined.addTrack(t));
    setActiveVideoStream(combined);
  }, [cameraStream, screenStream]);

  const joinVoiceChannel = useCallback(async (withVideo: boolean = false) => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      micStreamRef.current = audioStream;
      setLocalAudioStream(audioStream);
      setIsMuted(false);
      setIsInVideo(true);

      const nextChannel = 'video-general' as any;
      const nextActivity = 'In General Voice';
      
      setCurrentUser(prev => ({ 
        ...prev, 
        current_channel: nextChannel,
        activity: nextActivity
      }));

      if (withVideo) {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } },
          audio: false
        });
        cameraStreamRef.current = videoStream;
        setCameraStream(videoStream);
        setIsVideoEnabled(true);
      }

      chat.updateUser({
        current_channel: nextChannel,
        activity: nextActivity,
        has_video: withVideo,
      });
    } catch (err) {
      console.error('Failed to join voice:', err);
    }
  }, [chat]);

  const stopVoiceChannel = useCallback(() => {
    [micStreamRef, cameraStreamRef, screenStreamRef].forEach(ref => {
      if (ref.current) {
        ref.current.getTracks().forEach(t => {
          t.enabled = false;
          t.stop();
        });
        ref.current = null;
      }
    });
    cameraStream?.getTracks().forEach(t => {
      t.enabled = false;
      t.stop();
    });
    localAudioStream?.getTracks().forEach(t => {
      t.enabled = false;
      t.stop();
    });
    screenStream?.getTracks().forEach(t => {
      t.enabled = false;
      t.stop();
    });
    setLocalAudioStream(null);
    setCameraStream(null);
    setScreenStream(null);
    setIsInVideo(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    
    const nextChannel = 'text-general' as any;
    const nextActivity = 'Browsing Games';

    setCurrentUser(prev => ({ 
      ...prev, 
      current_channel: nextChannel,
      activity: nextActivity,
      has_video: false,
      is_screen_sharing: false,
    }));

    chat.updateUser({
      current_channel: nextChannel,
      activity: nextActivity,
      has_video: false,
      is_screen_sharing: false,
    });
  }, [chat, cameraStream, localAudioStream, screenStream]);

  const toggleCamera = useCallback(async () => {
    if (isVideoEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => {
          t.enabled = false;
          t.stop();
        });
        cameraStreamRef.current = null;
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => {
          t.enabled = false;
          t.stop();
        });
      }
      setCameraStream(null);
      setIsVideoEnabled(false);
      setCurrentUser(prev => ({ ...prev, has_video: false }));
      chat.updateUser({ has_video: false });
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } },
          audio: false
        });
        cameraStreamRef.current = stream;
        setCameraStream(stream);
        setIsVideoEnabled(true);
        setCurrentUser(prev => ({ ...prev, has_video: true }));
        chat.updateUser({ has_video: true });
      } catch (err) {
        console.error('Failed to toggle camera:', err);
      }
    }
  }, [isVideoEnabled, cameraStream, chat]);

  const isSharingRef = useRef(false);

  const toggleScreenShare = useCallback(async () => {
    if (isSharingRef.current) return;
    isSharingRef.current = true;

    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
        }
        setScreenStream(null);
        setIsScreenSharing(false);
        chat.updateUser({ is_screen_sharing: false });
      } else {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 60, max: 60 },
            },
            audio: true,
          });
          screenStreamRef.current = stream;
          setScreenStream(stream);
          setIsScreenSharing(true);
          chat.updateUser({ is_screen_sharing: true });
          stream.getTracks().forEach(track => {
            track.onended = () => {
              if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(t => t.stop());
                screenStreamRef.current = null;
              }
              setScreenStream(null);
              setIsScreenSharing(false);
              chat.updateUser({ is_screen_sharing: false });
            };
          });
        } catch (err: any) {
          if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
            console.error('Failed to toggle screen share:', err);
          }
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
          }
          setScreenStream(null);
          setIsScreenSharing(false);
          chat.updateUser({ is_screen_sharing: false });
        }
      }
    } finally {
      isSharingRef.current = false;
    }
  }, [isScreenSharing, chat]);

  return {
    currentUser,
    setCurrentUser,
    incomingCall,
    outgoingCall,
    activeDirectCall,
    activeNotification,
    dismissNotification,
    initiateCall,
    acceptCall,
    endDirectCall,
    dismissIncomingCall,
    dismissOutgoingCall,
    directRtc,
    peerSync,
    ringtoneUrl,
    updateRingtone,
    
    // Voice/Video Shared States
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
    micError,
    cameraError,
    screenShareError,
    setMicError,
    setCameraError,
    setScreenShareError,
    micPermissionStatus,
    requestMicrophonePermission,
    ...rtc,
    joinVoiceChannel,
    stopVoiceChannel,
    toggleCamera,
    toggleScreenShare,
    
    ...chat,
  };
}
