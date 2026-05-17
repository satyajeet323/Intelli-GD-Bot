/**
 * INTELLI BOT — Landing Page
 * Industrial-Tech / Mission Control aesthetic
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, BarChart3, Users, ArrowRight, Zap, Trophy,
  MessageSquare, Activity, Cpu, Radio, Terminal, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INTELLI BOT — AI-Powered Group Discussion Coach" },
      { name: "description", content: "Master group discussions with real-time AI scoring, voice coaching, and peer feedback." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Mic,           title: "Voice-First AI Coach",     desc: "Speak naturally. The AI listens, scores your fluency, detects filler words, and replies in real time." },
  { icon: BarChart3,     title: "13-Metric Live Scoring",   desc: "Fluency, relevance, confidence, grammar, pitch, rhythm — every turn scored instantly." },
  { icon: Users,         title: "Real Group Sessions",      desc: "Host or join live WebRTC video rooms. Practice with peers and get combined AI + peer ratings." },
  { icon: Trophy,        title: "Leaderboards & Reports",   desc: "Detailed post-session reports with AI feedback, peer scores, and a ranked leaderboard." },
  { icon: Zap,           title: "Instant Topic Generation", desc: "Never run out of ideas. AI generates fresh, relevant discussion topics on demand." },
  { icon: MessageSquare, title: "AI Mentor Feedback",       desc: "Real-time grammar corrections, vocabulary suggestions, and improvement tips after every turn." },
];

const steps = [
  { n: "01", title: "Create your account",  desc: "Sign up in seconds. No credit card required to start practicing." },
  { n: "02", title: "Pick your mode",       desc: "Solo AI session for focused practice, or group session to compete with peers." },
  { n: "03", title: "Get scored & improve", desc: "Review your detailed report, track your streak, and climb the leaderboard." },
];

const metrics = [
  { value: "13",         label: "Scoring Metrics", icon: Activity },
  { value: "< 200ms",   label: "AI Response",      icon: Zap },
  { value: "WebRTC",    label: "P2P Sessions",      icon: Radio },
  { value: "ElevenLabs",label: "Voice Synthesis",   icon: Cpu },
];

/* ── Particle canvas ─────────────────────────────────────────────────────── */
function HeroParticles() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const ptRef      = useRef<Array<{ x: number; y: number; vx: number; vy: number }>>([]);
  const dimRef     = useRef({ w: 0, h: 0 });

  const init = useCallback((w: number, h: number) => {
    const n = Math.min(70, Math.floor((w * h) / 9000));
    ptRef.current = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      dimRef.current = { w: rect.width, h: rect.height };
      canvas.width  = rect.width;
      canvas.height = rect.height;
      init(rect.width, rect.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const { w, h } = dimRef.current;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, w, h);
      const pts = ptRef.current;
      for (const p of pts) {
        p.x = (p.x + p.vx + w) % w;
        p.y = (p.y + p.vy + h) % h;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(245,158,11,${(1 - d / 120) * 0.2})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245,158,11,0.6)";
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [init]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    />
  );
}

/* ── Waveform canvas ─────────────────────────────────────────────────────── */
function WaveformCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const draw = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(245,158,11,0.45)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const t = (x / canvas.width) * Math.PI * 6 + frame * 0.04;
        const y = canvas.height / 2 + Math.sin(t) * 18 + Math.sin(t * 2.3 + 1) * 8;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      frame++;
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "60px", display: "block" }} />;
}

/* ── Animated counter ────────────────────────────────────────────────────── */
function useCountUp(target: string, active: boolean) {
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    if (!active || isNaN(parseFloat(target))) { setDisplay(target); return; }
    const end = parseFloat(target);
    const dur = 1400;
    const step = (ts: number, t0: number) => {
      const p    = Math.min((ts - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(String(Math.floor(ease * end)));
      if (p < 1) requestAnimationFrame((t) => step(t, t0));
      else setDisplay(target);
    };
    requestAnimationFrame((t) => step(t, t));
  }, [active, target]);
  return display;
}

/* ── Ticker ─────────────────────────────────────────────────────────────── */
function Ticker() {
  const items = [
    "FLUENCY ANALYSIS", "CONFIDENCE SCORING", "GRAMMAR CHECK",
    "PITCH DETECTION", "FILLER WORD MONITOR", "REAL-TIME FEEDBACK",
    "GROUP SESSIONS", "LEADERBOARD", "TOPIC GENERATION", "VOICE SYNTHESIS",
  ];
  return (
    <div style={{ overflow: "hidden", borderTop: "1px solid var(--ib-bdr)", borderBottom: "1px solid var(--ib-bdr)", background: "var(--ib-surf)", padding: "10px 0" }}>
      <div style={{ display: "flex", gap: "3rem", animation: "ib-ticker 22s linear infinite", whiteSpace: "nowrap" }}>
        {[...items, ...items].map((item, i) => (
          <span key={i} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: "var(--ib-amber)", display: "flex", alignItems: "center", gap: "1rem" }}>
            {item} <span style={{ color: "var(--ib-bdr)", fontSize: "1rem" }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Metric chip ─────────────────────────────────────────────────────────── */
function MetricChip({ value, label, icon: Icon, active }: {
  value: string; label: string; icon: typeof Activity; active: boolean;
}) {
  const display = useCountUp(value, active);
  return (
    <div
      className="p-5 text-center"
      style={{
        background: "var(--ib-surf)",
        border: "1px solid var(--ib-bdr)",
        borderBottom: "2px solid var(--ib-amber)",
      }}
    >
      <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: "var(--ib-amber)" }} />
      <div className="font-display text-2xl gradient-text">{display}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ib-mut2)", marginTop: "2px" }}>
        {label}
      </div>
    </div>
  );
}

/* ── Intersection-based reveal hook ─────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref     = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, vis };
}

/* ── Main ────────────────────────────────────────────────────────────────── */
function Landing() {
  const { theme, toggle } = useTheme();
  const [metricsVisible, setMetricsVisible] = useState(false);
  const { ref: featRef, vis: featVis }   = useReveal();
  const { ref: stepsRef, vis: stepsVis } = useReveal();

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setMetricsVisible(true); }, { threshold: 0.2 });
    const el  = document.getElementById("metrics-section");
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ background: "var(--ib-bg)", minHeight: "100vh" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 h-14"
        style={{ background: "var(--ib-surf)", borderBottom: "1px solid var(--ib-bdr)" }}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="h-8 w-8 flex items-center justify-center"
            style={{ background: "var(--ib-amber)", clipPath: "polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 0 100%)" }}
          >
            <Mic className="h-4 w-4" style={{ color: "#0c0b09" }} />
          </div>
          <span className="font-display text-lg" style={{ color: "var(--ib-fg)", letterSpacing: "0.1em" }}>
            INTELLI<span style={{ color: "var(--ib-amber)" }}>BOT</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="h-7 w-7 flex items-center justify-center transition-colors"
            style={{ border: "1px solid var(--ib-bdr)", background: "transparent", color: "var(--ib-mut2)" }}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <Link
            to="/login"
            style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-mut2)" }}
          >
            Sign in
          </Link>
          <Link to="/register" className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden scanlines px-6 sm:px-10 py-24 sm:py-32"
        style={{ background: "var(--ib-card)", borderBottom: "1px solid var(--ib-bdr)", minHeight: "540px" }}
      >
        <HeroParticles />
        <div className="ib-grid-bg" />
        <div className="ib-accent-line absolute left-10 top-0 bottom-0 hidden lg:block" />
        <div className="ib-accent-line absolute right-10 top-0 bottom-0 hidden lg:block" style={{ opacity: 0.15 }} />
        {/* Subtle amber glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 55% 45% at 50% 40%, var(--ib-amber) 0%, transparent 70%)", opacity: 0.05 }}
        />

        <div className="relative max-w-4xl mx-auto text-center" style={{ zIndex: 1 }}>
          <div className="ib-chip inline-block mb-8">● AI-Powered Discussion Coach</div>

          <h1
            className="font-display leading-none mb-6"
            style={{ color: "var(--ib-fg)", fontSize: "clamp(3.5rem, 10vw, 7rem)", letterSpacing: "0.04em" }}
          >
            Master Group<br />
            <span className="gradient-text">Discussions</span>
          </h1>

          <p
            className="max-w-xl mx-auto mb-10"
            style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300, fontSize: "1.05rem", lineHeight: 1.7 }}
          >
            Real-time AI scoring, voice coaching, WebRTC group sessions, and peer feedback —
            all in one mission-control platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <Link to="/register" className="btn-primary" style={{ padding: "1rem 2.25rem", fontSize: "0.8rem" }}>
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-ghost" style={{ padding: "1rem 2.25rem", fontSize: "0.75rem" }}>
              Sign in
            </Link>
          </div>

          <div className="max-w-2xl mx-auto" style={{ opacity: 0.65 }}>
            <WaveformCanvas />
          </div>

          {/* Stat strip */}
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-8 sm:gap-12"
            style={{ borderTop: "1px solid var(--ib-bdr)", paddingTop: "1.5rem" }}
          >
            {[
              { val: "13",       lbl: "Scoring metrics" },
              { val: "< 200ms",  lbl: "AI response" },
              { val: "WebRTC",   lbl: "P2P video" },
              { val: "Gemini",   lbl: "AI engine" },
            ].map((s) => (
              <div key={s.lbl} className="text-center">
                <div className="font-display text-xl gradient-text">{s.val}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)", marginTop: "2px" }}>
                  {s.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ticker ──────────────────────────────────────────────────────── */}
      <Ticker />

      {/* ── Metrics ─────────────────────────────────────────────────────── */}
      {/* bg = var(--ib-bg) so var(--ib-surf) cards contrast clearly */}
      <section
        id="metrics-section"
        className="px-6 sm:px-10 py-12"
        style={{ background: "var(--ib-bg)", borderBottom: "1px solid var(--ib-bdr)" }}
      >
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <MetricChip key={m.label} {...m} active={metricsVisible} />
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      {/* bg = var(--ib-bg), cards use var(--ib-card) — always 1 step lighter */}
      <section
        ref={featRef}
        className="px-6 sm:px-10 py-16"
        style={{ background: "var(--ib-bg)", borderBottom: "1px solid var(--ib-bdr)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="ib-label mb-3">Platform Capabilities</div>
            <h2 className="font-display text-4xl sm:text-5xl" style={{ color: "var(--ib-fg)" }}>
              Everything you need to<br /><span className="gradient-text">level up</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="p-6 transition-all"
                style={{
                  background: "var(--ib-card)",
                  border: "1px solid var(--ib-bdr)",
                  borderTop: "2px solid var(--ib-amber)",
                  /* CSS-only reveal — no GSAP dependency */
                  opacity: featVis ? 1 : 0,
                  transform: featVis ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
                }}
              >
                <div
                  className="h-10 w-10 flex items-center justify-center mb-4"
                  style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)" }}
                >
                  <f.icon className="h-5 w-5" style={{ color: "var(--ib-amber)" }} />
                </div>
                <h3 className="font-display text-lg mb-2" style={{ color: "var(--ib-fg)" }}>{f.title}</h3>
                <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300, lineHeight: 1.65 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Steps ───────────────────────────────────────────────────────── */}
      {/* bg = var(--ib-surf), cards use var(--ib-card2) — clearly darker */}
      <section
        ref={stepsRef}
        className="px-6 sm:px-10 py-16"
        style={{ background: "var(--ib-surf)", borderBottom: "1px solid var(--ib-bdr)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="ib-label mb-3">How it works</div>
            <h2 className="font-display text-4xl sm:text-5xl" style={{ color: "var(--ib-fg)" }}>
              Three steps to<br /><span className="gradient-text">fluency</span>
            </h2>
          </div>

          <div className="space-y-4">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className="flex items-start gap-6 p-6"
                style={{
                  background: "var(--ib-card2)",
                  border: "1px solid var(--ib-bdr)",
                  borderLeft: "3px solid var(--ib-amber)",
                  opacity: stepsVis ? 1 : 0,
                  transform: stepsVis ? "translateX(0)" : "translateX(-24px)",
                  transition: `opacity 0.5s ease ${i * 120}ms, transform 0.5s ease ${i * 120}ms`,
                }}
              >
                <div className="font-display text-5xl shrink-0 leading-none" style={{ color: "var(--ib-amber)" }}>{s.n}</div>
                <div className="pt-1">
                  <h3 className="font-display text-xl mb-1" style={{ color: "var(--ib-fg)" }}>{s.title}</h3>
                  <p className="text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden scanlines px-6 sm:px-10 py-20 text-center"
        style={{ background: "var(--ib-card)", borderTop: "1px solid var(--ib-bdr)" }}
      >
        <div className="ib-grid-bg" />
        <div className="relative max-w-xl mx-auto" style={{ zIndex: 1 }}>
          <Terminal className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--ib-amber)" }} />
          <h2 className="font-display text-4xl sm:text-5xl mb-4" style={{ color: "var(--ib-fg)" }}>
            Ready to start?
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
            Join thousands of students and professionals improving their group discussion skills with AI.
          </p>
          <Link to="/register" className="btn-primary" style={{ padding: "1rem 2.5rem", fontSize: "0.8rem" }}>
            Launch INTELLI BOT <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ background: "var(--ib-surf)", borderTop: "1px solid var(--ib-bdr)" }}>

        {/* Main footer body */}
        <div className="px-6 sm:px-10 py-14 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Brand column */}
            <div className="lg:col-span-1">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div
                  className="h-9 w-9 flex items-center justify-center shrink-0"
                  style={{ background: "var(--ib-amber)", clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)" }}
                >
                  <Mic className="h-4 w-4" style={{ color: "#0c0b09" }} />
                </div>
                <span className="font-display text-xl" style={{ color: "var(--ib-fg)", letterSpacing: "0.1em" }}>
                  INTELLI<span style={{ color: "var(--ib-amber)" }}>BOT</span>
                </span>
              </Link>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300, maxWidth: "240px" }}>
                AI-powered group discussion coaching. Real-time scoring, voice analysis, and peer feedback in one platform.
              </p>
              {/* Status dots */}
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "API Server",    ok: true  },
                  { label: "ML Engine",     ok: true  },
                  { label: "Socket Layer",  ok: true  },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: s.ok ? "var(--ib-ok)" : "var(--ib-terra)", flexShrink: 0 }}
                    />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                      {s.label}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.08em", textTransform: "uppercase", color: s.ok ? "var(--ib-ok)" : "var(--ib-terra)", marginLeft: "auto" }}>
                      {s.ok ? "Online" : "Offline"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Product links */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-amber)", marginBottom: "1rem" }}>
                Product
              </div>
              <ul className="space-y-2.5">
                {[
                  { label: "Dashboard",      to: "/dashboard"     },
                  { label: "AI Session",     to: "/ai-session"    },
                  { label: "Group Session",  to: "/group-session" },
                  { label: "Fluency Coach",  to: "/gd/new"        },
                  { label: "History",        to: "/history"       },
                  { label: "Leaderboard",    to: "/history"       },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to as never}
                      className="transition-colors"
                      style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.85rem", fontWeight: 300, color: "var(--ib-mut2)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ib-fg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ib-mut2)")}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Platform links */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-amber)", marginBottom: "1rem" }}>
                Platform
              </div>
              <ul className="space-y-2.5">
                {[
                  { label: "Sign in",         to: "/login"    },
                  { label: "Create account",  to: "/register" },
                  { label: "Profile",         to: "/profile"  },
                  { label: "Admin Panel",     to: "/admin/login" },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to as never}
                      className="transition-colors"
                      style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "0.85rem", fontWeight: 300, color: "var(--ib-mut2)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ib-fg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ib-mut2)")}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-amber)", marginBottom: "1rem", marginTop: "2rem" }}>
                Tech Stack
              </div>
              <ul className="space-y-2">
                {["React 19", "FastAPI", "Socket.io", "WebRTC", "Whisper", "Gemini AI"].map((t) => (
                  <li key={t}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", color: "var(--ib-muted)" }}>
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA / newsletter column */}
            <div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-amber)", marginBottom: "1rem" }}>
                Get Started
              </div>
              <p className="text-sm mb-5" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300, lineHeight: 1.6 }}>
                Start improving your group discussion skills today. Free to join, no credit card required.
              </p>
              <Link
                to="/register"
                className="btn-primary inline-flex w-full justify-center"
                style={{ padding: "0.75rem 1.25rem", fontSize: "0.65rem", marginBottom: "0.75rem" }}
              >
                Create free account <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/login"
                className="btn-ghost inline-flex w-full justify-center"
                style={{ padding: "0.625rem 1.25rem", fontSize: "0.65rem" }}
              >
                Sign in
              </Link>

              {/* Version badge */}
              <div
                className="mt-6 p-3 flex items-center gap-3"
                style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}
              >
                <div
                  className="h-7 w-7 flex items-center justify-center shrink-0"
                  style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-bdr)" }}
                >
                  <Terminal className="h-3.5 w-3.5" style={{ color: "var(--ib-amber)" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-fg)" }}>
                    v2.0 — Stable
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.08em", color: "var(--ib-muted)", marginTop: "1px" }}>
                    Industrial-Tech UI
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, var(--ib-bdr), transparent)" }} />

        {/* Bottom bar — copyright + system status */}
        <div
          className="px-6 sm:px-10 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ background: "var(--ib-bg)" }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
              © {new Date().getFullYear()} INTELLI BOT. All rights reserved.
            </span>
            <span style={{ color: "var(--ib-bdr)" }}>|</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
              Built with React 19 + FastAPI + WebRTC
            </span>
          </div>

          {/* Live system status strip */}
          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: ":5173", ok: true  },
              { label: ":4000", ok: true  },
              { label: ":8000", ok: true  },
              { label: "DB",    ok: true  },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: s.ok ? "var(--ib-ok)" : "var(--ib-terra)" }}
                />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

      </footer>
    </div>
  );
}
