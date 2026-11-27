import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// The applet-specific settings are not FirebaseOptions. Keep them separate so
// Firebase receives only the fields it understands.
const {
  firestoreDatabaseId,
  oAuthClientId: _oAuthClientId,
  recaptchaSiteKey: _recaptchaSiteKey,
  ...firebaseConfig
} = appletConfig;

const requiredConfig: Array<keyof typeof firebaseConfig> = [
  'apiKey',
  'appId',
  'authDomain',
  'projectId',
];
const missingConfig = requiredConfig.filter((key) => !firebaseConfig[key]);

if (missingConfig.length > 0) {
  throw new Error(
    `Firebase applet configuration is missing required values: ${missingConfig.join(', ')}. ` +
      'Check firebase-applet-config.json.'
  );
}

// Reuse the default app during Vite HMR / repeated applet initialization.
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// AI Studio provisions a named Firestore database; fall back to the default
// database for local setups where no database ID is configured.
export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export interface FrostHubGoogleProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export function extractGoogleProfile(user: FirebaseUser | null): FrostHubGoogleProfile | null {
  if (!user || user.isAnonymous) return null;
  const email = user.email || user.providerData?.find((p) => p?.email)?.email || '';
  const displayName =
    user.displayName ||
    user.providerData?.find((p) => p?.displayName)?.displayName ||
    (email ? email.split('@')[0] : 'FrostHub User');
  const photoURL = user.photoURL || user.providerData?.find((p) => p?.photoURL)?.photoURL || '';
  return {
    uid: user.uid,
    email,
    displayName,
    photoURL,
  };
}

/**
 * Configures Google OAuth provider for FrostHub without any hosted-domain (hd) restriction,
 * allowing any Google account (personal @gmail.com, @bcpss.org, or any Google Workspace account).
 */
export function createFrostHubGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

export async function signInToFrostHubWithGoogle(): Promise<FrostHubGoogleProfile> {
  const provider = createFrostHubGoogleProvider();
  try {
    const credential = await signInWithPopup(auth, provider);
    const profile = extractGoogleProfile(credential.user);
    if (!profile) {
      throw new Error('Could not load Google account details.');
    }
    return profile;
  } catch (err: any) {
    const code = String(err?.code || '');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in popup was closed before completing.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Your browser blocked the Google sign-in popup. Allow popups for FrostHub and try again.');
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        `Domain "${typeof window !== 'undefined' ? window.location.hostname : ''}" must be added to Firebase Authorized Domains to use Google Sign-In.`
      );
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error('Google Sign-In is not enabled in the Firebase project yet.');
    }
    throw new Error(err?.message || 'Google Sign-In failed. Please try again.');
  }
}

export async function signOutFromFrostHub(): Promise<void> {
  await signOut(auth);
}
