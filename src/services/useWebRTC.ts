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

interface PeerTrackMeta {
  camTrackId?: string | null;
  screenTrackId?: string | null;
  hasCamera?: boolean;
  isScreenSharing?: boolean;
}

interface PeerConnectionBundle {
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender | null;
  camSender: RTCRtpSender | null;
  screenSender: RTCRtpSender | null;
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

  const peerBundles = useRef<Map<string, PeerConnectionBundle>>(new Map());
  const peerTrackMetas = useRef<Map<string, PeerTrackMeta>>(new Map());
  const remoteVideoTracks = useRef<Map<string, Map<string, { track: MediaStreamTrack; stream: MediaStream }>>>(new Map());
  
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const isNegotiatingRef = useRef<Map<string, boolean>>(new Map());

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

  // Route video tracks for a given peer based on current metadata & peer state
  const routeVideoTracksForPeer = useCallback((peerId: string) => {
    const peerMap = remoteVideoTracks.current.get(peerId);
    if (!peerMap || peerMap.size === 0) {
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

    const meta = peerTrackMetas.current.get(peerId);
    const peerDb = peersRef.current.find((p) => p.id === peerId);

    let foundCamStream: MediaStream | null = null;
    let foundScreenStream: MediaStream | null = null;

    // Check each tracked video track
    peerMap.forEach(({ track, stream }) => {
      if (track.readyState !== 'live') return;

      const isExplicitScreen = meta?.screenTrackId && track.id === meta.screenTrackId;
      const isExplicitCam = meta?.camTrackId && track.id === meta.camTrackId;

      if (isExplicitScreen) {
        foundScreenStream = stream;
        return;
      }
      if (isExplicitCam) {
        foundCamStream = stream;
        return;
      }

      // Check label heuristics
      const label = track.label.toLowerCase();
      const isScreenLabel = label.includes('screen') || label.includes('window') || label.includes('display');

      if (isScreenLabel) {
        foundScreenStream = stream;
        return;
      }

      // Database status heuristics
      if (peerDb?.is_screen_sharing && !peerDb?.has_video) {
        foundScreenStream = stream;
      } else if (peerDb?.has_video && !peerDb?.is_screen_sharing) {
        foundCamStream = stream;
      } else if (!foundCamStream) {
        foundCamStream = stream;
      } else if (!foundScreenStream) {
        foundScreenStream = stream;
      }
    });

    // Update remoteCameraStreams
    setRemoteCameraStreams((prev) => {
      if (foundCamStream && (!peerDb || peerDb.has_video !== false)) {
        if (prev[peerId] === foundCamStream) return prev;
        return { ...prev, [peerId]: foundCamStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });

    // Update remoteScreenStreams
    setRemoteScreenStreams((prev) => {
      if (foundScreenStream && (!peerDb || peerDb.is_screen_sharing !== false)) {
        if (prev[peerId] === foundScreenStream) return prev;
        return { ...prev, [peerId]: foundScreenStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });
  }, []);

  // Synchronize remote stream states whenever peers database list updates
  useEffect(() => {
    if (!isMediaActive) return;
    peers.forEach((p) => {
      routeVideoTracksForPeer(p.id);
    });
  }, [peers, isMediaActive, routeVideoTracksForPeer]);

  // Clean up all connections when leaving media channels
  useEffect(() => {
    if (!isMediaActive) {
      peerBundles.current.forEach((bundle) => {
        try { bundle.pc.close(); } catch {}
      });
      peerBundles.current.clear();
      peerTrackMetas.current.clear();
      remoteVideoTracks.current.clear();
      pendingCandidates.current.clear();
      makingOfferRef.current.clear();
      isNegotiatingRef.current.clear();
      setRemoteStreams({});
      setRemoteCameraStreams({});
      setRemoteScreenStreams({});
      setRemoteSpeaking({});
    }
  }, [isMediaActive]);

  // Create or get RTCPeerConnection Bundle
  const getOrCreatePeerBundle = useCallback((peerId: string): PeerConnectionBundle => {
    let bundle = peerBundles.current.get(peerId);
    if (bundle && bundle.pc.connectionState !== 'closed' && bundle.pc.connectionState !== 'failed') {
      return bundle;
    }

    if (bundle) {
      try { bundle.pc.close(); } catch {}
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const newBundle: PeerConnectionBundle = {
      pc,
      audioSender: null,
      camSender: null,
      screenSender: null,
    };
    peerBundles.current.set(peerId, newBundle);

    // Attach local audio track if available
    const audioTrack = localAudioRef.current?.getAudioTracks()[0];
    if (audioTrack && localAudioRef.current) {
      try {
        newBundle.audioSender = pc.addTrack(audioTrack, localAudioRef.current);
      } catch {}
    }

    // Attach local camera track if available
    const camTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (camTrack && cameraStreamRef.current) {
      try {
        newBundle.camSender = pc.addTrack(camTrack, cameraStreamRef.current);
      } catch {}
    }

    // Attach local screen track if available
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
    if (screenTrack && screenStreamRef.current) {
      try {
        newBundle.screenSender = pc.addTrack(screenTrack, screenStreamRef.current);
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
        let peerMap = remoteVideoTracks.current.get(peerId);
        if (!peerMap) {
          peerMap = new Map();
          remoteVideoTracks.current.set(peerId, peerMap);
        }
        peerMap.set(track.id, { track, stream: streamToUse });

        const onLive = () => {
          routeVideoTracksForPeer(peerId);
        };

        track.addEventListener('unmute', onLive);
        track.addEventListener('ended', () => {
          const map = remoteVideoTracks.current.get(peerId);
          if (map) {
            map.delete(track.id);
          }
          routeVideoTracksForPeer(peerId);
        });

        routeVideoTracksForPeer(peerId);
      }
    };

    return newBundle;
  }, [sendRtcSignal, routeVideoTracksForPeer]);

  // Renegotiate with a specific peer cleanly
  const renegotiateWithPeer = useCallback(async (peerId: string) => {
    const bundle = getOrCreatePeerBundle(peerId);
    const pc = bundle.pc;

    if (isNegotiatingRef.current.get(peerId)) return;
    isNegotiatingRef.current.set(peerId, true);

    try {
      // If signaling is currently busy, wait for stable state
      if (pc.signalingState !== 'stable') {
        await new Promise<void>((resolve) => {
          const handler = () => {
            if (pc.signalingState === 'stable') {
              pc.removeEventListener('signalingstatechange', handler);
              resolve();
            }
          };
          pc.addEventListener('signalingstatechange', handler);
          setTimeout(() => {
            pc.removeEventListener('signalingstatechange', handler);
            resolve();
          }, 1500);
        });
      }

      if (pc.signalingState !== 'stable') return;

      makingOfferRef.current.set(peerId, true);
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;

      const optimizedSdp = optimizeAudioSdp(offer.sdp || '');
      const finalOffer = { type: offer.type, sdp: optimizedSdp };
      await pc.setLocalDescription(finalOffer);

      const camTrack = cameraStreamRef.current?.getVideoTracks()[0];
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];

      sendRtcSignal(peerId, {
        type: 'offer',
        offer: finalOffer,
        camTrackId: camTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
        hasCamera: Boolean(camTrack),
        isScreenSharing: Boolean(screenTrack),
      });
    } catch (err) {
      console.warn('[useWebRTC] Offer creation error:', err);
    } finally {
      makingOfferRef.current.set(peerId, false);
      isNegotiatingRef.current.set(peerId, false);
    }
  }, [getOrCreatePeerBundle, sendRtcSignal]);

  // Sync local tracks across all active peer connections
  const syncLocalTracks = useCallback(() => {
    if (!isMediaActive) return;

    const audioTrack = localAudioStream?.getAudioTracks()[0] || null;
    const camTrack = cameraStream?.getVideoTracks()[0] || null;
    const screenTrack = screenStream?.getVideoTracks()[0] || null;

    peerBundles.current.forEach((bundle, peerId) => {
      const pc = bundle.pc;
      let needsRenegotiation = false;

      // 1. Audio track sync
      if (audioTrack && localAudioStream) {
        if (bundle.audioSender) {
          bundle.audioSender.replaceTrack(audioTrack).catch(() => {});
        } else {
          try {
            bundle.audioSender = pc.addTrack(audioTrack, localAudioStream);
            needsRenegotiation = true;
          } catch {}
        }
      } else if (bundle.audioSender) {
        bundle.audioSender.replaceTrack(null).catch(() => {});
      }

      // 2. Camera video track sync
      if (camTrack && cameraStream) {
        if (bundle.camSender) {
          bundle.camSender.replaceTrack(camTrack).catch(() => {});
        } else {
          try {
            bundle.camSender = pc.addTrack(camTrack, cameraStream);
            needsRenegotiation = true;
          } catch {}
        }
      } else if (bundle.camSender) {
        bundle.camSender.replaceTrack(null).catch(() => {});
      }

      // 3. Screen share video track sync
      if (screenTrack && screenStream) {
        if (bundle.screenSender) {
          bundle.screenSender.replaceTrack(screenTrack).catch(() => {});
        } else {
          try {
            bundle.screenSender = pc.addTrack(screenTrack, screenStream);
            needsRenegotiation = true;
          } catch {}
        }
      } else if (bundle.screenSender) {
        bundle.screenSender.replaceTrack(null).catch(() => {});
      }

      // Send track metadata so receiver immediately knows which track is camera or screen
      sendRtcSignal(peerId, {
        type: 'track-meta',
        camTrackId: camTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
        hasCamera: Boolean(camTrack),
        isScreenSharing: Boolean(screenTrack),
      });

      if (needsRenegotiation && pc.signalingState === 'stable') {
        renegotiateWithPeer(peerId);
      }
    });
  }, [isMediaActive, localAudioStream, cameraStream, screenStream, renegotiateWithPeer, sendRtcSignal]);

  useEffect(() => {
    syncLocalTracks();
  }, [syncLocalTracks]);

  // Handle incoming WebRTC signals using Perfect Negotiation pattern
  useEffect(() => {
    setRtcSignalHandler(async (fromUserId, signal) => {
      if (!isMediaActive) return;
      if (fromUserId === currentUserId) return;

      const bundle = getOrCreatePeerBundle(fromUserId);
      const pc = bundle.pc;
      const isPolite = currentUserId > fromUserId;

      try {
        if (signal.type === 'track-meta') {
          peerTrackMetas.current.set(fromUserId, {
            camTrackId: signal.camTrackId,
            screenTrackId: signal.screenTrackId,
            hasCamera: signal.hasCamera,
            isScreenSharing: signal.isScreenSharing,
          });
          routeVideoTracksForPeer(fromUserId);
          return;
        }

        if (signal.type === 'offer') {
          if (signal.camTrackId !== undefined || signal.screenTrackId !== undefined) {
            peerTrackMetas.current.set(fromUserId, {
              camTrackId: signal.camTrackId,
              screenTrackId: signal.screenTrackId,
              hasCamera: signal.hasCamera,
              isScreenSharing: signal.isScreenSharing,
            });
          }

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

          const myCamTrack = cameraStreamRef.current?.getVideoTracks()[0];
          const myScreenTrack = screenStreamRef.current?.getVideoTracks()[0];

          sendRtcSignal(fromUserId, {
            type: 'answer',
            answer: finalAnswer,
            camTrackId: myCamTrack?.id || null,
            screenTrackId: myScreenTrack?.id || null,
            hasCamera: Boolean(myCamTrack),
            isScreenSharing: Boolean(myScreenTrack),
          });

          // Flush queued candidates
          const queued = pendingCandidates.current.get(fromUserId) || [];
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingCandidates.current.delete(fromUserId);

          routeVideoTracksForPeer(fromUserId);
        } else if (signal.type === 'answer') {
          if (signal.camTrackId !== undefined || signal.screenTrackId !== undefined) {
            peerTrackMetas.current.set(fromUserId, {
              camTrackId: signal.camTrackId,
              screenTrackId: signal.screenTrackId,
              hasCamera: signal.hasCamera,
              isScreenSharing: signal.isScreenSharing,
            });
          }

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

            routeVideoTracksForPeer(fromUserId);
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
  }, [isMediaActive, currentUserId, getOrCreatePeerBundle, sendRtcSignal, setRtcSignalHandler, routeVideoTracksForPeer]);

  // Maintain active connections to all peers in the channel
  useEffect(() => {
    if (!isMediaActive) return;

    peers.forEach((peer) => {
      if (peer.id === currentUserId) return;

      const existingBundle = peerBundles.current.get(peer.id);
      if (!existingBundle || existingBundle.pc.connectionState === 'closed') {
        const isInitiator = currentUserId < peer.id;
        if (isInitiator) {
          renegotiateWithPeer(peer.id);
        } else {
          getOrCreatePeerBundle(peer.id);
        }
      }
    });

    // Cleanup disconnected peers
    const activePeerIds = new Set(peers.map((p) => p.id));
    peerBundles.current.forEach((bundle, peerId) => {
      if (!activePeerIds.has(peerId) || peerId === currentUserId) {
        try { bundle.pc.close(); } catch {}
        peerBundles.current.delete(peerId);
        peerTrackMetas.current.delete(peerId);
        remoteVideoTracks.current.delete(peerId);
        pendingCandidates.current.delete(peerId);
        makingOfferRef.current.delete(peerId);
        isNegotiatingRef.current.delete(peerId);
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
      }
    });
  }, [isMediaActive, peers, currentUserId, renegotiateWithPeer, getOrCreatePeerBundle]);

  return {
    remoteStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking,
  };
}
