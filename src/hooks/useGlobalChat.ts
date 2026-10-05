import { useState, useEffect, useRef } from 'react';
import { useWebSocketDatabase } from '../services/wsDatabaseClient';

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
  const { messages, setUserCallHandler } = chat;

  const lastMessageId = useRef<string | null>(null);

  useEffect(() => {
    if (isConnected && currentUser) {
      registerUser(currentUser);
    }
  }, [isConnected, currentUser, registerUser]);

  useEffect(() => {
    setUserCallHandler((fromUserId, fromUserName, callType) => {
      // Incoming Call Notification
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3'); 
      audio.play().catch(() => {});

      if (Notification.permission === 'granted') {
        new Notification('Incoming Call', {
          body: `${fromUserName} is calling you for a ${callType} chat!`,
          icon: '/apple-touch-icon.png'
        });
      }
    });
  }, [setUserCallHandler]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.id !== lastMessageId.current) {
      lastMessageId.current = lastMessage.id;
      
      if (lastMessage.sender_id !== currentUser.id) {
        // Notification Sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.play().catch(() => {});

        // Browser Notification
        if (Notification.permission === 'granted') {
          new Notification('New Message', {
            body: `${lastMessage.sender_name}: ${lastMessage.content}`,
            icon: '/apple-touch-icon.png'
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
    }
  }, [messages, currentUser.id]);

  return {
    currentUser,
    setCurrentUser,
    ...chat
  };
}
