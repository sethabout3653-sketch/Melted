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
  ],
};

// Optimizes Opus SDP to completely disable DTX (discontinuous transmission)
// which causes browser silence suppression to mute quiet parts, pauses, or syllables of speech.
function optimizeAudioSdp(sdp: string): string {
  if (!sdp) return sdp;
  const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  const opusPt = opusMatch ? opusMatch[1] : null;

  const lines = sdp.split('\r\n');
  let foundFmtp = false;

  const modifiedLines = lines.map((line) => {
    if (opusPt && line.startsWith(`a=fmtp:${opusPt}`)) {
      foundFmtp = true;
      let params = line;
      // Disable DTX so parts of speech are never cut off during quiet syllables or pauses
      if (params.includes('usedtx=')) {
        params = params.replace(/usedtx=\d+/g, 'usedtx=0');
      } else {
        params += ';usedtx=0';
      }
      // Enable in-band forward error correction to eliminate packet loss audio drops
      if (params.includes('useinbandfec=')) {
        params = params.replace(/useinbandfec=\d+/g, 'useinbandfec=1');
      } else {
        params += ';useinbandfec=1';
      }
      // Constant Bit Rate (cbr=1) prevents encoder volume ducking
      if (!params.includes('cbr=')) {
        params += ';cbr=1';
      }
      // Maximum audio fidelity
      if (!params.includes('maxaveragebitrate=')) {
        params += ';maxaveragebitrate=510000';
      }
      return params;
    }
    return line;
  });

  if (opusPt && !foundFmtp) {
    const rtpmapIdx = modifiedLines.findIndex((l) => l.startsWith(`a=rtpmap:${opusPt}`));
    if (rtpmapIdx !== -1) {
      modifiedLines.splice(
        rtpmapIdx + 1,
        0,
        `a=fmtp:${opusPt} minptime=10;useinbandfec=1;usedtx=0;cbr=1;maxaveragebitrate=510000`
      );
    }
  }

  return modifiedLines.join('\r\n');
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
  peers,
  sendRtcSignal,
  setRtcSignalHandler,
  setMediaHandlers,
}: UseWebRTCProps) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());

  const peersRef = useRef(peers);
  peersRef.current = peers;

  const localAudioRef = useRef(localAudioStream);
  localAudioRef.current = localAudioStream;

  const cameraStreamRef = useRef(cameraStream);
  cameraStreamRef.current = cameraStream;

  const screenStreamRef = useRef(screenStream);
  screenStreamRef.current = screenStream;

  const isMediaActive = activeChannel === 'voice-general' || activeChannel === 'video-general';

  // Compatibility media handlers
  useEffect(() => {
    setMediaHandlers(
      () => {},
      () => {}
    );
  }, [setMediaHandlers]);

  // Clean up all connections when leaving media channels
  useEffect(() => {
    if (!isMediaActive) {
      peerConnections.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      makingOfferRef.current.clear();
      setRemoteStreams({});
      setRemoteCameraStreams({});
      setRemoteScreenStreams({});
      setRemoteSpeaking({});
    }
  }, [isMediaActive]);

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

    // Attach local audio track if available
    const audioTrack = localAudioRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      try {
        pc.addTrack(audioTrack, localAudioRef.current!);
      } catch {}
    }

    // Attach local camera track if available
    const camTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (camTrack) {
      try {
        pc.addTrack(camTrack, cameraStreamRef.current!);
      } catch {}
    }

    // Attach local screen track if available
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
    if (screenTrack) {
      try {
        pc.addTrack(screenTrack, screenStreamRef.current!);
      } catch {}
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendRtcSignal(peerId, { type: 'candidate', candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch {}
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const [stream] = event.streams;
      const streamToUse = stream || new MediaStream([track]);

      if (track.kind === 'audio') {
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: streamToUse,
        }));
      } else if (track.kind === 'video') {
        const peerObj = peersRef.current.find((p) => p.id === peerId);
        const isScreen = track.label.toLowerCase().includes('screen') || 
                        track.label.toLowerCase().includes('window') ||
                        track.label.toLowerCase().includes('display') ||
                        peerObj?.is_screen_sharing;

        const updateTile = () => {
          if (isScreen) {
            setRemoteScreenStreams((prev) => ({
              ...prev,
              [peerId]: new MediaStream([track]),
            }));
          } else {
            setRemoteCameraStreams((prev) => ({
              ...prev,
              [peerId]: new MediaStream([track]),
            }));
          }
        };

        updateTile();
        track.addEventListener('unmute', updateTile);
        track.addEventListener('ended', () => {
          if (isScreen) {
            setRemoteScreenStreams((prev) => {
              const copy = { ...prev };
              delete copy[peerId];
              return copy;
            });
          } else {
            setRemoteCameraStreams((prev) => {
              const copy = { ...prev };
              delete copy[peerId];
              return copy;
            });
          }
        });
      }
    };

    return pc;
  }, [sendRtcSignal]);

  // Renegotiate with a specific peer
  const renegotiateWithPeer = useCallback(async (peerId: string) => {
    const pc = getOrCreatePeerConnection(peerId);
    try {
      makingOfferRef.current.set(peerId, true);
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      const optimizedSdp = optimizeAudioSdp(offer.sdp || '');
      const finalOffer = { type: offer.type, sdp: optimizedSdp };
      await pc.setLocalDescription(finalOffer);
      sendRtcSignal(peerId, { type: 'offer', offer: finalOffer });
    } catch (err) {
      console.warn('[useWebRTC] Offer creation error:', err);
    } finally {
      makingOfferRef.current.set(peerId, false);
    }
  }, [getOrCreatePeerConnection, sendRtcSignal]);

  // Sync local tracks across all active peer connections
  const syncLocalTracks = useCallback(() => {
    if (!isMediaActive) return;

    const audioTrack = localAudioStream?.getAudioTracks()[0] || null;
    const camTrack = cameraStream?.getVideoTracks()[0] || null;
    const screenTrack = screenStream?.getVideoTracks()[0] || null;

    peerConnections.current.forEach((pc, peerId) => {
      const senders = pc.getSenders();
      let needsRenegotiation = false;

      // Audio track sync
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      if (audioSender) {
        audioSender.replaceTrack(audioTrack).catch(() => {});
      } else if (audioTrack && localAudioStream) {
        try {
          pc.addTrack(audioTrack, localAudioStream);
          needsRenegotiation = true;
        } catch {}
      }

      // Camera video track sync
      const videoSenders = senders.filter((s) => s.track && s.track.kind === 'video');
      const camSender = videoSenders[0];
      if (camSender) {
        camSender.replaceTrack(camTrack).catch(() => {});
      } else if (camTrack && cameraStream) {
        try {
          pc.addTrack(camTrack, cameraStream);
          needsRenegotiation = true;
        } catch {}
      }

      // Screen share video track sync
      const screenSender = videoSenders[1];
      if (screenSender) {
        screenSender.replaceTrack(screenTrack).catch(() => {});
      } else if (screenTrack && screenStream) {
        try {
          pc.addTrack(screenTrack, screenStream);
          needsRenegotiation = true;
        } catch {}
      }

      if (needsRenegotiation && pc.signalingState === 'stable') {
        renegotiateWithPeer(peerId);
      }
    });
  }, [isMediaActive, localAudioStream, cameraStream, screenStream, renegotiateWithPeer]);

  useEffect(() => {
    syncLocalTracks();
  }, [syncLocalTracks]);

  // Handle incoming WebRTC signals using Perfect Negotiation pattern
  useEffect(() => {
    setRtcSignalHandler(async (fromUserId, signal) => {
      if (!isMediaActive) return;
      if (fromUserId === currentUserId) return;

      const pc = getOrCreatePeerConnection(fromUserId);
      const isPolite = currentUserId > fromUserId;

      try {
        if (signal.type === 'offer') {
          const isMakingOffer = Boolean(makingOfferRef.current.get(fromUserId));
          const offerCollision = isMakingOffer || pc.signalingState !== 'stable';

          if (offerCollision && !isPolite) {
            return;
          }

          const optimizedOffer = {
            type: signal.offer.type,
            sdp: optimizeAudioSdp(signal.offer.sdp || ''),
          };
          await pc.setRemoteDescription(new RTCSessionDescription(optimizedOffer));
          const answer = await pc.createAnswer();
          const optimizedAnswerSdp = optimizeAudioSdp(answer.sdp || '');
          const finalAnswer = { type: answer.type, sdp: optimizedAnswerSdp };
          await pc.setLocalDescription(finalAnswer);
          sendRtcSignal(fromUserId, { type: 'answer', answer: finalAnswer });

          // Flush queued candidates
          const queued = pendingCandidates.current.get(fromUserId) || [];
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingCandidates.current.delete(fromUserId);
        } else if (signal.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            const optimizedAnswer = {
              type: signal.answer.type,
              sdp: optimizeAudioSdp(signal.answer.sdp || ''),
            };
            await pc.setRemoteDescription(new RTCSessionDescription(optimizedAnswer));
            const queued = pendingCandidates.current.get(fromUserId) || [];
            for (const c of queued) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            pendingCandidates.current.delete(fromUserId);
          }
        } else if (signal.type === 'candidate') {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch {}
          } else {
            let queued = pendingCandidates.current.get(fromUserId);
            if (!queued) {
              queued = [];
              pendingCandidates.current.set(fromUserId, queued);
            }
            queued.push(signal.candidate);
          }
        }
      } catch (err) {
        console.warn('[useWebRTC] Signal handling error:', err);
      }
    });
  }, [isMediaActive, currentUserId, getOrCreatePeerConnection, sendRtcSignal, setRtcSignalHandler]);

  // Maintain active connections to all peers in the channel
  useEffect(() => {
    if (!isMediaActive) return;

    peers.forEach((peer) => {
      if (peer.id === currentUserId) return;

      const existingPc = peerConnections.current.get(peer.id);
      if (!existingPc || existingPc.connectionState === 'closed') {
        // Initiator: Polite peer initiates offer
        const isInitiator = currentUserId < peer.id;
        if (isInitiator) {
          renegotiateWithPeer(peer.id);
        } else {
          getOrCreatePeerConnection(peer.id);
        }
      }
    });

    // Cleanup disconnected peers
    const activePeerIds = new Set(peers.map((p) => p.id));
    peerConnections.current.forEach((pc, peerId) => {
      if (!activePeerIds.has(peerId) || peerId === currentUserId) {
        try { pc.close(); } catch {}
        peerConnections.current.delete(peerId);
        pendingCandidates.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        setRemoteCameraStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        setRemoteScreenStreams((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
        setRemoteSpeaking((prev) => {
          const copy = { ...prev };
          delete copy[peerId];
          return copy;
        });
      }
    });
  }, [isMediaActive, peers, currentUserId, renegotiateWithPeer, getOrCreatePeerConnection]);

  return {
    remoteStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking,
  };
}
