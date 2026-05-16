import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, MessagesSquare, History, User, Mic, LogOut, Users, Shield, BrainCircuit } from "lucide-react";
import { auth } from "@/lib/api";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { getAdminToken } from "@/lib/adminApi";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

/**
 * Decode a JWT payload without verifying the signature (client-side only).
 * Returns null if the token is missing, malformed, or expired.
 */
function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Check expiry
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

  const initials  = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
  const planLabel = user?.plan === "pro" ? "Pro" : "Free";

  // Show "Admin Panel" only when:
  //  1. There is a valid (non-expired) admin JWT in localStorage, AND
  //  2. The email in that admin JWT matches the currently logged-in user's email.
  // This prevents the button from leaking to other users who share the same browser.
  const adminPayload = decodeJwtPayload(getAdminToken());
  const hasAdmin =
    !!adminPayload &&
    !!user?.email &&
    (adminPayload.email as string)?.toLowerCase() === user.email.toLowerCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <SidebarHeader className="p-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Mic className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display font-bold text-base tracking-tight">GD Bot</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Discussion</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-1">
              Navigation
            </SidebarGroupLabel>
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
                      className="h-10 rounded-lg data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      <Link
                        to={item.url as never}
                        params={item.params as never}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="font-medium text-sm">{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3">
        {collapsed ? (
          <button
            onClick={() => auth.logout()}
            className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-sidebar-accent transition-colors mx-auto"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground select-none shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.name ?? "Loading…"}</div>
                <div className="text-[11px] text-muted-foreground">{planLabel} plan</div>
              </div>
            </div>
            <button
              onClick={() => auth.logout()}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
            {hasAdmin && (
              <a
                href="/admin/dashboard"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
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
