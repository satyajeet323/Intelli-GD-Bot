import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  adminApiKeys,
  type ApiKeyEntry,
  type ApiKeyProviderSummary,
  type ApiKeyStatus,
} from "@/lib/adminApi";
import { toast } from "sonner";
import {
  KeyRound, Plus, RefreshCw, Trash2, Eye, EyeOff,
  RotateCcw, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Activity, Clock, BarChart2,
  Shield, Zap, Copy, Edit2, X,
} from "lucide-react";

export const Route = createFileRoute("/admin/api-keys")({
  component: AdminApiKeys,
});

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ApiKeyStatus, { label: string; color: string; bg: string; border: string }> = {
  active:       { label: "Active",       color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)" },
  in_use:       { label: "In Use",       color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)" },
  standby:      { label: "Standby",      color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)" },
  rate_limited: { label: "Rate Limited", color: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.3)" },
  exhausted:    { label: "Exhausted",    color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" },
  expired:      { label: "Expired",      color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)" },
  deactivated:  { label: "Deactivated",  color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.3)" },
};

function StatusBadge({ status }: { status: ApiKeyStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.deactivated;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function SuccessBar({ rate }: { rate: number }) {
  const color = rate >= 90 ? "#4ade80" : rate >= 70 ? "#fb923c" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--ib-bdr)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color, minWidth: "2.5rem" }}>{rate}%</span>
    </div>
  );
}

// ── Add / Edit Key Modal ──────────────────────────────────────────────────────
type KeyFormData = {
  provider: string; label: string; keyValue: string;
  description: string; priority: number;
  dailyLimit: number; monthlyLimit: number;
  maxConsecutiveFailures: number; expiresAt: string; tags: string;
};

const EMPTY_FORM: KeyFormData = {
  provider: "", label: "", keyValue: "", description: "",
  priority: 0, dailyLimit: 0, monthlyLimit: 0,
  maxConsecutiveFailures: 5, expiresAt: "", tags: "",
};

function KeyFormModal({
  open, onClose, onSave, editKey, defaultProvider,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: KeyFormData) => Promise<void>;
  editKey?: ApiKeyEntry | null;
  defaultProvider?: string;
}) {
  const [form, setForm] = useState<KeyFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editKey
        ? {
            provider: editKey.provider,
            label: editKey.label,
            keyValue: "",
            description: editKey.description,
            priority: editKey.priority,
            dailyLimit: editKey.dailyLimit,
            monthlyLimit: editKey.monthlyLimit,
            maxConsecutiveFailures: editKey.maxConsecutiveFailures,
            expiresAt: editKey.expiresAt ? editKey.expiresAt.slice(0, 10) : "",
            tags: editKey.tags.join(", "),
          }
        : { ...EMPTY_FORM, provider: defaultProvider ?? "" }
      );
      setShowKey(false);
    }
  }, [open, editKey, defaultProvider]);

  if (!open) return null;

  const set = (k: keyof KeyFormData, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "var(--ib-surf)", border: "1px solid var(--ib-bdr)" }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" style={{ color: "var(--ib-purple)" }} />
            <span className="font-mono text-sm" style={{ color: "var(--ib-fg)" }}>
              {editKey ? "Edit API Key" : "Add API Key"}
            </span>
          </div>
          <button onClick={onClose} style={{ color: "var(--ib-muted)" }}><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ib-label">Provider *</label>
              <input className="ib-input w-full" placeholder="gemini / groq / elevenlabs"
                value={form.provider} onChange={(e) => set("provider", e.target.value.toLowerCase())}
                required disabled={!!editKey} />
            </div>
            <div>
              <label className="ib-label">Label *</label>
              <input className="ib-input w-full" placeholder="Production Key 1"
                value={form.label} onChange={(e) => set("label", e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="ib-label">{editKey ? "New Key Value (leave blank to keep current)" : "API Key Value *"}</label>
            <div className="relative">
              <input
                className="ib-input w-full pr-10"
                type={showKey ? "text" : "password"}
                placeholder={editKey ? "Enter new key to replace..." : "sk-..."}
                value={form.keyValue}
                onChange={(e) => set("keyValue", e.target.value)}
                required={!editKey}
              />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--ib-muted)" }} onClick={() => setShowKey((v) => !v)}>
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="ib-label">Description</label>
            <textarea className="ib-input w-full resize-none" rows={2}
              value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="ib-label">Priority (0–100)</label>
              <input className="ib-input w-full" type="number" min={0} max={100}
                value={form.priority} onChange={(e) => set("priority", +e.target.value)} />
            </div>
            <div>
              <label className="ib-label">Daily Limit (0=∞)</label>
              <input className="ib-input w-full" type="number" min={0}
                value={form.dailyLimit} onChange={(e) => set("dailyLimit", +e.target.value)} />
            </div>
            <div>
              <label className="ib-label">Monthly Limit (0=∞)</label>
              <input className="ib-input w-full" type="number" min={0}
                value={form.monthlyLimit} onChange={(e) => set("monthlyLimit", +e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ib-label">Max Failures Before Exhaust</label>
              <input className="ib-input w-full" type="number" min={1} max={50}
                value={form.maxConsecutiveFailures} onChange={(e) => set("maxConsecutiveFailures", +e.target.value)} />
            </div>
            <div>
              <label className="ib-label">Expires At</label>
              <input className="ib-input w-full" type="date"
                value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="ib-label">Tags (comma-separated)</label>
            <input className="ib-input w-full" placeholder="production, primary"
              value={form.tags} onChange={(e) => set("tags", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : editKey ? "Update" : "Add Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rotate Key Modal ──────────────────────────────────────────────────────────
function RotateModal({
  open, keyEntry, onClose, onRotate,
}: {
  open: boolean;
  keyEntry: ApiKeyEntry | null;
  onClose: () => void;
  onRotate: (id: string, newValue: string) => Promise<void>;
}) {
  const [newValue, setNewValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setNewValue(""); setShow(false); } }, [open]);
  if (!open || !keyEntry) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newValue.trim()) return;
    setSaving(true);
    try { await onRotate(keyEntry!._id, newValue.trim()); onClose(); }
    catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md" style={{ background: "var(--ib-surf)", border: "1px solid var(--ib-bdr)" }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" style={{ color: "var(--ib-amber)" }} />
            <span className="font-mono text-sm" style={{ color: "var(--ib-fg)" }}>Rotate Key</span>
          </div>
          <button onClick={onClose} style={{ color: "var(--ib-muted)" }}><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <p className="text-sm" style={{ color: "var(--ib-muted)" }}>
            Rotating <span style={{ color: "var(--ib-fg)" }}>{keyEntry.label}</span>. The old key will be replaced immediately.
          </p>
          <div>
            <label className="ib-label">New Key Value *</label>
            <div className="relative">
              <input className="ib-input w-full pr-10" type={show ? "text" : "password"}
                placeholder="Enter new key value…" value={newValue}
                onChange={(e) => setNewValue(e.target.value)} required />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--ib-muted)" }} onClick={() => setShow((v) => !v)}>
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !newValue.trim()}>
              {saving ? "Rotating…" : "Rotate Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Key Detail Row ────────────────────────────────────────────────────────────
function KeyRow({
  k, onEdit, onRotate, onActivate, onDeactivate, onResetUsage, onDelete, onReveal,
}: {
  k: ApiKeyEntry;
  onEdit: (k: ApiKeyEntry) => void;
  onRotate: (k: ApiKeyEntry) => void;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onResetUsage: (id: string) => void;
  onDelete: (id: string, label: string) => void;
  onReveal: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const usagePct = k.dailyLimit > 0 ? Math.min(100, Math.round((k.dailyUsage / k.dailyLimit) * 100)) : null;
  const isHealthy = k.status === "active" || k.status === "in_use" || k.status === "standby";

  return (
    <div style={{ border: "1px solid var(--ib-bdr)", background: "var(--ib-card)" }}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm" style={{ color: "var(--ib-fg)" }}>{k.label}</span>
            <StatusBadge status={k.status} />
            {k.priority > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5" style={{ color: "var(--ib-amber)", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                P{k.priority}
              </span>
            )}
            {k.tags.map((t) => (
              <span key={t} className="text-xs px-1.5 py-0.5 font-mono" style={{ color: "var(--ib-muted)", background: "var(--ib-bdr)" }}>{t}</span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-mono text-xs" style={{ color: "var(--ib-muted)" }}>{k.maskedKey}</span>
            {k.lastUsedAt && (
              <span className="text-xs" style={{ color: "var(--ib-muted)" }}>
                Last used: {new Date(k.lastUsedAt).toLocaleString()}
              </span>
            )}
            {k.expiresAt && (
              <span className="text-xs" style={{ color: new Date(k.expiresAt) < new Date() ? "#f87171" : "var(--ib-muted)" }}>
                Expires: {new Date(k.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="text-center">
            <div className="text-xs font-mono" style={{ color: "var(--ib-muted)" }}>Requests</div>
            <div className="text-sm font-mono" style={{ color: "var(--ib-fg)" }}>{k.totalRequests.toLocaleString()}</div>
          </div>
          <div className="w-24">
            <div className="text-xs font-mono mb-1" style={{ color: "var(--ib-muted)" }}>Success</div>
            <SuccessBar rate={k.successRate} />
          </div>
          {usagePct !== null && (
            <div className="w-20">
              <div className="text-xs font-mono mb-1" style={{ color: "var(--ib-muted)" }}>Daily</div>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--ib-bdr)" }}>
                <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: usagePct > 90 ? "#f87171" : "#4ade80" }} />
              </div>
              <div className="text-xs font-mono mt-0.5" style={{ color: "var(--ib-muted)" }}>{k.dailyUsage}/{k.dailyLimit}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button title="Reveal key" onClick={() => onReveal(k._id)} className="h-7 w-7 flex items-center justify-center transition-colors" style={{ color: "var(--ib-muted)", border: "1px solid var(--ib-bdr)" }}>
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button title="Edit" onClick={() => onEdit(k)} className="h-7 w-7 flex items-center justify-center transition-colors" style={{ color: "var(--ib-muted)", border: "1px solid var(--ib-bdr)" }}>
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button title="Rotate key" onClick={() => onRotate(k)} className="h-7 w-7 flex items-center justify-center transition-colors" style={{ color: "var(--ib-amber)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          {isHealthy ? (
            <button title="Deactivate" onClick={() => onDeactivate(k._id)} className="h-7 w-7 flex items-center justify-center" style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
              <XCircle className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button title="Activate" onClick={() => onActivate(k._id)} className="h-7 w-7 flex items-center justify-center" style={{ color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}>
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
          )}
          <button title="Reset usage" onClick={() => onResetUsage(k._id)} className="h-7 w-7 flex items-center justify-center" style={{ color: "var(--ib-muted)", border: "1px solid var(--ib-bdr)" }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button title="Delete" onClick={() => onDelete(k._id, k.label)} className="h-7 w-7 flex items-center justify-center" style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="h-7 w-7 flex items-center justify-center" style={{ color: "var(--ib-muted)", border: "1px solid var(--ib-bdr)" }}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="p-3 space-y-3" style={{ borderTop: "1px solid var(--ib-bdr)" }}>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Requests", value: k.totalRequests.toLocaleString(), icon: Activity },
              { label: "Success", value: k.totalSuccess.toLocaleString(), icon: CheckCircle },
              { label: "Failures", value: k.totalFailures.toLocaleString(), icon: XCircle },
              { label: "Consec. Failures", value: `${k.consecutiveFailures}/${k.maxConsecutiveFailures}`, icon: AlertTriangle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="p-2" style={{ background: "var(--ib-bg)", border: "1px solid var(--ib-bdr)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3 w-3" style={{ color: "var(--ib-muted)" }} />
                  <span className="text-xs font-mono" style={{ color: "var(--ib-muted)" }}>{label}</span>
                </div>
                <div className="text-sm font-mono" style={{ color: "var(--ib-fg)" }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Last error */}
          {k.lastError && (
            <div className="p-2 text-xs font-mono" style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
              Last error ({k.lastErrorAt ? new Date(k.lastErrorAt).toLocaleString() : "—"}): {k.lastError}
            </div>
          )}

          {/* Recent logs */}
          {k.recentLogs.length > 0 && (
            <div>
              <div className="text-xs font-mono mb-2" style={{ color: "var(--ib-muted)" }}>Recent Activity (last {k.recentLogs.length})</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {[...k.recentLogs].reverse().slice(0, 20).map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono px-2 py-1" style={{ background: "var(--ib-bg)", border: "1px solid var(--ib-bdr)" }}>
                    <span style={{ color: log.success ? "#4ade80" : "#f87171" }}>{log.success ? "✓" : "✗"}</span>
                    <span style={{ color: "var(--ib-muted)" }}>{new Date(log.ts).toLocaleTimeString()}</span>
                    {log.endpoint && <span style={{ color: "var(--ib-purple)" }}>{log.endpoint}</span>}
                    <span style={{ color: "var(--ib-muted)" }}>{log.latency}ms</span>
                    {log.error && <span style={{ color: "#f87171" }} className="truncate">{log.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-xs font-mono" style={{ color: "var(--ib-muted)" }}>
            {k.createdBy && <span>Created by: {(k.createdBy as { name: string }).name}</span>}
            {k.rotatedAt && <span>Last rotated: {new Date(k.rotatedAt).toLocaleString()}</span>}
            <span>Added: {new Date(k.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Provider Panel ────────────────────────────────────────────────────────────
function ProviderPanel({
  summary, selected, onClick,
}: {
  summary: ApiKeyProviderSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const hasIssues = summary.exhausted > 0 || summary.deactivated > 0;
  const allGood   = summary.active + summary.in_use > 0 && !hasIssues;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 transition-colors"
      style={{
        background: selected ? "rgba(192,132,252,0.08)" : "var(--ib-card)",
        border: `1px solid ${selected ? "rgba(192,132,252,0.4)" : "var(--ib-bdr)"}`,
        borderLeft: selected ? "3px solid var(--ib-purple)" : "3px solid transparent",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-3.5 w-3.5" style={{ color: selected ? "var(--ib-purple)" : "var(--ib-muted)" }} />
          <span className="font-mono text-sm font-medium" style={{ color: "var(--ib-fg)", textTransform: "capitalize" }}>
            {summary._id}
          </span>
        </div>
        <span className="h-2 w-2 rounded-full" style={{ background: allGood ? "#4ade80" : hasIssues ? "#f87171" : "#94a3b8" }} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono" style={{ color: "var(--ib-muted)" }}>{summary.total} keys</span>
        {summary.active > 0 && <span className="text-xs font-mono" style={{ color: "#4ade80" }}>{summary.active} active</span>}
        {summary.in_use > 0 && <span className="text-xs font-mono" style={{ color: "#60a5fa" }}>{summary.in_use} in use</span>}
        {summary.exhausted > 0 && <span className="text-xs font-mono" style={{ color: "#f87171" }}>{summary.exhausted} exhausted</span>}
      </div>
      {summary.totalRequests > 0 && (
        <div className="mt-2">
          <SuccessBar rate={Math.round((summary.totalSuccess / summary.totalRequests) * 100)} />
        </div>
      )}
    </button>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
function AdminApiKeys() {
  const [providers, setProviders]       = useState<ApiKeyProviderSummary[]>([]);
  const [selectedProvider, setSelected] = useState<string | null>(null);
  const [keys, setKeys]                 = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading]           = useState(true);
  const [keysLoading, setKeysLoading]   = useState(false);

  // Modals
  const [showForm, setShowForm]         = useState(false);
  const [editKey, setEditKey]           = useState<ApiKeyEntry | null>(null);
  const [rotateKey, setRotateKey]       = useState<ApiKeyEntry | null>(null);
  const [revealedKey, setRevealedKey]   = useState<{ id: string; value: string } | null>(null);

  // Load provider summary
  const loadProviders = useCallback(async () => {
    try {
      const res = await adminApiKeys.providers();
      setProviders(res.providers);
      if (!selectedProvider && res.providers.length > 0) {
        setSelected(res.providers[0]._id);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [selectedProvider]);

  // Load keys for selected provider
  const loadKeys = useCallback(async () => {
    if (!selectedProvider) return;
    setKeysLoading(true);
    try {
      const res = await adminApiKeys.list(selectedProvider);
      setKeys(res.keys);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to load keys");
    } finally {
      setKeysLoading(false);
    }
  }, [selectedProvider]);

  useEffect(() => { loadProviders(); }, [loadProviders]);
  useEffect(() => { loadKeys(); }, [loadKeys]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleSave(form: KeyFormData) {
    if (editKey) {
      // Update metadata only (key value handled separately via rotate)
      const updates: Record<string, unknown> = {
        label: form.label, description: form.description,
        priority: form.priority, dailyLimit: form.dailyLimit,
        monthlyLimit: form.monthlyLimit,
        maxConsecutiveFailures: form.maxConsecutiveFailures,
        expiresAt: form.expiresAt || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (form.keyValue.trim()) {
        // If a new key value was provided, rotate it
        await adminApiKeys.rotate(editKey._id, form.keyValue.trim());
      }
      await adminApiKeys.update(editKey._id, updates as Partial<ApiKeyEntry>);
      toast.success("Key updated");
    } else {
      await adminApiKeys.create({
        provider: form.provider, label: form.label, keyValue: form.keyValue,
        description: form.description, priority: form.priority,
        dailyLimit: form.dailyLimit, monthlyLimit: form.monthlyLimit,
        maxConsecutiveFailures: form.maxConsecutiveFailures,
        expiresAt: form.expiresAt || undefined,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      toast.success("API key added");
    }
    setEditKey(null);
    await Promise.all([loadProviders(), loadKeys()]);
  }

  async function handleRotate(id: string, newValue: string) {
    await adminApiKeys.rotate(id, newValue);
    toast.success("Key rotated successfully");
    await Promise.all([loadProviders(), loadKeys()]);
  }

  async function handleActivate(id: string) {
    await adminApiKeys.activate(id);
    toast.success("Key activated");
    await Promise.all([loadProviders(), loadKeys()]);
  }

  async function handleDeactivate(id: string) {
    await adminApiKeys.deactivate(id);
    toast.success("Key deactivated");
    await Promise.all([loadProviders(), loadKeys()]);
  }

  async function handleResetUsage(id: string) {
    await adminApiKeys.resetUsage(id);
    toast.success("Usage counters reset");
    loadKeys();
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete API key "${label}"? This cannot be undone.`)) return;
    try {
      await adminApiKeys.delete(id);
      toast.success("Key deleted");
      await Promise.all([loadProviders(), loadKeys()]);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }

  async function handleReveal(id: string) {
    try {
      const res = await adminApiKeys.reveal(id);
      setRevealedKey({ id, value: res.value });
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  const totalKeys    = providers.reduce((s, p) => s + p.total, 0);
  const totalActive  = providers.reduce((s, p) => s + p.active + p.in_use, 0);
  const totalExhaust = providers.reduce((s, p) => s + p.exhausted, 0);
  const totalReqs    = providers.reduce((s, p) => s + p.totalRequests, 0);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-display" style={{ color: "var(--ib-fg)", letterSpacing: "0.05em" }}>
              API Key Management
            </h1>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--ib-muted)" }}>
              Secure, dynamic key rotation with automated failover
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { loadProviders(); loadKeys(); }} className="btn-ghost flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button onClick={() => { setEditKey(null); setShowForm(true); }} className="btn-primary flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Key
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Keys",    value: totalKeys,    icon: KeyRound,    color: "var(--ib-purple)" },
            { label: "Active",        value: totalActive,  icon: CheckCircle, color: "#4ade80" },
            { label: "Exhausted",     value: totalExhaust, icon: AlertTriangle, color: "#f87171" },
            { label: "Total Requests",value: totalReqs.toLocaleString(), icon: BarChart2, color: "var(--ib-amber)" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-3" style={{ background: "var(--ib-card)", border: "1px solid var(--ib-bdr)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5" style={{ color }} />
                <span className="text-xs font-mono" style={{ color: "var(--ib-muted)" }}>{label}</span>
              </div>
              <div className="text-xl font-mono font-bold" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-5 w-5 animate-spin" style={{ color: "var(--ib-muted)" }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Provider list */}
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--ib-muted)" }}>
                Providers ({providers.length})
              </div>
              {providers.length === 0 ? (
                <div className="p-4 text-center text-xs font-mono" style={{ color: "var(--ib-muted)", border: "1px dashed var(--ib-bdr)" }}>
                  No providers yet. Add a key to get started.
                </div>
              ) : (
                providers.map((p) => (
                  <ProviderPanel
                    key={p._id}
                    summary={p}
                    selected={selectedProvider === p._id}
                    onClick={() => setSelected(p._id)}
                  />
                ))
              )}
            </div>

            {/* Keys for selected provider */}
            <div className="lg:col-span-3 space-y-3">
              {selectedProvider ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--ib-muted)" }}>
                      {selectedProvider} — {keys.length} key{keys.length !== 1 ? "s" : ""}
                    </div>
                    <button
                      onClick={() => { setEditKey(null); setShowForm(true); }}
                      className="flex items-center gap-1.5 text-xs font-mono px-2 py-1"
                      style={{ color: "var(--ib-purple)", border: "1px solid rgba(192,132,252,0.3)", background: "rgba(192,132,252,0.05)" }}
                    >
                      <Plus className="h-3 w-3" /> Add key for {selectedProvider}
                    </button>
                  </div>

                  {keysLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <RefreshCw className="h-4 w-4 animate-spin" style={{ color: "var(--ib-muted)" }} />
                    </div>
                  ) : keys.length === 0 ? (
                    <div className="p-8 text-center" style={{ border: "1px dashed var(--ib-bdr)" }}>
                      <KeyRound className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--ib-muted)" }} />
                      <p className="text-sm font-mono" style={{ color: "var(--ib-muted)" }}>No keys for {selectedProvider}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {keys.map((k) => (
                        <KeyRow
                          key={k._id}
                          k={k}
                          onEdit={(key) => { setEditKey(key); setShowForm(true); }}
                          onRotate={(key) => setRotateKey(key)}
                          onActivate={handleActivate}
                          onDeactivate={handleDeactivate}
                          onResetUsage={handleResetUsage}
                          onDelete={handleDelete}
                          onReveal={handleReveal}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-16" style={{ border: "1px dashed var(--ib-bdr)" }}>
                  <div className="text-center">
                    <Shield className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--ib-muted)" }} />
                    <p className="text-sm font-mono" style={{ color: "var(--ib-muted)" }}>Select a provider to manage its keys</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <KeyFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditKey(null); }}
        onSave={handleSave}
        editKey={editKey}
        defaultProvider={selectedProvider ?? ""}
      />
      <RotateModal
        open={!!rotateKey}
        keyEntry={rotateKey}
        onClose={() => setRotateKey(null)}
        onRotate={handleRotate}
      />

      {/* Reveal modal */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md" style={{ background: "var(--ib-surf)", border: "1px solid rgba(248,113,113,0.4)" }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" style={{ color: "#f87171" }} />
                <span className="font-mono text-sm" style={{ color: "#f87171" }}>Key Revealed — Sensitive</span>
              </div>
              <button onClick={() => setRevealedKey(null)} style={{ color: "var(--ib-muted)" }}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="p-3 font-mono text-sm break-all" style={{ background: "var(--ib-bg)", border: "1px solid var(--ib-bdr)", color: "var(--ib-fg)" }}>
                {revealedKey.value}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(revealedKey.value); toast.success("Copied"); }}
                  className="flex items-center gap-1.5 btn-ghost text-xs"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
                <button onClick={() => setRevealedKey(null)} className="btn-ghost text-xs ml-auto">Close</button>
              </div>
              <p className="text-xs font-mono" style={{ color: "#f87171" }}>
                ⚠ This action has been logged in the audit trail.
              </p>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
