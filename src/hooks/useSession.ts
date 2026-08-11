import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type SessionStatus = "loading" | "signedIn" | "signedOut";

export type SessionState = {
  session: Session | null;
  user: User | null;
  status: SessionStatus;
};

/**
 * Single source of truth for "is this device signed in?".
 *
 * Reads the persisted session first (so an installed/offline app keeps its
 * signed-in state without a network round trip), then stays in sync with
 * Supabase auth events for the lifetime of the component.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    const apply = (session: Session | null) => {
      if (!active) return;
      setState({
        session,
        user: session?.user ?? null,
        status: session ? "signedIn" : "signedOut",
      });
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    void supabase.auth.getSession().then(({ data: result }) => apply(result.session));

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** Same-origin path guard for `redirect` search params. */
export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}