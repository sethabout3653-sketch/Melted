import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export interface DbUser {
  id: string;
  username: string;
  avatar_color: string;
  avatar_url?: string;
  current_channel: 'text-general' | 'voice-general' | 'video-general' | 'offline';
  is_speaking: boolean;
  is_muted: boolean;
  is_deafened: boolean;
  has_video: boolean;
  is_screen_sharing: boolean;
  activity?: string;
  updated_at: number;
}

export interface DbMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  avatar_color: string;
  avatar_url?: string;
  content: string;
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'audio' | 'gif' | 'file' | string;
  attachment_name?: string;
  timestamp: string;
  created_at: number;
}

// Ultra-fast in-memory cache for presence
class PresenceCache {
  private users: Map<string, DbUser> = new Map();
  private messages: DbMessage[] = [];
  private dirtyUsers: Set<string> = new Set();
  private lastSyncTime: number = 0;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(private db: WebSocketDatabase, private broadcastFn: (tableName: string, data: any) => void) {
    this.loadFromDb();
    this.startPeriodicSync();
  }

  private loadFromDb() {
    try {
      const rows = this.db.selectUsers();
      this.users.clear();
      for (const r of rows) {
        this.users.set(r.id, r);
      }
    } catch (e) {
      console.error('[Cache] Load users error:', e);
    }
  }

  private startPeriodicSync() {
    this.syncInterval = setInterval(() => {
      if (this.dirtyUsers.size > 0) {
        const usersArray = Array.from(this.users.values());
        this.broadcastFn('users', usersArray);
        this.dirtyUsers.clear();
      }
      this.lastSyncTime = Date.now();
    }, 50); // Ultra-fast 50ms batch sync
  }

  getUser(userId: string): DbUser | null {
    return this.users.get(userId) || null;
  }

  getAllUsers(): DbUser[] {
    return Array.from(this.users.values());
  }

  upsertUser(user: DbUser) {
    this.users.set(user.id, user);
    this.dirtyUsers.add(user.id);
  }

  deleteUser(userId: string) {
    this.users.delete(userId);
    this.dirtyUsers.delete(userId);
  }

  markDirty(userId: string) {
    this.dirtyUsers.add(userId);
  }

  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
  }
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
    this.db.exec('PRAGMA cache_size = 10000;');
    this.db.exec('PRAGMA temp_store = MEMORY;');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        avatar_url TEXT DEFAULT '',
        current_channel TEXT NOT NULL,
        is_speaking INTEGER NOT NULL DEFAULT 0,
        is_muted INTEGER NOT NULL DEFAULT 0,
        is_deafened INTEGER NOT NULL DEFAULT 0,
        has_video INTEGER NOT NULL DEFAULT 0,
        is_screen_sharing INTEGER NOT NULL DEFAULT 0,
        activity TEXT DEFAULT '',
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        avatar_url TEXT DEFAULT '',
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

    try {
      this.db.exec("ALTER TABLE users ADD COLUMN activity TEXT DEFAULT '';");
    } catch {}
    try {
      this.db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '';");
    } catch {}
    try {
      this.db.exec("ALTER TABLE messages ADD COLUMN avatar_url TEXT DEFAULT '';");
    } catch {}

    // Reset transient users on server restart
    this.db.exec("DELETE FROM users WHERE current_channel = 'offline' OR updated_at < " + (Date.now() - 3600000));
  }

  public selectUsers(where?: Partial<DbUser>): DbUser[] {
    try {
      const rows = this.db.prepare('SELECT * FROM users ORDER BY updated_at DESC').all() as any[];
      const list: DbUser[] = rows.map((r) => ({
        id: String(r.id),
        username: String(r.username),
        avatar_color: String(r.avatar_color),
        avatar_url: r.avatar_url ? String(r.avatar_url) : '',
        current_channel: r.current_channel as any,
        is_speaking: Boolean(r.is_speaking),
        is_muted: Boolean(r.is_muted),
        is_deafened: Boolean(r.is_deafened),
        has_video: Boolean(r.has_video),
        is_screen_sharing: Boolean(r.is_screen_sharing),
        activity: r.activity ? String(r.activity) : '',
        updated_at: Number(r.updated_at),
      }));
      if (!where) return list;
      return list.filter((user) => {
        return Object.entries(where).every(([key, val]) => (user as any)[key] === val);
      });
    } catch (e) {
      console.error('[DB] selectUsers error:', e);
      return [];
    }
  }

  public getUser(userId: string): DbUser | null {
    try {
      const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!row) return null;
      return {
        id: String(row.id),
        username: String(row.username),
        avatar_color: String(row.avatar_color),
        avatar_url: row.avatar_url ? String(row.avatar_url) : '',
        current_channel: row.current_channel as any,
        is_speaking: Boolean(row.is_speaking),
        is_muted: Boolean(row.is_muted),
        is_deafened: Boolean(row.is_deafened),
        has_video: Boolean(row.has_video),
        is_screen_sharing: Boolean(row.is_screen_sharing),
        activity: row.activity ? String(row.activity) : '',
        updated_at: Number(row.updated_at),
      };
    } catch (e) {
      console.error('[DB] getUser error:', e);
      return null;
    }
  }

  public upsertUser(user: DbUser) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (
          id, username, avatar_color, avatar_url, current_channel,
          is_speaking, is_muted, is_deafened, has_video, is_screen_sharing, activity, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          avatar_color = excluded.avatar_color,
          avatar_url = excluded.avatar_url,
          current_channel = excluded.current_channel,
          is_speaking = excluded.is_speaking,
          is_muted = excluded.is_muted,
          is_deafened = excluded.is_deafened,
          has_video = excluded.has_video,
          is_screen_sharing = excluded.is_screen_sharing,
          activity = excluded.activity,
          updated_at = excluded.updated_at
      `);
      stmt.run(
        user.id,
        user.username,
        user.avatar_color,
        user.avatar_url || '',
        user.current_channel,
        user.is_speaking ? 1 : 0,
        user.is_muted ? 1 : 0,
        user.is_deafened ? 1 : 0,
        user.has_video ? 1 : 0,
        user.is_screen_sharing ? 1 : 0,
        user.activity || '',
        Date.now()
      );
    } catch (e) {
      console.error('[DB] upsertUser error:', e);
    }
  }

  public deleteUser(userId: string) {
    try {
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    } catch (e) {
      console.error('[DB] deleteUser error:', e);
    }
  }

  public insertMessage(msg: DbMessage) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO messages (
          id, channel_id, sender_id, sender_name, avatar_color, avatar_url,
          content, attachment_url, attachment_type, attachment_name, timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        msg.id,
        msg.channel_id,
        msg.sender_id,
        msg.sender_name,
        msg.avatar_color,
        msg.avatar_url || '',
        msg.content,
        msg.attachment_url ?? null,
        msg.attachment_type ?? null,
        msg.attachment_name ?? null,
        msg.timestamp,
        msg.created_at
      );
    } catch (e) {
      console.error('[DB] insertMessage error:', e);
    }
  }

  public selectAllMessages(): DbMessage[] {
    try {
      const rows = this.db.prepare('SELECT * FROM messages ORDER BY created_at ASC LIMIT 500').all() as any[];
      return rows.map((r) => ({
        id: String(r.id),
        channel_id: String(r.channel_id),
        sender_id: String(r.sender_id),
        sender_name: String(r.sender_name),
        avatar_color: String(r.avatar_color),
        avatar_url: r.avatar_url ? String(r.avatar_url) : '',
        content: String(r.content),
        attachment_url: r.attachment_url ?? undefined,
        attachment_type: r.attachment_type ?? undefined,
        attachment_name: r.attachment_name ?? undefined,
        timestamp: String(r.timestamp),
        created_at: Number(r.created_at),
      }));
    } catch (e) {
      console.error('[DB] selectAllMessages error:', e);
      return [];
    }
  }

  public selectMessages(channelId: string): DbMessage[] {
    try {
      const rows = this.db.prepare('SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC LIMIT 500').all(channelId) as any[];
      return rows.map((r) => ({
        id: String(r.id),
        channel_id: String(r.channel_id),
        sender_id: String(r.sender_id),
        sender_name: String(r.sender_name),
        avatar_color: String(r.avatar_color),
        avatar_url: r.avatar_url ? String(r.avatar_url) : '',
        content: String(r.content),
        attachment_url: r.attachment_url ?? undefined,
        attachment_type: r.attachment_type ?? undefined,
        attachment_name: r.attachment_name ?? undefined,
        timestamp: String(r.timestamp),
        created_at: Number(r.created_at),
      }));
    } catch (e) {
      console.error('[DB] selectMessages error:', e);
      return [];
    }
  }

  public deleteMessage(id: string) {
    try {
      this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    } catch (e) {
      console.error('[DB] deleteMessage error:', e);
    }
  }
}

export function initWebSocketDatabase(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws-db', perMessageDeflate: false });
  const db = new WebSocketDatabase();

  // Ultra-fast presence cache with batched sync
  let presenceCache: PresenceCache | null = null;
  const userIdToSockets = new Map<string, Set<WebSocket>>();
  const messageBroadcastQueue: DbMessage[] = [];
  let messageBroadcastTimer: NodeJS.Timeout | null = null;

  function broadcastTable(tableName: string, data: any) {
    const payload = JSON.stringify({
      type: 'DB_SYNC',
      table: tableName,
      data,
      timestamp: Date.now(),
    });

    const buffer = Buffer.from(payload);
    let sentCount = 0;

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(buffer);
          sentCount++;
        } catch (e) {
          console.warn('[WS] Broadcast error:', e);
        }
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

    const buffer = Buffer.from(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(buffer);
        } catch (e) {
          console.warn('[WS] Media presence error:', e);
        }
      }
    });
  }

  wss.on('connection', (ws) => {
    let boundUserId: string | null = null;
    let lastPingTime = Date.now();

    try {
      ws.send(JSON.stringify({
        type: 'DB_INIT',
        tables: {
          users: presenceCache?.getAllUsers() || db.selectUsers(),
          messages: db.selectAllMessages(),
          channels: db.channels,
        },
      }));
    } catch (e) {
      console.error('[WS] Failed to send DB_INIT:', e);
    }

    // Ultra-fast message handler
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'SQL_QUERY': {
            if (msg.table === 'users') {
              ws.send(JSON.stringify({
                type: 'SQL_RESULT',
                requestId: msg.requestId,
                rows: presenceCache?.getAllUsers() || db.selectUsers(msg.where),
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
              const user = presenceCache?.getUser(msg.id) || db.getUser(msg.id);
              if (user) {
                const oldChannel = user.current_channel;
                const updated: DbUser = {
                  ...user,
                  ...msg.set,
                  updated_at: Date.now(),
                };
                db.upsertUser(updated);
                presenceCache?.upsertUser(updated);
                broadcastTable('users', presenceCache?.getAllUsers() || db.selectUsers());

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

              const newUser: DbUser = {
                id: uId,
                username: msg.user.username,
                avatar_color: msg.user.avatar_color || '#0066ff',
                avatar_url: msg.user.avatar_url || '',
                current_channel: msg.user.current_channel || 'text-general',
                is_speaking: Boolean(msg.user.is_speaking),
                is_muted: Boolean(msg.user.is_muted),
                is_deafened: Boolean(msg.user.is_deafened),
                has_video: Boolean(msg.user.has_video),
                is_screen_sharing: Boolean(msg.user.is_screen_sharing),
                activity: msg.user.activity ? String(msg.user.activity) : '',
                updated_at: Date.now(),
              };

              db.upsertUser(newUser);
              presenceCache?.upsertUser(newUser);
              broadcastTable('users', presenceCache?.getAllUsers() || db.selectUsers());

              if (msg.user.current_channel === 'voice-general' || msg.user.current_channel === 'video-general') {
                broadcastMediaPresence('USER_JOINED_MEDIA', uId, msg.user.current_channel);
              }
            }
            break;
          }

          case 'MEDIA_STATE_SIGNAL': {
            if (!msg.fromUserId || !msg.mediaType || !msg.state) break;
            const user = presenceCache?.getUser(msg.fromUserId) || db.getUser(msg.fromUserId);
            if (!user) break;

            const nextUser: DbUser = {
              ...user,
              has_video: msg.mediaType === 'camera' ? msg.state === 'on' : user.has_video,
              is_screen_sharing: msg.mediaType === 'screen' ? msg.state === 'on' : user.is_screen_sharing,
              updated_at: Date.now(),
            };

            db.upsertUser(nextUser);
            presenceCache?.upsertUser(nextUser);
            broadcastTable('users', presenceCache?.getAllUsers() || db.selectUsers());
            break;
          }

          case 'RTC_SIGNAL': {
            if (msg.targetUserId) {
              const targetSockets = userIdToSockets.get(msg.targetUserId);
              const payload = JSON.stringify({
                type: 'RTC_SIGNAL',
                fromUserId: msg.fromUserId,
                targetUserId: msg.targetUserId,
                signal: msg.signal,
              });
              const buffer = Buffer.from(payload);
              targetSockets?.forEach(targetWs => {
                if (targetWs.readyState === WebSocket.OPEN) {
                  try {
                    targetWs.send(buffer);
                  } catch (e) {
                    console.warn('[WS] RTC relay error:', e);
                  }
                }
              });
            }
            break;
          }

          case 'USER_CALL': {
            if (msg.targetUserId) {
              const targetSockets = userIdToSockets.get(msg.targetUserId);
              const payload = JSON.stringify({
                type: 'USER_CALL',
                fromUserId: msg.fromUserId,
                fromUserName: msg.fromUserName,
                callType: msg.callType,
              });
              const buffer = Buffer.from(payload);
              targetSockets?.forEach(targetWs => {
                if (targetWs.readyState === WebSocket.OPEN) {
                  try {
                    targetWs.send(buffer);
                  } catch (e) {
                    console.warn('[WS] Call relay error:', e);
                  }
                }
              });
            }
            break;
          }

          case 'PING': {
            lastPingTime = Date.now();
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
              } catch {}
            }
            break;
          }

          case 'PONG': {
            lastPingTime = Date.now();
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    });

    // Ultra-aggressive 10s ping for instant disconnect detection
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 10000);

    ws.on('close', () => {
      clearInterval(pingInterval);
      if (boundUserId) {
        const sockets = userIdToSockets.get(boundUserId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            const user = presenceCache?.getUser(boundUserId) || db.getUser(boundUserId);
            if (user && (user.current_channel === 'voice-general' || user.current_channel === 'video-general')) {
              broadcastMediaPresence('USER_LEFT_MEDIA', boundUserId, user.current_channel);
            }
            userIdToSockets.delete(boundUserId);
            db.deleteUser(boundUserId);
            presenceCache?.deleteUser(boundUserId);
            broadcastTable('users', presenceCache?.getAllUsers() || db.selectUsers());
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error:', err);
    });
  });

  presenceCache = new PresenceCache(db, (tableName, data) => {
    const payload = JSON.stringify({
      type: 'DB_SYNC',
      table: tableName,
      data,
      timestamp: Date.now(),
    });
    const buffer = Buffer.from(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(buffer);
        } catch {}
      }
    });
  });

  console.log(`🔌 WebSocket Database ULTRA-FAST mounted at /ws-db`);
}
