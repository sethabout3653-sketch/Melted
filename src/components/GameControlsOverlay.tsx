import React, { useState, useEffect } from 'react';
import { GameControlMapping } from '../services/gameControlsService';
import { Gamepad2 } from 'lucide-react';

interface GameControlsOverlayProps {
  controls: GameControlMapping;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onOpenKeybindsModal: () => void;
}

export const GameControlsOverlay: React.FC<GameControlsOverlayProps> = ({
  controls,
  iframeRef,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [showMobileOverlay, setShowMobileOverlay] = useState<boolean>(true);
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const checkTouch = () => {
      const ua = navigator.userAgent || '';
      const isMobileOs = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isDesktopOs =
        /Windows NT|Macintosh|Mac OS X|CrOS|Linux x86_64|Linux i686/i.test(ua) && !isMobileOs;
      if (isDesktopOs) {
        setIsTouchDevice(false);
        return;
      }
      const hasFinePointer =
        typeof window.matchMedia === 'function' && window.matchMedia('(any-pointer: fine)').matches;
      const isCoarseOnly =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(pointer: coarse)').matches &&
        !hasFinePointer;
      const isTouch = isMobileOs || isCoarseOnly;
      setIsTouchDevice(isTouch);
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  const getKeyCodes = (key: string) => {
    switch (key.toLowerCase()) {
      case 'arrowup':
      case 'up':
        return { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38 };
      case 'arrowdown':
      case 'down':
        return { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40 };
      case 'arrowleft':
      case 'left':
        return { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37 };
      case 'arrowright':
      case 'right':
        return { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39 };
      case 'z':
        return { key: 'z', code: 'KeyZ', keyCode: 90, which: 90 };
      case 'x':
        return { key: 'x', code: 'KeyX', keyCode: 88, which: 88 };
      case 'c':
        return { key: 'c', code: 'KeyC', keyCode: 67, which: 67 };
      case 'r':
        return { key: 'r', code: 'KeyR', keyCode: 82, which: 82 };
      case ' ':
      case 'space':
        return { key: ' ', code: 'Space', keyCode: 32, which: 32 };
      case 'enter':
        return { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
      default:
        return { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, keyCode: key.charCodeAt(0) || 0, which: key.charCodeAt(0) || 0 };
    }
  };

  const sendKeyEvent = (rawKey: string, rawCode: string, type: 'keydown' | 'keyup') => {
    const info = getKeyCodes(rawKey);
    const win = iframeRef.current?.contentWindow;

    try {
      iframeRef.current?.focus();
      win?.focus();
    } catch {}

    // 1. Send PostMessage into iframe
    if (win) {
      try {
        win.postMessage({ type: 'FROST_SIMULATE_KEY', typeEvent: type, key: info.key, code: info.code, keyCode: info.keyCode, which: info.which }, '*');
        win.postMessage({ type: type === 'keydown' ? 'SIMULATE_KEY_DOWN' : 'SIMULATE_KEY_UP', key: info.key, code: info.code }, '*');
        
        // 2. Dispatch comprehensive KeyboardEvent on iframe contentDocument & contentWindow
        const doc = iframeRef.current?.contentDocument || win.document;
        if (doc) {
          const ev = new KeyboardEvent(type, {
            key: info.key,
            code: info.code,
            bubbles: true,
            cancelable: true,
            composed: true,
          });
          Object.defineProperties(ev, {
            keyCode: { get: () => info.keyCode },
            which: { get: () => info.which },
            charCode: { get: () => info.keyCode },
          });
          doc.dispatchEvent(ev);
          win.dispatchEvent(ev);
        }
      } catch {}
    }

    // 3. Dispatch on parent window / document
    try {
      const ev = new KeyboardEvent(type, {
        key: info.key,
        code: info.code,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperties(ev, {
        keyCode: { get: () => info.keyCode },
        which: { get: () => info.which },
      });
      window.dispatchEvent(ev);
    } catch {}
  };

  const handleTouchStart = (key: string, code: string, id: string, e: React.SyntheticEvent) => {
    e.preventDefault();
    setActiveButtons((prev) => ({ ...prev, [id]: true }));
    sendKeyEvent(key, code, 'keydown');
  };

  const handleTouchEnd = (key: string, code: string, id: string, e: React.SyntheticEvent) => {
    e.preventDefault();
    setActiveButtons((prev) => ({ ...prev, [id]: false }));
    sendKeyEvent(key, code, 'keyup');
  };

  // On desktop, DON'T show controls, DON'T show any buttons, and delete the question mark button entirely.
  if (!isTouchDevice) {
    return null;
  }

  return (
    <>
      {/* Floating Mobile Controls Toggle Only (No question mark button) */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowMobileOverlay(!showMobileOverlay)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/80 hover:bg-black text-white border border-white/20 text-xs font-bold shadow-xl transition-colors cursor-pointer"
          title={showMobileOverlay ? 'Hide On-Screen Controls' : 'Show On-Screen Controls'}
        >
          <Gamepad2 className="w-4 h-4 text-[var(--brand-blue)]" />
          <span>{showMobileOverlay ? 'Hide Controls' : 'Show Controls'}</span>
        </button>
      </div>

      {/* On-Screen Virtual Gamepad / Custom UI Overlay */}
      {showMobileOverlay && (
        <div className="absolute inset-x-0 bottom-0 z-25 pointer-events-none p-4 flex items-end justify-between select-none">
          
          {/* Left D-Pad / Movement Group */}
          <div className="pointer-events-auto relative w-36 h-36 sm:w-44 sm:h-44 bg-black/40 backdrop-blur-xs rounded-full border border-white/15 flex items-center justify-center shadow-2xl">
            {controls.layout === 'steering' ? (
              <>
                <button
                  type="button"
                  onTouchStart={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', 'left', e)}
                  onTouchEnd={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', 'left', e)}
                  onMouseDown={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', 'left', e)}
                  onMouseUp={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', 'left', e)}
                  className={`absolute left-2 w-14 h-24 rounded-2xl flex items-center justify-center text-white font-black text-xs border border-white/20 transition-all ${
                    activeButtons['left'] ? 'bg-blue-600 scale-95' : 'bg-slate-900/80 active:bg-blue-600'
                  }`}
                >
                  ◄
                </button>
                <button
                  type="button"
                  onTouchStart={(e) => handleTouchStart('ArrowRight', 'ArrowRight', 'right', e)}
                  onTouchEnd={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', 'right', e)}
                  onMouseDown={(e) => handleTouchStart('ArrowRight', 'ArrowRight', 'right', e)}
                  onMouseUp={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', 'right', e)}
                  className={`absolute right-2 w-14 h-24 rounded-2xl flex items-center justify-center text-white font-black text-xs border border-white/20 transition-all ${
                    activeButtons['right'] ? 'bg-blue-600 scale-95' : 'bg-slate-900/80 active:bg-blue-600'
                  }`}
                >
                  ►
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onTouchStart={(e) => handleTouchStart('ArrowUp', 'ArrowUp', 'up', e)}
                  onTouchEnd={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', 'up', e)}
                  onMouseDown={(e) => handleTouchStart('ArrowUp', 'ArrowUp', 'up', e)}
                  onMouseUp={(e) => handleTouchEnd('ArrowUp', 'ArrowUp', 'up', e)}
                  className={`absolute top-2 w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm border border-white/20 transition-all ${
                    activeButtons['up'] ? 'bg-blue-600 scale-95' : 'bg-slate-900/80 active:bg-blue-600'
                  }`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onTouchStart={(e) => handleTouchStart('ArrowDown', 'ArrowDown', 'down', e)}
                  onTouchEnd={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', 'down', e)}
                  onMouseDown={(e) => handleTouchStart('ArrowDown', 'ArrowDown', 'down', e)}
                  onMouseUp={(e) => handleTouchEnd('ArrowDown', 'ArrowDown', 'down', e)}
                  className={`absolute bottom-2 w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm border border-white/20 transition-all ${
                    activeButtons['down'] ? 'bg-blue-600 scale-95' : 'bg-slate-900/80 active:bg-blue-600'
                  }`}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onTouchStart={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', 'left', e)}
                  onTouchEnd={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', 'left', e)}
                  onMouseDown={(e) => handleTouchStart('ArrowLeft', 'ArrowLeft', 'left', e)}
                  onMouseUp={(e) => handleTouchEnd('ArrowLeft', 'ArrowLeft', 'left', e)}
                  className={`absolute left-2 w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm border border-white/20 transition-all ${
                    activeButtons['left'] ? 'bg-blue-600 scale-95' : 'bg-slate-900/80 active:bg-blue-600'
                  }`}
                >
                  ◄
                </button>
                <button
                  type="button"
                  onTouchStart={(e) => handleTouchStart('ArrowRight', 'ArrowRight', 'right', e)}
                  onTouchEnd={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', 'right', e)}
                  onMouseDown={(e) => handleTouchStart('ArrowRight', 'ArrowRight', 'right', e)}
                  onMouseUp={(e) => handleTouchEnd('ArrowRight', 'ArrowRight', 'right', e)}
                  className={`absolute right-2 w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm border border-white/20 transition-all ${
                    activeButtons['right'] ? 'bg-blue-600 scale-95' : 'bg-slate-900/80 active:bg-blue-600'
                  }`}
                >
                  ►
                </button>
              </>
            )}
            <div className="w-8 h-8 rounded-full bg-white/10" />
          </div>

          {/* Right Action Buttons Group */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2.5 max-w-[280px]">
            {controls.buttons
              .filter((b) => !['up', 'down', 'left', 'right'].includes(b.id))
              .map((btn) => {
                const isActive = activeButtons[btn.id];
                const bgClass =
                  btn.color === 'green'
                    ? isActive ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'
                    : btn.color === 'red'
                    ? isActive ? 'bg-red-700' : 'bg-red-600 hover:bg-red-500'
                    : btn.color === 'amber'
                    ? isActive ? 'bg-amber-700' : 'bg-amber-600 hover:bg-amber-500'
                    : isActive ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-500';

                return (
                  <button
                    key={btn.id}
                    type="button"
                    onTouchStart={(e) => handleTouchStart(btn.key, btn.code, btn.id, e)}
                    onTouchEnd={(e) => handleTouchEnd(btn.key, btn.code, btn.id, e)}
                    onMouseDown={(e) => handleTouchStart(btn.key, btn.code, btn.id, e)}
                    onMouseUp={(e) => handleTouchEnd(btn.key, btn.code, btn.id, e)}
                    className={`min-w-[60px] min-h-[52px] sm:min-w-[72px] sm:min-h-[64px] px-3 rounded-2xl ${bgClass} text-white font-black text-xs sm:text-sm shadow-xl border-2 border-white/30 flex items-center justify-center transition-all active:scale-90`}
                  >
                    {btn.label}
                  </button>
                );
              })}
          </div>

        </div>
      )}
    </>
  );
};
