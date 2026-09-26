import type { SupabaseClient } from "@supabase/supabase-js";

import { audit } from "@/lib/app.server";
import { normalizePhone, stripChannel } from "@/lib/twilio.server";

import { assertAiOutboundConsent, latestAiConsent, type AiConsentRow } from "./ai-consent";

type SB = SupabaseClient;

async function adminClient(): Promise<SB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SB;
}

export async function hasAiVoiceConsent(admin: SB, phoneNumber: string): Promise<boolean> {
  const phone = stripChannel(normalizePhone(phoneNumber));
  const { data, error } = await admin
    .from("ai_voice_consents")
    .select("phone_number, consented, recorded_at")
    .eq("phone_number", phone)
    .order("recorded_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const rows: AiConsentRow[] = (data ?? []).map((row) => ({
    phoneNumber: String(row["phone_number"]),
    consented: Boolean(row["consented"]),
    recordedAt: String(row["recorded_at"]),
  }));
  return latestAiConsent(rows);
}

export async function recordAiVoiceConsent(
  userId: string,
  input: { phoneNumber: string; consented: boolean; source: string },
) {
  const admin = await adminClient();
  const phone = stripChannel(normalizePhone(input.phoneNumber));
  const { error } = await admin.from("ai_voice_consents").insert({
    phone_number: phone,
    consented: input.consented,
    source: input.source,
    recorded_by: userId,
  });
  if (error) throw new Error(error.message);
  await audit(admin, userId, "ai.voice.consent", {
    phone_number: phone,
    consented: input.consented,
    source: input.source,
  });
  return { ok: true as const };
}

/**
 * The only supported entry point for an outbound AI voice call.
 * Refuses without a consent row. Does not dial: there is no outbound AI
 * caller in the product yet, and this release must not place calls.
 */
export async function placeOutboundAiCall(
  userId: string,
  input: { to: string },
): Promise<{ placed: false; reason: string }> {
  const admin = await adminClient();
  const consented = await hasAiVoiceConsent(admin, input.to);
  assertAiOutboundConsent(consented);
  await audit(admin, userId, "ai.voice.outbound.blocked", {
    to: stripChannel(normalizePhone(input.to)),
    reason: "consent_present_but_outbound_ai_not_enabled",
  });
  return {
    placed: false,
    reason:
      "Prior consent is on file, but SixVox does not place outbound AI calls in this release.",
  };
}
