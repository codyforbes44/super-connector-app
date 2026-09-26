import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateAutomatedText } from "@/lib/automated-text";
import { loadAutomatedTextDeps, sendAutomatedText } from "@/lib/automated-text.server";

/**
 * Booking confirmation, reschedule, and cancel texts. The shared gate honors
 * STOP, quiet hours, and an approved Messaging Service campaign.
 */
export async function sendLineSms(
  admin: SupabaseClient,
  input: { appNumber: string; to: string; body: string; messagingServiceSid?: string | null },
): Promise<{
  sent: boolean;
  reason?: "not_registered" | "opted_out" | "quiet_hours" | "error";
  sid?: string;
}> {
  const loaded = await loadAutomatedTextDeps(admin, input.to, input.appNumber, "automated");
  const messagingServiceSid = loaded.messagingServiceSid ?? input.messagingServiceSid ?? null;
  const gate = evaluateAutomatedText({
    to: input.to,
    from: input.appNumber,
    optedOut: loaded.optedOut,
    messagingServiceSid,
    campaignReady: loaded.campaignReady && Boolean(messagingServiceSid),
    quietHours: loaded.quietHours,
    kind: "automated",
    hasConsent: true,
  });
  if (!gate.ok) {
    if (gate.reason === "opted_out") return { sent: false, reason: "opted_out" };
    if (gate.reason === "quiet_hours") return { sent: false, reason: "quiet_hours" };
    return { sent: false, reason: "not_registered" };
  }

  try {
    const sent = await sendAutomatedText({
      to: input.to,
      from: input.appNumber,
      body: input.body,
      deps: {
        optedOut: false,
        messagingServiceSid: gate.messagingServiceSid,
        campaignReady: true,
        quietHours: false,
        hasConsent: true,
        kind: "automated",
      },
    });
    if (!sent.ok) return { sent: false, reason: "not_registered" };
    return { sent: true, sid: sent.sid };
  } catch (error) {
    console.error("automated sms failed", error);
    return { sent: false, reason: "error" };
  }
}
