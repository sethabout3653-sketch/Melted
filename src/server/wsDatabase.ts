import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export interface DbUser {
  id: string;
  username: string;
  avatar_color: string;
  current_channel: 'text-general' | 'voice-general' | 'video-general' | 'offline';
  is_speaking: boolean;
  is_muted: boolean;
  is_deafened: boolean;
  has_video: boolean;
  is_screen_sharing: boolean;
  updated_at: number;
}

export interface DbMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  avatar_color: string;
  content: string;
  timestamp: string;
  created_at: number;
}

// In-Memory Relational Tables (PostgreSQL-like Structure over WebSockets)
// STRICTLY REAL CONNECTED USERS ONLY - ZERO BUILT-IN USERS
class WebSocketDatabase {
  public users: Map<string, DbUser> = new Map();
  public messages: DbMessage[] = [];
  public channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'voice-general', name: 'general', type: 'voice' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

  // SQL-like operations
  public selectUsers(where?: Partial<DbUser>): DbUser[] {
    const list = Array.from(this.users.values());
    if (!where) return list;
    return list.filter((user) => {
      return Object.entries(where).every(([key, val]) => (user as any)[key] === val);
    });
  }

  public upsertUser(user: DbUser) {
    this.users.set(user.id, { ...user, updated_at: Date.now() });
  }

  public deleteUser(userId: string) {
    this.users.delete(userId);
  }

  public insertMessage(msg: DbMessage) {
    this.messages.push(msg);
    if (this.messages.length > 200) {
      this.messages.shift();
    }
  }

  public selectMessages(channelId: string): DbMessage[] {
    return this.messages.filter((m) => m.channel_id === channelId);
  }
}

export function initWebSocketDatabase(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws-db' });
  const db = new WebSocketDatabase();

  function broadcastTable(tableName: string, data: any) {
    const payload = JSON.stringify({
      type: 'DB_SYNC',
      table: tableName,
      data,
      timestamp: Date.now(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  wss.on('connection', (ws) => {
    let boundUserId: string | null = null;

    // Send initial snapshot on connect
    ws.send(JSON.stringify({
      type: 'DB_INIT',
      tables: {
        users: db.selectUsers(),
        messages: db.messages,
        channels: db.channels,
      },
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          // SQL SELECT / QUERY
          case 'SQL_QUERY': {
            if (msg.table === 'users') {
              ws.send(JSON.stringify({
                type: 'SQL_RESULT',
                requestId: msg.requestId,
                rows: db.selectUsers(msg.where),
              }));
            } else if (msg.table === 'messages') {
              ws.send(JSON.stringify({
                type: 'SQL_RESULT',
                requestId: msg.requestId,
                rows: db.selectMessages(msg.channelId || 'text-general'),
              }));
            }
            break;
          }

          // SQL INSERT (message)
          case 'SQL_INSERT': {
            if (msg.table === 'messages') {
              const newMsg: DbMessage = {
                id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                channel_id: msg.row.channel_id || 'text-general',
                sender_id: msg.row.sender_id,
                sender_name: msg.row.sender_name,
                avatar_color: msg.row.avatar_color || '#ff5500',
                content: msg.row.content,
                timestamp: msg.row.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                created_at: Date.now(),
              };
              db.insertMessage(newMsg);
              broadcastTable('messages', db.messages);
            }
            break;
          }

          // SQL UPDATE (user status)
          case 'SQL_UPDATE': {
            if (msg.table === 'users') {
              const user = db.users.get(msg.id);
              if (user) {
                Object.assign(user, msg.set, { updated_at: Date.now() });
                db.users.set(msg.id, user);
                broadcastTable('users', db.selectUsers());
              }
            }
            break;
          }

          // REGISTER PRESENCE (Real connecting user only)
          case 'REGISTER_USER': {
            boundUserId = msg.user.id;
            db.upsertUser({
              id: msg.user.id,
              username: msg.user.username,
              avatar_color: msg.user.avatar_color || '#ff5500',
              current_channel: msg.user.current_channel || 'text-general',
              is_speaking: Boolean(msg.user.is_speaking),
              is_muted: Boolean(msg.user.is_muted),
              is_deafened: Boolean(msg.user.is_deafened),
              has_video: Boolean(msg.user.has_video),
              is_screen_sharing: Boolean(msg.user.is_screen_sharing),
              updated_at: Date.now(),
            });
            broadcastTable('users', db.selectUsers());
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[WebSocket DB] Parse error:', err);
      }
    });

    ws.on('close', () => {
      if (boundUserId) {
        db.deleteUser(boundUserId);
        broadcastTable('users', db.selectUsers());
      }
    });
  });

  console.log(`🔌 WebSocket Database mounted at /ws-db (0 built-in users)`);
}
