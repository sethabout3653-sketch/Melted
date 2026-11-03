import { useState, useEffect, useCallback } from 'react';
import { 
  FontConfig, 
  DEFAULT_FONT_CONFIG, 
  getSavedFontConfig, 
  saveFontConfig, 
  saveCustomFontData, 
  deleteCustomFontData,
  applyFontConfig 
} from '../services/fontStorage';

export function useFontConfig() {
  const [fontConfig, setFontConfigState] = useState<FontConfig>(() => getSavedFontConfig());
  const [isApplying, setIsApplying] = useState(false);

  // Apply font to DOM whenever config changes
  useEffect(() => {
    applyFontConfig(fontConfig);
    saveFontConfig(fontConfig);
  }, [fontConfig]);

  const updateFontConfig = useCallback((partial: Partial<FontConfig>) => {
    setFontConfigState((prev) => {
      const next = { ...prev, ...partial };
      return next;
    });
  }, []);

  const uploadCustomFontFile = useCallback(async (file: File): Promise<void> => {
    setIsApplying(true);
    try {
      const lowerName = file.name.toLowerCase();
      const isTtf = lowerName.endsWith('.ttf');
      const isOtf = lowerName.endsWith('.otf');

      if (!isTtf && !isOtf) {
        throw new Error('Please upload a valid .ttf or .otf font file.');
      }

      const format: 'truetype' | 'opentype' = isOtf ? 'opentype' : 'truetype';
      const mimeType = isOtf ? 'font/otf' : 'font/ttf';

      // Read file as base64 data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read font file'));
        reader.readAsDataURL(file);
      });

      await saveCustomFontData(dataUrl, file.name);

      const nextConfig: FontConfig = {
        preset: 'custom',
        modernCleanBody: fontConfig.modernCleanBody,
        modernCleanWeight: fontConfig.modernCleanWeight,
        customFontName: file.name,
        customFontFormat: format,
      };

      setFontConfigState(nextConfig);
      await applyFontConfig(nextConfig);
    } finally {
      setIsApplying(false);
    }
  }, [fontConfig.modernCleanBody, fontConfig.modernCleanWeight]);

  const resetToDefaultFont = useCallback(async () => {
    await deleteCustomFontData();
    const defaultConfig: FontConfig = { ...DEFAULT_FONT_CONFIG };
    setFontConfigState(defaultConfig);
    await applyFontConfig(defaultConfig);
  }, []);

  return {
    fontConfig,
    updateFontConfig,
    uploadCustomFontFile,
    resetToDefaultFont,
    isApplying,
  };
}
