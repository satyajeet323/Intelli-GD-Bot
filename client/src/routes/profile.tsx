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
      { title: "Profile — GD Bot" },
      { name: "description", content: "Your GD Bot profile and preferences." },
    ],
  }),
  component: ProfilePage,
});

type Prefs = NonNullable<User["preferences"]>;

const DEFAULT_PREFS: Prefs = {
  micEnabled:        true,
  noiseSuppression:  true,
  echoCancellation:  true,
  practiceReminders: true,
  sessionSummary:    true,
  weeklyReport:      false,
  aiPersona:         "friendly",
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: {
  checked:  boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  icon: Icon, label, desc, tint, open, onToggle, children,
}: {
  icon:     React.ElementType;
  label:    string;
  desc:     string;
  tint:     string;
  open:     boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <div className={`h-9 w-9 rounded-lg ${tint} flex items-center justify-center shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-5 pt-1 border-t border-border/40 space-y-4 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user, loading } = useCurrentUser();
  const prefs = { ...DEFAULT_PREFS, ...user?.preferences };

  // Which panel is open
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const toggle = (id: string) => setOpenPanel((p) => (p === id ? null : id));

  const initials  = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  const planLabel = user?.plan === "pro" ? "Pro plan" : "Free plan";

  return (
    <div className="px-4 sm:px-8 py-8 max-w-4xl mx-auto animate-fade-in">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Your <span className="gradient-text">profile</span>
        </h1>
      </header>

      {/* Identity card */}
      <div className="rounded-3xl border border-border/50 bg-card p-8 mb-6">
        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading profile…</span>
          </div>
        ) : (
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-glow select-none">
              {initials}
            </div>
            <div>
              <div className="font-display text-2xl font-semibold">{user?.name ?? "—"}</div>
              <div className="text-sm text-muted-foreground">
                {user?.email ?? "—"} · {planLabel}
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Active practitioner
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings panels */}
      <div className="space-y-3">
        {/* ── Audio settings ── */}
        <Section
          icon={Mic2}
          label="Audio settings"
          desc="Microphone, noise suppression, echo cancellation"
          tint="bg-muted"
          open={openPanel === "audio"}
          onToggle={() => toggle("audio")}
        >
          <AudioPanel prefs={prefs} />
        </Section>

        {/* ── Notifications ── */}
        <Section
          icon={Bell}
          label="Notifications"
          desc="Practice reminders, session summaries, weekly reports"
          tint="bg-muted"
          open={openPanel === "notifications"}
          onToggle={() => toggle("notifications")}
        >
          <NotificationsPanel prefs={prefs} />
        </Section>

        {/* ── AI persona ── */}
        <Section
          icon={Sparkles}
          label="AI persona"
          desc="Choose how your AI discussion partner behaves"
          tint="bg-muted"
          open={openPanel === "persona"}
          onToggle={() => toggle("persona")}
        >
          <PersonaPanel prefs={prefs} />
        </Section>

        {/* ── Account ── */}
        <Section
          icon={Settings}
          label="Account"
          desc="Update your name and password"
          tint="bg-muted"
          open={openPanel === "account"}
          onToggle={() => toggle("account")}
        >
          <AccountPanel user={user} />
        </Section>
      </div>

      {/* Sign out */}
      <div className="mt-6 pt-6 border-t border-border/40">
        <button
          onClick={() => auth.logout()}
          className="inline-flex items-center gap-2 rounded-xl glass border border-destructive/30 px-5 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

// ── Audio panel ───────────────────────────────────────────────────────────────
function AudioPanel({ prefs }: { prefs: Prefs }) {
  const [local,   setLocal]   = useState({ ...prefs });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const update = (key: keyof Prefs, val: boolean) =>
    setLocal((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await auth.updatePreferences({
        micEnabled:       local.micEnabled,
        noiseSuppression: local.noiseSuppression,
        echoCancellation: local.echoCancellation,
      });
      setSaved(true);
      toast.success("Audio settings saved.");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ToggleRow
        label="Microphone enabled"
        desc="Allow the app to use your microphone during sessions"
        checked={local.micEnabled}
        onChange={(v) => update("micEnabled", v)}
      />
      <ToggleRow
        label="Noise suppression"
        desc="Filter background noise from your audio stream"
        checked={local.noiseSuppression}
        onChange={(v) => update("noiseSuppression", v)}
      />
      <ToggleRow
        label="Echo cancellation"
        desc="Prevent audio feedback when using speakers"
        checked={local.echoCancellation}
        onChange={(v) => update("echoCancellation", v)}
      />
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </>
  );
}

// ── Notifications panel ───────────────────────────────────────────────────────
function NotificationsPanel({ prefs }: { prefs: Prefs }) {
  const [local,  setLocal]  = useState({ ...prefs });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const update = (key: keyof Prefs, val: boolean) =>
    setLocal((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      await auth.updatePreferences({
        practiceReminders: local.practiceReminders,
        sessionSummary:    local.sessionSummary,
        weeklyReport:      local.weeklyReport,
      });
      setSaved(true);
      toast.success("Notification preferences saved.");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ToggleRow
        label="Practice reminders"
        desc="Daily nudges to keep your discussion streak going"
        checked={local.practiceReminders}
        onChange={(v) => update("practiceReminders", v)}
      />
      <ToggleRow
        label="Session summary"
        desc="Receive a summary email after each completed session"
        checked={local.sessionSummary}
        onChange={(v) => update("sessionSummary", v)}
      />
      <ToggleRow
        label="Weekly report"
        desc="Get a weekly digest of your performance trends"
        checked={local.weeklyReport}
        onChange={(v) => update("weeklyReport", v)}
      />
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </>
  );
}

// ── AI persona panel ──────────────────────────────────────────────────────────
const PERSONAS: { value: Prefs["aiPersona"]; label: string; desc: string; emoji: string }[] = [
  { value: "friendly",        label: "Friendly",         desc: "Supportive and encouraging — great for beginners", emoji: "😊" },
  { value: "critical",        label: "Critical",         desc: "Challenges your arguments and pushes for depth",    emoji: "🎯" },
  { value: "devils-advocate", label: "Devil's advocate", desc: "Always takes the opposing view to sharpen your thinking", emoji: "😈" },
  { value: "neutral",         label: "Neutral",          desc: "Balanced facilitator — no bias, just good questions", emoji: "⚖️" },
];

function PersonaPanel({ prefs }: { prefs: Prefs }) {
  const [selected, setSelected] = useState<Prefs["aiPersona"]>(prefs.aiPersona);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await auth.updatePreferences({ aiPersona: selected });
      setSaved(true);
      toast.success("AI persona updated.");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-2">
        {PERSONAS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setSelected(p.value)}
            className={`text-left rounded-xl p-3 border transition-all ${
              selected === p.value
                ? "border-foreground/40 bg-muted"
                : "border-border/50 bg-background hover:border-foreground/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{p.emoji}</span>
              <span className="font-medium text-sm">{p.label}</span>
              {selected === p.value && (
                <Check className="h-3.5 w-3.5 text-primary ml-auto" />
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{p.desc}</p>
          </button>
        ))}
      </div>
      <SaveButton saving={saving} saved={saved} onClick={save} />
    </>
  );
}

// ── Account panel ─────────────────────────────────────────────────────────────
function AccountPanel({ user }: { user: User | null }) {
  const nameRef        = useRef<HTMLInputElement>(null);
  const currPassRef    = useRef<HTMLInputElement>(null);
  const newPassRef     = useRef<HTMLInputElement>(null);
  const confirmPassRef = useRef<HTMLInputElement>(null);

  const [showCurr,    setShowCurr]    = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState("");

  const save = async () => {
    setError("");
    const name        = nameRef.current?.value.trim()  ?? "";
    const currPass    = currPassRef.current?.value      ?? "";
    const newPass     = newPassRef.current?.value       ?? "";
    const confirmPass = confirmPassRef.current?.value   ?? "";

    if (!name) { setError("Name cannot be empty."); return; }

    if (newPass) {
      if (newPass.length < 6) { setError("New password must be at least 6 characters."); return; }
      if (newPass !== confirmPass) { setError("Passwords do not match."); return; }
      if (!currPass) { setError("Enter your current password to change it."); return; }
    }

    setSaving(true);
    try {
      const payload: { name?: string; currentPassword?: string; newPassword?: string } = {};
      if (name !== user?.name) payload.name = name;
      if (newPass) { payload.currentPassword = currPass; payload.newPassword = newPass; }

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save.");
        setSaving(false);
        return;
      }

      await auth.updateProfile(payload);
      setSaved(true);
      toast.success("Account updated successfully.");
      setTimeout(() => setSaved(false), 3000);

      // Clear password fields
      if (currPassRef.current)    currPassRef.current.value    = "";
      if (newPassRef.current)     newPassRef.current.value     = "";
      if (confirmPassRef.current) confirmPassRef.current.value = "";
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to update account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Name */}
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5 block">
          Display name
        </label>
        <input
          ref={nameRef}
          type="text"
          defaultValue={user?.name ?? ""}
          maxLength={100}
          className="w-full rounded-xl bg-background/40 border border-border/60 px-4 py-2.5 text-sm focus:outline-none focus:border-primary/60 transition"
          placeholder="Your name"
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5 block">
          Email address
        </label>
        <input
          type="email"
          value={user?.email ?? ""}
          readOnly
          className="w-full rounded-xl bg-background/20 border border-border/40 px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Email cannot be changed.</p>
      </div>

      {/* Change password */}
      <div className="pt-2 border-t border-border/30">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Change password</p>
        <div className="space-y-3">
          <PasswordField ref={currPassRef}    label="Current password"        show={showCurr}    onToggle={() => setShowCurr(v => !v)} />
          <PasswordField ref={newPassRef}     label="New password (min 6 chars)" show={showNew}     onToggle={() => setShowNew(v => !v)} />
          <PasswordField ref={confirmPassRef} label="Confirm new password"       show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <SaveButton saving={saving} saved={saved} onClick={save} label="Save account" />
    </>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ToggleRow({ label, desc, checked, onChange }: {
  label:    string;
  desc:     string;
  checked:  boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

import { forwardRef } from "react";

const PasswordField = forwardRef<HTMLInputElement, {
  label:    string;
  show:     boolean;
  onToggle: () => void;
}>(({ label, show, onToggle }, ref) => (
  <div>
    <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
    <div className="relative">
      <input
        ref={ref}
        type={show ? "text" : "password"}
        className="w-full rounded-xl bg-background/40 border border-border/60 px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-primary/60 transition"
        placeholder="••••••••"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </div>
));
PasswordField.displayName = "PasswordField";

function SaveButton({ saving, saved, onClick, label = "Save changes" }: {
  saving:  boolean;
  saved:   boolean;
  onClick: () => void;
  label?:  string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-80 disabled:opacity-50 transition"
    >
      {saving
        ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
        : saved
        ? <><Check className="h-4 w-4" /> Saved!</>
        : <><Save className="h-4 w-4" /> {label}</>
      }
    </button>
  );
}
