// Font Configuration and Storage Engine for Frosted

export type FontPresetId = 'default' | 'modern-clean' | 'custom';
export type ModernCleanBodyFont = 'plus-jakarta' | 'inter' | 'dm-sans';
export type ModernCleanHeadingWeight = '700' | '900'; // Bold or Black

export interface FontConfig {
  preset: FontPresetId;
  modernCleanBody: ModernCleanBodyFont;
  modernCleanWeight: ModernCleanHeadingWeight;
  customFontName?: string;
  customFontFormat?: 'truetype' | 'opentype';
}

export const DEFAULT_FONT_CONFIG: FontConfig = {
  preset: 'modern-clean',
  modernCleanBody: 'plus-jakarta',
  modernCleanWeight: '700',
};

const FONT_CONFIG_KEY = 'frosted_font_config';
const FONT_DATA_KEY = 'frosted_custom_font_data';
const STYLE_TAG_ID = 'frosted-custom-font-style';

// Open or create IndexedDB for storing font files reliably
function openFontDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open('frosted_font_store', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('fonts')) {
        db.createObjectStore('fonts');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Store custom font data (ArrayBuffer or data URL) in IndexedDB
export async function saveCustomFontData(fontData: string, filename: string): Promise<void> {
  try {
    const db = await openFontDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('fonts', 'readwrite');
      const store = tx.objectStore('fonts');
      store.put(fontData, 'active_font_data');
      store.put(filename, 'active_font_name');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // LocalStorage fallback (if < 3MB)
    try {
      localStorage.setItem(FONT_DATA_KEY, fontData);
    } catch (e) {
      console.warn('Font storage fallback warning:', e);
    }
  }
}

// Retrieve custom font data from IndexedDB or LocalStorage fallback
export async function getCustomFontData(): Promise<string | null> {
  try {
    const db = await openFontDb();
    const result = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction('fonts', 'readonly');
      const store = tx.objectStore('fonts');
      const req = store.get('active_font_data');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (result) return result;
  } catch {
    // Fallback
  }

  try {
    return localStorage.getItem(FONT_DATA_KEY);
  } catch {
    return null;
  }
}

// Clear custom font data
export async function deleteCustomFontData(): Promise<void> {
  try {
    const db = await openFontDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('fonts', 'readwrite');
      const store = tx.objectStore('fonts');
      store.delete('active_font_data');
      store.delete('active_font_name');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}

  try {
    localStorage.removeItem(FONT_DATA_KEY);
  } catch {}
}

// Get saved font configuration
export function getSavedFontConfig(): FontConfig {
  try {
    const raw = localStorage.getItem(FONT_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_FONT_CONFIG, ...parsed };
    }
  } catch {}
  return DEFAULT_FONT_CONFIG;
}

// Save font configuration
export function saveFontConfig(config: FontConfig): void {
  try {
    localStorage.setItem(FONT_CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

// Apply font settings directly to document root & dynamic style tag
export async function applyFontConfig(config: FontConfig): Promise<void> {
  const root = document.documentElement;
  let styleTag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;

  if (config.preset === 'default') {
    root.style.setProperty('--app-font-family', "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif");
    root.style.setProperty('--app-font-heading', "'Outfit', sans-serif");
    root.style.setProperty('--app-font-heading-weight', '700');
    document.body.classList.remove('font-custom', 'font-modern-clean');

    if (styleTag) {
      styleTag.textContent = '';
    }
    return;
  }

  if (config.preset === 'modern-clean') {
    const bodyFont = config.modernCleanBody === 'dm-sans'
      ? "'DM Sans', 'Inter', system-ui, sans-serif"
      : config.modernCleanBody === 'inter'
      ? "'Inter', system-ui, sans-serif"
      : "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
    const headingWeight = config.modernCleanWeight === '900' ? '900' : '700';

    root.style.setProperty('--app-font-family', bodyFont);
    root.style.setProperty('--app-font-heading', "'Outfit', sans-serif");
    root.style.setProperty('--app-font-heading-weight', headingWeight);

    document.body.classList.remove('font-custom');
    document.body.classList.add('font-modern-clean');

    if (styleTag) {
      styleTag.textContent = '';
    }
    return;
  }

  if (config.preset === 'custom') {
    const fontData = await getCustomFontData();
    if (!fontData) {
      // Fallback to default if no custom data exists
      applyFontConfig({ ...config, preset: 'default' });
      return;
    }

    const format = config.customFontFormat || 'truetype';

    // Inject @font-face style rule
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = STYLE_TAG_ID;
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
      @font-face {
        font-family: 'AppCustomFont';
        src: url('${fontData}') format('${format}');
        font-weight: 100 900;
        font-style: normal;
        font-display: swap;
      }
    `;

    // Also attempt FontFace API registration for instant rendering
    try {
      if (typeof FontFace !== 'undefined') {
        const fontFace = new FontFace('AppCustomFont', `url(${fontData})`);
        await fontFace.load();
        document.fonts.add(fontFace);
      }
    } catch (e) {
      console.warn('FontFace API registration fallback:', e);
    }

    root.style.setProperty('--app-font-family', "'AppCustomFont', system-ui, sans-serif");
    root.style.setProperty('--app-font-heading', "'AppCustomFont', system-ui, sans-serif");
    root.style.setProperty('--app-font-heading-weight', '700');

    document.body.classList.add('font-custom');
    document.body.classList.remove('font-modern-clean');
  }
}
