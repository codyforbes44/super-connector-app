import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => input,
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPushDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPushToUsers } = await import("./push.server");
    const sent = await sendPushToUsers(supabaseAdmin as never, [context.userId], {
      title: "SixVox test alert",
      body: "Push notifications are working on this device.",
      url: "/inbox",
      tag: "sixvox-test",
    });
    return { sent };
  });

export type PushAlertPrefs = {
  push_esim_ready: boolean;
  push_esim_failed: boolean;
};

export const getPushAlertPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PushAlertPrefs> => {
    const { data } = await context.supabase
      .from("notification_prefs")
      .select("push_esim_ready, push_esim_failed")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      push_esim_ready: data?.push_esim_ready ?? true,
      push_esim_failed: data?.push_esim_failed ?? true,
    };
  });

export const savePushAlertPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<PushAlertPrefs>) => input)
  .handler(async ({ context, data }) => {
    const patch: Partial<PushAlertPrefs> = {};
    if (typeof data.push_esim_ready === "boolean") patch.push_esim_ready = data.push_esim_ready;
    if (typeof data.push_esim_failed === "boolean") patch.push_esim_failed = data.push_esim_failed;
    const { error } = await context.supabase
      .from("notification_prefs")
      .upsert({ user_id: context.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });