import { useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  auth, 
  signInWithGoogle, 
  signOutUser, 
  syncFavoritesToFirestore, 
  loadFavoritesFromFirestore,
  testConnection,
  firebaseConfig,
  firestoreDatabaseId,
  getCurrentHostname,
  isVercelDomain
} from '../services/firebase';

export function useFirebaseAuth(
  localFavorites: number[], 
  onMergeFavorites: (favorites: number[]) => void
) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);

  const currentHostname = getCurrentHostname();
  const isVercel = isVercelDomain(currentHostname);
  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        setIsUnauthorizedDomain(false);
        setAuthError(null);
        // Load cloud favorites upon login
        try {
          setIsSyncing(true);
          const cloudFavs = await loadFavoritesFromFirestore(currentUser.uid);
          if (cloudFavs && cloudFavs.length > 0) {
            // Merge cloud and local
            const merged = Array.from(new Set([...cloudFavs, ...localFavorites]));
            onMergeFavorites(merged);
            await syncFavoritesToFirestore(currentUser.uid, merged);
          } else if (localFavorites.length > 0) {
            await syncFavoritesToFirestore(currentUser.uid, localFavorites);
          }
          setLastSyncedTime(new Date().toLocaleTimeString());
        } catch (err: any) {
          console.error('Initial cloud sync error:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    });

    return () => unsubscribe();
  }, [localFavorites, onMergeFavorites]);

  // When local favorites change, push to cloud if logged in
  const syncToCloud = useCallback(async (favs: number[]) => {
    if (!user) return;
    try {
      setIsSyncing(true);
      await syncFavoritesToFirestore(user.uid, favs);
      setLastSyncedTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Failed to sync to cloud:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  const handleLogin = async () => {
    setAuthError(null);
    setAuthErrorCode(null);
    setIsUnauthorizedDomain(false);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      setAuthErrorCode(code);
      if (code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
        setAuthError(
          `Domain "${currentHostname}" is not authorized for Google Sign-In in Firebase. Add it under Firebase Console > Authentication > Settings > Authorized domains.`
        );
      } else {
        setAuthError(err?.message || 'Failed to sign in with Google');
      }
    }
  };

  const handleLogout = async () => {
    setAuthError(null);
    try {
      await signOutUser();
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to sign out');
    }
  };

  const runDiagnostics = async () => {
    setPingStatus('testing');
    try {
      const res = await testConnection();
      setPingLatency(res.latencyMs);
      setPingStatus(res.success ? 'success' : 'error');
      if (!res.success && res.error) {
        setAuthError(`Connection test: ${res.error}`);
      }
    } catch (err: any) {
      setPingStatus('error');
      setAuthError(err?.message || 'Connection test failed');
    }
  };

  return {
    user,
    authLoading,
    isSyncing,
    lastSyncedTime,
    pingLatency,
    pingStatus,
    authError,
    authErrorCode,
    isUnauthorizedDomain,
    currentHostname,
    isVercel,
    firebaseConsoleUrl,
    firebaseConfig,
    handleLogin,
    handleLogout,
    runDiagnostics,
    syncToCloud,
    projectId: firebaseConfig.projectId,
    databaseId: firestoreDatabaseId,
  };
}
