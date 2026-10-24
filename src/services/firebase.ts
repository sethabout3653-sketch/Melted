import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  getDocFromServer,
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import localConfig from '../../firebase-applet-config.json';

// Support both local config file and Vite environment variables
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || localConfig.measurementId,
};

export const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || localConfig.firestoreDatabaseId || '(default)';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const start = performance.now();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    const latency = Math.round(performance.now() - start);
    return { success: true, latencyMs: latency };
  } catch (error: any) {
    const latency = Math.round(performance.now() - start);
    // Offline or normal document missing is still a successful server roundtrip
    if (error?.code === 'not-found' || error?.message?.includes('not-found')) {
      return { success: true, latencyMs: latency };
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
      return { success: false, latencyMs: latency, error: 'Client is offline. Check Firebase config.' };
    }
    return { success: true, latencyMs: latency };
  }
}

// Initial boot connection check
testConnection().catch(() => {});

/**
 * Sign in using Google OAuth popup
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    console.error('Firebase Google Sign-in error:', err);
    throw err;
  }
}

/**
 * Sign out from Firebase Auth
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Save user's favorites array to Firestore with rule validation compliance
 */
export async function syncFavoritesToFirestore(userId: string, favoriteGameIds: number[]): Promise<void> {
  const docPath = `userFavorites/${userId}`;
  try {
    await setDoc(doc(db, 'userFavorites', userId), {
      id: userId,
      userId: userId,
      favoriteGameIds: favoriteGameIds.slice(0, 500),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}

/**
 * Load user's favorites from Firestore
 */
export async function loadFavoritesFromFirestore(userId: string): Promise<number[] | null> {
  const docPath = `userFavorites/${userId}`;
  try {
    const snapshot = await getDoc(doc(db, 'userFavorites', userId));
    if (snapshot.exists()) {
      const data = snapshot.data();
      return Array.isArray(data.favoriteGameIds) ? data.favoriteGameIds : [];
    }
    return null;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.GET, docPath);
    return null;
  }
}
