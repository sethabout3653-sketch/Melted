import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import pkg from 'pg';
const { Pool } = pkg;

// PostgreSQL Connection Pool for Supabase / Render Permanent Storage
const connectionString = process.env.DATABASE_URL;
let dbPool: pkg.Pool | null = null;
let isPostgresConnected = false;

if (connectionString) {
  dbPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  dbPool.query('SELECT NOW()')
    .then(() => {
      isPostgresConnected = true;
      console.log('✅ Connected to permanent PostgreSQL database (Supabase / Render Anchor)');
      initializePostgresTables();
    })
    .catch((err) => {
      console.warn('⚠️ Failed to connect to PostgreSQL (falling back to memory mode):', err.message);
      isPostgresConnected = false;
    });
} else {
  console.log('ℹ️ DATABASE_URL not set. Running WebSocket database in high-performance memory mode.');
}

async function initializePostgresTables() {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        avatar_color VARCHAR(50),
        avatar_url TEXT,
        current_channel VARCHAR(100) DEFAULT 'text-general',
        is_speaking BOOLEAN DEFAULT FALSE,
        is_muted BOOLEAN DEFAULT FALSE,
        is_deafened BOOLEAN DEFAULT FALSE,
        has_video BOOLEAN DEFAULT FALSE,
        is_screen_sharing BOOLEAN DEFAULT FALSE,
        updated_at BIGINT
      );
      CREATE TABLE IF NOT EXISTS app_messages (
        id VARCHAR(255) PRIMARY KEY,
        channel_id VARCHAR(100) DEFAULT 'text-general',
        sender_id VARCHAR(255),
        sender_name VARCHAR(255),
        avatar_color VARCHAR(50),
        sender_avatar_url TEXT,
        content TEXT,
        attachment_url TEXT,
        attachment_type VARCHAR(50),
        attachment_name TEXT,
        timestamp VARCHAR(50),
        created_at BIGINT
      );
    `);
    console.log('✅ PostgreSQL tables verified/initialized successfully.');
  } catch (err: any) {
    console.error('Error initializing Postgres tables:', err.message);
  }
}

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
  is_vertical?: boolean;
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
  attachment_type?: string;
  attachment_name?: string;
  timestamp: string;
  created_at: number;
}

// In-memory fallback and cache store
class InMemoryDatabase {
  private users: Map<string, DbUser> = new Map();
  private messages: DbMessage[] = [];
  public channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'voice-general', name: 'general', type: 'voice' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

  public selectUsers(where?: Partial<DbUser>): DbUser[] {
    const list = Array.from(this.users.values());
    if (!where) return list;
    return list.filter((user) => {
      return Object.entries(where).every(([key, val]) => (user as any)[key] === val);
    });
  }

  public getUser(userId: string): DbUser | null {
    return this.users.get(userId) || null;
  }

  public upsertUser(user: DbUser) {
    this.users.set(user.id, user);
  }

  public deleteUser(userId: string) {
    this.users.delete(userId);
  }

  public insertMessage(msg: DbMessage) {
    this.messages.push(msg);
    if (this.messages.length > 500) {
      this.messages.shift();
    }
  }

  public selectAllMessages(): DbMessage[] {
    return [...this.messages];
  }

  public selectMessages(channelId: string): DbMessage[] {
    return this.messages.filter(m => m.channel_id === channelId);
  }

  public deleteMessage(id: string) {
    this.messages = this.messages.filter(m => m.id !== id);
  }
}

export function initSocketIoDatabase(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    path: '/ws-db',
    cors: { origin: '*' }
  });
  
  const db = new InMemoryDatabase();
  const tableSubscriptions: Map<string, Set<string>> = new Map(); // table -> Set of socket IDs

  io.on('connection', (socket) => {
    let boundUserId: string | null = null;
    const socketSubscriptions = new Set<string>();

    // Send initial snapshot
    socket.emit('DB_INIT', {
      users: db.selectUsers(),
      messages: db.selectAllMessages(),
      channels: db.channels,
      postgresConnected: isPostgresConnected,
    });

    // Handle Supabase/Render JSON WebSocket router protocol messages
    socket.on('MESSAGE', async (msg: any) => {
      try {
        if (!msg || !msg.type) return;

        if (msg.type === 'subscribe') {
          const table = msg.table;
          if (table) {
            socketSubscriptions.add(table);
            if (!tableSubscriptions.has(table)) tableSubscriptions.set(table, new Set());
            tableSubscriptions.get(table)?.add(socket.id);
            socket.emit('ACK', { type: 'subscribed', table });
          }
        } else if (msg.type === 'insert') {
          const { table, data } = msg;
          if (table === 'messages' && data) {
            const newMsg: DbMessage = {
              id: data.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
              channel_id: data.channel_id || 'text-general',
              sender_id: data.sender_id,
              sender_name: data.sender_name,
              avatar_color: data.avatar_color || '#0066ff',
              sender_avatar_url: data.sender_avatar_url,
              content: data.content || '',
              attachment_url: data.attachment_url,
              attachment_type: data.attachment_type,
              attachment_name: data.attachment_name,
              timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              created_at: Date.now(),
            };
            db.insertMessage(newMsg);

            // Persist to Postgres if available
            if (isPostgresConnected && dbPool) {
              await dbPool.query(
                `INSERT INTO app_messages (id, channel_id, sender_id, sender_name, avatar_color, sender_avatar_url, content, attachment_url, attachment_type, attachment_name, timestamp, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
                [newMsg.id, newMsg.channel_id, newMsg.sender_id, newMsg.sender_name, newMsg.avatar_color, newMsg.sender_avatar_url, newMsg.content, newMsg.attachment_url, newMsg.attachment_type, newMsg.attachment_name, newMsg.timestamp, newMsg.created_at]
              ).catch(err => console.error('PG insert error:', err.message));
            }

            io.emit('DB_SYNC', { table: 'messages', data: db.selectAllMessages() });
          }
        }
      } catch (err: any) {
        console.error('WebSocket router message error:', err.message);
      }
    });

    socket.on('SQL_QUERY', async (msg) => {
      if (msg.table === 'users') {
        socket.emit('SQL_RESULT', { requestId: msg.requestId, rows: db.selectUsers(msg.where) });
      } else if (msg.table === 'messages') {
        let msgs = db.selectMessages(msg.channelId || 'text-general');
        if (isPostgresConnected && dbPool) {
          try {
            const res = await dbPool.query('SELECT * FROM app_messages WHERE channel_id = $1 ORDER BY created_at ASC LIMIT 100', [msg.channelId || 'text-general']);
            if (res.rows.length > 0) msgs = res.rows;
          } catch (e) {}
        }
        socket.emit('SQL_RESULT', { requestId: msg.requestId, rows: msgs });
      }
    });

    socket.on('SQL_INSERT', async (msg) => {
      if (msg.table === 'messages') {
        const row = msg.row || {};
        const newMsg: DbMessage = {
          id: row.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4)),
          channel_id: row.channel_id || 'text-general',
          sender_id: row.sender_id,
          sender_name: row.sender_name,
          avatar_color: row.avatar_color || '#0066ff',
          sender_avatar_url: row.sender_avatar_url,
          content: row.content || '',
          attachment_url: row.attachment_url,
          attachment_type: row.attachment_type,
          attachment_name: row.attachment_name,
          timestamp: row.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          created_at: Date.now(),
        };
        db.insertMessage(newMsg);

        if (isPostgresConnected && dbPool) {
          await dbPool.query(
            `INSERT INTO app_messages (id, channel_id, sender_id, sender_name, avatar_color, sender_avatar_url, content, attachment_url, attachment_type, attachment_name, timestamp, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
            [newMsg.id, newMsg.channel_id, newMsg.sender_id, newMsg.sender_name, newMsg.avatar_color, newMsg.sender_avatar_url, newMsg.content, newMsg.attachment_url, newMsg.attachment_type, newMsg.attachment_name, newMsg.timestamp, newMsg.created_at]
          ).catch(err => console.error('PG insert error:', err.message));
        }

        io.emit('DB_SYNC', { table: 'messages', data: db.selectAllMessages() });
      }
    });

    socket.on('SQL_UPDATE', async (msg) => {
      if (msg.table === 'users') {
        const user = db.getUser(msg.id);
        if (user) {
          const oldChannel = user.current_channel;
          const updated: DbUser = { ...user, ...msg.set, updated_at: Date.now() };
          db.upsertUser(updated);

          if (isPostgresConnected && dbPool) {
            await dbPool.query(
              `INSERT INTO app_users (id, username, avatar_color, avatar_url, current_channel, is_speaking, is_muted, is_deafened, has_video, is_screen_sharing, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, avatar_color = EXCLUDED.avatar_color, avatar_url = EXCLUDED.avatar_url, current_channel = EXCLUDED.current_channel, is_speaking = EXCLUDED.is_speaking, is_muted = EXCLUDED.is_muted, is_deafened = EXCLUDED.is_deafened, has_video = EXCLUDED.has_video, is_screen_sharing = EXCLUDED.is_screen_sharing, updated_at = EXCLUDED.updated_at`,
              [updated.id, updated.username, updated.avatar_color, updated.avatar_url, updated.current_channel, updated.is_speaking, updated.is_muted, updated.is_deafened, updated.has_video, updated.is_screen_sharing, updated.updated_at]
            ).catch(err => console.error('PG user update error:', err.message));
          }

          io.emit('DB_SYNC', { table: 'users', data: db.selectUsers() });

          if (msg.set.current_channel && msg.set.current_channel !== oldChannel) {
            if (['voice-general', 'video-general'].includes(msg.set.current_channel)) {
              io.emit('USER_JOINED_MEDIA', { userId: msg.id, channel: msg.set.current_channel });
            }
            if (['voice-general', 'video-general'].includes(oldChannel)) {
              io.emit('USER_LEFT_MEDIA', { userId: msg.id, channel: oldChannel });
            }
          }
        }
      }
    });

    socket.on('SQL_DELETE', async (msg) => {
      if (msg.table === 'messages' && msg.id) {
        db.deleteMessage(msg.id);
        if (isPostgresConnected && dbPool) {
          await dbPool.query('DELETE FROM app_messages WHERE id = $1', [msg.id]).catch(() => {});
        }
        io.emit('DB_SYNC', { table: 'messages', data: db.selectAllMessages() });
      }
    });

    socket.on('REGISTER_USER', async (msg) => {
      const uId: string = msg.user.id;
      boundUserId = uId;
      socket.join(uId);

      const newUser: DbUser = {
        id: uId,
        username: msg.user.username,
        avatar_color: msg.user.avatar_color || '#0066ff',
        avatar_url: msg.user.avatar_url,
        current_channel: msg.user.current_channel || 'text-general',
        is_speaking: Boolean(msg.user.is_speaking),
        is_muted: Boolean(msg.user.is_muted),
        is_deafened: Boolean(msg.user.is_deafened),
        has_video: Boolean(msg.user.has_video),
        is_screen_sharing: Boolean(msg.user.is_screen_sharing),
        is_vertical: Boolean(msg.user.is_vertical),
        updated_at: Date.now(),
      };
      db.upsertUser(newUser);

      if (isPostgresConnected && dbPool) {
        await dbPool.query(
          `INSERT INTO app_users (id, username, avatar_color, avatar_url, current_channel, is_speaking, is_muted, is_deafened, has_video, is_screen_sharing, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, avatar_color = EXCLUDED.avatar_color, avatar_url = EXCLUDED.avatar_url, current_channel = EXCLUDED.current_channel, is_speaking = EXCLUDED.is_speaking, is_muted = EXCLUDED.is_muted, is_deafened = EXCLUDED.is_deafened, has_video = EXCLUDED.has_video, is_screen_sharing = EXCLUDED.is_screen_sharing, updated_at = EXCLUDED.updated_at`,
          [newUser.id, newUser.username, newUser.avatar_color, newUser.avatar_url, newUser.current_channel, newUser.is_speaking, newUser.is_muted, newUser.is_deafened, newUser.has_video, newUser.is_screen_sharing, newUser.updated_at]
        ).catch(err => console.error('PG register error:', err.message));
      }

      io.emit('DB_SYNC', { table: 'users', data: db.selectUsers() });

      if (['voice-general', 'video-general'].includes(msg.user.current_channel)) {
        io.emit('USER_JOINED_MEDIA', { userId: uId, channel: msg.user.current_channel });
      }
    });

    socket.on('RTC_SIGNAL', (msg) => {
      socket.to(msg.targetUserId).emit('RTC_SIGNAL', {
        fromUserId: msg.fromUserId,
        targetUserId: msg.targetUserId,
        signal: msg.signal,
      });
    });

    socket.on('USER_CALL', (msg) => {
      socket.to(msg.targetUserId).emit('USER_CALL', {
        fromUserId: msg.fromUserId,
        fromUserName: msg.fromUserName,
        callType: msg.callType,
      });
    });

    socket.on('disconnect', () => {
      socketSubscriptions.forEach(table => {
        tableSubscriptions.get(table)?.delete(socket.id);
      });
      if (boundUserId) {
        const user = db.getUser(boundUserId);
        if (user && ['voice-general', 'video-general'].includes(user.current_channel)) {
          io.emit('USER_LEFT_MEDIA', { userId: boundUserId, channel: user.current_channel });
        }
        db.deleteUser(boundUserId);
        io.emit('DB_SYNC', { table: 'users', data: db.selectUsers() });
      }
    });
  });

  console.log(`🔌 WebSocket Database Router mounted at /ws-db (PostgreSQL persistence: ${isPostgresConnected ? 'ENABLED' : 'MEMORY MODE'})`);
}
