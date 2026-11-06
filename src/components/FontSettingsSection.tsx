import React, { useRef, useState } from 'react';
import { 
  Type, 
  Upload, 
  Check, 
  RotateCcw, 
  Sparkles, 
  AlertCircle, 
  FileText,
  Calculator
} from 'lucide-react';
import { useFontConfig } from '../hooks/useFontConfig';
import { FontPresetId, ModernCleanBodyFont, ModernCleanHeadingWeight } from '../services/fontStorage';

interface FontSettingsSectionProps {
  className?: string;
}

export const FontSettingsSection: React.FC<FontSettingsSectionProps> = ({ className = '' }) => {
  const {
    fontConfig,
    updateFontConfig,
    uploadCustomFontFile,
    resetToDefaultFont,
    isApplying,
  } = useFontConfig();

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fontFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setSuccessMessage(null);

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.ttf') && !lower.endsWith('.otf')) {
      setUploadError('Please choose a valid .ttf or .otf font file.');
      e.target.value = '';
      return;
    }

    try {
      await uploadCustomFontFile(file);
      setSuccessMessage(`Custom font "${file.name}" applied successfully!`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to load custom font.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-cyan-500 dark:text-cyan-300" />
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
            App Typography & Font
          </h4>
        </div>
        {fontConfig.preset !== 'default' && (
          <button
            type="button"
            onClick={resetToDefaultFont}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
            title="Reset font to default"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Font</span>
          </button>
        )}
      </div>

      {/* Font Preset Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Preset 1: Default */}
        <button
          type="button"
          onClick={() => updateFontConfig({ preset: 'default' })}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
            fontConfig.preset === 'default'
              ? 'border-cyan-500 bg-blue-50/60 dark:bg-blue-900/30 text-blue-900 dark:text-white shadow-sm ring-1 ring-cyan-400'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          {fontConfig.preset === 'default' && (
            <div className="absolute top-2 right-2 w-4 h-4 rounded-sm bg-cyan-500 text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
          )}
          <div>
            <div className="text-xs font-bold">Default</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Inter & Outfit</div>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 dark:text-slate-500">System Balanced</div>
        </button>

        {/* Preset 2: Modern & Clean (Outfit Bold/Black + Inter or DM Sans) */}
        <button
          type="button"
          onClick={() => updateFontConfig({ preset: 'modern-clean' })}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
            fontConfig.preset === 'modern-clean'
              ? 'border-cyan-500 bg-blue-50/60 dark:bg-blue-900/30 text-blue-900 dark:text-white shadow-sm ring-1 ring-cyan-400'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          {fontConfig.preset === 'modern-clean' && (
            <div className="absolute top-2 right-2 w-4 h-4 rounded-sm bg-cyan-500 text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
          )}
          <div>
            <div className="text-xs font-black tracking-tight flex items-center gap-1">
              <span>Modern & Clean</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Outfit & DM / Inter</div>
          </div>
          <div className="mt-2 text-[10px] font-medium text-cyan-500 dark:text-cyan-300">Bold / Black Weight</div>
        </button>

        {/* Preset 3: Custom Font File (.ttf / .otf) */}
        <button
          type="button"
          onClick={() => {
            if (fontConfig.customFontName) {
              updateFontConfig({ preset: 'custom' });
            } else {
              fontFileInputRef.current?.click();
            }
          }}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
            fontConfig.preset === 'custom'
              ? 'border-cyan-500 bg-blue-50/60 dark:bg-blue-900/30 text-blue-900 dark:text-white shadow-sm ring-1 ring-cyan-400'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          {fontConfig.preset === 'custom' && (
            <div className="absolute top-2 right-2 w-4 h-4 rounded-sm bg-cyan-500 text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
          )}
          <div>
            <div className="text-xs font-bold">Custom File</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[100px]">
              {fontConfig.customFontName || '.ttf / .otf file'}
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">Your Own Font</div>
        </button>
      </div>

      {/* Hidden Custom Font File Input */}
      <input
        type="file"
        ref={fontFileInputRef}
        onChange={handleFileChange}
        accept=".ttf,.otf,font/ttf,font/otf,application/x-font-ttf,application/x-font-opentype"
        className="hidden"
      />

      {/* Options when Modern & Clean is active */}
      {fontConfig.preset === 'modern-clean' && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Body Font
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Primary body and UI label font
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {(['plus-jakarta', 'inter', 'dm-sans'] as ModernCleanBodyFont[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => updateFontConfig({ modernCleanBody: f })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    fontConfig.modernCleanBody === f
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f === 'plus-jakarta' ? 'Plus Jakarta' : f === 'dm-sans' ? 'DM Sans' : 'Inter'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80">
            <div>
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Outfit Heading Weight
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Bold (700) or extra punchy Black (900)
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {(['700', '900'] as ModernCleanHeadingWeight[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => updateFontConfig({ modernCleanWeight: w })}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    fontConfig.modernCleanWeight === w
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {w === '900' ? 'Black (900)' : 'Bold (700)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Options when Custom Font is active or selected */}
      {(fontConfig.preset === 'custom' || fontConfig.customFontName) && (
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 text-cyan-500 dark:text-cyan-300">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {fontConfig.customFontName || 'Custom Font File'}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {fontConfig.customFontFormat === 'opentype' ? 'OTF Font' : 'TTF Font'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fontFileInputRef.current?.click()}
                disabled={isApplying}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Different File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Custom Upload Action button if not yet uploaded */}
      {!fontConfig.customFontName && fontConfig.preset !== 'custom' && (
        <button
          type="button"
          onClick={() => fontFileInputRef.current?.click()}
          disabled={isApplying}
          className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-400 bg-slate-50/50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-300 transition-colors cursor-pointer flex items-center justify-center gap-2 text-xs font-bold"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Custom .TTF or .OTF Font File</span>
        </button>
      )}

      {/* Error & Success Messages */}
      {uploadError && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Live Font & Math Preview Box */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span>Live Typography Preview</span>
          <span className="text-cyan-500 dark:text-cyan-300 font-bold">
            {fontConfig.preset === 'custom'
              ? (fontConfig.customFontName || 'Custom Font')
              : fontConfig.preset === 'modern-clean'
              ? `Modern Clean (${fontConfig.modernCleanWeight === '900' ? 'Black' : 'Bold'})`
              : 'Default (Inter)'}
          </span>
        </div>

        {/* Heading Preview */}
        <div 
          className="text-base text-slate-900 dark:text-white transition-all"
          style={{
            fontFamily: 'var(--app-font-heading)',
            fontWeight: 'var(--app-font-heading-weight)',
          }}
        >
          FrostHub Gaming & Community Hub
        </div>

        {/* Body Text Preview */}
        <p 
          className="text-xs text-slate-600 dark:text-slate-300 transition-all leading-relaxed"
          style={{ fontFamily: 'var(--app-font-family)' }}
        >
          The quick brown fox jumps over the lazy dog. 0123456789.
        </p>

        {/* Math Equation Isolation Notice & Preview */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Calculator className="w-3.5 h-3.5 text-amber-500" />
            <span>AI Assistant Math:</span>
          </div>
          <div className="katex text-xs text-slate-800 dark:text-slate-200">
            <span>x = </span>
            <span className="font-serif italic">-b &plusmn; &radic;(b&sup2; - 4ac)</span>
            <span> / 2a</span>
          </div>
        </div>
      </div>
    </div>
  );
};
