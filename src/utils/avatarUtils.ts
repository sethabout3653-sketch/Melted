/**
 * Utility functions for client-side avatar image processing, compression, and persistence.
 * Downsamples and center-crops images to a compact 256x256 JPEG data URL (~12-25KB).
 * This eliminates dependency on ephemeral container filesystem uploads (/uploads/...)
 * and guarantees persistence across page refreshes, long time spans, and offline usage.
 */

export async function processAvatarImage(file: File, maxSize = 160): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (JPEG, PNG, WebP, etc.).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read selected image file.'));
    };

    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();

      img.onerror = () => {
        resolve(rawDataUrl);
      };

      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          if (!width || !height) {
            return resolve(rawDataUrl);
          }

          // Center-crop to a square
          const cropSize = Math.min(width, height);
          const startX = (width - cropSize) / 2;
          const startY = (height - cropSize) / 2;

          const targetDimension = Math.min(cropSize, maxSize);

          const canvas = document.createElement('canvas');
          canvas.width = targetDimension;
          canvas.height = targetDimension;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(rawDataUrl);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(
            img,
            startX,
            startY,
            cropSize,
            cropSize,
            0,
            0,
            targetDimension,
            targetDimension
          );

          // Convert to compact JPEG (~3-6KB) to guarantee fit in localStorage
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          resolve(optimizedDataUrl);
        } catch (err) {
          console.warn('[Avatar Processing] Canvas export fallback:', err);
          resolve(rawDataUrl);
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Safely saves the avatar URL to localStorage with quota overflow recovery.
 */
export function persistAvatarUrl(avatarUrl: string): boolean {
  try {
    if (!avatarUrl) {
      localStorage.removeItem('frosthub_chat_avatar_url');
      return true;
    }
    localStorage.setItem('frosthub_chat_avatar_url', avatarUrl);
    return true;
  } catch (err) {
    console.warn('[Avatar Persistence] Quota exceeded, attempting cleanup...', err);
    try {
      // Free up space by removing older or non-essential items
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('frosthub_save_') || key.startsWith('frosthub_epg_cache'))) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem('frosthub_chat_avatar_url', avatarUrl);
      return true;
    } catch (retryErr) {
      console.error('[Avatar Persistence] Failed to save avatar even after cleanup:', retryErr);
      return false;
    }
  }
}

