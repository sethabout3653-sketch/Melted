import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { Readable } from 'stream';
import { TV_CHANNELS } from '../data/channels';

export function initSethsrcEngine(app: express.Express, baseDir: string) {
  const hlsOutputDir = path.resolve(baseDir, 'hls_output');
  if (!fs.existsSync(hlsOutputDir)) {
    fs.mkdirSync(hlsOutputDir, { recursive: true });
  }

  // 1. Expose the HLS Stream Directory (/stream)
  app.use('/stream', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  }, express.static(hlsOutputDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  }));

  // 2. Stream Router / Reverse Proxy (/api/proxy-stream)
  app.get('/api/proxy-stream', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send('Missing target URL');
    }

    try {
      const parsedUrl = new URL(targetUrl);
      const customReferer = (req.query.referer as string) || parsedUrl.origin;

      let upstreamResponse = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': customReferer,
          'Origin': customReferer,
          'Accept': '*/*',
        }
      });

      if (!upstreamResponse.ok && (targetUrl.includes('tooneast') || targetUrl.includes('cartoon'))) {
        const fallbackUrl = 'https://turnerlive.warnermediacdn.com/hls/live/2023183/aseast/noslate/VIDEO_1_5128000.m3u8';
        upstreamResponse = await fetch(fallbackUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*',
          }
        });
      }

      if (!upstreamResponse.ok) {
        return res.status(upstreamResponse.status).send(`Upstream returned status ${upstreamResponse.status}`);
      }

      const effectiveUrl = upstreamResponse.url || targetUrl;
      const lowerUrl = effectiveUrl.toLowerCase();
      const rawContentType = (upstreamResponse.headers.get('content-type') || '').toLowerCase();

      // Check if this is a binary media fragment, audio, or encryption key
      const isMediaOrKey = lowerUrl.includes('.ts') ||
                           lowerUrl.includes('.key') ||
                           lowerUrl.includes('.m4s') ||
                           lowerUrl.includes('.mp4') ||
                           lowerUrl.includes('.aac');

      const isPlaylist = !isMediaOrKey && (
        lowerUrl.includes('.m3u8') ||
        lowerUrl.includes('playlist') ||
        lowerUrl.includes('master') ||
        rawContentType.includes('mpegurl')
      );

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (isPlaylist) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        const text = await upstreamResponse.text();

        const nonEnglishPatterns = [
          'es', 'spa', 'spanish', 'español', 'castellano',
          'fr', 'fra', 'french', 'français',
          'de', 'deu', 'ger', 'german', 'deutsch',
          'it', 'ita', 'italian', 'italiano',
          'pt', 'por', 'portuguese', 'português',
          'ru', 'rus', 'russian',
          'ar', 'ara', 'arabic',
          'zh', 'zho', 'chi', 'chinese',
          'hi', 'hin', 'hindi',
          'ja', 'jpn', 'japanese',
          'ko', 'kor', 'korean',
          'nl', 'nld', 'dut', 'dutch',
          'pl', 'pol', 'polish',
          'tr', 'tur', 'turkish',
          'vi', 'vie', 'vietnamese'
        ];

        const isNonEnglishAudio = (line: string) => {
          if (!line.startsWith('#EXT-X-MEDIA:') || !line.includes('TYPE=AUDIO')) return false;
          const langMatch = line.match(/LANGUAGE="([^"]+)"/i);
          const nameMatch = line.match(/NAME="([^"]+)"/i);
          const lang = (langMatch ? langMatch[1] : '').toLowerCase();
          const name = (nameMatch ? nameMatch[1] : '').toLowerCase();

          for (const p of nonEnglishPatterns) {
            if (lang === p || lang.startsWith(p + '-') || name.includes(p)) {
              return true;
            }
          }
          return false;
        };

        const rewritten = text.split('\n')
          .filter(line => !isNonEnglishAudio(line.trim()))
          .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            // Ensure English audio tracks are set to DEFAULT=YES, AUTOSELECT=YES
            if (trimmed.startsWith('#EXT-X-MEDIA:') && trimmed.includes('TYPE=AUDIO')) {
              let updated = line;
              if (updated.includes('DEFAULT=NO')) updated = updated.replace('DEFAULT=NO', 'DEFAULT=YES');
              if (updated.includes('AUTOSELECT=NO')) updated = updated.replace('AUTOSELECT=NO', 'AUTOSELECT=YES');
              line = updated;
            }

            // Rewrite tag URI attributes: URI="xyz" (e.g. #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP)
            if (trimmed.startsWith('#')) {
              return line.replace(/URI="([^"]+)"/g, (_, uriValue) => {
                try {
                  const abs = new URL(uriValue, effectiveUrl).href;
                  return `URI="/api/proxy-stream?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(customReferer)}"`;
                } catch {
                  return `URI="${uriValue}"`;
                }
              });
            }

            // Rewrite direct playlist or segment URLs
            try {
              const absolute = new URL(trimmed, effectiveUrl).href;
              return `/api/proxy-stream?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(customReferer)}`;
            } catch {
              return trimmed;
            }
          }).join('\n');

        return res.send(rewritten);
      }

      // Set proper binary mime type
      if (lowerUrl.includes('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
      } else if (lowerUrl.includes('.key')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      } else if (lowerUrl.includes('.m4s')) {
        res.setHeader('Content-Type', 'video/iso.segment');
      } else {
        res.setHeader('Content-Type', upstreamResponse.headers.get('content-type') || 'application/octet-stream');
      }

      // Pipe binary media
      if (upstreamResponse.body) {
        const stream = Readable.fromWeb(upstreamResponse.body as any);
        stream.pipe(res);
      } else {
        res.end();
      }
    } catch (error: any) {
      console.error('Sethsrc proxy stream error:', error);
      res.status(500).send('Proxy error streaming file.');
    }
  });

  // 3. Transcode Trigger Endpoint (/api/transcode-hls)
  app.post('/api/transcode-hls', async (req, res) => {
    try {
      const { inputPath, outputFolder } = req.body;
      const targetInput = inputPath || path.resolve(baseDir, 'public/assets/aistudio/lv_0_20261105150314_03d32ede.mp4');
      const targetOutputDir = outputFolder ? path.resolve(hlsOutputDir, outputFolder) : hlsOutputDir;

      if (!fs.existsSync(targetOutputDir)) {
        fs.mkdirSync(targetOutputDir, { recursive: true });
      }

      const outputM3u8 = path.join(targetOutputDir, 'index.m3u8');
      const cmd = `ffmpeg -y -i "${targetInput}" -codec:v libx264 -codec:a aac -f hls -hls_time 3 -hls_list_size 0 "${outputM3u8}"`;

      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          console.error('FFmpeg transcode error:', err, stderr);
          return res.status(500).json({ success: false, error: err.message });
        }
        res.json({
          success: true,
          playlistUrl: outputFolder ? `/stream/${outputFolder}/index.m3u8` : '/stream/index.m3u8'
        });
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Source Resolver Helper
  function getSethsrcSources(tmdbId: string, isTV: boolean, season: number = 1, episode: number = 1) {
    if (isTV) {
      return [
        { name: 'Sethsrc Fast Cloud', url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}` },
        { name: 'Sethsrc AutoEmbed', url: `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}` },
        { name: 'Sethsrc Edge CDN', url: `https://vidcore.io/tv/${tmdbId}/${season}/${episode}` },
        { name: 'Sethsrc Stream Pro', url: `https://play.xpass.top/e/tv/${tmdbId}/${season}/${episode}?autostart=false` },
        { name: 'Sethsrc Direct HLS', url: `/stream/index.m3u8`, isHls: true }
      ];
    }
    return [
      { name: 'Sethsrc Fast Cloud', url: `https://vidlink.pro/movie/${tmdbId}` },
      { name: 'Sethsrc AutoEmbed', url: `https://player.autoembed.cc/embed/movie/${tmdbId}` },
      { name: 'Sethsrc Edge CDN', url: `https://vidcore.io/movie/${tmdbId}` },
      { name: 'Sethsrc Stream Pro', url: `https://play.xpass.top/e/movie/${tmdbId}?autostart=false` },
      { name: 'Sethsrc Direct HLS', url: `/stream/index.m3u8`, isHls: true }
    ];
  }

  // 5. Render Sethsrc Player Page
  function renderPlayerHtml(title: string, sources: Array<{ name: string; url: string; isHls?: boolean }>, isTV: boolean, season: number = 1, episode: number = 1) {
    const primarySource = sources[0] || { name: 'Sethsrc Cloud', url: '/stream/index.m3u8', isHls: true };
    const sourcesJson = JSON.stringify(sources);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Sethsrc Stream Engine</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; background: #07090e; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
    #container { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: #000; }
    #player-frame, #hls-video { width: 100%; height: 100%; border: none; background: #000; object-fit: contain; }
    #top-bar { position: absolute; top: 0; left: 0; right: 0; z-index: 50; display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; background: linear-gradient(180deg, rgba(7,9,14,0.95) 0%, rgba(7,9,14,0) 100%); pointer-events: auto; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(0, 240, 255, 0.15); border: 1px solid rgba(0, 240, 255, 0.4); border-radius: 8px; color: var(--brand-blue, #00f0ff); font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-dot { width: 6px; height: 6px; background: var(--brand-blue, #00f0ff); border-radius: 2px; }
    .source-selector { display: flex; align-items: center; gap: 6px; background: rgba(24, 24, 36, 0.9); padding: 4px 8px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.15); }
    .source-btn { background: transparent; border: none; color: #94a3b8; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; }
    .source-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
    .source-btn.active { color: #07090e; background: var(--brand-blue, #00f0ff); font-weight: 800; }
    #loading-indicator { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #07090e; z-index: 10; pointer-events: none; transition: opacity 0.3s ease; }
    .spinner { width: 36px; height: 36px; border: 3px solid rgba(0, 240, 255, 0.2); border-top-color: var(--brand-blue, #00f0ff); border-radius: 4px; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="container">
    <div id="top-bar">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div class="badge">
          <div class="badge-dot"></div>
          <span>Sethsrc</span>
        </div>
        <span style="font-size: 12px; font-weight: 600; color: #cbd5e1; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${title} ${isTV ? `<span style="color:var(--brand-blue, #00f0ff); font-weight:800;">S${season}:E${episode}</span>` : ''}
        </span>
      </div>
      <div class="source-selector" id="source-list"></div>
    </div>

    <div id="loading-indicator">
      <div class="spinner"></div>
      <div style="font-size: 12px; color: var(--brand-blue, #00f0ff); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Connecting to Sethsrc Engine...</div>
    </div>

    <div id="player-wrapper" style="width: 100%; height: 100%; position: relative;">
      <iframe id="player-frame" allowfullscreen="true" allow="autoplay; encrypted-media; picture-in-picture"></iframe>
      <video id="hls-video" controls autoplay playsinline style="display: none;"></video>
    </div>
  </div>

  <script>
    const sources = ${sourcesJson};
    let currentSourceIndex = 0;
    const iframe = document.getElementById('player-frame');
    const hlsVideo = document.getElementById('hls-video');
    const loader = document.getElementById('loading-indicator');
    const sourceList = document.getElementById('source-list');
    let hlsInstance = null;

    function renderSourceButtons() {
      sourceList.innerHTML = '';
      sources.forEach((src, idx) => {
        const btn = document.createElement('button');
        btn.className = 'source-btn' + (idx === currentSourceIndex ? ' active' : '');
        btn.textContent = src.name.replace('Sethsrc ', '');
        btn.onclick = () => loadSource(idx);
        sourceList.appendChild(btn);
      });
    }

    function loadSource(index) {
      currentSourceIndex = index;
      renderSourceButtons();
      loader.style.opacity = '1';
      loader.style.display = 'flex';

      const src = sources[index];
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }

      if (src.isHls) {
        iframe.style.display = 'none';
        hlsVideo.style.display = 'block';

        if (Hls.isSupported()) {
          hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
          });
          hlsInstance.loadSource(src.url);
          hlsInstance.attachMedia(hlsVideo);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 300);
            hlsVideo.play().catch(() => {});
          });
          hlsInstance.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              console.warn('HLS error encountered, switching to backup stream');
              loadSource((currentSourceIndex + 1) % sources.length);
            }
          });
        } else if (hlsVideo.canPlayType('application/vnd.apple.mpegurl')) {
          hlsVideo.src = src.url;
          hlsVideo.addEventListener('loadedmetadata', () => {
            loader.style.opacity = '0';
            setTimeout(() => { loader.style.display = 'none'; }, 300);
            hlsVideo.play().catch(() => {});
          });
        }
      } else {
        hlsVideo.style.display = 'none';
        iframe.style.display = 'block';
        iframe.src = src.url;
        iframe.onload = () => {
          loader.style.opacity = '0';
          setTimeout(() => { loader.style.display = 'none'; }, 300);
        };
      }
    }

    renderSourceButtons();
    loadSource(0);
  </script>
</body>
</html>`;
  }

  // 6. The Embed Route for Movies (/embed/movie/:id)
  app.get('/embed/movie/:id', (req, res) => {
    const tmdbId = req.params.id;
    const sources = getSethsrcSources(tmdbId, false);
    const html = renderPlayerHtml(`Movie #${tmdbId}`, sources, false);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
  });

  // 7. The Embed Route for TV Series (/embed/tv/:id/:season?/:episode?)
  app.get('/embed/tv/:id/:season?/:episode?', (req, res) => {
    const tmdbId = req.params.id;
    const season = parseInt(req.params.season || '1', 10);
    const episode = parseInt(req.params.episode || '1', 10);

    const sources = getSethsrcSources(tmdbId, true, season, episode);
    const html = renderPlayerHtml(`Series #${tmdbId}`, sources, true, season, episode);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
  });

  // 8. Dynamic M3U Playlist Export for LG TV / VLC / IPTV Players (/api/playlist.m3u)
  app.get(['/api/playlist.m3u', '/api/playlist.m3u8'], (req, res) => {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    let m3u = '#EXTM3U\n';
    for (const channel of TV_CHANNELS) {
      let streamUrl = channel.url;
      if (streamUrl.startsWith('/')) {
        streamUrl = `${baseUrl}${streamUrl}`;
      }
      const displayCat = (channel.category === 'Family' || channel.category === 'Kids' || channel.category === 'Family & Kids') ? 'Family & Kids' : channel.category;
      const logoAttr = channel.logo ? ` tvg-logo="${channel.logo}"` : '';
      const groupAttr = displayCat ? ` group-title="${displayCat}"` : '';
      m3u += `#EXTINF:-1 tvg-id="${channel.id}" tvg-name="${channel.name}"${logoAttr}${groupAttr},${channel.name}\n`;
      m3u += `${streamUrl}\n`;
    }

    res.setHeader('Content-Type', 'application/x-mpegURL; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="livetv_playlist.m3u"');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(m3u);
  });

  // 9. Stream Validator / Frame-rate & Health Check API (/api/validate-streams)
  app.get('/api/validate-streams', async (req, res) => {
    const channelId = req.query.channel as string;
    const channelsToCheck = channelId
      ? TV_CHANNELS.filter(c => c.id === channelId)
      : TV_CHANNELS.slice(0, 20);

    const results = await Promise.all(
      channelsToCheck.map(async (c) => {
        try {
          const testUrl = c.url.startsWith('/')
            ? `http://localhost:${process.env.PORT || 3000}${c.url}`
            : c.url;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);

          const resp = await fetch(testUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: controller.signal
          });
          clearTimeout(timeout);

          const isOnline = resp.ok;
          let has60fps = false;
          if (isOnline) {
            const body = await resp.text();
            has60fps = body.includes('FRAME-RATE=60') || body.includes('FRAME-RATE=59.94') || body.includes('60fps');
          }

          return {
            id: c.id,
            name: c.name,
            status: isOnline ? 'online' : 'error',
            httpCode: resp.status,
            native60fps: has60fps,
            category: c.category
          };
        } catch (e: any) {
          return {
            id: c.id,
            name: c.name,
            status: 'unreachable',
            error: e.name === 'AbortError' ? 'timeout' : e.message,
            category: c.category
          };
        }
      })
    );

    res.json({
      timestamp: new Date().toISOString(),
      checkedCount: results.length,
      onlineCount: results.filter(r => r.status === 'online').length,
      channels: results
    });
  });

  console.log('🚀 Sethsrc Streaming & Transcoding Engine initialized successfully');
  console.log(`📺 Sethsrc Stream directory: /stream`);
  console.log(`🎬 Sethsrc Movie Embed: /embed/movie/:id`);
  console.log(`📺 Sethsrc TV Embed: /embed/tv/:id/:season/:episode`);
  console.log(`📑 Sethsrc Live M3U Playlist: /api/playlist.m3u`);
}
