import { useState, useEffect, useRef, useCallback } from 'react';
import { DbUser, DbMessage } from '../server/wsDatabase';

export interface RtcSignalPayload {
  fromUserId: string;
  targetUserId: string;
  signal: any;
}

export function useWebSocketDatabase(currentUser: { id: string; username: string; avatar_color: string; avatar_url?: string }) {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>(500);
  const pingIntervalRef = useRef<any>(null);

  // Use a ref for currentUser to avoid reconnecting when only username/avatar changes
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Callbacks for WebRTC signaling
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
    
    // Cloudflare Pages / Workers WebSocket 100s timeout prevention ping (sent every 15s)
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

  const connect = useCallback(() => {
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

        // Register current user
        const u = currentUserRef.current;
        ws.send(JSON.stringify({
          type: 'REGISTER_USER',
          user: {
            id: u.id,
            username: u.username,
            avatar_color: u.avatar_color,
            avatar_url: u.avatar_url || null,
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
          if (msg.type === 'PONG') {
            // Heartbeat acknowledged by Cloudflare / Node server
            return;
          }
          if (msg.type === 'DB_INIT') {
            if (msg.tables.users) setUsers(msg.tables.users);
            if (msg.tables.messages) setMessages(msg.tables.messages);
          } else if (msg.type === 'DB_SYNC') {
            if (msg.table === 'users') {
              setUsers(msg.data);
            } else if (msg.table === 'messages') {
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
          console.error('[WS DB Client] parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        stopHeartbeat();
        wsRef.current = null;
        const timeout = reconnectTimeoutRef.current;
        console.log(`[WS DB Client] Disconnected, reconnecting in ${timeout}ms...`);
        setTimeout(() => {
          reconnectTimeoutRef.current = Math.min(timeout * 1.5, 10000);
          connect();
        }, timeout);
      };

      ws.onerror = (err) => {
        console.error('[WS DB Client] WebSocket error:', err);
        ws.close();
      };
    } catch (err) {
      console.warn('[WS DB Client] connection error, will retry:', err);
      stopHeartbeat();
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 3000);
      }
    }
  }, [startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    connect();
    return () => {
      stopHeartbeat();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, stopHeartbeat]);

  // SQL-like UPDATE
  const updateUser = useCallback((set: Partial<DbUser>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SQL_UPDATE',
        table: 'users',
        id: currentUserRef.current.id,
        set,
      }));
    }
  }, []);

  // SQL-like INSERT
  const insertMessage = useCallback((content: string, channelId: string = 'text-general', attachment?: { url: string; type: 'image' | 'video' | 'audio' | 'file' | 'gif' | string; name?: string }) => {
    if (!content.trim() && !attachment) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const u = currentUserRef.current;
      wsRef.current.send(JSON.stringify({
        type: 'SQL_INSERT',
        table: 'messages',
        row: {
          channel_id: channelId,
          sender_id: u.id,
          sender_name: u.username,
          avatar_color: u.avatar_color,
          sender_avatar_url: u.avatar_url || null,
          content: content.trim(),
          attachment_url: attachment?.url,
          attachment_type: attachment?.type,
          attachment_name: attachment?.name,
          timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      }));
    }
  }, []);

  // SQL-like DELETE
  const deleteMessage = useCallback((messageId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SQL_DELETE',
        table: 'messages',
        id: messageId,
      }));
    }
  }, []);

  const registerUser = useCallback((user: { id: string; username: string; avatar_color: string; avatar_url?: string }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'REGISTER_USER',
        user: {
          ...user,
          avatar_url: user.avatar_url || null,
          current_channel: 'text-general',
          is_speaking: false,
          is_muted: false,
          is_deafened: false,
          has_video: false,
          is_screen_sharing: false,
        },
      }));
    }
  }, []);

  // Send WebRTC Signal
  const sendRtcSignal = useCallback((targetUserId: string, signal: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'RTC_SIGNAL',
        fromUserId: currentUserRef.current.id,
        targetUserId,
        signal,
      }));
    }
  }, []);

  const sendAudioChunk = useCallback((chunk: ArrayBuffer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(chunk);
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'JOIN_ROOM',
        room,
      }));
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
    joinRoom,
    sendRtcSignal,
    sendAudioChunk,
    setRtcSignalHandler,
    setUserCallHandler,
    setMediaHandlers,
    ws: wsRef.current,
  };
}
