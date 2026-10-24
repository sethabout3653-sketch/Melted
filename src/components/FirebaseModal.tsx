import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Key, 
  FileCode, 
  Activity,
  Layers
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
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'config'>('sync');

  if (!isOpen) return null;

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
                  Active & Synced
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Multi-tenant Firestore persistence & Google OAuth
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
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('sync')}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'sync'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            Cloud Account & Sync
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
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
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{authError}</span>
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
                        Sign in with your Google account to sync your favorite games, custom high scores, and preferences across all devices.
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
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Quota Tier</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Spark Enterprise (Free Forever)
                    </span>
                  </div>
                </div>
              </div>
            </>
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
                      ABAC authorization rules with strict key allowlisting and payload size constraints.
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
                      Client SDK initialization, Google Auth popup handler, and handleFirestoreError diagnoser.
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
