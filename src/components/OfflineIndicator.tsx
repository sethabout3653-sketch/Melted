import React from 'react';
import { WifiOff, DownloadCloud, CheckCircle2, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  cachedCount: number;
  isPreCaching: boolean;
  cacheProgress: { current: number; total: number };
  onCancelPreCache?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  cachedCount,
  isPreCaching,
  cacheProgress,
  onCancelPreCache,
}) => {
  const isOnline = useOnlineStatus();

  // If caching is in progress, show smooth non-blocking progress pill
  if (isPreCaching) {
    const percent = Math.round((cacheProgress.current / Math.max(cacheProgress.total, 1)) * 100);
    return (
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3 bg-[#111114]/95 border border-[#2a2a2e] px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
        <div className="w-4 h-4 border-2 border-[#0066ff] border-t-transparent rounded-full animate-spin shrink-0" />
        <div className="text-xs">
          <div className="font-bold text-white flex items-center gap-1.5 font-heading">
            <DownloadCloud className="w-3.5 h-3.5 text-[#0066ff]" />
            Caching Games for Offline ({percent}%)
          </div>
          <div className="text-[11px] text-zinc-400">
            {cacheProgress.current} of {cacheProgress.total} ready
          </div>
        </div>
        {onCancelPreCache && (
          <button
            onClick={onCancelPreCache}
            className="p-1 hover:bg-[#202024] rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Stop Caching"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // When offline, show sleek amber/orange persistent banner
  if (!isOnline) {
    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#16120d]/95 border border-[#0066ff]/50 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 max-w-md w-[92%] sm:w-auto">
        <div className="w-8 h-8 rounded-xl bg-[#0066ff]/20 flex items-center justify-center shrink-0 border border-[#0066ff]/40">
          <WifiOff className="w-4 h-4 text-[#0066ff]" />
        </div>
        <div className="text-xs min-w-0">
          <div className="font-extrabold text-white font-heading flex items-center gap-2">
            <span>Offline Mode Active</span>
            <span className="px-1.5 py-0.2 rounded-md bg-[#0066ff]/20 text-[#ff7722] text-[10px] font-mono">
              Offline
            </span>
          </div>
          <div className="text-[11px] text-zinc-300 truncate">
            {cachedCount > 0 
              ? `${cachedCount} games cached & ready to play without internet`
              : 'Cached games and pages remain playable'}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
