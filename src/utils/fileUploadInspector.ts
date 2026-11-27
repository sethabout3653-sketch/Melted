export type UploadFileKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'archive'
  | 'binary';

export interface PreparedFileAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
  kind: UploadFileKind;
  previewImageUrls: string[];
  fileDataUrl?: string;
  extractedText?: string;
  binarySummary?: string;
  modelNote?: string;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'xml', 'html', 'htm',
  'css', 'scss', 'less', 'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'py', 'rb',
  'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh',
  'ps1', 'sql', 'yaml', 'yml', 'toml', 'ini', 'conf', 'cfg', 'env', 'log', 'svg',
  'gitignore', 'dockerfile', 'makefile', 'srt', 'vtt', 'rtf', 'tex', 'bat', 'cmd',
  'properties', 'gradle', 'kt', 'swift', 'lua', 'r', 'pl', 'asm', 'vue', 'svelte',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'avif', 'heic', 'heif', 'tiff', 'tif',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'm4v', 'webm', 'mov', 'avi', 'mkv', 'mpeg', 'mpg', '3gp', 'ogv', 'flv', 'wmv',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba', 'wma', 'aiff',
]);

const ZIP_ARCHIVE_EXTENSIONS = new Set([
  'zip', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'apk', 'jar', 'war', 'ear', 'epub', 'xpi', 'ipa', 'cbz',
]);

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() || '';
  const idx = base.lastIndexOf('.');
  return idx !== -1 ? base.slice(idx + 1).toLowerCase() : '';
}

function detectMagicSignature(bytes: Uint8Array): string {
  if (bytes.length < 4) return 'Small/Empty file';
  const hex4 = Array.from(bytes.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const ascii4 = String.fromCharCode(...bytes.slice(0, 4));
  const ascii8 = bytes.length >= 8 ? String.fromCharCode(...bytes.slice(4, 8)) : '';

  if (ascii4 === '%PDF') return 'PDF Document (%PDF)';
  if (hex4 === '504B0304' || hex4 === '504B0506') return 'ZIP / Office / APK / JAR Container (PK)';
  if (hex4 === '89504E47') return 'PNG Image';
  if (hex4.startsWith('FFD8FF')) return 'JPEG Image';
  if (ascii4 === 'GIF8') return 'GIF Image';
  if (ascii4 === 'RIFF' && bytes.length >= 12) {
    return `RIFF Container (${String.fromCharCode(...bytes.slice(8, 12))})`;
  }
  if (
    ascii4.startsWith('ID3') ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return 'MP3 / MPEG Audio';
  }
  if (ascii8 === 'ftyp') return 'ISO Base Media / MP4 / M4A / MOV Container';
  if (hex4 === '1A45DFA3') return 'Matroska / WebM Video Container';
  if (ascii4 === 'OggS') return 'Ogg Media Container';
  if (ascii4 === 'fLaC') return 'FLAC Lossless Audio';
  if (hex4 === '0061736D') return 'WebAssembly Binary (.wasm)';
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return 'Windows PE Executable / DLL (MZ)';
  if (hex4 === '7F454C46') return 'Linux ELF Executable / Shared Object';
  if (hex4 === '377ABCAF') return '7-Zip Archive';
  if (ascii4 === 'Rar!') return 'RAR Archive';
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return 'GZIP Compressed Archive';
  if (ascii4 === 'BZh9' || ascii4.startsWith('BZh')) return 'BZIP2 Compressed Archive';
  if (hex4 === 'FD377A58') return 'XZ Compressed Archive';
  if (bytes.length >= 15 && String.fromCharCode(...bytes.slice(0, 15)) === 'SQLite format 3') {
    return 'SQLite 3 Database';
  }
  if (ascii4 === 'NES\x1a') return 'NES ROM Image (iNES)';
  return `Binary (header hex: ${Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')})`;
}

function isLikelyTextBytes(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return true;
  let controlCount = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 32 && b !== 9 && b !== 10 && b !== 13) controlCount++;
  }
  return controlCount / bytes.length < 0.05;
}

function extractPrintableStrings(bytes: Uint8Array, maxChars = 4000): string {
  let current = '';
  const found: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      current += String.fromCharCode(b);
    } else {
      if (current.length >= 5) {
        found.push(current);
        totalChars += current.length + 3;
        if (totalChars >= maxChars || found.length >= 120) break;
      }
      current = '';
    }
  }
  if (current.length >= 5 && totalChars < maxChars) {
    found.push(current);
  }
  return found.join(' | ').slice(0, maxChars);
}

async function readSliceAsBytes(file: File, start: number, end: number): Promise<Uint8Array> {
  const safeStart = Math.max(0, Math.min(start, file.size));
  const safeEnd = Math.max(safeStart, Math.min(end, file.size));
  const buf = await file.slice(safeStart, safeEnd).arrayBuffer();
  return new Uint8Array(buf);
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read file bytes.'));
    reader.readAsDataURL(blob);
  });
}

async function compressOrReadImage(file: File): Promise<{ previewUrls: string[]; dimensions?: string }> {
  const mime = (file.type || '').toLowerCase();
  const isDirectVisionSupported =
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime) &&
    file.size <= 8 * 1024 * 1024;

  // Try loading image via object URL so we get dimensions & can resize oversized images (e.g. 50MB+ PNG/BMP/TIFF)
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Browser image decode failed'));
      el.src = objectUrl;
    });

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const dimensions = width && height ? `${width}x${height}` : undefined;

    if (isDirectVisionSupported) {
      const directDataUrl = await readBlobAsDataUrl(file);
      return { previewUrls: directDataUrl ? [directDataUrl] : [], dimensions };
    }

    const maxDim = 2048;
    const scale = width > maxDim || height > maxDim ? Math.min(maxDim / width, maxDim / height) : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (file.size <= 15 * 1024 * 1024) {
        return { previewUrls: [await readBlobAsDataUrl(file)], dimensions };
      }
      return { previewUrls: [], dimensions };
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.88);
    return { previewUrls: [jpegUrl], dimensions };
  } catch {
    // Non-browser-decodable image (e.g., HEIC/RAW/corrupt): still attach if small enough, else binary summary handles it
    if (file.size <= 10 * 1024 * 1024 && mime.startsWith('image/')) {
      try {
        return { previewUrls: [await readBlobAsDataUrl(file)] };
      } catch {}
    }
    return { previewUrls: [] };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function extractVideoKeyframes(file: File): Promise<{ frames: string[]; metadata: string }> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Video metadata timeout')), 12000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Unsupported video codec in browser'));
      };
      video.src = objectUrl;
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    const metadata = `Video resolution: ${width}x${height}, Duration: ${duration ? `${duration.toFixed(1)}s` : 'unknown'}`;

    if (!width || !height) {
      return { frames: [], metadata };
    }

    const canvas = document.createElement('canvas');
    const maxW = 960;
    const scale = width > maxW ? maxW / width : 1;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { frames: [], metadata };

    const sampleRatios = duration > 1 ? [0.05, 0.25, 0.5, 0.75, 0.92] : [0];
    const frames: string[] = [];

    for (const ratio of sampleRatios) {
      const targetTime = Math.min(Math.max(0, duration * ratio), Math.max(0, duration - 0.1));
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        const timer = setTimeout(finish, 3000);
        video.onseeked = () => {
          clearTimeout(timer);
          finish();
        };
        try {
          video.currentTime = targetTime;
        } catch {
          clearTimeout(timer);
          finish();
        }
      });
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (frameUrl && frameUrl.length > 100) {
          frames.push(frameUrl);
        }
      } catch {}
    }

    return { frames, metadata };
  } catch {
    return { frames: [], metadata: 'Browser video decoder unavailable for this codec/container.' };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

async function getAudioDurationMetadata(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Audio metadata timeout')), 5000);
      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      audio.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Audio metadata error'));
      };
      audio.src = objectUrl;
    });
    const dur = Number.isFinite(audio.duration) ? `${audio.duration.toFixed(1)}s` : 'unknown';
    return `Audio duration: ${dur}`;
  } catch {
    return '';
  } finally {
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(objectUrl);
  }
}

async function parseZipEntries(file: File): Promise<{ entryCount: number; entries: string[] } | null> {
  try {
    // ZIP End of Central Directory is within the last ~66 KB of the file (even for multi-GB ZIPs)
    const tailSize = Math.min(file.size, 66 * 1024);
    const tailStart = file.size - tailSize;
    const tailBytes = await readSliceAsBytes(file, tailStart, file.size);
    const view = new DataView(tailBytes.buffer, tailBytes.byteOffset, tailBytes.byteLength);

    let eocdOffset = -1;
    for (let i = tailBytes.length - 22; i >= 0; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) return null;

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    if (cdSize === 0 || cdSize > 25 * 1024 * 1024 || cdOffset >= file.size) {
      return { entryCount: totalEntries, entries: [] };
    }

    const cdBytes = await readSliceAsBytes(file, cdOffset, Math.min(file.size, cdOffset + Math.min(cdSize, 2 * 1024 * 1024)));
    const cdView = new DataView(cdBytes.buffer, cdBytes.byteOffset, cdBytes.byteLength);
    const decoder = new TextDecoder('utf-8', { fatal: false });

    const entries: string[] = [];
    let pos = 0;
    while (pos + 46 <= cdBytes.length && entries.length < 150) {
      if (cdView.getUint32(pos, true) !== 0x02014b50) break;
      const compSize = cdView.getUint32(pos + 20, true);
      const uncompSize = cdView.getUint32(pos + 24, true);
      const nameLen = cdView.getUint16(pos + 28, true);
      const extraLen = cdView.getUint16(pos + 30, true);
      const commentLen = cdView.getUint16(pos + 32, true);

      if (pos + 46 + nameLen > cdBytes.length) break;
      const name = decoder.decode(cdBytes.slice(pos + 46, pos + 46 + nameLen));
      entries.push(`${name} (${formatFileSize(uncompSize)}, compressed ${formatFileSize(compSize)})`);
      pos += 46 + nameLen + extraLen + commentLen;
    }

    return { entryCount: totalEntries, entries };
  } catch {
    return null;
  }
}

async function extractTextSample(file: File): Promise<string> {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  if (file.size <= 64 * 1024) {
    const bytes = await readSliceAsBytes(file, 0, file.size);
    return decoder.decode(bytes);
  }
  const headBytes = await readSliceAsBytes(file, 0, 42 * 1024);
  const tailBytes = await readSliceAsBytes(file, file.size - 16 * 1024, file.size);
  const headText = decoder.decode(headBytes);
  const tailText = decoder.decode(tailBytes);
  return `${headText}\n\n... [TRUNCATED MIDDLE OF ${formatFileSize(file.size)} FILE] ...\n\n${tailText}`;
}

async function extractPdfFallbackSample(file: File): Promise<string> {
  const headBytes = await readSliceAsBytes(file, 0, Math.min(file.size, 256 * 1024));
  const tailBytes = file.size > 256 * 1024 ? await readSliceAsBytes(file, Math.max(0, file.size - 64 * 1024), file.size) : new Uint8Array(0);
  const headAscii = extractPrintableStrings(headBytes, 3500);
  const tailAscii = tailBytes.length ? extractPrintableStrings(tailBytes, 1500) : '';
  return [
    `PDF Header Strings:\n${headAscii}`,
    tailAscii ? `PDF Tail Strings:\n${tailAscii}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function prepareFileForOpenRouter(file: File): Promise<PreparedFileAttachment> {
  const fileName = file.name || 'uploaded-file';
  const ext = getExtension(fileName);
  const reportedMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const sizeBytes = file.size;
  const sizeFormatted = formatFileSize(sizeBytes);

  const headSample = await readSliceAsBytes(file, 0, Math.min(sizeBytes, 8192));
  const tailSample = sizeBytes > 8192 ? await readSliceAsBytes(file, Math.max(0, sizeBytes - 512), sizeBytes) : new Uint8Array(0);
  const magicSig = detectMagicSignature(headSample);

  const isSvg = reportedMime === 'image/svg+xml' || ext === 'svg';
  const isImage = !isSvg && (reportedMime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext));
  const isVideo = reportedMime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext);
  const isAudio = reportedMime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext);
  const isPdf = reportedMime === 'application/pdf' || ext === 'pdf' || magicSig.startsWith('PDF Document');
  const isZip = ZIP_ARCHIVE_EXTENSIONS.has(ext) || magicSig.startsWith('ZIP / Office');
  const isText =
    isSvg ||
    reportedMime.startsWith('text/') ||
    reportedMime === 'application/json' ||
    reportedMime === 'application/xml' ||
    reportedMime === 'application/javascript' ||
    TEXT_EXTENSIONS.has(ext) ||
    (!isImage && !isVideo && !isAudio && !isPdf && !isZip && isLikelyTextBytes(headSample));

  const hexHead = Array.from(headSample.slice(0, 128))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

  if (isImage) {
    const { previewUrls, dimensions } = await compressOrReadImage(file);
    return {
      fileName,
      mimeType: reportedMime || (ext ? `image/${ext}` : 'image/png'),
      sizeBytes,
      sizeFormatted,
      kind: 'image',
      previewImageUrls: previewUrls,
      binarySummary: `File: ${fileName} | Size: ${sizeFormatted} (${sizeBytes} bytes) | Signature: ${magicSig}${dimensions ? ` | Dimensions: ${dimensions}` : ''}`,
    };
  }

  if (isVideo) {
    const { frames, metadata } = await extractVideoKeyframes(file);
    const printable = extractPrintableStrings(headSample, 1200);
    // Pass raw video data URL too if <= 10 MB so native video-capable OpenRouter models can inspect motion/audio directly, alongside keyframes
    let fileDataUrl: string | undefined;
    if (sizeBytes <= 10 * 1024 * 1024 && (reportedMime === 'video/mp4' || reportedMime === 'video/webm' || ext === 'mp4' || ext === 'webm')) {
      try {
        fileDataUrl = await readBlobAsDataUrl(file);
      } catch {}
    }
    return {
      fileName,
      mimeType: reportedMime || (ext ? `video/${ext}` : 'video/mp4'),
      sizeBytes,
      sizeFormatted,
      kind: 'video',
      previewImageUrls: frames,
      fileDataUrl,
      binarySummary: `File: ${fileName} | Size: ${sizeFormatted} (${sizeBytes} bytes) | Signature: ${magicSig} | ${metadata}${printable ? `\nContainer strings: ${printable}` : ''}`,
    };
  }

  if (isAudio) {
    const durationMeta = await getAudioDurationMetadata(file);
    const printable = extractPrintableStrings(headSample, 1500);
    let fileDataUrl: string | undefined;
    if (sizeBytes <= 8 * 1024 * 1024 && (reportedMime === 'audio/mpeg' || reportedMime === 'audio/wav' || ext === 'mp3' || ext === 'wav')) {
      try {
        fileDataUrl = await readBlobAsDataUrl(file);
      } catch {}
    }
    return {
      fileName,
      mimeType: reportedMime || (ext ? `audio/${ext}` : 'audio/mpeg'),
      sizeBytes,
      sizeFormatted,
      kind: 'audio',
      previewImageUrls: [],
      fileDataUrl,
      binarySummary: `File: ${fileName} | Size: ${sizeFormatted} (${sizeBytes} bytes) | Signature: ${magicSig}${durationMeta ? ` | ${durationMeta}` : ''}${printable ? `\nTags / Header strings: ${printable}` : ''}`,
    };
  }

  if (isPdf) {
    let fileDataUrl: string | undefined;
    if (sizeBytes <= 12 * 1024 * 1024) {
      try {
        fileDataUrl = await readBlobAsDataUrl(file);
      } catch {}
    }
    const extractedText = await extractPdfFallbackSample(file);
    return {
      fileName,
      mimeType: 'application/pdf',
      sizeBytes,
      sizeFormatted,
      kind: 'pdf',
      previewImageUrls: [],
      fileDataUrl,
      extractedText,
      binarySummary: `File: ${fileName} | Size: ${sizeFormatted} (${sizeBytes} bytes) | Signature: ${magicSig}`,
    };
  }

  if (isText) {
    const extractedText = await extractTextSample(file);
    return {
      fileName,
      mimeType: reportedMime || (isSvg ? 'image/svg+xml' : 'text/plain'),
      sizeBytes,
      sizeFormatted,
      kind: 'text',
      previewImageUrls: [],
      extractedText,
      binarySummary: `File: ${fileName} | Size: ${sizeFormatted} (${sizeBytes} bytes) | Type: ${reportedMime || ext || 'text'}`,
    };
  }

  if (isZip) {
    const zipInfo = await parseZipEntries(file);
    const printable = extractPrintableStrings(headSample, 1800);
    const entryListing = zipInfo?.entries.length
      ? `Archive Entries (${zipInfo.entryCount} total):\n${zipInfo.entries.join('\n')}`
      : `Archive total entries reported: ${zipInfo?.entryCount ?? 'unknown'}`;
    return {
      fileName,
      mimeType: reportedMime || 'application/zip',
      sizeBytes,
      sizeFormatted,
      kind: 'archive',
      previewImageUrls: [],
      extractedText: entryListing,
      binarySummary: `File: ${fileName} | Size: ${sizeFormatted} (${sizeBytes} bytes) | Signature: ${magicSig}${printable ? `\nHeader strings: ${printable}` : ''}`,
    };
  }

  const headStrings = extractPrintableStrings(headSample, 2500);
  const tailStrings = tailSample.length ? extractPrintableStrings(tailSample, 1000) : '';
  return {
    fileName,
    mimeType: reportedMime || 'application/octet-stream',
    sizeBytes,
    sizeFormatted,
    kind: 'binary',
    previewImageUrls: [],
    binarySummary: [
      `File: ${fileName}`,
      `MIME Type: ${reportedMime || 'application/octet-stream'}`,
      `Size: ${sizeFormatted} (${sizeBytes} bytes)`,
      `Magic Signature: ${magicSig}`,
      `First 128 bytes (hex): ${hexHead}`,
      headStrings ? `Header printable strings: ${headStrings}` : '',
      tailStrings ? `Tail printable strings: ${tailStrings}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
