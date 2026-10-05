import { useState, useEffect, useRef, useCallback } from 'react';
import { DbUser, DbMessage } from '../server/wsDatabase';

export interface RtcSignalPayload {
  fromUserId: string;
  targetUserId: string;
  signal: any;
}

export function useWebSocketDatabase(currentUser: { id: string; username: string; avatar_color: string }) {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Callbacks for WebRTC signaling
  const onRtcSignalRef = useRef<((fromUserId: string, signal: any) => void) | null>(null);
  const onUserCallRef = useRef<((fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) | null>(null);
  const onUserJoinedMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);
  const onUserLeftMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-db`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Register current user
        ws.send(JSON.stringify({
          type: 'REGISTER_USER',
          user: {
            id: currentUser.id,
            username: currentUser.username,
            avatar_color: currentUser.avatar_color,
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
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.warn('[WS DB Client] connection error, will retry:', err);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [currentUser.id, currentUser.username, currentUser.avatar_color]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // SQL-like UPDATE
  const updateUser = useCallback((set: Partial<DbUser>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SQL_UPDATE',
        table: 'users',
        id: currentUser.id,
        set,
      }));
    }
  }, [currentUser.id]);

  // SQL-like INSERT
  const insertMessage = useCallback((content: string, channelId: string = 'text-general') => {
    if (!content.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SQL_INSERT',
        table: 'messages',
        row: {
          channel_id: channelId,
          sender_id: currentUser.id,
          sender_name: currentUser.username,
          avatar_color: currentUser.avatar_color,
          content: content.trim(),
          timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      }));
    }
  }, [currentUser.id, currentUser.username, currentUser.avatar_color]);

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

  const registerUser = useCallback((user: { id: string; username: string; avatar_color: string }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'REGISTER_USER',
        user: {
          ...user,
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
        fromUserId: currentUser.id,
        targetUserId,
        signal,
      }));
    }
  }, [currentUser.id]);

  const callUser = useCallback((targetUserId: string, callType: 'audio' | 'video') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'USER_CALL',
        fromUserId: currentUser.id,
        fromUserName: currentUser.username,
        targetUserId,
        callType,
      }));
    }
  }, [currentUser.id, currentUser.username]);

  // Register WebRTC callbacks
  const registerRtcHandlers = useCallback((
    onSignal: (fromUserId: string, signal: any) => void,
    onJoined: (userId: string, channel: string) => void,
    onLeft: (userId: string, channel: string) => void,
    onCall?: (fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void
  ) => {
    onRtcSignalRef.current = onSignal;
    onUserJoinedMediaRef.current = onJoined;
    onUserLeftMediaRef.current = onLeft;
    if (onCall) onUserCallRef.current = onCall;
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
    registerRtcHandlers,
    ws: wsRef.current,
  };
}
