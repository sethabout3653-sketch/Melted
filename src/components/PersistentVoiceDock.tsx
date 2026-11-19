import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  MonitorUp,
  Volume2,
  VolumeX,
  PhoneOff,
  Maximize2,
  Minimize2,
  Video,
  ChevronUp,
  ChevronDown,
  X,
  AlertCircle,
} from 'lucide-react';

interface MiniStreamTileProps {
  stream: MediaStream;
  label: string;
  isMirror?: boolean;
  badge?: string;
  onFullscreen?: () => void;
}

const MiniStreamTile: React.FC<MiniStreamTileProps> = React.memo(({ stream, label, isMirror = false, badge, onFullscreen }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = true;
    el.play().catch(() => {});

    return () => {
      el.pause();
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <div 
      onDoubleClick={onFullscreen}
      className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-200/20 dark:border-white/10 shadow-md group cursor-pointer"
    >
      {onFullscreen && (
        <button
          type="button"
          onClick={onFullscreen}
          aria-label={`View ${label} fullscreen`}
          title="Fullscreen"
          className="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-lg bg-slate-950/75 hover:bg-slate-800 border border-white/20 text-white flex items-center justify-center shadow transition cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-contain bg-black ${isMirror ? 'scale-x-[-1]' : ''}`}
      />
      <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/85 to-transparent flex items-center justify-between gap-1 pointer-events-none">
        <span className="text-[10px] font-bold text-white truncate">{label}</span>
        {badge && (
          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[var(--brand-blue)] text-white shrink-0">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
});

const DockFullscreenOverlay: React.FC<{
  stream: MediaStream;
  label: string;
  isMirror?: boolean;
  onClose: () => void;
}> = ({ stream, label, isMirror = false, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted = true;
    el.play().catch(() => {});
    return () => {
      el.pause();
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const container = containerRef.current;
    if (container && document.fullscreenEnabled && !document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleFsChange = () => {
      if (!document.fullscreenElement && containerRef.current && (containerRef.current as any).__didEnterNativeFs) {
        onClose();
      }
      if (document.fullscreenElement === containerRef.current && containerRef.current) {
        (containerRef.current as any).__didEnterNativeFs = true;
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (document.fullscreenElement === container) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div ref={containerRef} className="fixed inset-0 z-[999999] bg-black flex items-center justify-center select-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-contain bg-black ${isMirror ? 'scale-x-[-1]' : ''}`}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Exit fullscreen"
        className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/20 bg-slate-950/80 hover:bg-slate-800 text-white text-xs font-bold shadow-xl backdrop-blur-md transition cursor-pointer"
      >
        <Minimize2 className="w-4 h-4" />
        <span>Exit Fullscreen</span>
      </button>
      <div className="absolute bottom-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm font-extrabold backdrop-blur-md shadow-xl pointer-events-none">
        {label}
      </div>
    </div>,
    document.body
  );
};

interface PersistentVoiceDockProps {
  globalChat: any;
  onMaximizeToVoice: () => void;
}

export const PersistentVoiceDock: React.FC<PersistentVoiceDockProps> = ({
  globalChat,
  onMaximizeToVoice,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [fullscreenTileKey, setFullscreenTileKey] = useState<string | null>(null);

  const activeError = globalChat.screenShareError || globalChat.cameraError || globalChat.micError || null;

  useEffect(() => {
    setDismissedError(null);
  }, [activeError]);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (globalChat.users || []).forEach((u: any) => {
      map.set(String(u.id), u.username || 'Member');
    });
    return map;
  }, [globalChat.users]);

  const previewTiles = useMemo(() => {
    const tiles: { key: string; stream: MediaStream; label: string; isMirror?: boolean; badge?: string }[] = [];

    Object.entries(globalChat.remoteScreenStreams || {}).forEach(([peerId, stream]) => {
      if (stream instanceof MediaStream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)) {
        tiles.push({
          key: `remote-screen-${peerId}`,
          stream,
          label: `${userNameMap.get(peerId) || 'Peer'}'s Screen`,
          badge: 'Live',
        });
      }
    });

    Object.entries(globalChat.remoteCameraStreams || {}).forEach(([peerId, stream]) => {
      if (stream instanceof MediaStream && stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)) {
        tiles.push({
          key: `remote-cam-${peerId}`,
          stream,
          label: userNameMap.get(peerId) || 'Peer',
          badge: 'Cam',
        });
      }
    });

    if (
      globalChat.isScreenSharing &&
      globalChat.screenStream instanceof MediaStream &&
      globalChat.screenStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled)
    ) {
      tiles.push({
        key: 'local-screen',
        stream: globalChat.screenStream,
        label: 'Your Screen',
        badge: 'Sharing',
      });
    }

    if (
      globalChat.isVideoEnabled &&
      globalChat.cameraStream instanceof MediaStream &&
      globalChat.cameraStream.getVideoTracks().some((t: MediaStreamTrack) => t.readyState === 'live' && t.enabled)
    ) {
      tiles.push({
        key: 'local-cam',
        stream: globalChat.cameraStream,
        label: 'You',
        isMirror: true,
        badge: 'Cam',
      });
    }

    return tiles;
  }, [
    globalChat.remoteScreenStreams,
    globalChat.remoteCameraStreams,
    globalChat.isScreenSharing,
    globalChat.screenStream,
    globalChat.isVideoEnabled,
    globalChat.cameraStream,
    userNameMap,
  ]);

  const activeFullscreenTile = useMemo(
    () => previewTiles.find((t) => t.key === fullscreenTileKey) || null,
    [previewTiles, fullscreenTileKey]
  );

  useEffect(() => {
    if (fullscreenTileKey && !activeFullscreenTile) {
      setFullscreenTileKey(null);
    }
  }, [fullscreenTileKey, activeFullscreenTile]);

  const hasAnyVideo = previewTiles.length > 0;
  const voicePeerCount = useMemo(() => {
    const remoteCount = (globalChat.users || []).filter(
      (u: any) =>
        u.id !== globalChat.currentUser?.id &&
        (u.current_channel === 'video-general' || u.current_channel === 'voice-general')
    ).length;
    return remoteCount + 1;
  }, [globalChat.users, globalChat.currentUser?.id]);

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:bottom-5 right-3 sm:right-5 z-[1000000] flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/15 rounded-full px-3 py-2 shadow-2xl"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${globalChat.isSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--brand-blue)]'}`} />
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer pr-1"
          title="Expand voice controls"
        >
          <span>Voice ({voicePeerCount})</span>
          {hasAnyVideo && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] text-[10px] font-black">
              {previewTiles.length} Cam/Live
            </span>
          )}
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
        <button
          type="button"
          onClick={() => globalChat.stopVoiceChannel()}
          aria-label="Leave voice channel"
          className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] lg:bottom-5 left-1/2 -translate-x-1/2 z-[1000000] w-[calc(100vw-1rem)] max-w-lg flex flex-col gap-2"
    >
      <AnimatePresence>
        {activeError && activeError !== dismissedError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-amber-50 dark:bg-amber-950/95 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-100 rounded-xl px-3 py-2 text-xs flex items-center gap-2 shadow-xl backdrop-blur-md"
          >
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="flex-1 min-w-0 truncate">{activeError}</span>
            <button
              type="button"
              onClick={() => setDismissedError(activeError)}
              className="p-1 rounded-lg hover:bg-amber-200/50 dark:hover:bg-white/10 cursor-pointer shrink-0"
              aria-label="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPreviewExpanded && hasAnyVideo && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/15 rounded-2xl p-2.5 shadow-2xl"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
                Active Streams ({previewTiles.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onMaximizeToVoice}
                  className="text-[11px] font-bold text-[var(--brand-blue)] hover:underline px-2 py-0.5 cursor-pointer"
                >
                  Open Social
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewExpanded(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="Hide stream preview"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className={`grid gap-2 max-h-52 overflow-y-auto ${previewTiles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {previewTiles.map((tile) => (
                <MiniStreamTile
                  key={tile.key}
                  stream={tile.stream}
                  label={tile.label}
                  isMirror={tile.isMirror}
                  badge={tile.badge}
                  onFullscreen={() => setFullscreenTileKey((prev) => (prev === tile.key ? null : tile.key))}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-white/15 rounded-2xl px-2.5 sm:px-3.5 py-2 flex items-center justify-between gap-2 shadow-2xl">
        <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-white/10 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${globalChat.isSpeaking ? 'bg-emerald-500' : 'bg-[var(--brand-blue)]'}`}>
            <Mic className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
              General Voice
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
              {voicePeerCount} connected{globalChat.isScreenSharing ? ' · Sharing' : globalChat.isVideoEnabled ? ' · Cam' : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const hasLiveMic = globalChat.localAudioStream?.getAudioTracks().some((track: MediaStreamTrack) => track.readyState === 'live');
              if (!hasLiveMic) void globalChat.requestMicrophonePermission();
              else globalChat.setIsMuted(!globalChat.isMuted);
            }}
            aria-label={globalChat.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={!globalChat.isMuted}
            title={globalChat.isMuted ? 'Unmute' : 'Mute'}
            className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              globalChat.isMuted
                ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
            }`}
          >
            {globalChat.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => void globalChat.toggleCamera()}
            aria-label={globalChat.isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
            aria-pressed={globalChat.isVideoEnabled}
            title={globalChat.isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
            className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              globalChat.isVideoEnabled
                ? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)]'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
            }`}
          >
            {globalChat.isVideoEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => void globalChat.toggleScreenShare()}
            aria-label={globalChat.isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
            aria-pressed={globalChat.isScreenSharing}
            title={globalChat.isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              globalChat.isScreenSharing
                ? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)]'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
            }`}
          >
            <MonitorUp className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => globalChat.setIsDeafened(!globalChat.isDeafened)}
            aria-label={globalChat.isDeafened ? 'Undeafen audio' : 'Deafen audio'}
            aria-pressed={globalChat.isDeafened}
            title={globalChat.isDeafened ? 'Undeafen' : 'Deafen'}
            className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              globalChat.isDeafened
                ? 'bg-red-500/15 text-red-500 hover:bg-red-500/25'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10'
            }`}
          >
            {globalChat.isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {hasAnyVideo && (
            <button
              type="button"
              onClick={() => setIsPreviewExpanded((prev) => !prev)}
              aria-label={isPreviewExpanded ? 'Hide video preview' : 'Show video preview'}
              aria-pressed={isPreviewExpanded}
              title="Toggle Video Preview"
              className={`min-w-[34px] min-h-[34px] px-2 flex items-center justify-center gap-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer ${
                isPreviewExpanded
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{previewTiles.length}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => globalChat.stopVoiceChannel()}
            aria-label="Leave voice channel"
            title="Disconnect Voice"
            className="min-w-[34px] min-h-[34px] flex items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-md shadow-red-600/20 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onMaximizeToVoice}
            className="px-2.5 sm:px-3 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-[10px] font-black rounded-xl uppercase tracking-tight transition-all flex items-center gap-1 shadow-md cursor-pointer"
            title="Open General Voice"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">View</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize voice bar"
            title="Minimize"
            className="min-w-[30px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
      {activeFullscreenTile && (
        <DockFullscreenOverlay
          stream={activeFullscreenTile.stream}
          label={activeFullscreenTile.label}
          isMirror={activeFullscreenTile.isMirror}
          onClose={() => setFullscreenTileKey(null)}
        />
      )}
    </motion.div>
  );
};
