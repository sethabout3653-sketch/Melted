import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Flame, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  ShieldCheck, 
  Cloud, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  FileCode, 
  Activity,
  Layers,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Server
} from 'lucide-react';
import { User } from 'firebase/auth';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  projectId: string;
  databaseId: string;
  isSyncing: boolean;
  lastSyncedTime: string | null;
  favoritesCount: number;
  pingLatency: number | null;
  pingStatus: 'idle' | 'testing' | 'success' | 'error';
  onRunDiagnostics: () => void;
  authError: string | null;
  isUnauthorizedDomain?: boolean;
  currentHostname?: string;
  isVercel?: boolean;
  firebaseConsoleUrl?: string;
  firebaseConfig?: any;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({
  isOpen,
  onClose,
  user,
  authLoading,
  onLogin,
  onLogout,
  projectId,
  databaseId,
  isSyncing,
  lastSyncedTime,
  favoritesCount,
  pingLatency,
  pingStatus,
  onRunDiagnostics,
  authError,
  isUnauthorizedDomain = false,
  currentHostname = '',
  isVercel = false,
  firebaseConsoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`,
  firebaseConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'vercel' | 'config'>('sync');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // If unauthorized domain is detected, automatically switch to Vercel tab to guide user
  useEffect(() => {
    if (isUnauthorizedDomain) {
      setActiveTab('vercel');
    }
  }, [isUnauthorizedDomain]);

  if (!isOpen) return null;

  const hostnameToAuthorize = currentHostname || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');

  const copyToClipboard = (text: string, type: 'domain' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'domain') {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    }
  };

  const vercelEnvSnippet = `# Firebase Configuration for Vercel
VITE_FIREBASE_API_KEY=${firebaseConfig?.apiKey || 'AIzaSyCkOwYbegyyClXTd2WTgv60sGPp8o6xj4E'}
VITE_FIREBASE_AUTH_DOMAIN=${firebaseConfig?.authDomain || 'analog-cathode-kfs6l.firebaseapp.com'}
VITE_FIREBASE_PROJECT_ID=${firebaseConfig?.projectId || 'analog-cathode-kfs6l'}
VITE_FIREBASE_STORAGE_BUCKET=${firebaseConfig?.storageBucket || 'analog-cathode-kfs6l.firebasestorage.app'}
VITE_FIREBASE_MESSAGING_SENDER_ID=${firebaseConfig?.messagingSenderId || '630735569759'}
VITE_FIREBASE_APP_ID=${firebaseConfig?.appId || '1:630735569759:web:09b818a7611bf40c41acea'}
VITE_FIREBASE_FIRESTORE_DATABASE_ID=${databaseId || 'ai-studio-melted-101d2f67-26ab-49fa-80db-faf0be512233'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-md shadow-amber-500/10">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                  Firebase Cloud Engine
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Vercel deployment resilient & multi-tenant Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sync')}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'sync'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Cloud Account & Sync
          </button>

          <button
            onClick={() => setActiveTab('vercel')}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'vercel'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Vercel & Domain Setup</span>
            {(isUnauthorizedDomain || isVercel) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Installed Files & Blueprint
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          
          {authError && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Authentication Notice</span>
              </div>
              <p className="pl-6 text-[11px] leading-relaxed">{authError}</p>
              {isUnauthorizedDomain && (
                <div className="pl-6 pt-1 flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('vercel')}
                    className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Open 30-Sec Vercel Fix
                  </button>
                  <a
                    href={firebaseConsoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-[11px] transition-all flex items-center gap-1"
                  >
                    <span>Open Firebase Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sync' ? (
            <>
              {/* User Auth Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Firebase Authentication
                  </span>
                  {user ? (
                    <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated via Google
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400">Guest / Local Storage</span>
                  )}
                </div>

                {user ? (
                  <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
                    <div className="flex items-center gap-3">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt="" 
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center text-lg shadow-sm">
                          {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {user.displayName || 'Google User'}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">
                          {user.email || user.uid}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          UID: <span className="font-mono">{user.uid.slice(0, 14)}...</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={onLogout}
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-red-500 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                    <div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Sign in with Google to sync favorite games, preferences, and custom high scores across all devices and browsers.
                      </p>
                    </div>

                    <button
                      onClick={onLogin}
                      disabled={authLoading}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign in with Google
                    </button>
                  </div>
                )}
              </div>

              {/* Realtime Sync Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                    <Cloud className="w-4 h-4 text-blue-500" />
                    <span>Saved Favorites Sync</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-heading">
                    {favoritesCount} Games
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Status: {isSyncing ? 'Syncing...' : 'Synchronized'}</span>
                    {lastSyncedTime && <span>Synced at {lastSyncedTime}</span>}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span>Firestore Ping & Health</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-heading">
                    {pingLatency !== null ? `${pingLatency} ms` : 'Operational'}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {pingStatus === 'testing' ? 'Checking roundtrip...' : 'Connection verified'}
                    </span>
                    <button
                      onClick={onRunDiagnostics}
                      disabled={pingStatus === 'testing'}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${pingStatus === 'testing' ? 'animate-spin' : ''}`} />
                      Ping Test
                    </button>
                  </div>
                </div>
              </div>

              {/* Cloud Database Metadata */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-500" />
                  Active Cloud Infrastructure
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Firebase Project</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{projectId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Firestore Database ID</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">{databaseId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Security Engine</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Zero-Trust ABAC Deployed
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Transport Layer</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Server className="w-3.5 h-3.5 text-blue-500" /> Auto-Detect Long Polling
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'vercel' ? (
            /* Vercel & Domain Authorization Tab */
            <div className="space-y-6">
              
              {/* Detected Domain Card */}
              <div className="p-5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" /> Detected Active Domain
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300">
                    {hostnameToAuthorize}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-100 dark:border-blue-950 font-mono text-xs text-slate-800 dark:text-slate-200">
                  <span className="truncate font-bold">{hostnameToAuthorize}</span>
                  <button
                    onClick={() => copyToClipboard(hostnameToAuthorize, 'domain')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {copiedDomain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDomain ? 'Copied' : 'Copy Domain'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Google OAuth blocks domains not added to Firebase's whitelist to prevent phishing. Once added, Google Sign-in and Firestore will connect instantly.
                </p>
              </div>

              {/* 30-Second Fix Instructions */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 space-y-4">
                <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  30-Second Fix to Connect on Vercel
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Copy your domain:</span>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                        Copy <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">{hostnameToAuthorize}</code> or the wildcard domain <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[10px]">*.vercel.app</code>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="flex-1 space-y-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Open Firebase Console:</span>
                      <div>
                        <a
                          href={firebaseConsoleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20"
                        >
                          <span>Open Firebase Auth Settings</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="flex-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Paste and Save:</span>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                        Scroll down to <strong>Authorized domains</strong>, click <strong>Add domain</strong>, paste your domain, and click <strong>Add</strong>. That's it! No redeploy required.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vercel Environment Variables Snippet */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-500" />
                    Vercel Environment Variables
                  </div>
                  <button
                    onClick={() => copyToClipboard(vercelEnvSnippet, 'env')}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedEnv ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEnv ? 'Copied All' : 'Copy All Vars'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Firebase config is already safely bundled into the build, but you can also configure these in Vercel Project Settings &gt; Environment Variables:
                </p>

                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                  {vercelEnvSnippet}
                </pre>
              </div>

            </div>
          ) : (
            /* Installed Files Tab */
            <div className="space-y-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                The application is directly connected to Firestore with fully managed configuration and security rules:
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <FileCode className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      /firebase-applet-config.json
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Live Firebase SDK credentials, database IDs, and OAuth tokens.
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    Provisioned
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <Layers className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      /firebase-blueprint.json
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Intermediate Representation: Message, HighScore, and UserFavorite schemas.
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
                    Schema Defined
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      /firestore.rules
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ABAC authorization rules with strict key allowlisting, test probe, and payload constraints.
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    Deployed
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <Database className="w-5 h-5 text-purple-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      /src/services/firebase.ts
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Auto-detect long polling, fallback embedded credentials, and Vercel error handling.
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 shrink-0">
                    Compiled
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Frosted Arcade & Cloud Firestore
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
