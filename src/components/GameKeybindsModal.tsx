import React from 'react';
import { GameControlMapping } from '../services/gameControlsService';
import { X, Keyboard, Command, Sparkles } from 'lucide-react';

interface GameKeybindsModalProps {
  controls: GameControlMapping;
  gameName: string;
  onClose: () => void;
}

export const GameKeybindsModal: React.FC<GameKeybindsModalProps> = ({
  controls,
  gameName,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-[var(--brand-blue)] flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base font-heading">
                Controls & Keybinds
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {gameName} ({controls.category})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Description */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[var(--brand-blue)] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {controls.keybinds.description}
            </p>
          </div>

          {/* Keybinds Table / List */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Assigned Keybinds (PC & Keyboard)
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(controls.keybinds).map(([key, val]) => {
                if (key === 'description') return null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <span className="text-xs font-bold text-slate-400 capitalize">
                      {key}
                    </span>
                    <span className="text-xs font-extrabold text-[var(--brand-blue)] bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 font-mono">
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile vs PC Info */}
          <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80 flex items-center gap-2">
            <Command className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              On mobile devices, touch-friendly virtual controls automatically appear on screen. On PC, use your physical keyboard and mouse.
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-xs font-bold shadow-lg shadow-[var(--brand-blue-glow)] transition-all cursor-pointer"
          >
            Got it, Resume Game
          </button>
        </div>

      </div>
    </div>
  );
};
