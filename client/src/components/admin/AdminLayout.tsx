import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { adminAuth, adminAnalytics, type AdminUser } from "@/lib/adminApi";
import { useTheme } from "@/hooks/useTheme";
import {
  LayoutDashboard, Users, Shield, Bell, CreditCard,
  BarChart3, FileText, Settings, LogOut, Menu, X,
  ChevronRight, Activity, UserCog, Mic, Sun, Moon, KeyRound,
} from "lucide-react";

type NavItem = {
  title: string;
  icon:  typeof LayoutDashboard;
  href:  string;
  badge?: string;
};

const NAV: NavItem[] = [
  { title: "Dashboard",     icon: LayoutDashboard, href: "/admin/dashboard" },
  { title: "Users",         icon: Users,           href: "/admin/users" },
  { title: "Sessions",      icon: Mic,             href: "/admin/sessions" },
  { title: "Plans",         icon: CreditCard,      href: "/admin/plans" },
  { title: "Notifications", icon: Bell,            href: "/admin/notifications" },
  { title: "Roles",         icon: Shield,          href: "/admin/roles" },
  { title: "Analytics",     icon: BarChart3,       href: "/admin/analytics" },
  { title: "Audit Logs",    icon: FileText,        href: "/admin/audit" },
  { title: "System",        icon: Settings,        href: "/admin/system" },
  { title: "Admins",        icon: UserCog,         href: "/admin/admins" },
  { title: "API Keys",      icon: KeyRound,        href: "/admin/api-keys" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { theme, toggle } = useTheme();
  const [admin,       setAdmin]       = useState<AdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wsCount,     setWsCount]     = useState(0);

  useEffect(() => {
    adminAuth.me().then((r) => setAdmin(r.admin)).catch(() => {});
    const poll = () => adminAnalytics.overview().then((r) => {
      const ov = r.overview as Record<string, number>;
      setWsCount(ov.wsConnections ?? 0);
    }).catch(() => {});
    poll();
    const t = setInterval(poll, 30000);
    return () => clearInterval(t);
  }, []);

  const initials = admin?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "A";

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--ib-bg)" }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(12,11,9,0.8)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{ background: "var(--ib-surf)", borderRight: "1px solid var(--ib-bdr)" }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4 shrink-0" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
          <div
            className="h-8 w-8 flex items-center justify-center"
            style={{ background: "rgba(192,132,252,0.15)", border: "1px solid rgba(192,132,252,0.3)", clipPath: "polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 0 100%)" }}
          >
            <Shield className="h-4 w-4" style={{ color: "var(--ib-purple)" }} />
          </div>
          <div>
            <div className="font-display text-sm" style={{ color: "var(--ib-fg)", letterSpacing: "0.08em" }}>Admin Panel</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
              INTELLI<span style={{ color: "var(--ib-amber)" }}>BOT</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden"
            style={{ color: "var(--ib-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live indicator */}
        <div className="px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
          <div className="flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--ib-ok)" }} />
            {wsCount} live connections
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href as never}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2 transition-colors"
                style={{
                  background: active ? "rgba(192,132,252,0.1)" : "transparent",
                  borderLeft: active ? "2px solid var(--ib-purple)" : "2px solid transparent",
                  color: active ? "var(--ib-purple)" : "var(--ib-mut2)",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <span
                    className="text-xs px-1.5 py-0.5 font-bold"
                    style={{ background: "rgba(220,138,107,0.15)", color: "var(--ib-terra)", border: "1px solid rgba(220,138,107,0.3)", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem" }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 shrink-0" style={{ borderTop: "1px solid var(--ib-bdr)" }}>
          <div className="p-3 space-y-2" style={{ border: "1px solid var(--ib-bdr)", background: "var(--ib-card)" }}>
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: "rgba(192,132,252,0.12)",
                  border: "1px solid rgba(192,132,252,0.3)",
                  color: "var(--ib-purple)",
                  fontFamily: "'JetBrains Mono',monospace",
                  clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)",
                }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: "var(--ib-fg)", fontFamily: "'DM Sans',sans-serif", fontWeight: 400 }}>
                  {admin?.name ?? "Admin"}
                </div>
                <span className="ib-chip-purple" style={{ display: "inline-block", marginTop: "2px" }}>
                  {admin?.isSuperAdmin ? "Super Admin" : (admin?.role as { name?: string })?.name ?? "Admin"}
                </span>
              </div>
            </div>
            <button
              onClick={() => adminAuth.logout()}
              className="flex items-center gap-2 w-full"
              style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ib-muted)" }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="h-14 shrink-0 flex items-center gap-3 px-4 z-30"
          style={{ background: "var(--ib-surf)", borderBottom: "1px solid var(--ib-bdr)" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden h-8 w-8 flex items-center justify-center transition-colors"
            style={{ border: "1px solid var(--ib-bdr)", color: "var(--ib-muted)" }}
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
            <span>Admin</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span style={{ color: "var(--ib-purple)" }}>
              {pathname.split("/admin/")[1]?.split("/")[0] ?? "Dashboard"}
            </span>
          </div>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-1.5" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
            <Activity className="h-3.5 w-3.5" style={{ color: "var(--ib-ok)" }} />
            <span>System OK</span>
          </div>

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="h-8 w-8 flex items-center justify-center transition-colors"
            style={{ border: "1px solid var(--ib-bdr)", background: "transparent", color: "var(--ib-mut2)" }}
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <Link
            to="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 btn-ghost"
            style={{ padding: "0.35rem 0.875rem", fontSize: "0.6rem" }}
          >
            ← Main App
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>

        {/* Status bar */}
        <div className="ib-status-bar shrink-0">
          <span style={{ color: "var(--ib-ok)" }}>● CLIENT :5173</span>
          <span>● API :4000</span>
          <span>● ML :8000</span>
          <span style={{ color: "var(--ib-ok)" }}>● SOCKET CONNECTED</span>
          <span style={{ marginLeft: "auto" }}>ADMIN PANEL v2.0</span>
        </div>
      </div>
    </div>
  );
}
