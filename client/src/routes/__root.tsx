import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const NAKED_ROUTES        = new Set(["/", "/login", "/register"]);
const FULLSCREEN_PREFIXES = ["/group-session/"];
const FIXED_HEIGHT_ROUTES = ["/gd/"];
// Admin routes manage their own layout entirely
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass rounded-2xl p-10">
        <h1 className="text-7xl font-display font-bold gradient-text">404</h1>
        <h2 className="mt-3 text-xl font-semibold">Lost in the discussion</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page isn't on our agenda.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-80 transition"
        >
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
      className="h-8 w-8 rounded-lg flex items-center justify-center border border-border/60 bg-background/60 hover:bg-muted transition-colors shrink-0"
    >
      {theme === "dark"
        ? <Sun  className="h-4 w-4 text-muted-foreground" />
        : <Moon className="h-4 w-4 text-muted-foreground" />
      }
    </button>
  );
}

function RootComponent() {
  const pathname   = useRouterState({ select: (r) => r.location.pathname });
  const naked      = NAKED_ROUTES.has(pathname);
  const fullscreen = FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin    = pathname.startsWith(ADMIN_PREFIX);

  // Apply theme class on every render path
  useTheme();

  // Admin routes render their own layout — just pass through
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
      <div className="h-screen overflow-hidden flex w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top bar */}
          <header className="h-14 shrink-0 flex items-center gap-3 border-b border-border/50 px-4 bg-background/80 backdrop-blur-xl z-30">

            <SidebarTrigger className="hover:bg-muted shrink-0" />

            {backTo && (
              <Link
                to={backTo as never}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                <span>Back</span>
              </Link>
            )}

            {title && (
              <span className="text-sm font-semibold text-foreground truncate">
                {title}
              </span>
            )}

            <div className="flex-1" />

            <ThemeToggle />

            <Link
              to="/gd/$sessionId"
              params={{ sessionId: "new" }}
              className="hidden sm:inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-border/60 bg-background/60 hover:bg-muted transition-all shrink-0"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Start fluency session
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

        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}
