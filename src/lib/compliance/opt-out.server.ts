import type { SupabaseClient } from "@supabase/supabase-js";

import { audit } from "@/lib/app.server";
import { normalizePhone, stripChannel } from "@/lib/twilio.server";

import {
  decideSend,
  resolveInboundSignal,
  type KeywordSignal,
  type QuietHours,
  type SendKind,
} from "./opt-out";

type SB = SupabaseClient;

export async function recordInboundKeyword(
  admin: SB,
  input: {
    from: string;
    body: string;
    optOutType?: string | null;
    messagingServiceSid?: string | null;
    workspaceId?: string | null;
  },
): Promise<KeywordSignal | null> {
  const signal = resolveInboundSignal(input.body, input.optOutType);
  if (!signal) return null;
  const phone = stripChannel(normalizePhone(input.from));
  const optedOut = signal === "stop";
  if (signal === "stop" || signal === "start") {
    if (!input.workspaceId) {
      const { logWebhookError } = await import("@/lib/webhook-errors.server");
      await logWebhookError(admin, {
        source: "sms",
        message: `no workspace for inbound opt-out from ${phone}`,
      });
    } else {
      const { error } = await admin.from("sms_opt_outs").upsert(
        {
          phone_number: phone,
          opted_out: optedOut,
          keyword: input.body.trim().slice(0, 32) || signal,
          source: input.optOutType ? "opt_out_type" : "inbound_keyword",
          messaging_service_sid: input.messagingServiceSid ?? null,
          updated_at: new Date().toISOString(),
          workspace_id: input.workspaceId,
        },
        { onConflict: "phone_number" },
      );
      if (error) throw new Error(error.message);
    }
  }
  if (input.optOutType && input.messagingServiceSid && input.workspaceId) {
    await admin.from("messaging_opt_out_prefs").upsert(
      {
        messaging_service_sid: input.messagingServiceSid,
        detected_opt_out_type_at: new Date().toISOString(),
        workspace_id: input.workspaceId,
      },
      { onConflict: "messaging_service_sid" },
    );
  }
  await audit(
    admin,
    null,
    `sms.keyword.${signal}`,
    {
      phone_number: phone,
      opt_out_type: input.optOutType ?? null,
    },
    input.workspaceId,
  );
  return signal;
}

async function quietHoursFor(admin: SB, userId: string): Promise<QuietHours | null> {
  const { data, error } = await admin
    .from("sms_quiet_hours")
    .select("enabled, quiet_start, quiet_end, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    enabled: Boolean(data["enabled"]),
    quietStart: String(data["quiet_start"] ?? "21:00"),
    quietEnd: String(data["quiet_end"] ?? "08:00"),
    timezone: String(data["timezone"] ?? "America/Chicago"),
  };
}

async function hasPurposeConsent(
  admin: SB,
  phone: string,
  purpose: "review" | "marketing",
): Promise<boolean> {
  const { data, error } = await admin
    .from("sms_consent_log")
    .select("consented, recorded_at")
    .eq("phone_number", phone)
    .eq("purpose", purpose)
    .order("recorded_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.["consented"] === true;
}

/** Throws when this send must not leave the app. */
export async function assertSendAllowed(
  admin: SB,
  userId: string,
  input: { to: string; kind: SendKind },
): Promise<void> {
  const phone = stripChannel(normalizePhone(input.to));
  const { data, error } = await admin
    .from("sms_opt_outs")
    .select("opted_out")
    .eq("phone_number", phone)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const purpose = input.kind === "review" || input.kind === "marketing" ? input.kind : null;
  const decision = decideSend({
    kind: input.kind,
    optedOut: Boolean(data?.["opted_out"]),
    quiet: await quietHoursFor(admin, userId),
    hasConsent: purpose ? await hasPurposeConsent(admin, phone, purpose) : true,
  });
  if (!decision.ok) throw new Error(decision.reason);
}

export async function saveQuietHours(
  userId: string,
  input: { enabled: boolean; quietStart: string; quietEnd: string; timezone: string },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SB;
  const { requireWorkspace } = await import("@/lib/workspace.server");
  const workspace = await requireWorkspace(userId);
  const { error } = await admin.from("sms_quiet_hours").upsert(
    {
      user_id: userId,
      enabled: input.enabled,
      quiet_start: input.quietStart,
      quiet_end: input.quietEnd,
      timezone: input.timezone,
      workspace_id: workspace.id,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  await audit(admin, userId, "sms.quiet_hours", input as unknown as Record<string, unknown>);
  return { ok: true as const };
}

export async function getQuietHours(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SB;
  const row = await quietHoursFor(admin, userId);
  return (
    row ?? {
      enabled: false,
      quietStart: "21:00",
      quietEnd: "08:00",
      timezone: "America/Chicago",
    }
  );
}

export async function recordSmsConsent(
  userId: string,
  input: {
    phoneNumber: string;
    purpose: "review" | "marketing";
    consented: boolean;
    source: string;
  },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SB;
  const { requireWorkspace } = await import("@/lib/workspace.server");
  const workspace = await requireWorkspace(userId);
  const phone = stripChannel(normalizePhone(input.phoneNumber));
  const { error } = await admin.from("sms_consent_log").insert({
    phone_number: phone,
    purpose: input.purpose,
    consented: input.consented,
    source: input.source,
    recorded_by: userId,
    workspace_id: workspace.id,
  });
  if (error) throw new Error(error.message);
  await audit(admin, userId, "sms.consent", {
    phone_number: phone,
    purpose: input.purpose,
    consented: input.consented,
  });
  return { ok: true as const };
}

/**
 * Twilio's public Messaging Service update API has no Advanced Opt-Out field.
 * Enabling it is a Console action (Messaging Service → Opt-out). Once it is on,
 * inbound webhooks include OptOutType and recordInboundKeyword stores it.
 * This only records that the owner confirmed the Console step. It does not
 * create or change a Twilio resource.
 */
export async function confirmAdvancedOptOut(userId: string, messagingServiceSid: string) {
  if (!/^MG[0-9a-fA-F]{32}$/.test(messagingServiceSid)) {
    throw new Error("That is not a Messaging Service SID.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SB;
  const { requireWorkspace } = await import("@/lib/workspace.server");
  const workspace = await requireWorkspace(userId);
  const { error } = await admin.from("messaging_opt_out_prefs").upsert(
    {
      messaging_service_sid: messagingServiceSid,
      owner_confirmed_at: new Date().toISOString(),
      workspace_id: workspace.id,
    },
    { onConflict: "messaging_service_sid" },
  );
  if (error) throw new Error(error.message);
  await audit(admin, userId, "sms.advanced_opt_out.confirm", {
    messaging_service_sid: messagingServiceSid,
    api: "console-only",
  });
  return {
    ok: true as const,
    apiEnableSupported: false as const,
    note: "Twilio's Messaging Service REST API cannot enable Advanced Opt-Out. Turn it on under the service's Opt-out tab. Inbound OptOutType values are stored here.",
  };
}
