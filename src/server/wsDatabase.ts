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
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'audio' | 'gif' | 'file' | string;
  attachment_name?: string;
  timestamp: string;
  created_at: number;
}

// In-Memory Relational Tables over WebSockets (0 built-in users)
class WebSocketDatabase {
  public users: Map<string, DbUser> = new Map();
  public messages: DbMessage[] = [];
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
        messages: db.messages,
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
              broadcastTable('messages', db.messages);
            }
            break;
          }

          case 'SQL_UPDATE': {
            if (msg.table === 'users') {
              const user = db.users.get(msg.id);
              if (user) {
                const oldChannel = user.current_channel;
                Object.assign(user, msg.set, { updated_at: Date.now() });
                db.users.set(msg.id, user);
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
              db.messages = db.messages.filter((m) => m.id !== msg.id);
              broadcastTable('messages', db.messages);
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
            const user = db.users.get(boundUserId);
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

  console.log(`🔌 WebSocket Database mounted at /ws-db with WebRTC Signaling`);
}
