import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, MessagesSquare, History, User, Mic, LogOut, Users, Shield, BrainCircuit } from "lucide-react";
import { auth } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { getAdminToken } from "@/lib/adminApi";
import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title:   string;
  url:     string;
  icon:    typeof LayoutDashboard;
  params?: Record<string, string>;
};

const items: NavItem[] = [
  { title: "Dashboard",       url: "/dashboard",     icon: LayoutDashboard },
  { title: "Fluency Session", url: "/gd/$sessionId", params: { sessionId: "new" }, icon: MessagesSquare },
  { title: "Group Session",   url: "/group-session", icon: Users },
  { title: "AI Session",      url: "/ai-session",    icon: BrainCircuit },
  { title: "History",         url: "/history",       icon: History },
  { title: "Profile",         url: "/profile",       icon: User },
];

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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname  = useRouterState({ select: (r) => r.location.pathname });
  const { user }  = useCurrentUser();

  const [adminToken, setAdminToken] = useState<string | null>(() => getAdminToken());

  useEffect(() => {
    const sync = () => setAdminToken(getAdminToken());
    window.addEventListener("adminTokenChange", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("adminTokenChange", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const initials  = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  const planLabel = user?.plan === "pro" ? "PRO" : "FREE";

  const adminPayload = decodeJwtPayload(adminToken);
  const hasAdmin =
    !!adminPayload &&
    !!user?.email &&
    (adminPayload.email as string)?.toLowerCase() === user.email.toLowerCase();

  return (
    <Sidebar
      collapsible="icon"
      style={{ background: "var(--ib-surf)", borderRight: "1px solid var(--ib-bdr)" }}
    >
      <SidebarHeader className="p-4" style={{ borderBottom: "1px solid var(--ib-bdr)" }}>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 flex items-center justify-center shrink-0"
            style={{
              background: "var(--ib-amber)",
              clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
            }}
          >
            <Mic className="h-4 w-4" style={{ color: "#0c0b09" }} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-base" style={{ color: "var(--ib-fg)", letterSpacing: "0.1em" }}>
                INTELLI<span style={{ color: "var(--ib-amber)" }}>BOT</span>
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)" }}>
                AI Discussion
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && (
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--ib-muted)", padding: "0 0.5rem", marginBottom: "0.5rem" }}>
              Navigation
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const base   = item.url.includes("$") ? item.url.split("/$")[0] : item.url;
                const active =
                  pathname === item.url ||
                  (base !== "/dashboard" && pathname.startsWith(base));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="h-9 transition-colors"
                      style={{
                        background: active ? "rgba(245,158,11,0.1)" : "transparent",
                        borderLeft: active ? "2px solid var(--ib-amber)" : "2px solid transparent",
                        borderRadius: 0,
                        color: active ? "var(--ib-amber)" : "var(--ib-mut2)",
                      }}
                    >
                      <Link to={item.url as never} params={item.params as never} className="flex items-center gap-3 px-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            {item.title}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3" style={{ borderTop: "1px solid var(--ib-bdr)" }}>
        {collapsed ? (
          <button
            onClick={() => auth.logout()}
            className="h-9 w-9 flex items-center justify-center mx-auto"
            style={{ color: "var(--ib-muted)" }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="p-3 space-y-3" style={{ border: "1px solid var(--ib-bdr)", background: "var(--ib-card)" }}>
            <div className="flex items-center gap-2.5">
              <div
                className="h-8 w-8 flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  color: "var(--ib-amber)",
                  fontFamily: "'JetBrains Mono',monospace",
                  clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)",
                }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: "var(--ib-fg)", fontWeight: 400 }}>
                  {user?.name ?? "Loading…"}
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.55rem", letterSpacing: "0.12em", textTransform: "uppercase", background: "rgba(245,158,11,0.12)", color: "var(--ib-amber)", border: "1px solid rgba(245,158,11,0.3)", padding: "0.15rem 0.4rem", display: "inline-block", marginTop: "2px" }}>
                  {planLabel}
                </span>
              </div>
            </div>
            <button
              onClick={() => auth.logout()}
              className="flex items-center gap-2 w-full"
              style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ib-muted)" }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
            {hasAdmin && (
              <a
                href="/admin/dashboard"
                className="flex items-center gap-2 w-full"
                style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ib-purple)" }}
              >
                <Shield className="h-3.5 w-3.5" /> Admin Panel
              </a>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
