import { useState, useEffect, useCallback, useRef } from 'react';
import { Track } from '../data/musicTracks';

export function useMusicPlayer() {
  const [tracks, setTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('frosted_music_saved_tracks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('frosted_music_liked');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mediaMode, setMediaMode] = useState<'audio' | 'video'>('audio');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(210);
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);
  const [vibeMessage, setVibeMessage] = useState<string>('put some headphones on. found these tracks for you.');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentTrack = tracks[currentTrackIndex] || null;

  // Sync duration with active track
  useEffect(() => {
    if (currentTrack?.duration) {
      setDuration(currentTrack.duration);
    } else {
      setDuration(210);
    }
    setCurrentTime(0);
  }, [currentTrack]);

  // Initial YouTube Music discovery on load
  useEffect(() => {
    if (tracks.length === 0) {
      setIsLoadingTracks(true);
      fetch('/api/music/discover')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
            setTracks(data.tracks);
            if (data.vibe) {
              setVibeMessage(data.vibe);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoadingTracks(false);
        });
    }
  }, [tracks.length]);

  // Send command to embedded player
  const sendPlayerCommand = useCallback((func: string, args: any[] = []) => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      }
    } catch {
      // Ignore
    }
  }, []);

  // Timer to simulate/track playback progress smoothly
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1;
          if (next >= duration) {
            if (isRepeat) {
              sendPlayerCommand('seekTo', [0, true]);
              return 0;
            } else {
              handleNextTrack();
              return 0;
            }
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, duration, isRepeat]);

  // Listen for YouTube Iframe API postMessages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          // YouTube player state events
          if (data.event === 'onStateChange') {
            if (data.info === 0) {
              // Video ended
              if (isRepeat) {
                sendPlayerCommand('seekTo', [0, true]);
                sendPlayerCommand('playVideo');
              } else {
                handleNextTrack();
              }
            } else if (data.info === 1) {
              setIsPlaying(true);
            } else if (data.info === 2) {
              setIsPlaying(false);
            }
          }
        }
      } catch {
        // Ignore non-json messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isRepeat]);

  // Sync audio/video play/pause, currentTrack, and mediaMode changes
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;

    if (mediaMode === 'audio') {
      if (video) video.pause();
      if (audio) {
        if (isPlaying) {
          audio.play().catch((err) => {
            console.warn('Audio play failed:', err);
          });
        } else {
          audio.pause();
        }
      }
    } else {
      if (audio) audio.pause();
      if (video) {
        if (isPlaying) {
          video.play().catch((err) => {
            console.warn('Video play failed:', err);
          });
        } else {
          video.pause();
        }
      }
    }
  }, [isPlaying, currentTrack, mediaMode]);

  // Sync volume and mute for both elements
  useEffect(() => {
    const vol = Math.max(0, Math.min(1, volume / 100));
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = isMuted;
    }
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const playTrack = useCallback(
    (indexOrTrack: number | Track) => {
      let targetIndex = 0;

      if (typeof indexOrTrack === 'number') {
        targetIndex = indexOrTrack;
        setCurrentTrackIndex(targetIndex);
      } else {
        const targetTrack = indexOrTrack;
        const existingIdx = tracks.findIndex((t) => t.id === targetTrack?.id);
        if (existingIdx !== -1) {
          targetIndex = existingIdx;
          setCurrentTrackIndex(existingIdx);
        } else {
          setTracks((prev) => [targetTrack, ...prev]);
          setCurrentTrackIndex(0);
        }
      }

      setCurrentTime(0);
      setIsPlaying(true);
      const activeEl = mediaMode === 'audio' ? audioRef.current : videoRef.current;
      if (activeEl) {
        activeEl.currentTime = 0;
        activeEl.play().catch((err) => {
          console.warn('Media play failed in playTrack:', err);
        });
      }
    },
    [tracks, mediaMode]
  );

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      const activeEl = mediaMode === 'audio' ? audioRef.current : videoRef.current;
      if (activeEl) {
        if (next) {
          activeEl.play().catch((err) => {
            console.warn('Media play failed in togglePlay:', err);
          });
        } else {
          activeEl.pause();
        }
      }
      return next;
    });
  }, [mediaMode]);

  const handleNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (isRepeat) {
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      sendPlayerCommand('seekTo', [0, true]);
      sendPlayerCommand('playVideo');
      return;
    }

    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      const nextIdx = (currentTrackIndex + 1) % tracks.length;
      setCurrentTrackIndex(nextIdx);
    }
    setCurrentTime(0);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex, isRepeat, isShuffle, sendPlayerCommand]);

  const handlePrevTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (currentTime > 4) {
      // Restart current song
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      sendPlayerCommand('seekTo', [0, true]);
      return;
    }
    const prevIdx = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(prevIdx);
    setCurrentTime(0);
    setIsPlaying(true);
  }, [tracks.length, currentTrackIndex, currentTime, sendPlayerCommand]);

  const seekTo = useCallback(
    (seconds: number) => {
      const bounded = Math.max(0, Math.min(seconds, duration));
      setCurrentTime(bounded);
      if (audioRef.current) {
        audioRef.current.currentTime = bounded;
      }
      sendPlayerCommand('seekTo', [bounded, true]);
    },
    [duration, sendPlayerCommand]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        sendPlayerCommand('mute');
      } else {
        sendPlayerCommand('unMute');
      }
      return next;
    });
  }, [sendPlayerCommand]);

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      setVolume(newVolume);
      if (isMuted && newVolume > 0) {
        setIsMuted(false);
        sendPlayerCommand('unMute');
      }
      sendPlayerCommand('setVolume', [newVolume]);
    },
    [isMuted, sendPlayerCommand]
  );

  const toggleLike = useCallback((trackId: string) => {
    setLikedTrackIds((prev) => {
      const currentList = Array.isArray(prev) ? prev : [];
      const next = currentList.includes(trackId)
        ? currentList.filter((id) => id !== trackId)
        : [...currentList, trackId];
      try {
        localStorage.setItem('frosted_music_liked', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const addCustomTrack = useCallback((newTrack: Omit<Track, 'id'>) => {
    const id = `custom-${Date.now()}`;
    const fullTrack: Track = { ...newTrack, id, isCustom: true };
    setTracks((prev) => {
      const next = [fullTrack, ...prev];
      try {
        localStorage.setItem('frosted_music_saved_tracks', JSON.stringify(next.slice(0, 50)));
      } catch {}
      return next;
    });
    setCurrentTrackIndex(0);
    setCurrentTime(0);
    setIsPlaying(true);
  }, []);

  return {
    tracks,
    setTracks,
    currentTrack,
    currentTrackIndex,
    isPlaying,
    setIsPlaying,
    mediaMode,
    setMediaMode,
    currentTime,
    setCurrentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    isRepeat,
    likedTrackIds,
    isLoadingTracks,
    setIsLoadingTracks,
    vibeMessage,
    setVibeMessage,
    setIsShuffle,
    setIsRepeat,
    playTrack,
    togglePlay,
    handleNextTrack,
    handlePrevTrack,
    toggleLike,
    seekTo,
    toggleMute,
    setVolume: handleVolumeChange,
    addCustomTrack,
    iframeRef,
    audioRef,
    videoRef,
  };
}
