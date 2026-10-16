import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocketDatabase } from '../services/wsDatabaseClient';

export interface ActiveCall {
  fromUserId?: string;
  fromUserName?: string;
  targetUserId?: string;
  targetUserName?: string;
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

export function useGlobalChat({ isChatTabActive }: { isChatTabActive: boolean }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedId = localStorage.getItem('frosted_chat_user_id') || ('u_' + Math.random().toString(36).substr(2, 6));
    const savedName = localStorage.getItem('frosted_chat_username') || ('Player_' + Math.floor(100 + Math.random() * 900));
    const savedColor = localStorage.getItem('frosted_chat_usercolor') || '#0066ff';
    const savedAvatarUrl = localStorage.getItem('frosted_chat_avatar_url') || '';
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

  const chat = useWebSocketDatabase(currentUser);
  const { messages, setUserCallHandler, isConnected, registerUser, callUser: rawCallUser } = chat;

  const lastMessageId = useRef<string | null>(null);
  const registeredKeyRef = useRef<string>('');
  const pageStartTimeRef = useRef<number>(Date.now());
  const hasInitializedMessagesRef = useRef<boolean>(false);

  // Call state
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<ActiveCall | null>(null);

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
      setIncomingCall({
        fromUserId,
        fromUserName,
        callType,
      });

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Incoming Call', {
          body: `${fromUserName} is calling you for a ${callType} chat!`,
          icon: '/apple-touch-icon.png'
        });
      }
    });
  }, [setUserCallHandler]);

  const initiateCall = useCallback((targetUserId: string, targetUserName: string, callType: 'audio' | 'video') => {
    setOutgoingCall({
      targetUserId,
      targetUserName,
      callType,
    });
    rawCallUser(targetUserId, callType);
  }, [rawCallUser]);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  const dismissOutgoingCall = useCallback(() => {
    setOutgoingCall(null);
  }, []);

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
    dismissIncomingCall,
    dismissOutgoingCall,
    ...chat,
  };
}
