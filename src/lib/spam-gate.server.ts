import type { SupabaseClient } from "@supabase/supabase-js";

import { scoreSpam, type SpamDecision } from "./spam/score";
import { normalizePhone, twilioRequest } from "./twilio.server";

const CACHE_MS = 14 * 24 * 60 * 60 * 1000;

async function cachedLineType(
  admin: SupabaseClient,
  phone: string,
): Promise<string | null | undefined> {
  const { data } = await admin
    .from("caller_line_cache")
    .select("line_type, looked_up_at")
    .eq("phone_number", phone)
    .maybeSingle();
  if (!data) return undefined;
  const lookedUp = new Date(data.looked_up_at as string).getTime();
  if (Date.now() - lookedUp > CACHE_MS) return undefined;
  return (data.line_type as string | null) ?? null;
}

/** Twilio Lookup line type. Failures return null so a Lookup outage does not drop the call. */
export async function lookupLineType(phone: string): Promise<string | null> {
  try {
    const res = await twilioRequest<{ line_type_intelligence?: { type?: string } | null }>({
      host: "lookups",
      path: `/v2/PhoneNumbers/${encodeURIComponent(phone)}`,
      params: { Fields: "line_type_intelligence" },
    });
    return res.line_type_intelligence?.type ?? null;
  } catch (error) {
    console.error("lookup line type failed", error);
    return null;
  }
}

/**
 * Decide whether an inbound call may ring the owner or reach the AI.
 * Known spam returns ring: false. The voice webhook must stop there.
 */
export async function gateInboundCall(
  admin: SupabaseClient,
  input: {
    from: string;
    appNumber: string;
    stirVerstat: string;
    callSid: string;
    assignedTo: string | null;
  },
): Promise<SpamDecision & { lineType: string | null }> {
  const from = normalizePhone(input.from);
  let allowListed = false;
  let blockListed = false;
  if (input.assignedTo) {
    const { data: lists } = await admin
      .from("caller_lists")
      .select("list")
      .eq("user_id", input.assignedTo)
      .eq("phone_number", from);
    for (const row of lists ?? []) {
      if (row.list === "allow") allowListed = true;
      if (row.list === "block") blockListed = true;
    }
  }

  let lineType: string | null = null;
  if (!allowListed && !blockListed) {
    const cached = await cachedLineType(admin, from);
    lineType = cached === undefined ? await lookupLineType(from) : cached;
    if (cached === undefined) {
      await admin.from("caller_line_cache").upsert({
        phone_number: from,
        line_type: lineType,
        looked_up_at: new Date().toISOString(),
      });
    }
  }

  const decision = scoreSpam({
    stirVerstat: input.stirVerstat,
    lineType,
    allowListed,
    blockListed,
  });

  await admin
    .from("calls")
    .update({
      spam_score: decision.score,
      spam_action: decision.action,
      spam_reason: decision.reason,
      stir_verstat: input.stirVerstat || null,
      line_type: lineType,
      ...(decision.ring ? {} : { status: "blocked", answer_path: "spam" }),
    })
    .eq("sid", input.callSid);

  return { ...decision, lineType };
}
