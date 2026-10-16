import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { createClient, Client } from '@libsql/client';

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
  sender_avatar_url?: string;
  content: string;
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'audio' | 'gif' | 'file' | string;
  attachment_name?: string;
  timestamp: string;
  created_at: number;
}

// Persistent Relational Tables backed by Turso (SQLite Cloud) with In-Memory fallback cache
class WebSocketDatabase {
  private client: Client | null = null;
  private initPromise: Promise<void> | null = null;
  public memoryUsers: Map<string, DbUser> = new Map();
  public memoryMessages: DbMessage[] = [];

  public channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'voice-general', name: 'general', type: 'voice' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

  constructor(url?: string, authToken?: string) {
    if (url && authToken) {
      try {
        this.client = createClient({ url, authToken });
        console.log('[Turso DB] Initialized client for:', url);
        this.ensureInit().catch((err) => {
          console.error('[Turso DB] Initial schema setup error:', err?.message || err);
        });
      } catch (err) {
        console.error('[Turso DB] Failed to create client:', err);
      }
    } else {
      console.warn('[Turso DB] No DATABASE_URL or DATABASE_AUTH_TOKEN provided, running in memory-mode.');
    }
  }

  public ensureInit(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.init().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  public async init() {
    if (!this.client) return;

    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS users (
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
      );`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        sender_avatar_url TEXT DEFAULT '',
        content TEXT NOT NULL,
        attachment_url TEXT,
        attachment_type TEXT,
        attachment_name TEXT,
        timestamp TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);`
    ];

    for (const sql of schemaStatements) {
      try {
        await this.client.execute(sql);
      } catch (err: any) {
        console.error('[Turso DB] Error executing DDL statement:', err?.message || err);
      }
    }

    try {
      const oneHourAgo = Date.now() - 3600000;
      await this.client.execute({
        sql: "DELETE FROM users WHERE current_channel = 'offline' OR updated_at < ?",
        args: [oneHourAgo]
      });
      console.log('✅ [Turso DB] Successfully connected and ensured database tables exist.');
    } catch (err: any) {
      console.warn('[Turso DB] Transient users cleanup warning:', err?.message || err);
    }
  }

  public async selectUsers(_where?: any): Promise<DbUser[]> {
    await this.ensureInit().catch(() => {});

    if (this.client) {
      try {
        const result = await this.client.execute('SELECT * FROM users ORDER BY updated_at DESC');
        const users: DbUser[] = result.rows.map((r: any) => ({
          id: String(r.id),
          username: String(r.username),
          avatar_color: String(r.avatar_color),
          avatar_url: r.avatar_url ? String(r.avatar_url) : '',
          current_channel: (r.current_channel || 'text-general') as any,
          is_speaking: Boolean(r.is_speaking),
          is_muted: Boolean(r.is_muted),
          is_deafened: Boolean(r.is_deafened),
          has_video: Boolean(r.has_video),
          is_screen_sharing: Boolean(r.is_screen_sharing),
          activity: r.activity ? String(r.activity) : '',
          updated_at: Number(r.updated_at),
        }));

        // Keep memory cache in sync
        this.memoryUsers.clear();
        for (const u of users) {
          this.memoryUsers.set(u.id, u);
        }
        return users;
      } catch (err: any) {
        if (err?.message?.includes('no such table')) {
          console.warn('[Turso DB] Table users missing, initializing tables now...');
          await this.init().catch(() => {});
          try {
            const retry = await this.client.execute('SELECT * FROM users ORDER BY updated_at DESC');
            const users: DbUser[] = retry.rows.map((r: any) => ({
              id: String(r.id),
              username: String(r.username),
              avatar_color: String(r.avatar_color),
              avatar_url: r.avatar_url ? String(r.avatar_url) : '',
              current_channel: (r.current_channel || 'text-general') as any,
              is_speaking: Boolean(r.is_speaking),
              is_muted: Boolean(r.is_muted),
              is_deafened: Boolean(r.is_deafened),
              has_video: Boolean(r.has_video),
              is_screen_sharing: Boolean(r.is_screen_sharing),
              activity: r.activity ? String(r.activity) : '',
              updated_at: Number(r.updated_at),
            }));
            this.memoryUsers.clear();
            for (const u of users) {
              this.memoryUsers.set(u.id, u);
            }
            return users;
          } catch {}
        }
        console.error('[Turso DB] selectUsers failed, falling back to memory:', err?.message || err);
      }
    }

    return Array.from(this.memoryUsers.values()).sort((a, b) => b.updated_at - a.updated_at);
  }

  public async getUser(userId: string): Promise<DbUser | null> {
    await this.ensureInit();

    if (this.client) {
      try {
        const result = await this.client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
        if (result.rows.length > 0) {
          const row = result.rows[0] as any;
          return {
            id: String(row.id),
            username: String(row.username),
            avatar_color: String(row.avatar_color),
            avatar_url: row.avatar_url ? String(row.avatar_url) : '',
            current_channel: (row.current_channel || 'text-general') as any,
            is_speaking: Boolean(row.is_speaking),
            is_muted: Boolean(row.is_muted),
            is_deafened: Boolean(row.is_deafened),
            has_video: Boolean(row.has_video),
            is_screen_sharing: Boolean(row.is_screen_sharing),
            activity: row.activity ? String(row.activity) : '',
            updated_at: Number(row.updated_at),
          };
        }
      } catch (err: any) {
        console.error('[Turso DB] getUser failed:', err?.message || err);
      }
    }

    return this.memoryUsers.get(userId) || null;
  }

  public async upsertUser(user: DbUser): Promise<void> {
    await this.ensureInit().catch(() => {});

    // Always update memory cache immediately
    this.memoryUsers.set(user.id, { ...user, updated_at: Date.now() });

    if (this.client) {
      const executeUpsert = async () => {
        if (user.is_screen_sharing) {
          await this.client!.execute({ sql: 'UPDATE users SET is_screen_sharing = 0 WHERE id != ?', args: [user.id] });
        }

        await this.client!.execute({
          sql: `
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
        `,
          args: [
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
          ]
        });
      };

      try {
        await executeUpsert();
      } catch (err: any) {
        if (err?.message?.includes('no such table')) {
          console.warn('[Turso DB] Table missing during upsertUser, re-initializing schemas...');
          await this.init().catch(() => {});
          try {
            await executeUpsert();
          } catch {}
        } else {
          console.error('[Turso DB] upsertUser failed:', err?.message || err);
        }
      }
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    await this.ensureInit().catch(() => {});
    this.memoryUsers.delete(userId);

    if (this.client) {
      try {
        await this.client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
      } catch (err: any) {
        console.error('[Turso DB] deleteUser failed:', err?.message || err);
      }
    }
  }

  public async insertMessage(msg: DbMessage): Promise<void> {
    await this.ensureInit().catch(() => {});

    this.memoryMessages.push(msg);
    if (this.memoryMessages.length > 500) {
      this.memoryMessages.shift();
    }

    if (this.client) {
      const executeInsert = async () => {
        await this.client!.execute({
          sql: `
          INSERT OR REPLACE INTO messages (
            id, channel_id, sender_id, sender_name, avatar_color, sender_avatar_url,
            content, attachment_url, attachment_type, attachment_name, timestamp, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          args: [
            msg.id,
            msg.channel_id,
            msg.sender_id,
            msg.sender_name,
            msg.avatar_color,
            msg.sender_avatar_url ?? '',
            msg.content,
            msg.attachment_url ?? null,
            msg.attachment_type ?? null,
            msg.attachment_name ?? null,
            msg.timestamp,
            msg.created_at
          ]
        });
      };

      try {
        await executeInsert();
      } catch (err: any) {
        if (err?.message?.includes('no such table')) {
          console.warn('[Turso DB] Table missing during insertMessage, re-initializing schemas...');
          await this.init().catch(() => {});
          try {
            await executeInsert();
          } catch {}
        } else {
          console.error('[Turso DB] insertMessage failed:', err?.message || err);
        }
      }
    }
  }

  public async selectAllMessages(): Promise<DbMessage[]> {
    await this.ensureInit().catch(() => {});

    if (this.client) {
      try {
        const result = await this.client.execute('SELECT * FROM messages ORDER BY created_at ASC LIMIT 500');
        const msgs: DbMessage[] = result.rows.map((r: any) => ({
          id: String(r.id),
          channel_id: String(r.channel_id),
          sender_id: String(r.sender_id),
          sender_name: String(r.sender_name),
          avatar_color: String(r.avatar_color),
          sender_avatar_url: r.sender_avatar_url ? String(r.sender_avatar_url) : undefined,
          content: String(r.content),
          attachment_url: r.attachment_url ? String(r.attachment_url) : undefined,
          attachment_type: r.attachment_type ? String(r.attachment_type) : undefined,
          attachment_name: r.attachment_name ? String(r.attachment_name) : undefined,
          timestamp: String(r.timestamp),
          created_at: Number(r.created_at),
        }));

        this.memoryMessages = msgs;
        return msgs;
      } catch (err: any) {
        if (err?.message?.includes('no such table')) {
          console.warn('[Turso DB] Table messages missing, creating now...');
          await this.init().catch(() => {});
          try {
            const retry = await this.client.execute('SELECT * FROM messages ORDER BY created_at ASC LIMIT 500');
            const msgs: DbMessage[] = retry.rows.map((r: any) => ({
              id: String(r.id),
              channel_id: String(r.channel_id),
              sender_id: String(r.sender_id),
              sender_name: String(r.sender_name),
              avatar_color: String(r.avatar_color),
              sender_avatar_url: r.sender_avatar_url ? String(r.sender_avatar_url) : undefined,
              content: String(r.content),
              attachment_url: r.attachment_url ? String(r.attachment_url) : undefined,
              attachment_type: r.attachment_type ? String(r.attachment_type) : undefined,
              attachment_name: r.attachment_name ? String(r.attachment_name) : undefined,
              timestamp: String(r.timestamp),
              created_at: Number(r.created_at),
            }));
            this.memoryMessages = msgs;
            return msgs;
          } catch {}
        }
        console.error('[Turso DB] selectAllMessages failed, returning memory copy:', err?.message || err);
      }
    }

    return [...this.memoryMessages];
  }

  public async selectMessages(channelId: string): Promise<DbMessage[]> {
    await this.ensureInit();

    if (this.client) {
      try {
        const result = await this.client.execute({
          sql: 'SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC LIMIT 500',
          args: [channelId]
        });
        return result.rows.map((r: any) => ({
          id: String(r.id),
          channel_id: String(r.channel_id),
          sender_id: String(r.sender_id),
          sender_name: String(r.sender_name),
          avatar_color: String(r.avatar_color),
          sender_avatar_url: r.sender_avatar_url ? String(r.sender_avatar_url) : undefined,
          content: String(r.content),
          attachment_url: r.attachment_url ? String(r.attachment_url) : undefined,
          attachment_type: r.attachment_type ? String(r.attachment_type) : undefined,
          attachment_name: r.attachment_name ? String(r.attachment_name) : undefined,
          timestamp: String(r.timestamp),
          created_at: Number(r.created_at),
        }));
      } catch (err: any) {
        console.error('[Turso DB] selectMessages failed:', err?.message || err);
      }
    }

    return this.memoryMessages.filter(m => m.channel_id === channelId);
  }

  public async deleteMessage(id: string): Promise<void> {
    await this.ensureInit();
    this.memoryMessages = this.memoryMessages.filter(m => m.id !== id);

    if (this.client) {
      try {
        await this.client.execute({ sql: 'DELETE FROM messages WHERE id = ?', args: [id] });
      } catch (err: any) {
        console.error('[Turso DB] deleteMessage failed:', err?.message || err);
      }
    }
  }
}

export function initWebSocketDatabase(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws-db' });
  const db = new WebSocketDatabase(process.env.DATABASE_URL, process.env.DATABASE_AUTH_TOKEN);

  // Trigger schema initialization immediately
  db.ensureInit().catch((err) => {
    console.error('[WebSocket DB] Failed table initialization:', err);
  });

  // Track multiple sockets per user ID (for multi-tab support)
  const userIdToSockets = new Map<string, Set<WebSocket>>();

  function broadcastTable(tableName: string, data: any) {
    const payload = JSON.stringify({
      type: 'DB_SYNC',
      table: tableName,
      data: Array.isArray(data) ? data : [],
      timestamp: Date.now(),
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  function broadcastMediaPresence(type: 'USER_JOINED_MEDIA' | 'USER_LEFT_MEDIA' | 'USER_MEDIA_UPDATE', userId: string, channel: string) {
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

  wss.on('connection', async (ws) => {
    let boundUserId: string | null = null;

    // Send initial snapshot safely
    try {
      const [users, messages] = await Promise.all([
        db.selectUsers(),
        db.selectAllMessages()
      ]);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'DB_INIT',
          tables: {
            users: Array.isArray(users) ? users : [],
            messages: Array.isArray(messages) ? messages : [],
            channels: db.channels,
          },
        }));
      }
    } catch (err) {
      console.error('[WebSocket DB] Failed to send initial snapshot:', err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'DB_INIT',
          tables: {
            users: [],
            messages: [],
            channels: db.channels,
          },
        }));
      }
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'SQL_QUERY': {
            if (msg.table === 'users') {
              const rows = await db.selectUsers(msg.where);
              ws.send(JSON.stringify({
                type: 'SQL_RESULT',
                requestId: msg.requestId,
                rows: Array.isArray(rows) ? rows : [],
              }));
            } else if (msg.table === 'messages') {
              const rows = await db.selectMessages(msg.channelId || 'text-general');
              ws.send(JSON.stringify({
                type: 'SQL_RESULT',
                requestId: msg.requestId,
                rows: Array.isArray(rows) ? rows : [],
              }));
            }
            break;
          }

          case 'SQL_INSERT': {
            if (msg.table === 'messages' && msg.row) {
              const newMsg: DbMessage = {
                id: msg.row.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
                channel_id: msg.row.channel_id || 'text-general',
                sender_id: msg.row.sender_id,
                sender_name: msg.row.sender_name,
                avatar_color: msg.row.avatar_color || '#0066ff',
                sender_avatar_url: msg.row.sender_avatar_url || '',
                content: msg.row.content || '',
                attachment_url: msg.row.attachment_url,
                attachment_type: msg.row.attachment_type,
                attachment_name: msg.row.attachment_name,
                timestamp: msg.row.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                created_at: msg.row.created_at || Date.now(),
              };
              await db.insertMessage(newMsg);
              const allMsgs = await db.selectAllMessages();
              broadcastTable('messages', allMsgs);
            }
            break;
          }

          case 'SQL_UPDATE': {
            if (msg.table === 'users' && msg.id) {
              let user = await db.getUser(msg.id);
              if (!user) {
                user = db.memoryUsers.get(msg.id) || null;
              }
              const oldChannel = user?.current_channel || 'text-general';
              const updated: DbUser = {
                id: msg.id,
                username: user?.username || 'User',
                avatar_color: user?.avatar_color || '#0066ff',
                avatar_url: user?.avatar_url || '',
                current_channel: (user?.current_channel || 'text-general') as any,
                is_speaking: false,
                is_muted: false,
                is_deafened: false,
                has_video: false,
                is_screen_sharing: false,
                activity: user?.activity || '',
                ...user,
                ...msg.set,
                updated_at: Date.now(),
              };
              await db.upsertUser(updated);
              const allUsers = await db.selectUsers();
              broadcastTable('users', allUsers);

              // Detect channel media transitions
              if (msg.set.current_channel !== undefined && msg.set.current_channel !== oldChannel) {
                if (msg.set.current_channel === 'voice-general' || msg.set.current_channel === 'video-general') {
                  broadcastMediaPresence('USER_JOINED_MEDIA', msg.id, msg.set.current_channel);
                }
                if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
                  broadcastMediaPresence('USER_LEFT_MEDIA', msg.id, oldChannel);
                }
              }

              // Explicitly broadcast media status changes (video/mute/screen-share)
              if (
                msg.set.has_video !== undefined ||
                msg.set.is_muted !== undefined ||
                msg.set.is_screen_sharing !== undefined
              ) {
                broadcastMediaPresence('USER_MEDIA_UPDATE', msg.id, updated.current_channel);
              }
            }
            break;
          }

          case 'SQL_DELETE': {
            if (msg.table === 'messages' && msg.id) {
              await db.deleteMessage(msg.id);
              const allMsgs = await db.selectAllMessages();
              broadcastTable('messages', allMsgs);
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

              await db.upsertUser({
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
              });
              const allUsers = await db.selectUsers();
              broadcastTable('users', allUsers);

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

          // Real-time Media Frame Relay (fallback for strict firewalls & instant video display)
          case 'MEDIA_FRAME': {
            if (msg.targetUserId) {
              const targetSockets = userIdToSockets.get(msg.targetUserId);
              targetSockets?.forEach(targetWs => {
                if (targetWs.readyState === WebSocket.OPEN) {
                  targetWs.send(JSON.stringify(msg));
                }
              });
            } else {
              const payload = JSON.stringify(msg);
              wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                  client.send(payload);
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
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[WebSocket DB] Parse error:', err);
      }
    });

    // Cloudflare/Render timeout prevention: Server-side periodic ping every 30 seconds
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
            userIdToSockets.delete(boundUserId);
            const uId = boundUserId;
            // Delay cleanup by 5 seconds to allow brief network hiccups / tab reloads without dropping voice
            setTimeout(async () => {
              if (!userIdToSockets.has(uId)) {
                const user = await db.getUser(uId);
                if (user && (user.current_channel === 'video-general' || user.current_channel === 'voice-general')) {
                  const updated: DbUser = {
                    ...user,
                    current_channel: 'text-general',
                    has_video: false,
                    is_screen_sharing: false,
                    is_speaking: false,
                    updated_at: Date.now(),
                  };
                  await db.upsertUser(updated);
                  broadcastMediaPresence('USER_LEFT_MEDIA', uId, user.current_channel);
                  const allUsers = await db.selectUsers();
                  broadcastTable('users', allUsers);
                }
              }
            }, 5000);
          }
        }
      }
    });
  });

  console.log(`🔌 WebSocket Database mounted at /ws-db with WebRTC Signaling & Turso cloud storage`);
}
