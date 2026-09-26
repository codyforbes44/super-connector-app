import { createFileRoute } from "@tanstack/react-router";

import { verifyStripeSignature } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/public/payments/connect-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_CONNECT_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook is not configured", { status: 400 });
        try {
          const event = (await verifyStripeSignature(
            await request.text(),
            request.headers.get("stripe-signature"),
            secret,
          )) as {
            id?: string;
            type?: string;
            livemode?: boolean;
            data?: { object?: Record<string, unknown> };
          };
          const { applyConnectWebhook } = await import("@/lib/integrations/trade.server");
          await applyConnectWebhook(event);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Connect webhook error", error);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
