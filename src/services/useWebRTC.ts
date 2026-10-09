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
    { urls: 'stun:stun.relay.metered.ca:80' },
  ],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 10,
};

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general' | 'video-general';
  localAudioStream: MediaStream | null;
  localCameraStream: MediaStream | null;
  localScreenStream: MediaStream | null;
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
  localCameraStream,
  localScreenStream,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
  // Remote Media Streams
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({}); // Combined for audio playback
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  // Active Peer Connections: peerId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE candidates queue per peer
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Pending making-offer lock
  const isMakingOffer = useRef<Map<string, boolean>>(new Map());
  // Track manifest per peer (track IDs for camera vs screen)
  const peerTrackManifests = useRef<Map<string, { 
    cameraTrackId?: string | null; 
    screenTrackId?: string | null;
    hasCamera?: boolean;
    hasScreen?: boolean;
  }>>(new Map());

  // Keep fresh ref to peers array
  const peersRef = useRef<DbUser[]>(peers);
  peersRef.current = peers;

  // Web Audio Analysers for decibel detection
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  const isMediaChannel = activeChannel === 'voice-general' || activeChannel === 'video-general';

  // Latest stream references
  const localAudioRef = useRef<MediaStream | null>(localAudioStream);
  const localCameraRef = useRef<MediaStream | null>(localCameraStream);
  const localScreenRef = useRef<MediaStream | null>(localScreenStream);
  localAudioRef.current = localAudioStream;
  localCameraRef.current = localCameraStream;
  localScreenRef.current = localScreenStream;

  // Clean up a single peer connection
  const closePeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      peerConnections.current.delete(peerId);
    }
    candidateQueues.current.delete(peerId);
    isMakingOffer.current.delete(peerId);
    peerTrackManifests.current.delete(peerId);
    remoteAnalysers.current.delete(peerId);

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

    setRemoteStreams((prev) => {
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
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    });
    peerConnections.current.clear();
    candidateQueues.current.clear();
    isMakingOffer.current.clear();
    peerTrackManifests.current.clear();
    remoteAnalysers.current.clear();
    setRemoteCameraStreams({});
    setRemoteScreenStreams({});
    setRemoteStreams({});
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

  // Ensure 1 audio and 2 video transceivers exist (Index 0: camera, Index 1: screen)
  const ensureTransceivers = useCallback((pc: RTCPeerConnection) => {
    const transceivers = pc.getTransceivers();
    const hasAudio = transceivers.some((t) => t.receiver.track.kind === 'audio');
    if (!hasAudio) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    const videoTransceivers = transceivers.filter((t) => t.receiver.track.kind === 'video');
    if (videoTransceivers.length === 0) {
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } else if (videoTransceivers.length === 1) {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }
  }, []);

  // Sync track attachments to a peer connection safely via dedicated transceivers
  const updateTracksForPeer = useCallback((pc: RTCPeerConnection) => {
    ensureTransceivers(pc);

    const audioTrack = localAudioRef.current?.getAudioTracks()[0] || null;
    const cameraTrack = localCameraRef.current?.getVideoTracks()[0] || null;
    const screenTrack = localScreenRef.current?.getVideoTracks()[0] || null;

    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio');
    const videoTransceivers = transceivers.filter((t) => t.receiver.track.kind === 'video');
    const cameraTransceiver = videoTransceivers[0];
    const screenTransceiver = videoTransceivers[1];

    // Audio Transceiver
    if (audioTransceiver && audioTransceiver.sender.track !== audioTrack) {
      audioTransceiver.sender.replaceTrack(audioTrack).catch((err) => {
        console.warn('[WebRTC] replaceTrack audio warning:', err);
      });
    }

    // Camera Video Transceiver (Index 0)
    if (cameraTransceiver && cameraTransceiver.sender.track !== cameraTrack) {
      cameraTransceiver.sender.replaceTrack(cameraTrack).catch((err) => {
        console.warn('[WebRTC] replaceTrack camera warning:', err);
      });
    }

    // Screen Share Video Transceiver (Index 1)
    if (screenTransceiver && screenTransceiver.sender.track !== screenTrack) {
      screenTransceiver.sender.replaceTrack(screenTrack).catch((err) => {
        console.warn('[WebRTC] replaceTrack screen warning:', err);
      });
    }
  }, [ensureTransceivers]);

  // Helper to sync all live receiver tracks into state for a peer
  const syncRemoteTracksForPeer = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio');
    const videoTransceivers = transceivers.filter((t) => t.receiver.track.kind === 'video');

    const audioTracks: MediaStreamTrack[] = [];
    if (audioTransceiver?.receiver?.track && audioTransceiver.receiver.track.readyState === 'live') {
      audioTracks.push(audioTransceiver.receiver.track);
      setupRemoteAudioAnalysis(peerId, audioTransceiver.receiver.track);
    }

    const manifest = peerTrackManifests.current.get(peerId);
    const peerDb = peersRef.current.find((p) => p.id === peerId);

    let cameraTrack: MediaStreamTrack | null = null;
    let screenTrack: MediaStreamTrack | null = null;

    videoTransceivers.forEach((t, idx) => {
      const track = t.receiver?.track;
      if (!track || track.readyState !== 'live') return;

      // Keep event listeners active for track state updates
      track.onunmute = () => syncRemoteTracksForPeer(peerId, pc);
      track.onmute = () => syncRemoteTracksForPeer(peerId, pc);

      // Match track using manifest IDs if available, else by transceiver index
      if (manifest?.screenTrackId && track.id === manifest.screenTrackId) {
        screenTrack = track;
      } else if (manifest?.cameraTrackId && track.id === manifest.cameraTrackId) {
        cameraTrack = track;
      } else if (idx === 1) {
        screenTrack = track;
      } else if (idx === 0) {
        cameraTrack = track;
      }
    });

    // Check if manifest explicitly marked screen or camera as inactive
    if (manifest?.hasCamera === false && (!peerDb || !peerDb.has_video)) {
      cameraTrack = null;
    }
    if (manifest?.hasScreen === false && (!peerDb || !peerDb.is_screen_sharing)) {
      screenTrack = null;
    }

    // Update Camera Stream
    if (cameraTrack) {
      setRemoteCameraStreams((prev) => {
        if (prev[peerId] && prev[peerId].getVideoTracks()[0] === cameraTrack) return prev;
        return { ...prev, [peerId]: new MediaStream([cameraTrack!]) };
      });
    } else {
      setRemoteCameraStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }

    // Update Screen Share Stream
    if (screenTrack) {
      setRemoteScreenStreams((prev) => {
        if (prev[peerId] && prev[peerId].getVideoTracks()[0] === screenTrack) return prev;
        return { ...prev, [peerId]: new MediaStream([screenTrack!]) };
      });
    } else {
      setRemoteScreenStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
    }

    // Combined stream for remote audio
    if (audioTracks.length > 0) {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: new MediaStream(audioTracks),
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
      pc.close();
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.current.set(peerId, pc);

    // Initial transceiver structure and track assignments
    ensureTransceivers(pc);
    updateTracksForPeer(pc);

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
      console.log(`[WebRTC] Peer ${peerId} iceConnectionState:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.log(`[WebRTC] Peer ${peerId} connection failed/disconnected, closing connection to force recreation.`);
        closePeer(peerId);
      }
    };

    // Track handler
    pc.ontrack = (event) => {
      const incomingTrack = event.track;
      console.log(`[WebRTC] ontrack received for peer ${peerId}, kind: ${incomingTrack.kind}`);

      incomingTrack.onunmute = () => {
        syncRemoteTracksForPeer(peerId, pc);
      };
      incomingTrack.onmute = () => {
        syncRemoteTracksForPeer(peerId, pc);
      };

      if (incomingTrack.kind === 'audio') {
        setupRemoteAudioAnalysis(peerId, incomingTrack);
      }

      syncRemoteTracksForPeer(peerId, pc);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connectionState:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        closePeer(peerId);
        if (currentUserId > peerId) {
          setTimeout(() => {
            initiateOfferRef.current(peerId);
          }, 200);
        }
      }
    };

    return pc;
  }, [sendRtcSignal, closePeer, setupRemoteAudioAnalysis, ensureTransceivers, updateTracksForPeer, syncRemoteTracksForPeer, currentUserId]);

  // Handle incoming signaling messages
  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!signal) return;
    console.log(`[WebRTC] Received signal type ${signal.type} from ${fromUserId}`);

    try {
      const pc = getOrCreatePeerConnection(fromUserId);
      console.log(`[WebRTC] Peer connection state for ${fromUserId}: ${pc.signalingState}`);

      // Track manifest update
      if (signal.type === 'track_manifest') {
        peerTrackManifests.current.set(fromUserId, {
          cameraTrackId: signal.cameraTrackId,
          screenTrackId: signal.screenTrackId,
          hasCamera: signal.hasCamera,
          hasScreen: signal.hasScreen,
        });
        syncRemoteTracksForPeer(fromUserId, pc);
        return;
      }

      if (signal.type === 'offer') {
        if (signal.cameraTrackId !== undefined || signal.screenTrackId !== undefined) {
          peerTrackManifests.current.set(fromUserId, {
            cameraTrackId: signal.cameraTrackId,
            screenTrackId: signal.screenTrackId,
            hasCamera: signal.hasCamera,
            hasScreen: signal.hasScreen,
          });
        }

        const remoteDesc = signal.description || { type: 'offer', sdp: signal.sdp };
        const isPolite = currentUserId < fromUserId;
        const offerCollision = pc.signalingState !== 'stable' || isMakingOffer.current.get(fromUserId);

        if (offerCollision) {
          if (!isPolite) {
            console.log(`[WebRTC] Glare detected, impolite peer ignoring offer from ${fromUserId}`);
            return;
          }
          console.log(`[WebRTC] Glare detected, polite peer rolling back offer for ${fromUserId}`);
          try {
            await pc.setLocalDescription({ type: 'rollback' } as any);
          } catch {}
        }

        await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
        syncRemoteTracksForPeer(fromUserId, pc);

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

        const cameraTrack = localCameraRef.current?.getVideoTracks()[0];
        const screenTrack = localScreenRef.current?.getVideoTracks()[0];

        sendRtcSignal(fromUserId, {
          type: 'answer',
          sdp: pc.localDescription?.sdp,
          description: {
            type: pc.localDescription?.type,
            sdp: pc.localDescription?.sdp,
          },
          cameraTrackId: cameraTrack?.id || null,
          screenTrackId: screenTrack?.id || null,
          hasCamera: !!cameraTrack,
          hasScreen: !!screenTrack,
        });

        syncRemoteTracksForPeer(fromUserId, pc);
      } else if (signal.type === 'answer') {
        if (signal.cameraTrackId !== undefined || signal.screenTrackId !== undefined) {
          peerTrackManifests.current.set(fromUserId, {
            cameraTrackId: signal.cameraTrackId,
            screenTrackId: signal.screenTrackId,
            hasCamera: signal.hasCamera,
            hasScreen: signal.hasScreen,
          });
        }

        const remoteDesc = signal.description || { type: 'answer', sdp: signal.sdp };
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
          syncRemoteTracksForPeer(fromUserId, pc);

          // Drain candidate queue
          const queue = candidateQueues.current.get(fromUserId) || [];
          for (const cand of queue) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          candidateQueues.current.delete(fromUserId);
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

  // Initiate offer to a peer
  const initiateOffer = useCallback(async (peerId: string) => {
    if (isMakingOffer.current.get(peerId)) {
      return;
    }
    try {
      isMakingOffer.current.set(peerId, true);
      const pc = getOrCreatePeerConnection(peerId);

      ensureTransceivers(pc);
      updateTracksForPeer(pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      const cameraTrack = localCameraRef.current?.getVideoTracks()[0];
      const screenTrack = localScreenRef.current?.getVideoTracks()[0];

      sendRtcSignal(peerId, {
        type: 'offer',
        sdp: pc.localDescription?.sdp,
        description: {
          type: pc.localDescription?.type,
          sdp: pc.localDescription?.sdp,
        },
        cameraTrackId: cameraTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
        hasCamera: !!cameraTrack,
        hasScreen: !!screenTrack,
      });
    } catch (err) {
      console.warn('[WebRTC] offer creation warning:', err);
    } finally {
      isMakingOffer.current.set(peerId, false);
    }
  }, [getOrCreatePeerConnection, ensureTransceivers, updateTracksForPeer, sendRtcSignal]);

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
      (userId, channel) => {
        if (isMediaChannel && userId !== currentUserId) {
          console.log(`[WebRTC] Peer ${userId} joined ${channel}. Checking offer initiation.`);
          if (currentUserId > userId) {
            initiateOfferRef.current(userId);
          }
        }
      },
      (userId) => {
        console.log(`[WebRTC] Peer ${userId} left media.`);
        closePeerRef.current(userId);
      }
    );
  }, [setRtcSignalHandler, setMediaHandlers, isMediaChannel, currentUserId]);

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

    // Remove old peers
    Array.from(peerConnections.current.keys()).forEach((id) => {
      if (!peerIds.has(id)) {
        closePeer(id);
      }
    });

    // Initiate offer with any new peer that is not connected (deterministic caller)
    peers.forEach((peer) => {
      const existing = peerConnections.current.get(peer.id);
      const isConnected = existing && (existing.connectionState === 'connected' || existing.connectionState === 'connecting');
      if (!isConnected) {
        if (currentUserId > peer.id) {
          console.log(`[WebRTC] Initiating offer to peer ${peer.id} (caller)`);
          initiateOffer(peer.id);
        } else {
          console.log(`[WebRTC] Waiting for offer from peer ${peer.id} (callee)`);
          // If polite peer hasn't connected after a brief window, initiate as fallback
          setTimeout(() => {
            const currentPc = peerConnections.current.get(peer.id);
            if (!currentPc || currentPc.connectionState === 'new' || currentPc.connectionState === 'disconnected') {
              console.log(`[WebRTC] Fallback: initiating offer to peer ${peer.id}`);
              initiateOfferRef.current(peer.id);
            }
          }, 300);
        }
      }
    });
  }, [peerIdsStr, isMediaChannel, currentUserId, initiateOffer, closePeer, closeAllPeers, peers]);

  // Update tracks and broadcast track manifest across all active peer connections when local streams change
  useEffect(() => {
    if (!isMediaChannel) return;

    const cameraTrack = localCameraRef.current?.getVideoTracks()[0];
    const screenTrack = localScreenRef.current?.getVideoTracks()[0];

    peerConnections.current.forEach((pc, peerId) => {
      updateTracksForPeer(pc);

      // Broadcast manifest so peer knows which track is camera and which is screen
      sendRtcSignal(peerId, {
        type: 'track_manifest',
        cameraTrackId: cameraTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
        hasCamera: !!cameraTrack,
        hasScreen: !!screenTrack,
      });

      if (pc.signalingState === 'stable') {
        initiateOfferRef.current(peerId);
      }
    });
  }, [localAudioStream, localCameraStream, localScreenStream, isMediaChannel, updateTracksForPeer, sendRtcSignal]);

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
    remoteCameraStreams,
    remoteScreenStreams,
    remoteStreams,
    remoteSpeaking,
    closePeer,
    closeAllPeers,
  };
}
