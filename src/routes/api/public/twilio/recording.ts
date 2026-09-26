import { createFileRoute } from "@tanstack/react-router";

/**
 * Twilio recording-completed callback: pull the audio, transcribe it with
 * modern speech-to-text, then run the call intelligence pass.
 */
export const Route = createFileRoute("/api/public/twilio/recording")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const get = (key: string) => auth.params[key] ?? "";
        const callSid = get("CallSid");
        const recordingUrl = get("RecordingUrl");
        if (!callSid || !recordingUrl) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const { data: call } = await supabaseAdmin
            .from("calls")
            .select("app_number, from_number, to_number, direction, answer_path")
            .eq("sid", callSid)
            .maybeSingle();

          await supabaseAdmin
            .from("calls")
            .update({ recording_url: recordingUrl })
            .eq("sid", callSid);

          const { transcribeRecordingUrl } = await import("@/lib/transcribe.server");
          const text = await transcribeRecordingUrl(recordingUrl);
          if (!text) return new Response("ok");

          await supabaseAdmin.from("calls").update({ transcription: text }).eq("sid", callSid);

          const appNumber = (call?.app_number as string | null) ?? "";
          if (appNumber) {
            const contactNumber =
              call?.direction === "outbound"
                ? ((call?.to_number as string | null) ?? null)
                : ((call?.from_number as string | null) ?? null);
            const { ingestCallTranscript } = await import("@/lib/intelligence.server");
            await ingestCallTranscript(supabaseAdmin as never, {
              callSid,
              appNumber,
              contactNumber,
              direction: (call?.direction as string | null) ?? "inbound",
              source: "stt",
              turns: [{ speaker: "caller", text }],
            });
          }

          const answerPath = (call?.answer_path as string | null) ?? null;
          const voicemail =
            answerPath === "voicemail" || answerPath === "classic" || answerPath === "ai_greeting";
          if (voicemail && text) {
            try {
              const { publishOutboundEvent } = await import("@/lib/outbound-webhooks.server");
              const { data: line, error: lineError } = appNumber
                ? await supabaseAdmin
                    .from("phone_numbers")
                    .select("workspace_id")
                    .eq("phone_number", appNumber)
                    .maybeSingle()
                : { data: null, error: null };
              await publishOutboundEvent(supabaseAdmin as never, {
                type: "voicemail.transcribed",
                eventId: `voicemail.transcribed:${callSid}`,
                workspaceId: lineError ? null : ((line?.workspace_id as string | null) ?? null),
                data: {
                  call_sid: callSid,
                  from: (call?.from_number as string | null) ?? "",
                  to: (call?.to_number as string | null) ?? "",
                  app_number: appNumber,
                  transcript: text,
                  recording_url: recordingUrl,
                },
              });
            } catch (publishError) {
              console.error("voicemail webhook publish failed", publishError);
            }
          }
        } catch (error) {
          console.error("recording transcription failed", error);
          try {
            const { logWebhookError } = await import("@/lib/webhook-errors.server");
            await logWebhookError(supabaseAdmin as never, {
              source: "recording",
              message: error instanceof Error ? error.message : String(error),
              callSid,
            });
          } catch {
            // logging must never break the callback
          }
        }

        return new Response("ok");
      },
    },
  },
});
