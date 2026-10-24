import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Heart, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  X, 
  EyeOff, 
  Zap, 
  AlertCircle
} from 'lucide-react';
import { GameItem } from '../types/game';
import { resolveGameUrl } from '../services/gameService';
import { launchAboutBlank } from '../hooks/useCloak';
import { storeGameSave, restoreAutoSaveToIframe, flushPendingSaves } from '../services/saveService';

interface GamePlayerProps {
  game: GameItem;
  onClose: () => void;
  onToggleFavorite: (id: number) => void;
  isFavorite: boolean;
}

export const GamePlayer: React.FC<GamePlayerProps> = ({
  game,
  onClose,
  onToggleFavorite,
  isFavorite,
}) => {
  const [playableUrl, setPlayableUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Background Auto-Save Sync Listener from Iframe Game Stream
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.type === 'FROSTED_SAVE_BATCH' && event.data.data) {
        storeGameSave(game.id, game.name, event.data.data);
      } else if (event.data.type === 'FROSTED_SAVE_UPDATE' && event.data.key) {
        storeGameSave(game.id, game.name, { [event.data.key]: event.data.value });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      flushPendingSaves(game.id, game.name);
    };
  }, [game.id, game.name]);

  // Screen Wake Lock & Inactivity Resume for Chromebooks
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Silent fail
      }
    };

    requestWakeLock();

    const handleWakeAndFocus = () => {
      requestWakeLock();
      if (iframeRef.current) {
        try {
          iframeRef.current.focus();
          iframeRef.current.contentWindow?.postMessage({ type: 'RESUME_GAME' }, '*');
          iframeRef.current.contentWindow?.postMessage({ type: 'WAKE_GAME' }, '*');
        } catch {
          // Silent
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWakeAndFocus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWakeAndFocus);
    window.addEventListener('pointerdown', handleWakeAndFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWakeAndFocus);
      window.removeEventListener('pointerdown', handleWakeAndFocus);
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // Handle Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcut: Escape to close player, and wake game on any game keypress
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
        return;
      }
      if (iframeRef.current && document.activeElement !== iframeRef.current) {
        try {
          iframeRef.current.focus();
          iframeRef.current.contentWindow?.postMessage({ type: 'RESUME_GAME' }, '*');
          iframeRef.current.contentWindow?.postMessage({ type: 'WAKE_GAME' }, '*');
        } catch {}
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const resolvedGameIdRef = useRef<number | string | null>(null);

  // Resolve Playable URL on mount or when game changes
  useEffect(() => {
    let active = true;
    
    // Avoid re-running if we're already playing this exact game id and playableUrl is set
    if (resolvedGameIdRef.current === game.id && playableUrl) {
      return;
    }

    resolvedGameIdRef.current = game.id;
    setIsLoading(true);
    setHasError(false);

    const directUrl = game.resolvedUrl || (game.url ? resolveGameUrl(game.url, game.id) : '');
    if (directUrl) {
      setPlayableUrl(directUrl);
    } else {
      setHasError(true);
    }
    setIsLoading(false);

    // Safety timeout for school Chromebooks: never show loading screen for more than 2.0s
    const safetyTimer = setTimeout(() => {
      if (active) setIsLoading(false);
    }, 2000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, [game.id, game.resolvedUrl, game.url, game.name, playableUrl]);

  if (!game) return null;

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen failed:', err);
    }
  };

  const reloadGame = () => {
    setIsLoading(true);
    setHasError(false);
    const directUrl = game.resolvedUrl || (game.url ? resolveGameUrl(game.url, game.id) : '');
    if (directUrl) {
      setPlayableUrl(directUrl);
      if (iframeRef.current) {
        iframeRef.current.src = directUrl + (directUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      }
      setIsLoading(false);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-150 ${
      isFullscreen ? 'p-0' : 'p-0 sm:p-4 lg:p-6'
    }`}>
      
      {/* Outer Game Theater Frame: Edge-to-edge on mobile, theater framed on desktop */}
      <div 
        ref={containerRef}
        className={`relative flex flex-col w-full bg-black overflow-hidden transition-all ${
          isFullscreen 
            ? 'h-screen w-screen border-none rounded-none' 
            : 'max-w-6xl h-full sm:h-[88vh] max-h-[100dvh] sm:max-h-[850px] bg-slate-900 border-0 sm:border border-slate-800 rounded-none sm:rounded-2xl shadow-2xl'
        }`}
      >
        
        {/* Top Header Bar: ONLY shown when NOT fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 select-none gap-2 shrink-0 transition-colors">
            
            {/* Left info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
                <img 
                  src={game.localCover || game.resolvedCover || game.cover || game.fallbackCover || ''} 
                  alt={game.name} 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (game.fallbackCover && e.currentTarget.src !== game.fallbackCover) {
                      e.currentTarget.src = game.fallbackCover;
                    }
                  }}
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate font-heading">
                    {game.name}
                  </h3>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-bold">
                  {game.author ? `By ${game.author}` : game.category}
                </div>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              
              {/* Favorite Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onToggleFavorite(game.id)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isFavorite
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700'
                }`}
                title={isFavorite ? 'Saved to Favorites' : 'Add to Favorites'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </motion.button>

              {/* Stealth about:blank button */}
              {playableUrl && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => launchAboutBlank(playableUrl, game.name)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-700 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  title="Open stealth tab (about:blank cloak)"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stealth Window</span>
                </motion.button>
              )}

              {/* Reload button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08, rotate: 180 }}
                whileTap={{ scale: 0.92 }}
                onClick={reloadGame}
                className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                title="Reload game"
              >
                <RotateCw className="w-4 h-4" />
              </motion.button>

              {/* Fullscreen button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={toggleFullscreen}
                className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                title="Enter Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </motion.button>

              {/* Close button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={onClose}
                className="p-2 bg-blue-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all cursor-pointer ml-1 border border-blue-500 hover:border-red-500 shadow-lg shadow-blue-600/20"
                title="Close game (Esc)"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </motion.button>

            </div>

          </div>
        )}


        {/* Game Canvas Container: Occupies full screen in fullscreen */}
        <div 
          className="relative flex-1 w-full h-full bg-black overflow-hidden"
          onClick={() => {
            if (iframeRef.current) {
              try {
                iframeRef.current.focus();
                iframeRef.current.contentWindow?.postMessage({ type: 'RESUME_GAME' }, '*');
              } catch {}
            }
          }}
        >
          
          {/* Floating exit fullscreen button */}
          {isFullscreen && (
            <div className="absolute top-3 right-3 z-30 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
              <button
                onClick={reloadGame}
                className="p-2 rounded-full bg-black/75 hover:bg-black text-white hover:text-[var(--vibrant-cyan)] backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xl"
                title="Reload Game"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 hover:bg-black text-white hover:text-[var(--vibrant-cyan)] backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xl text-xs font-semibold"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-4 h-4 text-[var(--vibrant-cyan)]" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          )}

          {/* Loading Screen Overlay */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 select-none animate-in fade-in duration-200">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xl shadow-blue-600/10 animate-pulse">
                  <Zap className="w-7 h-7 fill-current" />
                </div>
              </div>
              <h4 className="text-slate-900 dark:text-white font-extrabold text-sm sm:text-base font-heading">
                Starting Unblocked Stream...
              </h4>
              <p className="text-slate-400 dark:text-slate-400 text-xs mt-1 max-w-xs font-bold uppercase tracking-widest">
                Optimized for school networks
              </p>
              <button
                onClick={() => setIsLoading(false)}
                className="mt-6 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-[11px] font-black uppercase tracking-widest transition-all cursor-pointer border border-slate-100 dark:border-slate-700"
              >
                Skip / Play Now
              </button>
            </div>
          )}

          {/* Iframe */}
          {playableUrl && (
            <iframe
              ref={iframeRef}
              src={playableUrl || undefined}
              title={game.name}
              tabIndex={0}
              loading="eager"
              className="w-full h-full border-none outline-none"
              allow="fullscreen; autoplay; gamepad; focus-without-user-activation; clipboard-read; clipboard-write; microphone; camera; pointer-lock; xr-spatial-tracking; screen-wake-lock; display-capture; encrypted-media; picture-in-picture; midi; accelerometer; gyroscope; speaker-selection"
              allowFullScreen
              onLoad={() => {
                setIsLoading(false);
                // Silently restore saved game data into iframe scope on load
                if (iframeRef.current?.contentWindow) {
                  restoreAutoSaveToIframe(game.id, iframeRef.current.contentWindow);
                  try {
                    iframeRef.current.focus();
                  } catch {}
                }
              }}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}

          {/* Fallback */}
          {hasError && (
            <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white font-heading">
                  Failed to Load Game Stream
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  The upstream game server may be blocking direct embedding. Try opening in a Stealth Window or reload.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={reloadGame}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer"
                >
                  Try Again
                </button>
                {playableUrl && (
                  <button
                    onClick={() => launchAboutBlank(playableUrl, game.name)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-600/20"
                  >
                    Open Stealth Window
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
