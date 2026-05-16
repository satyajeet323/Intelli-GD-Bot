import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Users, Plus, LogIn, Copy, Check, Share2,
  ArrowRight, X, Sparkles, ArrowLeft, RefreshCw, Tag, Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAITopic } from "@/lib/useAITopic";
import { sessions, isAuthenticated } from "@/lib/api";

export const Route = createFileRoute("/group-session")({
  head: () => ({
    meta: [
      { title: "Group Session — GD Bot" },
      { name: "description", content: "Create or join a real-time group discussion session." },
    ],
  }),
  component: GroupSessionLanding,
});

type Modal = "create" | "join" | null;

function GroupSessionLanding() {
  const navigate = useNavigate();
  const [modal,       setModal]       = useState<Modal>(null);
  const [sessionId,   setSessionId]   = useState<string>("");
  const [creating,    setCreating]    = useState(false);
  const [joinId,      setJoinId]      = useState("");
  const [copied,      setCopied]      = useState(false);
  const [joining,     setJoining]     = useState(false);

  const {
    topic: generatedTopic,
    ready: topicReady,
    error: topicError,
    regenerate: regenerateTopic,
  } = useAITopic();

  // Close modal on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = modal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modal]);

  const openCreate = () => {
    setSessionId("");
    setModal("create");
  };

  const openJoin = () => {
    setJoinId("");
    setModal("join");
  };

  const closeModal = useCallback(() => setModal(null), []);

  const copyId = async () => {
    if (!sessionId) return;
    await navigator.clipboard.writeText(sessionId);
    setCopied(true);
    toast.success("Session ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareId = async () => {
    if (!sessionId) return;
    const url = `${window.location.origin}/group-session/${sessionId}`;
    if (navigator.share) {
      await navigator.share({ title: "Join my GD Bot Group Session", url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied!");
    }
  };

  /**
   * Create a session via the API (requires auth).
   * On success, navigate into the session room.
   */
  const startSession = async () => {
    if (!isAuthenticated()) {
      toast.error("Please sign in to create a session.");
      navigate({ to: "/login" });
      return;
    }

    if (!topicReady || !generatedTopic) {
      toast.error("Topic is not ready yet. Please wait or try regenerating.");
      return;
    }

    setCreating(true);
    try {
      const res = await sessions.create({ type: "group", topic: generatedTopic });
      const newId = res.session.sessionId;
      setSessionId(newId);

      if (res.session.topic) {
        sessionStorage.setItem(`topic-${newId}`, res.session.topic);
      }

      toast.success("Session created!");
      navigate({ to: "/group-session/$sessionId", params: { sessionId: newId } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create session.";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const joinSession = async () => {
    const id = joinId.trim().toUpperCase();
    if (!id) { toast.error("Please enter a session ID"); return; }

    if (!isAuthenticated()) {
      toast.error("Please sign in to join a session.");
      navigate({ to: "/login" });
      return;
    }

    setJoining(true);
    try {
      // Validate the session exists before navigating
      const check = await sessions.validate(id);
      if (!check.valid) {
        toast.error(`Session "${id}" not found. Check the ID and try again.`);
        setJoining(false);
        return;
      }
      navigate({ to: "/group-session/$sessionId", params: { sessionId: id } });
    } catch {
      // If validation fails, still try to navigate — the room will handle the error
      navigate({ to: "/group-session/$sessionId", params: { sessionId: id } });
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem-2.75rem)] flex flex-col">
      <div className="flex-1 px-4 sm:px-8 py-8 max-w-5xl mx-auto w-full space-y-8 animate-fade-in">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl glass-strong p-8 sm:p-12 text-center">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl animate-float" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-cyan/25 blur-3xl animate-float" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-violet/10 blur-3xl animate-blob" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Real-time collaboration
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
              Discuss together,{" "}
              <span className="gradient-text">grow together</span>
            </h1>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
              Host or join a live group discussion with real-time video, AI-powered insights, and instant performance feedback.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={openCreate}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl gradient-cosmic px-7 py-3.5 font-semibold text-white shadow-glow hover:opacity-90 hover:scale-[1.02] transition-all"
              >
                <Plus className="h-5 w-5" /> Create a Meet
              </button>
              <button
                onClick={openJoin}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl glass border border-primary/30 px-7 py-3.5 font-semibold hover:shadow-glow hover:border-primary/60 hover:scale-[1.02] transition-all"
              >
                <LogIn className="h-5 w-5" /> Join a Meet
              </button>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Users,
              title: "Multi-participant",
              desc: "Up to 12 participants in a single session with adaptive grid layout.",
              tint: "from-primary/30 to-violet/20",
            },
            {
              icon: Sparkles,
              title: "AI Insights",
              desc: "Real-time AI analysis of discussion quality, turn-taking, and argument strength.",
              tint: "from-cyan/30 to-accent/20",
            },
            {
              icon: Share2,
              title: "Instant invite",
              desc: "Share a session ID or link — participants join in one click.",
              tint: "from-success/30 to-cyan/20",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 hover:shadow-glow hover:-translate-y-0.5 transition-all animate-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${f.tint} flex items-center justify-center mb-4`}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </div>

      {/* ── Create Modal ── */}
      {modal === "create" && (
        <ModalOverlay onClose={closeModal}>
          <div
            className="animate-scale-in glass-strong rounded-3xl w-full max-w-md mx-4 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
              <button
                onClick={closeModal}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h2 className="font-display font-bold text-base">Create a Meet</h2>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl gradient-cosmic flex items-center justify-center shadow-glow shrink-0">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm text-muted-foreground">
                  A session ID will be generated when you start. Share it with participants to let them join.
                </p>
              </div>

              {/* Discussion topic */}
              <div className="rounded-2xl glass border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-accent" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Discussion topic</span>
                    {topicReady && (
                      <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full font-semibold bg-accent/20 text-accent border border-accent/30">
                        ✦ Gemini
                      </span>
                    )}
                  </div>
                  <button
                    onClick={regenerateTopic}
                    disabled={!topicReady && !topicError}
                    title="Generate new topic"
                    className="h-7 w-7 rounded-lg glass flex items-center justify-center hover:shadow-glow transition hover:text-accent disabled:opacity-40"
                  >
                    {!topicReady && !topicError
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
                {topicError ? (
                  <div className="flex items-start gap-2 text-destructive text-xs">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{topicError}</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-snug min-h-[2.5rem]">
                    {!topicReady
                      ? <span className="text-muted-foreground animate-pulse">Generating topic…</span>
                      : generatedTopic
                    }
                  </p>
                )}
              </div>

              <button
                onClick={startSession}
                disabled={creating || !topicReady || !!topicError}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl gradient-cosmic py-3.5 font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-60 transition"
              >
                {creating
                  ? <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating…</>
                  : <>Start session <ArrowRight className="h-4 w-4" /></>
                }
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Join Modal ── */}
      {modal === "join" && (
        <ModalOverlay onClose={closeModal}>
          <div
            className="animate-scale-in glass-strong rounded-3xl w-full max-w-md mx-4 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
              <button
                onClick={closeModal}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <h2 className="font-display font-bold text-base">Join a Meet</h2>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan/40 to-accent/30 flex items-center justify-center shadow-glow-cyan shrink-0">
                  <LogIn className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter the session ID shared by your host to join instantly.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
                  Session ID
                </label>
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && joinSession()}
                  placeholder="e.g. ABCD-EFGH-IJKL"
                  className="w-full rounded-xl bg-white/5 border border-border/60 px-4 py-3 font-mono text-lg tracking-widest placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:shadow-glow transition"
                  autoFocus
                />
              </div>

              <button
                onClick={joinSession}
                disabled={joining}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl gradient-cosmic py-3.5 font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-60 transition"
              >
                {joining ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Joining…
                  </>
                ) : (
                  <>Join session <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-fade-in p-4"
      onClick={onClose}
    >
      {children}
    </div>
  );
}
