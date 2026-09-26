/**
 * Delivery path for review requests and payment links.
 * The shared automated-text gate decides opt-out, campaign readiness,
 * quiet hours, and consent. This module adds the inbox row after a send.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadAutomatedTextDeps,
  sendAutomatedText as deliverLineText,
} from "@/lib/automated-text.server";

import {
  canSendAutomatedText,
  type AutomatedBlockReason,
  type AutomatedSendInput,
} from "./automated-text";

type SB = SupabaseClient;

const BLOCKS = new Set<AutomatedBlockReason>([
  "opted_out",
  "not_registered",
  "duplicate",
  "cooldown",
  "quiet_hours",
  "no_consent",
]);

function asBlock(reason: string): AutomatedBlockReason {
  return BLOCKS.has(reason as AutomatedBlockReason)
    ? (reason as AutomatedBlockReason)
    : "not_registered";
}

export async function sendAutomatedText(
  admin: SB,
  input: AutomatedSendInput & {
    userId: string | null;
    workspaceId: string | null;
    conversationId: string;
    appNumber: string;
    to: string;
    body: string;
  },
): Promise<{ sent: true; sid: string } | { sent: false; reason: AutomatedBlockReason }> {
  const kind = input.kind ?? "automated";
  const loaded = await loadAutomatedTextDeps(admin, input.to, input.appNumber, kind);
  const decision = canSendAutomatedText({
    ...input,
    to: input.to,
    from: input.appNumber,
    kind,
    optedOut: input.optedOut || loaded.optedOut,
    messagingServiceSid: input.messagingServiceSid ?? loaded.messagingServiceSid,
    textingReady: input.textingReady && loaded.campaignReady,
    complianceQuietHours: input.complianceQuietHours || loaded.quietHours,
    hasConsent: input.hasConsent ?? loaded.hasConsent,
  });
  if (!decision.allow) return { sent: false, reason: decision.reason };

  const sent = await deliverLineText({
    to: input.to,
    from: input.appNumber,
    body: input.body,
    deps: {
      optedOut: false,
      messagingServiceSid: decision.messagingServiceSid,
      campaignReady: true,
      quietHours: false,
      hasConsent: true,
      kind: "automated",
    },
  });
  if (!sent.ok) return { sent: false, reason: asBlock(sent.reason) };

  if (!input.workspaceId) {
    console.error("automated text not stored, no workspace", input.appNumber);
    return { sent: true, sid: sent.sid };
  }
  await admin.from("messages").insert({
    conversation_id: input.conversationId,
    sid: sent.sid,
    direction: "outbound",
    channel: "sms",
    from_number: input.appNumber,
    to_number: input.to,
    body: input.body,
    status: sent.status,
    sent_by: input.userId,
    workspace_id: input.workspaceId,
  });
  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: input.body.slice(0, 140),
    })
    .eq("id", input.conversationId);

  return { sent: true, sid: sent.sid };
}
