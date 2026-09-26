import { createFileRoute } from "@tanstack/react-router";

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
          } = {};
          if (get("CallStatus")) patch["status"] = get("CallStatus");
          if (get("CallDuration")) patch["duration"] = Number(get("CallDuration"));
          if (get("RecordingUrl")) patch["recording_url"] = get("RecordingUrl");
          if (get("TranscriptionText")) patch["transcription"] = get("TranscriptionText");
          if (Object.keys(patch).length) {
            await supabaseAdmin.from("calls").update(patch).eq("sid", callSid);
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
              .select("app_number, from_number, direction")
              .eq("sid", callSid)
              .maybeSingle();
            if (call && call.direction === "inbound") {
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
        }

        return new Response("ok");
      },
    },
  },
});
