import { useEffect, useRef, useState, useCallback } from 'react';
import { DbUser } from '../server/socketIoDatabase';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.relay.metered.ca:443' },
    { urls: 'stun:openrelay.metered.ca:443' },
    { urls: 'stun:stun.stunprotocol.org:443' },
    { urls: 'stun:stun.sipgate.net:443' },
    { urls: 'stun:stun.counterpath.net:443' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 10,
};

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general';
  localAudioStream: MediaStream | null;
  peers: DbUser[];
  sendRtcSignal: (targetUserId: string, signal: any) => void;
  setRtcSignalHandler: (fn: (fromUserId: string, signal: any) => void) => void;
  setMediaHandlers: (
    onJoined: (userId: string, channel: string) => void,
    onLeft: (userId: string, channel: string) => void
  ) => void;
  isConnected: boolean;
}

export function useWebRTC({
  currentUserId,
  activeChannel,
  localAudioStream,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
  isConnected,
}: UseWebRTCProps) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const isMakingOffer = useRef<Map<string, boolean>>(new Map());

  const peersRef = useRef<DbUser[]>(peers);
  peersRef.current = peers;

  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  const isMediaChannel = activeChannel === 'voice-general';

  const localAudioRef = useRef<MediaStream | null>(localAudioStream);
  localAudioRef.current = localAudioStream;

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
    setRemoteStreams({});
    setRemoteSpeaking({});
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
    } catch (e) {
      console.warn('[WebRTC] audio analysis warning:', e);
    }
  }, []);

  const ensureTransceivers = useCallback((pc: RTCPeerConnection) => {
    const transceivers = pc.getTransceivers();
    const hasAudio = transceivers.some((t) => t.receiver.track.kind === 'audio');
    if (!hasAudio) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
  }, []);

  const updateTracksForPeer = useCallback((pc: RTCPeerConnection) => {
    ensureTransceivers(pc);
    const audioTrack = localAudioRef.current?.getAudioTracks()[0] || null;
    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio');

    if (audioTransceiver && audioTransceiver.sender.track !== audioTrack) {
      audioTransceiver.sender.replaceTrack(audioTrack).catch((err) => {
        console.warn('[WebRTC] replaceTrack audio warning:', err);
      });
    }
  }, [ensureTransceivers]);

  const syncRemoteTracksForPeer = useCallback((peerId: string, pc: RTCPeerConnection) => {
    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio');

    const audioTracks: MediaStreamTrack[] = [];
    if (audioTransceiver?.receiver?.track && audioTransceiver.receiver.track.readyState === 'live') {
      audioTracks.push(audioTransceiver.receiver.track);
      setupRemoteAudioAnalysis(peerId, audioTransceiver.receiver.track);
    }

    if (audioTracks.length > 0) {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: new MediaStream(audioTracks),
      }));
    }
  }, [setupRemoteAudioAnalysis]);

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

    ensureTransceivers(pc);
    updateTracksForPeer(pc);

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
        closePeer(peerId);
      }
    };

    pc.ontrack = (event) => {
      const incomingTrack = event.track;
      incomingTrack.onunmute = () => syncRemoteTracksForPeer(peerId, pc);
      incomingTrack.onmute = () => syncRemoteTracksForPeer(peerId, pc);

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

  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!signal) return;
    try {
      const pc = getOrCreatePeerConnection(fromUserId);

      if (signal.type === 'offer') {
        const remoteDesc = signal.description || { type: 'offer', sdp: signal.sdp };
        const isPolite = currentUserId < fromUserId;
        const offerCollision = pc.signalingState !== 'stable' || isMakingOffer.current.get(fromUserId);

        if (offerCollision) {
          if (!isPolite) return;
          try {
            await pc.setLocalDescription({ type: 'rollback' } as any);
          } catch {}
        }

        await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
        syncRemoteTracksForPeer(fromUserId, pc);

        const queue = candidateQueues.current.get(fromUserId) || [];
        for (const cand of queue) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        candidateQueues.current.delete(fromUserId);

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

        syncRemoteTracksForPeer(fromUserId, pc);
      } else if (signal.type === 'answer') {
        const remoteDesc = signal.description || { type: 'answer', sdp: signal.sdp };
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(remoteDesc));
          syncRemoteTracksForPeer(fromUserId, pc);

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

  const initiateOffer = useCallback(async (peerId: string) => {
    if (isMakingOffer.current.get(peerId)) return;
    try {
      isMakingOffer.current.set(peerId, true);
      const pc = getOrCreatePeerConnection(peerId);

      ensureTransceivers(pc);
      updateTracksForPeer(pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

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
  }, [getOrCreatePeerConnection, ensureTransceivers, updateTracksForPeer, sendRtcSignal]);

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
      (userId, channel) => {
        if (isMediaChannel && userId !== currentUserId) {
          if (currentUserId > userId) {
            initiateOfferRef.current(userId);
          }
        }
      },
      (userId) => {
        closePeerRef.current(userId);
      }
    );
  }, [setRtcSignalHandler, setMediaHandlers, isMediaChannel, currentUserId]);

  const peerIdsStr = peers.map((p) => p.id).sort().join(',');

  useEffect(() => {
    if (!isMediaChannel || !isConnected) {
      if (peerConnections.current.size > 0) {
        closeAllPeers();
      }
      return;
    }

    peers.forEach((peer) => {
      const existing = peerConnections.current.get(peer.id);
      const isConnectedState = existing && (existing.connectionState === 'connected' || existing.connectionState === 'connecting');
      if (!isConnectedState) {
        if (currentUserId > peer.id) {
          initiateOffer(peer.id);
        } else {
          setTimeout(() => {
            const currentPc = peerConnections.current.get(peer.id);
            if (!currentPc || currentPc.connectionState === 'new' || currentPc.connectionState === 'disconnected') {
              initiateOfferRef.current(peer.id);
            }
          }, 300);
        }
      }
    });
  }, [peerIdsStr, isMediaChannel, currentUserId, initiateOffer, closePeer, closeAllPeers, peers, isConnected]);

  useEffect(() => {
    if (!isMediaChannel) return;
    peerConnections.current.forEach((pc) => {
      updateTracksForPeer(pc);
      if (pc.signalingState === 'stable') {
        // keep stable
      }
    });
  }, [localAudioStream, isMediaChannel, updateTracksForPeer]);

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
    remoteSpeaking,
    closePeer,
    closeAllPeers,
  };
}
