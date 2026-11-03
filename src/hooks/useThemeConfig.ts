import { useState, useEffect, useCallback } from 'react';

export interface ThemeConfig {
  accentColor: string;
  accentHover: string;
  accentGlow: string;
  radius: 'sharp' | 'standard' | 'balanced' | 'soft' | 'pill';
  bgMode: 'solid' | 'gradient' | 'image';
  bgSolidColor: string;
  bgGradientPreset: 'aurora' | 'cosmic' | 'glacier' | 'sunset' | 'matrix';
  bgImageUrl: string;
  bgBlur: number; // 0 to 20px
  bgOverlayOpacity: number; // 0.1 to 0.95
}

export const ACCENT_PRESETS = [
  { name: 'Frosted Blue', color: '#2563eb', hover: '#1d4ed8', glow: 'rgba(37, 99, 235, 0.4)' },
  { name: 'Emerald Cyber', color: '#10b981', hover: '#059669', glow: 'rgba(16, 185, 129, 0.4)' },
  { name: 'Amethyst Purple', color: '#8b5cf6', hover: '#7c3aed', glow: 'rgba(139, 92, 246, 0.4)' },
  { name: 'Electric Crimson', color: '#f43f5e', hover: '#e11d48', glow: 'rgba(244, 63, 94, 0.4)' },
  { name: 'Amber Gold', color: '#f59e0b', hover: '#d97706', glow: 'rgba(245, 158, 11, 0.4)' },
  { name: 'Neon Pink', color: '#ec4899', hover: '#db2777', glow: 'rgba(236, 72, 153, 0.4)' },
  { name: 'Teal Ocean', color: '#14b8a6', hover: '#0d9488', glow: 'rgba(20, 184, 166, 0.4)' },
  { name: 'Cyber Sunset', color: '#ff5e36', hover: '#e04822', glow: 'rgba(255, 94, 54, 0.4)' },
  { name: 'Obsidian Slate', color: '#64748b', hover: '#475569', glow: 'rgba(100, 116, 139, 0.4)' },
];

export const RADIUS_PRESETS = [
  { id: 'sharp', label: 'Sharp Modern', class: 'rounded-md', px: '6px' },
  { id: 'standard', label: 'Standard', class: 'rounded-xl', px: '12px' },
  { id: 'balanced', label: 'Balanced Frosted', class: 'rounded-2xl', px: '16px' },
  { id: 'soft', label: 'Ultra Soft', class: 'rounded-3xl', px: '24px' },
  { id: 'pill', label: 'Pill Radius', class: 'rounded-full', px: '9999px' },
] as const;

export const BG_SOLID_PRESETS = [
  { name: 'Deep Slate (Default)', color: '#090d16' },
  { name: 'Pitch Black', color: '#000000' },
  { name: 'Midnight Onyx', color: '#0b0f19' },
  { name: 'Cyber Navy', color: '#0a1128' },
  { name: 'Deep Plum', color: '#13091f' },
  { name: 'Dark Emerald', color: '#061410' },
  { name: 'Warm Espresso', color: '#180e0a' },
  { name: 'Soft Light', color: '#f8fafc' },
];

export const BG_GRADIENT_PRESETS = [
  { id: 'aurora', name: 'Aurora Borealis', css: 'radial-gradient(ellipse at top left, #0f172a, #090d16 60%), radial-gradient(at bottom right, rgba(16, 185, 129, 0.2), transparent 70%)' },
  { id: 'cosmic', name: 'Cosmic Nebula', css: 'radial-gradient(circle at 50% 20%, #1e1b4b, #090d16 70%), radial-gradient(at 80% 80%, rgba(236, 72, 153, 0.25), transparent 50%)' },
  { id: 'glacier', name: 'Frosted Glacier', css: 'radial-gradient(ellipse at 50% 0%, #1e293b, #090d16 75%), radial-gradient(at 10% 90%, rgba(56, 189, 248, 0.25), transparent 50%)' },
  { id: 'sunset', name: 'Cyber Sunset', css: 'radial-gradient(ellipse at 80% 10%, #31121d, #090d16 70%), radial-gradient(at 20% 90%, rgba(245, 158, 11, 0.2), transparent 50%)' },
  { id: 'matrix', name: 'Midnight Matrix', css: 'radial-gradient(circle at 30% 20%, #064e3b, #090d16 75%), radial-gradient(at 90% 80%, rgba(16, 185, 129, 0.15), transparent 50%)' },
] as const;

export const BG_IMAGE_PRESETS = [
  { name: 'Deep Space Nebula', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1600' },
  { name: 'Frosted Crystal', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600' },
  { name: 'Neon Cyber Grid', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1600' },
  { name: 'Abstract Dark Waves', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1600' },
  { name: 'Starfield Void', url: 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?q=80&w=1600' },
];

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  accentColor: '#2563eb',
  accentHover: '#1d4ed8',
  accentGlow: 'rgba(37, 99, 235, 0.4)',
  radius: 'balanced',
  bgMode: 'solid',
  bgSolidColor: '#090d16',
  bgGradientPreset: 'aurora',
  bgImageUrl: '',
  bgBlur: 0,
  bgOverlayOpacity: 0.5,
};

export function useThemeConfig() {
  const [config, setConfig] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem('frosted_theme_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_THEME_CONFIG, ...parsed };
      }
    } catch {}
    return DEFAULT_THEME_CONFIG;
  });

  // Apply CSS Custom Variables to document Root whenever theme changes
  useEffect(() => {
    try {
      localStorage.setItem('frosted_theme_config', JSON.stringify(config));
    } catch {}

    const root = document.documentElement;

    // Accent Color custom properties
    root.style.setProperty('--brand-blue', config.accentColor);
    root.style.setProperty('--brand-blue-hover', config.accentHover);
    root.style.setProperty('--brand-blue-glow', config.accentGlow);

    // Border Radius mapping
    const radPreset = RADIUS_PRESETS.find((r) => r.id === config.radius);
    root.style.setProperty('--app-radius', radPreset ? radPreset.px : '16px');

    // Dark Background configuration
    root.style.setProperty('--bg-dark-base', config.bgSolidColor || '#090d16');
  }, [config]);

  const updateConfig = useCallback((partial: Partial<ThemeConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...partial };
      // Auto-compute hover color if accentColor is changed manually
      if (partial.accentColor && !partial.accentHover) {
        updated.accentHover = partial.accentColor;
        updated.accentGlow = `${partial.accentColor}66`;
      }
      return updated;
    });
  }, []);

  const resetTheme = useCallback(() => {
    setConfig(DEFAULT_THEME_CONFIG);
  }, []);

  return {
    config,
    updateConfig,
    resetTheme,
  };
}
