import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { Copy, Check, Wifi, WifiOff, Loader2, LogOut, Tag, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useGroupSession } from "@/components/group-session/useGroupSession";
import { ParticipantTile } from "@/components/group-session/ParticipantTile";
import { ControlBar } from "@/components/group-session/ControlBar";
import { ChatSidebar } from "@/components/group-session/ChatSidebar";
import { AIPanel } from "@/components/group-session/AIPanel";
import { LeaveDialog } from "@/components/group-session/LeaveDialog";
import { PeerRatingModal, type RatablePeer } from "@/components/group-session/PeerRatingModal";
import { sessions as sessionsApi, topics as topicsApi, reports } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

export const Route = createFileRoute("/group-session_/$sessionId")({
  head: () => ({
    meta: [
      { title: "Group Session — INTELLI BOT" },
      { name: "description", content: "Live group discussion session." },
    ],
  }),
  component: GroupSessionRoom,
});

// ── Main room component ───────────────────────────────────────────────────────
function GroupSessionRoom() {
  const { sessionId } = Route.useParams();
  // Read topic from sessionStorage (set by host when creating the session),
  // or fetch it from the API, or fall back to a generated topic.
  const [topic, setTopic] = useState<string>(() => {
    const stored = sessionStorage.getItem(`topic-${sessionId}`);
    if (stored) {
      sessionStorage.removeItem(`topic-${sessionId}`);
      return stored;
    }
    return "";
  });
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [chatOpen, setChatOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [showPeerRating, setShowPeerRating] = useState(false);
  const [peers, setPeers] = useState<RatablePeer[]>([]);

  // Fetch topic from API if not already set from sessionStorage
  useEffect(() => {
    if (topic) return; // already have it
    let cancelled = false;

    // Try to get topic from the session record first
    sessionsApi.get(sessionId)
      .then((res) => {
        const t = (res.session as { topic?: string }).topic;
        if (!cancelled && t) setTopic(t);
      })
      .catch(() => {
        // Fall back to generating a topic
        if (!cancelled) {
          topicsApi.generate()
            .then((res) => { if (!cancelled) setTopic(res.topic); })
            .catch(() => {});
        }
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const sessionStartRef = useRef<number>(Date.now());

  const {
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
  } = useGroupSession(sessionId, user?._id);

  // Intercept browser back / close while session is active
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const confirmLeave = useCallback(async () => {
    const myId = user?._id;

    // Count how many chat messages this user sent — used as "turns"
    const myTurns = chatMessages.filter((m) => m.isOwn).length;
    // Session duration in seconds
    const durationSec = Math.round((Date.now() - sessionStartRef.current) / 1000);

    // 1. Submit participation report so history shows real data.
    //    For group WebRTC sessions there's no per-turn AI scoring, so we
    //    derive a participation score from turns taken and session duration.
    //    Peer ratings will later update peerScore / combinedScore on top of this.
    try {
      const participationScore = Math.min(10, Math.max(1,
        myTurns > 0
          ? Math.min(10, 5 + myTurns * 0.5)   // 1 turn → 5.5, 10 turns → 10
          : Math.min(10, durationSec / 60)      // fallback: 1 min → 1, 10 min → 10
      ));
      await reports.submit(sessionId, {
        fluency:      participationScore,
        relevance:    participationScore,
        confidence:   participationScore,
        fillerWords:  0,
        turns:        myTurns,
        feedback:     "",
        aiFeedback:   "",
        peerScore:    null,
        peerFeedback: "",
        combinedScore: null,
      });
    } catch {
      // Non-fatal — peer ratings will still work
    }

    // 2. Tell the server we're leaving (updates MongoDB participant record)
    try {
      await sessionsApi.leave(sessionId);
    } catch {
      // Non-fatal — socket disconnect will also trigger leave on the server
    }

    // 3. Fetch the full participant list from MongoDB to build the peer rating list.
    try {
      const res = await sessionsApi.participants(sessionId);
      const rawPeers = (
        res.participants as Array<{ userId: string | { _id: string }; name: string }>
      ).map((p) => ({
        userId: typeof p.userId === "object" ? (p.userId as { _id: string })._id : String(p.userId),
        name:   p.name,
      }));

      // Deduplicate by userId and exclude self
      const seen = new Set<string>();
      const otherPeers: RatablePeer[] = [];
      for (const p of rawPeers) {
        if (!p.userId || p.userId === myId || seen.has(p.userId)) continue;
        seen.add(p.userId);
        otherPeers.push(p);
      }

      if (otherPeers.length > 0) {
        setPeers(otherPeers);
        setShowPeerRating(true);
        setShowLeaveDialog(false);
        return;
      }
    } catch {
      // If API call fails, skip peer rating
    }

    // Signal the dashboard to refetch stats (streak, session count, etc.)
    document.dispatchEvent(new Event("session-ended"));
    navigate({ to: "/group-session" });
    toast.success("You left the session.");
  }, [navigate, sessionId, user, chatMessages]);

  const handlePeerRatingDone = useCallback(() => {
    setShowPeerRating(false);
    // Fire a custom event so the dashboard refetches stats even if it was
    // already mounted (e.g. user opened session in same tab)
    document.dispatchEvent(new Event("session-ended"));
    navigate({ to: "/dashboard" });
    toast.success("Session ended — check History for your report.");
  }, [navigate]);

  const copySessionId = async () => {
    await navigator.clipboard.writeText(sessionId);
    setCopiedId(true);
    toast.success("Session ID copied!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Deduplicate participants before rendering — last entry wins for same userId.
  // This is a final safety net; the hook already deduplicates, but this prevents
  // any race condition from showing duplicate tiles.
  const uniqueParticipants = (() => {
    const seenIds = new Set<string>();
    const seenUserIds = new Set<string>();
    return participants.filter(p => {
      const uid = p.userId ?? p.id;
      if (seenUserIds.has(uid)) return false;
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      seenUserIds.add(uid);
      return true;
    });
  })();

  const sidebarOpen = chatOpen || aiOpen;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden animate-fade-in">

      {/* ── Top bar ── */}
      <header className="h-14 flex items-center justify-between px-3 sm:px-5 border-b border-white/8 bg-background/60 backdrop-blur-xl z-20 shrink-0 gap-2">

        {/* Left: back button + session info */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Back button */}
          <button
            onClick={() => setShowLeaveDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-white/10 px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:shadow-glow transition-all shrink-0"
            aria-label="Back to Group Session"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-white/10 shrink-0" />

          {/* Session info */}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
              Group Session
            </p>
            <p className="text-sm font-mono font-semibold tracking-wider truncate">{sessionId}</p>
          </div>
        </div>

        {/* Right: status + copy */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connection status pill */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground glass rounded-full px-3 py-1.5">
            {status === "connected" ? (
              <Wifi className="h-3 w-3 text-success" />
            ) : status === "connecting" || status === "reconnecting" ? (
              <Loader2 className="h-3 w-3 animate-spin text-warning" />
            ) : (
              <WifiOff className="h-3 w-3 text-destructive" />
            )}
            <span className="capitalize">{status}</span>
          </div>

          {/* Mobile status dot only */}
          <div className="sm:hidden flex items-center">
            {status === "connected" ? (
              <span className="h-2 w-2 rounded-full bg-success" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
            )}
          </div>

          {/* Copy session ID */}
          <button
            onClick={copySessionId}
            className="inline-flex items-center gap-1.5 text-xs glass rounded-full px-3 py-1.5 hover:shadow-glow transition"
          >
            {copiedId ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">{copiedId ? "Copied!" : "Copy ID"}</span>
          </button>

          {/* Leave button — visible shortcut in header on mobile */}
          <button
            onClick={() => setShowLeaveDialog(true)}
            className="sm:hidden inline-flex items-center gap-1.5 rounded-xl bg-destructive/20 border border-destructive/30 text-destructive px-2.5 py-1.5 text-xs font-semibold hover:bg-destructive/30 transition"
            aria-label="Leave session"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ── Topic banner ── */}
      <div className="shrink-0 px-3 sm:px-5 py-2 border-b border-white/8 bg-background/40">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Topic</span>
          <div className="h-3 w-px bg-white/10 shrink-0" />
          <p className="text-sm font-medium truncate">{topic}</p>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">

        {/* Video area - Responsive Grid Layout */}
        <div className="flex-1 flex flex-col min-w-0 p-2 sm:p-4 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div
              className={`h-full grid gap-2 sm:gap-3 auto-rows-fr ${
                uniqueParticipants.length === 1
                  ? "grid-cols-1"
                  : uniqueParticipants.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : uniqueParticipants.length === 3
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : uniqueParticipants.length === 4
                  ? "grid-cols-2"
                  : uniqueParticipants.length <= 6
                  ? "grid-cols-2 lg:grid-cols-3"
                  : uniqueParticipants.length <= 9
                  ? "grid-cols-2 sm:grid-cols-3"
                  : uniqueParticipants.length <= 12
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              }`}
              style={{
                gridAutoRows: uniqueParticipants.length === 1 
                  ? "100%" 
                  : uniqueParticipants.length === 2 
                  ? "100%" 
                  : uniqueParticipants.length <= 4 
                  ? "minmax(0, 1fr)" 
                  : "minmax(200px, 1fr)"
              }}
            >
              {uniqueParticipants.map((p) => (
                <div
                  key={p.id}
                  className={`min-h-0 ${
                    uniqueParticipants.length === 1 ? "h-full" : ""
                  }`}
                >
                  <ParticipantTile
                    participant={p}
                    isActive={p.id === activeSpeakerId}
                    size={uniqueParticipants.length === 1 ? "lg" : uniqueParticipants.length <= 4 ? "md" : "sm"}
                    onClick={() => {
                      // Optional: implement spotlight/pin feature
                      if (pinnedId === p.id) {
                        setPinnedId(null);
                      } else {
                        setPinnedId(p.id);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sidebar panels ── */}
        {sidebarOpen && (
          <div className="w-72 sm:w-80 shrink-0 flex flex-col border-l border-white/8 overflow-hidden">
            {chatOpen && !aiOpen && (
              <ChatSidebar
                messages={chatMessages}
                onSend={sendChatMessage}
                onClose={() => setChatOpen(false)}
              />
            )}
            {aiOpen && !chatOpen && (
              <AIPanel
                participants={participants}
                sessionId={sessionId}
                onClose={() => setAiOpen(false)}
              />
            )}
            {chatOpen && aiOpen && (
              <div className="flex flex-col h-full">
                <div className="flex border-b border-white/8 shrink-0">
                  <button
                    onClick={() => setAiOpen(false)}
                    className="flex-1 py-2.5 text-xs font-medium text-foreground border-b-2 border-primary"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="flex-1 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
                  >
                    AI Insights
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <ChatSidebar
                    messages={chatMessages}
                    onSend={sendChatMessage}
                    onClose={() => { setChatOpen(false); setAiOpen(false); }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Control bar ── */}
      <ControlBar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        screenSharing={screenSharing}
      participantCount={uniqueParticipants.length}
        status={status}
        chatOpen={chatOpen}
        aiOpen={aiOpen}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreen={toggleScreenShare}
        onToggleChat={() => {
          setChatOpen((v) => !v);
          if (!chatOpen) setAiOpen(false);
        }}
        onToggleAI={() => {
          setAiOpen((v) => !v);
          if (!aiOpen) setChatOpen(false);
        }}
        onLeave={() => setShowLeaveDialog(true)}
      />

      {/* ── Leave confirmation dialog ── */}
      {showLeaveDialog && (
        <LeaveDialog
          onConfirm={confirmLeave}
          onCancel={() => setShowLeaveDialog(false)}
        />
      )}

      {/* ── Peer rating modal — shown after leaving a group session ── */}
      {showPeerRating && (
        <PeerRatingModal
          sessionId={sessionId}
          peers={peers}
          onDone={handlePeerRatingDone}
        />
      )}
    </div>
  );
}
