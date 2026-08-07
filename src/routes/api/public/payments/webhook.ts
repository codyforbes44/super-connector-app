import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { parsePriceId, seatsFor } from "@/lib/plans";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

const iso = (seconds?: number | null) =>
  seconds ? new Date(seconds * 1000).toISOString() : null;

function shapeFrom(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const { plan, interval } = parsePriceId(priceId);
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  return {
    stripe_subscription_id: subscription.id as string,
    stripe_customer_id: (subscription.customer ?? null) as string | null,
    product_id: (typeof item?.price?.product === "string" ? item.price.product : null) as
      | string
      | null,
    price_id: (priceId ?? null) as string | null,
    plan_code: plan,
    billing_interval: interval,
    seats: seatsFor(plan),
    status: subscription.status as string,
    current_period_start: iso(periodStart),
    current_period_end: iso(periodEnd),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    environment: env,
    updated_at: new Date().toISOString(),
  };
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  const shape = shapeFrom(subscription, env);
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", shape.stripe_subscription_id)
    .maybeSingle();

  if (existing?.id) {
    await supabase.from("subscriptions").update(shape).eq("id", existing.id);
    return;
  }

  if (!userId) {
    console.error("Subscription event without userId metadata", subscription.id);
    return;
  }

  // Reuse the placeholder row created at signup when there is one.
  const { data: placeholder } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .is("stripe_subscription_id", null)
    .limit(1)
    .maybeSingle();

  if (placeholder?.id) {
    await supabase.from("subscriptions").update(shape).eq("id", placeholder.id);
  } else {
    await supabase.from("subscriptions").insert({ user_id: userId, ...shape });
  }
}

async function markCanceled(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "subscription.created":
    case "subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
    case "subscription.canceled":
      await markCanceled(event.data.object, env);
      break;
    default:
      console.log("Unhandled payments event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Payments webhook with invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});