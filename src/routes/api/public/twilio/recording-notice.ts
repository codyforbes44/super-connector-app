import { createFileRoute } from "@tanstack/react-router";

/**
 * Whisper played to the called party on a recorded leg so both sides hear
 * the notice (all-party consent). Signature required, same as every other
 * Twilio webhook.
 */
export const Route = createFileRoute("/api/public/twilio/recording-notice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        const { recordingNoticeResponseTwiml } = await import("@/lib/voice-answer.server");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response>${recordingNoticeResponseTwiml()}</Response>`,
          { headers: { "Content-Type": "text/xml" } },
        );
      },
    },
  },
});
