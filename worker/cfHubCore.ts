// Shared zero-Node-dependency WebSocket + REST signaling/presence hub core for Cloudflare Workers & Pages
import { mergeCookieRecordMap, type RammerheadCookieEntry } from '../src/utils/rammerheadCore';

export interface EdgeUser {
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

export interface EdgeMessage {
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

export interface EdgePendingSignal {
  id: string;
  fromUserId: string;
  targetUserId: string;
  type: 'RTC_SIGNAL';
  signal?: unknown;
  sigId?: string;
  timestamp: number;
}

const DISCONNECT_GRACE_MS = 20000;
const USER_TTL_MS = 300000;

interface CfStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

export class CfHubCore {
  private users = new Map<string, EdgeUser>();
  private messages: EdgeMessage[] = [];
  private deletedIds = new Set<string>();
  private sockets = new Set<any>();
  private userToSockets = new Map<string, Set<any>>();
  private pendingSignals = new Map<string, EdgePendingSignal[]>();
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private rhCookieBuckets = new Map<string, { cookies: Record<string, RammerheadCookieEntry>; updatedAt: number }>();
  private readonly storage?: CfStorageLike;

  constructor(storage?: CfStorageLike) {
    this.storage = storage;
  }

  private markDeleted(id: string): void {
    if (!id) return;
    this.deletedIds.add(id);
    if (this.deletedIds.size > 1000) {
      const oldest = this.deletedIds.values().next().value;
      if (oldest) this.deletedIds.delete(oldest);
    }
  }

  public readonly channels = [
    { id: 'text-general', name: 'general', type: 'text' },
    { id: 'voice-general', name: 'general', type: 'voice' },
    { id: 'video-general', name: 'general', type: 'video' },
  ];

  public getUsers(): EdgeUser[] {
    const now = Date.now();
    const active: EdgeUser[] = [];
    for (const [id, u] of this.users.entries()) {
      if (now - (u.updated_at || 0) < USER_TTL_MS) {
        active.push(u);
      } else {
        this.users.delete(id);
      }
    }
    return active.sort((a, b) => {
      const nameA = (a.username || '').toLowerCase();
      const nameB = (b.username || '').toLowerCase();
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return (a.id || '').localeCompare(b.id || '');
    });
  }

  private broadcast(payload: unknown): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const sock of this.sockets) {
      try {
        sock.send(data);
      } catch {
        this.sockets.delete(sock);
      }
    }
  }

  private broadcastUsers(): void {
    this.broadcast({
      type: 'DB_SYNC',
      table: 'users',
      data: this.getUsers(),
      timestamp: Date.now(),
    });
  }

  private sendToUserSockets(targetUserId: string, payload: unknown): boolean {
    if (!targetUserId) return false;
    const targetSockets = this.userToSockets.get(targetUserId);
    if (!targetSockets || targetSockets.size === 0) return false;
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    let delivered = false;
    for (const sock of targetSockets) {
      try {
        sock.send(raw);
        delivered = true;
      } catch {
        targetSockets.delete(sock);
      }
    }
    return delivered;
  }

  private addPendingSignal(sig: EdgePendingSignal): void {
    const list = this.pendingSignals.get(sig.targetUserId) || [];
    list.push(sig);
    if (list.length > 50) list.shift();
    this.pendingSignals.set(sig.targetUserId, list);
  }

  private popPendingSignals(userId: string): EdgePendingSignal[] {
    const list = this.pendingSignals.get(userId) || [];
    this.pendingSignals.delete(userId);
    return list;
  }

  private upsertUser(userInput: Partial<EdgeUser> & { id: string }): EdgeUser {
    const existing = this.users.get(userInput.id);
    const updated: EdgeUser = {
      id: userInput.id,
      username: userInput.username || existing?.username || 'Player',
      avatar_color: userInput.avatar_color || existing?.avatar_color || '#0066ff',
      avatar_url: userInput.avatar_url ?? existing?.avatar_url ?? '',
      current_channel: (userInput.current_channel || existing?.current_channel || 'text-general') as EdgeUser['current_channel'],
      is_speaking: userInput.is_speaking !== undefined ? Boolean(userInput.is_speaking) : Boolean(existing?.is_speaking),
      is_muted: userInput.is_muted !== undefined ? Boolean(userInput.is_muted) : Boolean(existing?.is_muted),
      is_deafened: userInput.is_deafened !== undefined ? Boolean(userInput.is_deafened) : Boolean(existing?.is_deafened),
      has_video: userInput.has_video !== undefined ? Boolean(userInput.has_video) : Boolean(existing?.has_video),
      is_screen_sharing:
        userInput.is_screen_sharing !== undefined ? Boolean(userInput.is_screen_sharing) : Boolean(existing?.is_screen_sharing),
      is_hand_raised:
        userInput.is_hand_raised !== undefined ? Boolean(userInput.is_hand_raised) : Boolean(existing?.is_hand_raised),
      activity: userInput.activity ?? existing?.activity ?? '',
      typing_channel: userInput.typing_channel ?? existing?.typing_channel,
      typing_at: userInput.typing_at ?? existing?.typing_at,
      updated_at: Date.now(),
    };

    if (updated.current_channel === 'text-general' || updated.current_channel === 'offline') {
      updated.has_video = false;
      updated.is_screen_sharing = false;
      updated.is_speaking = false;
      updated.is_hand_raised = false;
    }

    if (userInput.is_screen_sharing) {
      for (const [uid, u] of this.users.entries()) {
        if (uid !== userInput.id && u.is_screen_sharing) {
          u.is_screen_sharing = false;
        }
      }
    }

    this.users.set(updated.id, updated);
    return updated;
  }

  private removeUserImmediate(userId: string): void {
    const existing = this.users.get(userId);
    const oldChannel = existing?.current_channel;
    this.users.delete(userId);
    this.broadcastUsers();
    if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
      this.broadcast({
        type: 'USER_LEFT_MEDIA',
        userId,
        channel: oldChannel,
        timestamp: Date.now(),
      });
    }
  }

  public handleRequest(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      return Promise.resolve(this.handleWebSocket(request));
    }
    return this.handleHttpRequest(request);
  }

  public handleWebSocket(_request: Request): Response {
    const WebSocketPairCtor = (globalThis as any).WebSocketPair;
    if (!WebSocketPairCtor) {
      return new Response('WebSocketPair not available in this runtime', { status: 501 });
    }

    const pair = new WebSocketPairCtor();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    this.sockets.add(server);

    let boundUserId: string | null = null;

    try {
      server.send(
        JSON.stringify({
          type: 'DB_INIT',
          tables: {
            users: this.getUsers(),
            messages: this.messages.filter((m) => !this.deletedIds.has(m.id)),
            channels: this.channels,
            deletedIds: Array.from(this.deletedIds).slice(-200),
          },
        })
      );
    } catch {}

    const pingInterval = setInterval(() => {
      try {
        server.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      } catch {
        clearInterval(pingInterval);
      }
    }, 25000);

    server.addEventListener('message', (event: any) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
        if (boundUserId) {
          const u = this.users.get(boundUserId);
          if (u) u.updated_at = Date.now();
        }

        switch (msg.type) {
          case 'PING': {
            try {
              server.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            } catch {}
            break;
          }

          case 'PONG':
            break;

          case 'GET_USERS': {
            try {
              server.send(
                JSON.stringify({
                  type: 'DB_SYNC',
                  table: 'users',
                  data: this.getUsers(),
                  timestamp: Date.now(),
                })
              );
            } catch {}
            break;
          }

          case 'REGISTER_USER': {
            if (msg.user && typeof msg.user.id === 'string') {
              const uId = msg.user.id;
              const prevBoundId = boundUserId;
              const replacedId =
                typeof msg.replacesUserId === 'string' && msg.replacesUserId && msg.replacesUserId !== uId
                  ? msg.replacesUserId
                  : prevBoundId && prevBoundId !== uId
                  ? prevBoundId
                  : undefined;

              if (replacedId) {
                const staleTimer = this.disconnectTimers.get(replacedId);
                if (staleTimer) {
                  clearTimeout(staleTimer);
                  this.disconnectTimers.delete(replacedId);
                }
                const oldSocks = this.userToSockets.get(replacedId);
                if (oldSocks) {
                  oldSocks.delete(server);
                  if (oldSocks.size === 0 || replacedId === msg.replacesUserId) {
                    this.userToSockets.delete(replacedId);
                  }
                }
                if (!this.userToSockets.has(replacedId) || replacedId === msg.replacesUserId) {
                  const staleUser = this.users.get(replacedId);
                  const staleChannel = staleUser?.current_channel;
                  this.users.delete(replacedId);
                  if (staleChannel === 'voice-general' || staleChannel === 'video-general') {
                    this.broadcast({
                      type: 'USER_LEFT_MEDIA',
                      userId: replacedId,
                      channel: staleChannel,
                      timestamp: Date.now(),
                    });
                  }
                }
              }

              boundUserId = uId;

              const pendingTimer = this.disconnectTimers.get(uId);
              if (pendingTimer) {
                clearTimeout(pendingTimer);
                this.disconnectTimers.delete(uId);
              }

              if (!this.userToSockets.has(uId)) {
                this.userToSockets.set(uId, new Set());
              }
              this.userToSockets.get(uId)!.add(server);

              const userObj = this.upsertUser({ ...msg.user, id: uId });
              this.broadcastUsers();

              if (userObj.current_channel === 'voice-general' || userObj.current_channel === 'video-general') {
                this.broadcast({
                  type: 'USER_JOINED_MEDIA',
                  userId: uId,
                  channel: userObj.current_channel,
                  timestamp: Date.now(),
                });
              }

              const queued = this.popPendingSignals(uId);
              for (const sig of queued) {
                try {
                  server.send(JSON.stringify(sig));
                } catch {}
              }
            }
            break;
          }

          case 'SQL_INSERT': {
            if (msg.table === 'messages' && msg.row) {
              const row = msg.row;
              const msgId = row.id || 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
              if (this.deletedIds.has(msgId)) break;
              const newMsg: EdgeMessage = {
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
                timestamp:
                  row.timestamp ||
                  'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                created_at: Number(row.created_at) || Date.now(),
              };
              if (!this.messages.some((m) => m.id === newMsg.id)) {
                this.messages.push(newMsg);
                if (this.messages.length > 200) this.messages.shift();
              }

              this.broadcast({
                type: 'DB_SYNC',
                table: 'messages',
                data: [newMsg],
                timestamp: Date.now(),
              });
            }
            break;
          }

          case 'SQL_UPDATE': {
            if (msg.table === 'users' && msg.id) {
              const existing = this.users.get(msg.id);
              const oldChannel = existing?.current_channel || 'text-general';
              const updated = this.upsertUser({
                ...(existing || {}),
                ...(msg.set || {}),
                id: msg.id,
              });

              this.broadcastUsers();

              if (msg.set?.current_channel !== undefined && msg.set.current_channel !== oldChannel) {
                if (msg.set.current_channel === 'voice-general' || msg.set.current_channel === 'video-general') {
                  this.broadcast({
                    type: 'USER_JOINED_MEDIA',
                    userId: msg.id,
                    channel: msg.set.current_channel,
                    timestamp: Date.now(),
                  });
                }
                if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
                  this.broadcast({
                    type: 'USER_LEFT_MEDIA',
                    userId: msg.id,
                    channel: oldChannel,
                    timestamp: Date.now(),
                  });
                }
              }

              if (
                msg.set?.has_video !== undefined ||
                msg.set?.is_muted !== undefined ||
                msg.set?.is_screen_sharing !== undefined ||
                msg.set?.is_hand_raised !== undefined
              ) {
                this.broadcast({
                  type: 'USER_MEDIA_UPDATE',
                  userId: msg.id,
                  channel: updated.current_channel,
                  timestamp: Date.now(),
                });
              }
            }
            break;
          }

          case 'SQL_DELETE': {
            if (msg.table === 'messages' && msg.id) {
              this.markDeleted(msg.id);
              const idx = this.messages.findIndex((m) => m.id === msg.id);
              if (idx >= 0) this.messages.splice(idx, 1);
              this.broadcast({ type: 'SQL_DELETE', table: 'messages', id: msg.id });
            }
            break;
          }

          case 'SQL_DELETE_CHANNEL': {
            if (msg.channel_id) {
              this.messages.forEach((m) => {
                if (m.channel_id === msg.channel_id) this.markDeleted(m.id);
              });
              this.messages = this.messages.filter((m) => m.channel_id !== msg.channel_id);
              this.broadcast({
                type: 'SQL_DELETE_CHANNEL',
                table: 'messages',
                channel_id: msg.channel_id,
              });
            }
            break;
          }

          case 'SQL_DELETE_ALL': {
            this.messages = [];
            this.deletedIds.clear();
            this.broadcast({ type: 'DB_CLEAR_MESSAGES' });
            break;
          }

          case 'RTC_SIGNAL': {
            if (msg.targetUserId && msg.targetUserId !== (msg.fromUserId || boundUserId)) {
              const signalPayload = {
                type: 'RTC_SIGNAL' as const,
                fromUserId: msg.fromUserId || boundUserId || 'anon',
                targetUserId: msg.targetUserId,
                signal: msg.signal,
                sigId: msg.sigId,
                timestamp: Date.now(),
              };

              const delivered = this.sendToUserSockets(msg.targetUserId, signalPayload);
              if (!delivered) {
                this.addPendingSignal({
                  id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  fromUserId: signalPayload.fromUserId,
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

          case 'USER_CALL': {
            if (msg.targetUserId) {
              this.sendToUserSockets(msg.targetUserId, {
                type: 'USER_CALL',
                fromUserId: msg.fromUserId || boundUserId,
                fromUserName: msg.fromUserName,
                callType: msg.callType,
              });
            }
            break;
          }

          case 'USER_OFFLINE':
          case 'USER_DISCONNECT': {
            const uId = msg.userId || boundUserId;
            if (uId) {
              const timer = this.disconnectTimers.get(uId);
              if (timer) {
                clearTimeout(timer);
                this.disconnectTimers.delete(uId);
              }
              const userSockets = this.userToSockets.get(uId);
              if (userSockets) {
                userSockets.delete(server);
                if (userSockets.size === 0) this.userToSockets.delete(uId);
              }
              this.removeUserImmediate(uId);
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
      this.sockets.delete(server);
      if (boundUserId) {
        const uId = boundUserId;
        const userSockets = this.userToSockets.get(uId);
        if (userSockets) {
          userSockets.delete(server);
          if (userSockets.size === 0) {
            this.userToSockets.delete(uId);
            const timer = setTimeout(() => {
              this.disconnectTimers.delete(uId);
              if (this.userToSockets.has(uId)) return;
              this.removeUserImmediate(uId);
            }, DISCONNECT_GRACE_MS);
            this.disconnectTimers.set(uId, timer);
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

  public async handleHttpRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-store',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers });

    try {
      if (request.method === 'GET' && pathname === '/api/ws-db/snapshot') {
        return json({
          success: true,
          users: this.getUsers(),
          channels: this.channels,
          timestamp: Date.now(),
        });
      }

      if (request.method === 'POST' && pathname === '/api/ws-db/register') {
        const body = (await request.json().catch(() => ({}))) as any;
        const user = body?.user;
        if (!user || !user.id) return json({ error: 'Missing user object or user.id' }, 400);
        const replacesUserId = typeof body?.replacesUserId === 'string' ? body.replacesUserId : '';
        if (replacesUserId && replacesUserId !== user.id) {
          this.users.delete(replacesUserId);
          this.userToSockets.delete(replacesUserId);
        }
        const userObj = this.upsertUser(user);
        this.broadcastUsers();
        return json({ success: true, user: userObj, users: this.getUsers() });
      }

      if (request.method === 'POST' && pathname === '/api/ws-db/update-user') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { id, set } = body || {};
        if (!id || !set) return json({ error: 'Missing id or set parameters' }, 400);
        const existing = this.users.get(id);
        const oldChannel = existing?.current_channel || 'text-general';
        const updated = this.upsertUser({ ...(existing || {}), ...set, id });
        this.broadcastUsers();
        if (set.current_channel !== undefined && set.current_channel !== oldChannel) {
          if (set.current_channel === 'voice-general' || set.current_channel === 'video-general') {
            this.broadcast({
              type: 'USER_JOINED_MEDIA',
              userId: id,
              channel: set.current_channel,
              timestamp: Date.now(),
            });
          }
          if (oldChannel === 'voice-general' || oldChannel === 'video-general') {
            this.broadcast({
              type: 'USER_LEFT_MEDIA',
              userId: id,
              channel: oldChannel,
              timestamp: Date.now(),
            });
          }
        }
        return json({ success: true, user: updated, users: this.getUsers() });
      }

      if (request.method === 'POST' && pathname === '/api/ws-db/leave') {
        const body = (await request.json().catch(() => ({}))) as any;
        if (body?.id) {
          this.removeUserImmediate(body.id);
        }
        return json({ success: true });
      }

      if (request.method === 'POST' && pathname === '/api/ws-db/message') {
        const body = (await request.json().catch(() => ({}))) as any;
        const row = body?.row;
        if (!row || !row.id) return json({ error: 'Missing message row' }, 400);
        if (this.deletedIds.has(row.id)) return json({ success: true, deleted: true });
        const newMsg: EdgeMessage = {
          id: row.id,
          channel_id: row.channel_id || 'text-general',
          sender_id: row.sender_id || 'anon',
          sender_name: row.sender_name || 'Player',
          avatar_color: row.avatar_color || '#0066ff',
          sender_avatar_url: row.sender_avatar_url || '',
          content: row.content || '',
          attachment_url: row.attachment_url,
          attachment_type: row.attachment_type,
          attachment_name: row.attachment_name,
          timestamp:
            row.timestamp ||
            'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          created_at: Number(row.created_at) || Date.now(),
        };
        if (!this.messages.some((m) => m.id === newMsg.id)) {
          this.messages.push(newMsg);
          if (this.messages.length > 200) this.messages.shift();
        }
        this.broadcast({
          type: 'DB_SYNC',
          table: 'messages',
          data: [newMsg],
          timestamp: Date.now(),
        });
        return json({ success: true, message: newMsg });
      }

      if (request.method === 'DELETE' && pathname.startsWith('/api/ws-db/message/')) {
        const messageId = decodeURIComponent(pathname.slice('/api/ws-db/message/'.length));
        if (messageId) {
          this.markDeleted(messageId);
          const idx = this.messages.findIndex((m) => m.id === messageId);
          if (idx >= 0) this.messages.splice(idx, 1);
          this.broadcast({ type: 'SQL_DELETE', table: 'messages', id: messageId });
        }
        return json({ success: true });
      }

      if (request.method === 'DELETE' && pathname.startsWith('/api/ws-db/channel-messages/')) {
        const channelId = decodeURIComponent(pathname.slice('/api/ws-db/channel-messages/'.length));
        if (channelId) {
          this.messages.forEach((m) => {
            if (m.channel_id === channelId) this.markDeleted(m.id);
          });
          this.messages = this.messages.filter((m) => m.channel_id !== channelId);
          this.broadcast({ type: 'SQL_DELETE_CHANNEL', table: 'messages', channel_id: channelId });
        }
        return json({ success: true });
      }

      if (request.method === 'DELETE' && pathname === '/api/ws-db/messages/all') {
        this.messages = [];
        this.deletedIds.clear();
        this.broadcast({ type: 'DB_CLEAR_MESSAGES' });
        return json({ success: true });
      }

      if (request.method === 'POST' && pathname === '/api/ws-db/signal') {
        const body = (await request.json().catch(() => ({}))) as any;
        const { fromUserId, targetUserId, signal, sigId } = body || {};
        if (!targetUserId || targetUserId === fromUserId) {
          return json({ error: 'Invalid targetUserId' }, 400);
        }
        const payload = {
          type: 'RTC_SIGNAL' as const,
          fromUserId,
          targetUserId,
          signal,
          sigId,
          timestamp: Date.now(),
        };
        const delivered = this.sendToUserSockets(targetUserId, payload);
        if (!delivered) {
          this.addPendingSignal({
            id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fromUserId,
            targetUserId,
            type: 'RTC_SIGNAL',
            signal,
            sigId,
            timestamp: Date.now(),
          });
        }
        return json({ success: true });
      }

      if (request.method === 'GET' && pathname.startsWith('/api/ws-db/signals/')) {
        const userId = decodeURIComponent(pathname.slice('/api/ws-db/signals/'.length));
        const signals = userId ? this.popPendingSignals(userId) : [];
        return json({ success: true, signals });
      }

      if (request.method === 'GET' && pathname === '/api/ws-db/rh-cookies') {
        const bucketKey = (url.searchParams.get('key') || 'default').trim() || 'default';
        let bucket = this.rhCookieBuckets.get(bucketKey);
        if (!bucket && this.storage) {
          try {
            const persisted = await this.storage.get<{ cookies: Record<string, RammerheadCookieEntry>; updatedAt: number }>(
              `rh_cookies:${bucketKey}`
            );
            if (persisted && typeof persisted === 'object' && persisted.cookies) {
              bucket = persisted;
              this.rhCookieBuckets.set(bucketKey, persisted);
            }
          } catch {}
        }
        return json({
          success: true,
          cookies: bucket?.cookies || {},
          updatedAt: bucket?.updatedAt || 0,
        });
      }

      if (request.method === 'POST' && pathname === '/api/ws-db/rh-cookies') {
        const body = (await request.json().catch(() => ({}))) as {
          key?: string;
          cookies?: Record<string, RammerheadCookieEntry>;
        };
        const bucketKey = String(body?.key || 'default').trim() || 'default';
        const incoming = body?.cookies;
        if (!incoming || typeof incoming !== 'object') {
          return json({ error: 'Missing cookies map' }, 400);
        }
        let existing = this.rhCookieBuckets.get(bucketKey);
        if (!existing && this.storage) {
          try {
            existing = await this.storage.get<{ cookies: Record<string, RammerheadCookieEntry>; updatedAt: number }>(
              `rh_cookies:${bucketKey}`
            );
          } catch {}
        }
        const merged = mergeCookieRecordMap(existing?.cookies, incoming);
        const next = { cookies: merged, updatedAt: Date.now() };
        this.rhCookieBuckets.set(bucketKey, next);
        if (this.storage) {
          try {
            await this.storage.put(`rh_cookies:${bucketKey}`, next);
          } catch {}
        }
        return json({ success: true, cookies: next.cookies, updatedAt: next.updatedAt });
      }

      return json({ error: `Unknown ws-db endpoint: ${request.method} ${pathname}` }, 404);
    } catch (err: any) {
      return json({ error: err?.message || 'ws-db internal error' }, 500);
    }
  }
}
