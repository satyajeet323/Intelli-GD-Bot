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
      { title: "Group Session — INTELLI BOT" },
      { name: "description", content: "Create or join a real-time group discussion session." },
    ],
  }),
  component: GroupSessionLanding,
});

type Modal = "create" | "join" | null;

function GroupSessionLanding() {
  const navigate = useNavigate();
  const [modal,     setModal]     = useState<Modal>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [creating,  setCreating]  = useState(false);
  const [joinId,    setJoinId]    = useState("");
  const [copied,    setCopied]    = useState(false);
  const [joining,   setJoining]   = useState(false);

  const { topic: generatedTopic, ready: topicReady, error: topicError, regenerate: regenerateTopic } = useAITopic();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = modal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modal]);

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
      await navigator.share({ title: "Join my INTELLI BOT Group Session", url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied!");
    }
  };

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
      if (res.session.topic) sessionStorage.setItem(`topic-${newId}`, res.session.topic);
      toast.success("Session created!");
      navigate({ to: "/group-session/$sessionId", params: { sessionId: newId } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create session.");
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
      const check = await sessions.validate(id);
      if (!check.valid) {
        toast.error(`Session "${id}" not found. Check the ID and try again.`);
        setJoining(false);
        return;
      }
      navigate({ to: "/group-session/$sessionId", params: { sessionId: id } });
    } catch {
      navigate({ to: "/group-session/$sessionId", params: { sessionId: id } });
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem-2.75rem)] flex flex-col animate-fade-in" style={{ background: "var(--ib-bg)" }}>
      <div className="flex-1 px-4 sm:px-8 py-8 max-w-5xl mx-auto w-full space-y-8">

        {/* Hero */}
        <section
          className="relative overflow-hidden scanlines p-8 sm:p-12 text-center"
          style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}
        >
          <div className="ib-grid-bg" />
          <div className="ib-accent-line absolute left-0 top-0 bottom-0" />
          <div className="ib-accent-line absolute right-0 top-0 bottom-0" style={{ opacity: 0.15 }} />

          <div className="relative">
            <div className="ib-chip inline-block mb-6">
              <span style={{ color: "var(--ib-ok)" }}>●</span> Real-time collaboration
            </div>
            <h1 className="font-display text-4xl sm:text-5xl mb-4" style={{ color: "var(--ib-fg)" }}>
              Discuss together,{" "}
              <span className="gradient-text">grow together</span>
            </h1>
            <p className="text-sm sm:text-base max-w-lg mx-auto mb-8" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
              Host or join a live group discussion with real-time video, AI-powered insights, and instant performance feedback.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => setModal("create")} className="btn-primary w-full sm:w-auto" style={{ padding: "0.875rem 2rem" }}>
                <Plus className="h-5 w-5" /> Create a Meet
              </button>
              <button onClick={() => setModal("join")} className="btn-ghost w-full sm:w-auto" style={{ padding: "0.875rem 2rem" }}>
                <LogIn className="h-5 w-5" /> Join a Meet
              </button>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Users,    title: "Multi-participant", desc: "Up to 12 participants in a single session with adaptive grid layout." },
            { icon: Sparkles, title: "AI Insights",       desc: "Real-time AI analysis of discussion quality, turn-taking, and argument strength." },
            { icon: Share2,   title: "Instant invite",    desc: "Share a session ID or link — participants join in one click." },
          ].map((f, i) => (
            <div key={f.title} className="ib-card p-6 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div
                className="h-10 w-10 flex items-center justify-center mb-4"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                <f.icon className="h-5 w-5" style={{ color: "var(--ib-amber)" }} />
              </div>
              <h3 className="font-display text-lg mb-2" style={{ color: "var(--ib-fg)" }}>{f.title}</h3>
              <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>{f.desc}</p>
            </div>
          ))}
        </section>
      </div>

      {/* ── Create Modal ── */}
      {modal === "create" && (
        <ModalOverlay onClose={closeModal}>
          <div
            className="animate-scale-in w-full max-w-md mx-4 relative"
            style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Corner brackets */}
            <span style={{ position: "absolute", top: -1, left: -1, width: 14, height: 14, borderTop: "2px solid var(--ib-amber)", borderLeft: "2px solid var(--ib-amber)" }} />
            <span style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderBottom: "2px solid var(--ib-amber)", borderRight: "2px solid var(--ib-amber)" }} />

            <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
              <button onClick={closeModal} className="btn-ghost py-1 px-2 text-xs inline-flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="font-display text-base" style={{ color: "var(--ib-fg)" }}>Create a Meet</h2>
              <button onClick={closeModal} aria-label="Close" className="h-8 w-8 flex items-center justify-center" style={{ color: "var(--ib-muted)", border: "1px solid var(--ib-bdr)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center shrink-0" style={{ background: "var(--ib-amber)", clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)" }}>
                  <Plus className="h-5 w-5" style={{ color: "#0c0b09" }} />
                </div>
                <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                  A session ID will be generated when you start. Share it with participants to let them join.
                </p>
              </div>

              {/* Topic */}
              <div className="p-4 space-y-3" style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5" style={{ color: "var(--ib-amber)" }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                      Discussion topic
                    </span>
                    {topicReady && <span className="ib-chip">✦ Gemini</span>}
                  </div>
                  <button
                    onClick={regenerateTopic}
                    disabled={!topicReady && !topicError}
                    className="h-7 w-7 flex items-center justify-center transition-colors disabled:opacity-40"
                    style={{ border: "1px solid var(--ib-bdr)", color: "var(--ib-muted)" }}
                  >
                    {!topicReady && !topicError
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />
                    }
                  </button>
                </div>
                {topicError ? (
                  <div className="flex items-start gap-2 text-xs" style={{ color: "var(--ib-terra)" }}>
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{topicError}</span>
                  </div>
                ) : (
                  <p className="text-sm font-medium leading-snug min-h-[2.5rem]" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif" }}>
                    {!topicReady
                      ? <span style={{ color: "var(--ib-muted)" }} className="animate-pulse">Generating topic…</span>
                      : generatedTopic
                    }
                  </p>
                )}
              </div>

              <button
                onClick={startSession}
                disabled={creating || !topicReady || !!topicError}
                className="btn-primary w-full"
              >
                {creating
                  ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Creating…</>
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
            className="animate-scale-in w-full max-w-md mx-4 relative"
            style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ position: "absolute", top: -1, left: -1, width: 14, height: 14, borderTop: "2px solid var(--ib-amber)", borderLeft: "2px solid var(--ib-amber)" }} />
            <span style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderBottom: "2px solid var(--ib-amber)", borderRight: "2px solid var(--ib-amber)" }} />

            <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
              <button onClick={closeModal} className="btn-ghost py-1 px-2 text-xs inline-flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <h2 className="font-display text-base" style={{ color: "var(--ib-fg)" }}>Join a Meet</h2>
              <button onClick={closeModal} aria-label="Close" className="h-8 w-8 flex items-center justify-center" style={{ color: "var(--ib-muted)", border: "1px solid var(--ib-bdr)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center shrink-0" style={{ background: "rgba(192,132,252,0.15)", border: "1px solid rgba(192,132,252,0.3)" }}>
                  <LogIn className="h-5 w-5" style={{ color: "var(--ib-purple)" }} />
                </div>
                <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
                  Enter the session ID shared by your host to join instantly.
                </p>
              </div>

              <div>
                <label style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)", display: "block", marginBottom: "0.5rem" }}>
                  Session ID
                </label>
                <input
                  type="text"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && joinSession()}
                  placeholder="e.g. ABCD-EFGH-IJKL"
                  className="ib-input"
                  style={{ fontSize: "1rem", letterSpacing: "0.15em", textTransform: "uppercase" }}
                  autoFocus
                />
              </div>

              <button onClick={joinSession} disabled={joining} className="btn-primary w-full">
                {joining
                  ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Joining…</>
                  : <>Join session <ArrowRight className="h-4 w-4" /></>
                }
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
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in p-4"
      style={{ background: "rgba(12,11,9,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}
