/**
 * useCurrentUser — singleton user cache.
 *
 * Fetches /api/auth/me exactly ONCE per page load and shares the result
 * across every component that calls this hook. No external state library
 * needed — a module-level promise acts as the cache.
 *
 * Usage:
 *   const { user, loading } = useCurrentUser();
 */

import { useState, useEffect } from "react";
import { auth, getToken, type User } from "@/lib/api";

// ── Module-level singleton cache ──────────────────────────────────────────────
// One in-flight promise shared by all hook instances.
// Cleared on logout so the next login gets a fresh fetch.

let _promise: Promise<User | null> | null = null;
let _cached:  User | null = null;
let _listeners: Array<(u: User | null) => void> = [];

function notify(u: User | null) {
  _cached = u;
  _listeners.forEach((fn) => fn(u));
}

/** Fetch once; all callers share the same promise. */
function fetchOnce(): Promise<User | null> {
  if (!getToken()) return Promise.resolve(null);
  if (_cached)     return Promise.resolve(_cached);
  if (_promise)    return _promise;

  _promise = auth
    .me()
    .then((res) => {
      notify(res.user);
      return res.user;
    })
    .catch(() => {
      _promise = null; // allow retry on next mount
      return null;
    });

  return _promise;
}

/** Call this after logout to reset the cache. */
export function clearUserCache() {
  _promise = null;
  _cached  = null;
  notify(null);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCurrentUser(): { user: User | null; loading: boolean } {
  const [user,    setUser]    = useState<User | null>(_cached);
  const [loading, setLoading] = useState<boolean>(!_cached && !!getToken());

  useEffect(() => {
    // Already cached — nothing to do
    if (_cached) {
      setUser(_cached);
      setLoading(false);
      return;
    }

    // No token — skip fetch
    if (!getToken()) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Subscribe to future updates (e.g. another component resolves first)
    const listener = (u: User | null) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    };
    _listeners.push(listener);

    fetchOnce().then((u) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      _listeners = _listeners.filter((fn) => fn !== listener);
    };
  }, []);

  return { user, loading };
}
