import { createFileRoute } from "@tanstack/react-router";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * Twilio posts DialCallStatus here when a `<Dial>` finishes.
 * An empty response ends the call the same way a Dial without an action does.
 * Signature rules match every other Twilio webhook (PR #2).
 */
export const Route = createFileRoute("/api/public/twilio/dial-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyTwilioWebhook, rejectWebhook } =
          await import("@/lib/twilio-signature.server");
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { handleInboundCallUpdate } = await import("@/lib/call-automation.server");
          await handleInboundCallUpdate(supabaseAdmin as never, auth.params, "dial");
        } catch (error) {
          console.error("dial action automation failed", error);
        }

        return xml("");
      },
    },
  },
});
