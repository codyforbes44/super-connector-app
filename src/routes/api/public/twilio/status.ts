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
          const patch: Record<string, unknown> = {};
          if (get("CallStatus")) patch["status"] = get("CallStatus");
          if (get("CallDuration")) patch["duration"] = Number(get("CallDuration"));
          if (get("RecordingUrl")) patch["recording_url"] = get("RecordingUrl");
          if (get("TranscriptionText")) patch["transcription"] = get("TranscriptionText");
          if (Object.keys(patch).length) {
            await supabaseAdmin.from("calls").update(patch).eq("sid", callSid);
          }
        }

        return new Response("ok");
      },
    },
  },
});