import { useEffect, useRef, useState, useCallback } from 'react';
import { DbUser } from '../server/wsDatabase';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Port 443 STUN endpoints (Bypasses restrictive school/firewall/GreatKids Wi-Fi blocks)
    { urls: 'stun:stun.l.google.com:443' },
    { urls: 'stun:stun1.l.google.com:443' },
    { urls: 'stun:stun2.l.google.com:443' },
    { urls: 'stun:stun3.l.google.com:443' },
    { urls: 'stun:stun4.l.google.com:443' },
    { urls: 'stun:stun.nextcloud.com:443' },
    { urls: 'stun:stun.sipgate.net:443' },
    { urls: 'stun:stun.voip.blackberry.com:443' },
    // Fallback standard STUN endpoints
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
  registerRtcHandlers: (
    onSignal: (fromUserId: string, signal: any) => void,
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
  registerRtcHandlers,
}: UseWebRTCProps) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  // Active Peer Connections: peerId -> RTCPeerConnection
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Pending ICE candidates buffer for timing safety
  const candidateQueues = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Web Audio Analysers for remote streams
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAnalysers = useRef<Map<string, AnalyserNode>>(new Map());
  const animFrameRef = useRef<number | null>(null);

  const isMediaChannel = activeChannel === 'voice-general' || activeChannel === 'video-general';

  // Gather all local tracks (mic + camera/screen)
  const getLocalTracks = useCallback((): MediaStreamTrack[] => {
    const tracks: MediaStreamTrack[] = [];
    if (localAudioStream) {
      localAudioStream.getAudioTracks().forEach((t) => tracks.push(t));
    }
    if (activeChannel === 'video-general' && localVideoStream) {
      localVideoStream.getVideoTracks().forEach((t) => tracks.push(t));
    }
    return tracks;
  }, [localAudioStream, localVideoStream, activeChannel]);

  // Clean up a specific peer connection
  const closePeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      peerConnections.current.delete(peerId);
    }
    candidateQueues.current.delete(peerId);
    remoteAnalysers.current.delete(peerId);

    setRemoteStreams((prev) => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });

    setRemoteSpeaking((prev) => {
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
      pc.close();
    });
    peerConnections.current.clear();
    candidateQueues.current.clear();
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
      console.warn('[WebRTC] audio analysis setup notice:', e);
    }
  }, []);

  // Initialize or get RTCPeerConnection for a peer
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

    // Add local tracks to peer connection
    const localTracks = getLocalTracks();
    localTracks.forEach((track) => {
      if (pc) pc.addTrack(track);
    });

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRtcSignal(peerId, {
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Track received from peer
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      
      setRemoteStreams((prev) => {
        const existing = prev[peerId];
        if (existing) {
          // If track not in existing, add it
          if (!existing.getTracks().some((t) => t.id === event.track.id)) {
            existing.addTrack(event.track);
          }
          return { ...prev, [peerId]: existing };
        }
        return { ...prev, [peerId]: incomingStream };
      });

      if (event.track.kind === 'audio') {
        setupRemoteAudioAnalysis(peerId, event.track);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
        closePeer(peerId);
      }
    };

    return pc;
  }, [getLocalTracks, sendRtcSignal, closePeer, setupRemoteAudioAnalysis]);

  // Handle incoming signaling messages
  const handleIncomingSignal = useCallback(async (fromUserId: string, signal: any) => {
    if (!isMediaChannel) return;

    try {
      const pc = getOrCreatePeerConnection(fromUserId);

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Process any queued ICE candidates
        const queue = candidateQueues.current.get(fromUserId) || [];
        for (const cand of queue) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        candidateQueues.current.delete(fromUserId);

        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendRtcSignal(fromUserId, {
          type: 'answer',
          sdp: pc.localDescription,
        });
      } else if (signal.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

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
          // Buffer candidate until remote description is set
          const q = candidateQueues.current.get(fromUserId) || [];
          q.push(signal.candidate);
          candidateQueues.current.set(fromUserId, q);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] signal processing warning:', err);
    }
  }, [isMediaChannel, getOrCreatePeerConnection, sendRtcSignal]);

  // Initiate call with a peer (called by the initiator)
  const initiateOffer = useCallback(async (peerId: string) => {
    try {
      const pc = getOrCreatePeerConnection(peerId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: activeChannel === 'video-general',
      });
      await pc.setLocalDescription(offer);

      sendRtcSignal(peerId, {
        type: 'offer',
        sdp: pc.localDescription,
      });
    } catch (err) {
      console.warn('[WebRTC] createOffer warning:', err);
    }
  }, [activeChannel, getOrCreatePeerConnection, sendRtcSignal]);

  // Register WebRTC WebSocket Handlers
  useEffect(() => {
    registerRtcHandlers(
      (fromUserId, signal) => {
        handleIncomingSignal(fromUserId, signal);
      },
      (userId, channel) => {
        if (channel === activeChannel && isMediaChannel && userId !== currentUserId) {
          // Deterministic initiator: if my ID is greater than peer ID, initiate offer
          if (currentUserId > userId) {
            initiateOffer(userId);
          }
        }
      },
      (userId) => {
        closePeer(userId);
      }
    );
  }, [registerRtcHandlers, handleIncomingSignal, activeChannel, isMediaChannel, currentUserId, initiateOffer, closePeer]);

  // Synchronize peer connections with current channel peers
  useEffect(() => {
    if (!isMediaChannel) {
      closeAllPeers();
      return;
    }

    const peerIds = new Set(peers.map((p) => p.id));

    // Close peers who left
    Array.from(peerConnections.current.keys()).forEach((id) => {
      if (!peerIds.has(id)) {
        closePeer(id);
      }
    });

    // Initiate offer to any new peers where currentUserId > peerId
    peers.forEach((peer) => {
      if (!peerConnections.current.has(peer.id) && currentUserId > peer.id) {
        initiateOffer(peer.id);
      }
    });
  }, [peers, isMediaChannel, currentUserId, initiateOffer, closePeer, closeAllPeers]);

  // Update tracks when local streams change (e.g. camera turned on/off, mic muted, screen shared)
  useEffect(() => {
    if (!isMediaChannel) return;

    const currentTracks = getLocalTracks();

    peerConnections.current.forEach((pc) => {
      const senders = pc.getSenders();

      // Audio sender update
      const audioTrack = currentTracks.find((t) => t.kind === 'audio') || null;
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender && audioTrack && audioSender.track?.id !== audioTrack.id) {
        audioSender.replaceTrack(audioTrack).catch(() => {});
      } else if (!audioSender && audioTrack) {
        pc.addTrack(audioTrack);
      }

      // Video sender update
      const videoTrack = currentTracks.find((t) => t.kind === 'video') || null;
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(videoTrack).catch(() => {});
      } else if (!videoSender && videoTrack) {
        pc.addTrack(videoTrack);
      }
    });
  }, [localAudioStream, localVideoStream, isMediaChannel, getLocalTracks]);

  // Loop to analyze remote audio decibels for real-time speaking glow
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
        speakingStatus[peerId] = avg > 16;
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
