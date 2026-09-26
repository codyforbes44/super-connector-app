/**
 * Missed-call text-back and outbound call events.
 * Invoked from the Twilio status callback and the Dial action URL.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { upsertConversation } from "@/lib/app.server";
import { sendAutomatedText } from "@/lib/automated-text.server";
import {
  DEFAULT_TEXT_BACK_DEDUPE_MINUTES,
  DEFAULT_TEXT_BACK_TEMPLATE,
  isDuplicateTextBack,
  isUnansweredCall,
  missedCallTextDecision,
  renderTextBackTemplate,
  type MissedCallFacts,
} from "@/lib/missed-call";
import { publishOutboundEvent } from "@/lib/outbound-webhooks.server";
import { normalizePhone } from "@/lib/twilio.server";
import { RING_SECONDS } from "@/lib/voice-answer.server";

type LineRow = {
  workspace_id: string | null;
  text_back_enabled: boolean | null;
  text_back_template: string | null;
  text_back_on_ai: boolean | null;
  text_back_on_voicemail: boolean | null;
  text_back_dedupe_minutes: number | null;
  friendly_name: string | null;
};

const TERMINAL = new Set(["completed", "no-answer", "busy", "failed", "canceled"]);

export async function handleInboundCallUpdate(
  admin: SupabaseClient,
  params: Record<string, string>,
  source: "status" | "dial",
): Promise<void> {
  const callSid = params["CallSid"] ?? "";
  if (!callSid) return;

  const dialStatus = params["DialCallStatus"] || null;
  if (dialStatus) {
    await admin.from("calls").update({ dial_status: dialStatus }).eq("sid", callSid);
  }

  const { data: call } = await admin
    .from("calls")
    .select(
      "sid, direction, from_number, to_number, app_number, status, duration, answer_path, recording_url, dial_status",
    )
    .eq("sid", callSid)
    .maybeSingle();
  if (!call) return;

  const direction = (call.direction as string) ?? "";
  const appNumber = (call.app_number as string) ?? "";
  const fromNumber = (call.from_number as string) ?? "";
  const callStatus =
    source === "dial"
      ? params["CallStatus"] || (call.status as string) || ""
      : params["CallStatus"] || (call.status as string) || "";
  const durationRaw = params["CallDuration"] || params["DialCallDuration"] || "";
  const durationSeconds = durationRaw ? Number(durationRaw) : (call.duration as number | null);
  const answerPath = (call.answer_path as string | null) ?? null;
  const effectiveDial = dialStatus ?? (call.dial_status as string | null) ?? null;

  const { data: ai } = await admin
    .from("ai_conversations")
    .select("call_sid")
    .eq("call_sid", callSid)
    .maybeSingle();

  const { data: line } = await admin
    .from("phone_numbers")
    .select(
      "workspace_id, text_back_enabled, text_back_template, text_back_on_ai, text_back_on_voicemail, text_back_dedupe_minutes, friendly_name",
    )
    .eq("phone_number", appNumber)
    .maybeSingle();
  const settings = (line ?? null) as LineRow | null;
  const workspaceId = settings?.workspace_id ?? null;

  const facts: MissedCallFacts = {
    direction,
    callStatus,
    dialStatus: effectiveDial,
    answerPath,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    hasAiConversation: Boolean(ai),
    hasVoicemailRecording: Boolean(call.recording_url) && answerPath !== "ai_agent",
    ringSeconds: RING_SECONDS,
    textBackOnAi: Boolean(settings?.text_back_on_ai),
    textBackOnVoicemail: Boolean(settings?.text_back_on_voicemail),
  };

  const decision = missedCallTextDecision({
    ...facts,
    enabled: Boolean(settings?.text_back_enabled),
  });
  if (direction === "inbound" && decision.send) {
    await sendMissedCallText(admin, {
      callSid,
      appNumber,
      caller: fromNumber,
      lineLabel: settings?.friendly_name || appNumber,
      template: settings?.text_back_template || DEFAULT_TEXT_BACK_TEMPLATE,
      dedupeMinutes: settings?.text_back_dedupe_minutes ?? DEFAULT_TEXT_BACK_DEDUPE_MINUTES,
      workspaceId,
      reason: decision.reason,
    });
  }

  if (direction === "inbound" && isUnansweredCall(facts)) {
    await publishOutboundEvent(admin, {
      type: "call.missed",
      eventId: `call.missed:${callSid}`,
      workspaceId,
      data: {
        call_sid: callSid,
        from: fromNumber,
        to: (call.to_number as string) ?? "",
        app_number: appNumber,
        status: callStatus || effectiveDial || "no-answer",
        dial_status: effectiveDial,
        text_back: decision.send ? decision.reason : decision.reason,
      },
    });
  }

  const parentTerminal = source === "status" && TERMINAL.has(callStatus.toLowerCase());
  if (parentTerminal) {
    await publishOutboundEvent(admin, {
      type: "call.completed",
      eventId: `call.completed:${callSid}`,
      workspaceId,
      data: {
        call_sid: callSid,
        direction,
        from: fromNumber,
        to: (call.to_number as string) ?? "",
        app_number: appNumber,
        status: callStatus,
        dial_status: effectiveDial,
        duration: Number.isFinite(durationSeconds) ? durationSeconds : null,
        answer_path: answerPath,
      },
    });
  }
}

async function sendMissedCallText(
  admin: SupabaseClient,
  input: {
    callSid: string;
    appNumber: string;
    caller: string;
    lineLabel: string;
    template: string;
    dedupeMinutes: number;
    workspaceId: string | null;
    reason: string;
  },
): Promise<void> {
  const caller = normalizePhone(input.caller);
  const line = normalizePhone(input.appNumber);
  if (!input.workspaceId) {
    const { logWebhookError } = await import("@/lib/webhook-errors.server");
    await logWebhookError(admin, {
      source: "missed-call-text",
      message: "no workspace for missed-call text-back",
      callSid: input.callSid,
      appNumber: line,
    });
    return;
  }
  const { data: existing } = await admin
    .from("missed_call_textbacks")
    .select("id")
    .eq("call_sid", input.callSid)
    .maybeSingle();
  if (existing) return;

  const windowStart = new Date(Date.now() - input.dedupeMinutes * 60_000).toISOString();
  const { data: recent } = await admin
    .from("missed_call_textbacks")
    .select("created_at, status")
    .eq("app_number", line)
    .eq("contact_number", caller)
    .in("status", ["sent", "pending"])
    .gte("created_at", windowStart)
    .limit(1);
  const previous = recent?.[0];
  if (
    previous &&
    isDuplicateTextBack(new Date(previous.created_at as string), new Date(), input.dedupeMinutes)
  ) {
    await admin.from("missed_call_textbacks").insert({
      workspace_id: input.workspaceId,
      call_sid: input.callSid,
      app_number: line,
      contact_number: caller,
      status: "skipped",
      skip_reason: "deduped",
    });
    return;
  }

  const body = renderTextBackTemplate(input.template, { line: input.lineLabel, caller });
  const { error: pendingError } = await admin.from("missed_call_textbacks").insert({
    workspace_id: input.workspaceId,
    call_sid: input.callSid,
    app_number: line,
    contact_number: caller,
    body,
    status: "pending",
  });
  if (pendingError) return;

  const sent = await sendAutomatedText({ to: caller, from: line, body });
  if (!sent.ok) {
    await admin
      .from("missed_call_textbacks")
      .update({ status: "skipped", skip_reason: sent.reason })
      .eq("call_sid", input.callSid);
    return;
  }

  const conversationId = await upsertConversation(admin, {
    channel: "sms",
    appNumber: line,
    contactNumber: caller,
    workspaceId: input.workspaceId,
  });
  await admin.from("messages").insert({
    conversation_id: conversationId,
    sid: sent.sid,
    direction: "outbound",
    channel: "sms",
    from_number: line,
    to_number: caller,
    body,
    status: sent.status,
    workspace_id: input.workspaceId,
  });
  await admin
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body.slice(0, 140),
    })
    .eq("id", conversationId);
  await admin
    .from("missed_call_textbacks")
    .update({ status: "sent", message_sid: sent.sid, skip_reason: null })
    .eq("call_sid", input.callSid);
}
