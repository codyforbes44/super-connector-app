/**
 * Automated SMS sends. `canSendAutomatedText` is the single gate: it honors
 * conversations.opted_out and refuses unregistered lines. Phase 2 adds quiet
 * hours and the opt-out table with `registerAutomatedTextCheck`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applyAutomatedTextChecks,
  campaignReady,
  evaluateAutomatedText,
  type AutomatedTextVerdict,
} from "@/lib/automated-text";
import { webhookUrl } from "@/lib/app.server";
import { normalizePhone, twilioRequest } from "@/lib/twilio.server";

export type AutomatedTextDeps = {
  optedOut?: boolean;
  messagingServiceSid?: string | null;
  campaignReady?: boolean;
};

export async function canSendAutomatedText(
  to: string,
  from: string,
  deps?: AutomatedTextDeps,
): Promise<AutomatedTextVerdict> {
  const contact = normalizePhone(to);
  const line = normalizePhone(from);

  let optedOut = deps?.optedOut ?? false;
  let messagingServiceSid = deps?.messagingServiceSid ?? null;
  let ready = deps?.campaignReady ?? false;

  if (!deps) {
    const loaded = await loadAutomatedTextDeps(supabaseAdmin, contact, line);
    optedOut = loaded.optedOut;
    messagingServiceSid = loaded.messagingServiceSid;
    ready = loaded.campaignReady;
  }

  const verdict = evaluateAutomatedText({
    to: contact,
    from: line,
    optedOut,
    messagingServiceSid,
    campaignReady: ready,
  });
  return applyAutomatedTextChecks(contact, line, verdict);
}

export async function loadAutomatedTextDeps(
  admin: SupabaseClient,
  to: string,
  from: string,
): Promise<Required<AutomatedTextDeps>> {
  const { data: convo } = await admin
    .from("conversations")
    .select("opted_out")
    .eq("channel", "sms")
    .eq("app_number", from)
    .eq("contact_number", to)
    .maybeSingle();
  const { data: number } = await admin
    .from("phone_numbers")
    .select("messaging_service_sid, campaign_status")
    .eq("phone_number", from)
    .maybeSingle();
  return {
    optedOut: Boolean(convo?.opted_out),
    messagingServiceSid: number?.messaging_service_sid ?? null,
    campaignReady: campaignReady(number?.campaign_status ?? null),
  };
}

type SendFn = (args: {
  to: string;
  from: string;
  body: string;
  messagingServiceSid: string;
}) => Promise<{ sid: string; status: string }>;

/**
 * Twilio: pass MessagingServiceSid so the message rides the A2P campaign.
 * From is the line itself and must already sit in that service's sender pool
 * (error 21711 otherwise). https://www.twilio.com/docs/messaging/tutorials/send-messages-with-messaging-services
 */
async function sendViaMessagingService(args: {
  to: string;
  from: string;
  body: string;
  messagingServiceSid: string;
}): Promise<{ sid: string; status: string }> {
  return twilioRequest<{ sid: string; status: string }>({
    method: "POST",
    path: "/Messages.json",
    params: {
      To: args.to,
      From: args.from,
      MessagingServiceSid: args.messagingServiceSid,
      Body: args.body,
      StatusCallback: webhookUrl("status"),
    },
  });
}

export async function sendAutomatedText(input: {
  to: string;
  from: string;
  body: string;
  deps?: AutomatedTextDeps;
  send?: SendFn;
}): Promise<{ ok: true; sid: string; status: string } | { ok: false; reason: string }> {
  const gate = await canSendAutomatedText(input.to, input.from, input.deps);
  if (!gate.ok) return gate;
  if (process.env["VITEST"] && !input.send) {
    throw new Error("Refusing to call Twilio from a test.");
  }
  const send = input.send ?? sendViaMessagingService;
  const sent = await send({
    to: normalizePhone(input.to),
    from: normalizePhone(input.from),
    body: input.body,
    messagingServiceSid: gate.messagingServiceSid,
  });
  return { ok: true, sid: sent.sid, status: sent.status };
}
