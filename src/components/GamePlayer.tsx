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
import {
  getPlayableGameUrl,
  getScramjetTargetUrl,
  shouldUseScramjetByDefault,
} from '../services/gameService';
import { launchInScramjetFrame, flushScramjetCookies } from '../services/scramjetProxyService';
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
  const [useScramjet, setUseScramjet] = useState<boolean>(() => shouldUseScramjetByDefault(game));
  const [directUrl, setDirectUrl] = useState<string>('');
  const [stealthUrl, setStealthUrl] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevGameIdRef = useRef<number | string | null>(null);

  // Sync default Scramjet mode whenever switching to a different game
  useEffect(() => {
    if (prevGameIdRef.current !== game.id) {
      prevGameIdRef.current = game.id;
      setUseScramjet(shouldUseScramjetByDefault(game));
      setReloadNonce(0);
    }
  }, [game]);

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
      flushScramjetCookies(true);
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

  // Launch via Scramjet v2 or Direct URL
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setHasError(false);

    const fallbackUrl = getPlayableGameUrl(game);
    const scramjetTarget = getScramjetTargetUrl(game);

    const safetyTimer = setTimeout(() => {
      if (active) setIsLoading(false);
    }, 3500);

    if (useScramjet && scramjetTarget) {
      setDirectUrl('');
      setStealthUrl(scramjetTarget);

      // Wait a microtask to ensure the keyed iframe ref is mounted cleanly
      const launchTimer = setTimeout(async () => {
        if (!active || !iframeRef.current) return;
        try {
          const { proxiedSrc } = await launchInScramjetFrame(iframeRef.current, scramjetTarget);
          if (!active) return;
          if (proxiedSrc) {
            setStealthUrl(proxiedSrc);
          }
        } catch (err) {
          console.warn('[GamePlayer] Scramjet v2 unavailable, falling back to direct stream:', err);
          if (!active) return;
          setUseScramjet(false);
          if (fallbackUrl) {
            setDirectUrl(fallbackUrl);
            setStealthUrl(fallbackUrl);
          } else {
            setHasError(true);
          }
          setIsLoading(false);
        }
      }, 0);

      return () => {
        active = false;
        clearTimeout(launchTimer);
        clearTimeout(safetyTimer);
      };
    }

    if (fallbackUrl) {
      setDirectUrl(fallbackUrl);
      setStealthUrl(fallbackUrl);
    } else {
      setDirectUrl('');
      setStealthUrl('');
      setHasError(true);
    }
    setIsLoading(false);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, [game.id, game.resolvedUrl, game.url, game.name, useScramjet, reloadNonce]);

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
    setReloadNonce((n) => n + 1);
  };

  const activeLaunchUrl = stealthUrl || directUrl || getPlayableGameUrl(game);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 animate-in fade-in duration-150 p-0 sm:p-4">
      
      {/* Outer Game Theater Frame: Edge-to-edge on mobile, theater framed on desktop */}
      <div 
        ref={containerRef}
        className={`relative flex flex-col bg-black overflow-hidden transition-all ${
          isFullscreen 
            ? 'h-[100dvh] w-screen border-none rounded-none' 
            : 'w-full h-[100dvh] sm:h-auto sm:max-w-5xl sm:aspect-video sm:max-h-[85vh] bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl'
        }`}
      >
        
        {/* Top Header Bar: ONLY shown when NOT fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:pt-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 select-none gap-2 shrink-0 transition-colors">
            
            {/* Left info */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
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
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              
              {/* Favorite Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => onToggleFavorite(game.id)}
                className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  isFavorite
                    ? 'bg-[var(--brand-blue)] text-white border-[var(--brand-blue)] shadow-md shadow-[var(--brand-blue-glow)]'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-[var(--brand-blue)] dark:hover:text-[var(--brand-blue)] border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700'
                }`}
                title={isFavorite ? 'Saved to Favorites' : 'Add to Favorites'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </motion.button>

              {/* Stealth about:blank button */}
              {activeLaunchUrl && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => launchAboutBlank(activeLaunchUrl, game.name)}
                  className="hidden sm:flex items-center gap-1.5 px-3 min-h-[40px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-[var(--brand-blue)] dark:hover:text-[var(--brand-blue)] hover:border-blue-200 dark:hover:border-blue-700 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  title="Open stealth tab (about:blank cloak)"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Stealth Window</span>
                </motion.button>
              )}

              {/* Reload button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08, rotate: 180 }}
                whileTap={{ scale: 0.92 }}
                onClick={reloadGame}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-[var(--brand-blue)] dark:hover:text-[var(--brand-blue)] rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
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
                className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-[var(--brand-blue)] dark:hover:text-[var(--brand-blue)] rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
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
                className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-[var(--brand-blue)] hover:bg-red-500 text-white font-bold rounded-xl transition-all cursor-pointer ml-0.5 border border-[var(--brand-blue)] hover:border-red-500 shadow-lg shadow-[var(--brand-blue-glow)]"
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
          
          {/* Floating exit fullscreen button (visible on touchscreens, hover-revealed on desktop) */}
          {isFullscreen && (
            <div className="absolute top-3 right-3 z-30 opacity-90 sm:opacity-0 sm:hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
              <button
                type="button"
                onClick={reloadGame}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-black/75 hover:bg-black text-white hover:text-[var(--brand-blue)] backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xl"
                title="Reload Game"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl bg-black/75 hover:bg-black text-white hover:text-[var(--brand-blue)] backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xl text-xs font-semibold"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-4 h-4 text-[var(--brand-blue)]" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          )}

          {/* Loading Screen Overlay */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 select-none animate-in fade-in duration-200">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 flex items-center justify-center text-[var(--brand-blue)] dark:text-[var(--brand-blue)] shadow-xl shadow-[var(--brand-blue-glow)]">
                  <Zap className="w-7 h-7 fill-current" />
                </div>
              </div>
              <h4 className="text-slate-900 dark:text-white font-extrabold text-sm sm:text-base font-heading">
                {useScramjet ? 'Connecting via Scramjet v2 Proxy...' : 'Starting Unblocked Stream...'}
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 max-w-xs font-bold uppercase tracking-widest">
                {useScramjet ? 'Wisp + Epoxy encrypted tunnel' : 'Optimized for school networks'}
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
          {(useScramjet || directUrl) && (
            <iframe
              key={`${game.id}-${useScramjet ? 'sj' : 'direct'}-${reloadNonce}`}
              ref={iframeRef}
              src={useScramjet ? undefined : (reloadNonce > 0 && directUrl ? `${directUrl}${directUrl.includes('?') ? '&' : '?'}reload=${reloadNonce}` : directUrl)}
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
                  const win = iframeRef.current.contentWindow;
                  restoreAutoSaveToIframe(game.id, win);

                  // Inject Scaffolding compatibility layer for direct non-Scramjet frames when same-origin
                  if (!useScramjet) {
                    try {
                      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
                      if (doc) {
                        import('../utils/scaffolding-loader').then(({ injectScaffolding }) => {
                          injectScaffolding(doc);
                        });
                      }
                    } catch {
                      // Cross-origin frames restrict document access by browser security design; ignore silently.
                    }
                  }

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
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  Failed to Load Game Stream
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  The upstream game server may be blocking direct embedding. Try reloading or opening in a Stealth Window.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={reloadGame}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                >
                  Try Again
                </button>
                {activeLaunchUrl && (
                  <button
                    onClick={() => launchAboutBlank(activeLaunchUrl, game.name)}
                    className="px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-[var(--brand-blue-glow)]"
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
