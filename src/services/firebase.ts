import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
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

// Embedded fallback credentials to guarantee zero-crash execution on Vercel or preview deploys
export const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'analog-cathode-kfs6l',
  appId: '1:630735569759:web:09b818a7611bf40c41acea',
  apiKey: 'AIzaSyCkOwYbegyyClXTd2WTgv60sGPp8o6xj4E',
  authDomain: 'analog-cathode-kfs6l.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-melted-101d2f67-26ab-49fa-80db-faf0be512233',
  storageBucket: 'analog-cathode-kfs6l.firebasestorage.app',
  messagingSenderId: '630735569759',
  measurementId: '',
};

// Priority: Vite env vars -> firebase-applet-config.json -> embedded fallback
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig?.apiKey || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig?.authDomain || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig?.projectId || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig?.storageBucket || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig?.messagingSenderId || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig?.appId || DEFAULT_FIREBASE_CONFIG.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || localConfig?.measurementId || DEFAULT_FIREBASE_CONFIG.measurementId,
};

export const firestoreDatabaseId = 
  import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 
  localConfig?.firestoreDatabaseId || 
  DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with auto-detect long polling so that Firestore connects reliably
// across Vercel serverless previews, corporate firewalls, and restricted web sockets
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, firestoreDatabaseId);
} catch {
  firestoreDb = getFirestore(app, firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export function getCurrentHostname(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname;
  }
  return '';
}

export function isVercelDomain(hostname?: string): boolean {
  const host = hostname || getCurrentHostname();
  return host.includes('.vercel.app');
}

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

/**
 * Validates connection to Firestore. Required check when the application boots.
 */
export async function testConnection(): Promise<{ 
  success: boolean; 
  latencyMs: number; 
  error?: string;
  code?: string;
  isOffline?: boolean;
}> {
  const start = performance.now();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    const latency = Math.round(performance.now() - start);
    return { success: true, latencyMs: latency };
  } catch (error: any) {
    const latency = Math.round(performance.now() - start);
    const msg = error instanceof Error ? error.message : String(error);
    const code = error?.code || '';

    // If document is not found, or if rules permit/deny, that means server roundtrip succeeded!
    if (code === 'not-found' || msg.includes('not-found')) {
      return { success: true, latencyMs: latency };
    }
    if (code === 'permission-denied' || msg.includes('insufficient permissions')) {
      return { success: true, latencyMs: latency };
    }

    if (msg.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
      return { 
        success: false, 
        latencyMs: latency, 
        error: 'Client is offline. Check Firebase configuration and network connection.',
        isOffline: true 
      };
    }

    return { 
      success: false, 
      latencyMs: latency, 
      error: msg,
      code 
    };
  }
}

// Initial boot connection test
testConnection().catch(() => {});

/**
 * Sign in using Google OAuth popup with actionable Vercel error detection
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const errorCode = err?.code || '';
    const currentHost = getCurrentHostname();

    if (errorCode === 'auth/unauthorized-domain') {
      const errorMsg = `Domain "${currentHost}" is not authorized in Firebase Console. Add "${currentHost}" to Authorized Domains in Firebase Console to allow Google Sign-in on Vercel.`;
      console.error('Firebase Auth Unauthorized Domain:', errorMsg);
      const customErr = new Error(errorMsg);
      (customErr as any).code = 'auth/unauthorized-domain';
      (customErr as any).domain = currentHost;
      throw customErr;
    }

    if (errorCode === 'auth/popup-blocked') {
      const errorMsg = 'Google Sign-in popup was blocked by your browser. Please allow popups for this site.';
      console.error(errorMsg);
      const customErr = new Error(errorMsg);
      (customErr as any).code = 'auth/popup-blocked';
      throw customErr;
    }

    if (errorCode === 'auth/network-request-failed') {
      const errorMsg = 'Network connection failed while contacting Firebase Auth. Check your internet connection or ad blocker.';
      console.error(errorMsg);
      const customErr = new Error(errorMsg);
      (customErr as any).code = 'auth/network-request-failed';
      throw customErr;
    }

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
