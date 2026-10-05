import React, { useState } from 'react';
import { Download, Sparkles, X, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed as standalone app, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#0066ff] hover:bg-[#0052cc] rounded-xl shadow-md shadow-[#0066ff]/20 transition-all cursor-pointer font-heading"
        title="Install Frosted as a desktop or mobile application"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden md:inline">Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-[#121214] hover:bg-[#1c1c20] hover:text-[#0066ff] rounded-xl border border-[#222225] hover:border-[#0066ff]/40 transition-all cursor-pointer"
          title="Install on iOS"
        >
          <Download className="w-3.5 h-3.5 text-[#0066ff]" />
          <span className="hidden md:inline">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-[#121214] border border-[#26262a] p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0066ff] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-black" />
                  </div>
                  <h3 className="text-base font-extrabold text-white font-heading">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-3 text-xs text-zinc-300 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0066ff]/20 text-[#3b82f6] font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                  <span>Tap the <strong className="text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 text-[#0066ff]" /> Share</strong> icon in your Safari bottom navigation bar.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0066ff]/20 text-[#3b82f6] font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                  <span>Scroll down and select <strong className="text-white">Add to Home Screen</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0066ff]/20 text-[#3b82f6] font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                  <span>Launch Melted directly from your home screen for instant fullscreen play!</span>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[#202024] hover:bg-[#28282c] py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
