import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["TWILIO_WEBHOOK_TOKEN"];
        if (!expected || url.searchParams.get("t") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const form = await request.formData();
        const get = (key: string) => (form.get(key) as string | null) ?? "";
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