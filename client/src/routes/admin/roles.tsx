import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminRoles, type AdminRole } from "@/lib/adminApi";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Shield, Lock, Check } from "lucide-react";

export const Route = createFileRoute("/admin/roles")({
  component: AdminRoles,
});

const PERMISSION_GROUPS: Record<string, string[]> = {
  Users:         ["users.view", "users.edit", "users.suspend", "users.delete", "users.resetPassword"],
  Roles:         ["roles.view", "roles.create", "roles.edit", "roles.delete"],
  Sessions:      ["sessions.view", "sessions.manage", "sessions.delete"],
  Reports:       ["reports.view", "reports.moderate", "reports.export"],
  Plans:         ["plans.view", "plans.create", "plans.edit", "plans.delete"],
  Notifications: ["notifications.view", "notifications.create", "notifications.send", "notifications.delete"],
  Analytics:     ["analytics.view", "analytics.export"],
  System:        ["system.view", "system.config", "system.backup"],
  Audit:         ["audit.view"],
  Content:       ["content.view", "content.moderate"],
  Topics:        ["topics.view", "topics.manage"],
  ML:            ["ml.view", "ml.manage"],
  Support:       ["support.view", "support.manage"],
  "Feature Flags": ["featureFlags.view", "featureFlags.manage"],
  "Rate Limits": ["rateLimit.view", "rateLimit.manage"],
};

function RoleModal({
  role,
  allPermissions,
  onClose,
  onSave,
}: {
  role: Partial<AdminRole>;
  allPermissions: string[];
  onClose: () => void;
  onSave: (data: Partial<AdminRole>) => Promise<void>;
}) {
  const [name, setName]         = useState(role.name ?? "");
  const [desc, setDesc]         = useState(role.description ?? "");
  const [color, setColor]       = useState(role.color ?? "#6366f1");
  const [perms, setPerms]       = useState<string[]>(role.permissions ?? []);
  const [saving, setSaving]     = useState(false);

  const toggle = (p: string) =>
    setPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const toggleGroup = (group: string[]) => {
    const allOn = group.every((p) => perms.includes(p));
    if (allOn) setPerms((prev) => prev.filter((p) => !group.includes(p)));
    else setPerms((prev) => [...new Set([...prev, ...group])]);
  };

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...role, name, description: desc, color, permissions: perms });
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card p-6 space-y-5 animate-scale-in">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{role._id ? "Edit Role" : "Create Role"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Role Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={role.isSystem}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full h-9 rounded-lg border border-border/60 bg-input px-1 py-1 cursor-pointer"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Permissions</label>
            <span className="text-xs text-muted-foreground">{perms.length} selected</span>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin pr-1">
            {Object.entries(PERMISSION_GROUPS).map(([group, groupPerms]) => {
              const allOn = groupPerms.every((p) => perms.includes(p));
              const someOn = groupPerms.some((p) => perms.includes(p));
              return (
                <div key={group} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">{group}</span>
                    <button
                      onClick={() => toggleGroup(groupPerms)}
                      className={[
                        "text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors",
                        allOn ? "bg-primary text-primary-foreground" : someOn ? "bg-muted text-muted-foreground" : "border border-border/60 hover:bg-muted",
                      ].join(" ")}
                    >
                      {allOn ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {groupPerms.map((p) => (
                      <button
                        key={p}
                        onClick={() => toggle(p)}
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                          perms.includes(p)
                            ? "bg-primary text-primary-foreground"
                            : "border border-border/60 hover:bg-muted text-muted-foreground",
                        ].join(" ")}
                      >
                        {perms.includes(p) && <Check className="h-2.5 w-2.5" />}
                        {p.split(".")[1]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold hover:opacity-80 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminRoles() {
  const [roles, setRoles]           = useState<AdminRole[]>([]);
  const [allPerms, setAllPerms]     = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState<Partial<AdminRole> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminRoles.list();
      setRoles(res.roles);
      setAllPerms(res.allPermissions);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function handleSave(data: Partial<AdminRole>) {
    if (data._id) {
      await adminRoles.update(data._id, data);
      toast.success("Role updated");
    } else {
      await adminRoles.create(data);
      toast.success("Role created");
    }
    load();
  }

  async function handleDelete(role: AdminRole) {
    if (role.isSystem) return toast.error("Cannot delete system roles");
    if (!confirm(`Delete role "${role.name}"?`)) return;
    try {
      await adminRoles.delete(role._id);
      toast.success("Role deleted");
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Role Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Configure roles and permissions</p>
          </div>
          <button
            onClick={() => setModal({})}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-80 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Role
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse">
                <div className="h-5 w-32 rounded bg-muted mb-3" />
                <div className="h-3 w-full rounded bg-muted mb-2" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <div
                key={role._id}
                className="rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/20 transition-all hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${role.color}20`, border: `1px solid ${role.color}40` }}
                    >
                      <Shield className="h-5 w-5" style={{ color: role.color }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{role.name}</div>
                      {role.isSystem && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Lock className="h-2.5 w-2.5" /> System
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setModal(role)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDelete(role)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2rem]">
                  {role.description || "No description"}
                </p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {role.permissions.slice(0, 6).map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-mono"
                    >
                      {p}
                    </span>
                  ))}
                  {role.permissions.length > 6 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      +{role.permissions.length - 6}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span>{role.permissions.length} permissions</span>
                  <span>{role.userCount} admin{role.userCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <RoleModal
          role={modal}
          allPermissions={allPerms}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  );
}
