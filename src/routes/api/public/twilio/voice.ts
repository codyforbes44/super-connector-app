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

        const { data: number } = await supabaseAdmin
          .from("phone_numbers")
          .select("forward_to, voicemail_greeting")
          .eq("phone_number", appNumber)
          .maybeSingle();

        if (number?.forward_to) {
          return xml(
            `<Dial callerId="${escapeXml(appNumber)}" timeout="20" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(url.origin + url.pathname.replace("/voice", "/status") + url.search)}"><Number>${escapeXml(number.forward_to)}</Number></Dial>`,
          );
        }

        const greeting =
          number?.voicemail_greeting ||
          "Thanks for calling. Please leave a message after the tone.";
        return xml(
          `<Say voice="alice">${escapeXml(greeting)}</Say><Record maxLength="120" playBeep="true" transcribe="true" /><Say voice="alice">We did not receive a recording. Goodbye.</Say>`,
        );
      },
    },
  },
});