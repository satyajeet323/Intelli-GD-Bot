/**
 * useNotifications — Real-time notification state for the user dashboard.
 * Connects to Socket.io for live delivery and syncs with the REST API.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { notifications as notifApi, type UserNotification } from "@/lib/api";
import { getToken } from "@/lib/api";

const SERVER_URL = (import.meta.env.VITE_SERVER_URL ?? "").replace(/\/$/, "");

export function useNotifications(enabled = true) {
  const [items, setItems]           = useState<UserNotification[]>([]);
  const [unreadCount, setUnread]    = useState(0);
  const [loading, setLoading]       = useState(false);
  const [bannerNotif, setBanner]    = useState<UserNotification | null>(null);
  const socketRef                   = useRef<Socket | null>(null);

  // ── Load from API ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!enabled || !getToken()) return;
    setLoading(true);
    try {
      const res = await notifApi.list({ limit: 50 });
      setItems(res.notifications);
      setUnread(res.unreadCount);

      // Show banner for highest-priority unread banner notification
      const banner = res.notifications.find(
        (n) => n.isBanner && !n.isRead && !n.isDismissed &&
               (n.priority === "critical" || n.priority === "high")
      );
      if (banner) setBanner(banner);
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) load();
  }, [load, enabled]);

  // ── Socket.io real-time ────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("notification", (payload: Omit<UserNotification, "isRead" | "isDismissed" | "readAt" | "deliveredAt">) => {
      const newNotif: UserNotification = {
        ...payload,
        isRead:      false,
        isDismissed: false,
        readAt:      null,
        deliveredAt: new Date().toISOString(),
      };

      setItems((prev) => {
        // Avoid duplicates
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        return [newNotif, ...prev];
      });
      setUnread((c) => c + 1);

      // Show banner for high/critical banner notifications
      if (newNotif.isBanner && (newNotif.priority === "critical" || newNotif.priority === "high")) {
        setBanner(newNotif);
      }
    });

    socket.on("notification-removed", ({ id }: { id: string }) => {
      setItems((prev) => prev.filter((n) => n._id !== id));
      setBanner((b) => (b?._id === id ? null : b));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
    );
    setUnread((c) => Math.max(0, c - 1));
    await notifApi.markRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    setUnread(0);
    await notifApi.markAllRead().catch(() => {});
  }, []);

  const dismiss = useCallback(async (id: string) => {
    const notif = items.find((n) => n._id === id);
    setItems((prev) => prev.filter((n) => n._id !== id));
    if (notif && !notif.isRead) setUnread((c) => Math.max(0, c - 1));
    if (bannerNotif?._id === id) setBanner(null);
    await notifApi.dismiss(id).catch(() => {});
  }, [items, bannerNotif]);

  const clearAll = useCallback(async () => {
    setItems([]);
    setUnread(0);
    setBanner(null);
    await notifApi.clearAll().catch(() => {});
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerNotif) dismiss(bannerNotif._id);
    else setBanner(null);
  }, [bannerNotif, dismiss]);

  return {
    items,
    unreadCount,
    loading,
    bannerNotif,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
    dismissBanner,
    reload: load,
  };
}
