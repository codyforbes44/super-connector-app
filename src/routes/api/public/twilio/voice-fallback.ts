import { createFileRoute } from "@tanstack/react-router";

/**
 * Last-resort answer. Twilio calls this when the primary voice webhook (or a
 * hand-off it redirected to) fails, so the caller always reaches a greeting
 * instead of "an application error has occurred".
 */
export const Route = createFileRoute("/api/public/twilio/voice-fallback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const body = await request.text();
        const params = new URLSearchParams(body);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { logWebhookError } = await import("@/lib/webhook-errors.server");
          await logWebhookError(supabaseAdmin as never, {
            source: "voice-fallback",
            errorCode: params.get("ErrorCode"),
            message: params.get("ErrorUrl")
              ? `Primary handler failed at ${params.get("ErrorUrl")}`
              : "Primary voice handler failed",
            url: url.toString(),
            callSid: params.get("CallSid"),
            appNumber: (params.get("To") ?? "").replace(/^whatsapp:/, ""),
          });
        } catch {
          // never block the greeting
        }

        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Thanks for calling. Please leave a message after the tone.</Say><Record maxLength="120" playBeep="true" transcribe="true" /><Say voice="alice">We did not receive a recording. Goodbye.</Say></Response>`,
          { headers: { "Content-Type": "text/xml" } },
        );
      },
    },
  },
});