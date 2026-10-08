import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { DbUser, DbMessage } from '../server/socketIoDatabase';

export interface RtcSignalPayload {
  fromUserId: string;
  targetUserId: string;
  signal: any;
}

export function useWebSocketDatabase(currentUser: { id: string; username: string; avatar_color: string; avatar_url?: string }) {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Use a ref for currentUser to avoid reconnecting when only username/avatar changes
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Callbacks for WebRTC signaling
  const onRtcSignalRef = useRef<((fromUserId: string, signal: any) => void) | null>(null);
  const onUserCallRef = useRef<((fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) | null>(null);
  const onUserJoinedMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);
  const onUserLeftMediaRef = useRef<((userId: string, channel: string) => void) | null>(null);

  const setRtcSignalHandler = useCallback((fn: (fromUserId: string, signal: any) => void) => {
    onRtcSignalRef.current = fn;
  }, []);

  const setUserCallHandler = useCallback((fn: (fromUserId: string, fromUserName: string, callType: 'audio' | 'video') => void) => {
    onUserCallRef.current = fn;
  }, []);

  const setMediaHandlers = useCallback((
    onJoined: (userId: string, channel: string) => void,
    onLeft: (userId: string, channel: string) => void
  ) => {
    onUserJoinedMediaRef.current = onJoined;
    onUserLeftMediaRef.current = onLeft;
  }, []);

  useEffect(() => {
    const socket = io({ path: '/ws-db' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      const u = currentUserRef.current;
      socket.emit('REGISTER_USER', {
        user: {
          id: u.id,
          username: u.username,
          avatar_color: u.avatar_color,
          avatar_url: u.avatar_url || null,
          current_channel: 'text-general',
          is_speaking: false,
          is_muted: false,
          is_deafened: false,
          has_video: false,
          is_screen_sharing: false,
        },
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('DB_INIT', (data) => {
      setUsers(data.users);
      setMessages(data.messages);
    });

    socket.on('DB_SYNC', (data) => {
      if (data.table === 'users') setUsers(data.data);
      else if (data.table === 'messages') setMessages(data.data);
    });

    socket.on('RTC_SIGNAL', (msg) => {
      if (onRtcSignalRef.current) onRtcSignalRef.current(msg.fromUserId, msg.signal);
    });

    socket.on('USER_CALL', (msg) => {
      if (onUserCallRef.current) onUserCallRef.current(msg.fromUserId, msg.fromUserName, msg.callType);
    });

    socket.on('USER_JOINED_MEDIA', (msg) => {
      if (onUserJoinedMediaRef.current) onUserJoinedMediaRef.current(msg.userId, msg.channel);
    });

    socket.on('USER_LEFT_MEDIA', (msg) => {
      if (onUserLeftMediaRef.current) onUserLeftMediaRef.current(msg.userId, msg.channel);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const updateUser = useCallback((set: Partial<DbUser>) => {
    socketRef.current?.emit('SQL_UPDATE', { table: 'users', id: currentUserRef.current.id, set });
  }, []);

  const insertMessage = useCallback((content: string, channelId: string = 'text-general', attachment?: { url: string; type: string; name?: string }) => {
    if (!content.trim() && !attachment) return;
    const u = currentUserRef.current;
    socketRef.current?.emit('SQL_INSERT', {
      table: 'messages',
      row: {
        channel_id: channelId,
        sender_id: u.id,
        sender_name: u.username,
        avatar_color: u.avatar_color,
        sender_avatar_url: u.avatar_url || null,
        content: content.trim(),
        attachment_url: attachment?.url,
        attachment_type: attachment?.type,
        attachment_name: attachment?.name,
        timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    });
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    socketRef.current?.emit('SQL_DELETE', { table: 'messages', id: messageId });
  }, []);

  const registerUser = useCallback((user: { id: string; username: string; avatar_color: string; avatar_url?: string }) => {
    socketRef.current?.emit('REGISTER_USER', {
      user: {
        ...user,
        avatar_url: user.avatar_url || null,
        current_channel: 'text-general',
        is_speaking: false,
        is_muted: false,
        is_deafened: false,
        has_video: false,
        is_screen_sharing: false,
      },
    });
  }, []);

  const sendRtcSignal = useCallback((targetUserId: string, signal: any) => {
    socketRef.current?.emit('RTC_SIGNAL', {
      fromUserId: currentUserRef.current.id,
      targetUserId,
      signal,
    });
  }, []);

  const callUser = useCallback((targetUserId: string, callType: 'audio' | 'video') => {
    socketRef.current?.emit('USER_CALL', {
      fromUserId: currentUserRef.current.id,
      fromUserName: currentUserRef.current.username,
      targetUserId,
      callType,
    });
  }, []);

  return {
    users,
    messages,
    isConnected,
    updateUser,
    insertMessage,
    deleteMessage,
    registerUser,
    callUser,
    sendRtcSignal,
    setRtcSignalHandler,
    setUserCallHandler,
    setMediaHandlers,
    ws: socketRef.current,
  };
}

