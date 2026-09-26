import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID =
  (import.meta.env["VITE_SUPABASE_PROJECT_ID"] as string | undefined) ??
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.match(
    /https:\/\/([^.]+)\.supabase\./,
  )?.[1] ??
  "";

/** Where supabase-js persists the session (localStorage, per the generated client). */
const SESSION_KEY = `sb-${PROJECT_ID}-auth-token`;
const REMEMBER_KEY = "sixvox.auth.remember";

/** Refresh this far ahead of expiry so a request never rides an expired token. */
const REFRESH_MARGIN_SECONDS = 120;

function hasWindow() {
  return typeof window !== "undefined";
}

export function isRemembered(): boolean {
  if (!hasWindow()) return true;
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * "Remember me" off = session lives in sessionStorage only, so it dies with the
 * tab/browser. The generated Supabase client always writes localStorage, so we
 * mirror that value into sessionStorage and evict the localStorage copy on the
 * next cold start.
 */
export function setRememberMe(remember: boolean) {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
    if (remember) sessionStorage.removeItem(SESSION_KEY);
    else mirrorSession();
  } catch {
    /* storage unavailable (private mode) — nothing to mirror */
  }
}

function mirrorSession() {
  if (!hasWindow() || isRemembered()) return;
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (value) sessionStorage.setItem(SESSION_KEY, value);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Runs before the Supabase client reads storage: restores a not-remembered
 * session for this tab, or drops it entirely on a fresh browser start.
 */
export function primeSessionPersistence() {
  if (!hasWindow()) return;
  try {
    if (isRemembered()) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const mirrored = sessionStorage.getItem(SESSION_KEY);
    if (mirrored) localStorage.setItem(SESSION_KEY, mirrored);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function expiresInSeconds(expiresAt?: number) {
  if (!expiresAt) return Number.POSITIVE_INFINITY;
  return expiresAt - Math.floor(Date.now() / 1000);
}

/**
 * Keeps the access token fresh across the events supabase-js's internal timer
 * can miss on mobile: a backgrounded tab whose timers were throttled, a device
 * waking from sleep, and returning from offline.
 */
export function startSessionKeeper(): () => void {
  if (!hasWindow()) return () => {};

  let refreshing = false;

  const refreshIfStale = async (force = false) => {
    if (refreshing) return;
    refreshing = true;
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;
      if (!force && expiresInSeconds(session.expires_at) > REFRESH_MARGIN_SECONDS) return;
      const { error } = await supabase.auth.refreshSession();
      if (!error) return;
      // Only a rejected refresh token is terminal; network failures retry later.
      if (navigator.onLine) {
        toast.error("Your session expired. Please sign in again.");
        await supabase.auth.signOut();
      }
    } catch {
      /* offline or transient — the next wake-up retries */
    } finally {
      refreshing = false;
    }
  };

  const onVisibility = () => {
    if (document.visibilityState !== "visible") return;
    supabase.auth.startAutoRefresh();
    void refreshIfStale();
  };
  const onOnline = () => void refreshIfStale();
  const onFocus = () => void refreshIfStale();
  const onPageShow = (event: PageTransitionEvent) => {
    // bfcache restore: timers were frozen, so the token may already be stale.
    if (event.persisted) void refreshIfStale();
  };

  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      mirrorSession();
    }
    if (event === "SIGNED_OUT") {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
    }
  });

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onFocus);
  window.addEventListener("pageshow", onPageShow);
  supabase.auth.startAutoRefresh();
  void refreshIfStale();

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pageshow", onPageShow);
    data.subscription.unsubscribe();
  };
}
