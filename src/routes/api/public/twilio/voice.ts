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
        const { data: number } = await supabaseAdmin
          .from("phone_numbers")
          .select(`forward_to, ${VOICE_CONFIG_COLUMNS}`)
          .eq("phone_number", appNumber)
          .maybeSingle();

        // Alert watchers immediately so a backgrounded device can pick up.
        const { notifyNumberWatchers } = await import("@/lib/push.server");
        await notifyNumberWatchers(supabaseAdmin as never, appNumber, {
          title: "Incoming call",
          body: `${get("From")} → ${appNumber}`,
          url: `/calls?incoming=${encodeURIComponent(get("CallSid"))}`,
          tag: `ring-${get("CallSid")}`,
          type: "call",
          requireInteraction: true,
        });

        const aiAnswering = number?.answer_mode === "ai_agent" && number?.elevenlabs_agent_id;

        if (number?.forward_to && !aiAnswering) {
          return xml(
            `<Dial callerId="${escapeXml(appNumber)}" timeout="20" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(url.origin + url.pathname.replace("/voice", "/status") + url.search)}"><Number>${escapeXml(number.forward_to)}</Number></Dial>`,
          );
        }

        const { voicemailTwiml } = await import("@/lib/voice-answer.server");
        return xml(
          await voicemailTwiml(supabaseAdmin as never, number ?? {}, {
            callSid: get("CallSid"),
            from: get("From"),
            appNumber,
          }),
        );
      },
    },
  },
});