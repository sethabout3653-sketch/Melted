import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Sparkles, Check, RefreshCw } from 'lucide-react';

interface ColorWheelPickerProps {
  color: string;
  onChange: (hexColor: string) => void;
}

// Convert HSL to Hex string
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Convert Hex string to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return { h: 217, s: 91, l: 60 };

  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({ color, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Deconstruct current HSL from color prop
  const currentHsl = hexToHsl(color);
  const [hue, setHue] = useState<number>(currentHsl.h);
  const [saturation, setSaturation] = useState<number>(currentHsl.s);
  const [lightness, setLightness] = useState<number>(currentHsl.l || 50);

  // Sync state if color prop changes externally
  useEffect(() => {
    const parsed = hexToHsl(color);
    setHue(parsed.h);
    setSaturation(parsed.s);
    setLightness(parsed.l);
  }, [color]);

  const wheelRadius = 110; // Canvas half size = 110px

  // Draw 360 Degree Chromatic Wheel on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = wheelRadius * 2;
    canvas.width = size;
    canvas.height = size;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - wheelRadius;
        const dy = y - wheelRadius;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const index = (y * size + x) * 4;

        if (dist <= wheelRadius) {
          // Angle in degrees 0-360 starting top
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          if (angle < 0) angle += 360;

          const sat = (dist / wheelRadius) * 100; // 0% in center, 100% at border
          const lit = 50; // standard 50% lightness wheel

          // HSL to RGB conversion
          const sFrac = sat / 100;
          const lFrac = lit / 100;
          const c = (1 - Math.abs(2 * lFrac - 1)) * sFrac;
          const xVal = c * (1 - Math.abs(((angle / 60) % 2) - 1));
          const m = lFrac - c / 2;

          let r1 = 0,
            g1 = 0,
            b1 = 0;
          if (angle < 60) {
            r1 = c; g1 = xVal; b1 = 0;
          } else if (angle < 120) {
            r1 = xVal; g1 = c; b1 = 0;
          } else if (angle < 180) {
            r1 = 0; g1 = c; b1 = xVal;
          } else if (angle < 240) {
            r1 = 0; g1 = xVal; b1 = c;
          } else if (angle < 300) {
            r1 = xVal; g1 = 0; b1 = c;
          } else {
            r1 = c; g1 = 0; b1 = xVal;
          }

          data[index] = Math.round((r1 + m) * 255);
          data[index + 1] = Math.round((g1 + m) * 255);
          data[index + 2] = Math.round((b1 + m) * 255);
          data[index + 3] = 255; // Alpha
        } else {
          // Anti-aliased outer edge or transparent
          data[index + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [wheelRadius]);

  // Handle color picking from canvas coordinates
  const handlePickColor = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Angle from 0 to 360 degrees starting top (0 = Red, 60 = Yellow, 120 = Green, 180 = Cyan, 240 = Blue, 300 = Magenta)
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;

      const maxRadius = rect.width / 2;
      const clampedDist = Math.min(dist, maxRadius);
      const sat = Math.round((clampedDist / maxRadius) * 100);
      const h = Math.round(angle);

      setHue(h);
      setSaturation(sat);

      const newHex = hslToHex(h, sat, lightness);
      onChange(newHex);
    },
    [lightness, onChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handlePickColor(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        handlePickColor(e.clientX, e.clientY);
      }
    },
    [isDragging, handlePickColor]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle Lightness slider change
  const handleLightnessChange = (newLightness: number) => {
    setLightness(newLightness);
    const newHex = hslToHex(hue, saturation, newLightness);
    onChange(newHex);
  };

  // Calculate handle position on wheel circle
  const handleAngleRad = ((hue - 90) * Math.PI) / 180;
  const handleDist = (saturation / 100) * wheelRadius;
  const handleX = wheelRadius + handleDist * Math.cos(handleAngleRad);
  const handleY = wheelRadius + handleDist * Math.sin(handleAngleRad);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        {/* Interactive 360 Color Wheel Container */}
        <div className="relative shrink-0 select-none cursor-crosshair group" ref={containerRef} onMouseDown={handleMouseDown}>
          {/* Wheel Canvas */}
          <canvas
            ref={canvasRef}
            className="w-[220px] h-[220px] rounded-full shadow-xl transition-shadow group-hover:shadow-2xl border-4 border-white dark:border-slate-800"
          />

          {/* Center Glow Indicator */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full blur-md pointer-events-none transition-colors"
            style={{ backgroundColor: color }}
          />

          {/* Interactive Handle Cursor */}
          <div
            className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white shadow-lg pointer-events-none transition-transform flex items-center justify-center scale-110"
            style={{
              left: `${handleX}px`,
              top: `${handleY}px`,
              backgroundColor: color,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
          </div>
        </div>

        {/* Color Info & Adjustments */}
        <div className="flex-1 w-full space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" /> 360° Chromatic Wheel
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
              {hue}° Hue
            </span>
          </div>

          {/* Swatch & Hex Code */}
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div
              className="w-10 h-10 rounded-xl shrink-0 shadow-md border border-white/20 flex items-center justify-center text-white"
              style={{ backgroundColor: color }}
            >
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hex Code</span>
              <input
                type="text"
                value={color.toUpperCase()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-F]{6}$/i.test(val)) {
                    onChange(val);
                  }
                }}
                className="w-full bg-transparent font-mono text-sm font-black text-slate-900 dark:text-white uppercase focus:outline-none"
              />
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-slate-400 block">HSL</span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400 font-semibold">
                {hue}°, {saturation}%, {lightness}%
              </span>
            </div>
          </div>

          {/* Lightness Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold">
              <span>Shade / Lightness</span>
              <span className="font-mono">{lightness}%</span>
            </div>
            <div className="relative flex items-center">
              <input
                type="range"
                min={20}
                max={85}
                value={lightness}
                onChange={(e) => handleLightnessChange(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${hslToHex(hue, saturation, 20)}, ${hslToHex(
                    hue,
                    saturation,
                    50
                  )}, ${hslToHex(hue, saturation, 85)})`,
                }}
              />
            </div>
          </div>

          {/* UI Live Component Preview */}
          <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Live Theme Preview
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-black text-white rounded-xl shadow-md transition-all font-heading"
                style={{ backgroundColor: color }}
              >
                Primary Button
              </button>
              <span
                className="px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-xs"
                style={{
                  borderColor: `${color}40`,
                  backgroundColor: `${color}15`,
                  color: color,
                }}
              >
                ● Active Pill
              </span>
              <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: color }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
