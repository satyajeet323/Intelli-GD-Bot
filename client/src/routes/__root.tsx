import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft, Sun, Moon, Shield } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { getAdminToken } from "@/lib/adminApi";
import { useState, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationCenter, NotificationBanner } from "@/components/NotificationCenter";

const NAKED_ROUTES        = new Set(["/", "/login", "/register"]);
const FULLSCREEN_PREFIXES = ["/group-session/"];
const FIXED_HEIGHT_ROUTES = ["/ai-session"];
const ADMIN_PREFIX        = "/admin";

type RouteConfig = { title: string; backTo: string | null };

function getRouteConfig(pathname: string): RouteConfig {
  if (pathname.startsWith("/gd/"))       return { title: "Fluency Session",  backTo: "/dashboard" };
  if (pathname.startsWith("/report/"))   return { title: "Session Report",   backTo: "/history"   };
  switch (pathname) {
    case "/dashboard":     return { title: "Dashboard",     backTo: null         };
    case "/history":       return { title: "History",       backTo: "/dashboard" };
    case "/profile":       return { title: "Profile",       backTo: "/dashboard" };
    case "/group-session": return { title: "Group Session", backTo: "/dashboard" };
    case "/ai-session":    return { title: "AI Session",    backTo: "/dashboard" };
    default:               return { title: "",              backTo: null         };
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--ib-bg)" }}>
      <div className="max-w-md text-center ib-card p-10">
        <h1 className="font-display text-7xl gradient-text">404</h1>
        <h2 className="mt-3 font-display text-2xl" style={{ color: "var(--ib-fg)" }}>Lost in the discussion</h2>
        <p className="mt-2 text-sm font-body" style={{ color: "var(--ib-mut2)" }}>This page isn't on our agenda.</p>
        <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  notFoundComponent: NotFoundComponent,
  component: RootComponent,
});

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="h-7 w-7 flex items-center justify-center shrink-0 transition-colors"
      style={{
        border: "1px solid var(--ib-bdr)",
        background: "transparent",
        color: "var(--ib-mut2)",
      }}
    >
      {theme === "dark"
        ? <Sun  className="h-3.5 w-3.5" />
        : <Moon className="h-3.5 w-3.5" />
      }
    </button>
  );
}

function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function RootComponent() {
  const pathname   = useRouterState({ select: (r) => r.location.pathname });
  const naked      = NAKED_ROUTES.has(pathname);
  const fullscreen = FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin    = pathname.startsWith(ADMIN_PREFIX);

  const { user } = useCurrentUser();
  const [adminToken, setAdminToken] = useState<string | null>(() => getAdminToken());

  // Only enable notifications for authenticated non-admin routes
  const notifEnabled = !isAdmin && !naked && !fullscreen && !!user;
  const notif = useNotifications(notifEnabled);

  useEffect(() => {
    const sync = () => setAdminToken(getAdminToken());
    window.addEventListener("adminTokenChange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("adminTokenChange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const adminPayload = decodeJwtPayload(adminToken);
  const hasAdmin =
    !!adminPayload &&
    !!user?.email &&
    (adminPayload.email as string)?.toLowerCase() === user.email.toLowerCase();

  // Keep theme class applied on every render
  useTheme();

  if (isAdmin) {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  if (naked || fullscreen) {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  const isFixedHeight = FIXED_HEIGHT_ROUTES.some((p) => pathname.startsWith(p));
  const { title, backTo } = getRouteConfig(pathname);

  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden flex w-full" style={{ background: "var(--ib-bg)" }}>
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* High-priority banner */}
          {notif.bannerNotif && (
            <NotificationBanner
              notif={notif.bannerNotif}
              onDismiss={notif.dismissBanner}
            />
          )}

          {/* Top bar */}
          <header
            className="h-12 shrink-0 flex items-center gap-3 px-4 z-30"
            style={{
              background: "var(--ib-surf)",
              borderBottom: "1px solid var(--ib-bdr)",
              marginTop: notif.bannerNotif ? "44px" : 0,
            }}
          >
            <SidebarTrigger
              className="h-7 w-7 flex items-center justify-center shrink-0 transition-colors"
              style={{ color: "var(--ib-mut2)" }}
            />

            {backTo && (
              <Link
                to={backTo as never}
                className="btn-ghost inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </Link>
            )}

            {title && (
              <span
                className="font-display text-sm tracking-widest uppercase"
                style={{ color: "var(--ib-fg)" }}
              >
                {title}
              </span>
            )}

            <div className="flex-1" />

            <ThemeToggle />

            {/* Notification Center */}
            <NotificationCenter
              items={notif.items}
              unreadCount={notif.unreadCount}
              loading={notif.loading}
              onRead={notif.markRead}
              onMarkAllRead={notif.markAllRead}
              onDismiss={notif.dismiss}
              onClearAll={notif.clearAll}
            />

            {hasAdmin && (
              <a
                href="/admin/dashboard"
                className="hidden sm:inline-flex items-center gap-2 text-xs px-3 py-1.5"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ib-purple)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  background: "rgba(139,92,246,0.06)",
                }}
              >
                <Shield className="h-3 w-3" />
                Admin Panel
              </a>
            )}

            <Link
              to="/gd/$sessionId"
              params={{ sessionId: "new" }}
              className="hidden sm:inline-flex items-center gap-2 text-xs px-3 py-1.5"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ib-amber)",
                border: "1px solid rgba(245,158,11,0.3)",
                background: "rgba(245,158,11,0.06)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--ib-ok)", animation: "pulse 2s infinite" }}
              />
              Start Session
            </Link>
          </header>

          <main
            className={[
              "flex-1 min-h-0 flex flex-col",
              isFixedHeight ? "overflow-hidden" : "overflow-y-auto scrollbar-thin",
            ].join(" ")}
          >
            <Outlet />
          </main>

          {/* Status bar */}
          <StatusBar />
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}

function StatusBar() {
  return (
    <div className="ib-status-bar shrink-0 overflow-x-auto">
      <span style={{ color: "var(--ib-ok)" }} className="hidden sm:inline">● CLIENT :5173</span>
      <span className="hidden sm:inline">● API :4000</span>
      <span className="hidden md:inline">● ML :8000</span>
      <span style={{ color: "var(--ib-ok)" }}>● SOCKET CONNECTED</span>
      <span className="hidden sm:inline">● DB OK</span>
      <span style={{ marginLeft: "auto" }}>INTELLI BOT v2.0</span>
    </div>
  );
}
