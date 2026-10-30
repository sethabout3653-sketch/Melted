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
  micAudioTrackId?: string | null;
  screenAudioTrackId?: string | null;
  camTrackId?: string | null;
  screenTrackId?: string | null;
  hasCamera?: boolean;
  isScreenSharing?: boolean;
  hasScreenAudio?: boolean;
}

interface PeerConnectionBundle {
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender | null;       // Microphone audio (kept apart)
  screenAudioSender: RTCRtpSender | null; // Screen share system audio (kept apart)
  camSender: RTCRtpSender | null;         // Camera video
  screenSender: RTCRtpSender | null;      // Screen share video
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
  // Remote microphone speech streams
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  // Remote screen share audio streams (completely separate from mic)
  const [remoteScreenAudioStreams, setRemoteScreenAudioStreams] = useState<Record<string, MediaStream>>({});
  // Remote camera video streams
  const [remoteCameraStreams, setRemoteCameraStreams] = useState<Record<string, MediaStream>>({});
  // Remote screen share video streams
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});

  const peerBundles = useRef<Map<string, PeerConnectionBundle>>(new Map());
  const peerTrackMetas = useRef<Map<string, PeerTrackMeta>>(new Map());
  
  // Track storage per peer
  const remoteAudioTracks = useRef<Map<string, Map<string, { track: MediaStreamTrack; stream: MediaStream }>>>(new Map());
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

  // Route audio tracks for a given peer (distinguishing mic vs screen share audio)
  const routeAudioTracksForPeer = useCallback((peerId: string) => {
    const peerAudioMap = remoteAudioTracks.current.get(peerId);
    if (!peerAudioMap || peerAudioMap.size === 0) {
      setRemoteStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
      setRemoteScreenAudioStreams((prev) => {
        if (!prev[peerId]) return prev;
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      });
      return;
    }

    const meta = peerTrackMetas.current.get(peerId);
    const peerDb = peersRef.current.find((p) => p.id === peerId);

    let foundMicStream: MediaStream | null = null;
    let foundScreenAudioStream: MediaStream | null = null;

    peerAudioMap.forEach(({ track, stream }) => {
      if (track.readyState !== 'live') return;

      const isExplicitScreenAudio = meta?.screenAudioTrackId && track.id === meta.screenAudioTrackId;
      const isExplicitMic = meta?.micAudioTrackId && track.id === meta.micAudioTrackId;

      if (isExplicitScreenAudio) {
        foundScreenAudioStream = stream;
        return;
      }
      if (isExplicitMic) {
        foundMicStream = stream;
        return;
      }

      // Check label heuristics
      const label = track.label.toLowerCase();
      const isScreenLabel = label.includes('screen') || label.includes('display') || label.includes('window') || label.includes('system');

      if (isScreenLabel) {
        foundScreenAudioStream = stream;
        return;
      }

      if (!foundMicStream) {
        foundMicStream = stream;
      } else if (!foundScreenAudioStream) {
        foundScreenAudioStream = stream;
      }
    });

    // Update remote microphone audio
    setRemoteStreams((prev) => {
      if (foundMicStream) {
        if (prev[peerId] === foundMicStream) return prev;
        return { ...prev, [peerId]: foundMicStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });

    // Update remote screen share audio (only if peer is actively screen sharing)
    setRemoteScreenAudioStreams((prev) => {
      if (foundScreenAudioStream && (!peerDb || peerDb.is_screen_sharing !== false)) {
        if (prev[peerId] === foundScreenAudioStream) return prev;
        return { ...prev, [peerId]: foundScreenAudioStream };
      }
      if (prev[peerId]) {
        const copy = { ...prev };
        delete copy[peerId];
        return copy;
      }
      return prev;
    });
  }, []);

  // Route video tracks for a given peer based on metadata & peer state
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

      const label = track.label.toLowerCase();
      const isScreenLabel = label.includes('screen') || label.includes('window') || label.includes('display');

      if (isScreenLabel) {
        foundScreenStream = stream;
        return;
      }

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

    setRemoteCameraStreams((prev) => {
      const hasLiveCamTrack = foundCamStream && foundCamStream.getVideoTracks().some((t) => t.readyState === 'live');
      if (hasLiveCamTrack && foundCamStream) {
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

    setRemoteScreenStreams((prev) => {
      const hasLiveScreenTrack = foundScreenStream && foundScreenStream.getVideoTracks().some((t) => t.readyState === 'live');
      if (hasLiveScreenTrack && foundScreenStream) {
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
      routeAudioTracksForPeer(p.id);
      routeVideoTracksForPeer(p.id);
    });
  }, [peers, isMediaActive, routeAudioTracksForPeer, routeVideoTracksForPeer]);

  // Clean up all connections when leaving media channels
  useEffect(() => {
    if (!isMediaActive) {
      peerBundles.current.forEach((bundle) => {
        try { bundle.pc.close(); } catch {}
      });
      peerBundles.current.clear();
      peerTrackMetas.current.clear();
      remoteAudioTracks.current.clear();
      remoteVideoTracks.current.clear();
      pendingCandidates.current.clear();
      makingOfferRef.current.clear();
      isNegotiatingRef.current.clear();
      setRemoteStreams({});
      setRemoteScreenAudioStreams({});
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
      screenAudioSender: null,
      camSender: null,
      screenSender: null,
    };
    peerBundles.current.set(peerId, newBundle);

    // 1. Attach local microphone track (kept apart from screen audio)
    const micTrack = localAudioRef.current?.getAudioTracks()[0];
    if (micTrack && localAudioRef.current) {
      try {
        newBundle.audioSender = pc.addTrack(micTrack, localAudioRef.current);
      } catch {}
    }

    // 2. Attach screen audio track if available (kept apart from mic audio)
    const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
    if (screenAudioTrack && screenStreamRef.current) {
      try {
        newBundle.screenAudioSender = pc.addTrack(screenAudioTrack, screenStreamRef.current);
      } catch {}
    }

    // 3. Attach local camera video track
    const camTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (camTrack && cameraStreamRef.current) {
      try {
        newBundle.camSender = pc.addTrack(camTrack, cameraStreamRef.current);
      } catch {}
    }

    // 4. Attach local screen video track
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

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        try { pc.restartIce(); } catch {}
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const [stream] = event.streams;
      const streamToUse = stream || new MediaStream([track]);

      if (track.kind === 'audio') {
        let peerMap = remoteAudioTracks.current.get(peerId);
        if (!peerMap) {
          peerMap = new Map();
          remoteAudioTracks.current.set(peerId, peerMap);
        }
        peerMap.set(track.id, { track, stream: streamToUse });

        const onAudioChange = () => {
          routeAudioTracksForPeer(peerId);
        };

        track.addEventListener('unmute', onAudioChange);
        track.addEventListener('ended', () => {
          const map = remoteAudioTracks.current.get(peerId);
          if (map) {
            map.delete(track.id);
          }
          routeAudioTracksForPeer(peerId);
        });

        routeAudioTracksForPeer(peerId);
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
  }, [sendRtcSignal, routeAudioTracksForPeer, routeVideoTracksForPeer]);

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

      const micTrack = localAudioRef.current?.getAudioTracks()[0];
      const screenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
      const camTrack = cameraStreamRef.current?.getVideoTracks()[0];
      const screenTrack = screenStreamRef.current?.getVideoTracks()[0];

      sendRtcSignal(peerId, {
        type: 'offer',
        offer: finalOffer,
        micAudioTrackId: micTrack?.id || null,
        screenAudioTrackId: screenAudioTrack?.id || null,
        camTrackId: camTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
        hasCamera: Boolean(camTrack),
        isScreenSharing: Boolean(screenTrack),
        hasScreenAudio: Boolean(screenAudioTrack),
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

    const micTrack = localAudioStream?.getAudioTracks()[0] || null;
    const screenAudioTrack = screenStream?.getAudioTracks()[0] || null;
    const camTrack = cameraStream?.getVideoTracks()[0] || null;
    const screenTrack = screenStream?.getVideoTracks()[0] || null;

    peerBundles.current.forEach((bundle, peerId) => {
      const pc = bundle.pc;
      let needsRenegotiation = false;

      // 1. Microphone audio track sync (kept apart from screen audio)
      if (micTrack && localAudioStream) {
        if (bundle.audioSender) {
          bundle.audioSender.replaceTrack(micTrack).catch(() => {});
        } else {
          try {
            bundle.audioSender = pc.addTrack(micTrack, localAudioStream);
            needsRenegotiation = true;
          } catch {}
        }
      } else if (bundle.audioSender) {
        bundle.audioSender.replaceTrack(null).catch(() => {});
      }

      // 2. Screen share audio track sync (kept apart from mic audio)
      if (screenAudioTrack && screenStream) {
        if (bundle.screenAudioSender) {
          bundle.screenAudioSender.replaceTrack(screenAudioTrack).catch(() => {});
        } else {
          try {
            bundle.screenAudioSender = pc.addTrack(screenAudioTrack, screenStream);
            needsRenegotiation = true;
          } catch {}
        }
      } else if (bundle.screenAudioSender) {
        bundle.screenAudioSender.replaceTrack(null).catch(() => {});
      }

      // 3. Camera video track sync
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

      // 4. Screen share video track sync
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

      // Send track metadata so receiver immediately knows each track's purpose
      sendRtcSignal(peerId, {
        type: 'track-meta',
        micAudioTrackId: micTrack?.id || null,
        screenAudioTrackId: screenAudioTrack?.id || null,
        camTrackId: camTrack?.id || null,
        screenTrackId: screenTrack?.id || null,
        hasCamera: Boolean(camTrack),
        isScreenSharing: Boolean(screenTrack),
        hasScreenAudio: Boolean(screenAudioTrack),
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
            micAudioTrackId: signal.micAudioTrackId,
            screenAudioTrackId: signal.screenAudioTrackId,
            camTrackId: signal.camTrackId,
            screenTrackId: signal.screenTrackId,
            hasCamera: signal.hasCamera,
            isScreenSharing: signal.isScreenSharing,
            hasScreenAudio: signal.hasScreenAudio,
          });
          routeAudioTracksForPeer(fromUserId);
          routeVideoTracksForPeer(fromUserId);
          return;
        }

        if (signal.type === 'offer') {
          if (signal.micAudioTrackId !== undefined || signal.screenAudioTrackId !== undefined || signal.screenTrackId !== undefined) {
            peerTrackMetas.current.set(fromUserId, {
              micAudioTrackId: signal.micAudioTrackId,
              screenAudioTrackId: signal.screenAudioTrackId,
              camTrackId: signal.camTrackId,
              screenTrackId: signal.screenTrackId,
              hasCamera: signal.hasCamera,
              isScreenSharing: signal.isScreenSharing,
              hasScreenAudio: signal.hasScreenAudio,
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

          const myMicTrack = localAudioRef.current?.getAudioTracks()[0];
          const myScreenAudioTrack = screenStreamRef.current?.getAudioTracks()[0];
          const myCamTrack = cameraStreamRef.current?.getVideoTracks()[0];
          const myScreenTrack = screenStreamRef.current?.getVideoTracks()[0];

          sendRtcSignal(fromUserId, {
            type: 'answer',
            answer: finalAnswer,
            micAudioTrackId: myMicTrack?.id || null,
            screenAudioTrackId: myScreenAudioTrack?.id || null,
            camTrackId: myCamTrack?.id || null,
            screenTrackId: myScreenTrack?.id || null,
            hasCamera: Boolean(myCamTrack),
            isScreenSharing: Boolean(myScreenTrack),
            hasScreenAudio: Boolean(myScreenAudioTrack),
          });

          // Flush queued candidates
          const queued = pendingCandidates.current.get(fromUserId) || [];
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingCandidates.current.delete(fromUserId);

          routeAudioTracksForPeer(fromUserId);
          routeVideoTracksForPeer(fromUserId);
        } else if (signal.type === 'answer') {
          if (signal.micAudioTrackId !== undefined || signal.screenAudioTrackId !== undefined || signal.screenTrackId !== undefined) {
            peerTrackMetas.current.set(fromUserId, {
              micAudioTrackId: signal.micAudioTrackId,
              screenAudioTrackId: signal.screenAudioTrackId,
              camTrackId: signal.camTrackId,
              screenTrackId: signal.screenTrackId,
              hasCamera: signal.hasCamera,
              isScreenSharing: signal.isScreenSharing,
              hasScreenAudio: signal.hasScreenAudio,
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

            routeAudioTracksForPeer(fromUserId);
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
  }, [isMediaActive, currentUserId, getOrCreatePeerBundle, sendRtcSignal, setRtcSignalHandler, routeAudioTracksForPeer, routeVideoTracksForPeer]);

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
        remoteAudioTracks.current.delete(peerId);
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
        setRemoteScreenAudioStreams((prev) => {
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
    remoteScreenAudioStreams,
    remoteCameraStreams,
    remoteScreenStreams,
    remoteSpeaking,
  };
}
