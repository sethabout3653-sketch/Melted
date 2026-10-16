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
  const [isFallback, setIsFallback] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const syncPollIntervalRef = useRef<any>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const fallbackFailCountRef = useRef<number>(0);

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

  // Initialize BroadcastChannel Fallback & HTTP Cross-Link Polling Sync + WebRTC Signal Relay
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('frosted_db_sync_channel');
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

      const savedMessages = localStorage.getItem('frosted_db_messages');
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          if (Array.isArray(parsed)) setMessages(parsed);
        } catch {}
      } else {
        setMessages([]);
      }
    } catch {}

    // Cross-Link HTTP Polling Sync & RTC Signal Relay
    const pollSyncState = async () => {
      try {
        const res = await fetch('/api/sync/state');
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.users)) setUsers(data.users);
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
            try {
              localStorage.setItem('frosted_db_messages', JSON.stringify(data.messages.slice(-100)));
            } catch {}
          }
          setIsConnected(true);
        }

        // Poll pending WebRTC signals across links/URLs
        const uId = currentUserRef.current.id;
        if (uId) {
          const sigRes = await fetch(`/api/sync/signals/${uId}`);
          const sigData = await sigRes.json();
          if (sigData.success && Array.isArray(sigData.signals)) {
            sigData.signals.forEach((s: any) => {
              if (onRtcSignalRef.current) {
                onRtcSignalRef.current(s.fromUserId, s.signal);
              }
            });
          }
        }
      } catch {}
    };

    pollSyncState();
    syncPollIntervalRef.current = setInterval(pollSyncState, 1500);

    return () => {
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
      if (syncPollIntervalRef.current) clearInterval(syncPollIntervalRef.current);
    };
  }, []);

  const startHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 25000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const enableFallbackMode = useCallback(() => {
    setIsFallback(true);
    setIsConnected(true);
    const u = currentUserRef.current;
    const fallbackUser: DbUser = {
      id: u.id,
      username: u.username,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url || '',
      current_channel: 'text-general',
      is_speaking: false,
      is_muted: false,
      is_deafened: false,
      has_video: false,
      is_screen_sharing: false,
      activity: u.activity || '',
      updated_at: Date.now(),
    };
    setUsers((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const filtered = safePrev.filter((x) => x && x.id !== u.id);
      const next = [fallbackUser, ...filtered];
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: next });
      return next;
    });
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-db`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          try { ws.close(); } catch {}
          fallbackFailCountRef.current++;
          if (fallbackFailCountRef.current >= 1) {
            enableFallbackMode();
          }
        }
      }, 2000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        fallbackFailCountRef.current = 0;
        setIsConnected(true);
        setIsFallback(false);
        startHeartbeat();

        const u = currentUserRef.current;
        ws.send(JSON.stringify({
          type: 'REGISTER_USER',
          user: {
            id: u.id,
            username: u.username,
            avatar_color: u.avatar_color,
            activity: u.activity || '',
            current_channel: 'text-general',
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
          if (msg.type === 'DB_INIT') {
            if (Array.isArray(msg.tables?.users)) setUsers(msg.tables.users);
            if (Array.isArray(msg.tables?.messages)) setMessages(msg.tables.messages);
          } else if (msg.type === 'DB_SYNC') {
            if (msg.table === 'users' && Array.isArray(msg.data)) setUsers(msg.data);
            else if (msg.table === 'messages' && Array.isArray(msg.data)) setMessages(msg.data);
          } else if (msg.type === 'RTC_SIGNAL') {
            if (onRtcSignalRef.current) onRtcSignalRef.current(msg.fromUserId, msg.signal);
          } else if (msg.type === 'USER_CALL') {
            if (onUserCallRef.current) onUserCallRef.current(msg.fromUserId, msg.fromUserName, msg.callType);
          } else if (msg.type === 'USER_JOINED_MEDIA') {
            if (onUserJoinedMediaRef.current) onUserJoinedMediaRef.current(msg.userId, msg.channel);
          } else if (msg.type === 'USER_LEFT_MEDIA') {
            if (onUserLeftMediaRef.current) onUserLeftMediaRef.current(msg.userId, msg.channel);
          }
        } catch {}
      };

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        stopHeartbeat();
        wsRef.current = null;
        fallbackFailCountRef.current++;
        if (fallbackFailCountRef.current >= 5) {
          enableFallbackMode();
          return;
        }
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
        try { ws.close(); } catch {}
        fallbackFailCountRef.current++;
        if (fallbackFailCountRef.current >= 1) {
          enableFallbackMode();
        }
      };
    } catch {
      fallbackFailCountRef.current++;
      if (fallbackFailCountRef.current >= 1) {
        enableFallbackMode();
      } else {
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 1500);
        }
      }
    }
  }, [startHeartbeat, stopHeartbeat, enableFallbackMode]);

  useEffect(() => {
    connect();
    return () => {
      stopHeartbeat();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect, stopHeartbeat]);

  const updateUser = useCallback((set: Partial<DbUser>) => {
    const u = currentUserRef.current;
    const updatedUser = { id: u.id, username: u.username, avatar_color: u.avatar_color, avatar_url: u.avatar_url || '', ...set };

    fetch('/api/sync/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser),
    }).catch(() => {});

    if (isFallback) {
      setUsers((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const next = safePrev.map((user) => (user.id === u.id ? { ...user, ...set, updated_at: Date.now() } : user));
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: next });
        return next;
      });
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SQL_UPDATE',
        table: 'users',
        id: u.id,
        set,
      }));
    }
  }, [isFallback]);

  const insertMessage = useCallback((content: string, channelId: string = 'text-general', attachment?: { url: string; type: string; name?: string }) => {
    if (!content.trim() && !attachment) return;
    const u = currentUserRef.current;
    const newMsg: DbMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
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

    fetch('/api/sync/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg),
    }).then(res => res.json()).then(data => {
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    }).catch(() => {});

    if (isFallback) {
      setMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const next = [...safePrev, newMsg];
        try {
          localStorage.setItem('frosted_db_messages', JSON.stringify(next.slice(-100)));
        } catch {}
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: next });
        return next;
      });
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SQL_INSERT',
        table: 'messages',
        row: newMsg,
      }));
    } else {
      setMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const next = [...safePrev, newMsg];
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: next });
        return next;
      });
    }
  }, [isFallback]);

  const deleteMessage = useCallback((messageId: string) => {
    if (isFallback) {
      setMessages((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const next = safePrev.filter((m) => m && m.id !== messageId);
        try {
          localStorage.setItem('frosted_db_messages', JSON.stringify(next));
        } catch {}
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: next });
        return next;
      });
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SQL_DELETE',
        table: 'messages',
        id: messageId,
      }));
    }
  }, [isFallback]);

  const registerUser = useCallback((user: { id: string; username: string; avatar_color: string; avatar_url?: string; activity?: string }) => {
    const dbUser: DbUser = {
      id: user.id,
      username: user.username,
      avatar_color: user.avatar_color || '#0066ff',
      avatar_url: user.avatar_url || '',
      current_channel: 'text-general',
      is_speaking: false,
      is_muted: false,
      is_deafened: false,
      has_video: false,
      is_screen_sharing: false,
      activity: user.activity || '',
      updated_at: Date.now(),
    };

    fetch('/api/sync/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dbUser),
    }).catch(() => {});

    if (isFallback) {
      setUsers((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const filtered = safePrev.filter((x) => x && x.id !== user.id);
        const next = [dbUser, ...filtered];
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: next });
        return next;
      });
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'REGISTER_USER',
        user: dbUser,
      }));
    }
  }, [isFallback]);

  const sendRtcSignal = useCallback((targetUserId: string, signal: any) => {
    fetch('/api/sync/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromUserId: currentUserRef.current.id,
        targetUserId,
        signal,
      }),
    }).catch(() => {});

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'RTC_SIGNAL',
        fromUserId: currentUserRef.current.id,
        targetUserId,
        signal,
      });
    }
  }, []);

  const callUser = useCallback((targetUserId: string, callType: 'audio' | 'video') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const u = currentUserRef.current;
      wsRef.current.send(JSON.stringify({
        type: 'USER_CALL',
        fromUserId: u.id,
        fromUserName: u.username,
        targetUserId,
        callType,
      }));
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
