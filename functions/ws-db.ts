// Cloudflare Pages Function: /ws-db Edge WebSocket Database & Signaling Server
// Includes 100-second idle timeout prevention heartbeat for Cloudflare Edge

interface EdgeUser {
  id: string;
  username: string;
  avatar_color: string;
  current_channel: 'text-general' | 'voice-general' | 'video-general' | 'offline';
  is_speaking: boolean;
  is_muted: boolean;
  is_deafened: boolean;
  has_video: boolean;
  is_screen_sharing: boolean;
  activity?: string;
  updated_at: number;
}

interface EdgeMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  avatar_color: string;
  content: string;
  timestamp: string;
  created_at: number;
}

// In-Memory Edge Store
const edgeUsers = new Map<string, EdgeUser>();
const edgeMessages: EdgeMessage[] = [];
const edgeSockets = new Set<any>();
const userToSockets = new Map<string, Set<any>>();

function broadcast(payload: any) {
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  edgeSockets.forEach((sock) => {
    try {
      sock.send(data);
    } catch {}
  });
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;

  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade request', { status: 426 });
  }

  // Cloudflare WebSocketPair
  const webSocketPair = new (globalThis as any).WebSocketPair();
  const [client, server] = [webSocketPair[0], webSocketPair[1]];

  (server as any).accept();
  edgeSockets.add(server);

  let boundUserId: string | null = null;

  // Send initial snapshot
  try {
    server.send(
      JSON.stringify({
        type: 'DB_INIT',
        tables: {
          users: Array.from(edgeUsers.values()),
          messages: edgeMessages,
          channels: [
            { id: 'text-general', name: 'general', type: 'text' },
            { id: 'voice-general', name: 'general', type: 'voice' },
            { id: 'video-general', name: 'general', type: 'video' },
          ],
        },
      })
    );
  } catch {}

  // Cloudflare 100s idle timeout prevention heartbeat (every 25 seconds)
  const pingInterval = setInterval(() => {
    try {
      server.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
    } catch {
      clearInterval(pingInterval);
    }
  }, 25000);

  server.addEventListener('message', (event: any) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'PING': {
          server.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        case 'PONG': {
          // Heartbeat acknowledged
          break;
        }

        case 'REGISTER_USER': {
          if (msg.user && typeof msg.user.id === 'string') {
            const uId = msg.user.id;
            boundUserId = uId;

            if (!userToSockets.has(uId)) {
              userToSockets.set(uId, new Set());
            }
            userToSockets.get(uId)?.add(server);

            edgeUsers.set(uId, {
              id: uId,
              username: msg.user.username,
              avatar_color: msg.user.avatar_color || '#0066ff',
              current_channel: msg.user.current_channel || 'text-general',
              is_speaking: Boolean(msg.user.is_speaking),
              is_muted: Boolean(msg.user.is_muted),
              is_deafened: Boolean(msg.user.is_deafened),
              has_video: Boolean(msg.user.has_video),
              is_screen_sharing: Boolean(msg.user.is_screen_sharing),
              activity: msg.user.activity ? String(msg.user.activity) : '',
              updated_at: Date.now(),
            });

            broadcast({
              type: 'DB_SYNC',
              table: 'users',
              data: Array.from(edgeUsers.values()),
              timestamp: Date.now(),
            });

            if (msg.user.current_channel === 'voice-general' || msg.user.current_channel === 'video-general') {
              broadcast({
                type: 'USER_JOINED_MEDIA',
                userId: uId,
                channel: msg.user.current_channel,
                timestamp: Date.now(),
              });
            }
          }
          break;
        }

        case 'SQL_INSERT': {
          if (msg.table === 'messages') {
            const newMsg: EdgeMessage = {
              id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              channel_id: msg.row.channel_id || 'text-general',
              sender_id: msg.row.sender_id,
              sender_name: msg.row.sender_name,
              avatar_color: msg.row.avatar_color || '#0066ff',
              content: msg.row.content,
              timestamp: msg.row.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              created_at: Date.now(),
            };
            edgeMessages.push(newMsg);
            if (edgeMessages.length > 200) edgeMessages.shift();

            broadcast({
              type: 'DB_SYNC',
              table: 'messages',
              data: edgeMessages,
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'SQL_UPDATE': {
          if (msg.table === 'users' && msg.id) {
            const user = edgeUsers.get(msg.id);
            if (user) {
              const oldChannel = user.current_channel;
              Object.assign(user, msg.set, { updated_at: Date.now() });
              edgeUsers.set(msg.id, user);

              broadcast({
                type: 'DB_SYNC',
                table: 'users',
                data: Array.from(edgeUsers.values()),
                timestamp: Date.now(),
              });

              if (msg.set.current_channel && msg.set.current_channel !== oldChannel) {
                if (msg.set.current_channel === 'voice-general' || msg.set.current_channel === 'video-general') {
                  broadcast({
                    type: 'USER_JOINED_MEDIA',
                    userId: msg.id,
                    channel: msg.set.current_channel,
                    timestamp: Date.now(),
                  });
                }
                if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
                  broadcast({
                    type: 'USER_LEFT_MEDIA',
                    userId: msg.id,
                    channel: oldChannel,
                    timestamp: Date.now(),
                  });
                }
              }
            }
          }
          break;
        }

        case 'SQL_DELETE': {
          if (msg.table === 'messages' && msg.id) {
            const idx = edgeMessages.findIndex((m) => m.id === msg.id);
            if (idx >= 0) {
              edgeMessages.splice(idx, 1);
              broadcast({
                type: 'DB_SYNC',
                table: 'messages',
                data: edgeMessages,
                timestamp: Date.now(),
              });
            }
          }
          break;
        }

        case 'RTC_SIGNAL': {
          if (msg.targetUserId) {
            const targetSockets = userToSockets.get(msg.targetUserId);
            targetSockets?.forEach((sock) => {
              try {
                sock.send(
                  JSON.stringify({
                    type: 'RTC_SIGNAL',
                    fromUserId: msg.fromUserId,
                    targetUserId: msg.targetUserId,
                    signal: msg.signal,
                  })
                );
              } catch {}
            });
          }
          break;
        }

        case 'USER_CALL': {
          if (msg.targetUserId) {
            const targetSockets = userToSockets.get(msg.targetUserId);
            targetSockets?.forEach((sock) => {
              try {
                sock.send(
                  JSON.stringify({
                    type: 'USER_CALL',
                    fromUserId: msg.fromUserId,
                    fromUserName: msg.fromUserName,
                    callType: msg.callType,
                  })
                );
              } catch {}
            });
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[Cloudflare WS] Message error:', err);
    }
  });

  const cleanup = () => {
    clearInterval(pingInterval);
    edgeSockets.delete(server);
    if (boundUserId) {
      const userSockets = userToSockets.get(boundUserId);
      if (userSockets) {
        userSockets.delete(server);
        if (userSockets.size === 0) {
          const user = edgeUsers.get(boundUserId);
          if (user && (user.current_channel === 'voice-general' || user.current_channel === 'video-general')) {
            broadcast({
              type: 'USER_LEFT_MEDIA',
              userId: boundUserId,
              channel: user.current_channel,
              timestamp: Date.now(),
            });
          }
          userToSockets.delete(boundUserId);
          edgeUsers.delete(boundUserId);
          broadcast({
            type: 'DB_SYNC',
            table: 'users',
            data: Array.from(edgeUsers.values()),
            timestamp: Date.now(),
          });
        }
      }
    }
  };

  server.addEventListener('close', cleanup);
  server.addEventListener('error', cleanup);

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as any);
}
