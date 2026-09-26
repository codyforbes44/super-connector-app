import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export type MobileAuth =
  | { ok: true; supabase: SupabaseClient<Database>; userId: string }
  | { ok: false; response: Response };

export function mobileJson(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

/** Bearer session for /api/mobile. Same Supabase project as the web app. */
export async function authenticateMobileRequest(request: Request): Promise<MobileAuth> {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !publishableKey) {
    return {
      ok: false,
      response: mobileJson({ ok: false, error: "Supabase is not configured." }, 500),
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: mobileJson({ ok: false, error: "Sign in required." }, 401) };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) {
    return { ok: false, response: mobileJson({ ok: false, error: "Sign in required." }, 401) };
  }

  const supabase = createClient<Database>(supabaseUrl, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { ok: false, response: mobileJson({ ok: false, error: "Sign in required." }, 401) };
  }

  return { ok: true, supabase, userId: data.claims.sub };
}
