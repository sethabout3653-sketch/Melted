import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

// Reusing the same interface for compatibility
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
  attachment_type?: 'image' | 'video' | 'audio' | 'gif' | 'file' | string;
  attachment_name?: string;
  timestamp: string;
  created_at: number;
}

// In-memory state management
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

  io.on('connection', (socket) => {
    let boundUserId: string | null = null;

    // Send initial snapshot
    socket.emit('DB_INIT', {
      users: db.selectUsers(),
      messages: db.selectAllMessages(),
      channels: db.channels,
    });

    socket.on('SQL_QUERY', (msg) => {
      if (msg.table === 'users') {
        socket.emit('SQL_RESULT', { requestId: msg.requestId, rows: db.selectUsers(msg.where) });
      } else if (msg.table === 'messages') {
        socket.emit('SQL_RESULT', { requestId: msg.requestId, rows: db.selectMessages(msg.channelId || 'text-general') });
      }
    });

    socket.on('SQL_INSERT', (msg) => {
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
        io.emit('DB_SYNC', { table: 'messages', data: db.selectAllMessages() });
      }
    });

    socket.on('SQL_UPDATE', (msg) => {
      if (msg.table === 'users') {
        const user = db.getUser(msg.id);
        if (user) {
          const oldChannel = user.current_channel;
          const updated: DbUser = { ...user, ...msg.set, updated_at: Date.now() };
          db.upsertUser(updated);
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

    socket.on('SQL_DELETE', (msg) => {
      if (msg.table === 'messages' && msg.id) {
        db.deleteMessage(msg.id);
        io.emit('DB_SYNC', { table: 'messages', data: db.selectAllMessages() });
      }
    });

    socket.on('REGISTER_USER', (msg) => {
      const uId: string = msg.user.id;
      boundUserId = uId;
      socket.join(uId);

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
        is_vertical: Boolean(msg.user.is_vertical),
        updated_at: Date.now(),
      });
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

  console.log(`🔌 Socket.io Database mounted at /ws-db`);
}
