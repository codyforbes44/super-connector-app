import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Send the signed-in user their digest right now, using real data. */
export const sendDigestNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendDigestForUser } = await import("./digest.server");
    return sendDigestForUser(supabaseAdmin as never, context.userId, { force: true });
  });

export const getDigestSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("digest_enabled, digest_hour, last_digest_sent_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      enabled: Boolean(data?.["digest_enabled"]),
      hour: (data?.["digest_hour"] as number | null) ?? 8,
      lastSentAt: (data?.["last_digest_sent_at"] as string | null) ?? null,
    };
  });

export const saveDigestSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled?: boolean; hour?: number }) => input)
  .handler(async ({ context, data }) => {
    const patch: { digest_enabled?: boolean; digest_hour?: number } = {};
    if (typeof data.enabled === "boolean") patch.digest_enabled = data.enabled;
    if (typeof data.hour === "number")
      patch.digest_hour = Math.min(23, Math.max(0, Math.round(data.hour)));
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });