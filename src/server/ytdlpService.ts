import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export interface YtDlpResult {
  audioUrl: string | null;
  videoUrl: string | null;
  title?: string;
  artist?: string;
  duration?: number;
}

/**
 * yt-dlp Service Utility: Minimal, fast-failing extraction
 */
export async function getStreamUrlWithYtDlp(videoIdOrUrl: string, isVideo: boolean = false): Promise<string | null> {
  const target = videoIdOrUrl.startsWith('http') 
    ? videoIdOrUrl 
    : `https://www.youtube.com/watch?v=${videoIdOrUrl}`;

  // Simplest command possible
  const cookiesFlag = fs.existsSync('cookies.txt') ? '--cookies cookies.txt' : '';
  const cmd = `yt-dlp -g ${cookiesFlag} --no-warnings --no-check-certificates "${target}"`;

  try {
    // Fail fast with a 5s timeout
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    
    if (stdout) {
      const urls = stdout.trim().split('\n').filter(Boolean);
      // If it's a video, usually the best quality is the last one
      return isVideo ? (urls.length > 1 ? urls[urls.length - 1] : urls[0]) : urls[0];
    }
  } catch (err: any) {
    console.warn(`[yt-dlp fast-fail extraction]:`, err?.message || err);
  }

  return null;
}

export async function getMetadataWithYtDlp(videoIdOrUrl: string): Promise<any | null> {
  const target = videoIdOrUrl.startsWith('http') 
    ? videoIdOrUrl 
    : `https://www.youtube.com/watch?v=${videoIdOrUrl}`;

  const cookiesFlag = fs.existsSync('cookies.txt') ? '--cookies cookies.txt' : '';

  try {
    const cmd = `yt-dlp --dump-json ${cookiesFlag} --no-warnings --no-check-certificates "${target}"`;
    const { stdout } = await execAsync(cmd, { timeout: 8000 });
    if (stdout) {
      const info = JSON.parse(stdout);
      return {
        id: info.id,
        videoId: info.id,
        title: info.title || 'YouTube Track',
        artist: info.uploader || info.artist || 'YouTube Artist',
        album: info.album || 'YouTube Music',
        duration: Number(info.duration) || 210,
        coverUrl: info.thumbnail || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
        genre: info.genre || 'music',
        vibe: 'extracted via yt-dlp',
        source: 'youtube',
      };
    }
  } catch (err: any) {
    console.warn(`[yt-dlp metadata warning]:`, err?.message || err);
  }

  return null;
}
