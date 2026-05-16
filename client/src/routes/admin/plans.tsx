import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminPlans, type Plan } from "@/lib/adminApi";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Users, CreditCard } from "lucide-react";

export const Route = createFileRoute("/admin/plans")({
  component: AdminPlans,
});

const EMPTY_PLAN: Partial<Plan> = {
  name: "", slug: "", description: "", color: "#6366f1", badge: "",
  price: { monthly: 0, yearly: 0, currency: "USD" },
  features: [],
  limits: { sessionsPerMonth: -1, aiSessionsPerDay: -1, maxParticipants: 12, historyRetainDays: 30, apiCallsPerDay: -1, storageGB: 1 },
  isActive: true, isPublic: true, isDefault: false, sortOrder: 0,
};

function PlanModal({
  plan, onClose, onSave,
}: {
  plan: Partial<Plan>;
  onClose: () => void;
  onSave: (data: Partial<Plan>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Plan>>({ ...EMPTY_PLAN, ...plan });
  const [featInput, setFeatInput] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (path: string, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev };
      const keys = path.split(".");
      let obj: Record<string, unknown> = next as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...(obj[keys[i]] as Record<string, unknown>) };
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  async function handleSave() {
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e: unknown) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 space-y-5 animate-scale-in">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{plan._id ? "Edit Plan" : "Create Plan"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Slug</label>
            <input value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2}
            className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Monthly ($)</label>
            <input type="number" value={form.price?.monthly ?? 0} onChange={(e) => set("price.monthly", parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Yearly ($)</label>
            <input type="number" value={form.price?.yearly ?? 0} onChange={(e) => set("price.yearly", parseFloat(e.target.value))}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <input type="color" value={form.color ?? "#6366f1"} onChange={(e) => set("color", e.target.value)}
              className="w-full h-9 rounded-lg border border-border/60 bg-input px-1 py-1 cursor-pointer" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Features</label>
          <div className="flex gap-2">
            <input value={featInput} onChange={(e) => setFeatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && featInput.trim()) { set("features", [...(form.features ?? []), featInput.trim()]); setFeatInput(""); } }}
              placeholder="Add feature, press Enter"
              className="flex-1 rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {(form.features ?? []).map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                {f}
                <button onClick={() => set("features", (form.features ?? []).filter((_, j) => j !== i))} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Sessions/month (-1=∞)", key: "limits.sessionsPerMonth" },
            { label: "AI sessions/day (-1=∞)", key: "limits.aiSessionsPerDay" },
            { label: "Max participants", key: "limits.maxParticipants" },
            { label: "History days", key: "limits.historyRetainDays" },
          ].map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <input type="number"
                value={(form.limits as Record<string, number>)?.[f.key.split(".")[1]] ?? 0}
                onChange={(e) => set(f.key, parseInt(e.target.value))}
                className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm">
          {[
            { label: "Active", key: "isActive" },
            { label: "Public", key: "isPublic" },
            { label: "Default", key: "isDefault" },
          ].map((f) => (
            <label key={f.key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={(form as Record<string, boolean>)[f.key] ?? false}
                onChange={(e) => set(f.key, e.target.checked)}
                className="rounded border-border/60" />
              {f.label}
            </label>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name || !form.slug}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold hover:opacity-80 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPlans() {
  const [plans, setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState<Partial<Plan> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminPlans.list();
      setPlans(res.plans);
    } catch { toast.error("Failed to load plans"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  async function handleSave(data: Partial<Plan>) {
    if (data._id) {
      await adminPlans.update(data._id, data);
      toast.success("Plan updated");
    } else {
      await adminPlans.create(data);
      toast.success("Plan created");
    }
    load();
  }

  async function handleDelete(plan: Plan) {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    try {
      await adminPlans.delete(plan._id);
      toast.success("Plan deleted");
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Plan Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage subscription plans and pricing</p>
          </div>
          <button
            onClick={() => setModal(EMPTY_PLAN)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-80 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Plan
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-6 animate-pulse">
                <div className="h-5 w-24 rounded bg-muted mb-3" />
                <div className="h-4 w-full rounded bg-muted mb-2" />
                <div className="h-8 w-16 rounded bg-muted mt-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div key={plan._id} className="rounded-2xl border border-border/50 bg-card p-6 hover:border-foreground/20 transition-all hover:-translate-y-0.5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}20`, border: `1px solid ${plan.color}40` }}>
                      <CreditCard className="h-5 w-5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <div className="font-semibold">{plan.name}</div>
                      {plan.badge && (
                        <span className="text-[10px] rounded-full px-2 py-0.5 font-medium" style={{ background: `${plan.color}20`, color: plan.color }}>
                          {plan.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setModal(plan)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!plan.isDefault && (
                      <button onClick={() => handleDelete(plan)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{plan.description}</p>

                <div className="flex items-end gap-1 mb-4">
                  <span className="font-display text-2xl font-bold">${plan.price.monthly}</span>
                  <span className="text-xs text-muted-foreground mb-1">/mo</span>
                </div>

                <div className="space-y-1.5 mb-4">
                  {plan.features.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-success shrink-0" /> {f}
                    </div>
                  ))}
                  {plan.features.length > 4 && (
                    <div className="text-xs text-muted-foreground">+{plan.features.length - 4} more</div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {plan.userCount} users
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.isDefault && <span className="text-[10px] rounded-full bg-muted px-2 py-0.5">Default</span>}
                    <span className={`text-[10px] rounded-full px-2 py-0.5 ${plan.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <PlanModal plan={modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </AdminLayout>
  );
}
