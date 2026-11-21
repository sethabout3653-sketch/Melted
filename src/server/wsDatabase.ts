import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server } from 'http';

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
  is_hand_raised?: boolean;
  activity?: string;
  typing_channel?: string;
  typing_at?: number;
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
  // Client-only transient upload state (stripped before WS/Firestore persistence)
  is_uploading?: boolean;
  upload_progress?: number;
  upload_error?: string;
}

export interface PendingSignal {
  id: string;
  fromUserId: string;
  targetUserId: string;
  type: 'RTC_SIGNAL';
  signal?: any;
  sigId?: string;
  timestamp: number;
}

// Ephemeral in-memory state (presence, voice/video rooms, typing & WebRTC signaling; chat history lives in Firebase)
const DISCONNECT_GRACE_MS = 60000;

export class WebSocketDatabase {
  public users: Map<string, DbUser> = new Map();
  public pendingSignals: Map<string, PendingSignal[]> = new Map(); // targetUserId -> signals
  public deletedMessageIds: Set<string> = new Set();

  public channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

  public markMessageDeleted(messageId: string): void {
    if (!messageId) return;
    this.deletedMessageIds.add(messageId);
    if (this.deletedMessageIds.size > 1000) {
      const oldest = this.deletedMessageIds.values().next().value;
      if (oldest) this.deletedMessageIds.delete(oldest);
    }
  }

  public getUsers(): DbUser[] {
    const now = Date.now();
    const active: DbUser[] = [];
    this.users.forEach((u) => {
      // 5 minutes TTL to prevent users from disappearing during idle or game sessions
      if (now - (u.updated_at || 0) < 300000) {
        active.push(u);
      }
    });
    return active.sort((a, b) => {
      const nameA = (a.username || '').toLowerCase();
      const nameB = (b.username || '').toLowerCase();
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }
      return (a.id || '').localeCompare(b.id || '');
    });
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

  public addPendingSignal(signal: PendingSignal): void {
    const list = this.pendingSignals.get(signal.targetUserId) || [];
    list.push(signal);
    if (list.length > 50) list.shift();
    this.pendingSignals.set(signal.targetUserId, list);
  }

  public popPendingSignals(targetUserId: string): PendingSignal[] {
    const list = this.pendingSignals.get(targetUserId) || [];
    this.pendingSignals.delete(targetUserId);
    return list;
  }
}

export const globalWsDb = new WebSocketDatabase();

let activeIo: SocketIOServer | null = null;
const userSocketsMap = new Map<string, Set<Socket>>();

export function sendToUserSockets(targetUserId: string, payload: any): boolean {
  if (!targetUserId) return false;
  const sockets = userSocketsMap.get(targetUserId);
  if (!sockets || sockets.size === 0) return false;
  let delivered = false;
  sockets.forEach((s) => {
    if (s.connected) {
      s.emit('message', payload);
      delivered = true;
    }
  });
  return delivered;
}

export function broadcastWss(payload: any) {
  activeIo?.emit('message', payload);
}

export function broadcastTable(tableName: string, data: any) {
  broadcastWss({
    type: 'DB_SYNC',
    table: tableName,
    data: Array.isArray(data) ? data : [],
    timestamp: Date.now(),
  });
}

export function initWebSocketDatabase(server: Server): void {
  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
    pingInterval: 10000,
    pingTimeout: 20000,
  });
  activeIo = io;

  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  function broadcastMediaPresence(type: 'USER_JOINED_MEDIA' | 'USER_LEFT_MEDIA' | 'USER_MEDIA_UPDATE', userId: string, channel: string) {
    broadcastWss({
      type,
      userId,
      channel,
      timestamp: Date.now(),
    });
  }

  io.on('connection', (socket) => {
    let boundUserId: string | null = null;

    socket.emit('message', {
      type: 'DB_INIT',
      tables: {
        users: globalWsDb.getUsers(),
        channels: globalWsDb.channels,
        deletedIds: Array.from(globalWsDb.deletedMessageIds).slice(-200),
      },
    });

    socket.on('message', (msg: any) => {
      try {
        if (boundUserId) {
          const u = globalWsDb.getUser(boundUserId);
          if (u) {
            u.updated_at = Date.now();
          }
        }

        switch (msg?.type) {
          case 'REGISTER_USER': {
            if (msg.user && msg.user.id) {
              const uId: string = msg.user.id;
              boundUserId = uId;

              if (disconnectTimers.has(uId)) {
                clearTimeout(disconnectTimers.get(uId)!);
                disconnectTimers.delete(uId);
              }

              if (!userSocketsMap.has(uId)) {
                userSocketsMap.set(uId, new Set());
              }
              userSocketsMap.get(uId)!.add(socket);

              const existingUser = globalWsDb.getUser(uId);
              const userObj: DbUser = {
                id: uId,
                username: msg.user.username || existingUser?.username || 'Player',
                avatar_color: msg.user.avatar_color || existingUser?.avatar_color || '#0066ff',
                avatar_url: msg.user.avatar_url ?? existingUser?.avatar_url ?? '',
                current_channel: msg.user.current_channel || existingUser?.current_channel || 'text-general',
                is_speaking: msg.user.is_speaking !== undefined ? Boolean(msg.user.is_speaking) : Boolean(existingUser?.is_speaking),
                is_muted: msg.user.is_muted !== undefined ? Boolean(msg.user.is_muted) : Boolean(existingUser?.is_muted),
                is_deafened: msg.user.is_deafened !== undefined ? Boolean(msg.user.is_deafened) : Boolean(existingUser?.is_deafened),
                has_video: msg.user.has_video !== undefined ? Boolean(msg.user.has_video) : Boolean(existingUser?.has_video),
                is_screen_sharing: msg.user.is_screen_sharing !== undefined ? Boolean(msg.user.is_screen_sharing) : Boolean(existingUser?.is_screen_sharing),
                activity: msg.user.activity ?? existingUser?.activity ?? '',
                typing_channel: msg.user.typing_channel ?? existingUser?.typing_channel ?? undefined,
                typing_at: msg.user.typing_at ?? existingUser?.typing_at ?? undefined,
                updated_at: Date.now(),
              };

              globalWsDb.upsertUser(userObj);
              broadcastTable('users', globalWsDb.getUsers());

              if (userObj.current_channel === 'voice-general' || userObj.current_channel === 'video-general') {
                broadcastMediaPresence('USER_JOINED_MEDIA', uId, userObj.current_channel);
              }

              const queued = globalWsDb.popPendingSignals(uId);
              queued.forEach((s) => socket.emit('message', s));
            }
            break;
          }

          case 'SQL_UPDATE': {
            if (msg.table === 'users' && msg.id) {
              const existing = globalWsDb.getUser(msg.id);
              const oldChannel = existing?.current_channel || 'text-general';
              const updated: DbUser = {
                id: msg.id,
                username: existing?.username || 'Player',
                avatar_color: existing?.avatar_color || '#0066ff',
                avatar_url: existing?.avatar_url || '',
                current_channel: existing?.current_channel || 'text-general',
                is_speaking: existing?.is_speaking || false,
                is_muted: existing?.is_muted || false,
                is_deafened: existing?.is_deafened || false,
                has_video: existing?.has_video || false,
                is_screen_sharing: existing?.is_screen_sharing || false,
                activity: existing?.activity || '',
                ...existing,
                ...msg.set,
                updated_at: Date.now(),
              };

              if (updated.current_channel === 'text-general' || updated.current_channel === 'offline') {
                updated.has_video = false;
                updated.is_screen_sharing = false;
                updated.is_speaking = false;
              }

              if (msg.set?.is_screen_sharing) {
                globalWsDb.users.forEach((u, uid) => {
                  if (uid !== msg.id && u.is_screen_sharing) {
                    u.is_screen_sharing = false;
                  }
                });
              }

              globalWsDb.upsertUser(updated);
              broadcastTable('users', globalWsDb.getUsers());

              if (msg.set?.current_channel !== undefined && msg.set.current_channel !== oldChannel) {
                if (msg.set.current_channel === 'voice-general' || msg.set.current_channel === 'video-general') {
                  broadcastMediaPresence('USER_JOINED_MEDIA', msg.id, msg.set.current_channel);
                }
                if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
                  broadcastMediaPresence('USER_LEFT_MEDIA', msg.id, oldChannel);
                }
              }

              if (
                msg.set?.has_video !== undefined ||
                msg.set?.is_muted !== undefined ||
                msg.set?.is_screen_sharing !== undefined
              ) {
                broadcastMediaPresence('USER_MEDIA_UPDATE', msg.id, updated.current_channel);
              }
            }
            break;
          }

          case 'GET_USERS': {
            broadcastTable('users', globalWsDb.getUsers());
            break;
          }

          case 'SQL_INSERT': {
            if (msg.table === 'messages' && msg.row) {
              const row = msg.row;
              const msgId = row.id || ('msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6));
              if (globalWsDb.deletedMessageIds.has(msgId)) {
                break;
              }
              const newMsg: DbMessage = {
                id: msgId,
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
              // Real-time relay only (Firebase persists chat history)
              broadcastTable('messages', [newMsg]);
            }
            break;
          }

          case 'SQL_DELETE': {
            if (msg.table === 'messages' && msg.id) {
              globalWsDb.markMessageDeleted(msg.id);
              broadcastWss({ type: 'SQL_DELETE', table: 'messages', id: msg.id });
            }
            break;
          }

          case 'SQL_DELETE_CHANNEL': {
            if (msg.channel_id) {
              broadcastWss({ type: 'SQL_DELETE_CHANNEL', table: 'messages', channel_id: msg.channel_id });
            }
            break;
          }

          case 'SQL_DELETE_ALL': {
            globalWsDb.deletedMessageIds.clear();
            broadcastWss({ type: 'DB_CLEAR_MESSAGES' });
            break;
          }

          case 'RTC_SIGNAL': {
            if (msg.targetUserId && msg.targetUserId !== boundUserId) {
              const signalPayload = {
                type: 'RTC_SIGNAL',
                fromUserId: msg.fromUserId || boundUserId,
                targetUserId: msg.targetUserId,
                signal: msg.signal,
                sigId: msg.sigId,
              };

              const delivered = sendToUserSockets(msg.targetUserId, signalPayload);

              if (!delivered) {
                globalWsDb.addPendingSignal({
                  id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  fromUserId: msg.fromUserId || boundUserId || 'anon',
                  targetUserId: msg.targetUserId,
                  type: 'RTC_SIGNAL',
                  signal: msg.signal,
                  sigId: msg.sigId,
                  timestamp: Date.now(),
                });
              }
            }
            break;
          }

          case 'USER_OFFLINE':
          case 'USER_DISCONNECT': {
            const uId = msg.userId || boundUserId;
            if (uId) {
              const sockets = userSocketsMap.get(uId);
              if (sockets) {
                sockets.delete(socket);
                if (sockets.size === 0) {
                  userSocketsMap.delete(uId);
                }
              }
              const user = globalWsDb.getUser(uId);
              const oldChannel = user?.current_channel;
              globalWsDb.deleteUser(uId);
              broadcastTable('users', globalWsDb.getUsers());
              if (oldChannel === 'video-general' || oldChannel === 'voice-general') {
                broadcastMediaPresence('USER_LEFT_MEDIA', uId, oldChannel);
              }
            }
            break;
          }

          case 'PING': {
            socket.emit('message', { type: 'PONG', timestamp: Date.now() });
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.warn('[Socket.IO DB] Message handling warning:', err);
      }
    });

    socket.on('disconnect', () => {
      if (!boundUserId) return;
      const uId = boundUserId;
      const sockets = userSocketsMap.get(uId);
      if (!sockets) return;
      sockets.delete(socket);
      if (sockets.size === 0) {
        userSocketsMap.delete(uId);
        const timer = setTimeout(() => {
          disconnectTimers.delete(uId);
          if (userSocketsMap.has(uId)) return;
          const user = globalWsDb.getUser(uId);
          const oldChannel = user?.current_channel;
          globalWsDb.deleteUser(uId);
          broadcastTable('users', globalWsDb.getUsers());
          if (oldChannel === 'video-general' || oldChannel === 'voice-general') {
            broadcastMediaPresence('USER_LEFT_MEDIA', uId, oldChannel);
          }
        }, DISCONNECT_GRACE_MS);
        disconnectTimers.set(uId, timer);
      }
    });
  });

  console.log('🔌 Socket.IO database hub mounted at /socket.io');
}
