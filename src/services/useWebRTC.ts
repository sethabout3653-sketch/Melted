import { useEffect, useRef, useState, useCallback } from 'react';
import { DbUser } from '../server/wsDatabase';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.relay.metered.ca:80' },
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
    {
      urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
      username: 'e713606f33230a169b51ee21',
      credential: 'fWc00dvyjWp+O3f3',
    },
  ],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 10,
};

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general' | 'video-general';
  localAudioStream: MediaStream | null;
  localCameraStream?: MediaStream | null;
  localScreenStream?: MediaStream | null;
  localVideoStream?: MediaStream | null;
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
  localVideoStream,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<Record<string, MediaStream>>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  // Active Peer Connections: peerId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // ICE candidates queue per peer
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Pending making-offer lock
  const isMakingOffer = useRef<Map<string, boolean>>(new Map());

  // Web Audio Analysers for decibel detection
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  const isMediaChannel = activeChannel === 'voice-general' || activeChannel === 'video-general';

  // Latest stream references
  const localAudioRef = useRef<MediaStream | null>(localAudioStream);
  const localCameraRef = useRef<MediaStream | null>(localCameraStream || localVideoStream || null);
  const localScreenRef = useRef<MediaStream | null>(localScreenStream || null);
  const localVideoRef = useRef<MediaStream | null>(localVideoStream || null);

  localAudioRef.current = localAudioStream;
  localCameraRef.current = localCameraStream || localVideoStream || null;
  localScreenRef.current = localScreenStream || null;
  localVideoRef.current = localVideoStream || null;

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

    setRemoteAudioStreams((prev) => {
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
    remoteAnalysers.current.clear();
    setRemoteCameraStreams((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setRemoteScreenStreams((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setRemoteAudioStreams((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setRemoteStreams((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setRemoteSpeaking((prev) => (Object.keys(prev).length === 0 ? prev : {}));
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

  // Sync track attachments to a peer connection safely via dedicated transceivers
  const updateTracksForPeer = useCallback((pc: RTCPeerConnection) => {
    const audioTrack = localAudioRef.current?.getAudioTracks().find((t) => t.readyState === 'live') || null;
    const cameraTrack = (localCameraRef.current || localVideoRef.current)?.getVideoTracks().find((t) => t.readyState === 'live') || null;
    const screenTrack = localScreenRef.current?.getVideoTracks().find((t) => t.readyState === 'live') || null;

    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers[0];
    const cameraTransceiver = transceivers[1];
    const screenTransceiver = transceivers[2];

    if (audioTransceiver) {
      if (audioTransceiver.sender.track !== audioTrack) {
        audioTransceiver.sender.replaceTrack(audioTrack).catch((err) => {
          console.warn('[WebRTC] replaceTrack audio warning:', err);
        });
      }
    } else if (audioTrack) {
      pc.addTrack(audioTrack);
    }

    if (cameraTransceiver) {
      if (cameraTransceiver.sender.track !== cameraTrack) {
        cameraTransceiver.sender.replaceTrack(cameraTrack).then(() => {
          try {
            const params = cameraTransceiver.sender.getParameters();
            if (params.encodings && params.encodings[0]) {
              params.encodings[0].maxBitrate = 4000000; // 4 Mbps 1080p camera quality
              cameraTransceiver.sender.setParameters(params).catch(() => {});
            }
          } catch {}
        }).catch((err) => {
          console.warn('[WebRTC] replaceTrack camera warning:', err);
        });
      }
    } else if (cameraTrack) {
      pc.addTrack(cameraTrack);
    }

    if (screenTransceiver) {
      if (screenTransceiver.sender.track !== screenTrack) {
        screenTransceiver.sender.replaceTrack(screenTrack).then(() => {
          try {
            const params = screenTransceiver.sender.getParameters();
            if (params.encodings && params.encodings[0]) {
              params.encodings[0].maxBitrate = 5000000; // 5 Mbps 1080p screen share quality
              screenTransceiver.sender.setParameters(params).catch(() => {});
            }
          } catch {}
        }).catch((err) => {
          console.warn('[WebRTC] replaceTrack screen warning:', err);
        });
      }
    } else if (screenTrack) {
      pc.addTrack(screenTrack);
    }
  }, []);

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

    // 0: Audio transceiver (sendrecv)
    pc.addTransceiver('audio', { direction: 'sendrecv' });

    // 1: Camera Video transceiver (sendrecv)
    pc.addTransceiver('video', { direction: 'sendrecv' });

    // 2: Screen Share Video transceiver (sendrecv)
    pc.addTransceiver('video', { direction: 'sendrecv' });

    // Initial track assignment
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
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce?.();
        } catch (err) {
          console.warn('[WebRTC] restartIce error:', err);
        }
      }
    };

    // Track handler - route audio, camera, and screen share tracks cleanly
    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack received for peer ${peerId}, kind: ${event.track.kind}`);
      const incomingTrack = event.track;
      const transceivers = pc.getTransceivers();
      const transceiverIndex = transceivers.indexOf(event.transceiver);

      if (incomingTrack.kind === 'audio') {
        const updateAudio = () => {
          setRemoteAudioStreams((prev) => ({
            ...prev,
            [peerId]: new MediaStream([incomingTrack]),
          }));
        };
        updateAudio();
        incomingTrack.onunmute = updateAudio;
        incomingTrack.onmute = updateAudio;
        incomingTrack.onended = () => {
          setRemoteAudioStreams((prev) => {
            const copy = { ...prev };
            delete copy[peerId];
            return copy;
          });
        };
        setupRemoteAudioAnalysis(peerId, incomingTrack);
      } else if (incomingTrack.kind === 'video') {
        const isScreen = transceiverIndex === 2;

        if (isScreen) {
          const updateScreen = () => {
            if (incomingTrack.readyState === 'live') {
              setRemoteScreenStreams((prev) => ({
                ...prev,
                [peerId]: new MediaStream([incomingTrack]),
              }));
            }
          };
          updateScreen();
          incomingTrack.onunmute = updateScreen;
          incomingTrack.onmute = updateScreen;
          incomingTrack.onended = () => {
            setRemoteScreenStreams((prev) => {
              const copy = { ...prev };
              delete copy[peerId];
              return copy;
            });
          };
        } else {
          // Camera track (transceiver 1 or default)
          const updateCamera = () => {
            if (incomingTrack.readyState === 'live') {
              setRemoteCameraStreams((prev) => ({
                ...prev,
                [peerId]: new MediaStream([incomingTrack]),
              }));
              setRemoteStreams((prev) => ({
                ...prev,
                [peerId]: new MediaStream([incomingTrack]),
              }));
            }
          };
          updateCamera();
          incomingTrack.onunmute = updateCamera;
          incomingTrack.onmute = updateCamera;
          incomingTrack.onended = () => {
            setRemoteCameraStreams((prev) => {
              const copy = { ...prev };
              delete copy[peerId];
              return copy;
            });
            setRemoteStreams((prev) => {
              const copy = { ...prev };
              delete copy[peerId];
              return copy;
            });
          };
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connectionState:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        closePeer(peerId);
        if (currentUserId > peerId) {
          setTimeout(() => {
            initiateOfferRef.current(peerId);
          }, 1500);
        }
      }
    };

    return pc;
  }, [sendRtcSignal, closePeer, setupRemoteAudioAnalysis, updateTracksForPeer, currentUserId]);

  // Handle incoming signaling messages
  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!signal) return;

    try {
      const pc = getOrCreatePeerConnection(fromUserId);

      if (signal.type === 'offer') {
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
          sdp: pc.localDescription?.sdp,
          description: {
            type: pc.localDescription?.type,
            sdp: pc.localDescription?.sdp,
          },
        });
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
  }, [getOrCreatePeerConnection, sendRtcSignal, updateTracksForPeer, currentUserId]);

  // Initiate offer to a peer
  const initiateOffer = useCallback(async (peerId: string) => {
    console.log(`[WebRTC] Starting initiateOffer for peer: ${peerId}`);
    if (isMakingOffer.current.get(peerId)) {
      console.log(`[WebRTC] Already making offer to peer: ${peerId}`);
      return;
    }
    try {
      isMakingOffer.current.set(peerId, true);
      const pc = getOrCreatePeerConnection(peerId);

      updateTracksForPeer(pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isMediaChannel,
      });
      await pc.setLocalDescription(offer);
      
      console.log(`[WebRTC] Offer created and set for peer: ${peerId}`);
      sendRtcSignal(peerId, {
        type: 'offer',
        sdp: pc.localDescription?.sdp,
        description: {
          type: pc.localDescription?.type,
          sdp: pc.localDescription?.sdp,
        },
      });
    } catch (err) {
      console.warn('[WebRTC] offer creation warning:', err);
    } finally {
      isMakingOffer.current.set(peerId, false);
    }
  }, [activeChannel, getOrCreatePeerConnection, updateTracksForPeer, sendRtcSignal]);

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
          console.log(`[WebRTC] Sync effect initiating offer to peer: ${peer.id}`);
          initiateOffer(peer.id);
        }
      }
    });
  }, [peerIdsStr, isMediaChannel, currentUserId, initiateOffer, closePeer, closeAllPeers, peers]);

  // Update tracks across all active peer connections when local streams change
  useEffect(() => {
    if (!isMediaChannel) return;

    peerConnections.current.forEach((pc, peerId) => {
      updateTracksForPeer(pc);
      if (pc.signalingState === 'stable') {
        initiateOfferRef.current(peerId);
      }
    });
  }, [localAudioStream, localCameraStream, localScreenStream, localVideoStream, isMediaChannel, updateTracksForPeer]);

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
    remoteAudioStreams,
    remoteStreams,
    remoteSpeaking,
    closePeer,
    closeAllPeers,
  };
}
