/**
 * useGroupSession — Real WebRTC multi-participant session hook.
 *
 * Key fixes in this version:
 *  1. ICE candidate buffering — candidates that arrive before setRemoteDescription
 *     completes are queued and flushed once the remote description is set.
 *  2. userId dependency — the effect re-runs when userId becomes available so
 *     the join-session event always carries the authenticated user's ID.
 *  3. StrictMode guard — generation counter prevents the discarded first mount
 *     from interfering with the real mount.
 *  4. Reconnection — on socket reconnect, re-joins the session automatically.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Participant = {
  id:           string;   // socket ID for remotes, "local" for self
  userId?:      string;
  name:         string;
  stream:       MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSpeaking:   boolean;
  isLocal:      boolean;
};

export type ChatMessage = {
  id:         string;
  senderId:   string;
  senderName: string;
  text:       string;
  ts:         number;
  isOwn?:     boolean;  // true when this message was sent by the local user
};

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

// ── Config ────────────────────────────────────────────────────────────────────

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  ...(import.meta.env.VITE_ICE_SERVER_URL
    ? [{
        urls:       import.meta.env.VITE_ICE_SERVER_URL  as string,
        username:   import.meta.env.VITE_ICE_SERVER_USER as string | undefined,
        credential: import.meta.env.VITE_ICE_SERVER_CRED as string | undefined,
      }]
    : []),
];

function getNameFromToken(): string {
  try {
    const token = getToken();
    if (!token) return "Participant";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.name as string) || "Participant";
  } catch {
    return "Participant";
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGroupSession(sessionId: string, userId?: string) {

  const [participants,    setParticipants]    = useState<Participant[]>([]);
  const [chatMessages,    setChatMessages]    = useState<ChatMessage[]>([]);
  const [status,          setStatus]          = useState<ConnectionStatus>("connecting");
  const [audioEnabled,    setAudioEnabled]    = useState(true);
  const [videoEnabled,    setVideoEnabled]    = useState(true);
  const [screenSharing,   setScreenSharing]   = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>("local");

  const socketRef       = useRef<Socket | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef        = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const speakTimerRef   = useRef<number | null>(null);
  const genRef          = useRef(0);
  // Stable ref for userId — updated without re-running the effect
  const userIdRef       = useRef<string | undefined>(userId);
  // Per-peer ICE candidate queue — holds candidates that arrived before
  // setRemoteDescription completed.
  const icePendingRef   = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Stable ref to the local socket ID — set once connected, used to guard
  // against adding ourselves as a remote participant.
  const localSocketIdRef = useRef<string | null>(null);

  const upsertParticipant = useCallback((patch: Partial<Participant> & { id: string }) => {
    setParticipants(prev => {
      // Never add the local socket as a remote participant tile.
      if (!patch.isLocal && patch.id === localSocketIdRef.current) return prev;

      // First check: does an entry with this socketId already exist?
      const bySocketId = prev.findIndex(p => p.id === patch.id);

      // Second check: does an entry with this userId already exist under a
      // DIFFERENT socketId? (happens when a user reconnects — new socket ID
      // but same userId). Replace the old entry to avoid ghost tiles.
      const byUserId = patch.userId
        ? prev.findIndex(p => p.userId === patch.userId && p.id !== patch.id && !p.isLocal)
        : -1;

      if (bySocketId !== -1) {
        // Normal update — same socket ID
        const updated = [...prev];
        updated[bySocketId] = { ...updated[bySocketId], ...patch };
        return updated;
      }

      if (byUserId !== -1) {
        // Same user, new socket — replace the stale entry in-place so the
        // tile position doesn't jump around in the grid.
        const updated = [...prev];
        updated[byUserId] = {
          ...updated[byUserId],
          id:           patch.id,
          userId:       patch.userId,
          name:         patch.name         ?? updated[byUserId].name,
          stream:       patch.stream       ?? null, // new socket has no stream yet
          audioEnabled: patch.audioEnabled ?? updated[byUserId].audioEnabled,
          videoEnabled: patch.videoEnabled ?? updated[byUserId].videoEnabled,
          isSpeaking:   patch.isSpeaking   ?? false,
          isLocal:      false,
        };
        return updated;
      }

      // New participant
      return [...prev, {
        id:           patch.id,
        userId:       patch.userId,
        name:         patch.name         ?? "Participant",
        stream:       patch.stream       ?? null,
        audioEnabled: patch.audioEnabled ?? true,
        videoEnabled: patch.videoEnabled ?? true,
        isSpeaking:   patch.isSpeaking   ?? false,
        isLocal:      patch.isLocal      ?? false,
      }];
    });
  }, []);

  const removeParticipantById = useCallback((id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
  }, []);

  // ── Create RTCPeerConnection ───────────────────────────────────────────────

  const createPeer = useCallback((
    remoteSocketId: string,
    isInitiator:    boolean,
    socket:         Socket,
  ) => {
    if (peersRef.current.has(remoteSocketId)) {
      return peersRef.current.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(remoteSocketId, pc);
    icePendingRef.current.set(remoteSocketId, []);

    // Add local tracks if the stream is already available.
    // If not yet available (getUserMedia still pending), the acquireMedia
    // callback will add them retroactively once the stream arrives.
    localStreamRef.current?.getTracks().forEach(track => {
      const sender = pc.addTrack(track, localStreamRef.current!);
      console.log(`[WebRTC] Added ${track.kind} track to peer ${remoteSocketId}`, sender);
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("webrtc-ice", { targetSocketId: remoteSocketId, candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received ${event.track.kind} track from ${remoteSocketId}`, event);
      const remoteStream = event.streams[0];
      if (remoteStream) {
        console.log(`[WebRTC] Setting stream for participant ${remoteSocketId}`, remoteStream);
        upsertParticipant({ id: remoteSocketId, stream: remoteStream });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state for ${remoteSocketId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed") {
        console.warn(`[WebRTC] ICE connection failed for ${remoteSocketId}, attempting restart`);
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${remoteSocketId}: ${pc.connectionState}`);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        peersRef.current.delete(remoteSocketId);
        icePendingRef.current.delete(remoteSocketId);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          console.log(`[WebRTC] Sending offer to ${remoteSocketId}`);
          socket.emit("webrtc-offer", {
            targetSocketId: remoteSocketId,
            sdp: pc.localDescription,
          });
        })
        .catch(err => console.error(`[WebRTC] Error creating offer for ${remoteSocketId}:`, err));
    }

    return pc;
  }, [upsertParticipant]);

  // ── Flush buffered ICE candidates after remote description is set ──────────

  const flushPendingIce = useCallback(async (remoteSocketId: string) => {
    const pc      = peersRef.current.get(remoteSocketId);
    const pending = icePendingRef.current.get(remoteSocketId) ?? [];
    if (!pc || !pending.length) return;
    icePendingRef.current.set(remoteSocketId, []);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore stale candidates */ }
    }
  }, []);

  // ── Speaking detection ─────────────────────────────────────────────────────

  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    try {
      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;

      const data = new Uint8Array(analyser.frequencyBinCount);
      speakTimerRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg      = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 18;
        setParticipants(prev =>
          prev.map(p => p.isLocal ? { ...p, isSpeaking: speaking } : p)
        );
        if (speaking) setActiveSpeakerId("local");
      }, 200);
    } catch { /* AudioContext unavailable */ }
  }, []);

  // Keep userIdRef current on every render without re-running the socket effect.
  // Also patch the local participant's userId when it resolves (auth loads after mount).
  useEffect(() => {
    userIdRef.current = userId;
    if (userId) {
      setParticipants(prev =>
        prev.map(p => p.isLocal && !p.userId ? { ...p, userId } : p)
      );
    }
  }, [userId]);

  // ── Main effect — runs once per sessionId ─────────────────────────────────
  // userId is read from userIdRef inside the effect so it's always current
  // without needing to be a dependency (which would tear down the socket).

  useEffect(() => {
    const myGen   = ++genRef.current;
    const isStale = () => genRef.current !== myGen;
    // Read name and userId from the token at mount time.
    // userIdRef is kept in sync above so the chat isOwn check always uses
    // the latest value without recreating the socket.
    const userName = getNameFromToken();

    const socket = io(SERVER_URL, {
      transports:            ["polling", "websocket"],
      reconnectionDelay:     1000,
      reconnectionAttempts:  10,
      // Send JWT in handshake so the server can verify identity immediately.
      // The server attaches socket.data.user from this token.
      auth: { token: getToken() ?? "" },
    });
    socketRef.current = socket;

    const joinSession = () => {
      socket.emit("join-session", {
        sessionId,
        name:   userName,
        // Always read from ref so we send the real userId even if auth
        // resolved after the socket was created
        userId: userIdRef.current ?? null,
      });
    };

    socket.on("connect", () => {
      if (isStale()) return;
      localSocketIdRef.current = socket.id;
      console.log("[WebRTC] Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      if (isStale()) return;
      setStatus("disconnected");
    });

    socket.on("reconnect", () => {
      if (isStale()) return;
      setStatus("reconnecting");
      // Re-join after reconnect so the server re-registers us
      joinSession();
    });

    socket.on("connect_error", () => {
      if (isStale()) return;
      setStatus("disconnected");
      console.warn("[WebRTC] Cannot reach signalling server at", SERVER_URL);
    });

    // ── Acquire media with fallback chain, then join ──────────────────────
    // Try HD video+audio → basic video+audio → audio-only → no media.
    // After the stream is obtained (or all attempts fail), add tracks to any
    // peer connections that were already created (race-condition guard).
    const acquireMedia = async (): Promise<MediaStream | null> => {
      const attempts: (() => Promise<MediaStream>)[] = [
        () => navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }),
        () => navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
        () => navigator.mediaDevices.getUserMedia({ video: false, audio: true }),
      ];

      for (const attempt of attempts) {
        try {
          return await attempt();
        } catch (err) {
          console.warn("[WebRTC] getUserMedia attempt failed:", (err as Error).message);
        }
      }
      return null;
    };

    acquireMedia().then(stream => {
      if (isStale()) { stream?.getTracks().forEach(t => t.stop()); return; }

      if (stream) {
        console.log("[WebRTC] Got local media stream", stream);
        localStreamRef.current = stream;
        const hasVideo = stream.getVideoTracks().length > 0;
        const hasAudio = stream.getAudioTracks().length > 0;
        upsertParticipant({
          id: "local", userId: userIdRef.current, name: userName, stream,
          audioEnabled: hasAudio, videoEnabled: hasVideo, isLocal: true,
        });
        startSpeakingDetection(stream);

        // Add tracks to any peer connections already created before stream arrived
        peersRef.current.forEach((pc, remoteSocketId) => {
          const existingKinds = new Set(pc.getSenders().map(s => s.track?.kind));
          let tracksAdded = false;
          stream.getTracks().forEach(track => {
            if (!existingKinds.has(track.kind)) {
              pc.addTrack(track, stream);
              tracksAdded = true;
              console.log(`[WebRTC] Late-added ${track.kind} track to existing peer ${remoteSocketId}`);
            }
          });
          // If we added tracks to an already-connected peer, trigger renegotiation
          if (tracksAdded && (pc.signalingState === "stable") && socketRef.current) {
            const sock = socketRef.current;
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                console.log(`[WebRTC] Renegotiating with ${remoteSocketId} after late track add`);
                sock.emit("webrtc-offer", {
                  targetSocketId: remoteSocketId,
                  sdp: pc.localDescription,
                });
              })
              .catch(err => console.error(`[WebRTC] Renegotiation error for ${remoteSocketId}:`, err));
          }
        });
      } else {
        console.error("[WebRTC] All getUserMedia attempts failed — joining without media");
        upsertParticipant({
          id: "local", userId: userIdRef.current, name: userName, stream: null,
          audioEnabled: false, videoEnabled: false, isLocal: true,
        });
      }

      joinSession();
    });

    // ── Server events ──────────────────────────────────────────────────────

    socket.on("session-joined", ({ peers }: {
      peers: Array<{ socketId: string; name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string }>;
    }) => {
      if (isStale()) return;
      console.log(`[WebRTC] Session joined with ${peers.length} existing peers`);
      setStatus("connected");

      // Deduplicate peers by userId before processing — the server already
      // deduplicates, but be defensive on the client side too.
      // Also filter out our own socket (shouldn't be in peers, but guard anyway).
      const seenUserIds = new Set<string>();
      const dedupedPeers = peers.filter(p => {
        if (p.socketId === socket.id) return false; // never connect to self
        if (!p.userId) return true;
        if (seenUserIds.has(p.userId)) return false;
        seenUserIds.add(p.userId);
        return true;
      });

      dedupedPeers.forEach(p => {
        console.log(`[WebRTC] Creating peer connection for ${p.name} (${p.socketId})`);
        upsertParticipant({
          id: p.socketId, userId: p.userId, name: p.name,
          stream: null, audioEnabled: p.audioEnabled, videoEnabled: p.videoEnabled,
        });
        createPeer(p.socketId, true, socket);
      });
    });

    socket.on("session-error", ({ message }: { message: string }) => {
      if (isStale()) return;
      console.error("[WebRTC] Session error:", message);
      setStatus("disconnected");
    });

    socket.on("peer-joined", ({ participant }: {
      participant: { socketId: string; name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string };
    }) => {
      if (isStale()) return;
      // Guard: never add ourselves as a remote participant
      if (participant.socketId === socket.id) return;
      console.log(`[WebRTC] New peer joined: ${participant.name} (${participant.socketId})`);
      upsertParticipant({
        id: participant.socketId, userId: participant.userId,
        name: participant.name, stream: null,
        audioEnabled: participant.audioEnabled, videoEnabled: participant.videoEnabled,
      });
      // Only create a new peer connection if one doesn't already exist
      if (!peersRef.current.has(participant.socketId)) {
        createPeer(participant.socketId, false, socket);
      }
    });

    socket.on("peer-left", ({ socketId, reason }: { socketId: string; reason?: string }) => {
      if (isStale()) return;
      console.log(`[WebRTC] Peer left: ${socketId}${reason ? ` (${reason})` : ""}`);
      // Close and remove the peer connection
      peersRef.current.get(socketId)?.close();
      peersRef.current.delete(socketId);
      icePendingRef.current.delete(socketId);
      // Remove from participant list
      removeParticipantById(socketId);
    });

    socket.on("room-roster", ({ participants: roster }: {
      participants: Array<{ socketId: string; name: string; audioEnabled: boolean; videoEnabled: boolean; userId?: string }>;
    }) => {
      if (isStale()) return;
      console.log(`[WebRTC] Room roster update: ${roster.length} participants`);

      // Build the set of active remote socketIds from the authoritative roster.
      // Filter out our own socket so we never render ourselves as a remote tile.
      const activeSocketIds = new Set(
        roster
          .map(p => p.socketId)
          .filter(id => id !== socket.id)
      );

      // Close and remove peer connections for anyone no longer in the roster.
      peersRef.current.forEach((pc, remoteSocketId) => {
        if (!activeSocketIds.has(remoteSocketId)) {
          console.log(`[WebRTC] Roster cleanup: closing stale peer ${remoteSocketId}`);
          pc.close();
          peersRef.current.delete(remoteSocketId);
          icePendingRef.current.delete(remoteSocketId);
        }
      });

      // Rebuild the participant list from the authoritative server roster.
      // Keep the local participant (never in the roster) and merge in remotes.
      // Deduplicate by userId: if the same userId appears twice (shouldn't
      // happen after server fix, but defensive), keep the latest entry.
      setParticipants(prev => {
        const localParticipant = prev.find(p => p.isLocal);

        // Build a map of existing remote participants keyed by socketId so we
        // can preserve their live stream references.
        const existingById = new Map(prev.filter(p => !p.isLocal).map(p => [p.id, p]));

        // Deduplicate roster by userId (last entry wins — server sends newest first)
        // Also exclude our own socket from the remote list.
        const seenUserIds = new Set<string>();
        const dedupedRoster = roster.filter(p => {
          if (p.socketId === socket.id) return false; // never show self as remote
          if (!p.userId) return true; // guests always included
          if (seenUserIds.has(p.userId)) return false;
          seenUserIds.add(p.userId);
          return true;
        });

        const remotes = dedupedRoster.map(p => {
          const existing = existingById.get(p.socketId);
          return existing
            ? { ...existing, name: p.name, audioEnabled: p.audioEnabled, videoEnabled: p.videoEnabled }
            : {
                id:           p.socketId,
                userId:       p.userId,
                name:         p.name,
                stream:       null,
                audioEnabled: p.audioEnabled,
                videoEnabled: p.videoEnabled,
                isSpeaking:   false,
                isLocal:      false,
              };
        });

        return localParticipant ? [localParticipant, ...remotes] : remotes;
      });
    });

    socket.on("peer-updated", ({ socketId, audioEnabled, videoEnabled, isSpeaking }: {
      socketId: string; audioEnabled?: boolean; videoEnabled?: boolean; isSpeaking?: boolean;
    }) => {
      if (isStale()) return;
      setParticipants(prev =>
        prev.map(p => p.id === socketId ? {
          ...p,
          ...(audioEnabled !== undefined && { audioEnabled }),
          ...(videoEnabled !== undefined && { videoEnabled }),
          ...(isSpeaking   !== undefined && { isSpeaking }),
        } : p)
      );
      if (isSpeaking) setActiveSpeakerId(socketId);
    });

    socket.on("webrtc-offer", async ({ fromSocketId, sdp }: {
      fromSocketId: string; sdp: RTCSessionDescriptionInit;
    }) => {
      if (isStale()) return;
      console.log(`[WebRTC] Received offer from ${fromSocketId}`);
      let pc = peersRef.current.get(fromSocketId);
      if (!pc) {
        console.log(`[WebRTC] Creating new peer connection for ${fromSocketId}`);
        pc = createPeer(fromSocketId, false, socket);
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`[WebRTC] Set remote description for ${fromSocketId}`);
        await flushPendingIce(fromSocketId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`[WebRTC] Sending answer to ${fromSocketId}`);
        socket.emit("webrtc-answer", {
          targetSocketId: fromSocketId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error("[WebRTC] offer handling error:", err);
      }
    });

    socket.on("webrtc-answer", async ({ fromSocketId, sdp }: {
      fromSocketId: string; sdp: RTCSessionDescriptionInit;
    }) => {
      if (isStale()) return;
      console.log(`[WebRTC] Received answer from ${fromSocketId}`);
      const pc = peersRef.current.get(fromSocketId);
      if (!pc) {
        console.warn(`[WebRTC] No peer connection found for ${fromSocketId}`);
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log(`[WebRTC] Set remote description (answer) for ${fromSocketId}`);
        await flushPendingIce(fromSocketId);
      } catch (err) {
        console.error("[WebRTC] answer handling error:", err);
      }
    });

    socket.on("webrtc-ice", async ({ fromSocketId, candidate }: {
      fromSocketId: string; candidate: RTCIceCandidateInit;
    }) => {
      if (isStale()) return;
      const pc = peersRef.current.get(fromSocketId);
      if (!pc) return;

      // If remote description isn't set yet, buffer the candidate
      if (!pc.remoteDescription) {
        const pending = icePendingRef.current.get(fromSocketId) ?? [];
        pending.push(candidate);
        icePendingRef.current.set(fromSocketId, pending);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore stale candidates */ }
    });

    socket.on("chat-message", (msg: ChatMessage) => {
      if (isStale()) return;
      // Tag messages from the current user so the UI can render them differently.
      // senderId is the stable userId (MongoDB _id) for authenticated users,
      // or socket.id for guests. We check both to handle all cases.
      const currentUserId = userIdRef.current;
      const isOwn = !!(
        (currentUserId && msg.senderId === currentUserId) ||
        msg.senderId === socket.id
      );
      setChatMessages(prev => [...prev, { ...msg, isOwn }]);
    });

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      genRef.current = myGen + 1;
      socket.emit("leave-session", { sessionId });
      socket.disconnect();

      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;

      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      icePendingRef.current.clear();

      if (speakTimerRef.current) window.clearInterval(speakTimerRef.current);
      speakTimerRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  // sessionId is the only real dependency — userId is read from userIdRef
  // so changing it doesn't tear down and recreate the socket connection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setAudioEnabled(v => {
      const next = !v;
      socketRef.current?.emit("toggle-audio", { sessionId, enabled: next });
      setParticipants(prev => prev.map(p => p.isLocal ? { ...p, audioEnabled: next } : p));
      return next;
    });
  }, [sessionId]);

  const toggleVideo = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setVideoEnabled(v => {
      const next = !v;
      socketRef.current?.emit("toggle-video", { sessionId, enabled: next });
      setParticipants(prev => prev.map(p => p.isLocal ? { ...p, videoEnabled: next } : p));
      return next;
    });
  }, [sessionId]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        peersRef.current.forEach(pc => {
          pc.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(camTrack);
        });
      }
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        setScreenSharing(true);
        const screenTrack = screen.getVideoTracks()[0];
        peersRef.current.forEach(pc => {
          pc.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => {
          setScreenSharing(false);
          screenStreamRef.current = null;
          const camTrack = localStreamRef.current?.getVideoTracks()[0];
          if (camTrack) {
            peersRef.current.forEach(pc => {
              pc.getSenders().find(s => s.track?.kind === "video")?.replaceTrack(camTrack);
            });
          }
        };
      } catch { /* user cancelled */ }
    }
  }, [screenSharing]);

  const sendChatMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    socketRef.current?.emit("chat-message", { sessionId, text });
  }, [sessionId]);

  return {
    localStream: localStreamRef.current,
    participants,
    chatMessages,
    status,
    audioEnabled,
    videoEnabled,
    screenSharing,
    activeSpeakerId,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendChatMessage,
  };
}
