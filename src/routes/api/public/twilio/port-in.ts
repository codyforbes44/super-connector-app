import { createFileRoute } from "@tanstack/react-router";

import { verifyTwilioWebhook, rejectWebhook } from "@/lib/twilio-signature.server";

export const Route = createFileRoute("/api/public/twilio/port-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await verifyTwilioWebhook(request);
        if (!auth.ok) return rejectWebhook(request, auth.reason, auth.params);
        const { applyPortWebhook } = await import("@/lib/integrations/trade.server");
        await applyPortWebhook(auth.params);
        return new Response("ok", { status: 200 });
      },
    },
  },
});
