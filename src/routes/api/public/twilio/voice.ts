import { createFileRoute } from "@tanstack/react-router";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const get = (key: string) => auth.params[key] ?? "";
        const appNumber = get("To").replace(/^whatsapp:/, "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // A caller must always hear something valid. Any unexpected failure in
        // the logic below falls through to a plain greeting + recording rather
        // than Twilio's generic "an application error has occurred".
        try {
          await supabaseAdmin.from("calls").upsert(
            {
              sid: get("CallSid"),
              direction: "inbound",
              from_number: get("From"),
              to_number: get("To"),
              app_number: appNumber,
              status: get("CallStatus") || "ringing",
            },
            { onConflict: "sid" },
          );

          const { VOICE_CONFIG_COLUMNS } = await import("@/lib/voice-answer.server");
          try {
            const { noteForwardedCall } = await import("@/lib/byo.server");
            await noteForwardedCall(supabaseAdmin as never, appNumber);
          } catch {
            // forwarding bookkeeping must never break an inbound call
          }
          const { data: number } = await supabaseAdmin
            .from("phone_numbers")
            .select(`forward_to, assigned_to, ${VOICE_CONFIG_COLUMNS}`)
            .eq("phone_number", appNumber)
            .maybeSingle();

          // Opt-in call transcription: only with a spoken consent notice.
          let transcribeCalls = false;
          if (number?.assigned_to) {
            const { data: owner } = await supabaseAdmin
              .from("profiles")
              .select("transcribe_calls")
              .eq("id", number.assigned_to as string)
              .maybeSingle();
            transcribeCalls = Boolean(owner?.transcribe_calls);
          }

          // Alert watchers immediately so a backgrounded device can pick up.
          try {
            const { notifyNumberWatchers } = await import("@/lib/push.server");
            await notifyNumberWatchers(supabaseAdmin as never, appNumber, {
              title: "Incoming call",
              body: `${get("From")} → ${appNumber}`,
              url: `/calls?incoming=${encodeURIComponent(get("CallSid"))}`,
              tag: `ring-${get("CallSid")}`,
              type: "call",
              requireInteraction: true,
            });
          } catch (error) {
            console.error("Push alert failed for inbound call:", error);
          }

          const aiAnswering = number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id;

          const { voicemailTwiml, ringbackTwiml, RING_SECONDS, forwardedCallTwiml } =
            await import("@/lib/voice-answer.server");

          if (number?.forward_to && !aiAnswering) {
            return xml(
              forwardedCallTwiml({
                record: transcribeCalls,
                callerId: appNumber,
                destination: number.forward_to as string,
                timeoutSeconds: RING_SECONDS,
              }),
            );
          }

          const answer = await voicemailTwiml(supabaseAdmin as never, number ?? {}, {
            callSid: get("CallSid"),
            from: get("From"),
            appNumber,
          });

          // Callers always hear four rings first — including before the AI
          // hand-off, which would otherwise pick up instantly. Voicemail
          // recording, when used, speaks the notice inside the answer TwiML.
          const handOff = answer.startsWith("<Redirect");
          const twiml = ringbackTwiml() + answer;

          try {
            await supabaseAdmin
              .from("calls")
              .update({ answer_path: handOff ? "ai_agent" : (number?.answer_mode ?? "voicemail") })
              .eq("sid", get("CallSid"));
          } catch {
            // bookkeeping only
          }

          return xml(twiml);
        } catch (error) {
          console.error(`Inbound voice handler failed for ${appNumber}:`, error);
          try {
            const { logWebhookError } = await import("@/lib/webhook-errors.server");
            await logWebhookError(supabaseAdmin as never, {
              source: "voice",
              message: error instanceof Error ? error.message : String(error),
              url: url.toString(),
              callSid: get("CallSid"),
              appNumber,
            });
          } catch {
            // never block the fallback
          }
          const { fallbackVoicemailTwiml } = await import("@/lib/voice-answer.server");
          return xml(fallbackVoicemailTwiml());
        }
      },
    },
  },
});
