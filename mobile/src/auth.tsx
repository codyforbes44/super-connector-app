import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/api";
import { previewMode, supabaseConfig } from "@/config";
import { previewBootstrap } from "@/preview-data";
import { getSupabase, signInWithGoogle as googleSignIn, supabaseConfigured } from "@/supabase";
import type { Bootstrap } from "@/types";

type AuthValue = {
  ready: boolean;
  token: string | null;
  email: string | null;
  configured: boolean;
  account: Bootstrap | null;
  accountError: string | null;
  refreshAccount: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [previewSignedOut, setPreviewSignedOut] = useState(false);
  const [account, setAccount] = useState<Bootstrap | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    if (previewMode()) {
      setReady(true);
      return;
    }
    if (!supabaseConfigured()) {
      setReady(true);
      return;
    }
    const supabase = getSupabase();
    let active = true;
    const apply = (session: Session | null) => {
      if (!active) return;
      setToken(session?.access_token ?? null);
      setEmail(session?.user.email ?? null);
      setReady(true);
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const effectiveToken = previewMode() ? (previewSignedOut ? null : "preview") : token;
  const effectiveEmail = previewMode()
    ? previewSignedOut
      ? null
      : (previewBootstrap.profile?.email ?? null)
    : email;

  const refreshAccount = useCallback(async () => {
    if (!effectiveToken) {
      setAccount(null);
      return;
    }
    if (previewMode()) {
      setAccount(previewBootstrap);
      setAccountError(null);
      return;
    }
    try {
      setAccount(await api.bootstrap(effectiveToken));
      setAccountError(null);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Could not load your account.");
    }
  }, [effectiveToken]);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  const signIn = useCallback(async (nextEmail: string, password: string) => {
    if (previewMode()) {
      setPreviewSignedOut(false);
      return;
    }
    const { error } = await getSupabase().auth.signInWithPassword({
      email: nextEmail.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (previewMode()) {
      setPreviewSignedOut(false);
      return;
    }
    await googleSignIn();
  }, []);

  const signOut = useCallback(async () => {
    if (previewMode()) {
      setPreviewSignedOut(true);
      setAccount(null);
      return;
    }
    if (supabaseConfigured()) await getSupabase().auth.signOut();
    setToken(null);
    setEmail(null);
    setAccount(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      token: effectiveToken,
      email: effectiveEmail,
      configured: previewMode() || supabaseConfig() !== null,
      account,
      accountError,
      refreshAccount,
      signIn,
      signInWithGoogle,
      signOut,
    }),
    [
      ready,
      effectiveToken,
      effectiveEmail,
      account,
      accountError,
      refreshAccount,
      signIn,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
