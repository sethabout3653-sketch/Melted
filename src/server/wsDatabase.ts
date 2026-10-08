import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

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
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'audio' | 'gif' | 'file' | string;
  attachment_name?: string;
  timestamp: string;
  created_at: number;
}

// Persistent Relational Tables backed by SQLite (WAL mode)
class WebSocketDatabase {
  private db: DatabaseSync;
  public channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'voice-general', name: 'general', type: 'voice' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

  constructor(dbPath: string = path.join(process.cwd(), 'chat.sqlite')) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        current_channel TEXT NOT NULL,
        is_speaking INTEGER NOT NULL DEFAULT 0,
        is_muted INTEGER NOT NULL DEFAULT 0,
        is_deafened INTEGER NOT NULL DEFAULT 0,
        has_video INTEGER NOT NULL DEFAULT 0,
        is_screen_sharing INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        content TEXT NOT NULL,
        attachment_url TEXT,
        attachment_type TEXT,
        attachment_name TEXT,
        timestamp TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
    `);

    // Reset transient users on server restart to keep presence accurate
    this.db.exec("DELETE FROM users WHERE current_channel = 'offline' OR updated_at < " + (Date.now() - 3600000));
  }

  public selectUsers(where?: Partial<DbUser>): DbUser[] {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY updated_at DESC').all() as any[];
    const list: DbUser[] = rows.map((r) => ({
      id: String(r.id),
      username: String(r.username),
      avatar_color: String(r.avatar_color),
      current_channel: r.current_channel as any,
      is_speaking: Boolean(r.is_speaking),
      is_muted: Boolean(r.is_muted),
      is_deafened: Boolean(r.is_deafened),
      has_video: Boolean(r.has_video),
      is_screen_sharing: Boolean(r.is_screen_sharing),
      updated_at: Number(r.updated_at),
    }));
    if (!where) return list;
    return list.filter((user) => {
      return Object.entries(where).every(([key, val]) => (user as any)[key] === val);
    });
  }

  public getUser(userId: string): DbUser | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!row) return null;
    return {
      id: String(row.id),
      username: String(row.username),
      avatar_color: String(row.avatar_color),
      current_channel: row.current_channel as any,
      is_speaking: Boolean(row.is_speaking),
      is_muted: Boolean(row.is_muted),
      is_deafened: Boolean(row.is_deafened),
      has_video: Boolean(row.has_video),
      is_screen_sharing: Boolean(row.is_screen_sharing),
      updated_at: Number(row.updated_at),
    };
  }

  public upsertUser(user: DbUser) {
    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, username, avatar_color, current_channel,
        is_speaking, is_muted, is_deafened, has_video, is_screen_sharing, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        avatar_color = excluded.avatar_color,
        current_channel = excluded.current_channel,
        is_speaking = excluded.is_speaking,
        is_muted = excluded.is_muted,
        is_deafened = excluded.is_deafened,
        has_video = excluded.has_video,
        is_screen_sharing = excluded.is_screen_sharing,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      user.id,
      user.username,
      user.avatar_color,
      user.current_channel,
      user.is_speaking ? 1 : 0,
      user.is_muted ? 1 : 0,
      user.is_deafened ? 1 : 0,
      user.has_video ? 1 : 0,
      user.is_screen_sharing ? 1 : 0,
      Date.now()
    );
  }

  public deleteUser(userId: string) {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }

  public insertMessage(msg: DbMessage) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages (
        id, channel_id, sender_id, sender_name, avatar_color,
        content, attachment_url, attachment_type, attachment_name, timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      msg.id,
      msg.channel_id,
      msg.sender_id,
      msg.sender_name,
      msg.avatar_color,
      msg.content,
      msg.attachment_url ?? null,
      msg.attachment_type ?? null,
      msg.attachment_name ?? null,
      msg.timestamp,
      msg.created_at
    );
  }

  public selectAllMessages(): DbMessage[] {
    const rows = this.db.prepare('SELECT * FROM messages ORDER BY created_at ASC LIMIT 500').all() as any[];
    return rows.map((r) => ({
      id: String(r.id),
      channel_id: String(r.channel_id),
      sender_id: String(r.sender_id),
      sender_name: String(r.sender_name),
      avatar_color: String(r.avatar_color),
      content: String(r.content),
      attachment_url: r.attachment_url ?? undefined,
      attachment_type: r.attachment_type ?? undefined,
      attachment_name: r.attachment_name ?? undefined,
      timestamp: String(r.timestamp),
      created_at: Number(r.created_at),
    }));
  }

  public selectMessages(channelId: string): DbMessage[] {
    const rows = this.db.prepare('SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC LIMIT 500').all(channelId) as any[];
    return rows.map((r) => ({
      id: String(r.id),
      channel_id: String(r.channel_id),
      sender_id: String(r.sender_id),
      sender_name: String(r.sender_name),
      avatar_color: String(r.avatar_color),
      content: String(r.content),
      attachment_url: r.attachment_url ?? undefined,
      attachment_type: r.attachment_type ?? undefined,
      attachment_name: r.attachment_name ?? undefined,
      timestamp: String(r.timestamp),
      created_at: Number(r.created_at),
    }));
  }

  public deleteMessage(id: string) {
    this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  }
}

export function initWebSocketDatabase(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws-db' });
  const db = new WebSocketDatabase();
  
  // Track multiple sockets per user ID (for multi-tab support)
  const userIdToSockets = new Map<string, Set<WebSocket>>();

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

  function broadcastMediaPresence(type: 'USER_JOINED_MEDIA' | 'USER_LEFT_MEDIA', userId: string, channel: string) {
    const payload = JSON.stringify({
      type,
      userId,
      channel,
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

    // Send initial snapshot
    ws.send(JSON.stringify({
      type: 'DB_INIT',
      tables: {
        users: db.selectUsers(),
        messages: db.selectAllMessages(),
        channels: db.channels,
      },
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
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

          case 'SQL_INSERT': {
            if (msg.table === 'messages') {
              const newMsg: DbMessage = {
                id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                channel_id: msg.row.channel_id || 'text-general',
                sender_id: msg.row.sender_id,
                sender_name: msg.row.sender_name,
                avatar_color: msg.row.avatar_color || '#0066ff',
                content: msg.row.content || '',
                attachment_url: msg.row.attachment_url,
                attachment_type: msg.row.attachment_type,
                attachment_name: msg.row.attachment_name,
                timestamp: msg.row.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                created_at: Date.now(),
              };
              db.insertMessage(newMsg);
              broadcastTable('messages', db.selectAllMessages());
            }
            break;
          }

          case 'SQL_UPDATE': {
            if (msg.table === 'users') {
              const user = db.getUser(msg.id);
              if (user) {
                const oldChannel = user.current_channel;
                const updated: DbUser = {
                  ...user,
                  ...msg.set,
                  updated_at: Date.now(),
                };
                db.upsertUser(updated);
                broadcastTable('users', db.selectUsers());

                // Detect channel media transitions
                if (msg.set.current_channel && msg.set.current_channel !== oldChannel) {
                  if (msg.set.current_channel === 'voice-general' || msg.set.current_channel === 'video-general') {
                    broadcastMediaPresence('USER_JOINED_MEDIA', msg.id, msg.set.current_channel);
                  }
                  if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
                    broadcastMediaPresence('USER_LEFT_MEDIA', msg.id, oldChannel);
                  }
                }
              }
            }
            break;
          }

          case 'SQL_DELETE': {
            if (msg.table === 'messages' && msg.id) {
              db.deleteMessage(msg.id);
              broadcastTable('messages', db.selectAllMessages());
            }
            break;
          }

          case 'REGISTER_USER': {
            if (msg.user && typeof msg.user.id === 'string') {
              const uId: string = msg.user.id;
              boundUserId = uId;
              
              if (!userIdToSockets.has(uId)) {
                userIdToSockets.set(uId, new Set());
              }
              userIdToSockets.get(uId)?.add(ws);

              db.upsertUser({
                id: uId,
                username: msg.user.username,
                avatar_color: msg.user.avatar_color || '#0066ff',
                current_channel: msg.user.current_channel || 'text-general',
                is_speaking: Boolean(msg.user.is_speaking),
                is_muted: Boolean(msg.user.is_muted),
                is_deafened: Boolean(msg.user.is_deafened),
                has_video: Boolean(msg.user.has_video),
                is_screen_sharing: Boolean(msg.user.is_screen_sharing),
                updated_at: Date.now(),
              });
              broadcastTable('users', db.selectUsers());

              if (msg.user.current_channel === 'voice-general' || msg.user.current_channel === 'video-general') {
                broadcastMediaPresence('USER_JOINED_MEDIA', uId, msg.user.current_channel);
              }
            }
            break;
          }

          // Direct WebRTC Signaling Relay
          case 'RTC_SIGNAL': {
            if (msg.targetUserId) {
              const targetSockets = userIdToSockets.get(msg.targetUserId);
              targetSockets?.forEach(targetWs => {
                if (targetWs.readyState === WebSocket.OPEN) {
                  targetWs.send(JSON.stringify({
                    type: 'RTC_SIGNAL',
                    fromUserId: msg.fromUserId,
                    targetUserId: msg.targetUserId,
                    signal: msg.signal,
                  }));
                }
              });
            }
            break;
          }

          case 'USER_CALL': {
            if (msg.targetUserId) {
              const targetSockets = userIdToSockets.get(msg.targetUserId);
              targetSockets?.forEach(targetWs => {
                if (targetWs.readyState === WebSocket.OPEN) {
                  targetWs.send(JSON.stringify({
                    type: 'USER_CALL',
                    fromUserId: msg.fromUserId,
                    fromUserName: msg.fromUserName,
                    callType: msg.callType,
                  }));
                }
              });
            }
            break;
          }

          case 'PING': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'PONG',
                timestamp: Date.now(),
              }));
            }
            break;
          }

          case 'PONG': {
            // Heartbeat response from client
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[WebSocket DB] Parse error:', err);
      }
    });

    // Cloudflare 100s timeout prevention: Server-side periodic ping every 30 seconds
    const serverHeartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(serverHeartbeatInterval);
      if (boundUserId) {
        const sockets = userIdToSockets.get(boundUserId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            const user = db.getUser(boundUserId);
            if (user && (user.current_channel === 'voice-general' || user.current_channel === 'video-general')) {
              broadcastMediaPresence('USER_LEFT_MEDIA', boundUserId, user.current_channel);
            }
            userIdToSockets.delete(boundUserId);
            db.deleteUser(boundUserId);
            broadcastTable('users', db.selectUsers());
          }
        }
      }
    });
  });

  console.log(`🔌 WebSocket Database mounted at /ws-db with WebRTC Signaling & SQLite storage`);
}
