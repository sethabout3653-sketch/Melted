import { useState, useEffect, useRef, useCallback } from 'react';
import { DbUser, DbMessage } from '../server/wsDatabase';
import { db, auth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface RtcSignalPayload {
  fromUserId: string;
  targetUserId: string;
  signal: any;
}

function deduplicateUsers(users: DbUser[], currentUserId?: string): DbUser[] {
  const map = new Map<string, DbUser>();
  users.forEach((u) => {
    if (!u || !u.id) return;
    const existing = map.get(u.id);
    if (!existing || (u.updated_at || 0) >= (existing.updated_at || 0)) {
      map.set(u.id, u);
    }
  });
  const list = Array.from(map.values());
  return list.sort((a, b) => {
    if (currentUserId) {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
    }
    const nameA = (a.username || '').toLowerCase();
    const nameB = (b.username || '').toLowerCase();
    if (nameA !== nameB) {
      return nameA.localeCompare(nameB);
    }
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Recursively removes all undefined values from an object to ensure Firebase compatibility.
 */
function cleanData<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  Object.keys(obj as any).forEach((key) => {
    const value = (obj as any)[key];
    if (value === undefined) return;
    if (value !== null && typeof value === 'object') {
      result[key] = cleanData(value);
    } else {
      result[key] = value;
    }
  });
  return result as T;
}

function mergeMessages(
  existing: DbMessage[],
  incoming: DbMessage[],
  deletedIds?: Set<string>
): DbMessage[] {
  const map = new Map<string, DbMessage>();

  existing.forEach((m) => {
    if (m && m.id && (!deletedIds || !deletedIds.has(m.id))) {
      map.set(m.id, m);
    }
  });

  incoming.forEach((m) => {
    if (m && m.id && (!deletedIds || !deletedIds.has(m.id))) {
      map.set(m.id, m);
    }
  });

  return Array.from(map.values()).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
}

export function resolveWebSocketUrl(): string {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const queryWs = params.get('ws') || params.get('server');
      if (queryWs) {
        if (queryWs.startsWith('ws://') || queryWs.startsWith('wss://')) {
          return queryWs.endsWith('/ws-db') ? queryWs : `${queryWs.replace(/\/$/, '')}/ws-db`;
        }
        const proto = queryWs.startsWith('https://') ? 'wss:' : 'ws:';
        const clean = queryWs.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `${proto}//${clean}/ws-db`;
      }

      const storedWs =
        localStorage.getItem('frosthub_ws_url') ||
        localStorage.getItem('frosthub_server_url') ||
        localStorage.getItem('frosthub_backend_url');
      if (storedWs) {
        if (storedWs.startsWith('ws://') || storedWs.startsWith('wss://')) {
          return storedWs.endsWith('/ws-db') ? storedWs : `${storedWs.replace(/\/$/, '')}/ws-db`;
        }
        const proto = storedWs.startsWith('https://') ? 'wss:' : 'ws:';
        const clean = storedWs.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return `${proto}//${clean}/ws-db`;
      }
    }

    const customWsUrl = (import.meta as any).env?.VITE_WS_URL;
    if (customWsUrl) {
      return customWsUrl.endsWith('/ws-db') ? customWsUrl : `${customWsUrl.replace(/\/$/, '')}/ws-db`;
    }

    const customBackendUrl = (import.meta as any).env?.VITE_BACKEND_URL;
    if (customBackendUrl) {
      const cleanBackend = customBackendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsProto = customBackendUrl.startsWith('https') ? 'wss:' : 'ws:';
      return `${wsProto}//${cleanBackend}/ws-db`;
    }

    if (typeof window !== 'undefined' && window.location?.hostname?.endsWith('.pages.dev')) {
      return 'wss://melted-arcade.onrender.com/ws-db';
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws-db`;
  } catch {
    return 'ws://localhost:3000/ws-db';
  }
}

export function useWebSocketDatabase(currentUser: {
  id: string;
  username: string;
  avatar_color: string;
  avatar_url?: string;
  current_channel?: string;
  activity?: string;
}) {
  const [users, setUsers] = useState<DbUser[]>([]);
  // Chat messages live in Firebase Firestore and are relayed live via WebSockets (no localStorage message store)
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isHttpSyncActive, setIsHttpSyncActive] = useState(false);
  const [isFirebaseActive, setIsFirebaseActive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const httpSyncIntervalRef = useRef<any>(null);
  const outgoingQueueRef = useRef<string[]>([]);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const processedRtcSignalsRef = useRef<Set<string>>(new Set());

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const activeUserStateRef = useRef<DbUser>({
    id: currentUser.id,
    username: currentUser.username,
    avatar_color: currentUser.avatar_color || '#0066ff',
    avatar_url: currentUser.avatar_url || '',
    current_channel: (currentUser as any).current_channel || 'text-general',
    activity: currentUser.activity || '',
    is_speaking: false,
    is_muted: false,
    is_deafened: false,
    has_video: false,
    is_screen_sharing: false,
    is_hand_raised: false,
    updated_at: Date.now(),
  });

  useEffect(() => {
    Object.assign(activeUserStateRef.current, {
      id: currentUser.id,
      username: currentUser.username,
      avatar_color: currentUser.avatar_color || '#0066ff',
      avatar_url: currentUser.avatar_url || '',
    });
  }, [currentUser.id, currentUser.username, currentUser.avatar_color, currentUser.avatar_url]);

  // --- Firebase Listeners (ONLY saves & syncs persisted chat messages and deletions) ---
  useEffect(() => {
    let unsubscribeMessages: (() => void) | null = null;
    let unsubscribeDeletions: (() => void) | null = null;
    let cancelled = false;

    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    };

    const setupFirebase = async () => {
      try {
        await testConnection();
        if (cancelled) return;
        setIsFirebaseActive(true);

        // 1. Messages (Authoritative chat persistence across all channels)
        const msgQuery = query(collection(db, 'messages'), orderBy('created_at', 'desc'), limit(200));
        unsubscribeMessages = onSnapshot(
          msgQuery,
          (snapshot) => {
            const incoming: DbMessage[] = [];
            snapshot.forEach((msgDoc) => incoming.push(msgDoc.data() as DbMessage));

            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                deletedIdsRef.current.add(change.doc.id);
              }
            });

            setMessages((prev) => mergeMessages(prev, incoming.reverse(), deletedIdsRef.current));
          },
          (err) => {
            setIsFirebaseActive(false);
            handleFirestoreError(err, OperationType.GET, 'messages');
          }
        );

        // 2. Shared Tombstones (Permanent Deletion Sync)
        unsubscribeDeletions = onSnapshot(
          collection(db, 'deletions'),
          (snapshot) => {
            const newlyDeleted: string[] = [];
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const deletionId = change.doc.id;
                if (!deletedIdsRef.current.has(deletionId)) {
                  deletedIdsRef.current.add(deletionId);
                  newlyDeleted.push(deletionId);
                }
              }
            });
            if (newlyDeleted.length > 0) {
              setMessages((prev) => prev.filter((m) => !deletedIdsRef.current.has(m.id)));
            }
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, 'deletions');
          }
        );
      } catch (err) {
        console.warn('[Firebase] Initialization failed, WebSocket relay continues:', err);
        setIsFirebaseActive(false);
      }
    };

    setupFirebase();

    return () => {
      cancelled = true;
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeDeletions) unsubscribeDeletions();
    };
  }, []);

  const onRtcSignalRef = useRef<((fromUserId: string, signal: any) => void) | null>(null);
  const onUserCallRef = useRef<((fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) | null>(null);
  const onCallAnsweredRef = useRef<((fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) | null>(null);
  const onCallEndedRef = useRef<((fromUserId: string) => void) | null>(null);
  const onDirectRtcSignalRef = useRef<((fromUserId: string, signal: any) => void) | null>(null);
  const onVoicemailNotificationRef = useRef<((fromUserId: string, fromUserName: string, voicemail: any) => void) | null>(null);
  const onCallSyncRef = useRef<((fromUserId: string, data: any) => void) | null>(null);
  const onUserJoinedMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);
  const onUserLeftMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);

  const setRtcSignalHandler = useCallback((fn: (fromUserId: string, signal: any) => void) => {
    onRtcSignalRef.current = fn;
  }, []);
  const setUserCallHandler = useCallback((fn: (fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) => {
    onUserCallRef.current = fn;
  }, []);
  const setCallAnsweredHandler = useCallback((fn: (fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) => {
    onCallAnsweredRef.current = fn;
  }, []);
  const setCallEndedHandler = useCallback((fn: (fromUserId: string) => void) => {
    onCallEndedRef.current = fn;
  }, []);
  const setDirectRtcSignalHandler = useCallback((fn: ((fromUserId: string, signal: any) => void) | null) => {
    onDirectRtcSignalRef.current = fn;
  }, []);
  const setVoicemailNotificationHandler = useCallback((fn: (fromUserId: string, fromUserName: string, voicemail: any) => void) => {
    onVoicemailNotificationRef.current = fn;
  }, []);
  const setCallSyncHandler = useCallback((fn: (fromUserId: string, data: any) => void) => {
    onCallSyncRef.current = fn;
  }, []);
  const setMediaHandlers = useCallback(
    (onJoined: (userId: string, channel: string) => void, onLeft: (userId: string, channel: string) => void) => {
      onUserJoinedMediaRef.current = onJoined;
      onUserLeftMediaRef.current = onLeft;
    },
    []
  );

  const safeSend = useCallback((payload: any) => {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(raw);
      } catch (err) {
        console.warn('[wsDatabaseClient] Send failed, queueing:', err);
        outgoingQueueRef.current.push(raw);
      }
    } else {
      outgoingQueueRef.current.push(raw);
      if (outgoingQueueRef.current.length > 50) outgoingQueueRef.current.shift();
    }
  }, []);

  // Multi-tab BroadcastChannel for sync across tabs in same browser
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('frosthub_ws_channel');
      broadcastChannelRef.current = bc;
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'SYNC_USERS' && Array.isArray(data.users)) {
          setUsers(deduplicateUsers(data.users, currentUserRef.current.id));
        } else if (data.type === 'SYNC_MESSAGES' && Array.isArray(data.messages)) {
          setMessages((prev) => mergeMessages(prev, data.messages, deletedIdsRef.current));
        } else if (data.type === 'SYNC_DELETIONS' && data.deletedId) {
          deletedIdsRef.current.add(data.deletedId);
          setMessages((prev) => prev.filter((m) => m && m.id !== data.deletedId));
        } else if (data.type === 'DB_CLEAR_MESSAGES') {
          setMessages([]);
          deletedIdsRef.current.clear();
        }
      };
    } catch {}
    return () => {
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
    };
  }, []);

  // HTTP Fallback Polling Loop (ONLY for users presence & RTC signals — never touches chat messages)
  const fetchHttpSync = useCallback(async () => {
    try {
      const u = currentUserRef.current;
      const res = await fetch('/api/ws-db/snapshot');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsHttpSyncActive(true);
          if (Array.isArray(data.users)) {
            const serverUsers = data.users;
            const me = activeUserStateRef.current;
            const hasMe = serverUsers.some((user: DbUser) => user.id === me.id);
            const nextUsers = hasMe ? serverUsers : [me, ...serverUsers];
            setUsers(deduplicateUsers(nextUsers, me.id));
          }
        }
      }

      fetch('/api/ws-db/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: activeUserStateRef.current }),
      }).catch(() => {});

      const sigRes = await fetch(`/api/ws-db/signals/${encodeURIComponent(u.id)}`);
      if (sigRes.ok) {
        const sigData = await sigRes.json();
        if (sigData.success && Array.isArray(sigData.signals)) {
          sigData.signals.forEach((s: any) => {
            if (s.targetUserId === u.id && s.fromUserId !== u.id) {
              const sigKey = `${s.fromUserId}:${s.id}`;
              if (!processedRtcSignalsRef.current.has(sigKey)) {
                processedRtcSignalsRef.current.add(sigKey);
                if (processedRtcSignalsRef.current.size > 200) {
                  const [first] = processedRtcSignalsRef.current;
                  processedRtcSignalsRef.current.delete(first);
                }
                if (s.type === 'RTC_SIGNAL' && onRtcSignalRef.current) onRtcSignalRef.current(s.fromUserId, s.signal);
                else if (s.type === 'USER_CALL' && onUserCallRef.current)
                  onUserCallRef.current(s.fromUserId, s.fromUserName || 'Player', s.callType || 'audio');
                else if (s.type === 'CALL_ANSWERED' && onCallAnsweredRef.current)
                  onCallAnsweredRef.current(s.fromUserId, s.fromUserName || 'Player', s.callType || 'audio');
                else if (s.type === 'CALL_ENDED' && onCallEndedRef.current) onCallEndedRef.current(s.fromUserId);
                else if (s.type === 'DIRECT_RTC_SIGNAL' && onDirectRtcSignalRef.current)
                  onDirectRtcSignalRef.current(s.fromUserId, s.signal);
                else if (s.type === 'VOICEMAIL_NOTIFICATION' && onVoicemailNotificationRef.current)
                  onVoicemailNotificationRef.current(s.fromUserId, s.fromUserName || 'Player', s.voicemail);
                else if (s.type === 'CALL_SYNC' && onCallSyncRef.current) onCallSyncRef.current(s.fromUserId, s);
              }
            }
          });
        }
      }
    } catch {}
  }, []);

  // Immediate presence disconnect when window/tab is closed
  useEffect(() => {
    const handleLeave = () => {
      const uId = currentUserRef.current.id;
      if (!uId) return;
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'USER_DISCONNECT', userId: uId }));
          wsRef.current.close();
        }
      } catch {}
      try {
        const payload = JSON.stringify({ id: uId });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/ws-db/leave', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/ws-db/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);
    return () => {
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
    };
  }, []);

  // WebSocket Heartbeat
  const startHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch {}
      }
    }, 12000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)
    )
      return;
    try {
      const wsUrl = resolveWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        setIsWsConnected(true);
        startHeartbeat();
        ws.send(
          JSON.stringify({
            type: 'REGISTER_USER',
            user: activeUserStateRef.current,
          })
        );
        while (outgoingQueueRef.current.length > 0) {
          const item = outgoingQueueRef.current.shift();
          if (item) {
            try {
              ws.send(item);
            } catch {
              outgoingQueueRef.current.unshift(item);
              break;
            }
          }
        }
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'PING') {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            return;
          }
          if (msg.type === 'PONG') return;
          if (msg.type === 'DB_INIT') {
            if (Array.isArray(msg.tables?.users)) {
              const serverUsers = msg.tables.users;
              const me = activeUserStateRef.current;
              const hasMe = serverUsers.some((user: DbUser) => user.id === me.id);
              const nextUsers = hasMe ? serverUsers : [me, ...serverUsers];
              setUsers(deduplicateUsers(nextUsers, me.id));
            }
          } else if (msg.type === 'DB_SYNC') {
            if (msg.table === 'users' && Array.isArray(msg.data)) {
              const serverUsers = msg.data;
              const me = activeUserStateRef.current;
              const hasMe = serverUsers.some((user: DbUser) => user.id === me.id);
              const nextUsers = hasMe ? serverUsers : [me, ...serverUsers];
              setUsers(deduplicateUsers(nextUsers, me.id));
            } else if (msg.table === 'messages' && Array.isArray(msg.data)) {
              // Real-time live relay via WebSocket
              setMessages((prev) => mergeMessages(prev, msg.data, deletedIdsRef.current));
            }
          } else if (msg.type === 'DB_CLEAR_MESSAGES') {
            setMessages([]);
          } else if (msg.type === 'SQL_DELETE' && msg.table === 'messages' && msg.id) {
            deletedIdsRef.current.add(msg.id);
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          } else if (msg.type === 'SQL_DELETE_CHANNEL' && msg.table === 'messages' && msg.channel_id) {
            setMessages((prev) =>
              prev.filter((m) => {
                if (m && m.channel_id === msg.channel_id) {
                  deletedIdsRef.current.add(m.id);
                  return false;
                }
                return true;
              })
            );
          } else if (
            msg.type === 'RTC_SIGNAL' ||
            msg.type === 'USER_CALL' ||
            msg.type === 'CALL_ANSWERED' ||
            msg.type === 'CALL_ENDED' ||
            msg.type === 'DIRECT_RTC_SIGNAL' ||
            msg.type === 'CALL_SYNC' ||
            msg.type === 'VOICEMAIL_NOTIFICATION'
          ) {
            if (msg.targetUserId === currentUserRef.current.id && msg.fromUserId !== currentUserRef.current.id) {
              if (msg.sigId) {
                if (processedRtcSignalsRef.current.has(msg.sigId)) return;
                processedRtcSignalsRef.current.add(msg.sigId);
                if (processedRtcSignalsRef.current.size > 200) {
                  const [first] = processedRtcSignalsRef.current;
                  processedRtcSignalsRef.current.delete(first);
                }
              }
              if (msg.type === 'RTC_SIGNAL' && onRtcSignalRef.current) onRtcSignalRef.current(msg.fromUserId, msg.signal);
              else if (msg.type === 'USER_CALL' && onUserCallRef.current)
                onUserCallRef.current(msg.fromUserId, msg.fromUserName, msg.callType);
              else if (msg.type === 'CALL_ANSWERED' && onCallAnsweredRef.current)
                onCallAnsweredRef.current(msg.fromUserId, msg.fromUserName, msg.callType);
              else if (msg.type === 'CALL_ENDED' && onCallEndedRef.current) onCallEndedRef.current(msg.fromUserId);
              else if (msg.type === 'DIRECT_RTC_SIGNAL' && onDirectRtcSignalRef.current)
                onDirectRtcSignalRef.current(msg.fromUserId, msg.signal);
              else if (msg.type === 'CALL_SYNC' && onCallSyncRef.current) onCallSyncRef.current(msg.fromUserId, msg);
              else if (msg.type === 'VOICEMAIL_NOTIFICATION' && onVoicemailNotificationRef.current)
                onVoicemailNotificationRef.current(msg.fromUserId, msg.fromUserName, msg.voicemail);
            }
          } else if (msg.type === 'USER_JOINED_MEDIA') {
            if (onUserJoinedMediaRef.current) onUserJoinedMediaRef.current(msg.userId, msg.channel);
          } else if (msg.type === 'USER_LEFT_MEDIA') {
            if (onUserLeftMediaRef.current) onUserLeftMediaRef.current(msg.userId, msg.channel);
          } else if (msg.type === 'USER_MEDIA_UPDATE') {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'GET_USERS' }));
            }
          }
        } catch {}
      };
      ws.onclose = () => {
        setIsWsConnected(false);
        stopHeartbeat();
        wsRef.current = null;
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 2500);
        }
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    } catch {
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 2500);
      }
    }
  }, [startHeartbeat, stopHeartbeat]);

  useEffect(() => {
    fetchHttpSync();
    connect();
    httpSyncIntervalRef.current = setInterval(fetchHttpSync, 4000);
    const handleOnline = () => {
      fetchHttpSync();
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) connect();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      stopHeartbeat();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (httpSyncIntervalRef.current) clearInterval(httpSyncIntervalRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, [connect, stopHeartbeat, fetchHttpSync]);

  // --- Mutators (Users & Signaling -> WebSockets ONLY; Chat Messages -> WebSocket live relay + Firebase persistence ONLY) ---

  const updateUser = useCallback(
    async (set: Partial<DbUser>) => {
      const u = currentUserRef.current;
      Object.assign(currentUserRef.current, set);
      Object.assign(activeUserStateRef.current, set);
      activeUserStateRef.current.updated_at = Date.now();

      // Local State
      setUsers((prev) => {
        const next = prev.map((user) => (user.id === u.id ? { ...user, ...set, updated_at: Date.now() } : user));
        const sorted = deduplicateUsers(next, u.id);
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: sorted });
        return sorted;
      });

      // WebSocket / REST presence relay (NEVER stored in Firebase)
      safeSend({ type: 'SQL_UPDATE', table: 'users', id: u.id, set });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch('/api/ws-db/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: u.id, set }),
        }).catch(() => {});
      }
    },
    [safeSend]
  );

  const insertMessage = useCallback(
    async (
      content: string,
      channelId: string = 'text-general',
      attachment?: { url: string; type: string; name?: string }
    ) => {
      if (!content.trim() && !attachment) return;
      const u = currentUserRef.current;
      const newMsg: DbMessage = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        channel_id: channelId,
        sender_id: u.id,
        sender_name: u.username,
        avatar_color: u.avatar_color,
        sender_avatar_url: u.avatar_url || '',
        content: content.trim(),
        attachment_url: attachment?.url,
        attachment_type: attachment?.type,
        attachment_name: attachment?.name,
        timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        created_at: Date.now(),
      };

      // 1. Optimistic local state
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        const next = [...prev, newMsg];
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_MESSAGES', messages: [newMsg] });
        return next;
      });

      // 2. WebSocket real-time relay (NOT saved to WS disk)
      safeSend({ type: 'SQL_INSERT', table: 'messages', row: newMsg });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch('/api/ws-db/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row: newMsg }),
        }).catch(() => {});
      }

      // 3. Firebase ONLY saves chat messages
      try {
        await setDoc(doc(db, 'messages', newMsg.id), cleanData(newMsg));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `messages/${newMsg.id}`);
      }
    },
    [safeSend]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      deletedIdsRef.current.add(messageId);

      // 1. Optimistic local state
      setMessages((prev) => {
        const next = prev.filter((m) => m && m.id !== messageId);
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_DELETIONS', deletedId: messageId });
        return next;
      });

      // 2. WebSocket live deletion relay
      safeSend({ type: 'SQL_DELETE', table: 'messages', id: messageId });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch(`/api/ws-db/message/${encodeURIComponent(messageId)}`, { method: 'DELETE' }).catch(() => {});
      }

      // 3. Firebase persistent delete + tombstone
      try {
        await deleteDoc(doc(db, 'messages', messageId));
        await setDoc(doc(db, 'deletions', messageId), { id: messageId, deleted_at: Date.now() });
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `messages/${messageId}`);
      }
    },
    [safeSend]
  );

  const deleteChannelMessages = useCallback(
    async (channelId: string) => {
      // 1. Optimistic local state
      setMessages((prev) =>
        prev.filter((m) => {
          if (m && m.channel_id === channelId) {
            deletedIdsRef.current.add(m.id);
            return false;
          }
          return true;
        })
      );

      // 2. WebSocket live relay
      safeSend({ type: 'SQL_DELETE_CHANNEL', table: 'messages', channel_id: channelId });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch(`/api/ws-db/channel-messages/${encodeURIComponent(channelId)}`, { method: 'DELETE' }).catch(() => {});
      }

      // 3. Firebase persistent channel delete
      try {
        const q = query(collection(db, 'messages'), where('channel_id', '==', channelId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((msgDoc) => {
          deletedIdsRef.current.add(msgDoc.id);
          batch.delete(msgDoc.ref);
          batch.set(doc(db, 'deletions', msgDoc.id), { id: msgDoc.id, deleted_at: Date.now() });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `messages?channel_id=${channelId}`);
      }
    },
    [safeSend]
  );

  const clearAllMessages = useCallback(async () => {
    setMessages([]);
    deletedIdsRef.current.clear();
    broadcastChannelRef.current?.postMessage({ type: 'DB_CLEAR_MESSAGES' });

    safeSend({ type: 'SQL_DELETE_ALL' });
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      fetch('/api/ws-db/messages/all', { method: 'DELETE' }).catch(() => {});
    }

    try {
      const msgSnap = await getDocs(collection(db, 'messages'));
      const msgBatch = writeBatch(db);
      msgSnap.forEach((d) => msgBatch.delete(d.ref));
      await msgBatch.commit();

      const delSnap = await getDocs(collection(db, 'deletions'));
      const delBatch = writeBatch(db);
      delSnap.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'messages');
    }
  }, [safeSend]);

  const registerUser = useCallback(
    (user: {
      id: string;
      username: string;
      avatar_color: string;
      avatar_url?: string;
      current_channel?: string;
      activity?: string;
    }) => {
      const activeChannel = (user as any).current_channel || activeUserStateRef.current.current_channel || 'text-general';
      const dbUser: DbUser = {
        ...activeUserStateRef.current,
        id: user.id,
        username: user.username,
        avatar_color: user.avatar_color || '#0066ff',
        avatar_url: user.avatar_url || '',
        current_channel: activeChannel as any,
        activity: user.activity || activeUserStateRef.current.activity || '',
        updated_at: Date.now(),
      };
      Object.assign(activeUserStateRef.current, dbUser);

      // WebSocket / REST ONLY (Firebase does not store user presence)
      safeSend({ type: 'REGISTER_USER', user: dbUser });
      fetch('/api/ws-db/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: dbUser }),
      }).catch(() => {});

      setUsers((prev) => {
        const filtered = prev.filter((x) => x && x.id !== user.id);
        const next = deduplicateUsers([dbUser, ...filtered], user.id);
        broadcastChannelRef.current?.postMessage({ type: 'SYNC_USERS', users: next });
        return next;
      });
    },
    [safeSend]
  );

  const sendRtcSignal = useCallback((targetUserId: string, signal: any) => {
    const fromUserId = currentUserRef.current.id;
    const sigId = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = { type: 'RTC_SIGNAL', fromUserId, targetUserId, signal, sigId };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
        return;
      } catch {}
    }

    fetch('/api/ws-db/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  const callUser = useCallback(
    (targetUserId: string, callType: 'audio' | 'video') => {
      const u = currentUserRef.current;
      safeSend({ type: 'USER_CALL', fromUserId: u.id, fromUserName: u.username, targetUserId, callType });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch('/api/ws-db/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromUserId: u.id, fromUserName: u.username, targetUserId, type: 'USER_CALL', callType }),
        }).catch(() => {});
      }
    },
    [safeSend]
  );

  const answerCall = useCallback(
    (targetUserId: string, callType: 'audio' | 'video' = 'audio') => {
      const u = currentUserRef.current;
      safeSend({ type: 'CALL_ANSWERED', fromUserId: u.id, fromUserName: u.username, targetUserId, callType });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch('/api/ws-db/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromUserId: u.id, fromUserName: u.username, targetUserId, type: 'CALL_ANSWERED', callType }),
        }).catch(() => {});
      }
    },
    [safeSend]
  );

  const endCallSignal = useCallback(
    (targetUserId: string) => {
      const u = currentUserRef.current;
      safeSend({ type: 'CALL_ENDED', fromUserId: u.id, targetUserId });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch('/api/ws-db/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromUserId: u.id, targetUserId, type: 'CALL_ENDED' }),
        }).catch(() => {});
      }
    },
    [safeSend]
  );

  const sendDirectRtcSignal = useCallback((targetUserId: string, signal: any) => {
    const fromUserId = currentUserRef.current.id;
    const sigId = `dsig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = { type: 'DIRECT_RTC_SIGNAL', fromUserId, targetUserId, signal, sigId };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
        return;
      } catch {}
    }

    fetch('/api/ws-db/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  const sendVoicemailNotification = useCallback(
    (targetUserId: string, voicemail: any) => {
      const u = currentUserRef.current;
      safeSend({ type: 'VOICEMAIL_NOTIFICATION', fromUserId: u.id, fromUserName: u.username, targetUserId, voicemail });
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch('/api/ws-db/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromUserId: u.id,
            fromUserName: u.username,
            targetUserId,
            type: 'VOICEMAIL_NOTIFICATION',
            voicemail,
          }),
        }).catch(() => {});
      }
    },
    [safeSend]
  );

  const sendCallSync = useCallback(
    (targetUserId: string, data: { hold?: boolean; muted?: boolean; video?: boolean }) => {
      const fromUserId = currentUserRef.current.id;
      const payload = { type: 'CALL_SYNC', fromUserId, targetUserId, ...data };
      safeSend(payload);
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetch('/api/ws-db/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    },
    [safeSend]
  );

  return {
    users,
    messages,
    isConnected: isWsConnected || isHttpSyncActive || isFirebaseActive,
    isFirebaseActive,
    updateUser,
    insertMessage,
    deleteMessage,
    deleteChannelMessages,
    clearAllMessages,
    registerUser,
    callUser,
    answerCall,
    endCallSignal,
    sendDirectRtcSignal,
    sendVoicemailNotification,
    sendCallSync,
    sendRtcSignal,
    setRtcSignalHandler,
    setUserCallHandler,
    setCallAnsweredHandler,
    setCallEndedHandler,
    setDirectRtcSignalHandler,
    setVoicemailNotificationHandler,
    setCallSyncHandler,
    setMediaHandlers,
    ws: wsRef.current,
  };
}

