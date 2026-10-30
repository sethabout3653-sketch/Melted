import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocketDatabase } from '../services/wsDatabaseClient';

export interface ActiveCall {
  fromUserId?: string;
  fromUserName?: string;
  fromAvatarColor?: string;
  targetUserId?: string;
  targetUserName?: string;
  targetAvatarColor?: string;
  callType: 'audio' | 'video';
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
      const validKeys = ['frosted_chat_user_id', 'frosted_chat_username', 'frosted_chat_usercolor', 'frosted_chat_avatar_url', 'frosted_db_messages'];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        if (key.startsWith('frosted_') && !validKeys.includes(key)) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    // Priority: Firebase Auth UID > Stored Guest ID > Random New ID
    const storedId = localStorage.getItem('frosted_chat_user_id');
    const savedId = firebaseUserId || storedId || ('u_' + Math.random().toString(36).substr(2, 6));
    
    const savedName = localStorage.getItem('frosted_chat_username') || ('Player_' + Math.floor(100 + Math.random() * 900));
    const savedColor = localStorage.getItem('frosted_chat_usercolor') || '#0066ff';
    const savedAvatarUrl = localStorage.getItem('frosted_chat_avatar_url') || '';
    
    // Always persist to ensure stability across reloads
    localStorage.setItem('frosted_chat_user_id', savedId);
    localStorage.setItem('frosted_chat_username', savedName);
    localStorage.setItem('frosted_chat_usercolor', savedColor);
    localStorage.setItem('frosted_chat_avatar_url', savedAvatarUrl);
    
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
        localStorage.setItem('frosted_chat_user_id', firebaseUserId);
        return next;
      });
    }
  }, [firebaseUserId, currentUser.id]);

  const chat = useWebSocketDatabase(currentUser);
  const { messages, setUserCallHandler, isConnected, registerUser, callUser: rawCallUser } = chat;

  const lastMessageId = useRef<string | null>(null);
  const registeredKeyRef = useRef<string>('');
  const pageStartTimeRef = useRef<number>(Date.now());
  const hasInitializedMessagesRef = useRef<boolean>(false);

  // Call state
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<ActiveCall | null>(null);
  const [isVoicemail, setIsVoicemail] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const outgoingCallTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // Handle incoming call events from relay server
  useEffect(() => {
    setUserCallHandler((fromUserId, fromUserName, callType) => {
      // Find the user in the local users list to get their avatar color
      const caller = chat.users.find(u => u.id === fromUserId);
      
      setIncomingCall({
        fromUserId,
        fromUserName,
        fromAvatarColor: caller?.avatar_color || '#0066ff',
        callType,
      });

      // Realistic Verizon-style Ringtone loop
      const playRingtone = () => {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {
            // If autoplay is blocked, we'll rely on the PhoneCallOverlay's user interaction
            console.log('Incoming call ringtone blocked by browser');
          });
        } catch (err) {
          console.warn('Failed to play ringtone:', err);
        }
      };

      playRingtone();

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Incoming Call', {
          body: `${fromUserName} is calling you!`,
          icon: '/apple-touch-icon.png'
        });
      }
    });
  }, [setUserCallHandler, chat.users]);

  const initiateCall = useCallback((targetUserId: string, targetUserName: string, callType: 'audio' | 'video') => {
    const targetUser = chat.users.find(u => u.id === targetUserId);
    setOutgoingCall({
      targetUserId,
      targetUserName,
      targetAvatarColor: targetUser?.avatar_color || '#0066ff',
      callType,
    });
    setIsVoicemail(false);
    setIsRecording(false);
    rawCallUser(targetUserId, callType);

    // 20 second timeout for voicemail
    if (outgoingCallTimerRef.current) clearTimeout(outgoingCallTimerRef.current);
    outgoingCallTimerRef.current = setTimeout(() => {
      startVoicemailFlow();
    }, 20000);
  }, [rawCallUser, chat.users]);

  // Voicemail Flow
  const startVoicemailFlow = async () => {
    setIsVoicemail(true);
    try {
      // 1. Fetch TTS Prompt
      const res = await fetch('/api/voicemail/prompt');
      const data = await res.json();
      if (data.success && data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        await audio.play();
        
        // 2. Play "Tone" (beep)
        await new Promise(resolve => setTimeout(resolve, audio.duration * 1000 + 500));
        playBeep();
        
        // 3. Start Recording
        startRecording();
      }
    } catch (err) {
      console.error('Voicemail flow error:', err);
      // Fallback: just start recording
      playBeep();
      startRecording();
    }
  };

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          // Send as chat message
          chat.insertMessage(`[Voicemail Message]`, 'text-general', {
            url: base64,
            type: 'audio',
            name: `Voicemail from ${currentUser.username}.webm`
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const [callAccepted, setCallAccepted] = useState(false);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
    setCallAccepted(false);
  }, []);

  const dismissOutgoingCall = useCallback(() => {
    if (outgoingCallTimerRef.current) clearTimeout(outgoingCallTimerRef.current);
    if (isRecording) stopRecording();
    setOutgoingCall(null);
    setIsVoicemail(false);
    setIsRecording(false);
  }, [isRecording]);

  const acceptCall = useCallback(() => {
    setCallAccepted(true);
  }, []);

  // Auto-clear outgoing call timer if target user joins voice
  useEffect(() => {
    if (outgoingCall && !isVoicemail) {
      const target = chat.users.find(u => u.id === outgoingCall.targetUserId);
      if (target && target.current_channel === 'video-general') {
        // Peer answered!
        dismissOutgoingCall();
      }
    }
  }, [chat.users, outgoingCall, isVoicemail, dismissOutgoingCall]);

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

      // Only notify if message was newly created in real-time, not sent an hour ago, and user isn't in chat
      if (
        isCreatedDuringSession &&
        isFresh &&
        !isChatTabActive &&
        lastMessage.sender_id !== currentUser.id &&
        lastMessage.sender_name !== 'Frosted System'
      ) {
        // Play instant Web Audio API chime
        playNotificationSound();

        // Trigger in-app notification UI visible across all pages & game view
        setActiveNotification({
          id: lastMessage.id,
          sender_name: lastMessage.sender_name,
          avatar_color: lastMessage.avatar_color,
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          attachment_type: lastMessage.attachment_type,
          attachment_name: lastMessage.attachment_name,
          channel_id: lastMessage.channel_id,
        });

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('New Message', {
            body: `${lastMessage.sender_name}: ${lastMessage.content || (lastMessage.attachment_type ? `Sent an ${lastMessage.attachment_type}` : 'Sent a file')}`,
            icon: '/apple-touch-icon.png'
          });
        }
      }
    }
  }, [messages, currentUser.id, isChatTabActive]);

  return {
    currentUser,
    setCurrentUser,
    incomingCall,
    outgoingCall,
    activeNotification,
    dismissNotification,
    initiateCall,
    acceptCall,
    callAccepted,
    isVoicemail,
    isRecording,
    dismissIncomingCall,
    dismissOutgoingCall,
    ...chat,
  };
}
