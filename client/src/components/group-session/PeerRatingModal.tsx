/**
 * PeerRatingModal — Post-session peer evaluation interface.
 *
 * Shown after a group session ends. Each participant rates every other
 * participant on four criteria (1–5 stars each) with an optional comment.
 * Submits all ratings in one batch; cannot rate yourself.
 */

import { useState } from "react";
import { Star, Send, X, Users, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { peerRatings, type PeerRatingInput } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RatablePeer = {
  userId: string;
  name:   string;
};

type CriterionKey = "communication" | "relevance" | "confidence" | "clarity";

const CRITERIA: { key: CriterionKey; label: string; desc: string }[] = [
  { key: "communication", label: "Communication",    desc: "Clarity and structure of expression" },
  { key: "relevance",     label: "Relevance",        desc: "How on-topic and focused their points were" },
  { key: "confidence",    label: "Confidence",       desc: "Assertiveness and conviction" },
  { key: "clarity",       label: "Clarity of Ideas", desc: "How well ideas were explained" },
];

type RatingDraft = Record<CriterionKey, number> & { comment: string };

function emptyDraft(): RatingDraft {
  return { communication: 0, relevance: 0, confidence: 0, clarity: 0, comment: "" };
}

// ── Star rating widget ────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value:    number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex gap-1" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`transition-transform ${disabled ? "cursor-default" : "hover:scale-110 cursor-pointer"}`}
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              n <= display
                ? "fill-warning text-warning"
                : "fill-transparent text-border"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type Props = {
  sessionId: string;
  peers:     RatablePeer[];   // all other participants (not the current user)
  onDone:    () => void;      // called after submit or skip
};

export function PeerRatingModal({ sessionId, peers, onDone }: Props) {
  // One draft per peer, keyed by userId
  const [drafts, setDrafts] = useState<Record<string, RatingDraft>>(
    () => Object.fromEntries(peers.map((p) => [p.userId, emptyDraft()]))
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting]  = useState(false);
  const [done,       setDone]        = useState(false);

  const currentPeer = peers[currentIdx];
  const draft       = drafts[currentPeer?.userId] ?? emptyDraft();

  const updateDraft = (userId: string, patch: Partial<RatingDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch },
    }));
  };

  const isCurrentComplete = () =>
    CRITERIA.every((c) => (drafts[currentPeer?.userId]?.[c.key] ?? 0) > 0);

  const allComplete = () =>
    peers.every((p) => CRITERIA.every((c) => (drafts[p.userId]?.[c.key] ?? 0) > 0));

  const handleSubmit = async () => {
    if (!allComplete()) {
      toast.error("Please rate all participants before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: PeerRatingInput[] = peers.map((p) => ({
        rateeId:       p.userId,
        communication: drafts[p.userId].communication,
        relevance:     drafts[p.userId].relevance,
        confidence:    drafts[p.userId].confidence,
        clarity:       drafts[p.userId].clarity,
        comment:       drafts[p.userId].comment.trim(),
      }));

      await peerRatings.submit(sessionId, payload);
      setDone(true);
      toast.success("Peer ratings submitted — thank you!");
      setTimeout(onDone, 1800);
    } catch (err: unknown) {
      const apiErr = err as { data?: { errors?: Array<{ field: string; message: string }> }; message?: string };
      const fieldErrors = apiErr?.data?.errors?.map((e) => e.message).join(", ");
      const msg = fieldErrors || apiErr?.message || "Failed to submit ratings.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── No peers (solo session) ───────────────────────────────────────────────
  if (peers.length === 0) {
    return (
      <ModalShell onClose={onDone}>
        <div className="text-center py-8">
          <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No other participants to rate.</p>
          <button
            onClick={onDone}
            className="mt-5 inline-flex items-center gap-2 rounded-xl gradient-cosmic px-6 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90 transition"
          >
            Continue
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <ModalShell onClose={onDone}>
        <div className="text-center py-8">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-success" />
          <h3 className="font-display text-lg font-bold">Ratings submitted!</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your feedback helps everyone improve.
          </p>
        </div>
      </ModalShell>
    );
  }

  // ── Progress indicator ────────────────────────────────────────────────────
  const completedCount = peers.filter((p) =>
    CRITERIA.every((c) => (drafts[p.userId]?.[c.key] ?? 0) > 0)
  ).length;

  return (
    <ModalShell onClose={onDone}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-lg font-bold">Rate your peers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completedCount} of {peers.length} rated
          </p>
        </div>
        {/* Peer tabs */}
        <div className="flex gap-1.5">
          {peers.map((p, i) => {
            const complete = CRITERIA.every((c) => (drafts[p.userId]?.[c.key] ?? 0) > 0);
            return (
              <button
                key={p.userId}
                onClick={() => setCurrentIdx(i)}
                title={p.name}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  i === currentIdx
                    ? "bg-primary scale-125"
                    : complete
                    ? "bg-success"
                    : "bg-border"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-border/40 mb-6 overflow-hidden">
        <div
          className="h-full rounded-full gradient-cosmic transition-all duration-500"
          style={{ width: `${(completedCount / peers.length) * 100}%` }}
        />
      </div>

      {/* Current peer card */}
      <div className="glass rounded-2xl p-5 mb-5">
        {/* Peer name */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl gradient-aurora flex items-center justify-center text-sm font-bold text-background select-none">
            {currentPeer.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="font-semibold">{currentPeer.name}</div>
            <div className="text-xs text-muted-foreground">Rate their performance</div>
          </div>
        </div>

        {/* Criteria */}
        <div className="space-y-4">
          {CRITERIA.map((c) => (
            <div key={c.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{c.desc}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {draft[c.key] > 0 ? `${draft[c.key]}/5` : "—"}
                </span>
              </div>
              <StarRating
                value={draft[c.key]}
                onChange={(v) => updateDraft(currentPeer.userId, { [c.key]: v })}
                disabled={submitting}
              />
            </div>
          ))}
        </div>

        {/* Optional comment */}
        <div className="mt-4">
          <label className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5 block">
            Comment <span className="normal-case">(optional)</span>
          </label>
          <textarea
            rows={2}
            maxLength={500}
            value={draft.comment}
            onChange={(e) => updateDraft(currentPeer.userId, { comment: e.target.value })}
            disabled={submitting}
            placeholder="Any specific feedback for this participant…"
            className="w-full resize-none rounded-xl bg-background/40 border border-border/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 transition"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0 || submitting}
          className="h-10 w-10 rounded-xl glass flex items-center justify-center hover:shadow-glow transition disabled:opacity-40"
          aria-label="Previous peer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {currentIdx < peers.length - 1 ? (
          <button
            onClick={() => setCurrentIdx((i) => i + 1)}
            disabled={!isCurrentComplete() || submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl gradient-cosmic py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50 transition"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allComplete() || submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl gradient-cosmic py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50 transition"
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
              : <><Send className="h-4 w-4" /> Submit ratings</>
            }
          </button>
        )}

        <button
          onClick={() => setCurrentIdx((i) => Math.min(peers.length - 1, i + 1))}
          disabled={currentIdx === peers.length - 1 || submitting}
          className="h-10 w-10 rounded-xl glass flex items-center justify-center hover:shadow-glow transition disabled:opacity-40"
          aria-label="Next peer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Skip link */}
      <p className="mt-4 text-center">
        <button
          onClick={onDone}
          disabled={submitting}
          className="text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-2"
        >
          Skip for now
        </button>
      </p>
    </ModalShell>
  );
}

// ── Shell wrapper ─────────────────────────────────────────────────────────────

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-fade-in">
      <div
        className="animate-scale-in glass-strong rounded-3xl w-full max-w-md relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10 transition z-10"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
