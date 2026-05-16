import { useState, useEffect } from "react";
import { Sparkles, X, TrendingUp, MessageCircle, Lightbulb, RefreshCw } from "lucide-react";
import type { Participant } from "./useGroupSession";

interface AIPanelProps {
  participants: Participant[];
  sessionId: string;
  onClose: () => void;
}

type Insight = {
  id: string;
  type: "tip" | "trend" | "highlight";
  text: string;
  ts: number;
};

const INSIGHT_POOL = [
  { type: "tip" as const, text: "Priya is dominating the conversation. Encourage others to contribute." },
  { type: "trend" as const, text: "Discussion energy is rising — key arguments are being made." },
  { type: "highlight" as const, text: "Strong counter-argument detected. Consider acknowledging it." },
  { type: "tip" as const, text: "Use data or examples to strengthen your next point." },
  { type: "trend" as const, text: "Consensus forming around the economic impact angle." },
  { type: "highlight" as const, text: "Excellent use of structured reasoning in the last turn." },
  { type: "tip" as const, text: "Try to summarise the group's position before introducing a new angle." },
  { type: "trend" as const, text: "Participation is balanced — great collaborative dynamic." },
  { type: "highlight" as const, text: "Logical fallacy detected — consider redirecting the argument." },
];

const ICON_MAP = {
  tip: Lightbulb,
  trend: TrendingUp,
  highlight: MessageCircle,
};

const COLOR_MAP = {
  tip: "from-warning/30 to-warning/10 border-warning/30 text-warning",
  trend: "from-cyan/30 to-cyan/10 border-cyan/30 text-cyan",
  highlight: "from-primary/30 to-primary/10 border-primary/30 text-primary",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
          style={{ width: `${(value / 10) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function AIPanel({ participants, sessionId, onClose }: AIPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [scores] = useState({
    fluency: 7.4 + Math.random() * 1.5,
    relevance: 7.8 + Math.random() * 1.2,
    engagement: 8.1 + Math.random() * 1.0,
    balance: 6.5 + Math.random() * 2.0,
  });

  // Drip in insights over time
  useEffect(() => {
    const add = (idx: number) => {
      if (idx >= INSIGHT_POOL.length) return;
      const item = INSIGHT_POOL[idx];
      setInsights((prev) => [
        ...prev,
        { ...item, id: crypto.randomUUID(), ts: Date.now() },
      ]);
    };

    add(0);
    const timers = INSIGHT_POOL.slice(1).map((_, i) =>
      window.setTimeout(() => add(i + 1), (i + 1) * 8000 + Math.random() * 3000)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full glass-strong border-l border-white/8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">AI Insights</h3>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Live scores */}
        <div className="px-4 py-4 border-b border-white/8">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Live session scores
          </p>
          <div className="space-y-3">
            <ScoreBar label="Fluency" value={scores.fluency} />
            <ScoreBar label="Relevance" value={scores.relevance} />
            <ScoreBar label="Engagement" value={scores.engagement} />
            <ScoreBar label="Balance" value={scores.balance} />
          </div>
        </div>

        {/* Participant activity */}
        <div className="px-4 py-4 border-b border-white/8">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Participation
          </p>
          <div className="space-y-2">
            {participants.map((p, i) => {
              const pct = Math.max(10, 100 - i * 18 + Math.random() * 10);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 truncate">{p.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan to-primary"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">
                    {Math.round(Math.min(100, pct))}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Insights feed */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Real-time insights
            </p>
            <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <div className="space-y-2">
            {insights.length === 0 && (
              <p className="text-xs text-muted-foreground">Analysing discussion…</p>
            )}
            {insights.map((ins) => {
              const Icon = ICON_MAP[ins.type];
              return (
                <div
                  key={ins.id}
                  className={`flex gap-2.5 rounded-xl border bg-gradient-to-br p-3 animate-fade-up ${COLOR_MAP[ins.type]}`}
                >
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p className="text-xs leading-relaxed text-foreground/90">{ins.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
