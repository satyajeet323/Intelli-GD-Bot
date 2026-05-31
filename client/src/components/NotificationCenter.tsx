/**
 * NotificationCenter — Bell icon + slide-out panel for user notifications.
 */

import { useState, useRef, useEffect } from "react";
import {
  Bell, X, Check, CheckCheck, Trash2,
  Megaphone, AlertTriangle, Wrench, Tag, Shield,
  Zap, Settings, Info, ExternalLink,
} from "lucide-react";
import type { UserNotification } from "@/lib/api";

// ── Type icon map ─────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, typeof Bell> = {
  announcement: Megaphone,
  alert:        AlertTriangle,
  maintenance:  Wrench,
  promotion:    Tag,
  system:       Bell,
  security:     Shield,
  feature:      Zap,
  custom:       Settings,
};

// ── Priority styles ───────────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, { dot: string; border: string; bg: string }> = {
  low:      { dot: "bg-muted-foreground", border: "border-border/40",       bg: "" },
  medium:   { dot: "bg-blue-400",         border: "border-blue-500/20",     bg: "" },
  high:     { dot: "bg-amber-400",        border: "border-amber-500/30",    bg: "bg-amber-500/5" },
  critical: { dot: "bg-red-500",          border: "border-red-500/40",      bg: "bg-red-500/5" },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Single notification item ──────────────────────────────────────────────────
function NotifItem({
  notif,
  onRead,
  onDismiss,
}: {
  notif: UserNotification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const Icon   = TYPE_ICONS[notif.type] ?? Bell;
  const styles = PRIORITY_STYLES[notif.priority] ?? PRIORITY_STYLES.medium;

  return (
    <div
      className={[
        "group relative flex gap-3 p-3 border-b border-border/30 transition-colors cursor-pointer",
        !notif.isRead ? "bg-primary/5" : "hover:bg-muted/40",
        styles.bg,
      ].join(" ")}
      onClick={() => !notif.isRead && onRead(notif._id)}
    >
      {/* Unread dot */}
      {!notif.isRead && (
        <span className={`absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      )}

      {/* Icon */}
      <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border ${styles.border} bg-card`}>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-medium leading-snug ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
            {notif.title}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
            {timeAgo(notif.deliveredAt ?? notif.sentAt ?? notif.createdAt)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {notif.message}
        </p>
        {notif.actionUrl && notif.actionLabel && (
          <a
            href={notif.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-primary hover:underline"
          >
            {notif.actionLabel} <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notif._id); }}
        className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-all shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Banner notification ───────────────────────────────────────────────────────
export function NotificationBanner({
  notif,
  onDismiss,
}: {
  notif: UserNotification;
  onDismiss: () => void;
}) {
  const isCritical = notif.priority === "critical";
  return (
    <div
      className={[
        "fixed top-0 left-0 right-0 z-[100] flex items-center gap-3 px-4 py-3 text-sm shadow-lg animate-slide-down",
        isCritical
          ? "bg-destructive text-destructive-foreground"
          : "bg-amber-500 text-black",
      ].join(" ")}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{notif.title}</span>
        <span className="ml-2 opacity-90 text-xs">{notif.message}</span>
      </div>
      {notif.actionUrl && notif.actionLabel && (
        <a
          href={notif.actionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline shrink-0 opacity-90 hover:opacity-100"
        >
          {notif.actionLabel}
        </a>
      )}
      {notif.isDismissible && (
        <button onClick={onDismiss} className="h-6 w-6 flex items-center justify-center rounded hover:bg-black/10 shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Main NotificationCenter ───────────────────────────────────────────────────
export function NotificationCenter({
  items,
  unreadCount,
  loading,
  onRead,
  onMarkAllRead,
  onDismiss,
  onClearAll,
}: {
  items: UserNotification[];
  unreadCount: number;
  loading: boolean;
  onRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayed = filter === "unread" ? items.filter((n) => !n.isRead) : items;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative h-7 w-7 flex items-center justify-center shrink-0 transition-colors"
        style={{
          border: "1px solid var(--ib-bdr)",
          background: open ? "var(--ib-surf)" : "transparent",
          color: "var(--ib-mut2)",
        }}
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-9 w-80 rounded-xl border border-border/60 bg-card shadow-2xl z-50 overflow-hidden animate-scale-in"
          style={{ maxHeight: "min(480px, 80vh)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  title="Mark all read"
                  className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={onClearAll}
                  title="Clear all"
                  className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-border/40">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "flex-1 py-1.5 text-[11px] font-medium transition-colors",
                  filter === f
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {f === "all" ? "All" : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "340px" }}>
            {loading ? (
              <div className="p-4 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse flex gap-3">
                    <div className="h-7 w-7 rounded-lg bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-muted" />
                      <div className="h-2.5 w-full rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="h-7 w-7 mb-2 opacity-30" />
                <p className="text-xs">
                  {filter === "unread" ? "No unread notifications" : "No notifications"}
                </p>
              </div>
            ) : (
              displayed.map((n) => (
                <NotifItem
                  key={n._id}
                  notif={n}
                  onRead={onRead}
                  onDismiss={onDismiss}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {displayed.length > 0 && (
            <div className="px-3 py-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {items.length} notification{items.length !== 1 ? "s" : ""}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <Check className="h-2.5 w-2.5" /> Mark all read
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
