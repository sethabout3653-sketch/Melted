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
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] rounded-xl shadow-md shadow-[var(--brand-blue-glow)] transition-all cursor-pointer font-heading"
        title="Install FrostHub as a desktop or mobile application"
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
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-[var(--brand-blue)] dark:hover:text-cyan-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[var(--brand-blue)]/40 dark:hover:border-cyan-300/40 transition-all cursor-pointer"
          title="Install on iOS"
        >
          <Download className="w-3.5 h-3.5 text-[var(--brand-blue)] dark:text-cyan-300" />
          <span className="hidden md:inline">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#13151f] border border-slate-200 dark:border-[#24283b] p-6 shadow-2xl text-left">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--brand-blue)] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-heading">Install on iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-3 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-sm bg-[var(--brand-blue)]/10 dark:bg-cyan-300/20 text-[var(--brand-blue)] dark:text-cyan-300 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                  <span>Tap the <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 text-[var(--brand-blue)] dark:text-cyan-300" /> Share</strong> icon in your Safari bottom navigation bar.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-sm bg-[var(--brand-blue)]/10 dark:bg-cyan-300/20 text-[var(--brand-blue)] dark:text-cyan-300 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                  <span>Scroll down and select <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-sm bg-[var(--brand-blue)]/10 dark:bg-cyan-300/20 text-[var(--brand-blue)] dark:text-cyan-300 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                  <span>Launch Melted directly from your home screen for instant fullscreen play!</span>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
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
