import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Pure WebSocket Database: Authoritative in-memory state with local JSON persistence
class WebSocketDatabase {
  public users: Map<string, DbUser> = new Map();
  public messages: DbMessage[] = [];
  private dbFilePath: string;

  public channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

  constructor() {
    this.dbFilePath = path.resolve(__dirname, '..', '..', 'ws_db_store.json');
    this.loadStore();
  }

  private loadStore() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.messages)) {
          this.messages = data.messages.slice(-500);
        }
        // Online users are strictly those currently connected with live WebSockets.
        // Never load stale/offline users on server startup!
        this.users.clear();
      }
    } catch (err) {
      console.warn('[WebSocket DB] Notice loading store:', err);
    }
  }

  private saveStore() {
    try {
      const data = {
        messages: this.messages.slice(-500),
        updated_at: Date.now(),
      };
      fs.writeFileSync(this.dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[WebSocket DB] Notice saving store:', err);
    }
  }

  public getUsers(activeUserIds?: Set<string>): DbUser[] {
    if (activeUserIds) {
      // Clean up users that are no longer actively connected
      for (const id of Array.from(this.users.keys())) {
        if (!activeUserIds.has(id)) {
          this.users.delete(id);
        }
      }
      return Array.from(this.users.values())
        .filter((u) => activeUserIds.has(u.id))
        .sort((a, b) => b.updated_at - a.updated_at);
    }
    return Array.from(this.users.values()).sort((a, b) => b.updated_at - a.updated_at);
  }

  public getUser(userId: string): DbUser | null {
    return this.users.get(userId) || null;
  }

  public deleteUser(userId: string): void {
    this.users.delete(userId);
  }

  public upsertUser(user: DbUser): void {
    const existing = this.users.get(user.id);
    const updated: DbUser = {
      ...(existing || {}),
      ...user,
      updated_at: Date.now(),
    };
    this.users.set(user.id, updated);
  }

  public insertMessage(msg: DbMessage): void {
    const existingIndex = this.messages.findIndex(m => m.id === msg.id);
    if (existingIndex >= 0) {
      this.messages[existingIndex] = msg;
    } else {
      this.messages.push(msg);
      if (this.messages.length > 500) {
        this.messages.shift();
      }
    }
    this.saveStore();
  }

  public deleteMessage(id: string): void {
    this.messages = this.messages.filter(m => m.id !== id);
    this.saveStore();
  }
}

export function initWebSocketDatabase(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws-db' });
  const db = new WebSocketDatabase();

  const userSockets = new Map<string, Set<WebSocket>>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  function getActiveUserIds(): Set<string> {
    const active = new Set<string>();
    userSockets.forEach((sockets, uid) => {
      if (sockets.size > 0) active.add(uid);
    });
    return active;
  }

  function broadcast(payload: any) {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(str);
        } catch {}
      }
    });
  }

  function broadcastTable(tableName: string, data: any) {
    broadcast({
      type: 'DB_SYNC',
      table: tableName,
      data: Array.isArray(data) ? data : [],
      timestamp: Date.now(),
    });
  }

  function broadcastMediaPresence(type: 'USER_JOINED_MEDIA' | 'USER_LEFT_MEDIA' | 'USER_MEDIA_UPDATE', userId: string, channel: string) {
    broadcast({
      type,
      userId,
      channel,
      timestamp: Date.now(),
    });
  }

  wss.on('connection', (ws) => {
    let boundUserId: string | null = null;

    // Send initial snapshot immediately upon connecting
    const users = db.getUsers(getActiveUserIds());
    const messages = db.messages;
    try {
      ws.send(JSON.stringify({
        type: 'DB_INIT',
        tables: {
          users,
          messages,
          channels: db.channels,
        },
      }));
    } catch {}

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        switch (msg.type) {
          case 'REGISTER_USER': {
            if (msg.user && msg.user.id) {
              const uId: string = msg.user.id;
              boundUserId = uId;

              if (disconnectTimers.has(uId)) {
                clearTimeout(disconnectTimers.get(uId)!);
                disconnectTimers.delete(uId);
              }

              if (!userSockets.has(uId)) {
                userSockets.set(uId, new Set());
              }
              userSockets.get(uId)!.add(ws);

              const existingUser = db.getUser(uId);
              const userObj: DbUser = {
                id: uId,
                username: msg.user.username || existingUser?.username || 'Player',
                avatar_color: msg.user.avatar_color || existingUser?.avatar_color || '#0066ff',
                avatar_url: msg.user.avatar_url ?? existingUser?.avatar_url ?? '',
                current_channel: msg.user.current_channel || existingUser?.current_channel || 'text-general',
                is_speaking: Boolean(msg.user.is_speaking),
                is_muted: Boolean(msg.user.is_muted),
                is_deafened: Boolean(msg.user.is_deafened),
                // Camera and screen sharing are strictly false on register unless explicitly sent as true
                has_video: msg.user.has_video === true,
                is_screen_sharing: msg.user.is_screen_sharing === true,
                activity: msg.user.activity ?? existingUser?.activity ?? '',
                updated_at: Date.now(),
              };

              db.upsertUser(userObj);
              broadcastTable('users', db.getUsers(getActiveUserIds()));

              if (userObj.current_channel === 'voice-general' || userObj.current_channel === 'video-general') {
                broadcastMediaPresence('USER_JOINED_MEDIA', uId, userObj.current_channel);
              }
            }
            break;
          }

          case 'SQL_UPDATE': {
            if (msg.table === 'users' && msg.id) {
              const existing = db.getUser(msg.id);
              const oldChannel = existing?.current_channel || 'text-general';
              const updated: DbUser = {
                id: msg.id,
                username: existing?.username || 'Player',
                avatar_color: existing?.avatar_color || '#0066ff',
                avatar_url: existing?.avatar_url || '',
                current_channel: existing?.current_channel || 'text-general',
                is_speaking: false,
                is_muted: false,
                is_deafened: false,
                has_video: false,
                is_screen_sharing: false,
                activity: existing?.activity || '',
                ...existing,
                ...msg.set,
                updated_at: Date.now(),
              };

              // If switching to text-general or offline, strictly clear media active flags
              if (updated.current_channel === 'text-general' || updated.current_channel === 'offline') {
                updated.has_video = false;
                updated.is_screen_sharing = false;
                updated.is_speaking = false;
              }

              // Single screen sharer enforcement
              if (msg.set.is_screen_sharing) {
                db.users.forEach((u, uid) => {
                  if (uid !== msg.id && u.is_screen_sharing) {
                    u.is_screen_sharing = false;
                  }
                });
              }

              db.upsertUser(updated);
              broadcastTable('users', db.getUsers(getActiveUserIds()));

              // Channel media transitions
              if (msg.set.current_channel !== undefined && msg.set.current_channel !== oldChannel) {
                if (msg.set.current_channel === 'voice-general' || msg.set.current_channel === 'video-general') {
                  broadcastMediaPresence('USER_JOINED_MEDIA', msg.id, msg.set.current_channel);
                }
                if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
                  broadcastMediaPresence('USER_LEFT_MEDIA', msg.id, oldChannel);
                }
              }

              // Explicit media updates
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

          case 'SQL_INSERT': {
            if (msg.table === 'messages' && msg.row) {
              const row = msg.row;
              const newMsg: DbMessage = {
                id: row.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6)),
                channel_id: row.channel_id || 'text-general',
                sender_id: row.sender_id || boundUserId || 'anon',
                sender_name: row.sender_name || 'Player',
                avatar_color: row.avatar_color || '#0066ff',
                sender_avatar_url: row.sender_avatar_url || '',
                content: row.content || '',
                attachment_url: row.attachment_url,
                attachment_type: row.attachment_type,
                attachment_name: row.attachment_name,
                timestamp: row.timestamp || ('Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                created_at: Number(row.created_at) || Date.now(),
              };
              db.insertMessage(newMsg);
              broadcastTable('messages', db.messages);
            }
            break;
          }

          case 'SQL_DELETE': {
            if (msg.table === 'messages' && msg.id) {
              db.deleteMessage(msg.id);
              broadcastTable('messages', db.messages);
            }
            break;
          }

          case 'RTC_SIGNAL': {
            if (msg.targetUserId) {
              const sockets = userSockets.get(msg.targetUserId);
              if (sockets) {
                const signalPayload = JSON.stringify({
                  type: 'RTC_SIGNAL',
                  fromUserId: msg.fromUserId || boundUserId,
                  targetUserId: msg.targetUserId,
                  signal: msg.signal,
                });
                sockets.forEach((s) => {
                  if (s.readyState === WebSocket.OPEN) {
                    try { s.send(signalPayload); } catch {}
                  }
                });
              }
            }
            break;
          }

          case 'USER_CALL': {
            if (msg.targetUserId) {
              const sockets = userSockets.get(msg.targetUserId);
              if (sockets) {
                const callPayload = JSON.stringify({
                  type: 'USER_CALL',
                  fromUserId: msg.fromUserId || boundUserId,
                  fromUserName: msg.fromUserName || 'Player',
                  targetUserId: msg.targetUserId,
                  callType: msg.callType || 'audio',
                });
                sockets.forEach((s) => {
                  if (s.readyState === WebSocket.OPEN) {
                    try { s.send(callPayload); } catch {}
                  }
                });
              }
            }
            break;
          }

          case 'PING': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.warn('[WebSocket DB] Message parse warning:', err);
      }
    });

    const pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 20000);

    ws.on('close', () => {
      clearInterval(pingTimer);
      if (boundUserId) {
        const uId = boundUserId;
        const sockets = userSockets.get(uId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            userSockets.delete(uId);

            const timer = setTimeout(() => {
              disconnectTimers.delete(uId);
              if (!userSockets.has(uId)) {
                const user = db.getUser(uId);
                const oldChannel = user?.current_channel;
                db.deleteUser(uId);
                if (oldChannel === 'video-general' || oldChannel === 'voice-general') {
                  broadcastMediaPresence('USER_LEFT_MEDIA', uId, oldChannel);
                }
                broadcastTable('users', db.getUsers(getActiveUserIds()));
              }
            }, 3000);
            disconnectTimers.set(uId, timer);
          }
        }
      }
    });
  });

  console.log(`🔌 Pure WebSocket Database mounted at /ws-db`);
}
