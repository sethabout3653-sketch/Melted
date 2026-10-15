import { useEffect, useRef, useState, useCallback } from 'react';
import { DbUser } from '../server/wsDatabase';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: 'e713606f33230a169b51ee21',
      credential: 'fWc00dvyjWp+O3f3',
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: 'e713606f33230a169b51ee21',
      credential: 'fWc00dvyjWp+O3f3',
    },
  ],
  iceCandidatePoolSize: 10,
};

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general' | 'video-general';
  localAudioStream: MediaStream | null;
  localVideoStream?: MediaStream | null;
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  peers: DbUser[];
  sendRtcSignal: (targetUserId: string, signal: any) => void;
  setRtcSignalHandler: (fn: (fromUserId: string, signal: any) => void) => void;
  setMediaHandlers: (
    onJoined: (userId: string, channel: string) => void,
    onLeft: (userId: string, channel: string) => void
  ) => void;
}

export function useWebRTC({
  currentUserId,
  activeChannel,
  localAudioStream,
  cameraStream,
  screenStream,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
  // Remote Streams per peer:
  // - remoteStreams: contains all audio tracks (mic + screen audio) for RemoteAudioPlayer playback
  // - remoteCameraStreams: contains camera video track (Slot 0)
  // - remoteScreenStreams: contains screen video track (Slot 1)
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  // Active Peer Connections: peerId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE candidates queue per peer
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Perfect negotiation state tracking
  const isMakingOffer = useRef<Map<string, boolean>>(new Map());

  // Web Audio Analysers for decibel detection
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  const isMediaChannel = activeChannel === 'voice-general' || activeChannel === 'video-general';

  // Latest stream references
  const localAudioRef = useRef<MediaStream | null>(localAudioStream);
  const cameraStreamRef = useRef<MediaStream | null>(cameraStream || null);
  const screenStreamRef = useRef<MediaStream | null>(screenStream || null);
  localAudioRef.current = localAudioStream;
  cameraStreamRef.current = cameraStream || null;
  screenStreamRef.current = screenStream || null;

  // Clean up a single peer connection
  const closePeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      try {
        pc.close();
      } catch {}
      peerConnections.current.delete(peerId);
    }
    candidateQueues.current.delete(peerId);
    isMakingOffer.current.delete(peerId);
    remoteAnalysers.current.delete(peerId);

    setRemoteStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });

    setRemoteCameraStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });

    setRemoteScreenStreams((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });

    setRemoteSpeaking((prev) => {
      if (!prev[peerId]) return prev;
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  }, []);

  // Clean up all peers
  const closeAllPeers = useCallback(() => {
    peerConnections.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      try {
        pc.close();
      } catch {}
    });
    peerConnections.current.clear();
    candidateQueues.current.clear();
    isMakingOffer.current.clear();
    remoteAnalysers.current.clear();
    setRemoteStreams({});
    setRemoteCameraStreams({});
    setRemoteScreenStreams({});
    setRemoteSpeaking({});
  }, []);

  // Attach remote audio track to analyser to detect speech decibels
  const setupRemoteAudioAnalysis = useCallback((peerId: string, track: MediaStreamTrack) => {
    try {
      if (!remoteAudioCtxRef.current || remoteAudioCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        remoteAudioCtxRef.current = new AudioCtx();
      }
      const ctx = remoteAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const stream = new MediaStream([track]);
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      remoteAnalysers.current.set(peerId, analyser);
    } catch (e) {
      console.warn('[WebRTC] audio analysis warning:', e);
    }
  }, []);

  // Synchronize remote tracks for a peer directly from peer connection transceivers
  const syncRemoteTracksForPeer = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const aTrans = pc.getTransceivers().filter((t) => t.receiver.track.kind === 'audio');
    const vTrans = pc.getTransceivers().filter((t) => t.receiver.track.kind === 'video');

    // 1. Audio: collect all live receiver tracks (mic in Slot 0, screen audio in Slot 1)
    const audioTracks: MediaStreamTrack[] = [];
    aTrans.forEach((t) => {
      const track = t.receiver.track;
      if (track && track.readyState !== 'ended') {
        audioTracks.push(track);
      }
    });

    if (audioTracks.length > 0) {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: new MediaStream(audioTracks),
      }));
      setupRemoteAudioAnalysis(peerId, audioTracks[0]);
    }

    // 2. Camera Video (Slot 0):
    const camTrack = vTrans[0]?.receiver?.track;
    if (camTrack && camTrack.readyState !== 'ended') {
      const updateCam = () => {
        setRemoteCameraStreams((prev) => ({
          ...prev,
          [peerId]: new MediaStream([camTrack]),
        }));
      };
      updateCam();
      camTrack.onunmute = updateCam;
      camTrack.onmute = updateCam;
    } else {
      setRemoteCameraStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }

    // 3. Screen Share Video (Slot 1):
    const scrTrack = vTrans[1]?.receiver?.track;
    if (scrTrack && scrTrack.readyState !== 'ended') {
      const updateScr = () => {
        setRemoteScreenStreams((prev) => ({
          ...prev,
          [peerId]: new MediaStream([scrTrack]),
        }));
      };
      updateScr();
      scrTrack.onunmute = updateScr;
      scrTrack.onmute = updateScr;
    } else {
      setRemoteScreenStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }
  }, [setupRemoteAudioAnalysis]);

  // Sync track attachments to a peer connection safely via transceivers
  const updateTracksForPeer = useCallback((pc: RTCPeerConnection) => {
    const audioTransceivers = pc.getTransceivers().filter((t) => t.receiver.track.kind === 'audio');
    const videoTransceivers = pc.getTransceivers().filter((t) => t.receiver.track.kind === 'video');

    const localAudioTrack = localAudioRef.current?.getAudioTracks().find((t) => t.readyState === 'live') || null;
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks().find((t) => t.readyState === 'live') || null;

    const cameraTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    const screenTrack = screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;

    // Slot 0 (Audio): Local Mic / Mixed Audio
    if (audioTransceivers[0]) {
      if (audioTransceivers[0].direction !== 'sendrecv') {
        audioTransceivers[0].direction = 'sendrecv';
      }
      if (audioTransceivers[0].sender.track !== localAudioTrack) {
        audioTransceivers[0].sender.replaceTrack(localAudioTrack).catch(() => {});
      }
    }

    // Slot 1 (Audio): Screen Share Audio (dedicated high-fidelity track)
    if (audioTransceivers[1]) {
      if (audioTransceivers[1].direction !== 'sendrecv') {
        audioTransceivers[1].direction = 'sendrecv';
      }
      if (audioTransceivers[1].sender.track !== screenAudioTrack) {
        audioTransceivers[1].sender.replaceTrack(screenAudioTrack).catch(() => {});
      }
    }

    // Slot 0 (Video): Camera
    if (videoTransceivers[0]) {
      if (videoTransceivers[0].direction !== 'sendrecv') {
        videoTransceivers[0].direction = 'sendrecv';
      }
      if (videoTransceivers[0].sender.track !== cameraTrack) {
        videoTransceivers[0].sender.replaceTrack(cameraTrack).catch(() => {});
      }
    }

    // Slot 1 (Video): Screen Share
    if (videoTransceivers[1]) {
      if (videoTransceivers[1].direction !== 'sendrecv') {
        videoTransceivers[1].direction = 'sendrecv';
      }
      if (videoTransceivers[1].sender.track !== screenTrack) {
        videoTransceivers[1].sender.replaceTrack(screenTrack).catch(() => {});
      }
    }
  }, []);

  // Initiate offer to a peer (Perfect Negotiation)
  const initiateOffer = useCallback(async (peerId: string) => {
    if (isMakingOffer.current.get(peerId)) return;
    try {
      const pc = peerConnections.current.get(peerId);
      if (!pc || pc.connectionState === 'closed') return;

      isMakingOffer.current.set(peerId, true);
      updateTracksForPeer(pc);

      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;

      await pc.setLocalDescription(offer);

      sendRtcSignal(peerId, {
        type: 'offer',
        description: pc.localDescription,
      });
    } catch (err) {
      console.warn('[WebRTC] offer creation warning:', err);
    } finally {
      isMakingOffer.current.set(peerId, false);
    }
  }, [updateTracksForPeer, sendRtcSignal]);

  const initiateOfferRef = useRef(initiateOffer);
  initiateOfferRef.current = initiateOffer;

  // Create or retrieve RTCPeerConnection with deterministic 4 transceivers
  const getOrCreatePeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    let pc = peerConnections.current.get(peerId);
    if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
      return pc;
    }

    if (pc) {
      try { pc.close(); } catch {}
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current.set(peerId, pc);

    // Deterministic transceivers order on all peers:
    // Slot 0 (audio): Mic
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    // Slot 1 (audio): Dedicated Screen Share Audio
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    // Slot 0 (video): Camera Stream
    pc.addTransceiver('video', { direction: 'sendrecv' });
    // Slot 1 (video): Screen Share Stream
    pc.addTransceiver('video', { direction: 'sendrecv' });

    // Initial track assignment
    updateTracksForPeer(pc);

    // Perfect negotiation trigger
    pc.onnegotiationneeded = async () => {
      await initiateOfferRef.current(peerId);
    };

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRtcSignal(peerId, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce?.();
        } catch {}
      }
    };

    // Track arrival handler
    pc.ontrack = (event) => {
      syncRemoteTracksForPeer(peerId, pc);
      event.track.onunmute = () => {
        syncRemoteTracksForPeer(peerId, pc);
      };
      event.track.onmute = () => {
        syncRemoteTracksForPeer(peerId, pc);
      };
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        syncRemoteTracksForPeer(peerId, pc);
      } else if (pc.connectionState === 'failed') {
        closePeer(peerId);
        setTimeout(() => {
          if (isMediaChannel) {
            initiateOfferRef.current(peerId);
          }
        }, 800);
      }
    };

    return pc;
  }, [sendRtcSignal, closePeer, isMediaChannel, syncRemoteTracksForPeer, updateTracksForPeer]);

  // Handle incoming signaling messages with Perfect Negotiation
  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!signal) return;

    try {
      const pc = getOrCreatePeerConnection(fromUserId);

      if (signal.type === 'offer') {
        const remoteDesc = signal.description || { type: 'offer', sdp: signal.sdp };
        // The peer with smaller ID is polite
        const isPolite = currentUserId.localeCompare(fromUserId) < 0;
        const offerCollision = isMakingOffer.current.get(fromUserId) || pc.signalingState !== 'stable';

        if (offerCollision) {
          if (!isPolite) {
            // Impolite peer ignores colliding offer
            return;
          }
          try {
            await pc.setLocalDescription({ type: 'rollback' } as any);
          } catch {}
        }

        await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));

        // Drain candidate queue
        const queue = candidateQueues.current.get(fromUserId) || [];
        for (const cand of queue) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        candidateQueues.current.delete(fromUserId);

        // Update local tracks before answering
        updateTracksForPeer(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendRtcSignal(fromUserId, {
          type: 'answer',
          description: pc.localDescription,
        });

        syncRemoteTracksForPeer(fromUserId, pc);
      } else if (signal.type === 'answer') {
        const remoteDesc = signal.description || { type: 'answer', sdp: signal.sdp };
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));

          // Drain candidate queue
          const queue = candidateQueues.current.get(fromUserId) || [];
          for (const cand of queue) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          candidateQueues.current.delete(fromUserId);

          syncRemoteTracksForPeer(fromUserId, pc);
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          const q = candidateQueues.current.get(fromUserId) || [];
          q.push(signal.candidate);
          candidateQueues.current.set(fromUserId, q);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] signal processing notice:', err);
    }
  }, [getOrCreatePeerConnection, sendRtcSignal, updateTracksForPeer, currentUserId, syncRemoteTracksForPeer]);

  const handleIncomingSignalRef = useRef(handleIncomingSignal);
  handleIncomingSignalRef.current = handleIncomingSignal;

  const closePeerRef = useRef(closePeer);
  closePeerRef.current = closePeer;

  // Register WebSocket Signal Handlers
  useEffect(() => {
    setRtcSignalHandler((fromUserId, signal) => {
      handleIncomingSignalRef.current(fromUserId, signal);
    });

    setMediaHandlers(
      (userId, channel) => {
        if (isMediaChannel && userId !== currentUserId) {
          const existing = peerConnections.current.get(userId);
          if (!existing || existing.connectionState === 'failed' || existing.connectionState === 'closed') {
            closePeerRef.current(userId);
            // Smaller ID acts as polite caller
            if (currentUserId.localeCompare(userId) > 0) {
              initiateOfferRef.current(userId);
            }
          } else {
            updateTracksForPeer(existing);
            syncRemoteTracksForPeer(userId, existing);
          }
        }
      },
      (userId) => {
        closePeerRef.current(userId);
      }
    );
  }, [setRtcSignalHandler, setMediaHandlers, isMediaChannel, currentUserId, updateTracksForPeer, syncRemoteTracksForPeer]);

  const peerIdsStr = peers.map((p) => p.id).sort().join(',');

  // Synchronize peer connections with current channel peers
  useEffect(() => {
    if (!isMediaChannel) {
      if (peerConnections.current.size > 0) {
        closeAllPeers();
      }
      return;
    }

    const peerIds = new Set(peers.map((p) => p.id));

    // Remove old peers no longer in channel
    Array.from(peerConnections.current.keys()).forEach((id) => {
      if (!peerIds.has(id)) {
        closePeer(id);
      }
    });

    // Update tracks for all existing peer connections
    peerConnections.current.forEach((pc, id) => {
      updateTracksForPeer(pc);
      syncRemoteTracksForPeer(id, pc);
    });

    // Initiate offer deterministically with higher user ID to prevent glare
    peers.forEach((peer) => {
      const existing = peerConnections.current.get(peer.id);
      const isConnected = existing && (existing.connectionState === 'connected');
      if (!isConnected) {
        if (currentUserId.localeCompare(peer.id) > 0) {
          initiateOffer(peer.id);
        }
      }
    });

    // Fallback timer: ensure connection even if signaling order races
    const fallbackTimer = setTimeout(() => {
      peers.forEach((peer) => {
        const existing = peerConnections.current.get(peer.id);
        const isConnected = existing && (existing.connectionState === 'connected');
        if (!isConnected) {
          initiateOffer(peer.id);
        }
      });
    }, 1200);

    return () => clearTimeout(fallbackTimer);
  }, [
    peerIdsStr,
    isMediaChannel,
    currentUserId,
    initiateOffer,
    closePeer,
    closeAllPeers,
    peers,
    updateTracksForPeer,
    syncRemoteTracksForPeer,
  ]);

  // Instant track replacement when local streams change (camera, screen, mic) - NO RENEGOTIATION NEEDED!
  useEffect(() => {
    if (!isMediaChannel) return;

    peerConnections.current.forEach((pc, peerId) => {
      updateTracksForPeer(pc);
      // If peer connection is connected, replaceTrack happens immediately on existing RTP stream!
      // If signaling is stable and negotiation is needed, trigger offer
      if (pc.signalingState === 'stable') {
        initiateOfferRef.current(peerId);
      }
    });
  }, [localAudioStream, cameraStream, screenStream, isMediaChannel, updateTracksForPeer]);

  // Volume decibel analyzer for speaking indicator
  useEffect(() => {
    if (!isMediaChannel) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const dataArray = new Uint8Array(128);

    const checkRemoteVolumes = () => {
      const speakingStatus: Record<string, boolean> = {};

      remoteAnalysers.current.forEach((analyser, peerId) => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        speakingStatus[peerId] = avg > 14;
      });

      setRemoteSpeaking((prev) => {
        let changed = false;
        for (const k in speakingStatus) {
          if (prev[k] !== speakingStatus[k]) {
            changed = true;
            break;
          }
        }
        return changed ? speakingStatus : prev;
      });

      animFrameRef.current = requestAnimationFrame(checkRemoteVolumes);
    };

    animFrameRef.current = requestAnimationFrame(checkRemoteVolumes);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isMediaChannel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeAllPeers();
      if (remoteAudioCtxRef.current && remoteAudioCtxRef.current.state !== 'closed') {
        remoteAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, [closeAllPeers]);

  return {
    remoteStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking,
    closePeer,
    closeAllPeers,
  };
}
