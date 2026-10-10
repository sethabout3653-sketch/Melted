import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Download,
  Play,
  Flame,
  Clock,
  Sparkles,
  ExternalLink,
  Film,
  Music,
  Gamepad2,
  Tv,
  Newspaper,
  Compass,
  ArrowDownToLine,
  Check,
  Copy,
  ChevronLeft,
  Share2,
  ThumbsUp,
  X,
  FileVideo,
  FileAudio,
  ShieldCheck,
  Settings,
} from 'lucide-react';

interface VideoSummary {
  videoId: string;
  title: string;
  author: string;
  lengthSeconds: number;
  durationFormatted: string;
  viewCountFormatted: string;
  publishedText: string;
  thumbnail: string;
}

interface VideoFormat {
  itag: number | string;
  quality: string;
  resolution?: string;
  container: string;
  mimeType: string;
  hasVideo: boolean;
  hasAudio: boolean;
  sizeEstimate?: string;
  url: string;
  downloadUrl: string;
  status?: string;
}

interface VideoDetails {
  videoId: string;
  title: string;
  description: string;
  author: string;
  authorId?: string;
  authorThumb?: string;
  publishedText?: string;
  lengthSeconds: number;
  durationFormatted: string;
  viewCount: number;
  viewCountFormatted: string;
  likeCount?: number;
  thumbnail: string;
  formats: VideoFormat[];
  recommendedVideos: VideoSummary[];
  formatsFoundNotice?: string;
  formatsCount?: number;
  engine?: string;
}

const CATEGORY_CHIPS = [
  { id: 'all', label: 'All', query: '' },
  { id: 'trending', label: 'Trending', query: 'trending' },
  { id: 'gaming', label: 'Gaming', query: 'gaming gameplay walkthrough' },
  { id: 'music', label: 'Music', query: 'official music video' },
  { id: 'tech', label: 'Technology', query: 'tech review gadgets' },
  { id: 'science', label: 'Science', query: 'veritasium kurzesagt science' },
  { id: 'coding', label: 'Programming', query: 'coding web development' },
  { id: 'news', label: 'News', query: 'world news technology' },
  { id: 'lofi', label: 'Lo-Fi & Chill', query: 'lofi hip hop radio beats' },
];

export const VideosView: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchError, setSearchError] = useState('');

  // Extracted Video modal / detail
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDetails, setExtractedDetails] = useState<VideoDetails | null>(null);

  // Active Theater / Watch mode
  const [activeWatchVideo, setActiveWatchVideo] = useState<{
    videoId: string;
    title: string;
    author: string;
  } | null>(null);

  // Download state feedback
  const [copiedItag, setCopiedItag] = useState<string | number | null>(null);
  const [downloadingItag, setDownloadingItag] = useState<string | number | null>(null);

  // Quality for native HTML5 video player (1080p, 720p, 360p, audio)
  const [selectedQuality, setSelectedQuality] = useState<'1080' | '720' | '360' | 'audio'>('1080');
  const theaterVideoRef = useRef<HTMLVideoElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cookie and Device Profile Modal State
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [cookieStatus, setCookieStatus] = useState<{ hasCookies: boolean; cookieCount: number; mode: string }>({
    hasCookies: false,
    cookieCount: 0,
    mode: 'Anonymous Verified Device Profile (tv, android, mweb)',
  });
  const [cookieInput, setCookieInput] = useState('');
  const [cookieMessage, setCookieMessage] = useState('');
  const [isSavingCookies, setIsSavingCookies] = useState(false);

  useEffect(() => {
    fetchCookieStatus();
  }, []);

  const fetchCookieStatus = async () => {
    try {
      const res = await fetch('/api/videos/cookies');
      const data = await res.json();
      setCookieStatus(data);
    } catch {}
  };

  const handleSaveCookies = async () => {
    setIsSavingCookies(true);
    setCookieMessage('');
    try {
      const res = await fetch('/api/videos/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookiesContent: cookieInput }),
      });
      const data = await res.json();
      if (data.success) {
        setCookieMessage('✓ cookies.txt saved! yt-dlp will now use these session cookies.');
        setCookieInput('');
        fetchCookieStatus();
      } else {
        setCookieMessage('Error saving cookies: ' + (data.error || 'Unknown error'));
      }
    } catch {
      setCookieMessage('Failed to connect to cookies endpoint.');
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleDeleteCookies = async () => {
    try {
      await fetch('/api/videos/cookies', { method: 'DELETE' });
      setCookieMessage('✓ Reverted to Anonymous Verified Device Profile.');
      fetchCookieStatus();
    } catch {}
  };

  // Load initial videos (trending / feed)
  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async (query?: string) => {
    setIsLoading(true);
    setSearchError('');
    try {
      let endpoint = '/api/videos/trending';
      if (query && query.trim()) {
        endpoint = `/api/videos/search?q=${encodeURIComponent(query.trim())}`;
      }

      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success && Array.isArray(data.videos) && data.videos.length > 0) {
        setVideos(data.videos);
      } else if (query) {
        setSearchError('No videos found for this search. Try another title or paste a direct YouTube link.');
      }
    } catch {
      setSearchError('Unable to connect to YouTube index. Please check connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryClick = (chip: typeof CATEGORY_CHIPS[0]) => {
    setActiveCategory(chip.id);
    setSearchInput('');
    if (chip.id === 'all') {
      loadFeed();
    } else {
      loadFeed(chip.query);
    }
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;

    // Detect if user pasted a YouTube URL or direct 11-char video ID
    const isYtUrl = /(?:youtu\.be\/|youtube\.com\/|y2u\.be\/)/i.test(q) || /^[a-zA-Z0-9_-]{11}$/.test(q);
    if (isYtUrl) {
      handleExtractUrl(q);
      return;
    }

    setActiveCategory('');
    loadFeed(q);
  };

  const handleExtractUrl = async (urlOrId: string) => {
    setIsExtracting(true);
    setSearchError('');
    try {
      const res = await fetch('/api/videos/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlOrId }),
      });
      const data = await res.json();
      if (data.success && data.details) {
        setExtractedDetails(data.details);
      } else {
        setSearchError(data.error || 'Could not extract video details from this link.');
      }
    } catch {
      setSearchError('Failed to extract video streams. Please check the URL.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopyLink = (url: string, itag: string | number) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedItag(itag);
      setTimeout(() => setCopiedItag(null), 2000);
    });
  };

  const handleDownload = (format: VideoFormat, videoTitle: string) => {
    setDownloadingItag(format.itag);
    const sep = format.downloadUrl.includes('?') ? '&' : '?';
    const url = format.downloadUrl.includes('title=') 
      ? format.downloadUrl 
      : `${format.downloadUrl}${sep}title=${encodeURIComponent(videoTitle)}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${videoTitle}.${format.container}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingItag(null);
    }, 2500);
  };

  return (
    <div className="min-h-full bg-[#0a0a0c] text-zinc-100 flex flex-col font-sans select-none">
      
      {/* YouTube Top Bar Header & Extractor Search Bar */}
      <header className="sticky top-0 z-30 bg-[#0f0f13]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Left: YouTube Branding */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-600/20">
              <Film className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tighter text-white">YouTube</span>
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-500/10 px-1.5 py-0.5 rounded">
                  Studio
                </span>
              </div>
            </div>
          </div>

          {/* Center: Search & Extractor Bar (ytdown.to style) */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl mx-auto w-full flex items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search videos or paste YouTube link to download..."
                className="w-full bg-[#18181c] hover:bg-[#1f1f24] focus:bg-[#1f1f24] text-xs sm:text-sm text-zinc-100 placeholder-zinc-400 rounded-l-2xl pl-10 pr-9 py-2.5 border border-zinc-800 focus:border-red-600 focus:outline-none transition-all shadow-inner"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isExtracting || !searchInput.trim()}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-r-2xl transition-all cursor-pointer shadow-md flex items-center gap-2 shrink-0 border border-red-600 border-l-0"
            >
              {isExtracting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Extract & Get</span>
                </>
              )}
            </button>
          </form>

          {/* Right Status & Cookies Config */}
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <button
              onClick={() => setIsCookieModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181c] hover:bg-[#222228] border border-zinc-800 rounded-xl text-zinc-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
              title="Configure cookies.txt or session profile"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span>{cookieStatus.hasCookies ? 'Custom Cookies' : 'Verified Device'}</span>
              {cookieStatus.hasCookies && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>

            <span className="hidden sm:flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Extractor Online
            </span>
          </div>

        </div>

        {/* YouTube Category Chips Row (Horizontal Scroll) */}
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar pt-3">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleCategoryClick(chip)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                activeCategory === chip.id
                  ? 'bg-zinc-100 text-zinc-950 border-white shadow-sm'
                  : 'bg-[#18181c] text-zinc-300 border-zinc-800 hover:bg-[#26262c] hover:text-white'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Error Banner */}
        {searchError && (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-md">
            <span>{searchError}</span>
            <button
              onClick={() => setSearchError('')}
              className="text-red-400 hover:text-white font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Extracted Video Downloader Card (ytdown.to style) */}
        {extractedDetails && (
          <div className="bg-[#131317] border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-red-500" />
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  YouTube Video Extractor & Downloader
                </h2>
              </div>
              <button
                onClick={() => setExtractedDetails(null)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Thumbnail + Video Information */}
              <div className="lg:w-80 shrink-0 space-y-3">
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-lg border border-zinc-800">
                  <img
                    src={extractedDetails.thumbnail}
                    alt={extractedDetails.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-2.5 right-2.5 bg-black/85 text-white font-mono text-xs px-2 py-0.5 rounded-md font-bold">
                    {extractedDetails.durationFormatted}
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-sm sm:text-base text-zinc-100 line-clamp-2 leading-snug">
                    {extractedDetails.title}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    {extractedDetails.author}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {extractedDetails.viewCountFormatted} · {extractedDetails.publishedText}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveWatchVideo({
                      videoId: extractedDetails.videoId,
                      title: extractedDetails.title,
                      author: extractedDetails.author,
                    });
                    setExtractedDetails(null);
                  }}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Watch in Theater Player</span>
                </button>
              </div>

              {/* Formats Table (1080p, 720p, 480p, 360p, MP3) */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* InnerTube Format Verification Banner */}
                <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-emerald-300 text-xs font-semibold shadow-sm">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {extractedDetails.formatsFoundNotice || `InnerTube Engine: Found all ${extractedDetails.formats.length} video & audio formats. 0b Protection Active.`}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
                  <span>Available Download Formats ({extractedDetails.formats.length} Extracted)</span>
                  <span className="text-emerald-400 font-bold">✓ 0b Protection Active</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {extractedDetails.formats.map((fmt, idx) => {
                    const isAudio = !fmt.hasVideo;
                    const isDownloading = downloadingItag === fmt.itag;
                    const isCopied = copiedItag === fmt.itag;

                    return (
                      <div
                        key={`fmt-${fmt.itag}-${idx}`}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#18181e] border border-zinc-800/80 hover:border-zinc-700 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isAudio ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {isAudio ? <FileAudio className="w-4 h-4" /> : <FileVideo className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-xs font-bold text-zinc-200 truncate">
                              {fmt.quality}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              {fmt.container.toUpperCase()} · {fmt.sizeEstimate || 'Direct Stream'}
                            </p>
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{fmt.status || 'Format Extracted & Verified'}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(fmt.url, fmt.itag)}
                            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                            title="Copy Direct Link"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(fmt, extractedDetails.title)}
                            disabled={isDownloading}
                            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                          >
                            {isDownloading ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Download className="w-3 h-3" />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Theater Watch Player Overlay */}
        {activeWatchVideo && (
          <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveWatchVideo(null)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white font-bold p-1 rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Feed</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExtractUrl(activeWatchVideo.videoId)}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / Extract MP4</span>
                </button>
                <button
                  onClick={() => setActiveWatchVideo(null)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Native HTML5 Player: 1080p HD Video + Audio via InnerTube engine (Zero Iframes) */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-zinc-800 flex items-center justify-center">
              <video
                ref={theaterVideoRef}
                key={`theater-player-${activeWatchVideo.videoId}-${selectedQuality}`}
                src={`/api/videos/stream?id=${activeWatchVideo.videoId}&quality=${selectedQuality}`}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                onError={() => {
                  console.warn('Video stream error on current quality, switching to 720p...');
                  if (selectedQuality === '1080') {
                    setSelectedQuality('720');
                  }
                }}
              />
            </div>

            {/* Quality & Stream Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18181f] p-3 rounded-2xl border border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider pl-1">
                  Quality:
                </span>
                <div className="flex items-center gap-1.5 bg-[#121216] p-1 rounded-xl border border-zinc-800">
                  <button
                    onClick={() => setSelectedQuality('1080')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedQuality === '1080'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    1080p HD
                  </button>
                  <button
                    onClick={() => setSelectedQuality('720')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedQuality === '720'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    720p
                  </button>
                  <button
                    onClick={() => setSelectedQuality('360')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedQuality === '360'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    360p
                  </button>
                  <button
                    onClick={() => setSelectedQuality('audio')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedQuality === 'audio'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Audio Only
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/videos/download?id=${activeWatchVideo.videoId}&quality=${selectedQuality}&ext=${selectedQuality === 'audio' ? 'mp3' : 'mp4'}&title=${encodeURIComponent(activeWatchVideo.title)}`}
                  download
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {selectedQuality.toUpperCase()}</span>
                </a>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/videos/stream?id=${activeWatchVideo.videoId}&quality=${selectedQuality}`);
                    setCopiedItag('stream-active');
                    setTimeout(() => setCopiedItag(null), 2000);
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Copy direct stream link"
                >
                  {copiedItag === 'stream-active' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedItag === 'stream-active' ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Video Details Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <div>
                <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight">
                  {activeWatchVideo.title}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                  {activeWatchVideo.author}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <a
                  href={`https://www.youtube.com/watch?v=${activeWatchVideo.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>YouTube</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Video Grid Feed Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              <span>{activeCategory ? `${CATEGORY_CHIPS.find(c => c.id === activeCategory)?.label || 'Videos'}` : 'Search Results'}</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Instant playback and high-speed MP4 & MP3 downloads
            </p>
          </div>
        </div>

        {/* Video Grid (Authentic YouTube Card Layout) */}
        {isLoading ? (
          <div className="py-32 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 font-semibold tracking-wide">
              Fetching YouTube videos...
            </p>
          </div>
        ) : videos.length === 0 ? (
          <div className="py-24 text-center space-y-3 bg-[#131317] rounded-3xl border border-zinc-800/80 p-8">
            <Film className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-300">No videos found</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Try searching for any video, channel, music, or paste a YouTube URL to extract.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {videos.map((vid) => (
              <div
                key={vid.videoId}
                className="group flex flex-col space-y-3 cursor-pointer"
                onClick={() => {
                  setActiveWatchVideo({
                    videoId: vid.videoId,
                    title: vid.title,
                    author: vid.author,
                  });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {/* 16:9 Thumbnail with Duration Badge */}
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-950 shadow-md border border-zinc-800/80 group-hover:border-zinc-700 transition-all">
                  <img
                    src={vid.thumbnail}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${vid.videoId}/hqdefault.jpg`;
                    }}
                  />
                  
                  {/* Duration Badge */}
                  {vid.durationFormatted && (
                    <span className="absolute bottom-2 right-2 bg-black/85 text-white font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-md">
                      {vid.durationFormatted}
                    </span>
                  )}

                  {/* Hover Overlay Play Icon */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Metadata Row: Channel Avatar & 2-Line Title */}
                <div className="flex items-start gap-3">
                  {/* Channel Initial Avatar */}
                  <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center shrink-0 uppercase shadow-sm">
                    {vid.author ? vid.author.slice(0, 1) : 'Y'}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-red-400 transition-colors line-clamp-2 leading-snug">
                      {vid.title}
                    </h3>

                    <p className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors truncate font-medium">
                      {vid.author}
                    </p>

                    <p className="text-[11px] text-zinc-500">
                      {vid.viewCountFormatted} · {vid.publishedText}
                    </p>
                  </div>

                  {/* Extract Download Quick Action Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtractUrl(vid.videoId);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Download formats"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Cookies & Device Session Profile Modal */}
      {isCookieModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#131317] border border-zinc-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  YouTube Device & Cookie Engine
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCookieModalOpen(false);
                  setCookieMessage('');
                }}
                className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
                <div className="font-bold text-zinc-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Current Active Mode:</span>
                </div>
                <p className="text-[11px] text-zinc-400 pl-4 font-mono">
                  {cookieStatus.mode}
                </p>
                {cookieStatus.hasCookies && (
                  <p className="text-[11px] text-emerald-400 pl-4 font-semibold">
                    ✓ {cookieStatus.cookieCount} session cookies loaded from cookies.txt
                  </p>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-blue-950/20 border border-blue-900/40 text-blue-300 text-[11px] space-y-1">
                <p className="font-bold text-blue-200">ℹ️ Note on Browser vs Server Cookies:</p>
                <p>
                  Running <code className="bg-black/40 px-1 py-0.5 rounded text-blue-200">yt-dlp --cookies-from-browser chrome</code> works on a personal PC with desktop Chrome installed. In this hosted cloud environment, the server runs headless without a desktop Chrome session.
                </p>
                <p>
                  Instead, the server uses official <strong>Verified Device Profiles (<code className="text-blue-200">tv, android, mweb</code>)</strong> with zero setup, OR you can paste exported Netscape cookies below into <code className="text-blue-200">cookies.txt</code>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Paste Custom cookies.txt (Optional):
                </label>
                <textarea
                  rows={4}
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1799999999&#9;VISITOR_INFO1_LIVE&#9;..."
                  className="w-full bg-[#18181e] border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 font-mono focus:border-red-600 focus:outline-none placeholder-zinc-600"
                />
              </div>

              {cookieMessage && (
                <div className="p-2.5 rounded-xl bg-zinc-800/80 text-xs font-semibold text-emerald-400">
                  {cookieMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              {cookieStatus.hasCookies ? (
                <button
                  type="button"
                  onClick={handleDeleteCookies}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Remove cookies.txt (Reset to Anonymous)
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCookieModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveCookies}
                  disabled={!cookieInput.trim() || isSavingCookies}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {isSavingCookies ? 'Saving...' : 'Save cookies.txt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
