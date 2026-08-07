import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyTwilioWebhook, rejectWebhook } = await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason);

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
          if (missed || voicemail) {
            const { data: call } = await supabaseAdmin
              .from("calls")
              .select("app_number, from_number, direction")
              .eq("sid", callSid)
              .maybeSingle();
            if (call && call.direction === "inbound") {
              const { notifyNumberWatchers } = await import("@/lib/push.server");
              await notifyNumberWatchers(supabaseAdmin as never, call.app_number as string, {
                title: voicemail ? "New voicemail" : "Missed call",
                body: `${call.from_number} → ${call.app_number}`,
                url: "/calls",
                tag: `call-${callSid}`,
              });
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});