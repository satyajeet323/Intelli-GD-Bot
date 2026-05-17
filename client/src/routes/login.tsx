import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, forwardRef } from "react";
import { Mic, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — INTELLI BOT" },
      { name: "description", content: "Sign in to your INTELLI BOT account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const emailRef  = useRef<HTMLInputElement>(null);
  const passRef   = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const email    = emailRef.current?.value.trim() ?? "";
    const password = passRef.current?.value ?? "";
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const res = await auth.login(email, password);
      toast.success(`Welcome back, ${res.user.name}!`);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your GD practice.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2.5 text-sm"
            style={{ background: "rgba(220,138,107,0.1)", border: "1px solid rgba(220,138,107,0.3)", color: "var(--ib-terra)" }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Field ref={emailRef} icon={Mail} type="email"    placeholder="you@example.com" autoComplete="email"            required />
        <Field ref={passRef}  icon={Lock} type="password" placeholder="Password"        autoComplete="current-password" required />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Signing in…</>
            : <>Sign in <ArrowRight className="h-4 w-4" /></>
          }
        </button>
      </form>
      <p className="mt-6 text-center text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
        New here?{" "}
        <Link to="/register" className="transition-colors" style={{ color: "var(--ib-amber)" }}>
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

/* ── Shared auth shell ─────────────────────────────────────────────────────── */
export function AuthShell({ title, subtitle, children }: {
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--ib-bg)" }}
    >
      {/* Grid background */}
      <div className="ib-grid-bg" />

      {/* Vertical decorative text */}
      <div
        className="fixed left-6 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-3"
        style={{ writingMode: "vertical-rl", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ib-muted)" }}
      >
        AUTH_MODULE
        <span className="ib-accent-line h-16" />
        JWT_7D
      </div>

      <div className="w-full max-w-[420px] animate-scale-in relative z-10">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
          <div
            className="h-10 w-10 flex items-center justify-center"
            style={{ background: "var(--ib-amber)", clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)" }}
          >
            <Mic className="h-5 w-5" style={{ color: "#0c0b09" }} />
          </div>
          <span className="font-display text-xl" style={{ color: "var(--ib-fg)", letterSpacing: "0.1em" }}>
            INTELLI<span style={{ color: "var(--ib-amber)" }}>BOT</span>
          </span>
        </Link>

        {/* Card */}
        <div
          className="p-8 relative"
          style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}
        >
          {/* Amber corner brackets */}
          <span style={{ position: "absolute", top: -1, left: -1, width: 14, height: 14, borderTop: "2px solid var(--ib-amber)", borderLeft: "2px solid var(--ib-amber)" }} />
          <span style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderBottom: "2px solid var(--ib-amber)", borderRight: "2px solid var(--ib-amber)" }} />

          <h1 className="font-display text-2xl" style={{ color: "var(--ib-fg)" }}>{title}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Shared field component ──────────────────────────────────────────────── */
export const Field = forwardRef<
  HTMLInputElement,
  { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>
>(({ icon: Icon, ...props }, ref) => (
  <div className="relative group">
    <Icon
      className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors"
      style={{ color: "var(--ib-muted)" }}
    />
    <input
      ref={ref}
      {...props}
      className="ib-input pl-10"
    />
  </div>
));
Field.displayName = "Field";
