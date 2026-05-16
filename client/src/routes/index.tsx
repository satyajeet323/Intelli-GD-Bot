import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Mic, BarChart3, Users, ArrowRight,
  Zap, Trophy, MessageSquare, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GD Bot — AI-Powered Group Discussion Coach" },
      { name: "description", content: "Master group discussions with real-time AI scoring, voice coaching, and peer feedback." },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Mic,
    title: "Voice-First AI Coach",
    desc: "Speak naturally. The AI listens, scores your fluency, detects filler words, and replies in real time.",
  },
  {
    icon: BarChart3,
    title: "13-Metric Live Scoring",
    desc: "Fluency, relevance, confidence, grammar, pitch, rhythm — every turn scored instantly by Gemini AI.",
  },
  {
    icon: Users,
    title: "Real Group Sessions",
    desc: "Host or join live WebRTC video rooms. Practice with peers and get combined AI + peer ratings.",
  },
  {
    icon: Trophy,
    title: "Leaderboards & Reports",
    desc: "Detailed post-session reports with AI feedback, peer scores, and a ranked leaderboard.",
  },
  {
    icon: Zap,
    title: "Instant Topic Generation",
    desc: "Never run out of ideas. AI generates fresh, relevant discussion topics on demand.",
  },
  {
    icon: MessageSquare,
    title: "AI Mentor Feedback",
    desc: "Real-time grammar corrections, vocabulary suggestions, and improvement tips after every turn.",
  },
];

const stats = [
  { value: "13",        label: "Scoring metrics" },
  { value: "Real-time", label: "AI feedback"     },
  { value: "WebRTC",    label: "Group sessions"  },
  { value: "ElevenLabs",label: "Voice synthesis" },
];

function Landing() {
  const { theme, toggle } = useTheme();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">GD Bot</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="h-9 w-9 rounded-lg flex items-center justify-center border border-border/60 hover:bg-muted transition-colors"
            >
              {theme === "dark"
                ? <Sun  className="h-4 w-4 text-muted-foreground" />
                : <Moon className="h-4 w-4 text-muted-foreground" />
              }
            </button>
            <Link
              to="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-80 transition"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center animate-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Voice-first AI discussion coach
        </span>

        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.08]">
          Master the
          <br />
          <span className="gradient-text">group discussion.</span>
        </h1>

        <p className="mt-6 mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
          Real-time fluency, relevance & confidence scoring. Practice 1-on-1 with an AI that talks back,
          or jump into live group sessions with peers.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-7 py-3.5 font-semibold hover:opacity-80 transition text-base"
          >
            Start practicing free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-7 py-3.5 font-semibold hover:bg-muted transition text-base"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-border/50 bg-card grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/40">
          {stats.map((s) => (
            <div key={s.label} className="px-8 py-6 text-center">
              <div className="font-display text-2xl font-bold">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">What you get</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Everything to{" "}
            <span className="gradient-text">speak with confidence</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border/50 bg-card p-6 hover:border-foreground/20 hover:shadow-glow transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">How it works</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Three steps to a{" "}
            <span className="gradient-text">confident speaker</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { step: "01", title: "Create your account",  desc: "Sign up in seconds. No credit card required to start practicing." },
            { step: "02", title: "Pick your mode",       desc: "Solo AI session for focused practice, or group session to compete with peers." },
            { step: "03", title: "Get scored & improve", desc: "Review your detailed report, track your streak, and climb the leaderboard." },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-border/50 bg-card p-7">
              <div className="font-display text-5xl font-bold gradient-text opacity-30 mb-4 leading-none select-none">
                {s.step}
              </div>
              <h3 className="font-semibold text-base mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-border/50 bg-card p-12 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6">
            <Mic className="h-7 w-7 text-primary-foreground animate-float" />
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Ready to find your voice?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm leading-relaxed">
            Join GD Bot and start turning nervous rambling into sharp, confident discussion.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-8 py-3.5 font-semibold hover:opacity-80 transition text-base"
          >
            Get started for free <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="underline hover:text-foreground transition-colors">Sign in</Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">GD Bot</span>
          </div>
          <p>© {new Date().getFullYear()} GD Bot. AI-powered discussion practice.</p>
          <div className="flex items-center gap-4">
            <Link to="/login"    className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
