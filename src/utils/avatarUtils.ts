/**
 * Utility functions for client-side avatar image processing, compression, and persistence.
 * Downsamples and center-crops images to a compact 256x256 JPEG data URL (~12-25KB).
 * This eliminates dependency on ephemeral container filesystem uploads (/uploads/...)
 * and guarantees persistence across page refreshes, long time spans, and offline usage.
 */

export async function processAvatarImage(file: File, maxSize = 256): Promise<string> {
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
        // Fallback to raw data url if decoding fails
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

          // Target dimensions (max 256px for high-res retina display while keeping file ~15KB)
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

          // Draw the square cropped area
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

          // Convert to JPEG with quality 0.88 (~12-25KB, universally supported, fits in localStorage)
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
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
 * Safely saves the avatar URL to localStorage.
 * Handles potential QuotaExceededError and verifies validity.
 */
export function persistAvatarUrl(avatarUrl: string): boolean {
  try {
    if (!avatarUrl) {
      localStorage.removeItem('frosted_chat_avatar_url');
      return true;
    }
    localStorage.setItem('frosted_chat_avatar_url', avatarUrl);
    return true;
  } catch (err) {
    console.warn('[Avatar Persistence] localStorage save warning:', err);
    return false;
  }
}
