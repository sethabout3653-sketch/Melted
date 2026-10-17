import { useState, useEffect, useRef, useCallback } from 'react';
import { DbUser, DbMessage } from '../server/wsDatabase';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

export interface RtcSignalPayload {
  fromUserId: string;
  targetUserId: string;
  signal: any;
}

export function useWebSocketDatabase(currentUser: { 
  id: string; 
  username: string; 
  avatar_color: string; 
  avatar_url?: string; 
  current_channel?: string;
  activity?: string;
}) {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>(() => {
    try {
      const saved = localStorage.getItem('frosted_db_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const onRtcSignalRef = useRef<((fromUserId: string, signal: any) => void) | null>(null);
  const onUserCallRef = useRef<((fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) | null>(null);
  const onUserJoinedMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);
  const onUserLeftMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);

  const setRtcSignalHandler = useCallback((fn: (fromUserId: string, signal: any) => void) => {
    onRtcSignalRef.current = fn;
  }, []);

  const setUserCallHandler = useCallback((fn: (fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) => {
    onUserCallRef.current = fn;
  }, []);

  const setMediaHandlers = useCallback((
    onJoined: (userId: string, channel: string) => void,
    onLeft: (userId: string, channel: string) => void
  ) => {
    onUserJoinedMediaRef.current = onJoined;
    onUserLeftMediaRef.current = onLeft;
  }, []);

  // Multi-tab BroadcastChannel for instant inter-tab communication in same browser
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('frosted_ws_channel');
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'SYNC_USERS' && Array.isArray(data.users)) {
          setUsers(data.users);
        } else if (data.type === 'SYNC_MESSAGES' && Array.isArray(data.messages)) {
          setMessages(data.messages);
        } else if (data.type === 'RTC_SIGNAL' && data.targetUserId === currentUserRef.current.id) {
          if (onRtcSignalRef.current) {
            onRtcSignalRef.current(data.fromUserId, data.signal);
          }
        }
      };
    } catch {}

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  // Save messages to local cache
  useEffect(() => {
    try {
      localStorage.setItem('frosted_db_messages', JSON.stringify(messages.slice(-200)));
    } catch {}
  }, [messages]);

  // Firestore Real-Time Sync (Guaranteed working on Vercel, Render, Netlify, and all platforms)
  useEffect(() => {
    try {
      // 1. Messages Real-Time Listener
      const messagesQuery = query(collection(db, 'messages'), orderBy('created_at', 'asc'), limit(150));
      const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        setIsConnected(true);
        const cloudMessages: DbMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as DbMessage;
          if (data && data.id) {
            cloudMessages.push(data);
          }
        });
        if (cloudMessages.length > 0) {
          setMessages(cloudMessages);
        }
      }, (err) => {
        console.warn('Firestore messages snapshot warning:', err);
      });

      // 2. Users / Presence Real-Time Listener
      const usersQuery = query(collection(db, 'users'), limit(50));
      const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        setIsConnected(true);
        const cloudUsers: DbUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as DbUser;
          if (data && data.id) {
            cloudUsers.push(data);
          }
        });
        if (cloudUsers.length > 0) {
          setUsers(cloudUsers);
        }
      }, (err) => {
        console.warn('Firestore users snapshot warning:', err);
      });

      return () => {
        unsubscribeMessages();
        unsubscribeUsers();
      };
    } catch (e) {
      console.warn('Firestore real-time sync init error:', e);
    }
  }, []);

  // WebSocket Connection (Optional local fallback for AI Studio dev server)
  const startHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 15000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-db`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        startHeartbeat();

        const u = currentUserRef.current;
        ws.send(JSON.stringify({
          type: 'REGISTER_USER',
          user: {
            id: u.id,
            username: u.username,
            avatar_color: u.avatar_color,
            avatar_url: u.avatar_url || '',
            activity: u.activity || '',
            current_channel: u.current_channel || 'text-general',
            is_speaking: false,
            is_muted: false,
            is_deafened: false,
            has_video: false,
            is_screen_sharing: false,
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'PING') {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            }
            return;
          }
          if (msg.type === 'PONG') return;

          if (msg.type === 'RTC_SIGNAL') {
            if (onRtcSignalRef.current) {
              onRtcSignalRef.current(msg.fromUserId, msg.signal);
            }
          } else if (msg.type === 'USER_CALL') {
            if (onUserCallRef.current) {
              onUserCallRef.current(msg.fromUserId, msg.fromUserName, msg.callType);
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        stopHeartbeat();
        wsRef.current = null;
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch {}
  }, [startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    connectWs();
    return () => {
      stopHeartbeat();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [connectWs, stopHeartbeat]);

  // Update user in Firestore & WS
  const updateUser = useCallback(async (set: Partial<DbUser>) => {
    const u = currentUserRef.current;
    Object.assign(currentUserRef.current, set);

    const updatedUserDoc: DbUser = {
      id: u.id,
      username: u.username,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url || '',
      current_channel: (u.current_channel || 'text-general') as any,
      is_speaking: false,
      is_muted: false,
      is_deafened: false,
      has_video: false,
      is_screen_sharing: false,
      activity: u.activity || '',
      updated_at: Date.now(),
      ...set,
    };

    // Save to Firestore (works on Vercel, Render, etc.)
    try {
      await setDoc(doc(db, 'users', u.id), updatedUserDoc, { merge: true });
    } catch (err) {
      console.warn('Firestore update user error:', err);
    }

    setUsers((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const next = safePrev.map((user) => (user.id === u.id ? updatedUserDoc : user));
      if (!next.some(x => x.id === u.id)) next.push(updatedUserDoc);
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: next });
      return next;
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'SQL_UPDATE',
          table: 'users',
          id: u.id,
          set,
        }));
      } catch {}
    }
  }, []);

  // Insert Message into Firestore & WS
  const insertMessage = useCallback(async (content: string, channelId: string = 'text-general', attachment?: { url: string; type: string; name?: string }) => {
    if (!content.trim() && !attachment) return;
    const u = currentUserRef.current;
    const newMsg: DbMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      channel_id: channelId,
      sender_id: u.id,
      sender_name: u.username,
      avatar_color: u.avatar_color,
      sender_avatar_url: u.avatar_url || '',
      content: content.trim(),
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
      attachment_name: attachment?.name,
      timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: Date.now(),
    };

    // Optimistic local update
    setMessages((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (safePrev.some(m => m.id === newMsg.id)) return safePrev;
      const next = [...safePrev, newMsg];
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: next });
      return next;
    });

    // Save to Firestore (works on Vercel, Render, etc.)
    try {
      await setDoc(doc(db, 'messages', newMsg.id), newMsg);
    } catch (err) {
      console.warn('Firestore insert message error:', err);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'SQL_INSERT',
          table: 'messages',
          row: newMsg,
        }));
      } catch {}
    }
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    setMessages((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const next = safePrev.filter((m) => m && m.id !== messageId);
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: next });
      return next;
    });

    try {
      await deleteDoc(doc(db, 'messages', messageId));
    } catch (err) {
      console.warn('Firestore delete message error:', err);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'SQL_DELETE',
          table: 'messages',
          id: messageId,
        }));
      } catch {}
    }
  }, []);

  const registerUser = useCallback(async (user: { 
    id: string; 
    username: string; 
    avatar_color: string; 
    avatar_url?: string; 
    current_channel?: string;
    activity?: string;
  }) => {
    const activeChannel = (user as any).current_channel || currentUserRef.current.current_channel || 'text-general';
    const dbUser: DbUser = {
      id: user.id,
      username: user.username,
      avatar_color: user.avatar_color || '#0066ff',
      avatar_url: user.avatar_url || '',
      current_channel: activeChannel as any,
      is_speaking: false,
      is_muted: false,
      is_deafened: false,
      has_video: false,
      is_screen_sharing: false,
      activity: user.activity || '',
      updated_at: Date.now(),
    };

    try {
      await setDoc(doc(db, 'users', dbUser.id), dbUser, { merge: true });
    } catch (err) {
      console.warn('Firestore register user error:', err);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'REGISTER_USER',
          user: dbUser,
        }));
      } catch {}
    }
  }, []);

  const sendRtcSignal = useCallback((targetUserId: string, signal: any) => {
    const payload = {
      type: 'RTC_SIGNAL',
      fromUserId: currentUserRef.current.id,
      targetUserId,
      signal,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch {}
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage(payload);
    }
  }, []);

  const callUser = useCallback((targetUserId: string, callType: 'audio' | 'video') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const u = currentUserRef.current;
      try {
        wsRef.current.send(JSON.stringify({
          type: 'USER_CALL',
          fromUserId: u.id,
          fromUserName: u.username,
          targetUserId,
          callType,
        }));
      } catch {}
    }
  }, []);

  return {
    users,
    messages,
    isConnected,
    updateUser,
    insertMessage,
    deleteMessage,
    registerUser,
    callUser,
    sendRtcSignal,
    setRtcSignalHandler,
    setUserCallHandler,
    setMediaHandlers,
    ws: wsRef.current,
  };
}
