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
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  iceCandidatePoolSize: 10,
};

export interface MediaTrackMeta {
  cameraStreamId?: string | null;
  screenStreamId?: string | null;
  cameraTrackId?: string | null;
  screenTrackId?: string | null;
  audioTrackId?: string | null;
  isVertical?: boolean;
}

interface PeerSenders {
  audio?: RTCRtpSender | null;
  camera?: RTCRtpSender | null;
  screen?: RTCRtpSender | null;
}

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general' | 'video-general';
  localAudioStream: MediaStream | null;
  localVideoStream?: MediaStream | null;
  cameraStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  isVertical?: boolean;
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
  isVertical = false,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});
  const [peerOrientations, setPeerOrientations] = useState<Record<string, boolean>>({});

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerSenders = useRef<Map<string, PeerSenders>>(new Map());
  const peerTrackMeta = useRef<Map<string, MediaTrackMeta>>(new Map());
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isMakingOffer = useRef<Map<string, boolean>>(new Map());
  const needsRenegotiation = useRef<Map<string, boolean>>(new Map());
  const peerDisconnectTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Audio analysers for speech indicator
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  const isMediaChannel = activeChannel === 'voice-general' || activeChannel === 'video-general';

  const localAudioRef = useRef<MediaStream | null>(localAudioStream);
  const cameraStreamRef = useRef<MediaStream | null>(cameraStream || null);
  const screenStreamRef = useRef<MediaStream | null>(screenStream || null);
  const isVerticalRef = useRef<boolean>(isVertical);

  localAudioRef.current = localAudioStream;
  cameraStreamRef.current = cameraStream || null;
  screenStreamRef.current = screenStream || null;
  isVerticalRef.current = isVertical;

  const peersRef = useRef<DbUser[]>(peers);
  peersRef.current = peers;

  // Clean up a single peer connection
  const closePeer = useCallback((peerId: string) => {
    const timer = peerDisconnectTimers.current.get(peerId);
    if (timer) {
      clearTimeout(timer);
      peerDisconnectTimers.current.delete(peerId);
    }

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
    peerSenders.current.delete(peerId);
    candidateQueues.current.delete(peerId);
    isMakingOffer.current.delete(peerId);
    needsRenegotiation.current.delete(peerId);
    peerTrackMeta.current.delete(peerId);
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

    setPeerOrientations((prev) => {
      if (!prev[`${peerId}-camera`]) return prev;
      const copy = { ...prev };
      delete copy[`${peerId}-camera`];
      return copy;
    });
  }, []);

  const closeAllPeers = useCallback(() => {
    peerDisconnectTimers.current.forEach((t) => clearTimeout(t));
    peerDisconnectTimers.current.clear();

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
    peerSenders.current.clear();
    candidateQueues.current.clear();
    isMakingOffer.current.clear();
    needsRenegotiation.current.clear();
    peerTrackMeta.current.clear();
    remoteAnalysers.current.clear();

    setRemoteStreams({});
    setRemoteCameraStreams({});
    setRemoteScreenStreams({});
    setRemoteSpeaking({});
    setPeerOrientations({});
  }, []);

  // Set up remote audio analysis for speech level detection
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
    } catch {}
  }, []);

  // Update senders for local audio, camera, and screen sharing tracks
  const updateTracksForPeer = useCallback((pc: RTCPeerConnection, peerId: string) => {
    let senders = peerSenders.current.get(peerId);
    if (!senders) {
      senders = {};
      peerSenders.current.set(peerId, senders);
    }

    const pcSenders = pc.getSenders();
    const pcTransceivers = pc.getTransceivers();

    // 1. Microphone Audio Track
    const audioTrack = localAudioRef.current?.getAudioTracks().find((t) => t.readyState === 'live') || null;
    if (senders.audio && pcSenders.includes(senders.audio)) {
      if (senders.audio.track !== audioTrack) {
        senders.audio.replaceTrack(audioTrack).catch(() => {});
      }
    } else {
      const existingAudioTrans = pcTransceivers.find((t) => t.receiver.track.kind === 'audio');
      if (existingAudioTrans) {
        senders.audio = existingAudioTrans.sender;
        if (existingAudioTrans.sender.track !== audioTrack) {
          existingAudioTrans.sender.replaceTrack(audioTrack).catch(() => {});
        }
      } else if (audioTrack && localAudioRef.current) {
        try {
          senders.audio = pc.addTrack(audioTrack, localAudioRef.current);
        } catch {}
      } else {
        try {
          const aTrans = pc.addTransceiver('audio', { direction: 'sendrecv' });
          senders.audio = aTrans.sender;
        } catch {}
      }
    }

    // 2. Camera Video Track
    const cameraTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    const videoTransceivers = pcTransceivers.filter((t) => t.receiver.track.kind === 'video');

    if (senders.camera && pcSenders.includes(senders.camera)) {
      if (senders.camera.track !== cameraTrack) {
        senders.camera.replaceTrack(cameraTrack).catch(() => {});
      }
    } else {
      if (videoTransceivers.length > 0) {
        senders.camera = videoTransceivers[0].sender;
        if (videoTransceivers[0].sender.track !== cameraTrack) {
          videoTransceivers[0].sender.replaceTrack(cameraTrack).catch(() => {});
        }
      } else if (cameraTrack && cameraStreamRef.current) {
        try {
          senders.camera = pc.addTrack(cameraTrack, cameraStreamRef.current);
        } catch {}
      } else {
        try {
          const camTrans = pc.addTransceiver('video', { direction: 'sendrecv' });
          senders.camera = camTrans.sender;
        } catch {}
      }
    }

    // 3. Screen Share Video Track
    const screenTrack = screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    if (senders.screen && pcSenders.includes(senders.screen)) {
      if (senders.screen.track !== screenTrack) {
        senders.screen.replaceTrack(screenTrack).catch(() => {});
      }
    } else {
      if (videoTransceivers.length > 1) {
        senders.screen = videoTransceivers[1].sender;
        if (videoTransceivers[1].sender.track !== screenTrack) {
          videoTransceivers[1].sender.replaceTrack(screenTrack).catch(() => {});
        }
      } else if (screenTrack && screenStreamRef.current) {
        try {
          senders.screen = pc.addTrack(screenTrack, screenStreamRef.current);
        } catch {}
      } else {
        try {
          const scrTrans = pc.addTransceiver('video', { direction: 'sendrecv' });
          senders.screen = scrTrans.sender;
        } catch {}
      }
    }

    peerSenders.current.set(peerId, senders);
  }, []);

  // Synchronize remote tracks for a peer based on transceivers & metadata
  const syncRemoteTracksForPeer = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const peerMeta = peerTrackMeta.current.get(peerId);
    const peerUser = peersRef.current.find((p) => p.id === peerId);

    const aTrans = pc.getTransceivers().filter((t) => t.receiver.track.kind === 'audio');
    const audioTracks: MediaStreamTrack[] = [];
    aTrans.forEach((t) => {
      const track = t.receiver.track;
      if (track && track.readyState !== 'ended') {
        track.enabled = true;
        audioTracks.push(track);
      }
    });

    if (audioTracks.length > 0) {
      setRemoteStreams((prev) => {
        const existing = prev[peerId];
        const existingIds = existing?.getAudioTracks().map((t) => t.id).join(',');
        const newIds = audioTracks.map((t) => t.id).join(',');
        if (existing && existingIds === newIds) return prev;
        return {
          ...prev,
          [peerId]: new MediaStream(audioTracks),
        };
      });
      setupRemoteAudioAnalysis(peerId, audioTracks[0]);
    }

    const vTrans = pc.getTransceivers().filter((t) => t.receiver.track.kind === 'video');
    if (vTrans.length > 0) {
      const camTrack = vTrans[0].receiver.track;
      if (camTrack && camTrack.readyState !== 'ended') {
        camTrack.enabled = true;
        setRemoteCameraStreams((prev) => ({
          ...prev,
          [peerId]: new MediaStream([camTrack]),
        }));
      } else if (peerUser?.has_video === false) {
        setRemoteCameraStreams((prev) => {
          if (!prev[peerId]) return prev;
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
      }

      if (vTrans.length > 1) {
        const scrTrack = vTrans[1].receiver.track;
        if (scrTrack && scrTrack.readyState !== 'ended') {
          scrTrack.enabled = true;
          setRemoteScreenStreams((prev) => ({
            ...prev,
            [peerId]: new MediaStream([scrTrack]),
          }));
        } else if (peerUser?.is_screen_sharing === false) {
          setRemoteScreenStreams((prev) => {
            if (!prev[peerId]) return prev;
            const copy = { ...prev };
            delete copy[peerId];
            return copy;
          });
        }
      }
    }

    if (peerMeta?.isVertical !== undefined) {
      setPeerOrientations((prev) => ({
        ...prev,
        [`${peerId}-camera`]: Boolean(peerMeta.isVertical),
      }));
    }
  }, [setupRemoteAudioAnalysis]);

  // Create or get RTCPeerConnection
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

    updateTracksForPeer(pc, peerId);

    pc.onnegotiationneeded = async () => {
      try {
        await initiateOfferRef.current(peerId);
      } catch {}
    };

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
          pc.restartIce();
        } catch {}
      }
    };

    pc.ontrack = (event: RTCTrackEvent) => {
      const [remoteStream] = event.streams;
      const track = event.track;
      const streamToUse = remoteStream || new MediaStream([track]);

      if (track.kind === 'audio') {
        track.enabled = true;
        setRemoteStreams((prev) => {
          const existing = prev[peerId];
          if (existing) {
            const hasTrack = existing.getAudioTracks().some((t) => t.id === track.id);
            if (!hasTrack) {
              existing.addTrack(track);
              return { ...prev, [peerId]: new MediaStream(existing.getAudioTracks()) };
            }
            return prev;
          }
          return { ...prev, [peerId]: streamToUse };
        });
        setupRemoteAudioAnalysis(peerId, track);
      } else if (track.kind === 'video') {
        track.enabled = true;
        const peerMeta = peerTrackMeta.current.get(peerId);
        const peerUser = peersRef.current.find((p) => p.id === peerId);

        const vTrans = pc.getTransceivers().filter((t) => t.receiver.track.kind === 'video');
        const isSecondTransceiver = vTrans.length > 1 && vTrans[1].receiver.track.id === track.id;

        const isScreen = Boolean(
          isSecondTransceiver ||
          (peerMeta?.screenStreamId && streamToUse.id === peerMeta.screenStreamId) ||
          (peerMeta?.screenTrackId && track.id === peerMeta.screenTrackId) ||
          (peerUser?.is_screen_sharing && !peerUser?.has_video)
        );

        if (isScreen) {
          setRemoteScreenStreams((prev) => ({ ...prev, [peerId]: streamToUse }));
        } else {
          setRemoteCameraStreams((prev) => ({ ...prev, [peerId]: streamToUse }));
        }

        const handleUnmute = () => {
          track.enabled = true;
          if (isScreen) {
            setRemoteScreenStreams((prev) => ({ ...prev, [peerId]: streamToUse }));
          } else {
            setRemoteCameraStreams((prev) => ({ ...prev, [peerId]: streamToUse }));
          }
        };

        track.onunmute = handleUnmute;
        track.onended = () => {
          syncRemoteTracksForPeer(peerId, pc);
        };
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const timer = peerDisconnectTimers.current.get(peerId);
        if (timer) {
          clearTimeout(timer);
          peerDisconnectTimers.current.delete(peerId);
        }
        syncRemoteTracksForPeer(peerId, pc);
      } else if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {}
      }
    };

    return pc;
  }, [sendRtcSignal, syncRemoteTracksForPeer, updateTracksForPeer, setupRemoteAudioAnalysis]);

  // Initiate offer (Perfect Negotiation)
  const initiateOffer = useCallback(async (peerId: string) => {
    if (isMakingOffer.current.get(peerId)) {
      needsRenegotiation.current.set(peerId, true);
      return;
    }
    try {
      isMakingOffer.current.set(peerId, true);
      const pc = getOrCreatePeerConnection(peerId);

      if (pc.signalingState !== 'stable') {
        needsRenegotiation.current.set(peerId, true);
        return;
      }

      updateTracksForPeer(pc, peerId);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      const mediaMeta: MediaTrackMeta = {
        cameraStreamId: cameraStreamRef.current?.id || null,
        screenStreamId: screenStreamRef.current?.id || null,
        cameraTrackId: cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live')?.id || null,
        screenTrackId: screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live')?.id || null,
        audioTrackId: localAudioRef.current?.getAudioTracks().find((t) => t.readyState === 'live')?.id || null,
        isVertical: isVerticalRef.current || false,
      };

      sendRtcSignal(peerId, {
        type: 'offer',
        sdp: pc.localDescription?.sdp,
        description: {
          type: pc.localDescription?.type,
          sdp: pc.localDescription?.sdp,
        },
        mediaMeta,
      });
    } catch (err) {
      console.warn('[WebRTC] offer creation error:', err);
    } finally {
      isMakingOffer.current.set(peerId, false);
    }
  }, [getOrCreatePeerConnection, updateTracksForPeer, sendRtcSignal]);

  // Handle incoming signaling message with collision handling
  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!signal) return;

    try {
      const pc = getOrCreatePeerConnection(fromUserId);

      if (signal.mediaMeta) {
        peerTrackMeta.current.set(fromUserId, signal.mediaMeta);
        if (signal.mediaMeta.isVertical !== undefined) {
          setPeerOrientations((prev) => ({
            ...prev,
            [`${fromUserId}-camera`]: Boolean(signal.mediaMeta.isVertical),
          }));
        }
      }

      if (signal.type === 'offer') {
        const remoteDesc = signal.description || { type: 'offer', sdp: signal.sdp };
        const isPolite = currentUserId.localeCompare(fromUserId) > 0;
        const offerCollision = pc.signalingState !== 'stable' || isMakingOffer.current.get(fromUserId);

        if (offerCollision) {
          if (!isPolite) {
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

        updateTracksForPeer(pc, fromUserId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const mediaMeta: MediaTrackMeta = {
          cameraStreamId: cameraStreamRef.current?.id || null,
          screenStreamId: screenStreamRef.current?.id || null,
          cameraTrackId: cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live')?.id || null,
          screenTrackId: screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live')?.id || null,
          audioTrackId: localAudioRef.current?.getAudioTracks().find((t) => t.readyState === 'live')?.id || null,
          isVertical: isVerticalRef.current || false,
        };

        sendRtcSignal(fromUserId, {
          type: 'answer',
          sdp: pc.localDescription?.sdp,
          description: {
            type: pc.localDescription?.type,
            sdp: pc.localDescription?.sdp,
          },
          mediaMeta,
        });

        syncRemoteTracksForPeer(fromUserId, pc);

        if (needsRenegotiation.current.get(fromUserId)) {
          needsRenegotiation.current.delete(fromUserId);
          initiateOfferRef.current(fromUserId);
        }
      } else if (signal.type === 'answer') {
        const remoteDesc = signal.description || { type: 'answer', sdp: signal.sdp };
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));

          const queue = candidateQueues.current.get(fromUserId) || [];
          for (const cand of queue) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          candidateQueues.current.delete(fromUserId);

          syncRemoteTracksForPeer(fromUserId, pc);

          if (needsRenegotiation.current.get(fromUserId)) {
            needsRenegotiation.current.delete(fromUserId);
            initiateOfferRef.current(fromUserId);
          }
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          const q = candidateQueues.current.get(fromUserId) || [];
          q.push(signal.candidate);
          candidateQueues.current.set(fromUserId, q);
        }
      } else if (signal.type === 'track-meta') {
        if (signal.mediaMeta) {
          peerTrackMeta.current.set(fromUserId, signal.mediaMeta);
          if (signal.mediaMeta.isVertical !== undefined) {
            setPeerOrientations((prev) => ({
              ...prev,
              [`${fromUserId}-camera`]: Boolean(signal.mediaMeta.isVertical),
            }));
          }
          syncRemoteTracksForPeer(fromUserId, pc);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] signal error:', err);
    }
  }, [getOrCreatePeerConnection, sendRtcSignal, updateTracksForPeer, currentUserId, syncRemoteTracksForPeer]);

  const handleIncomingSignalRef = useRef(handleIncomingSignal);
  handleIncomingSignalRef.current = handleIncomingSignal;

  const initiateOfferRef = useRef(initiateOffer);
  initiateOfferRef.current = initiateOffer;

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
          const timer = peerDisconnectTimers.current.get(userId);
          if (timer) {
            clearTimeout(timer);
            peerDisconnectTimers.current.delete(userId);
          }

          const existing = peerConnections.current.get(userId);
          if (!existing || existing.connectionState === 'failed' || existing.connectionState === 'closed') {
            closePeerRef.current(userId);
            initiateOfferRef.current(userId);
          } else {
            updateTracksForPeer(existing, userId);
            if (existing.signalingState === 'stable') {
              initiateOfferRef.current(userId);
            }
          }
        }
      },
      (userId) => {
        closePeerRef.current(userId);
      }
    );
  }, [setRtcSignalHandler, setMediaHandlers, isMediaChannel, currentUserId, updateTracksForPeer]);

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

    peerIds.forEach((id) => {
      const timer = peerDisconnectTimers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        peerDisconnectTimers.current.delete(id);
      }
    });

    Array.from(peerConnections.current.keys()).forEach((id) => {
      if (!peerIds.has(id)) {
        if (!peerDisconnectTimers.current.has(id)) {
          const timer = setTimeout(() => {
            peerDisconnectTimers.current.delete(id);
            closePeer(id);
          }, 3500);
          peerDisconnectTimers.current.set(id, timer);
        }
      }
    });

    peerConnections.current.forEach((pc, id) => {
      updateTracksForPeer(pc, id);
      syncRemoteTracksForPeer(id, pc);
    });

    peers.forEach((peer) => {
      const existing = peerConnections.current.get(peer.id);
      const isConnected = existing && (existing.connectionState === 'connected');
      if (!isConnected) {
        initiateOffer(peer.id);
      }
    });
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

  // Update tracks across active connections when local streams change (camera, screen, mic)
  useEffect(() => {
    if (!isMediaChannel) return;

    const mediaMeta: MediaTrackMeta = {
      cameraStreamId: cameraStream?.id || null,
      screenStreamId: screenStream?.id || null,
      cameraTrackId: cameraStream?.getVideoTracks().find((t) => t.readyState === 'live')?.id || null,
      screenTrackId: screenStream?.getVideoTracks().find((t) => t.readyState === 'live')?.id || null,
      audioTrackId: localAudioStream?.getAudioTracks().find((t) => t.readyState === 'live')?.id || null,
      isVertical: isVertical,
    };

    peerConnections.current.forEach((pc, peerId) => {
      updateTracksForPeer(pc, peerId);
      sendRtcSignal(peerId, {
        type: 'track-meta',
        mediaMeta,
      });
      if (pc.signalingState === 'stable') {
        initiateOfferRef.current(peerId);
      } else {
        needsRenegotiation.current.set(peerId, true);
      }
    });
  }, [localAudioStream, cameraStream, screenStream, isVertical, isMediaChannel, updateTracksForPeer, sendRtcSignal]);

  // Volume decibel analyzer for speaking status
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
    peerOrientations,
    setPeerOrientations,
    closePeer,
    closeAllPeers,
  };
}
