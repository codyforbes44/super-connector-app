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
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const params = auth.params;
        const loggedUrl = new URL(url.toString());
        loggedUrl.searchParams.delete("t");
        const errorUrl = params["ErrorUrl"];

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { logWebhookError } = await import("@/lib/webhook-errors.server");
          await logWebhookError(supabaseAdmin as never, {
            source: "voice-fallback",
            errorCode: params["ErrorCode"] ?? null,
            message: errorUrl
              ? `Primary handler failed at ${errorUrl}`
              : "Primary voice handler failed",
            url: loggedUrl.toString(),
            callSid: params["CallSid"] ?? null,
            appNumber: (params["To"] ?? "").replace(/^whatsapp:/, ""),
          });
        } catch {
          // never block the greeting
        }

        const { fallbackVoicemailTwiml } = await import("@/lib/voice-answer.server");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response>${fallbackVoicemailTwiml()}</Response>`,
          { headers: { "Content-Type": "text/xml" } },
        );
      },
    },
  },
});
