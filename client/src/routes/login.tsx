import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, forwardRef } from "react";
import { Mic, Mail, Lock, ArrowRight, AlertCircle, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — GD Bot" },
      { name: "description", content: "Sign in to your GD Bot account." },
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
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Field ref={emailRef} icon={Mail} type="email"    placeholder="you@example.com" autoComplete="email"            required />
        <Field ref={passRef}  icon={Lock} type="password" placeholder="Password"        autoComplete="current-password" required />
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 font-semibold hover:opacity-80 disabled:opacity-50 transition"
        >
          {loading
            ? <><span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> Signing in…</>
            : <>Sign in <ArrowRight className="h-4 w-4" /></>
          }
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="text-foreground font-medium underline hover:opacity-70 transition">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

// ── Shared auth shell ─────────────────────────────────────────────────────────

export function AuthShell({ title, subtitle, children }: {
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { theme, toggle } = useTheme();

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 bg-background">
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="fixed top-4 right-4 h-9 w-9 rounded-lg flex items-center justify-center border border-border/60 bg-background hover:bg-muted transition-colors z-50"
      >
        {theme === "dark"
          ? <Sun  className="h-4 w-4 text-muted-foreground" />
          : <Moon className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      <div className="w-full max-w-md animate-scale-in">
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Mic className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">GD Bot</span>
        </Link>

        <div className="rounded-3xl border border-border/50 bg-card p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── Shared field component ────────────────────────────────────────────────────

export const Field = forwardRef<
  HTMLInputElement,
  { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>
>(({ icon: Icon, ...props }, ref) => (
  <div className="relative group">
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
    <input
      ref={ref}
      {...props}
      className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-border/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-all"
    />
  </div>
));
Field.displayName = "Field";
