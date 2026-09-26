/**
 * Delivery path for automated SMS. Review requests and payment links both
 * call this. Phase 2 / 4a can replace `canSendAutomatedText`; this function
 * is the only place those features talk to Twilio.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { webhookUrl } from "../app.server";
import { twilioRequest } from "../twilio.server";
import {
  canSendAutomatedText,
  type AutomatedBlockReason,
  type AutomatedSendInput,
} from "./automated-text";

type SB = SupabaseClient;

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
  const decision = canSendAutomatedText(input);
  if (!decision.allow) return { sent: false, reason: decision.reason };

  const sent = await twilioRequest<{ sid: string; status: string }>({
    method: "POST",
    path: "/Messages.json",
    params: {
      To: input.to,
      Body: input.body,
      MessagingServiceSid: decision.messagingServiceSid,
      StatusCallback: webhookUrl("status"),
    },
  });

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
