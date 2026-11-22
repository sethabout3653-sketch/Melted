import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  X, 
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { GameItem, GameRatingInfo } from '../types/game';
import {
  getPlayableGameUrl,
  getScramjetTargetUrl,
  shouldUseScramjetByDefault,
} from '../services/gameService';
import {
  fetchSingleEsrbRating,
  getCachedGameRating,
} from '../services/gameRatingService';
import { EsrbBadge } from './EsrbBadge';
import {
  launchInScramjetFrame,
  flushScramjetCookies,
  cleanupScramjetFrame,
} from '../services/scramjetProxyService';
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
  const initialRating = game.rating || getCachedGameRating(game.name) || null;
  const [ratingInfo, setRatingInfo] = useState<GameRatingInfo | null>(initialRating);
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(() => !initialRating?.requiresGate);
  const [useScramjet, setUseScramjet] = useState<boolean>(() => shouldUseScramjetByDefault(game));
  const [directUrl, setDirectUrl] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [hasError, setHasError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoadingProxy, setIsLoadingProxy] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevGameIdRef = useRef<number | string | null>(null);

  // Sync default Scramjet mode and fetch real ESRB rating whenever switching to a different game
  useEffect(() => {
    let active = true;
    const cached = game.rating || getCachedGameRating(game.name) || null;
    if (prevGameIdRef.current !== game.id) {
      prevGameIdRef.current = game.id;
      setRatingInfo(cached);
      setAgeConfirmed(!cached?.requiresGate);
      setUseScramjet(shouldUseScramjetByDefault(game));
      setReloadNonce(0);
    }

    if (!cached) {
      fetchSingleEsrbRating(game.name).then((realRating) => {
        if (!active || !realRating) return;
        setRatingInfo(realRating);
        if (realRating.requiresGate) {
          setAgeConfirmed(false);
        }
      });
    }

    return () => {
      active = false;
    };
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

  // Screen Wake Lock & Inactivity Resume for Chromebooks (zero per-click IPC overhead)
  useEffect(() => {
    let wakeLockSentinel: any = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      if (cancelled || wakeLockSentinel) return;
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          const sentinel = await (navigator as any).wakeLock.request('screen');
          if (cancelled) {
            sentinel?.release?.().catch(() => {});
            return;
          }
          wakeLockSentinel = sentinel;
          sentinel?.addEventListener?.('release', () => {
            if (wakeLockSentinel === sentinel) {
              wakeLockSentinel = null;
            }
          }, { once: true });
        }
      } catch {
        // Silent fail
      }
    };

    void requestWakeLock();

    const focusGameIfNeeded = () => {
      const el = iframeRef.current;
      if (el && document.activeElement !== el) {
        try {
          el.focus();
          el.contentWindow?.postMessage({ type: 'RESUME_GAME' }, '*');
          el.contentWindow?.postMessage({ type: 'WAKE_GAME' }, '*');
        } catch {}
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
        focusGameIfNeeded();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', focusGameIfNeeded);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', focusGameIfNeeded);
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
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

  // Keyboard shortcut: Escape to close player, and refocus game only when focus drifted
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
        } catch {}
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Launch via Scramjet v2 or Direct URL (strictly blocked until ageConfirmed is true)
  useEffect(() => {
    let active = true;
    setHasError(false);
    setErrorDetail('');

    if (!ageConfirmed) {
      setIsLoadingProxy(false);
      setDirectUrl('');
      return () => {
        active = false;
      };
    }

    const fallbackUrl = getPlayableGameUrl(game);
    const scramjetTarget = getScramjetTargetUrl(game);

    if (useScramjet && scramjetTarget) {
      setDirectUrl('');
      setIsLoadingProxy(true);

      const targetIframe = iframeRef.current;
      // Wait a microtask to ensure the keyed iframe ref is mounted cleanly
      const launchTimer = setTimeout(async () => {
        if (!active || !targetIframe) return;
        try {
          await launchInScramjetFrame(targetIframe, scramjetTarget);
          if (!active) return;
          // Note: Keep isLoadingProxy=true until iframe onLoad fires so user never sees a bare black screen
        } catch (err: any) {
          console.warn('[GamePlayer] Scramjet v2 unavailable:', err);
          if (!active) return;
          setIsLoadingProxy(false);
          if (game.source === 'scramjet') {
            setErrorDetail(String(err?.message || '').trim());
            setHasError(true);
            return;
          }
          setUseScramjet(false);
          if (fallbackUrl) {
            setDirectUrl(fallbackUrl);
          } else {
            setErrorDetail(String(err?.message || '').trim());
            setHasError(true);
          }
        }
      }, 0);

      // Ensure loading overlay never gets stuck indefinitely
      const safetyTimer = window.setTimeout(() => {
        if (active) {
          setIsLoadingProxy(false);
        }
      }, 16000);

      return () => {
        active = false;
        clearTimeout(launchTimer);
        window.clearTimeout(safetyTimer);
        cleanupScramjetFrame(targetIframe);
      };
    }

    setIsLoadingProxy(false);
    if (fallbackUrl) {
      setDirectUrl(fallbackUrl);
    } else {
      setDirectUrl('');
      setHasError(true);
    }
    return () => {
      active = false;
    };
  }, [game.id, game.resolvedUrl, game.url, game.name, useScramjet, reloadNonce, ageConfirmed]);

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
    setHasError(false);
    setErrorDetail('');
    setReloadNonce((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05070c] p-0 sm:p-4">
      
      {/* Outer Game Theater Frame: Edge-to-edge on mobile, theater framed on desktop */}
      <div 
        ref={containerRef}
        className={`relative flex flex-col bg-black overflow-hidden ${
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
              <div className="min-w-0 flex items-center gap-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate font-heading">
                      {game.name}
                    </h3>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-bold flex items-center gap-2">
                    <span>{game.author ? `By ${game.author}` : game.category}</span>
                    {ratingInfo?.descriptors && (
                      <span className="hidden sm:inline text-slate-400 dark:text-slate-500 font-medium truncate">
                        · {ratingInfo.descriptors}
                      </span>
                    )}
                  </div>
                </div>
                {ratingInfo && (
                  <EsrbBadge rating={ratingInfo} className="w-[24px] sm:w-[26px] shrink-0" />
                )}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              
              {/* Favorite Button */}
              <button
                type="button"
                onClick={() => onToggleFavorite(game.id)}
                className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border transition-[transform,colors] duration-100 hover:scale-105 active:scale-95 cursor-pointer ${
                  isFavorite
                    ? 'bg-[var(--brand-blue)] text-white border-[var(--brand-blue)] shadow-md shadow-[var(--brand-blue-glow)]'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-[var(--brand-blue)] dark:hover:text-[var(--brand-blue)] border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700'
                }`}
                title={isFavorite ? 'Saved to Favorites' : 'Add to Favorites'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>

              {/* Reload button */}
              <button
                type="button"
                onClick={reloadGame}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-[var(--brand-blue)] dark:hover:text-[var(--brand-blue)] rounded-xl border border-slate-200 dark:border-slate-700 transition-[transform,colors] duration-100 hover:scale-105 active:scale-95 cursor-pointer"
                title="Reload game"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Fullscreen button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-[var(--brand-blue)] dark:hover:text-[var(--brand-blue)] rounded-xl border border-slate-200 dark:border-slate-700 transition-[transform,colors] duration-100 hover:scale-105 active:scale-95 cursor-pointer"
                title="Enter Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center bg-[var(--brand-blue)] hover:bg-red-500 text-white font-bold rounded-xl transition-[transform,colors] duration-100 hover:scale-105 active:scale-95 cursor-pointer ml-0.5 border border-[var(--brand-blue)] hover:border-red-500 shadow-lg shadow-[var(--brand-blue-glow)]"
                title="Close game (Esc)"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>

            </div>

          </div>
        )}


        {/* Game Canvas Container: Isolated hardware layer for steady 60+ fps gameplay */}
        <div 
          className="relative flex-1 w-full h-full bg-black overflow-hidden"
          style={{ contain: 'strict', isolation: 'isolate' }}
          onClick={() => {
            if (iframeRef.current && document.activeElement !== iframeRef.current) {
              try {
                iframeRef.current.focus();
                iframeRef.current.contentWindow?.postMessage({ type: 'RESUME_GAME' }, '*');
              } catch {}
            }
          }}
        >
          
          {/* Floating exit fullscreen button (no backdrop-blur over gameplay surface) */}
          {isFullscreen && (
            <div className="absolute top-3 right-3 z-30 opacity-90 sm:opacity-0 sm:hover:opacity-100 transition-opacity duration-150 flex items-center gap-2">
              <button
                type="button"
                onClick={reloadGame}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-black/90 hover:bg-black text-white hover:text-[var(--brand-blue)] border border-white/20 transition-colors cursor-pointer shadow-xl"
                title="Reload Game"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl bg-black/90 hover:bg-black text-white hover:text-[var(--brand-blue)] border border-white/20 transition-colors cursor-pointer shadow-xl text-xs font-semibold"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-4 h-4 text-[var(--brand-blue)]" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          )}

          {/* Interactive Age / Content Warning Gate (blocks iframe/port load until confirmed) */}
          {!ageConfirmed && ratingInfo && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-8 bg-black/95 overflow-y-auto">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-center space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <EsrbBadge rating={ratingInfo} className="w-[46px] shrink-0" />
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-500 flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {ratingInfo.gateMinAge === '18+'
                      ? 'ESRB 18+ Adults Only Rating'
                      : 'ESRB 17+ Mature Content Rating'}
                  </div>
                  <h4 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">
                    {game.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4">
                    {ratingInfo.warningMessage ||
                      `Rated ${ratingInfo.code} (${ratingInfo.label}) by the ESRB${ratingInfo.descriptors ? `: ${ratingInfo.descriptors}` : ''}.`}
                  </p>
                </div>

                {/* Real ESRB Content Descriptors */}
                {ratingInfo.specialTags && ratingInfo.specialTags.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    {ratingInfo.specialTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="sm:flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgeConfirmed(true)}
                    className="sm:flex-[2] px-4 py-2.5 rounded-xl bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-[var(--brand-blue-glow)] transition-all cursor-pointer"
                  >
                    {ratingInfo.gateMinAge === '18+'
                      ? 'I understand and am 18+'
                      : 'I understand and am 17+'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Iframe (strictly rendered only after ageConfirmed) */}
          {ageConfirmed && (useScramjet || directUrl) && (
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
                  setIsLoadingProxy(false);
                  // Silently restore saved game data into iframe scope on load
                  if (iframeRef.current?.contentWindow) {
                    const win = iframeRef.current.contentWindow;
                    restoreAutoSaveToIframe(game.id, win);

                    if (useScramjet) {
                      try {
                        const doc = iframeRef.current.contentDocument || win.document;
                        if (doc) {
                          const bodyText = (doc.body?.textContent || '').trim();
                          if (bodyText.includes("Page couldn't load") || bodyText.includes('Reconnecting Scramjet Proxy')) {
                            setHasError(true);
                            setErrorDetail(bodyText.slice(0, 200));
                          }
                        }
                      } catch {}
                    }

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
                  setIsLoadingProxy(false);
                  setHasError(true);
                }}
              />
            )}

          {/* Loading overlay while Scramjet initializes & connects */}
          {ageConfirmed && isLoadingProxy && !hasError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
              <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-[var(--brand-blue)] animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-300 tracking-wide">
                Loading {game.name}...
              </p>
            </div>
          )}

          {/* Fallback */}
          {hasError && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  This game didn&rsquo;t load
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                  {errorDetail || 'The game’s server may be blocking embeds. Please try again.'}
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={reloadGame}
                  className="press px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-[var(--brand-blue-glow)]"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
