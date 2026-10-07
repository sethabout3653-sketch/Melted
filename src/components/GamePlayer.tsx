import React, { useState, useEffect, useRef } from 'react';
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
import { getLuminPlayableUrl } from '../services/luminService';
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

    const directUrl = game.resolvedUrl || (game.url ? resolveGameUrl(game.url) : '');

    if (game.source === 'lumin' && game.luminId) {
      // If we already have a direct unblocked URL ready, activate it immediately and lock it
      if (directUrl && directUrl.startsWith('/api/raw/')) {
        setPlayableUrl((prev) => (prev === directUrl ? prev : directUrl));
        setIsLoading(false);
        return;
      }

      getLuminPlayableUrl(game.luminId, game.name, directUrl).then((url) => {
        if (!active) return;
        const targetUrl = url || directUrl;
        if (targetUrl) {
          setPlayableUrl((prev) => (prev === targetUrl ? prev : targetUrl));
        } else {
          setHasError(true);
        }
        setIsLoading(false);
      }).catch(() => {
        if (active) {
          if (directUrl) setPlayableUrl((prev) => (prev === directUrl ? prev : directUrl));
          else setHasError(true);
          setIsLoading(false);
        }
      });
    } else {
      setPlayableUrl((prev) => (prev === directUrl ? prev : directUrl));
      setIsLoading(false);
    }

    // Safety timeout for school Chromebooks: never show loading screen for more than 2.0s
    const safetyTimer = setTimeout(() => {
      if (active) setIsLoading(false);
    }, 2000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, [game.id, game.luminId, game.resolvedUrl, game.url, game.name, game.source, playableUrl]);

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
    const directUrl = game.resolvedUrl || (game.url ? resolveGameUrl(game.url) : '');
    if (game.source === 'lumin' && game.luminId) {
      getLuminPlayableUrl(game.luminId, game.name, directUrl).then((url) => {
        const finalUrl = url || directUrl;
        if (finalUrl) {
          setPlayableUrl(finalUrl);
          if (iframeRef.current) iframeRef.current.src = finalUrl + (finalUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        } else {
          setHasError(true);
        }
        setIsLoading(false);
      });
    } else if (iframeRef.current && playableUrl) {
      iframeRef.current.src = playableUrl + (playableUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-150 ${
      isFullscreen ? 'p-0' : 'p-2 sm:p-4 lg:p-6'
    }`}>
      
      {/* Outer Game Theater Frame: Pure edge-to-edge in fullscreen */}
      <div 
        ref={containerRef}
        className={`relative flex flex-col w-full bg-black overflow-hidden transition-all ${
          isFullscreen 
            ? 'h-screen w-screen border-none rounded-none' 
            : 'max-w-6xl h-[88vh] max-h-[850px] bg-[#0a0a0a] border border-[#222225] rounded-2xl shadow-2xl'
        }`}
      >
        
        {/* Top Header Bar: ONLY shown when NOT fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-between px-4 py-3 bg-[#111113] border-b border-[#222225] select-none gap-2 shrink-0">
            
            {/* Left info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#1c1c1f] shrink-0 border border-[#2c2c30]">
                <img 
                  src={game.resolvedCover || undefined} 
                  alt="" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-sm sm:text-base truncate font-heading">
                    {game.name}
                  </h3>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[#0066ff]/15 text-[#3b82f6] border border-[#0066ff]/30 text-[10px] font-bold uppercase tracking-wider">
                    {game.category.split(' ')[0]}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {game.author ? `By ${game.author}` : 'Arcade Title'}
                </div>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              
              {/* Favorite Button */}
              <button
                onClick={() => onToggleFavorite(game.id)}
                className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                  isFavorite
                    ? 'bg-[#0066ff]/20 text-[#0066ff] border-[#0066ff]/50'
                    : 'bg-[#18181b] text-zinc-400 hover:text-white border-[#27272a]'
                }`}
                title={isFavorite ? 'Saved to Favorites' : 'Add to Favorites'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#0066ff]' : ''}`} />
              </button>

              {/* Stealth about:blank button */}
              {playableUrl && (
                <button
                  onClick={() => launchAboutBlank(playableUrl, game.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-[#222226] text-zinc-200 hover:text-[#0066ff] text-xs font-semibold rounded-lg border border-[#27272a] hover:border-[#0066ff]/40 transition-colors cursor-pointer"
                  title="Open stealth tab (about:blank cloak)"
                >
                  <EyeOff className="w-3.5 h-3.5 text-[#0066ff]" />
                  <span className="hidden sm:inline">Stealth Window</span>
                </button>
              )}

              {/* Reload button */}
              <button
                onClick={reloadGame}
                className="p-2 bg-[#18181b] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-lg border border-[#27272a] hover:border-[#0066ff]/40 transition-colors cursor-pointer"
                title="Reload game"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Fullscreen button */}
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-[#18181b] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-lg border border-[#27272a] hover:border-[#0066ff]/40 transition-colors cursor-pointer"
                title="Enter Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold rounded-lg transition-colors cursor-pointer ml-1"
                title="Close game (Esc)"
              >
                <X className="w-4 h-4 stroke-[3]" />
              </button>

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
                className="p-2 rounded-full bg-black/75 hover:bg-black text-white hover:text-[#0066ff] backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xl"
                title="Reload Game"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 hover:bg-black text-white hover:text-[#0066ff] backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xl text-xs font-semibold"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize2 className="w-4 h-4 text-[#0066ff]" />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          )}

          {/* Loading Screen Overlay */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 bg-[#0a0a0c]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10 select-none animate-in fade-in duration-200">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-2xl bg-[#0066ff]/20 border border-[#0066ff]/40 flex items-center justify-center text-[#0066ff] shadow-xl shadow-[#0066ff]/20 animate-pulse">
                  <Zap className="w-7 h-7 fill-[#0066ff]" />
                </div>
              </div>
              <h4 className="text-white font-extrabold text-sm sm:text-base font-heading">
                Starting Unblocked Stream...
              </h4>
              <p className="text-zinc-400 text-xs mt-1 max-w-xs font-mono">
                Optimized for school Chromebooks & restrictive Wi-Fi
              </p>
              <button
                onClick={() => setIsLoading(false)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
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
              allow="fullscreen; autoplay; gamepad; focus-without-user-activation; clipboard-read; clipboard-write; microphone; camera; pointer-lock; xr-spatial-tracking; screen-wake-lock"
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
            <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white font-heading">
                  Failed to Load Game Stream
                </h4>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  The upstream game server may be blocking direct embedding. Try opening in a Stealth Window or reload.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={reloadGame}
                  className="px-4 py-2 bg-[#1c1c20] hover:bg-[#25252a] text-white text-xs font-bold rounded-xl border border-[#303036] transition-all cursor-pointer"
                >
                  Try Again
                </button>
                {playableUrl && (
                  <button
                    onClick={() => launchAboutBlank(playableUrl, game.name)}
                    className="px-4 py-2 bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-[#0066ff]/20"
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
