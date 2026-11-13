import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// The applet-specific settings are not FirebaseOptions. Keep them separate so
// Firebase receives only the fields it understands.
const { firestoreDatabaseId, oAuthClientId: _oAuthClientId, recaptchaSiteKey: _recaptchaSiteKey, ...firebaseConfig } = appletConfig;

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
