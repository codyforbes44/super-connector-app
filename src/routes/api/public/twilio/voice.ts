import { createFileRoute } from "@tanstack/react-router";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

export const Route = createFileRoute("/api/public/twilio/voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const { verifyTwilioWebhook, rejectWebhook } = await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason);

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
            .select(`forward_to, ${VOICE_CONFIG_COLUMNS}`)
            .eq("phone_number", appNumber)
            .maybeSingle();

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

          const { voicemailTwiml, ringbackTwiml, RING_SECONDS } = await import(
            "@/lib/voice-answer.server"
          );

          if (number?.forward_to && !aiAnswering) {
            return xml(
              `<Dial callerId="${escapeXml(appNumber)}" timeout="${RING_SECONDS}" ringTone="us" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(url.origin + url.pathname.replace("/voice", "/status") + url.search)}"><Number>${escapeXml(number.forward_to)}</Number></Dial>`,
            );
          }

          const answer = await voicemailTwiml(supabaseAdmin as never, number ?? {}, {
            callSid: get("CallSid"),
            from: get("From"),
            appNumber,
          });

          // The AI hand-off is a <Redirect>; anything queued before it (the
          // ring-back <Dial>) delays the answer, so only ring for human/voicemail.
          const handOff = answer.startsWith("<Redirect");
          const twiml = handOff ? answer : ringbackTwiml() + answer;

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
          return xml(
            `<Say voice="alice">Thanks for calling. Please leave a message after the tone.</Say><Record maxLength="120" playBeep="true" transcribe="true" /><Say voice="alice">We did not receive a recording. Goodbye.</Say>`,
          );
        }
      },
    },
  },
});