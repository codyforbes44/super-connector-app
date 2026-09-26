import type { SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

function appNumberForStatus(
  params: Record<string, string>,
  existing: Record<string, unknown> | null,
): string {
  const stored = String(existing?.["app_number"] ?? "").replace(/^whatsapp:/, "");
  if (stored && !stored.startsWith("client:")) return stored;
  const direction = String(existing?.["direction"] ?? params["Direction"] ?? "").toLowerCase();
  const from = (params["From"] ?? "").replace(/^whatsapp:/, "");
  const to = (params["To"] ?? "").replace(/^whatsapp:/, "");
  if (direction.startsWith("outbound")) {
    return from.startsWith("client:") ? to : from || to;
  }
  return to || from;
}

export const Route = createFileRoute("/api/public/twilio/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const get = (key: string) => auth.params[key] ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          await applyStatusCallback(supabaseAdmin as never, auth.params, get);
        } catch (error) {
          console.error("status callback failed", error);
          const { logWebhookError } = await import("@/lib/webhook-errors.server");
          await logWebhookError(supabaseAdmin as never, {
            source: "status",
            message: error instanceof Error ? error.message : String(error),
            callSid: get("CallSid") || null,
            appNumber: get("To") || get("From") || null,
          });
        }

        return new Response("ok");
      },
    },
  },
});

async function applyStatusCallback(
  supabaseAdmin: SupabaseClient,
  params: Record<string, string>,
  get: (key: string) => string,
) {
  const { logWebhookError } = await import("@/lib/webhook-errors.server");
  const messageSid = get("MessageSid") || get("SmsSid");
  if (messageSid) {
    await supabaseAdmin
      .from("messages")
      .update({
        status: get("MessageStatus") || get("SmsStatus"),
        error_code: get("ErrorCode") || null,
      })
      .eq("sid", messageSid);
  }

  const callSid = get("CallSid");
  if (callSid) {
    const patch: {
      status?: string;
      duration?: number;
      recording_url?: string;
      transcription?: string;
      workspace_id?: string;
    } = {};
    if (get("CallStatus")) patch["status"] = get("CallStatus");
    if (get("CallDuration")) patch["duration"] = Number(get("CallDuration"));
    if (get("RecordingUrl")) patch["recording_url"] = get("RecordingUrl");
    if (get("TranscriptionText")) patch["transcription"] = get("TranscriptionText");
    const { data: existingCall } = await supabaseAdmin
      .from("calls")
      .select("spam_action, app_number, direction, workspace_id")
      .eq("sid", callSid)
      .maybeSingle();
    const existing = (existingCall ?? null) as Record<string, unknown> | null;
    const spamBlocked = existing?.["spam_action"] === "block";
    if (spamBlocked) delete patch.status;

    const appNumber = appNumberForStatus(params, existing);
    let workspaceId = (existing?.["workspace_id"] as string | null) ?? null;
    if (!workspaceId && appNumber) {
      const { resolveWorkspaceIdForNumber } = await import("@/lib/workspace.server");
      workspaceId = (await resolveWorkspaceIdForNumber(appNumber)).workspaceId;
    }
    if (workspaceId) patch.workspace_id = workspaceId;
    else {
      await logWebhookError(supabaseAdmin, {
        source: "status",
        message: "no workspace for call status",
        callSid,
        appNumber: appNumber || null,
      });
    }

    if (Object.keys(patch).length) {
      const { error: callError } = await supabaseAdmin
        .from("calls")
        .update(patch)
        .eq("sid", callSid);
      if (callError) {
        await logWebhookError(supabaseAdmin, {
          source: "status",
          message: callError.message,
          callSid,
          appNumber: appNumber || null,
          workspaceId,
        });
      }
    }

    const status = (patch.status ?? "").toLowerCase();
    const missed = ["no-answer", "busy", "failed", "canceled"].includes(status);
    const voicemail = Boolean(patch.recording_url);

    // Clear the ringing notification once the call is no longer ringing.
    if (
      [
        "in-progress",
        "answered",
        "completed",
        ...["no-answer", "busy", "failed", "canceled"],
      ].includes(status)
    ) {
      const { data: ringing } = await supabaseAdmin
        .from("calls")
        .select("app_number, direction")
        .eq("sid", callSid)
        .maybeSingle();
      if (ringing?.direction === "inbound") {
        const { notifyNumberWatchers } = await import("@/lib/push.server");
        await notifyNumberWatchers(supabaseAdmin as never, ringing.app_number as string, {
          title: "",
          body: "",
          tag: `ring-${callSid}`,
          type: "call-ended",
        });
      }
    }

    if (missed || voicemail) {
      const { data: call } = await supabaseAdmin
        .from("calls")
        .select("app_number, from_number, direction, spam_action")
        .eq("sid", callSid)
        .maybeSingle();
      if (call && call.direction === "inbound" && call.spam_action !== "block") {
        // A transcribed voicemail is enough to produce a summary,
        // follow-ups and caller memory for this call.
        if (patch.transcription) {
          const { ingestCallTranscript } = await import("@/lib/intelligence.server");
          await ingestCallTranscript(supabaseAdmin as never, {
            callSid,
            appNumber: call.app_number as string,
            contactNumber: call.from_number as string,
            direction: "inbound",
            source: "voicemail",
            turns: [{ speaker: "caller", text: patch.transcription }],
          });
        }
        const { notifyNumber } = await import("@/lib/notify.server");
        const templates = await import("@/lib/email-templates/index");
        const from = call.from_number as string;
        const to = call.app_number as string;
        const at = new Date().toUTCString();
        await notifyNumber(supabaseAdmin as never, to, {
          push: {
            title: voicemail ? "New voicemail" : "Missed call",
            body: `${from} → ${to}`,
            url: "/calls",
            tag: `call-${callSid}`,
          },
          email: voicemail
            ? {
                prefKey: "email_voicemail",
                template: "voicemail",
                render: (baseUrl) =>
                  templates.voicemail({
                    baseUrl,
                    from,
                    to,
                    at,
                    callSid,
                    ...(patch.duration ? { duration: `${patch.duration}s` } : {}),
                    ...(patch.transcription ? { transcript: patch.transcription } : {}),
                    ...(patch.recording_url ? { recordingUrl: patch.recording_url } : {}),
                  }),
                context: { callSid },
              }
            : {
                prefKey: "email_missed_call",
                template: "missed-call",
                render: (baseUrl) => templates.missedCall({ baseUrl, from, to, at, callSid }),
                context: { callSid },
              },
        });
      }
    }

    if (["completed", "no-answer", "busy", "failed", "canceled"].includes(status) && !spamBlocked) {
      try {
        const { ensureCallSummary } = await import("@/lib/intelligence.server");
        await ensureCallSummary(supabaseAdmin as never, callSid);
      } catch (error) {
        console.error("call summary failed", error);
      }
    }
  }

  try {
    const { handleInboundCallUpdate } = await import("@/lib/call-automation.server");
    const { drainDueDeliveries } = await import("@/lib/outbound-webhooks.server");
    if (callSid) {
      await handleInboundCallUpdate(supabaseAdmin as never, params, "status");
    }
    await drainDueDeliveries(supabaseAdmin as never, 1);
  } catch (error) {
    console.error("call automation failed", error);
  }
}
