import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocketDatabase } from '../services/wsDatabaseClient';

export interface ActiveCall {
  fromUserId?: string;
  fromUserName?: string;
  targetUserId?: string;
  targetUserName?: string;
  callType: 'audio' | 'video';
}

export function useGlobalChat() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedId = localStorage.getItem('frosted_chat_user_id') || ('u_' + Math.random().toString(36).substr(2, 6));
    const savedName = localStorage.getItem('frosted_chat_username') || ('Player_' + Math.floor(100 + Math.random() * 900));
    const savedColor = localStorage.getItem('frosted_chat_usercolor') || '#0066ff';
    localStorage.setItem('frosted_chat_user_id', savedId);
    localStorage.setItem('frosted_chat_username', savedName);
    localStorage.setItem('frosted_chat_usercolor', savedColor);
    return {
      id: savedId,
      username: savedName,
      avatar_color: savedColor,
    };
  });

  const chat = useWebSocketDatabase(currentUser);
  const { messages, setUserCallHandler, isConnected, registerUser, callUser: rawCallUser } = chat;

  const lastMessageId = useRef<string | null>(null);
  const registeredKeyRef = useRef<string>('');

  // Call state
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<ActiveCall | null>(null);

  // Sync user profile with server when user connects or profile attributes change (prevents infinite loop!)
  useEffect(() => {
    const userKey = `${currentUser.id}:${currentUser.username}:${currentUser.avatar_color}`;
    if (isConnected && registeredKeyRef.current !== userKey) {
      registeredKeyRef.current = userKey;
      registerUser(currentUser);
    }
  }, [isConnected, currentUser.id, currentUser.username, currentUser.avatar_color, registerUser]);

  // Handle incoming call events from relay server
  useEffect(() => {
    setUserCallHandler((fromUserId, fromUserName, callType) => {
      setIncomingCall({
        fromUserId,
        fromUserName,
        callType,
      });

      // Subtle incoming call sound
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

  // Message notifications
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.id !== lastMessageId.current) {
      lastMessageId.current = lastMessage.id;
      
      if (lastMessage.sender_id !== currentUser.id) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
          audio.volume = 0.4;
          audio.play().catch(() => {});
        } catch {}

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('New Message', {
            body: `${lastMessage.sender_name}: ${lastMessage.content}`,
            icon: '/apple-touch-icon.png'
          });
        }
      }
    }
  }, [messages, currentUser.id]);

  return {
    currentUser,
    setCurrentUser,
    incomingCall,
    outgoingCall,
    initiateCall,
    dismissIncomingCall,
    dismissOutgoingCall,
    ...chat,
  };
}
