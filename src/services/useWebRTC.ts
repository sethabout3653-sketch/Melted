import { useEffect, useRef, useState, useCallback } from 'react';
import { DbUser } from '../server/wsDatabase';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Standard Port 443 STUN endpoints (School & restrictive Wi-Fi / GreatKids safe)
    { urls: 'stun:stun.l.google.com:443' },
    { urls: 'stun:stun1.l.google.com:443' },
    { urls: 'stun:stun2.l.google.com:443' },
    { urls: 'stun:stun3.l.google.com:443' },
    { urls: 'stun:stun4.l.google.com:443' },
    { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:stun.sipgate.net:443' },
    { urls: 'stun:stun.voip.blackberry.com:443' },
    // Standard STUN fallback
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 10,
};

interface UseWebRTCProps {
  currentUserId: string;
  activeChannel: 'text-general' | 'voice-general' | 'video-general';
  localAudioStream: MediaStream | null;
  localVideoStream: MediaStream | null;
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
  localVideoStream,
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
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
  const localVideoRef = useRef<MediaStream | null>(localVideoStream);
  localAudioRef.current = localAudioStream;
  localVideoRef.current = localVideoStream;

  // Clean up a single peer connection
  const closePeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
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

  // Clean up all peers
  const closeAllPeers = useCallback(() => {
    peerConnections.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    });
    peerConnections.current.clear();
    candidateQueues.current.clear();
    isMakingOffer.current.clear();
    remoteAnalysers.current.clear();
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

  // Sync track attachments to a peer connection
  const updateTracksForPeer = useCallback((pc: RTCPeerConnection) => {
    const audioTrack = localAudioRef.current?.getAudioTracks()[0] || null;
    const videoTrack = activeChannel === 'video-general' ? (localVideoRef.current?.getVideoTracks()[0] || null) : null;

    const senders = pc.getSenders();

    const audioSender = senders.find((s) => s.track?.kind === 'audio' || s.dtmf !== undefined);
    if (audioSender) {
      audioSender.replaceTrack(audioTrack).catch(() => {});
    } else if (audioTrack) {
      pc.addTrack(audioTrack);
    }

    const videoSender = senders.find((s) => s.track?.kind === 'video');
    if (videoSender) {
      videoSender.replaceTrack(videoTrack).catch(() => {});
    } else if (videoTrack) {
      pc.addTrack(videoTrack);
    }
  }, [activeChannel]);

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

    // Add audio and video transceivers for bi-directional streaming
    pc.addTransceiver('audio', { direction: 'sendrecv' });
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

    // Track handler
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      
      setRemoteStreams((prev) => {
        const existing = prev[peerId];
        if (existing) {
          if (!existing.getTracks().some((t) => t.id === event.track.id)) {
            existing.addTrack(event.track);
          }
          return { ...prev, [peerId]: new MediaStream(existing.getTracks()) };
        }
        return { ...prev, [peerId]: incomingStream };
      });

      if (event.track.kind === 'audio') {
        setupRemoteAudioAnalysis(peerId, event.track);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
        closePeer(peerId);
      }
    };

    return pc;
  }, [sendRtcSignal, closePeer, setupRemoteAudioAnalysis, updateTracksForPeer]);

  // Handle incoming signaling messages
  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!isMediaChannel || !signal) return;

    try {
      const pc = getOrCreatePeerConnection(fromUserId);

      if (signal.type === 'offer') {
        const remoteDesc = signal.description || { type: 'offer', sdp: signal.sdp };
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
  }, [isMediaChannel, getOrCreatePeerConnection, sendRtcSignal, updateTracksForPeer]);

  // Initiate offer to a peer
  const initiateOffer = useCallback(async (peerId: string) => {
    if (isMakingOffer.current.get(peerId)) return;
    try {
      isMakingOffer.current.set(peerId, true);
      const pc = getOrCreatePeerConnection(peerId);

      updateTracksForPeer(pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: activeChannel === 'video-general',
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
  }, [activeChannel, getOrCreatePeerConnection, updateTracksForPeer, sendRtcSignal]);

  // Register WebSocket Signal Handlers
  useEffect(() => {
    setRtcSignalHandler((fromUserId, signal) => {
      handleIncomingSignal(fromUserId, signal);
    });

    setMediaHandlers(
      (userId, channel) => {
        if (channel === activeChannel && isMediaChannel && userId !== currentUserId) {
          // Immediately initiate call
          if (currentUserId > userId) {
            initiateOffer(userId);
          }
        }
      },
      (userId) => {
        closePeer(userId);
      }
    );
  }, [setRtcSignalHandler, setMediaHandlers, handleIncomingSignal, activeChannel, isMediaChannel, currentUserId, initiateOffer, closePeer]);

  // Synchronize peer connections with current channel peers
  useEffect(() => {
    if (!isMediaChannel) {
      closeAllPeers();
      return;
    }

    const peerIds = new Set(peers.map((p) => p.id));

    // Remove old peers
    Array.from(peerConnections.current.keys()).forEach((id) => {
      if (!peerIds.has(id)) {
        closePeer(id);
      }
    });

    // Initiate offer with any new peer
    peers.forEach((peer) => {
      if (!peerConnections.current.has(peer.id) && currentUserId > peer.id) {
        initiateOffer(peer.id);
      }
    });
  }, [peers, isMediaChannel, currentUserId, initiateOffer, closePeer, closeAllPeers]);

  // Update tracks across all active peer connections when local streams change
  useEffect(() => {
    if (!isMediaChannel) return;

    peerConnections.current.forEach((pc) => {
      updateTracksForPeer(pc);
    });
  }, [localAudioStream, localVideoStream, isMediaChannel, updateTracksForPeer]);

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

    checkRemoteVolumes();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
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
    remoteSpeaking,
  };
}
