import { useState, useEffect, useRef, useCallback } from 'react';
import { DbUser, DbMessage } from '../server/wsDatabase';
import { 
  publishPresence, 
  removePresence, 
  subscribePresence, 
  sendCloudRtcSignal, 
  subscribeCloudRtcSignals, 
  sendCloudChatMessage, 
  subscribeCloudMessages,
  deleteCloudChatMessage,
  updateCloudUserMessages
} from './cloudSignaling';

export interface RtcSignalPayload {
  fromUserId: string;
  targetUserId: string;
  signal: any;
}

function deduplicateUsers(users: DbUser[]): DbUser[] {
  const map = new Map<string, DbUser>();
  users.forEach((u) => {
    if (!u || !u.id) return;
    const existing = map.get(u.id);
    // If user exists, keep the one with more information or newer update
    if (!existing || (u.updated_at || 0) >= (existing.updated_at || 0)) {
      map.set(u.id, u);
    }
  });
  return Array.from(map.values());
}

export function resolveWebSocketUrl(): string {
  try {
    // 1. URL Query parameter override (?ws=... or ?server=...)
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const queryWs = params.get('ws') || params.get('server');
      if (queryWs) {
        if (queryWs.startsWith('ws://') || queryWs.startsWith('wss://')) {
          return queryWs.endsWith('/ws-db') ? queryWs : `${queryWs.replace(/\/$/, '')}/ws-db`;
        }
        const proto = queryWs.startsWith('https://') ? 'wss:' : 'ws:';
        const clean = queryWs.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `${proto}//${clean}/ws-db`;
      }

      // 2. LocalStorage override
      const storedWs = localStorage.getItem('frosted_ws_url') || localStorage.getItem('frosted_server_url') || localStorage.getItem('frosted_backend_url');
      if (storedWs) {
        if (storedWs.startsWith('ws://') || storedWs.startsWith('wss://')) {
          return storedWs.endsWith('/ws-db') ? storedWs : `${storedWs.replace(/\/$/, '')}/ws-db`;
        }
        const proto = storedWs.startsWith('https://') ? 'wss:' : 'ws:';
        const clean = storedWs.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `${proto}//${clean}/ws-db`;
      }
    }

    // 3. Environment Variables
    const customWsUrl = (import.meta as any).env?.VITE_WS_URL;
    if (customWsUrl) {
      return customWsUrl.endsWith('/ws-db') ? customWsUrl : `${customWsUrl.replace(/\/$/, '')}/ws-db`;
    }

    const customBackendUrl = (import.meta as any).env?.VITE_BACKEND_URL;
    if (customBackendUrl) {
      const cleanBackend = customBackendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsProto = customBackendUrl.startsWith('https') ? 'wss:' : 'ws:';
      return `${wsProto}//${cleanBackend}/ws-db`;
    }

    // 4. If running on Cloudflare Pages or Vercel static site without custom server, connect to Render backend if available
    if (typeof window !== 'undefined' && window.location?.hostname?.endsWith('.pages.dev')) {
      return 'wss://melted-arcade.onrender.com/ws-db';
    }

    // 5. Default: Current origin (supports local dev server and Render web service)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws-db`;
  } catch {
    return 'ws://localhost:3000/ws-db';
  }
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
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const presenceHeartbeatRef = useRef<any>(null);
  const outgoingQueueRef = useRef<string[]>([]);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const processedRtcSignalsRef = useRef<Set<string>>(new Set());

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const activeUserStateRef = useRef<DbUser>({
    id: currentUser.id,
    username: currentUser.username,
    avatar_color: currentUser.avatar_color || '#0066ff',
    avatar_url: currentUser.avatar_url || '',
    current_channel: (currentUser as any).current_channel || 'text-general',
    activity: currentUser.activity || '',
    is_speaking: false,
    is_muted: false,
    is_deafened: false,
    has_video: false,
    is_screen_sharing: false,
    is_hand_raised: false,
    updated_at: Date.now(),
  });

  const lastUserIdRef = useRef<string>(currentUser.id);

  useEffect(() => {
    // If ID changed (e.g. guest -> logged in), cleanup old presence doc
    if (lastUserIdRef.current && lastUserIdRef.current !== currentUser.id) {
      removePresence(lastUserIdRef.current);
    }
    lastUserIdRef.current = currentUser.id;

    Object.assign(activeUserStateRef.current, {
      id: currentUser.id,
      username: currentUser.username,
      avatar_color: currentUser.avatar_color || '#0066ff',
      avatar_url: currentUser.avatar_url || '',
    });
  }, [currentUser.id, currentUser.username, currentUser.avatar_color, currentUser.avatar_url]);

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

  // Safe send: Immediately sends if OPEN, otherwise queues until socket is ready
  const safeSend = useCallback((payload: any) => {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(raw);
      } catch (err) {
        console.warn('[wsDatabaseClient] Send failed, queueing:', err);
        outgoingQueueRef.current.push(raw);
      }
    } else {
      outgoingQueueRef.current.push(raw);
    }
  }, []);

  // Multi-tab BroadcastChannel for sync across tabs in same browser
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
        }
      };
    } catch {}

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, []);

  // Save messages to local cache for instant cold rendering
  useEffect(() => {
    try {
      localStorage.setItem('frosted_db_messages', JSON.stringify(messages.slice(-200)));
    } catch {}
  }, [messages]);

  // WebSocket Heartbeat
  const startHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 12000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Attempt local or configured WebSocket database connection
  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      const wsUrl = resolveWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
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
            is_hand_raised: false,
          },
        }));

        // Flush any queued messages
        while (outgoingQueueRef.current.length > 0) {
          const item = outgoingQueueRef.current.shift();
          if (item) {
            try { ws.send(item); } catch {}
          }
        }
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
            if (Array.isArray(msg.tables?.users) && msg.tables.users.length > 0) {
              setUsers(deduplicateUsers(msg.tables.users));
            }
            if (Array.isArray(msg.tables?.messages) && msg.tables.messages.length > 0) {
              setMessages(msg.tables.messages);
            }
          } else if (msg.type === 'DB_SYNC') {
            if (msg.table === 'users' && Array.isArray(msg.data)) {
              setUsers(deduplicateUsers(msg.data));
            } else if (msg.table === 'messages' && Array.isArray(msg.data)) {
              setMessages(msg.data);
            }
          } else if (msg.type === 'RTC_SIGNAL') {
            const sigKey = `${msg.fromUserId}:${JSON.stringify(msg.signal).slice(0, 100)}`;
            if (!processedRtcSignalsRef.current.has(sigKey)) {
              processedRtcSignalsRef.current.add(sigKey);
              if (processedRtcSignalsRef.current.size > 200) {
                const [first] = processedRtcSignalsRef.current;
                processedRtcSignalsRef.current.delete(first);
              }
              if (onRtcSignalRef.current) {
                onRtcSignalRef.current(msg.fromUserId, msg.signal);
              }
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
          } else if (msg.type === 'USER_MEDIA_UPDATE') {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'GET_USERS' }));
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        stopHeartbeat();
        wsRef.current = null;
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3500);
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    } catch {
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 3500);
      }
    }
  }, [startHeartbeat, stopHeartbeat]);

  // Connect WebSocket on boot
  useEffect(() => {
    connect();

    const handleOnline = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      stopHeartbeat();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [connect, stopHeartbeat]);

  // Cloud Presence & Cloud WebRTC Signaling Engine (Powers Vercel & multi-peer connection)
  useEffect(() => {
    const u = currentUserRef.current;
    setIsCloudConnected(true);

    const makeCurrentDbUser = (): DbUser => ({
      ...activeUserStateRef.current,
      id: u.id,
      username: u.username,
      avatar_color: u.avatar_color || '#0066ff',
      avatar_url: u.avatar_url || '',
      updated_at: Date.now(),
    });

    // 1. Initial Presence Announcement
    publishPresence(makeCurrentDbUser());

    // 2. Periodic Heartbeat every 15 seconds to keep presence active WITHOUT overwriting video/audio/channel state!
    if (presenceHeartbeatRef.current) clearInterval(presenceHeartbeatRef.current);
    presenceHeartbeatRef.current = setInterval(() => {
      const cur = activeUserStateRef.current;
      cur.updated_at = Date.now();
      publishPresence({
        ...cur,
      });
    }, 15000);

    // 3. Subscribe to Real-Time Presence (All online players on Vercel)
    const unsubPresence = subscribePresence(u.id, (cloudUsers) => {
      setUsers((prev) => {
        const curId = currentUserRef.current.id;
        const exists = cloudUsers.some((p) => p.id === curId);
        let updatedList = cloudUsers;

        if (!exists) {
          const curUserDb = makeCurrentDbUser();
          updatedList = [curUserDb, ...cloudUsers];
        }

        const deduped = deduplicateUsers(updatedList);

        // Only update if changes occurred to avoid render churn
        const prevKey = prev.map((p) => `${p.id}:${p.current_channel}:${p.is_speaking}:${p.has_video}:${p.is_screen_sharing}:${p.activity}`).join('|');
        const nextKey = deduped.map((p) => `${p.id}:${p.current_channel}:${p.is_speaking}:${p.has_video}:${p.is_screen_sharing}:${p.activity}`).join('|');

        if (prevKey !== nextKey) {
          broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: deduped });
          return deduped;
        }
        return prev;
      });
    });

    // 4. Subscribe to Real-Time WebRTC Signals on Vercel
    const unsubSignals = subscribeCloudRtcSignals(u.id, (fromUserId, signal) => {
      if (fromUserId === u.id) return;

      // Deduplicate signals that might arrive through both channels
      const sigKey = `${fromUserId}:${JSON.stringify(signal).slice(0, 100)}`;
      if (processedRtcSignalsRef.current.has(sigKey)) return;
      processedRtcSignalsRef.current.add(sigKey);

      if (processedRtcSignalsRef.current.size > 200) {
        const [first] = processedRtcSignalsRef.current;
        processedRtcSignalsRef.current.delete(first);
      }

      if (signal?.type === 'user-call') {
        if (onUserCallRef.current) {
          onUserCallRef.current(fromUserId, signal.fromUserName || 'Player', signal.callType || 'audio');
        }
      } else if (onRtcSignalRef.current) {
        onRtcSignalRef.current(fromUserId, signal);
      }
    });

    // 5. Subscribe to Cloud Messages for full cross-device chat sync and real-time deletion
    const unsubMessages = subscribeCloudMessages((cloudMessages) => {
      setMessages(cloudMessages);
      try {
        localStorage.setItem('frosted_db_messages', JSON.stringify(cloudMessages.slice(-200)));
      } catch {}
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: cloudMessages });
    });

    // Clean up presence on page close / unload
    const handleBeforeUnload = () => {
      removePresence(currentUserRef.current.id);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (presenceHeartbeatRef.current) clearInterval(presenceHeartbeatRef.current);
      unsubPresence();
      unsubSignals();
      unsubMessages();
      removePresence(currentUserRef.current.id);
    };
  }, []);

  const updateUser = useCallback((set: Partial<DbUser>) => {
    const u = currentUserRef.current;
    Object.assign(currentUserRef.current, set);
    Object.assign(activeUserStateRef.current, set);
    activeUserStateRef.current.updated_at = Date.now();

    setUsers((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const next = safePrev.map((user) => (user.id === u.id ? { ...user, ...set, updated_at: Date.now() } : user));
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: next });
      return next;
    });

    safeSend({
      type: 'SQL_UPDATE',
      table: 'users',
      id: u.id,
      set,
    });

    // Mirror updated state to Firestore presence so has_video and media streams remain rock-solid
    publishPresence({
      ...activeUserStateRef.current,
    });

    // If profile info (username/avatar) changed, update cloud messages as well
    if (set.username || set.avatar_color || set.avatar_url) {
      updateCloudUserMessages(u.id, {
        username: activeUserStateRef.current.username,
        avatar_color: activeUserStateRef.current.avatar_color,
        avatar_url: activeUserStateRef.current.avatar_url || ''
      });
    }
  }, [safeSend]);

  const insertMessage = useCallback((content: string, channelId: string = 'text-general', attachment?: { url: string; type: string; name?: string }) => {
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

    // Optimistic local state update
    setMessages((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (safePrev.some((m) => m.id === newMsg.id)) return safePrev;
      const next = [...safePrev, newMsg];
      try {
        localStorage.setItem('frosted_db_messages', JSON.stringify(next.slice(-200)));
      } catch {}
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: next });
      return next;
    });

    // Send via WebSocket (if active)
    safeSend({
      type: 'SQL_INSERT',
      table: 'messages',
      row: newMsg,
    });

    // Mirror to Firestore Cloud Messages for cross-network sync on Vercel
    sendCloudChatMessage(newMsg);
  }, [safeSend]);

  const deleteMessage = useCallback((messageId: string) => {
    // 1. Optimistically delete from local state and localStorage
    setMessages((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const next = safePrev.filter((m) => m && m.id !== messageId);
      try {
        localStorage.setItem('frosted_db_messages', JSON.stringify(next.slice(-200)));
      } catch {}
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: next });
      return next;
    });

    // 2. Delete via WebSocket (if connected)
    safeSend({
      type: 'SQL_DELETE',
      table: 'messages',
      id: messageId,
    });

    // 3. Delete from Firestore cloud messages so it is removed for everyone
    deleteCloudChatMessage(messageId);
  }, [safeSend]);

  const registerUser = useCallback((user: { 
    id: string; 
    username: string; 
    avatar_color: string; 
    avatar_url?: string; 
    current_channel?: string;
    activity?: string;
  }) => {
    const activeChannel = (user as any).current_channel || activeUserStateRef.current.current_channel || 'text-general';
    const dbUser: DbUser = {
      ...activeUserStateRef.current,
      id: user.id,
      username: user.username,
      avatar_color: user.avatar_color || '#0066ff',
      avatar_url: user.avatar_url || '',
      current_channel: activeChannel as any,
      activity: user.activity || activeUserStateRef.current.activity || '',
      updated_at: Date.now(),
    };

    Object.assign(activeUserStateRef.current, dbUser);

    safeSend({
      type: 'REGISTER_USER',
      user: dbUser,
    });

    // Publish to cloud presence
    publishPresence(dbUser);

    // Ensure old messages reflect current profile info
    updateCloudUserMessages(dbUser.id, {
      username: dbUser.username,
      avatar_color: dbUser.avatar_color,
      avatar_url: dbUser.avatar_url || ''
    });

    setUsers((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const filtered = safePrev.filter((x) => x && x.id !== user.id);
      const next = [dbUser, ...filtered];
      broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: next });
      return next;
    });
  }, [safeSend]);

  // WebRTC Signal Relay: Sends via WebSocket AND Firestore Cloud Signaling
  const sendRtcSignal = useCallback((targetUserId: string, signal: any) => {
    const fromUserId = currentUserRef.current.id;

    // 1. Send via WebSocket if socket is available
    safeSend({
      type: 'RTC_SIGNAL',
      fromUserId,
      targetUserId,
      signal,
    });

    // 2. Always send via Firestore Cloud Signaling for reliable Vercel P2P connection
    sendCloudRtcSignal(fromUserId, targetUserId, signal);
  }, [safeSend]);

  // Direct peer-to-peer user call
  const callUser = useCallback((targetUserId: string, callType: 'audio' | 'video') => {
    const u = currentUserRef.current;

    safeSend({
      type: 'USER_CALL',
      fromUserId: u.id,
      fromUserName: u.username,
      targetUserId,
      callType,
    });

    // Cloud signal for direct calling across Vercel deployments
    sendCloudRtcSignal(u.id, targetUserId, {
      type: 'user-call',
      fromUserName: u.username,
      callType,
    });
  }, [safeSend]);

  const isConnected = isWsConnected || isCloudConnected;

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
