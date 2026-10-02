import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  ExternalLink, 
  Heart, 
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { GameItem } from '../types/game';
import { resolveGameUrl } from '../services/gameService';
import { launchAboutBlank } from '../hooks/useCloak';

interface GamePlayerProps {
  game: GameItem | null;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
}

export const GamePlayer: React.FC<GamePlayerProps> = ({
  game,
  onClose,
  isFavorite,
  onToggleFavorite,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!game) return null;

  const currentUrl = resolveGameUrl(game.url);

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
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl + (currentUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 lg:p-6 animate-in fade-in duration-150">
      
      {/* Outer Game Theater Frame */}
      <div 
        ref={containerRef}
        className={`relative flex flex-col w-full bg-[#0a0a0a] border border-[#222225] rounded-2xl shadow-2xl overflow-hidden transition-all ${
          isFullscreen 
            ? 'h-full w-full rounded-none border-none' 
            : 'max-w-6xl h-[88vh] max-h-[850px]'
        }`}
      >
        
        {/* Top Header Bar: Sleek Black & Orange, only purposeful controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111113] border-b border-[#222225] select-none gap-2 shrink-0">
          
          {/* Left info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#1c1c1f] shrink-0 border border-[#2c2c30]">
              <img 
                src={game.resolvedCover} 
                alt="" 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-sm sm:text-base truncate font-heading">
                  {game.name}
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[#ff5500]/15 text-[#ff6611] border border-[#ff5500]/30 text-[10px] font-bold uppercase tracking-wider">
                  RawGitHack
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                {game.author ? `By ${game.author}` : 'gn-math Archive'}
              </div>
            </div>
          </div>

          {/* Right Controls - Only purposeful buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Favorite Button */}
            <button
              onClick={() => onToggleFavorite(game.id)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                isFavorite
                  ? 'bg-[#ff5500]/20 text-[#ff5500] border-[#ff5500]/50'
                  : 'bg-[#18181b] text-zinc-400 hover:text-white border-[#27272a]'
              }`}
              title={isFavorite ? 'Saved to Favorites' : 'Add to Favorites'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ff5500]' : ''}`} />
            </button>

            {/* Stealth about:blank button */}
            <button
              onClick={() => launchAboutBlank(currentUrl, game.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-[#222226] text-zinc-200 hover:text-[#ff5500] text-xs font-semibold rounded-lg border border-[#27272a] hover:border-[#ff5500]/40 transition-colors cursor-pointer"
              title="Open stealth tab (about:blank cloak)"
            >
              <EyeOff className="w-3.5 h-3.5 text-[#ff5500]" />
              <span className="hidden sm:inline">Stealth Window</span>
            </button>

            {/* Reload button */}
            <button
              onClick={reloadGame}
              className="p-2 bg-[#18181b] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-lg border border-[#27272a] hover:border-[#ff5500]/40 transition-colors cursor-pointer"
              title="Reload game"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-[#18181b] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-lg border border-[#27272a] hover:border-[#ff5500]/40 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 bg-[#ff5500] hover:bg-[#e64d00] text-black font-bold rounded-lg transition-colors cursor-pointer ml-1"
              title="Close game (Esc)"
            >
              <X className="w-4 h-4 stroke-[3]" />
            </button>

          </div>

        </div>

        {/* Game Canvas Container */}
        <div className="relative flex-1 w-full h-full bg-black overflow-hidden">
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-10 space-y-3">
              <div className="w-9 h-9 border-3 border-[#ff5500] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-zinc-200 font-heading">
                Loading {game.name} from RawGitHack...
              </p>
              <span className="text-xs text-zinc-400">
                gn-math Archive
              </span>
            </div>
          )}

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={currentUrl}
            title={game.name}
            className="w-full h-full border-none"
            allow="fullscreen; autoplay; gamepad; focus-without-user-activation; clipboard-read; clipboard-write; microphone; camera;"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />

          {/* Fallback */}
          {hasError && (
            <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
              <div className="p-3 bg-[#ff5500]/15 rounded-2xl border border-[#ff5500]/40 text-[#ff5500]">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-white">
                Game blocked in iframe
              </h4>
              <p className="text-xs text-zinc-400 max-w-md">
                Launch in a stealth about:blank window to bypass iframe restrictions.
              </p>
              <button
                onClick={() => launchAboutBlank(currentUrl, game.name)}
                className="px-5 py-2.5 bg-[#ff5500] hover:bg-[#e64d00] text-black text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Open in Stealth Window
              </button>
            </div>
          )}

        </div>

        {/* Bottom Bar */}
        <div className="px-4 py-2 bg-[#0a0a0a] border-t border-[#1c1c20] flex items-center justify-between text-[11px] text-zinc-400 select-none">
          <div className="flex items-center gap-2">
            <span>🎮 Click game to focus keyboard</span>
            <span>·</span>
            <span>Press [Esc] to exit</span>
          </div>
          <div className="text-zinc-400 font-mono">
            RawGitHack CDN
          </div>
        </div>

      </div>

    </div>
  );
};
