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
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { DbUser, DbMessage } from '../server/wsDatabase';

const PRESENCE_COLLECTION = 'presence';
const SIGNALS_COLLECTION = 'webrtcSignals';
const MESSAGES_COLLECTION = 'messages';

/**
 * Publish user presence heartbeat to Firestore
 */
export async function publishPresence(user: DbUser): Promise<void> {
  if (!user?.id) return;
  try {
    const presenceRef = doc(db, PRESENCE_COLLECTION, user.id);
    await setDoc(presenceRef, {
      id: user.id,
      username: user.username || 'Anonymous Player',
      avatar_color: user.avatar_color || '#0066ff',
      avatar_url: user.avatar_url || '',
      current_channel: user.current_channel || 'text-general',
      activity: user.activity || '',
      is_speaking: Boolean(user.is_speaking),
      is_muted: Boolean(user.is_muted),
      is_deafened: Boolean(user.is_deafened),
      has_video: Boolean(user.has_video),
      is_screen_sharing: Boolean(user.is_screen_sharing),
      is_hand_raised: Boolean(user.is_hand_raised),
      lastSeen: Date.now(),
      updated_at: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn('[cloudSignaling] publishPresence error:', err);
  }
}

/**
 * Clean up presence when user disconnects or unmounts
 */
export async function removePresence(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const presenceRef = doc(db, PRESENCE_COLLECTION, userId);
    await deleteDoc(presenceRef);
  } catch (err) {
    console.warn('[cloudSignaling] removePresence error:', err);
  }
}

/**
 * Subscribe to online users across all connected clients on Vercel
 */
export function subscribePresence(
  currentUserId: string,
  onUsersUpdate: (users: DbUser[]) => void
): () => void {
  try {
    const presenceCol = collection(db, PRESENCE_COLLECTION);
    const unsubscribe = onSnapshot(
      presenceCol,
      (snapshot) => {
        const now = Date.now();
        const activeUsers: DbUser[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data || !data.id) return;

          // Only consider users who have sent a heartbeat in the last 30 seconds
          const lastSeen = Number(data.lastSeen) || Number(data.updated_at) || 0;
          const isFresh = now - lastSeen < 30000;

          if (isFresh || data.id === currentUserId) {
            activeUsers.push({
              id: data.id,
              username: data.username || 'Player',
              avatar_color: data.avatar_color || '#0066ff',
              avatar_url: data.avatar_url || '',
              current_channel: data.current_channel || 'text-general',
              is_speaking: Boolean(data.is_speaking),
              is_muted: Boolean(data.is_muted),
              is_deafened: Boolean(data.is_deafened),
              has_video: Boolean(data.has_video),
              is_screen_sharing: Boolean(data.is_screen_sharing),
              is_hand_raised: Boolean(data.is_hand_raised),
              activity: data.activity || '',
              updated_at: lastSeen || now,
            });
          }
        });

        onUsersUpdate(activeUsers);
      },
      (error) => {
        console.warn('[cloudSignaling] Presence subscription error:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[cloudSignaling] subscribePresence error:', err);
    return () => {};
  }
}

/**
 * Send WebRTC signaling payload (offer, answer, candidate, track-meta, user-call)
 */
export async function sendCloudRtcSignal(
  fromUserId: string,
  targetUserId: string,
  signal: any
): Promise<void> {
  if (!fromUserId || !targetUserId || !signal) return;
  try {
    const signalId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const signalDoc = doc(db, SIGNALS_COLLECTION, signalId);

    await setDoc(signalDoc, {
      id: signalId,
      fromUserId,
      targetUserId,
      signal: JSON.stringify(signal),
      createdAt: Date.now(),
    });
  } catch (err) {
    console.warn('[cloudSignaling] sendCloudRtcSignal error:', err);
  }
}

/**
 * Subscribe to WebRTC signals targeted at current user
 */
export function subscribeCloudRtcSignals(
  currentUserId: string,
  onSignal: (fromUserId: string, signal: any) => void
): () => void {
  if (!currentUserId) return () => {};

  const processedSignalIds = new Set<string>();

  try {
    const signalsQuery = query(
      collection(db, SIGNALS_COLLECTION),
      where('targetUserId', '==', currentUserId)
    );

    const unsubscribe = onSnapshot(
      signalsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const signalId = data.id || change.doc.id;

            if (processedSignalIds.has(signalId)) return;
            processedSignalIds.add(signalId);

            // Clean up old memory IDs
            if (processedSignalIds.size > 200) {
              const [first] = processedSignalIds;
              processedSignalIds.delete(first);
            }

            try {
              const parsedSignal = JSON.parse(data.signal);
              onSignal(data.fromUserId, parsedSignal);
            } catch (parseErr) {
              console.warn('[cloudSignaling] Failed to parse signal:', parseErr);
            }

            // Immediately delete processed signal doc to maintain lean storage
            deleteDoc(change.doc.ref).catch(() => {});
          }
        });
      },
      (error) => {
        console.warn('[cloudSignaling] Signal subscription error:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[cloudSignaling] subscribeCloudRtcSignals error:', err);
    return () => {};
  }
}

/**
 * Send chat message to Firestore messages collection
 */
export async function sendCloudChatMessage(msg: DbMessage): Promise<void> {
  if (!msg?.id) return;
  try {
    const messageDoc = doc(db, MESSAGES_COLLECTION, msg.id);
    await setDoc(messageDoc, {
      id: msg.id,
      text: msg.content || (msg.attachment_name ? `[${msg.attachment_type || 'File'}] ${msg.attachment_name}` : 'Message'),
      userId: msg.sender_id,
      userName: msg.sender_name,
      createdAt: new Date(msg.created_at || Date.now()).toISOString(),
      channel_id: msg.channel_id || 'text-general',
      avatar_color: msg.avatar_color || '#0066ff',
      sender_avatar_url: msg.sender_avatar_url || '',
      content: msg.content || '',
      attachment_url: msg.attachment_url || '',
      attachment_type: msg.attachment_type || '',
      attachment_name: msg.attachment_name || '',
      timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  } catch (err) {
    console.warn('[cloudSignaling] sendCloudChatMessage error:', err);
  }
}

/**
 * Update all messages for a user with their latest username and avatar
 */
export async function updateCloudUserMessages(
  userId: string, 
  profile: { username: string; avatar_color: string; avatar_url: string }
): Promise<void> {
  if (!userId) return;
  try {
    // Query last 100 messages from this user to update profile info
    const q = query(
      collection(db, MESSAGES_COLLECTION),
      where('userId', '==', userId),
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map((docSnap) => {
      return updateDoc(docSnap.ref, {
        userName: profile.username,
        avatar_color: profile.avatar_color,
        sender_avatar_url: profile.avatar_url
      });
    });
    
    await Promise.all(updates);
  } catch (err) {
    console.warn('[cloudSignaling] updateCloudUserMessages error:', err);
  }
}

/**
 * Delete chat message from Firestore messages collection
 */
export async function deleteCloudChatMessage(messageId: string): Promise<void> {
  if (!messageId) return;
  try {
    const messageDoc = doc(db, MESSAGES_COLLECTION, messageId);
    await deleteDoc(messageDoc);
  } catch (err) {
    console.warn('[cloudSignaling] deleteCloudChatMessage error:', err);
  }
}

/**
 * Subscribe to cloud chat messages
 */
export function subscribeCloudMessages(
  onMessages: (messages: DbMessage[]) => void
): () => void {
  try {
    const messagesQuery = query(
      collection(db, MESSAGES_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const cloudMessages: DbMessage[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (!d) return;
          cloudMessages.push({
            id: d.id || docSnap.id,
            channel_id: d.channel_id || 'text-general',
            sender_id: d.userId || d.sender_id || 'anonymous',
            sender_name: d.userName || d.sender_name || 'Player',
            avatar_color: d.avatar_color || '#0066ff',
            sender_avatar_url: d.sender_avatar_url || '',
            content: d.content || d.text || '',
            attachment_url: d.attachment_url || undefined,
            attachment_type: d.attachment_type || undefined,
            attachment_name: d.attachment_name || undefined,
            timestamp: d.timestamp || 'Just now',
            created_at: d.createdAt ? new Date(d.createdAt).getTime() : Date.now(),
          });
        });

        // Sort ascending by creation time for chat view
        cloudMessages.sort((a, b) => a.created_at - b.created_at);
        onMessages(cloudMessages);
      },
      (error) => {
        console.warn('[cloudSignaling] Messages subscription error:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[cloudSignaling] subscribeCloudMessages error:', err);
    return () => {};
  }
}
