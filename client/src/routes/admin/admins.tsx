import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminAdmins, adminRoles, type AdminUser, type AdminRole } from "@/lib/adminApi";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, UserCog, Shield, Crown } from "lucide-react";

export const Route = createFileRoute("/admin/admins")({
  component: AdminAdmins,
});

function AdminModal({
  admin,
  roles,
  onClose,
  onSave,
}: {
  admin: Partial<AdminUser> & { password?: string; roleId?: string };
  roles: AdminRole[];
  onClose: () => void;
  onSave: (data: Partial<AdminUser> & { password?: string; roleId?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name:         admin.name         ?? "",
    email:        admin.email        ?? "",
    password:     "",
    roleId:       admin.roleId ?? (admin.role as AdminRole)?._id ?? "",
    isActive:     admin.isActive     ?? true,
    isSuperAdmin: admin.isSuperAdmin ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name || !form.email || !form.roleId) return;
    if (!admin._id && form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...admin, ...form });
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 space-y-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{admin._id ? "Edit Admin" : "Create Admin"}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {[
          { label: "Name",  key: "name",  type: "text",     placeholder: "Full name" },
          { label: "Email", key: "email", type: "email",    placeholder: "admin@example.com" },
          ...(!admin._id ? [{ label: "Password (min 8)", key: "password", type: "password", placeholder: "••••••••" }] : []),
        ].map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <input
              type={f.type}
              value={(form as unknown as Record<string, string>)[f.key] ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <select
            value={form.roleId}
            onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))}
            className="w-full rounded-lg border border-border/60 bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select role…</option>
            {roles.map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Active
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isSuperAdmin}
              onChange={(e) => setForm((prev) => ({ ...prev, isSuperAdmin: e.target.checked }))}
            />
            Super Admin
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border/60 py-2 text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.email || !form.roleId}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-semibold hover:opacity-80 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : admin._id ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminAdmins() {
  const [admins, setAdmins]   = useState<AdminUser[]>([]);
  const [roles, setRoles]     = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<(Partial<AdminUser> & { password?: string; roleId?: string }) | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [ar, rr] = await Promise.allSettled([adminAdmins.list(), adminRoles.list()]);
      if (ar.status === "fulfilled") setAdmins(ar.value.admins);
      if (rr.status === "fulfilled") setRoles(rr.value.roles);
    } catch {
      toast.error("Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  async function handleSave(data: Partial<AdminUser> & { password?: string; roleId?: string }) {
    if (data._id) {
      await adminAdmins.update(data._id, data as Partial<AdminUser> & { roleId?: string });
      toast.success("Admin updated");
    } else {
      await adminAdmins.create(data as Partial<AdminUser> & { password: string; roleId: string });
      toast.success("Admin created");
    }
    load();
  }

  async function handleDelete(admin: AdminUser) {
    if (!confirm(`Delete admin "${admin.name}"?`)) return;
    try {
      await adminAdmins.delete(admin._id);
      toast.success("Admin deleted");
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
            <h1 className="font-display text-2xl font-bold">Admin Accounts</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage admin users and their roles</p>
          </div>
          <button
            onClick={() => setModal({})}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-80 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Admin
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-5 animate-pulse">
                <div className="h-5 w-32 rounded bg-muted mb-3" />
                <div className="h-3 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {admins.map((admin) => {
              const role = admin.role as AdminRole;
              const initials = admin.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <div
                  key={admin._id}
                  className="rounded-2xl border border-border/50 bg-card p-5 hover:border-foreground/20 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-sm font-bold text-destructive">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm">{admin.name}</span>
                          {admin.isSuperAdmin && (
                            <Crown className="h-3.5 w-3.5 text-amber-400" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{admin.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setModal({ ...admin, roleId: role?._id })}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(admin)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {role && (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded flex items-center justify-center"
                          style={{ background: `${role.color}20` }}
                        >
                          <Shield className="h-3 w-3" style={{ color: role.color }} />
                        </div>
                        <span className="text-xs font-medium">{role.name}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className={admin.isActive ? "text-success" : "text-destructive"}>
                        {admin.isActive ? "Active" : "Suspended"}
                      </span>
                      <span>
                        {admin.lastLogin
                          ? `Last login ${new Date(admin.lastLogin).toLocaleDateString()}`
                          : "Never logged in"}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {admin.loginCount} login{admin.loginCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <AdminModal
          admin={modal}
          roles={roles}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  );
}
