import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  Settings, Bell, Mic2, Sparkles, Loader2, LogOut,
  ChevronDown, ChevronUp, Check, Eye, EyeOff, Save, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { auth, type User } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — INTELLI BOT" },
      { name: "description", content: "Your INTELLI BOT profile and preferences." },
    ],
  }),
  component: ProfilePage,
});

type Prefs = NonNullable<User["preferences"]>;

const DEFAULT_PREFS: Prefs = {
  micEnabled: true, noiseSuppression: true, echoCancellation: true,
  practiceReminders: true, sessionSummary: true, weeklyReport: false,
  aiPersona: "friendly",
};

/* ── Toggle — uses CSS vars so it works in both themes ───────────────────── */
function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: checked ? "var(--ib-amber)" : "var(--ib-bdr)",
        clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)",
      }}
    >
      {/* Thumb — uses foreground so it's visible on both dark and light amber */}
      <span
        className="pointer-events-none inline-block h-5 w-5 transform transition-transform"
        style={{
          background: checked ? "var(--ib-bg)" : "var(--ib-fg)",
          margin: "2px",
          transform: checked ? "translateX(20px)" : "translateX(0)",
          opacity: checked ? 1 : 0.5,
        }}
      />
    </button>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */
function Section({ icon: Icon, label, desc, accentColor, open, onToggle, children }: {
  icon: React.ElementType; label: string; desc: string; accentColor: string;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-center gap-3 p-4 transition-colors hover:bg-[var(--ib-card2)]"
        style={{ borderBottom: open ? "1px solid var(--ib-bdr)" : "none" }}
        aria-expanded={open}
      >
        <div
          className="h-9 w-9 flex items-center justify-center shrink-0"
          style={{
            background: "var(--ib-card2)",
            border: `1px solid var(--ib-bdr)`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-base" style={{ color: "var(--ib-fg)" }}>{label}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>{desc}</div>
        </div>
        {open
          ? <ChevronUp  className="h-4 w-4 shrink-0" style={{ color: "var(--ib-muted)" }} />
          : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--ib-muted)" }} />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 pt-4 space-y-4 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Pref row ─────────────────────────────────────────────────────────────── */
function PrefRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-1">
      <div className="flex-1 min-w-0">
        <div className="text-sm" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 400 }}>{label}</div>
        {desc && (
          <div className="text-xs mt-0.5" style={{ color: "var(--ib-muted)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>{desc}</div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
function ProfilePage() {
  const { user } = useCurrentUser();
  const [prefs,    setPrefs]    = useState<Prefs>(DEFAULT_PREFS);
  const [saving,   setSaving]   = useState(false);
  const [sections, setSections] = useState({ audio: true, notif: false, persona: false, account: false });
  const [showPass, setShowPass] = useState(false);
  const [pwError,  setPwError]  = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const nameRef    = useRef<HTMLInputElement>(null);
  const curPassRef = useRef<HTMLInputElement>(null);
  const newPassRef = useRef<HTMLInputElement>(null);

  const toggleSection = (k: keyof typeof sections) =>
    setSections((s) => ({ ...s, [k]: !s[k] }));

  const savePref = (key: keyof Prefs, val: boolean | string) =>
    setPrefs((p) => ({ ...p, [key]: val }));

  const savePrefs = async () => {
    setSaving(true);
    try {
      await auth.updatePreferences(prefs);
      toast.success("Preferences saved.");
    } catch {
      toast.error("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    const cur = curPassRef.current?.value ?? "";
    const nw  = newPassRef.current?.value ?? "";
    if (!cur || !nw) { setPwError("Please fill in both fields."); return; }
    if (nw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    setPwSaving(true);
    try {
      await auth.updateProfile({ currentPassword: cur, newPassword: nw });
      toast.success("Password updated.");
      if (curPassRef.current) curPassRef.current.value = "";
      if (newPassRef.current) newPassRef.current.value = "";
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPwSaving(false);
    }
  };

  const personas = [
    { id: "friendly",     label: "Friendly",     emoji: "😊", desc: "Warm and encouraging" },
    { id: "strict",       label: "Strict",       emoji: "🎯", desc: "Direct and demanding" },
    { id: "professional", label: "Professional", emoji: "💼", desc: "Formal and precise" },
    { id: "socratic",     label: "Socratic",     emoji: "🤔", desc: "Questions and challenges" },
  ];

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

  return (
    <div
      className="min-h-full py-8 animate-fade-in"
      style={{ background: "var(--ib-bg)" }}
    >
      <div className="px-4 sm:px-8 max-w-3xl mx-auto">

        {/* Page header */}
        <header className="mb-8">
          <div style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: "0.55rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ib-amber)",
            marginBottom: "0.5rem",
          }}>
            Settings
          </div>
          <h1 className="font-display text-5xl" style={{ color: "var(--ib-fg)" }}>
            Your <span className="gradient-text">Profile</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ib-mut2)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>
            Manage your account and preferences.
          </p>
        </header>

        {/* User identity card */}
        <div
          className="p-5 mb-6 flex items-center gap-4"
          style={{
            background: "var(--ib-card)",
            border: "1px solid var(--ib-bdr)",
            borderLeft: "3px solid var(--ib-amber)",
          }}
        >
          <div
            className="h-14 w-14 flex items-center justify-center text-xl font-bold shrink-0"
            style={{
              background: "var(--ib-card2)",
              border: "1px solid var(--ib-amber)",
              color: "var(--ib-amber)",
              fontFamily: "'JetBrains Mono',monospace",
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-2xl" style={{ color: "var(--ib-fg)" }}>
              {user?.name ?? "Loading…"}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.1em",
              color: "var(--ib-muted)",
              marginTop: "2px",
            }}>
              {user?.email ?? ""}
            </div>
          </div>
          <span className="ib-chip shrink-0">{user?.plan === "pro" ? "PRO" : "FREE"}</span>
        </div>

        {/* Sections */}
        <div className="space-y-3">

          {/* Audio */}
          <Section
            icon={Mic2} label="Audio Settings" desc="Microphone and noise controls"
            accentColor="var(--ib-amber)" open={sections.audio} onToggle={() => toggleSection("audio")}
          >
            <PrefRow label="Enable microphone"  desc="Allow mic access for sessions" checked={prefs.micEnabled}       onChange={(v) => savePref("micEnabled", v)} />
            <PrefRow label="Noise suppression"  desc="Filter background noise"       checked={prefs.noiseSuppression} onChange={(v) => savePref("noiseSuppression", v)} />
            <PrefRow label="Echo cancellation"  desc="Reduce audio echo"             checked={prefs.echoCancellation} onChange={(v) => savePref("echoCancellation", v)} />
            <div className="pt-2">
              <button onClick={savePrefs} disabled={saving} className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> Save</>}
              </button>
            </div>
          </Section>

          {/* Notifications */}
          <Section
            icon={Bell} label="Notifications" desc="Email and reminder preferences"
            accentColor="var(--ib-purple)" open={sections.notif} onToggle={() => toggleSection("notif")}
          >
            <PrefRow label="Practice reminders" desc="Daily nudges to keep your streak" checked={prefs.practiceReminders} onChange={(v) => savePref("practiceReminders", v)} />
            <PrefRow label="Session summary"    desc="Email after each session"         checked={prefs.sessionSummary}    onChange={(v) => savePref("sessionSummary", v)} />
            <PrefRow label="Weekly report"      desc="Weekly progress digest"           checked={prefs.weeklyReport}      onChange={(v) => savePref("weeklyReport", v)} />
            <div className="pt-2">
              <button onClick={savePrefs} disabled={saving} className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> Save</>}
              </button>
            </div>
          </Section>

          {/* AI Persona */}
          <Section
            icon={Sparkles} label="AI Persona" desc="Choose your AI coach's style"
            accentColor="var(--ib-gold)" open={sections.persona} onToggle={() => toggleSection("persona")}
          >
            <div className="grid grid-cols-2 gap-3">
              {personas.map((p) => {
                const active = prefs.aiPersona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => savePref("aiPersona", p.id)}
                    className="p-4 text-left transition-all"
                    style={{
                      background: active ? "var(--ib-card2)" : "var(--ib-bg)",
                      border: `1px solid ${active ? "var(--ib-amber)" : "var(--ib-bdr)"}`,
                    }}
                  >
                    <div className="text-2xl mb-2">{p.emoji}</div>
                    <div className="font-display text-sm" style={{ color: "var(--ib-fg)" }}>{p.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--ib-muted)", fontFamily: "'DM Sans',sans-serif", fontWeight: 300 }}>{p.desc}</div>
                    {active && (
                      <div className="mt-2 flex items-center gap-1" style={{ color: "var(--ib-amber)" }}>
                        <Check className="h-3 w-3" />
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Selected</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="pt-2">
              <button onClick={savePrefs} disabled={saving} className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> Save</>}
              </button>
            </div>
          </Section>

          {/* Account */}
          <Section
            icon={Settings} label="Account" desc="Name and password settings"
            accentColor="var(--ib-mut2)" open={sections.account} onToggle={() => toggleSection("account")}
          >
            <div className="space-y-5">

              {/* Display name */}
              <div>
                <label style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: "0.55rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--ib-muted)",
                  display: "block",
                  marginBottom: "0.5rem",
                }}>
                  Display name
                </label>
                <input ref={nameRef} type="text" defaultValue={user?.name ?? ""} className="ib-input" />
              </div>

              <div className="divider" />

              {/* Change password */}
              <form onSubmit={savePassword} className="space-y-3">
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: "0.55rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--ib-muted)",
                }}>
                  Change password
                </div>

                {pwError && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 text-xs"
                    style={{ background: "var(--ib-card2)", border: "1px solid var(--ib-terra)", color: "var(--ib-terra)" }}
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {pwError}
                  </div>
                )}

                <div className="relative">
                  <input
                    ref={curPassRef}
                    type={showPass ? "text" : "password"}
                    placeholder="Current password"
                    className="ib-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--ib-muted)" }}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <input ref={newPassRef} type="password" placeholder="New password (min 6 chars)" className="ib-input" />

                <button type="submit" disabled={pwSaving} className="btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}>
                  {pwSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…</> : "Update password"}
                </button>
              </form>

              <div className="divider" />

              <button
                onClick={() => auth.logout()}
                className="btn-terra inline-flex items-center gap-2"
                style={{ padding: "0.5rem 1.25rem", fontSize: "0.65rem" }}
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
