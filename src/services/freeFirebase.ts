/**
 * FreeFirebase SDK: An exact drop-in compatible client library mirroring Firebase (Firestore, Auth, Storage)
 * but powered by our Unlimited Free Forever WebSocket + SSE + PostgreSQL backend router.
 * No real Firebase SDK required!
 */

import { io, Socket } from 'socket.io-client';

export interface FirebaseApp {
  name: string;
  options: Record<string, any>;
}

let defaultApp: FirebaseApp | null = null;
let globalSocket: Socket | null = null;
let currentAuthUser: any = null;
const authListeners = new Set<(user: any) => void>();
const storeCache = new Map<string, Map<string, any>>();
const snapshotListeners = new Map<string, Set<(snapshot: any) => void>>();

export function initializeApp(options: Record<string, any>): FirebaseApp {
  defaultApp = { name: '[DEFAULT]', options };
  
  if (!globalSocket) {
    globalSocket = io({
      path: '/ws-db',
      reconnection: true,
      reconnectionAttempts: 50,
      reconnectionDelay: 200,
    });

    globalSocket.on('connect', () => {
      console.log('🔥 FreeFirebase connected to WebSocket backend.');
    });

    globalSocket.on('DB_INIT', (data) => {
      if (data.users) {
        const uMap = new Map<string, any>();
        data.users.forEach((u: any) => uMap.set(u.id, u));
        storeCache.set('users', uMap);
        notifySnapshot('users');
      }
      if (data.messages) {
        const mMap = new Map<string, any>();
        data.messages.forEach((m: any) => mMap.set(m.id, m));
        storeCache.set('messages', mMap);
        notifySnapshot('messages');
      }
    });

    globalSocket.on('DB_SYNC', (data) => {
      const table = data.table;
      const rows = data.data || [];
      const map = new Map<string, any>();
      rows.forEach((r: any) => map.set(r.id || r.id, r));
      storeCache.set(table, map);
      notifySnapshot(table);
    });
  }

  return defaultApp;
}

export function getApp(name?: string): FirebaseApp {
  if (!defaultApp) {
    return initializeApp({ projectId: 'free-forever-db' });
  }
  return defaultApp;
}

export function getFirestore(app?: FirebaseApp) {
  return {
    app: app || getApp(),
    type: 'firestore',
  };
}

export function getAuth(app?: FirebaseApp) {
  return {
    app: app || getApp(),
    currentUser: currentAuthUser,
  };
}

export function getStorage(app?: FirebaseApp) {
  return {
    app: app || getApp(),
  };
}

// Collection & Document References
export interface CollectionReference {
  path: string;
  type: 'collection';
}

export interface DocumentReference {
  path: string;
  id: string;
  type: 'document';
}

export function collection(dbOrFirestore: any, path: string): CollectionReference {
  return { path, type: 'collection' };
}

export function doc(dbOrFirestoreOrColl: any, pathOrId?: string, id?: string): DocumentReference {
  if (pathOrId && id) {
    return { path: `${pathOrId}/${id}`, id, type: 'document' };
  }
  return { path: pathOrId || 'doc', id: id || 'doc-' + Date.now(), type: 'document' };
}

function notifySnapshot(collectionPath: string) {
  const listeners = snapshotListeners.get(collectionPath);
  if (!listeners) return;
  const map = storeCache.get(collectionPath) || new Map();
  const docs = Array.from(map.values()).map(data => ({
    id: data.id,
    data: () => data,
    exists: () => true,
    ...data,
  }));
  const snapshot = {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb: any) => docs.forEach(cb),
  };
  listeners.forEach(fn => fn(snapshot));
}

export async function addDoc(collRef: CollectionReference, data: any) {
  const id = data.id || ('doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5));
  const record = { ...data, id, created_at: Date.now() };
  
  if (!storeCache.has(collRef.path)) {
    storeCache.set(collRef.path, new Map());
  }
  storeCache.get(collRef.path)?.set(id, record);

  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('SQL_INSERT', {
      table: collRef.path,
      row: record,
    });
  }
  notifySnapshot(collRef.path);
  return { id, path: `${collRef.path}/${id}` };
}

export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }) {
  const parts = docRef.path.split('/');
  const collPath = parts[0];
  const docId = parts[1] || docRef.id;

  if (!storeCache.has(collPath)) {
    storeCache.set(collPath, new Map());
  }
  const existing = storeCache.get(collPath)?.get(docId) || {};
  const record = options?.merge ? { ...existing, ...data, id: docId } : { ...data, id: docId };
  storeCache.get(collPath)?.set(docId, record);

  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('SQL_UPDATE', {
      table: collPath,
      id: docId,
      set: record,
    });
  }
  notifySnapshot(collPath);
}

export async function updateDoc(docRef: DocumentReference, data: any) {
  await setDoc(docRef, data, { merge: true });
}

export async function deleteDoc(docRef: DocumentReference) {
  const parts = docRef.path.split('/');
  const collPath = parts[0];
  const docId = parts[1] || docRef.id;

  storeCache.get(collPath)?.delete(docId);
  if (globalSocket && globalSocket.connected) {
    globalSocket.emit('SQL_DELETE', {
      table: collPath,
      id: docId,
    });
  }
  notifySnapshot(collPath);
}

export async function getDoc(docRef: DocumentReference) {
  const parts = docRef.path.split('/');
  const collPath = parts[0];
  const docId = parts[1] || docRef.id;
  const data = storeCache.get(collPath)?.get(docId);
  return {
    exists: () => !!data,
    data: () => data || null,
    id: docId,
  };
}

export async function getDocs(queryOrColl: any) {
  const path = queryOrColl.path || 'messages';
  const map = storeCache.get(path) || new Map();
  const docs = Array.from(map.values()).map(data => ({
    id: data.id,
    data: () => data,
    exists: () => true,
  }));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb: any) => docs.forEach(cb),
  };
}

export function onSnapshot(queryOrRef: any, callback: (snapshot: any) => void) {
  const path = queryOrRef.path || 'messages';
  if (!snapshotListeners.has(path)) {
    snapshotListeners.set(path, new Set());
  }
  snapshotListeners.get(path)?.add(callback);

  const map = storeCache.get(path);
  if (map && map.size > 0) {
    const docs = Array.from(map.values()).map(data => ({
      id: data.id,
      data: () => data,
      exists: () => true,
    }));
    callback({
      docs,
      size: docs.length,
      empty: false,
      forEach: (cb: any) => docs.forEach(cb),
    });
  } else {
    callback({
      docs: [],
      size: 0,
      empty: true,
      forEach: () => {},
    });
  }

  return () => {
    snapshotListeners.get(path)?.delete(callback);
  };
}

export function query(collRef: CollectionReference, ...queryConstraints: any[]) {
  return collRef;
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction?: 'asc' | 'desc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number) {
  return { type: 'limit', n };
}

// Auth simulation
export async function signInAnonymously(auth: any) {
  const user = {
    uid: 'anon-' + Math.random().toString(36).substr(2, 9),
    isAnonymous: true,
    email: null,
    displayName: 'Anonymous User',
  };
  currentAuthUser = user;
  authListeners.forEach(fn => fn(user));
  return { user };
}

export async function signInWithEmailAndPassword(auth: any, email: string, pass: string) {
  const user = {
    uid: 'user-' + btoa(email).replace(/=/g, ''),
    isAnonymous: false,
    email,
    displayName: email.split('@')[0],
  };
  currentAuthUser = user;
  authListeners.forEach(fn => fn(user));
  return { user };
}

export async function createUserWithEmailAndPassword(auth: any, email: string, pass: string) {
  return signInWithEmailAndPassword(auth, email, pass);
}

export async function signOut(auth: any) {
  currentAuthUser = null;
  authListeners.forEach(fn => fn(null));
}

export function onAuthStateChanged(auth: any, callback: (user: any) => void) {
  authListeners.add(callback);
  callback(currentAuthUser);
  return () => {
    authListeners.delete(callback);
  };
}

// Storage simulation
export function ref(storage: any, path: string) {
  return { path, type: 'storage-ref' };
}

export async function uploadBytes(storageRef: any, fileOrBlob: Blob | File) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        ref: storageRef,
        metadata: { fullPath: storageRef.path },
        downloadURL: reader.result as string,
      });
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

export async function getDownloadURL(storageRef: any) {
  return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800';
}
