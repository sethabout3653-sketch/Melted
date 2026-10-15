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
      urls: [
        'turn:standard.relay.metered.ca:80',
        'turn:standard.relay.metered.ca:443',
        'turns:standard.relay.metered.ca:443?transport=tcp',
      ],
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
  // - remoteStreams: audio tracks (mic and screen audio)
  // - remoteCameraStreams: camera video track
  // - remoteScreenStreams: screen share video track
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  // Active Peer Connections: peerId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE candidate queue per peer
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Track IDs communicated by remote peers: peerId -> { camTrackId?, screenTrackId? }
  const remoteTrackInfo = useRef<Map<string, { camTrackId?: string | null; screenTrackId?: string | null }>>(new Map());
  // Senders mapped by purpose on each peer connection: peerId -> { audio?, camera?, screen?, screenAudio? }
  const localSenders = useRef<Map<string, { audio?: RTCRtpSender; camera?: RTCRtpSender; screen?: RTCRtpSender; screenAudio?: RTCRtpSender }>>(new Map());

  // Negotiation state
  const isMakingOffer = useRef<Map<string, boolean>>(new Map());
  const isSettingRemoteDesc = useRef<Map<string, boolean>>(new Map());

  // Audio analysers for speaking volume
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  const isMediaChannel = activeChannel === 'voice-general' || activeChannel === 'video-general';

  // Latest stream references
  const localAudioRef = useRef<MediaStream | null>(localAudioStream);
  const cameraStreamRef = useRef<MediaStream | null>(cameraStream || null);
  const screenStreamRef = useRef<MediaStream | null>(screenStream || null);
  const peersRef = useRef<DbUser[]>(peers);
  localAudioRef.current = localAudioStream;
  cameraStreamRef.current = cameraStream || null;
  screenStreamRef.current = screenStream || null;
  peersRef.current = peers;

  // Clean up single peer
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
    remoteTrackInfo.current.delete(peerId);
    localSenders.current.delete(peerId);
    isMakingOffer.current.delete(peerId);
    isSettingRemoteDesc.current.delete(peerId);
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
    remoteTrackInfo.current.clear();
    localSenders.current.clear();
    isMakingOffer.current.clear();
    isSettingRemoteDesc.current.clear();
    remoteAnalysers.current.clear();
    setRemoteStreams({});
    setRemoteCameraStreams({});
    setRemoteScreenStreams({});
    setRemoteSpeaking({});
  }, []);

  // Attach remote audio track to analyser to detect speech
  const setupRemoteAudioAnalysis = useCallback((peerId: string, track: MediaStreamTrack) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!remoteAudioCtxRef.current || remoteAudioCtxRef.current.state === 'closed') {
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
    } catch {}
  }, []);

  // Classify and sync remote tracks received from RTCPeerConnection
  const syncRemoteTracksForPeer = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const receivers = pc.getReceivers();
    const trackInfo = remoteTrackInfo.current.get(peerId);
    const peerDbUser = peersRef.current.find((p) => p.id === peerId);

    // 1. Audio tracks
    const audioTracks = receivers
      .map((r) => r.track)
      .filter((t): t is MediaStreamTrack => Boolean(t && t.kind === 'audio' && t.readyState !== 'ended'));

    if (audioTracks.length > 0) {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: new MediaStream(audioTracks),
      }));
      setupRemoteAudioAnalysis(peerId, audioTracks[0]);
    }

    // 2. Video tracks
    const videoTracks = receivers
      .map((r) => r.track)
      .filter((t): t is MediaStreamTrack => Boolean(t && t.kind === 'video' && t.readyState !== 'ended'));

    if (videoTracks.length === 0) {
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
      return;
    }

    let foundCamTrack: MediaStreamTrack | null = null;
    let foundScrTrack: MediaStreamTrack | null = null;

    for (const vTrack of videoTracks) {
      const isExplicitScreen =
        (trackInfo?.screenTrackId && vTrack.id === trackInfo.screenTrackId) ||
        vTrack.label.toLowerCase().includes('screen') ||
        vTrack.label.toLowerCase().includes('display') ||
        vTrack.contentHint === 'detail';

      const isExplicitCam =
        (trackInfo?.camTrackId && vTrack.id === trackInfo.camTrackId) ||
        vTrack.label.toLowerCase().includes('cam') ||
        vTrack.label.toLowerCase().includes('user') ||
        vTrack.label.toLowerCase().includes('face');

      if (isExplicitScreen) {
        foundScrTrack = vTrack;
      } else if (isExplicitCam) {
        foundCamTrack = vTrack;
      }
    }

    // Fallback logic when labels are generic
    if (!foundCamTrack && !foundScrTrack) {
      if (videoTracks.length === 1) {
        if (peerDbUser?.is_screen_sharing && !peerDbUser?.has_video) {
          foundScrTrack = videoTracks[0];
        } else {
          foundCamTrack = videoTracks[0];
        }
      } else if (videoTracks.length >= 2) {
        foundCamTrack = videoTracks[0];
        foundScrTrack = videoTracks[1];
      }
    } else if (videoTracks.length >= 2) {
      if (foundScrTrack && !foundCamTrack) {
        foundCamTrack = videoTracks.find((t) => t.id !== foundScrTrack?.id) || null;
      } else if (foundCamTrack && !foundScrTrack) {
        foundScrTrack = videoTracks.find((t) => t.id !== foundCamTrack?.id) || null;
      }
    }

    // Update camera stream state
    if (foundCamTrack) {
      setRemoteCameraStreams((prev) => ({
        ...prev,
        [peerId]: new MediaStream([foundCamTrack!]),
      }));
    } else {
      setRemoteCameraStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }

    // Update screen stream state
    if (foundScrTrack) {
      setRemoteScreenStreams((prev) => ({
        ...prev,
        [peerId]: new MediaStream([foundScrTrack!]),
      }));
    } else {
      setRemoteScreenStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }
  }, [setupRemoteAudioAnalysis]);

  // Synchronize local tracks to peer connection senders
  const updateTracksForPeer = useCallback((peerId: string, pc: RTCPeerConnection) => {
    let sendersMap = localSenders.current.get(peerId);
    if (!sendersMap) {
      sendersMap = {};
      localSenders.current.set(peerId, sendersMap);
    }

    const localAudioTrack = localAudioRef.current?.getAudioTracks().find((t) => t.readyState === 'live') || null;
    const cameraTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    const screenTrack = screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks().find((t) => t.readyState === 'live') || null;

    let needsRenegotiation = false;

    // 1. Microphone Audio Track
    if (sendersMap.audio && pc.getSenders().includes(sendersMap.audio)) {
      if (sendersMap.audio.track !== localAudioTrack) {
        sendersMap.audio.replaceTrack(localAudioTrack).catch(() => {});
      }
    } else if (localAudioTrack) {
      const audioStream = new MediaStream([localAudioTrack]);
      sendersMap.audio = pc.addTrack(localAudioTrack, audioStream);
      needsRenegotiation = true;
    }

    // 2. Dedicated Screen Audio Track
    if (sendersMap.screenAudio && pc.getSenders().includes(sendersMap.screenAudio)) {
      if (sendersMap.screenAudio.track !== screenAudioTrack) {
        sendersMap.screenAudio.replaceTrack(screenAudioTrack).catch(() => {});
      }
    } else if (screenAudioTrack) {
      const scrAudioStream = new MediaStream([screenAudioTrack]);
      sendersMap.screenAudio = pc.addTrack(screenAudioTrack, scrAudioStream);
      needsRenegotiation = true;
    }

    // 3. Camera Video Track
    if (sendersMap.camera && pc.getSenders().includes(sendersMap.camera)) {
      if (sendersMap.camera.track !== cameraTrack) {
        sendersMap.camera.replaceTrack(cameraTrack).catch(() => {});
      }
    } else if (cameraTrack) {
      const camStream = new MediaStream([cameraTrack]);
      sendersMap.camera = pc.addTrack(cameraTrack, camStream);
      needsRenegotiation = true;
    }

    // 4. Screen Share Video Track
    if (sendersMap.screen && pc.getSenders().includes(sendersMap.screen)) {
      if (sendersMap.screen.track !== screenTrack) {
        sendersMap.screen.replaceTrack(screenTrack).catch(() => {});
      }
    } else if (screenTrack) {
      const scrStream = new MediaStream([screenTrack]);
      sendersMap.screen = pc.addTrack(screenTrack, scrStream);
      needsRenegotiation = true;
    }

    return needsRenegotiation;
  }, []);

  // Send SDP Offer (Perfect Negotiation)
  const initiateOffer = useCallback(async (peerId: string) => {
    if (isMakingOffer.current.get(peerId)) return;
    const pc = peerConnections.current.get(peerId);
    if (!pc || pc.connectionState === 'closed') return;

    try {
      isMakingOffer.current.set(peerId, true);
      updateTracksForPeer(peerId, pc);

      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;

      await pc.setLocalDescription(offer);

      sendRtcSignal(peerId, {
        type: 'offer',
        description: pc.localDescription,
      });

      // Broadcast track map so remote knows which track is camera vs screen
      const cameraTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
      const screenTrack = screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
      sendRtcSignal(peerId, {
        type: 'TRACK_MAP',
        camTrackId: cameraTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
      });
    } catch (err) {
      console.warn('[WebRTC] initiateOffer warning:', err);
    } finally {
      isMakingOffer.current.set(peerId, false);
    }
  }, [updateTracksForPeer, sendRtcSignal]);

  const initiateOfferRef = useRef(initiateOffer);
  initiateOfferRef.current = initiateOffer;

  // Create or retrieve RTCPeerConnection for a peer
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

    // Initial track assignment
    updateTracksForPeer(peerId, pc);

    // Ensure transceivers exist to receive remote streams even if local has not yet added tracks
    const existingAudio = pc.getTransceivers().some((t) => t.receiver.track.kind === 'audio');
    if (!existingAudio) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
    const existingVideo = pc.getTransceivers().some((t) => t.receiver.track.kind === 'video');
    if (!existingVideo) {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

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

    // Incoming track arrival
    pc.ontrack = (event) => {
      const track = event.track;
      const updateSync = () => {
        syncRemoteTracksForPeer(peerId, pc);
      };

      updateSync();
      track.onunmute = updateSync;
      track.onmute = updateSync;
      track.onended = updateSync;
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
        }, 1000);
      }
    };

    return pc;
  }, [sendRtcSignal, closePeer, isMediaChannel, syncRemoteTracksForPeer, updateTracksForPeer]);

  // Handle incoming signaling messages with Perfect Negotiation
  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!signal) return;

    try {
      // Handle Track Map signal (Camera vs Screen track IDs)
      if (signal.type === 'TRACK_MAP') {
        remoteTrackInfo.current.set(fromUserId, {
          camTrackId: signal.camTrackId,
          screenTrackId: signal.screenTrackId,
        });
        const pc = peerConnections.current.get(fromUserId);
        if (pc) {
          syncRemoteTracksForPeer(fromUserId, pc);
        }
        return;
      }

      const pc = getOrCreatePeerConnection(fromUserId);

      if (signal.type === 'offer') {
        const remoteDesc = signal.description || { type: 'offer', sdp: signal.sdp };
        // The peer with smaller ID is polite
        const isPolite = currentUserId.localeCompare(fromUserId) < 0;
        const offerCollision = isMakingOffer.current.get(fromUserId) || pc.signalingState !== 'stable';

        if (offerCollision) {
          if (!isPolite) {
            return; // Impolite ignores colliding offer
          }
          try {
            await pc.setLocalDescription({ type: 'rollback' } as any);
          } catch {}
        }

        isSettingRemoteDesc.current.set(fromUserId, true);
        await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
        isSettingRemoteDesc.current.set(fromUserId, false);

        // Drain candidate queue
        const queue = candidateQueues.current.get(fromUserId) || [];
        for (const cand of queue) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        candidateQueues.current.delete(fromUserId);

        // Update local tracks before answering
        updateTracksForPeer(fromUserId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendRtcSignal(fromUserId, {
          type: 'answer',
          description: pc.localDescription,
        });

        // Also broadcast track map
        const cameraTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
        const screenTrack = screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
        sendRtcSignal(fromUserId, {
          type: 'TRACK_MAP',
          camTrackId: cameraTrack?.id || null,
          screenTrackId: screenTrack?.id || null,
        });

        syncRemoteTracksForPeer(fromUserId, pc);
      } else if (signal.type === 'answer') {
        const remoteDesc = signal.description || { type: 'answer', sdp: signal.sdp };
        if (pc.signalingState === 'have-local-offer') {
          isSettingRemoteDesc.current.set(fromUserId, true);
          await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
          isSettingRemoteDesc.current.set(fromUserId, false);

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
      console.warn('[WebRTC] signal warning:', err);
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
      (userId) => {
        if (isMediaChannel && userId !== currentUserId) {
          const existing = peerConnections.current.get(userId);
          if (!existing || existing.connectionState === 'failed' || existing.connectionState === 'closed') {
            closePeerRef.current(userId);
            // Higher user ID initiates call
            if (currentUserId.localeCompare(userId) > 0) {
              initiateOfferRef.current(userId);
            }
          } else {
            updateTracksForPeer(userId, existing);
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

    // Close peers who left
    Array.from(peerConnections.current.keys()).forEach((id) => {
      if (!peerIds.has(id)) {
        closePeer(id);
      }
    });

    // Update tracks for existing peers
    peerConnections.current.forEach((pc, id) => {
      updateTracksForPeer(id, pc);
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

  // Instant track replacement when local streams change (camera, screen, mic)
  useEffect(() => {
    if (!isMediaChannel) return;

    peerConnections.current.forEach((pc, peerId) => {
      const needsRenegotiation = updateTracksForPeer(peerId, pc);

      // Broadcast track map so remote immediately associates track IDs
      const cameraTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
      const screenTrack = screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live');
      sendRtcSignal(peerId, {
        type: 'TRACK_MAP',
        camTrackId: cameraTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
      });

      if (needsRenegotiation && pc.signalingState === 'stable') {
        initiateOfferRef.current(peerId);
      }
    });
  }, [localAudioStream, cameraStream, screenStream, isMediaChannel, updateTracksForPeer, sendRtcSignal]);

  // Speaking detection
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
