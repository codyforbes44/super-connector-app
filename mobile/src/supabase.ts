import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { previewMode, supabaseConfig } from "./config";
import { authStorage } from "./storage";

WebBrowser.maybeCompleteAuthSession();

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const config = supabaseConfig();
  if (!config) {
    throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  client = createClient(config.url, config.publishableKey, {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function supabaseConfigured(): boolean {
  return previewMode() || supabaseConfig() !== null;
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = getSupabase();
  const redirectTo = Linking.createURL("auth/callback");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Google sign-in did not return a URL.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") throw new Error("Google sign-in was cancelled.");
  const parsed = new URL(result.url);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token") ?? parsed.searchParams.get("access_token");
  const refreshToken = hash.get("refresh_token") ?? parsed.searchParams.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error("Google sign-in did not return a session. Add this redirect in Supabase: " + redirectTo);
  }
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
}
