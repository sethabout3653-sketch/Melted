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

  // Synchronize tracks into peer connection ONLY when tracks genuinely exist!
  const updateTracksForPeer = useCallback((pc: RTCPeerConnection, peerId: string) => {
    let senders = peerSenders.current.get(peerId);
    if (!senders) {
      senders = {};
      peerSenders.current.set(peerId, senders);
    }

    const pcSenders = pc.getSenders();

    // 1. Microphone Audio Track
    const audioTrack = localAudioRef.current?.getAudioTracks().find((t) => t.readyState === 'live') || null;
    if (audioTrack) {
      audioTrack.enabled = true;
      if (senders.audio && pcSenders.includes(senders.audio)) {
        if (senders.audio.track !== audioTrack) {
          senders.audio.replaceTrack(audioTrack).catch(() => {});
        }
      } else if (localAudioRef.current) {
        try {
          senders.audio = pc.addTrack(audioTrack, localAudioRef.current);
        } catch {}
      }
    } else if (senders.audio && pcSenders.includes(senders.audio)) {
      try {
        senders.audio.replaceTrack(null).catch(() => {});
      } catch {}
    }

    // 2. Camera Video Track: Add ONLY when camera is actually ON
    const cameraTrack = cameraStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    if (cameraTrack && cameraStreamRef.current) {
      console.log(`[WebRTC] Adding camera track for peer ${peerId}:`, cameraTrack.id);
      cameraTrack.enabled = true;
      if (senders.camera && pcSenders.includes(senders.camera)) {
        if (senders.camera.track !== cameraTrack) {
          console.log(`[WebRTC] Replacing camera track for peer ${peerId}:`, cameraTrack.id);
          senders.camera.replaceTrack(cameraTrack).catch(() => {});
        }
      } else {
        try {
          console.log(`[WebRTC] Adding NEW camera track for peer ${peerId}:`, cameraTrack.id);
          senders.camera = pc.addTrack(cameraTrack, cameraStreamRef.current);
        } catch (e) {
          console.error(`[WebRTC] Failed to add camera track for ${peerId}:`, e);
        }
      }
    } else if (senders.camera && pcSenders.includes(senders.camera)) {
      console.log(`[WebRTC] Removing camera track for peer ${peerId}`);
      try {
        pc.removeTrack(senders.camera);
      } catch {}
      senders.camera = null;
    }

    // 3. Screen Share Video Track: Add ONLY when screen share is actually ON
    const screenTrack = screenStreamRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    if (screenTrack && screenStreamRef.current) {
      screenTrack.enabled = true;
      if (senders.screen && pcSenders.includes(senders.screen)) {
        if (senders.screen.track !== screenTrack) {
          senders.screen.replaceTrack(screenTrack).catch(() => {});
        }
      } else {
        try {
          senders.screen = pc.addTrack(screenTrack, screenStreamRef.current);
        } catch {}
      }
    } else if (senders.screen && pcSenders.includes(senders.screen)) {
      try {
        pc.removeTrack(senders.screen);
      } catch {}
      senders.screen = null;
    }

    peerSenders.current.set(peerId, senders);
  }, []);

  // Synchronize remote tracks for a peer based on peer status
  const syncRemoteTracksForPeer = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const peerMeta = peerTrackMeta.current.get(peerId);
    const peerUser = peersRef.current.find((p) => p.id === peerId);

    // Audio tracks
    const audioReceivers = pc.getReceivers().filter(
      (r) => r.track && r.track.kind === 'audio' && r.track.readyState !== 'ended'
    );
    const audioTracks = audioReceivers.map((r) => r.track);
    if (audioTracks.length > 0) {
      audioTracks.forEach((t) => { t.enabled = true; });
      setRemoteStreams((prev) => {
        const existing = prev[peerId];
        if (existing && existing.getAudioTracks()[0]?.id === audioTracks[0].id) {
          return prev;
        }
        return { ...prev, [peerId]: new MediaStream(audioTracks) };
      });
      setupRemoteAudioAnalysis(peerId, audioTracks[0]);
    }

    // If peer does not have camera on, purge remote camera stream immediately!
    if (!peerUser?.has_video) {
      setRemoteCameraStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }

    // If peer is not sharing screen, purge remote screen stream immediately!
    if (!peerUser?.is_screen_sharing) {
      setRemoteScreenStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }

    // Process active video receivers only if the peer actually has video or screen sharing active
    if (peerUser?.has_video || peerUser?.is_screen_sharing) {
      const videoReceivers = pc.getReceivers().filter(
        (r) => r.track && r.track.kind === 'video' && r.track.readyState !== 'ended'
      );
      videoReceivers.forEach((r) => {
        const track = r.track;
        if (!track) return;
        track.enabled = true;

        const isScreen =
          (peerMeta?.screenTrackId && track.id === peerMeta.screenTrackId) ||
          Boolean(peerUser?.is_screen_sharing && !peerUser?.has_video);

        const isCamera =
          (peerMeta?.cameraTrackId && track.id === peerMeta.cameraTrackId) ||
          Boolean(peerUser?.has_video && !peerUser?.is_screen_sharing);

        if (isScreen && peerUser?.is_screen_sharing) {
          setRemoteScreenStreams((prev) => {
            const existing = prev[peerId];
            if (existing && existing.getVideoTracks()[0]?.id === track.id) return prev;
            return { ...prev, [peerId]: new MediaStream([track]) };
          });
        } else if (isCamera && peerUser?.has_video) {
          setRemoteCameraStreams((prev) => {
            const existing = prev[peerId];
            if (existing && existing.getVideoTracks()[0]?.id === track.id) return prev;
            return { ...prev, [peerId]: new MediaStream([track]) };
          });
        }
      });
    }

    if (peerMeta?.isVertical !== undefined) {
      setPeerOrientations((prev) => ({
        ...prev,
        [`${peerId}-camera`]: Boolean(peerMeta.isVertical),
      }));
    }
  }, [setupRemoteAudioAnalysis]);

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

    // Ensure audio & video transceivers are available with bidirectional capability
    try {
      if (pc.getTransceivers().every((t) => t.receiver.track.kind !== 'audio')) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }
      if (pc.getTransceivers().every((t) => t.receiver.track.kind !== 'video')) {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }
    } catch {}

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

        const isScreenConfirmed =
          (peerMeta?.screenTrackId && track.id === peerMeta.screenTrackId) ||
          (peerMeta?.screenStreamId && remoteStream?.id === peerMeta.screenStreamId) ||
          Boolean(peerUser?.is_screen_sharing && !peerUser?.has_video);

        const isCameraConfirmed =
          (peerMeta?.cameraTrackId && track.id === peerMeta.cameraTrackId) ||
          (peerMeta?.cameraStreamId && remoteStream?.id === peerMeta.cameraStreamId) ||
          Boolean(peerUser?.has_video && !peerUser?.is_screen_sharing);

        if (isScreenConfirmed && peerUser?.is_screen_sharing) {
          setRemoteScreenStreams((prev) => {
            const existing = prev[peerId];
            if (existing && existing.getVideoTracks()[0]?.id === track.id) return prev;
            return { ...prev, [peerId]: streamToUse };
          });
        } else if (isCameraConfirmed && peerUser?.has_video) {
          setRemoteCameraStreams((prev) => {
            const existing = prev[peerId];
            if (existing && existing.getVideoTracks()[0]?.id === track.id) return prev;
            return { ...prev, [peerId]: streamToUse };
          });
        }

        track.onended = () => {
          setRemoteScreenStreams((prev) => {
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
        console.log(`[WebRTC] Peer ${peerId} signalingState not stable (${pc.signalingState}), needs renegotiation.`);
        needsRenegotiation.current.set(peerId, true);
        return;
      }

      console.log(`[WebRTC] Initiating offer for peer ${peerId}`);
      updateTracksForPeer(pc, peerId);

      const offer = await pc.createOffer();
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
      const isConnected = existing && existing.connectionState === 'connected';
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
