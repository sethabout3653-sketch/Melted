import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebSocketDatabase } from '../services/wsDatabaseClient';
import { useWebRTC } from '../services/useWebRTC';
import { auth, db } from '../services/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';

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
    // Clean up legacy frosted_ keys without touching saved favorites, game saves, or Scramjet cookies
    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        if (key.startsWith('frosted_')) {
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
    if (firebaseUserId) {
      setCurrentUser(prev => {
        if (prev.id === firebaseUserId) return prev;
        const next = { ...prev, id: firebaseUserId };
        localStorage.setItem('frosthub_chat_user_id', firebaseUserId);
        return next;
      });
    }
  }, [firebaseUserId]);

  const hasAttemptedAnonAuth = useRef(false);

  // Firebase Auth & Connection Guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user && !hasAttemptedAnonAuth.current) {
        hasAttemptedAnonAuth.current = true;
        try {
          await signInAnonymously(auth);
        } catch (err) {
          // If anonymous auth is not enabled in Firebase project, log gracefully without repeating
          console.info('[Firebase] Anonymous sign-in skipped or disabled (auth/admin-restricted-operation). App is fully operational via WebSocket/local mode.');
        }
      } else if (user) {
        // Test connection as required by security skill
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
        } catch (error: any) {
          if (error?.message?.includes('offline')) {
            console.error("Firebase is offline. Falling back to WebSocket.");
          }
        }
      }
    });
    return () => unsub();
  }, []);

  const chat = useWebSocketDatabase(currentUser);
  const { 
    messages,
    isConnected,
    registerUser,
    updateUser,
    sendRtcSignal,
    setRtcSignalHandler,
    setMediaHandlers,
  } = chat;
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;

  const lastMessageId = useRef<string | null>(null);
  const registeredKeyRef = useRef<string>('');
  const pageStartTimeRef = useRef<number>(Date.now());
  const hasInitializedMessagesRef = useRef<boolean>(false);

  // Call & notification state
  const [activeChannel, setActiveChannel] = useState<string>('text-general');
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = stream;
      setLocalAudioStream(stream);
      setMicPermissionStatus('granted');
      setMicError(null);
      setIsMuted(false);
    } catch (error) {
      setMicPermissionStatus('denied');
      setMicError(error instanceof Error ? error.message : 'Microphone permission was denied.');
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

  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSpeakingRef = useRef(false);

  const activePeers = useMemo(() => {
    if (!isInVideo && activeChannel !== 'video-general') return [];
    return chat.users.filter(u => 
      (u.current_channel === 'video-general' || u.current_channel === 'voice-general') && 
      u.id !== currentUser.id
    );
  }, [chat.users, currentUser.id, isInVideo, activeChannel]);

  const rtc = useWebRTC({
    currentUserId: currentUser.id,
    activeChannel: (isInVideo || activeChannel === 'video-general') ? 'video-general' : 'text-general',
    localAudioStream,
    cameraStream,
    screenStream,
    isMuted,
    peers: activePeers,
    sendRtcSignal,
    setRtcSignalHandler,
    setMediaHandlers,
  });

  // Sync isMuted and isDeafened to tracks and server without re-running on unrelated chat state ticks
  useEffect(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(t => t.enabled = !isMuted);
    }
    if (isInVideo) {
      updateUserRef.current({ is_muted: isMuted });
    }
  }, [isMuted, isInVideo]);

  useEffect(() => {
    if (isInVideo) {
      updateUserRef.current({ is_deafened: isDeafened });
    }
  }, [isDeafened, isInVideo]);

  // Real-time Voice Activity Detection (Speaking detection)
  useEffect(() => {
    if (!localAudioStream || isMuted || isDeafened || !isInVideo) {
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        updateUserRef.current({ is_speaking: false });
      }
      return;
    }

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animId: number | null = null;
    let silenceTimer: any = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source = audioCtx.createMediaStreamSource(localAudioStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const nowSpeaking = avg > 14;

        if (nowSpeaking) {
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            updateUserRef.current({ is_speaking: true });
          }
        } else if (isSpeakingRef.current && !silenceTimer) {
          silenceTimer = setTimeout(() => {
            if (isSpeakingRef.current) {
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              updateUserRef.current({ is_speaking: false });
            }
            silenceTimer = null;
          }, 350);
        }

        animId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('[useGlobalChat] VAD setup warning:', err);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (source) { try { source.disconnect(); } catch {} }
      if (analyser) { try { analyser.disconnect(); } catch {} }
      if (audioCtx && audioCtx.state !== 'closed') { try { audioCtx.close(); } catch {} }
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        updateUserRef.current({ is_speaking: false });
      }
    };
  }, [localAudioStream, isMuted, isDeafened, isInVideo]);

  // Combine streams for activeVideoStream
  useEffect(() => {
    const combined = new MediaStream();
    cameraStream?.getVideoTracks().forEach(t => combined.addTrack(t));
    screenStream?.getVideoTracks().forEach(t => combined.addTrack(t));
    setActiveVideoStream(combined);
  }, [cameraStream, screenStream]);

  const isJoiningVoiceRef = useRef(false);
  const isInVideoRef = useRef(isInVideo);
  isInVideoRef.current = isInVideo;

  const joinVoiceChannel = useCallback(async (withVideo: boolean = false) => {
    if (isJoiningVoiceRef.current || isInVideoRef.current) return;
    isJoiningVoiceRef.current = true;
    try {
      let audioStream: MediaStream | null = null;
      let micGranted = false;
      setMicError(null);

      try {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        micGranted = true;
        setMicPermissionStatus('granted');
        setIsMuted(false);
      } catch (micErr) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          micGranted = true;
          setMicPermissionStatus('granted');
          setIsMuted(false);
        } catch (retryError) {
          console.warn('[useGlobalChat] Microphone capture failed:', retryError || micErr);
          setMicError(retryError instanceof Error ? retryError.message : 'Microphone access was denied or no microphone is available.');
          setIsMuted(true);
          setMicPermissionStatus('denied');
        }
      }

      if (micStreamRef.current && micStreamRef.current !== audioStream) {
        micStreamRef.current.getTracks().forEach((t) => {
          t.onended = null;
          t.enabled = false;
          t.stop();
        });
      }
      micStreamRef.current = audioStream;
      setLocalAudioStream(audioStream);
      isInVideoRef.current = true;
      setIsInVideo(true);

      const nextChannel = 'video-general' as const;
      const nextActivity = 'In General Voice';

      setCurrentUser(prev => ({
        ...prev,
        current_channel: nextChannel,
        activity: nextActivity
      }));

      if (withVideo) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } },
            audio: false,
          });
          cameraStreamRef.current = videoStream;
          setCameraStream(videoStream);
          setIsVideoEnabled(true);
          setCameraError(null);
          const camTrack = videoStream.getVideoTracks()[0];
          if (camTrack) {
            camTrack.onended = () => {
              cameraStreamRef.current?.getTracks().forEach((track) => {
                track.onended = null;
                track.enabled = false;
                track.stop();
              });
              cameraStreamRef.current = null;
              setCameraStream(null);
              setIsVideoEnabled(false);
              setCurrentUser((prev) => ({ ...prev, has_video: false }));
              updateUserRef.current({ has_video: false });
            };
          }
        } catch (camErr) {
          setCameraError(camErr instanceof Error ? camErr.message : 'Camera access was denied or no camera is available.');
          console.warn('[useGlobalChat] Camera error:', camErr);
        }
      }

      updateUserRef.current({
        current_channel: nextChannel,
        activity: nextActivity,
        has_video: withVideo && Boolean(cameraStreamRef.current),
        is_muted: !micGranted,
      });
    } finally {
      isJoiningVoiceRef.current = false;
    }
  }, []);

  const stopVoiceChannel = useCallback(() => {
    [micStreamRef, cameraStreamRef, screenStreamRef].forEach(ref => {
      if (ref.current) {
        ref.current.getTracks().forEach(t => {
          t.onended = null;
          t.enabled = false;
          t.stop();
        });
        ref.current = null;
      }
    });
    cameraStream?.getTracks().forEach(t => {
      t.onended = null;
      t.enabled = false;
      t.stop();
    });
    localAudioStream?.getTracks().forEach(t => {
      t.onended = null;
      t.enabled = false;
      t.stop();
    });
    screenStream?.getTracks().forEach(t => {
      t.onended = null;
      t.enabled = false;
      t.stop();
    });
    isJoiningVoiceRef.current = false;
    isInVideoRef.current = false;
    setLocalAudioStream(null);
    setCameraStream(null);
    setScreenStream(null);
    setIsInVideo(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setCameraError(null);
    setScreenShareError(null);

    const nextChannel = 'text-general' as any;
    const nextActivity = 'Browsing Games';

    setCurrentUser(prev => ({
      ...prev,
      current_channel: nextChannel,
      activity: nextActivity,
      has_video: false,
      is_screen_sharing: false,
    }));

    updateUserRef.current({
      current_channel: nextChannel,
      activity: nextActivity,
      has_video: false,
      is_screen_sharing: false,
    });
  }, [cameraStream, localAudioStream, screenStream]);

  const presenceChannel = (currentUser as any).current_channel;
  useEffect(() => {
    if (isInVideo && presenceChannel !== 'video-general') {
      setCurrentUser(prev => ({ ...prev, current_channel: 'video-general' }));
      updateUserRef.current({ current_channel: 'video-general' });
    }
  }, [isInVideo, presenceChannel]);

  const toggleCamera = useCallback(async () => {
    if (isVideoEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => {
          t.onended = null;
          t.enabled = false;
          t.stop();
        });
        cameraStreamRef.current = null;
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => {
          t.onended = null;
          t.enabled = false;
          t.stop();
        });
      }
      setCameraStream(null);
      setIsVideoEnabled(false);
      setCameraError(null);
      setCurrentUser(prev => ({ ...prev, has_video: false }));
      updateUserRef.current({ has_video: false });
    } else {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60, max: 60 } },
          audio: false,
        });
        cameraStreamRef.current = stream;
        setCameraStream(stream);
        setIsVideoEnabled(true);
        setCurrentUser(prev => ({ ...prev, has_video: true }));
        updateUserRef.current({ has_video: true });
        const camTrack = stream.getVideoTracks()[0];
        if (camTrack) {
          camTrack.onended = () => {
            cameraStreamRef.current?.getTracks().forEach((track) => {
              track.onended = null;
              track.enabled = false;
              track.stop();
            });
            cameraStreamRef.current = null;
            setCameraStream(null);
            setIsVideoEnabled(false);
            setCurrentUser((prev) => ({ ...prev, has_video: false }));
            updateUserRef.current({ has_video: false });
          };
        }
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : 'Camera access was denied or no camera is available.');
        console.error('Failed to toggle camera:', err);
      }
    }
  }, [isVideoEnabled, cameraStream]);

  const isSharingRef = useRef(false);

  const toggleScreenShare = useCallback(async () => {
    if (isSharingRef.current) return;
    isSharingRef.current = true;

    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => {
            t.onended = null;
            t.enabled = false;
            t.stop();
          });
          screenStreamRef.current = null;
        }
        if (screenStream) {
          screenStream.getTracks().forEach(t => {
            t.onended = null;
            t.enabled = false;
            t.stop();
          });
        }
        setScreenStream(null);
        setIsScreenSharing(false);
        setScreenShareError(null);
        setCurrentUser(prev => ({ ...prev, is_screen_sharing: false }));
        updateUserRef.current({ is_screen_sharing: false });
      } else {
        setScreenShareError(null);
        try {
          if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('Screen sharing is not supported by this browser.');
          }
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30, max: 60 },
            },
            audio: true,
            systemAudio: 'include',
          } as DisplayMediaStreamOptions & { systemAudio: 'include' });
          screenStreamRef.current = stream;
          setScreenStream(stream);
          setIsScreenSharing(true);
          setCurrentUser(prev => ({ ...prev, is_screen_sharing: true }));
          updateUserRef.current({ is_screen_sharing: true });
          const screenVideoTrack = stream.getVideoTracks()[0];
          if (screenVideoTrack) {
            screenVideoTrack.onended = () => {
              screenStreamRef.current?.getTracks().forEach(track => {
                track.onended = null;
                track.enabled = false;
                track.stop();
              });
              screenStreamRef.current = null;
              setScreenStream(null);
              setIsScreenSharing(false);
              setScreenShareError(null);
              setCurrentUser(prev => ({ ...prev, is_screen_sharing: false }));
              updateUserRef.current({ is_screen_sharing: false });
            };
          }
          if (stream.getAudioTracks().length === 0) {
            setScreenShareError('Your browser did not capture tab/system audio. Choose a browser tab and enable “Share tab audio” in the share picker.');
          }
        } catch (err: any) {
          const message = err instanceof Error ? err.message : 'Screen share could not start.';
          if (err?.name !== 'NotAllowedError' && err?.name !== 'AbortError') {
            console.error('Failed to toggle screen share:', err);
            setScreenShareError(message);
          }
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => {
              track.onended = null;
              track.enabled = false;
              track.stop();
            });
            screenStreamRef.current = null;
          }
          setScreenStream(null);
          setIsScreenSharing(false);
          setCurrentUser(prev => ({ ...prev, is_screen_sharing: false }));
          updateUserRef.current({ is_screen_sharing: false });
        }
      }
    } finally {
      isSharingRef.current = false;
    }
  }, [isScreenSharing, screenStream]);

  return {
    currentUser,
    setCurrentUser,
    activeNotification,
    dismissNotification,
    
    // Voice/Video Shared States
    isInVideo,
    isVideoEnabled,
    isScreenSharing,
    isSpeaking,
    is_speaking: isSpeaking,
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
    
    activeChannel,
    setActiveChannel,
    ...chat,
  };
}
