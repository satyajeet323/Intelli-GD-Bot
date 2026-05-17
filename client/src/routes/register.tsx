import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { User, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, Field } from "./login";
import { auth } from "@/lib/api";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — INTELLI BOT" },
      { name: "description", content: "Create a new INTELLI BOT account." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const nameRef   = useRef<HTMLInputElement>(null);
  const emailRef  = useRef<HTMLInputElement>(null);
  const passRef   = useRef<HTMLInputElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const name     = nameRef.current?.value.trim()  ?? "";
    const email    = emailRef.current?.value.trim() ?? "";
    const password = passRef.current?.value         ?? "";

    if (!name || !email || !password) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const res = await auth.register(name, email, password);
      toast.success(`Account created! Welcome, ${res.user.name}.`);
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start your first AI-powered group discussion.">
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
        <Field ref={nameRef}  icon={User} type="text"     placeholder="Full name"                    autoComplete="name"         required />
        <Field ref={emailRef} icon={Mail} type="email"    placeholder="you@example.com"              autoComplete="email"        required />
        <Field ref={passRef}  icon={Lock} type="password" placeholder="Create password (min 6 chars)" autoComplete="new-password" required />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading
            ? <><span className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Creating account…</>
            : <>Create account <ArrowRight className="h-4 w-4" /></>
          }
        </button>
        <p className="text-xs text-center" style={{ color: "var(--ib-muted)", fontFamily: "'DM Sans',sans-serif" }}>
          By continuing you agree to our Terms &amp; Privacy Policy.
        </p>
      </form>
      <p className="mt-6 text-center text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--ib-amber)" }}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
