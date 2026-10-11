import { useState, useEffect, useRef, useCallback } from 'react';
import { DbUser, DbMessage } from '../server/wsDatabase';

export interface RtcSignalPayload {
  fromUserId: string;
  targetUserId: string;
  signal: any;
}

export function useWebSocketDatabase(currentUser: { id: string; username: string; avatar_color: string; avatar_url?: string; activity?: string }) {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const connectionAttemptRef = useRef(0);
  const wsUrlRef = useRef<string>('');

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

  const startHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch (e) {
          console.warn('[WS] Ping failed:', e);
        }
      }
    }, 15000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Build WebSocket URL - works across localhost, IP, and domain
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws-db`;
    console.log('[WS] Computed URL:', wsUrl);
    return wsUrl;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('[WS] Already connected or connecting');
      return;
    }

    console.log('[WS] Connecting...');
    connectionAttemptRef.current++;

    try {
      const wsUrl = getWebSocketUrl();
      wsUrlRef.current = wsUrl;
      
      console.log('[WS] Attempting WebSocket connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('[WS] Connection timeout (5s), closing');
          ws.close();
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[WS] Connected successfully');
        connectionAttemptRef.current = 0;
        setIsConnected(true);
        startHeartbeat();

        const u = currentUserRef.current;
        try {
          ws.send(JSON.stringify({
            type: 'REGISTER_USER',
            user: {
              id: u.id,
              username: u.username,
              avatar_color: u.avatar_color,
              avatar_url: u.avatar_url || '',
              activity: u.activity || '',
              current_channel: 'text-general',
              is_speaking: false,
              is_muted: false,
              is_deafened: false,
              has_video: false,
              is_screen_sharing: false,
            },
          }));
          console.log('[WS] User registered:', u.id);
        } catch (e) {
          console.warn('[WS] Register failed:', e);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'PING' || msg.type === 'PONG') {
            if (msg.type === 'PING' && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            }
            return;
          }
          
          if (msg.type === 'DB_INIT') {
            console.log('[WS] Received DB_INIT with', msg.tables?.users?.length || 0, 'users');
            if (msg.tables?.users && Array.isArray(msg.tables.users)) {
              setUsers(msg.tables.users);
            }
            if (msg.tables?.messages && Array.isArray(msg.tables.messages)) {
              setMessages(msg.tables.messages);
            }
          } else if (msg.type === 'DB_SYNC') {
            if (msg.table === 'users' && Array.isArray(msg.data)) {
              console.log('[WS] DB_SYNC users:', msg.data.length);
              setUsers(msg.data);
            } else if (msg.table === 'messages' && Array.isArray(msg.data)) {
              console.log('[WS] DB_SYNC messages:', msg.data.length);
              setMessages(msg.data);
            }
          } else if (msg.type === 'RTC_SIGNAL') {
            if (onRtcSignalRef.current) {
              onRtcSignalRef.current(msg.fromUserId, msg.signal);
            }
          } else if (msg.type === 'USER_CALL') {
            if (onUserCallRef.current) {
              onUserCallRef.current(msg.fromUserId, msg.fromUserName, msg.callType);
            }
          } else if (msg.type === 'USER_JOINED_MEDIA') {
            if (onUserJoinedMediaRef.current) {
              onUserJoinedMediaRef.current(msg.userId, msg.channel);
            }
          } else if (msg.type === 'USER_LEFT_MEDIA') {
            if (onUserLeftMediaRef.current) {
              onUserLeftMediaRef.current(msg.userId, msg.channel);
            }
          }
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Closed, will reconnect');
        setIsConnected(false);
        stopHeartbeat();
        wsRef.current = null;
        
        const delayMs = Math.min(500 + connectionAttemptRef.current * 300, 5000);
        console.log('[WS] Reconnecting in', delayMs, 'ms');
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, delayMs);
        }
      };

      ws.onerror = (event) => {
        console.error('[WS] Error:', event);
        ws.close();
      };
    } catch (err) {
      console.warn('[WS] Connection error:', err);
      stopHeartbeat();
      
      const delayMs = Math.min(500 + connectionAttemptRef.current * 300, 5000);
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, delayMs);
      }
    }
  }, [getWebSocketUrl, startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    connect();
    return () => {
      stopHeartbeat();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect, stopHeartbeat]);

  const updateUser = useCallback((set: Partial<DbUser>) => {
    // Optimistically update local users state immediately
    const currentId = currentUserRef.current.id;
    setUsers((prev) =>
      prev.map((u) => (u.id === currentId ? { ...u, ...set } : u))
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'SQL_UPDATE',
          table: 'users',
          id: currentId,
          set,
        }));
      } catch (e) {
        console.warn('[WS] Update failed:', e);
      }
    }
  }, []);

  const insertMessage = useCallback((content: string, channelId: string = 'text-general', attachment?: { url: string; type: 'image' | 'video' | 'audio' | 'file' | 'gif' | string; name?: string }) => {
    if (!content.trim() && !attachment) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const u = currentUserRef.current;
        wsRef.current.send(JSON.stringify({
          type: 'SQL_INSERT',
          table: 'messages',
          row: {
            channel_id: channelId,
            sender_id: u.id,
            sender_name: u.username,
            avatar_color: u.avatar_color,
            avatar_url: u.avatar_url || '',
            content: content.trim(),
            attachment_url: attachment?.url,
            attachment_type: attachment?.type,
            attachment_name: attachment?.name,
            timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        }));
      } catch (e) {
        console.warn('[WS] Insert message failed:', e);
      }
    }
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'SQL_DELETE',
          table: 'messages',
          id: messageId,
        }));
      } catch (e) {
        console.warn('[WS] Delete message failed:', e);
      }
    }
  }, []);

  const registerUser = useCallback((user: { id: string; username: string; avatar_color: string; avatar_url?: string; activity?: string }) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...user };
        return next;
      }
      return [
        ...prev,
        {
          id: user.id,
          username: user.username,
          avatar_color: user.avatar_color,
          avatar_url: user.avatar_url || '',
          activity: user.activity || '',
          current_channel: 'text-general',
          is_speaking: false,
          is_muted: false,
          is_deafened: false,
          has_video: false,
          is_screen_sharing: false,
          updated_at: Date.now(),
        },
      ];
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const existingUser = users.find(u => u.id === user.id);
        wsRef.current.send(JSON.stringify({
          type: 'REGISTER_USER',
          user: {
            ...user,
            activity: user.activity || existingUser?.activity || '',
            current_channel: existingUser?.current_channel || 'text-general',
            is_speaking: existingUser?.is_speaking || false,
            is_muted: existingUser?.is_muted || false,
            is_deafened: existingUser?.is_deafened || false,
            has_video: existingUser?.has_video || false,
            is_screen_sharing: existingUser?.is_screen_sharing || false,
          },
        }));
      } catch (e) {
        console.warn('[WS] Register user failed:', e);
      }
    }
  }, [users]);

  const sendRtcSignal = useCallback((targetUserId: string, signal: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'RTC_SIGNAL',
          fromUserId: currentUserRef.current.id,
          targetUserId,
          signal,
        }));
      } catch (e) {
        console.warn('[WS] RTC signal failed:', e);
      }
    }
  }, []);

  const sendMediaStateSignal = useCallback((mediaType: 'camera' | 'screen', state: 'on' | 'off') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'MEDIA_STATE_SIGNAL',
          fromUserId: currentUserRef.current.id,
          mediaType,
          state,
        }));
      } catch (e) {
        console.warn('[WS] Media state signal failed:', e);
      }
    }
  }, []);

  const callUser = useCallback((targetUserId: string, callType: 'audio' | 'video') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const u = currentUserRef.current;
        wsRef.current.send(JSON.stringify({
          type: 'USER_CALL',
          fromUserId: u.id,
          fromUserName: u.username,
          targetUserId,
          callType,
        }));
      } catch (e) {
        console.warn('[WS] User call failed:', e);
      }
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
    sendMediaStateSignal,
    setRtcSignalHandler,
    setUserCallHandler,
    setMediaHandlers,
    ws: wsRef.current,
  };
}
