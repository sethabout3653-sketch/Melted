import React, { useState } from 'react';
import { Music, RefreshCw, ExternalLink, Maximize2, ShieldCheck, Volume2 } from 'lucide-react';

export const MusicView: React.FC = () => {
  const [iframeKey, setIframeKey] = useState(0);
  const musicUrl = 'https://saugatr-solutions656674.uralstalker.ru/ripple/';

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(musicUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFullscreen = () => {
    const iframe = document.getElementById('music-iframe') as HTMLIFrameElement;
    if (iframe && iframe.requestFullscreen) {
      iframe.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#050507] relative overflow-hidden">
      {/* Top Bar / Controls */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-[#1a1a20] bg-[#08080a] flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Music className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm sm:text-base truncate">Ripple Music</span>
            </div>
            <span className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate block">
              Music Streaming & Player Station
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Reload Player"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Reload</span>
          </button>

          <button
            type="button"
            onClick={handleFullscreen}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Fullscreen Player"
          >
            <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Fullscreen</span>
          </button>

          <button
            type="button"
            onClick={handleOpenExternal}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open External</span>
          </button>
        </div>
      </div>

      {/* Embedded Website Screen */}
      <div className="flex-1 min-h-0 relative bg-black flex flex-col">
        <iframe
          key={iframeKey}
          id="music-iframe"
          src={musicUrl}
          title="Ripple Music Player"
          className="w-full h-full border-none bg-black"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-presentation"
        />
      </div>
    </div>
  );
};
