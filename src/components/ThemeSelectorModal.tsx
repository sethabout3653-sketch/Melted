import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  X, 
  Sparkles, 
  Image as ImageIcon, 
  Layers, 
  Check, 
  RotateCcw, 
  Upload, 
  Eye, 
  Sliders, 
  Sun, 
  Moon,
  Maximize2,
  Type
} from 'lucide-react';
import { 
  ThemeConfig, 
  ACCENT_PRESETS, 
  RADIUS_PRESETS, 
  BG_SOLID_PRESETS, 
  BG_GRADIENT_PRESETS, 
  BG_IMAGE_PRESETS 
} from '../hooks/useThemeConfig';
import { ColorWheelPicker } from './ColorWheelPicker';
import { FontSettingsSection } from './FontSettingsSection';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ThemeConfig;
  onUpdateConfig: (partial: Partial<ThemeConfig>) => void;
  onResetTheme: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onResetTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'accent' | 'radius' | 'background' | 'typography'>('accent');
  const [customHexInput, setCustomHexInput] = useState(config.accentColor);
  const [customBgHexInput, setCustomBgHexInput] = useState(config.bgSolidColor);
  const [customUrlInput, setCustomUrlInput] = useState(config.bgImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, base64Data, mimeType: file.type }),
          });
          const data = await res.json();
          if (data.success && data.url) {
            onUpdateConfig({ bgMode: 'image', bgImageUrl: data.url });
            setCustomUrlInput(data.url);
          } else {
            onUpdateConfig({ bgMode: 'image', bgImageUrl: base64Data });
            setCustomUrlInput(base64Data);
          }
        } catch {
          onUpdateConfig({ bgMode: 'image', bgImageUrl: base64Data });
          setCustomUrlInput(base64Data);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError('Failed to process image');
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-heading">
                  Theme & Customization
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Customize colors, border style, and dark background wallpaper
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 pt-2 shrink-0 gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('accent')}
              className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'accent'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Accent Color</span>
            </button>
            <button
              onClick={() => setActiveTab('radius')}
              className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'radius'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Border Radius</span>
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'background'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>App Canvas Background</span>
            </button>
            <button
              onClick={() => setActiveTab('typography')}
              className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'typography'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>Typography & Font</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
            {/* TAB 1: ACCENT COLOR */}
            {activeTab === 'accent' && (
              <div className="space-y-6">
                {/* Interactive 360 Chromatic Color Wheel */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-3">
                    360° Chromatic Color Wheel Palette
                  </label>
                  <ColorWheelPicker
                    color={config.accentColor}
                    onChange={(hex) => {
                      onUpdateConfig({ accentColor: hex, accentHover: hex, accentGlow: `${hex}66` });
                      setCustomHexInput(hex);
                    }}
                  />
                </div>

                {/* Color Presets */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-3">
                    Curated Accent Presets
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                    {ACCENT_PRESETS.map((p) => {
                      const isSelected = config.accentColor.toLowerCase() === p.color.toLowerCase();
                      return (
                        <button
                          key={p.name}
                          onClick={() => {
                            onUpdateConfig({
                              accentColor: p.color,
                              accentHover: p.hover,
                              accentGlow: p.glow,
                            });
                            setCustomHexInput(p.color);
                          }}
                          className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-full shrink-0 shadow-sm flex items-center justify-center text-white"
                            style={{ backgroundColor: p.color }}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {p.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Hex Color Input */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
                    Custom Hex Color Code
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => {
                        const hex = e.target.value;
                        onUpdateConfig({ accentColor: hex, accentHover: hex, accentGlow: `${hex}66` });
                        setCustomHexInput(hex);
                      }}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={customHexInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomHexInput(val);
                        if (/^#[0-9A-F]{6}$/i.test(val)) {
                          onUpdateConfig({ accentColor: val, accentHover: val, accentGlow: `${val}66` });
                        }
                      }}
                      placeholder="#2563eb"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BORDER RADIUS */}
            {activeTab === 'radius' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-3">
                    Choose App Component Rounding Scale
                  </label>
                  <div className="space-y-3">
                    {RADIUS_PRESETS.map((r) => {
                      const isSelected = config.radius === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => onUpdateConfig({ radius: r.id })}
                          className={`w-full p-4 border text-left flex items-center justify-between transition-all cursor-pointer ${
                            r.class
                          } ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center">
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                            </div>
                            <div>
                              <span className="text-sm font-black text-slate-900 dark:text-white block font-heading">
                                {r.label}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                Corner radius: {r.px}
                              </span>
                            </div>
                          </div>

                          <div
                            className={`px-3 py-1 bg-blue-600 text-white text-xs font-bold ${r.class}`}
                          >
                            Sample Card
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: APP CANVAS BACKGROUND */}
            {activeTab === 'background' && (
              <div className="space-y-6">
                {/* Mode Selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-3">
                    Background Mode
                  </label>
                  <div className="grid grid-cols-3 gap-3 p-1.5 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => onUpdateConfig({ bgMode: 'solid' })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        config.bgMode === 'solid'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Solid Color</span>
                    </button>
                    <button
                      onClick={() => onUpdateConfig({ bgMode: 'gradient' })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        config.bgMode === 'gradient'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Gradient Mesh</span>
                    </button>
                    <button
                      onClick={() => onUpdateConfig({ bgMode: 'image' })}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        config.bgMode === 'image'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Custom Picture</span>
                    </button>
                  </div>
                </div>

                {/* SOLID MODE */}
                {config.bgMode === 'solid' && (
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Dark Canvas Color Presets
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {BG_SOLID_PRESETS.map((b) => {
                        const isSelected = config.bgSolidColor.toLowerCase() === b.color.toLowerCase();
                        return (
                          <button
                            key={b.name}
                            onClick={() => {
                              onUpdateConfig({ bgSolidColor: b.color });
                              setCustomBgHexInput(b.color);
                            }}
                            className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-blue-500 ring-2 ring-blue-500/30'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div
                              className="w-5 h-5 rounded-full border border-white/20 shrink-0 shadow-sm flex items-center justify-center text-white"
                              style={{ backgroundColor: b.color }}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                              {b.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                      <input
                        type="color"
                        value={config.bgSolidColor}
                        onChange={(e) => {
                          const hex = e.target.value;
                          onUpdateConfig({ bgSolidColor: hex });
                          setCustomBgHexInput(hex);
                        }}
                        className="w-9 h-9 rounded-xl cursor-pointer border-0 bg-transparent"
                      />
                      <input
                        type="text"
                        value={customBgHexInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomBgHexInput(val);
                          if (/^#[0-9A-F]{6}$/i.test(val)) {
                            onUpdateConfig({ bgSolidColor: val });
                          }
                        }}
                        placeholder="#090d16"
                        className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* GRADIENT MODE */}
                {config.bgMode === 'gradient' && (
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Ambient Gradient Mesh Presets
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {BG_GRADIENT_PRESETS.map((g) => {
                        const isSelected = config.bgGradientPreset === g.id;
                        return (
                          <button
                            key={g.id}
                            onClick={() => onUpdateConfig({ bgGradientPreset: g.id })}
                            className={`p-4 rounded-2xl border text-left h-20 flex items-end justify-between transition-all cursor-pointer overflow-hidden relative ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 dark:border-slate-800'
                            }`}
                            style={{ background: g.css }}
                          >
                            <span className="text-xs font-black text-white relative z-10 shadow-sm">
                              {g.name}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-white relative z-10 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CUSTOM PICTURE / IMAGE MODE */}
                {config.bgMode === 'image' && (
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-3">
                        Curated Wallpaper Presets
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {BG_IMAGE_PRESETS.map((img) => {
                          const isSelected = config.bgImageUrl === img.url;
                          return (
                            <button
                              key={img.name}
                              onClick={() => {
                                onUpdateConfig({ bgImageUrl: img.url });
                                setCustomUrlInput(img.url);
                              }}
                              className={`h-24 rounded-2xl border overflow-hidden relative group text-left p-3 flex items-end transition-all cursor-pointer ${
                                isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <img src={img.url} alt={img.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                              <span className="text-[11px] font-black text-white relative z-10 leading-tight">
                                {img.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Upload or Custom URL */}
                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Upload Custom Background or Paste URL
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customUrlInput}
                          onChange={(e) => {
                            setCustomUrlInput(e.target.value);
                            onUpdateConfig({ bgImageUrl: e.target.value });
                          }}
                          placeholder="Paste image URL (https://...)"
                          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shrink-0 shadow-md"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                      {uploadError && <p className="text-xs text-red-500 font-bold">{uploadError}</p>}
                    </div>

                    {/* Image Controls: Blur & Dimming Opacity */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                        <Sliders className="w-4 h-4 text-blue-500" />
                        <span>Background Adjustments</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                          <span>Blur Intensity</span>
                          <span className="font-mono">{config.bgBlur}px</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={20}
                          value={config.bgBlur}
                          onChange={(e) => onUpdateConfig({ bgBlur: Number(e.target.value) })}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                          <span>Dark Overlay Dimming (Readability)</span>
                          <span className="font-mono">{Math.round(config.bgOverlayOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={0.95}
                          step={0.05}
                          value={config.bgOverlayOpacity}
                          onChange={(e) => onUpdateConfig({ bgOverlayOpacity: Number(e.target.value) })}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: TYPOGRAPHY & CUSTOM FONT */}
            {activeTab === 'typography' && (
              <div className="space-y-6">
                <FontSettingsSection />
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              onClick={() => {
                onResetTheme();
                setCustomHexInput('#2563eb');
                setCustomBgHexInput('#090d16');
                setCustomUrlInput('');
              }}
              className="px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Defaults</span>
            </button>

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer font-heading"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
