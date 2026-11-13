import { WebSocketServer, WebSocket } from 'ws';
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
}

export interface PendingSignal {
  id: string;
  fromUserId: string;
  fromUserName?: string;
  targetUserId: string;
  type: 'RTC_SIGNAL' | 'USER_CALL' | 'CALL_ANSWERED' | 'CALL_ENDED' | 'DIRECT_RTC_SIGNAL' | 'VOICEMAIL_NOTIFICATION' | 'CALL_SYNC';
  callType?: 'audio' | 'video';
  signal?: any;
  voicemail?: any;
  timestamp: number;
}

// Ephemeral in-memory WebSocket state (presence, voice/video rooms, typing & WebRTC signaling; chat history lives in Firebase)
export class WebSocketDatabase {
  public users: Map<string, DbUser> = new Map();
  public pendingSignals: Map<string, PendingSignal[]> = new Map(); // targetUserId -> signals

  public channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

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

let activeWss: WebSocketServer | null = null;
const userSocketsMap = new Map<string, Set<WebSocket>>();

export function sendToUserSockets(targetUserId: string, payload: any): boolean {
  if (!targetUserId) return false;
  const sockets = userSocketsMap.get(targetUserId);
  if (!sockets || sockets.size === 0) return false;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let delivered = false;
  sockets.forEach((s) => {
    if (s.readyState === WebSocket.OPEN) {
      try {
        s.send(str);
        delivered = true;
      } catch {}
    }
  });
  return delivered;
}

export function broadcastWss(payload: any) {
  if (!activeWss) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  activeWss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(str);
      } catch {}
    }
  });
}

export function broadcastTable(tableName: string, data: any) {
  broadcastWss({
    type: 'DB_SYNC',
    table: tableName,
    data: Array.isArray(data) ? data : [],
    timestamp: Date.now(),
  });
}

export function initWebSocketDatabase(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws-db' });
  activeWss = wss;

  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  function broadcastMediaPresence(type: 'USER_JOINED_MEDIA' | 'USER_LEFT_MEDIA' | 'USER_MEDIA_UPDATE', userId: string, channel: string) {
    broadcastWss({
      type,
      userId,
      channel,
      timestamp: Date.now(),
    });
  }

  wss.on('connection', (ws) => {
    let boundUserId: string | null = null;

    try {
      ws.send(JSON.stringify({
        type: 'DB_INIT',
        tables: {
          users: globalWsDb.getUsers(),
          channels: globalWsDb.channels,
        },
      }));
    } catch {}

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (boundUserId) {
          const u = globalWsDb.getUser(boundUserId);
          if (u) {
            u.updated_at = Date.now();
          }
        }

        switch (msg.type) {
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
              userSocketsMap.get(uId)!.add(ws);

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
              queued.forEach((s) => {
                try {
                  ws.send(JSON.stringify(s));
                } catch {}
              });
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
              // Real-time relay only (Firebase persists chat history)
              broadcastTable('messages', [newMsg]);
            }
            break;
          }

          case 'SQL_DELETE': {
            if (msg.table === 'messages' && msg.id) {
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
              };

              const delivered = sendToUserSockets(msg.targetUserId, signalPayload);

              if (!delivered) {
                globalWsDb.addPendingSignal({
                  id: 'sig-' + Date.now(),
                  fromUserId: msg.fromUserId || boundUserId || 'anon',
                  targetUserId: msg.targetUserId,
                  type: 'RTC_SIGNAL',
                  signal: msg.signal,
                  timestamp: Date.now(),
                });
              }
            }
            break;
          }

          case 'USER_CALL': {
            if (msg.targetUserId && msg.targetUserId !== boundUserId) {
              const callPayload = {
                type: 'USER_CALL',
                fromUserId: msg.fromUserId || boundUserId,
                fromUserName: msg.fromUserName || 'Player',
                targetUserId: msg.targetUserId,
                callType: msg.callType || 'audio',
              };

              const delivered = sendToUserSockets(msg.targetUserId, callPayload);

              if (!delivered) {
                globalWsDb.addPendingSignal({
                  id: 'call-' + Date.now(),
                  fromUserId: msg.fromUserId || boundUserId || 'anon',
                  fromUserName: msg.fromUserName || 'Player',
                  targetUserId: msg.targetUserId,
                  type: 'USER_CALL',
                  callType: msg.callType || 'audio',
                  timestamp: Date.now(),
                });
              }
            }
            break;
          }

          case 'CALL_ANSWERED': {
            if (msg.targetUserId && msg.targetUserId !== boundUserId) {
              const payload = {
                type: 'CALL_ANSWERED',
                fromUserId: msg.fromUserId || boundUserId,
                fromUserName: msg.fromUserName || 'Player',
                targetUserId: msg.targetUserId,
                callType: msg.callType || 'audio',
              };
              sendToUserSockets(msg.targetUserId, payload);
            }
            break;
          }

          case 'CALL_ENDED': {
            if (msg.targetUserId && msg.targetUserId !== boundUserId) {
              const payload = {
                type: 'CALL_ENDED',
                fromUserId: msg.fromUserId || boundUserId,
                targetUserId: msg.targetUserId,
              };
              sendToUserSockets(msg.targetUserId, payload);
            }
            break;
          }

          case 'DIRECT_RTC_SIGNAL': {
            if (msg.targetUserId && msg.targetUserId !== boundUserId) {
              const payload = {
                type: 'DIRECT_RTC_SIGNAL',
                fromUserId: msg.fromUserId || boundUserId,
                targetUserId: msg.targetUserId,
                signal: msg.signal,
              };
              sendToUserSockets(msg.targetUserId, payload);
            }
            break;
          }

          case 'VOICEMAIL_NOTIFICATION': {
            if (msg.targetUserId && msg.targetUserId !== boundUserId) {
              const payload = {
                type: 'VOICEMAIL_NOTIFICATION',
                fromUserId: msg.fromUserId || boundUserId,
                fromUserName: msg.fromUserName || 'Player',
                targetUserId: msg.targetUserId,
                voicemail: msg.voicemail,
              };
              const delivered = sendToUserSockets(msg.targetUserId, payload);
              if (!delivered) {
                globalWsDb.addPendingSignal({
                  id: 'vm-' + Date.now(),
                  fromUserId: msg.fromUserId || boundUserId || 'anon',
                  fromUserName: msg.fromUserName || 'Player',
                  targetUserId: msg.targetUserId,
                  type: 'VOICEMAIL_NOTIFICATION',
                  voicemail: msg.voicemail,
                  timestamp: Date.now(),
                });
              }
            }
            break;
          }

          case 'CALL_SYNC': {
            if (msg.targetUserId && msg.targetUserId !== boundUserId) {
              const payload = {
                type: 'CALL_SYNC',
                fromUserId: msg.fromUserId || boundUserId,
                targetUserId: msg.targetUserId,
                hold: msg.hold,
                muted: msg.muted,
                video: msg.video,
              };
              sendToUserSockets(msg.targetUserId, payload);
            }
            break;
          }

          case 'USER_OFFLINE':
          case 'USER_DISCONNECT': {
            const uId = msg.userId || boundUserId;
            if (uId) {
              const sockets = userSocketsMap.get(uId);
              if (sockets) {
                sockets.delete(ws);
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
            if (boundUserId) {
              const u = globalWsDb.getUser(boundUserId);
              if (u) {
                u.updated_at = Date.now();
              }
            }
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
    }, 15000);

    ws.on('close', () => {
      clearInterval(pingTimer);
      if (boundUserId) {
        const uId = boundUserId;
        const sockets = userSocketsMap.get(uId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            userSocketsMap.delete(uId);
            const user = globalWsDb.getUser(uId);
            const oldChannel = user?.current_channel;
            globalWsDb.deleteUser(uId);
            broadcastTable('users', globalWsDb.getUsers());
            if (oldChannel === 'video-general' || oldChannel === 'voice-general') {
              broadcastMediaPresence('USER_LEFT_MEDIA', uId, oldChannel);
            }
          }
        }
      }
    });
  });

  console.log(`🔌 Pure WebSocket Database mounted at /ws-db`);
}
