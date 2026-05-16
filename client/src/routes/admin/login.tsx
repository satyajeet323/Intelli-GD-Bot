import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { adminAuth, AdminApiError } from "@/lib/adminApi";
import { useTheme } from "@/hooks/useTheme";
import { Shield, Sun, Moon, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminAuth.login(email, password);
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <button
        onClick={toggle}
        className="fixed top-4 right-4 h-9 w-9 rounded-lg border border-border/60 bg-background/60 flex items-center justify-center hover:bg-muted transition-colors"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Shield className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold">Admin Portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Restricted access — authorized personnel only</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-border/60 bg-input px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-80 transition disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in to Admin"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <a href="/dashboard" className="hover:text-foreground transition-colors">← Back to main app</a>
        </p>
      </div>
    </div>
  );
}
