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
  type AutomatedTextKind,
  type AutomatedTextVerdict,
} from "@/lib/automated-text";
import { isQuietHours, type QuietHours } from "@/lib/compliance/opt-out";
import { webhookUrl } from "@/lib/app.server";
import { normalizePhone, stripChannel, twilioRequest } from "@/lib/twilio.server";

export type AutomatedTextDeps = {
  optedOut?: boolean;
  messagingServiceSid?: string | null;
  campaignReady?: boolean;
  quietHours?: boolean;
  hasConsent?: boolean;
  kind?: AutomatedTextKind;
};

export async function canSendAutomatedText(
  to: string,
  from: string,
  deps?: AutomatedTextDeps,
): Promise<AutomatedTextVerdict> {
  const contact = normalizePhone(to);
  const line = normalizePhone(from);
  const kind = deps?.kind ?? "automated";

  let optedOut = deps?.optedOut ?? false;
  let messagingServiceSid = deps?.messagingServiceSid ?? null;
  let ready = deps?.campaignReady ?? false;
  let quietHours = deps?.quietHours ?? false;
  let hasConsent = deps?.hasConsent ?? (kind !== "review" && kind !== "marketing");

  if (!deps) {
    const loaded = await loadAutomatedTextDeps(supabaseAdmin, contact, line, kind);
    optedOut = loaded.optedOut;
    messagingServiceSid = loaded.messagingServiceSid;
    ready = loaded.campaignReady;
    quietHours = loaded.quietHours;
    hasConsent = loaded.hasConsent;
  }

  const verdict = evaluateAutomatedText({
    to: contact,
    from: line,
    optedOut,
    messagingServiceSid,
    campaignReady: ready,
    quietHours,
    kind,
    hasConsent,
  });
  return applyAutomatedTextChecks(contact, line, verdict);
}

export async function loadAutomatedTextDeps(
  admin: SupabaseClient,
  to: string,
  from: string,
  kind: AutomatedTextKind = "automated",
): Promise<Required<Omit<AutomatedTextDeps, "kind">>> {
  const phone = stripChannel(to);
  const [{ data: convo }, { data: number }, { data: opt }] = await Promise.all([
    admin
      .from("conversations")
      .select("opted_out")
      .eq("channel", "sms")
      .eq("app_number", from)
      .eq("contact_number", to)
      .maybeSingle(),
    admin
      .from("phone_numbers")
      .select("messaging_service_sid, campaign_status, assigned_to")
      .eq("phone_number", from)
      .maybeSingle(),
    admin.from("sms_opt_outs").select("opted_out").eq("phone_number", phone).maybeSingle(),
  ]);

  const userId = (number?.assigned_to as string | null) ?? null;
  let quietHours = false;
  if (userId && kind !== "manual") {
    const { data: quiet } = await admin
      .from("sms_quiet_hours")
      .select("enabled, quiet_start, quiet_end, timezone")
      .eq("user_id", userId)
      .maybeSingle();
    if (quiet) {
      const row: QuietHours = {
        enabled: Boolean(quiet.enabled),
        quietStart: String(quiet.quiet_start ?? "21:00"),
        quietEnd: String(quiet.quiet_end ?? "08:00"),
        timezone: String(quiet.timezone ?? "America/Chicago"),
      };
      quietHours = isQuietHours(row);
    }
  }

  let hasConsent = true;
  if (kind === "review" || kind === "marketing") {
    const { data: consent } = await admin
      .from("sms_consent_log")
      .select("consented")
      .eq("phone_number", phone)
      .eq("purpose", kind)
      .order("recorded_at", { ascending: false })
      .limit(1);
    hasConsent = consent?.[0]?.consented === true;
  }

  return {
    optedOut: Boolean(convo?.opted_out) || Boolean(opt?.opted_out),
    messagingServiceSid: (number?.messaging_service_sid as string | null) ?? null,
    campaignReady: campaignReady((number?.campaign_status as string | null) ?? null),
    quietHours,
    hasConsent,
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
