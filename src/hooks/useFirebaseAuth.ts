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
  firestoreDatabaseId
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
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
  }, []);

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
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to sign in with Google');
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
    } catch {
      setPingStatus('error');
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
    handleLogin,
    handleLogout,
    runDiagnostics,
    syncToCloud,
    projectId: firebaseConfig.projectId,
    databaseId: firestoreDatabaseId,
  };
}
