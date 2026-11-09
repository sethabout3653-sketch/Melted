import React from 'react';
import { ThemeConfig, BG_GRADIENT_PRESETS } from '../hooks/useThemeConfig';

interface AppCanvasBackgroundProps {
  themeConfig: ThemeConfig;
  isDark: boolean;
}

export const AppCanvasBackground: React.FC<AppCanvasBackgroundProps> = ({ themeConfig, isDark }) => {
  // If not dark mode and bgMode is default solid, allow clean light background
  if (!isDark && themeConfig.bgMode === 'solid' && themeConfig.bgSolidColor === '#090d16') {
    return null;
  }

  const { bgMode, bgSolidColor, bgGradientPreset, bgImageUrl, bgBlur, bgOverlayOpacity } = themeConfig;

  if (bgMode === 'solid') {
    return (
      <div 
        className="fixed inset-0 pointer-events-none z-0 transition-colors duration-300"
        style={{ backgroundColor: isDark ? '#000000' : '#ffffff' }}
      />
    );
  }

  if (bgMode === 'gradient') {
    const preset = BG_GRADIENT_PRESETS.find((g) => g.id === bgGradientPreset) || BG_GRADIENT_PRESETS[0];
    return (
      <div 
        className="fixed inset-0 pointer-events-none z-0 transition-all duration-300"
        style={{ background: preset.css }}
      />
    );
  }

  if (bgMode === 'image' && bgImageUrl) {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Background Image with optional blur */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-300"
          style={{ 
            backgroundImage: `url(${bgImageUrl})`,
            filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none',
            transform: bgBlur > 0 ? 'scale(1.05)' : 'none',
          }}
        />
        {/* Scrim Overlay for 100% text readability */}
        <div 
          className="absolute inset-0 bg-slate-950 transition-opacity duration-300"
          style={{ opacity: bgOverlayOpacity }}
        />
      </div>
    );
  }

  return null;
};
