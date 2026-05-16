/**
 * usePageFocus — fires a callback whenever the browser tab becomes visible
 * OR when the document receives a custom "page-active" event.
 *
 * Used to refetch stale data when the user returns to the dashboard or
 * history page after completing a session in another tab/route.
 */

import { useEffect } from "react";

export function usePageFocus(callback: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") callback();
    };
    document.addEventListener("visibilitychange", handler);
    // Also listen for the custom event fired after peer rating submission
    document.addEventListener("session-ended", callback as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", handler);
      document.removeEventListener("session-ended", callback as EventListener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
