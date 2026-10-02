import { useState, useEffect, useRef, useCallback } from 'react';
import { DbUser, DbMessage } from '../server/wsDatabase';

export function useWebSocketDatabase(currentUser: { id: string; username: string; avatar_color: string }) {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws-db`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Register current user into the database
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
          }
        } catch (err) {
          console.error('[WS DB Client] parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 2 seconds
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

  return {
    users,
    messages,
    isConnected,
    updateUser,
    insertMessage,
  };
}
