import React, { useState, useEffect, useRef } from 'react';

// Single Audio Track Player - plays a specific track with full volume, unmute detection, and autoplay resilience
const SingleAudioTrackPlayer: React.FC<{ track: MediaStreamTrack; isDeafened: boolean; volume: number }> = ({ track, isDeafened, volume }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Attach track to element once; only re-run if track identity changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !track) return;

    const stream = new MediaStream([track]);
    el.srcObject = stream;

    const tryPlay = () => {
      if (el && el.srcObject) {
        el.play().catch((err) => {
          console.warn('[SingleAudioTrackPlayer] Play waiting for gesture:', err?.message);
        });
      }
    };

    if (track.readyState === 'live' && track.enabled) {
      tryPlay();
    }

    const onUnmute = () => {
      tryPlay();
    };

    track.addEventListener('unmute', onUnmute);

    const onUserGesture = () => {
      tryPlay();
    };
    const events = ['click', 'touchstart', 'keydown', 'mousedown', 'touchend'];
    events.forEach((ev) => window.addEventListener(ev, onUserGesture, { once: true }));

    // Watchdog to ensure audio stays playing
    const watchdog = setInterval(() => {
      if (el && el.paused && el.srcObject && track.readyState === 'live' && track.enabled) {
        tryPlay();
      }
    }, 2000);

    return () => {
      clearInterval(watchdog);
      track.removeEventListener('unmute', onUnmute);
      events.forEach((ev) => window.removeEventListener(ev, onUserGesture));
      if (el) {
        el.srcObject = null;
      }
    };
  }, [track]);

  // 2. Independently update volume and mute without resetting track stream
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = isDeafened;
    el.volume = Math.max(0, Math.min(1, volume));
  }, [isDeafened, volume]);

  return (
    <audio 
      ref={audioRef} 
      autoPlay 
      playsInline 
      className="fixed -top-10 -left-10 w-1 h-1 opacity-0 pointer-events-none"
    />
  );
};

// Dedicated audio player for WebRTC voice peers (plays both microphone and screen share audio tracks!)
export const RemoteAudioPlayer: React.FC<{ stream: MediaStream | undefined; isDeafened: boolean; volume?: number }> = ({ stream, isDeafened, volume = 1 }) => {
  const [tracks, setTracks] = useState<MediaStreamTrack[]>([]);

  useEffect(() => {
    if (!stream) {
      setTracks([]);
      return;
    }

    const updateTracks = () => {
      const live = stream.getAudioTracks().filter((t) => t.readyState === 'live');
      setTracks(live);
    };

    updateTracks();
    stream.onaddtrack = updateTracks;
    stream.onremovetrack = updateTracks;

    return () => {
      stream.onaddtrack = null;
      stream.onremovetrack = null;
    };
  }, [stream]);

  if (!stream || tracks.length === 0) return null;

  return (
    <>
      {tracks.map((track) => (
        <SingleAudioTrackPlayer
          key={track.id}
          track={track}
          isDeafened={isDeafened}
          volume={volume}
        />
      ))}
    </>
  );
};

interface VoiceAudioEngineProps {
  remoteStreams: Record<string, MediaStream>;
  remoteScreenAudioStreams: Record<string, MediaStream>;
  isDeafened: boolean;
}

export const VoiceAudioEngine: React.FC<VoiceAudioEngineProps> = ({ 
  remoteStreams, 
  remoteScreenAudioStreams, 
  isDeafened 
}) => {
  return (
    <>
      {/* Remote Peer Voice Audio (Microphone Speech) */}
      {Object.entries(remoteStreams).map(([peerId, stream]) => (
        <RemoteAudioPlayer
          key={`mic-${peerId}`}
          stream={stream}
          isDeafened={isDeafened}
        />
      ))}

      {/* Remote Screen Share Audio (Separate stream, pristine audio, no mic echo) */}
      {Object.entries(remoteScreenAudioStreams).map(([peerId, stream]) => (
        <RemoteAudioPlayer
          key={`screen-audio-${peerId}`}
          stream={stream}
          isDeafened={isDeafened}
        />
      ))}
    </>
  );
};
