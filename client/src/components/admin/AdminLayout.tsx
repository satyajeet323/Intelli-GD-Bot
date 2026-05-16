import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { adminAuth, adminAnalytics, type AdminUser } from "@/lib/adminApi";
import { useTheme } from "@/hooks/useTheme";
import {
  LayoutDashboard, Users, Shield, MessageSquare, CreditCard,
  Bell, BarChart3, FileText, Settings, LogOut, Menu, X,
  Sun, Moon, ChevronRight, Activity, Database, Flag,
  UserCog, Mic, AlertTriangle,
} from "lucide-react";

type NavItem = {
  title: string;
  icon: typeof LayoutDashboard;
  href: string;
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
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { theme, toggle } = useTheme();
  const [admin, setAdmin]       = useState<AdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wsCount, setWsCount]   = useState(0);

  useEffect(() => {
    adminAuth.me().then((r) => setAdmin(r.admin)).catch(() => {});
    // Poll live metrics every 30s
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
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-border/50 bg-sidebar transition-transform duration-200",
          "lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border/50 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <Shield className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <div className="font-display font-bold text-sm">Admin Panel</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">GD Bot</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live indicator */}
        <div className="px-4 py-2 border-b border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
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
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                ].join(" ")}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.title}</span>
                {item.badge && (
                  <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border/50 shrink-0">
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-xs font-bold text-destructive shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{admin?.name ?? "Admin"}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {admin?.isSuperAdmin ? "Super Admin" : (admin?.role as { name?: string })?.name ?? "Admin"}
                </div>
              </div>
            </div>
            <button
              onClick={() => adminAuth.logout()}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 flex items-center gap-3 border-b border-border/50 px-4 bg-background/80 backdrop-blur-xl z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center border border-border/60 hover:bg-muted transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Admin</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium capitalize">
              {pathname.split("/admin/")[1]?.split("/")[0] ?? "Dashboard"}
            </span>
          </div>

          <div className="flex-1" />

          {/* Status indicators */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-success" />
              <span>System OK</span>
            </div>
          </div>

          <button
            onClick={toggle}
            className="h-8 w-8 rounded-lg flex items-center justify-center border border-border/60 bg-background/60 hover:bg-muted transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link
            to="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted transition-colors"
          >
            ← Main App
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
