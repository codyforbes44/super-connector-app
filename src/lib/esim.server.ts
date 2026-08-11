import type { SupabaseClient } from "@supabase/supabase-js";

import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";
import {
  EsimProviderNotConfigured,
  esimProviderConfigured,
  fetchCatalogue,
  fetchPackage,
  fetchUsage,
  placeOrder,
  type EsimInstructions,
  type EsimPackage,
} from "./esim-provider.server";

type SB = SupabaseClient;

export type EsimOrder = {
  id: string;
  package_id: string;
  package_title: string;
  region: string | null;
  data_amount: string | null;
  validity_days: number | null;
  amount_cents: number;
  currency: string;
  status: string;
  iccid: string | null;
  activation_code: string | null;
  matching_id: string | null;
  smdp_address: string | null;
  qr_code_url: string | null;
  apn: string | null;
  instructions: EsimInstructions;
  last_error: string | null;
  created_at: string;
};

const CACHE_MS = 10 * 60 * 1000;
let catalogueCache: { at: number; packages: EsimPackage[] } | null = null;

/** Fire-and-forget push alert about an eSIM order — never blocks fulfilment. */
async function alertOrder(
  admin: SB,
  userId: string,
  order: { id: string; package_title: string },
  outcome: "ready" | "failed",
  detail?: string,
): Promise<void> {
  try {
    const { sendPushToUsers } = await import("./push.server");
    await sendPushToUsers(admin, [userId], {
      title: outcome === "ready" ? "Your eSIM is ready" : "eSIM setup needs attention",
      body:
        outcome === "ready"
          ? `${order.package_title} is provisioned — tap to install it.`
          : `${order.package_title} couldn't be provisioned. ${detail ?? ""}`.trim(),
      url: `/esim?order=${encodeURIComponent(order.id)}`,
      tag: `esim-${order.id}`,
      requireInteraction: outcome === "failed",
    });
  } catch (error) {
    console.error("eSIM push alert failed", error);
  }
}

export async function listPackages(): Promise<{
  configured: boolean;
  packages: EsimPackage[];
  error: string | null;
}> {
  if (!esimProviderConfigured()) {
    return { configured: false, packages: [], error: new EsimProviderNotConfigured().message };
  }
  if (catalogueCache && Date.now() - catalogueCache.at < CACHE_MS) {
    return { configured: true, packages: catalogueCache.packages, error: null };
  }
  try {
    const [local, global] = await Promise.all([fetchCatalogue("local"), fetchCatalogue("global")]);
    const packages = [...global, ...local];
    catalogueCache = { at: Date.now(), packages };
    return { configured: true, packages, error: null };
  } catch (error) {
    return {
      configured: true,
      packages: catalogueCache?.packages ?? [],
      error: error instanceof Error ? error.message : "Could not load data plans.",
    };
  }
}

export async function listOrders(supabase: SB, userId: string): Promise<EsimOrder[]> {
  const { data } = await supabase
    .from("esim_orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as EsimOrder[];
}

/** Creates a pending order row and an embedded Stripe checkout session for it. */
export async function startCheckout(
  supabase: SB,
  userId: string,
  input: { packageId: string; returnUrl: string; environment: StripeEnv; email?: string },
): Promise<{ clientSecret: string; orderId: string } | { error: string }> {
  try {
    if (!esimProviderConfigured()) throw new EsimProviderNotConfigured();
    const pkg = await fetchPackage(input.packageId);
    if (!pkg) throw new Error("That data plan is no longer available.");

    const { data: order, error } = await supabase
      .from("esim_orders")
      .insert({
        user_id: userId,
        package_id: pkg.id,
        package_title: pkg.title,
        region: pkg.region,
        data_amount: pkg.data,
        validity_days: pkg.validityDays,
        amount_cents: pkg.priceCents,
        currency: "usd",
        status: "pending",
        environment: input.environment === "sandbox" ? "sandbox" : "live",
        apn: pkg.apn,
      })
      .select("id")
      .single();
    if (error || !order) throw new Error(error?.message ?? "Could not start that order.");

    const stripe = createStripeClient(input.environment);
    const returnUrl = new URL(input.returnUrl);
    returnUrl.searchParams.set("esim_order", order.id as string);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl.toString(),
      ...(input.email ? { customer_email: input.email } : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pkg.priceCents,
            product_data: {
              name: `${pkg.title} — travel data eSIM`,
              description: `${pkg.data} · ${pkg.validityDays} days · ${pkg.region}`,
            },
          },
        },
      ],
      metadata: { userId, esimOrderId: order.id as string, packageId: pkg.id },
    } as never);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("esim_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id as string);

    return { clientSecret: session.client_secret ?? "", orderId: order.id as string };
  } catch (error) {
    if (error instanceof EsimProviderNotConfigured) return { error: error.message };
    return { error: getStripeErrorMessage(error) };
  }
}

/**
 * Called when the buyer returns from checkout. Verifies payment with Stripe,
 * then provisions the profile with the partner. Safe to call repeatedly.
 */
export async function finalizeOrder(
  supabase: SB,
  userId: string,
  input: { orderId: string; environment: StripeEnv },
): Promise<{ order: EsimOrder | null; error: string | null }> {
  const { data: row } = await supabase
    .from("esim_orders")
    .select("*")
    .eq("id", input.orderId)
    .eq("user_id", userId)
    .maybeSingle();
  const order = row as unknown as (EsimOrder & { stripe_session_id: string | null }) | null;
  if (!order) return { order: null, error: "Order not found." };
  if (order.status === "active") return { order, error: null };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  try {
    if (!order.stripe_session_id) throw new Error("This order was never sent to checkout.");
    const stripe = createStripeClient(input.environment);
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    if (session.payment_status !== "paid") {
      return { order, error: "Payment hasn't cleared yet. Try again in a moment." };
    }

    await supabaseAdmin
      .from("esim_orders")
      .update({
        status: "provisioning",
        stripe_payment_intent:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("id", order.id);

    const sim = await placeOrder(order.package_id, `sixvox-${order.id}`);

    const { data: updated } = await supabaseAdmin
      .from("esim_orders")
      .update({
        status: "active",
        provider_order_id: sim.orderId,
        iccid: sim.iccid,
        activation_code: sim.activationCode,
        matching_id: sim.matchingId,
        smdp_address: sim.smdpAddress,
        qr_code_url: sim.qrCodeUrl,
        apn: sim.apn ?? order.apn,
        instructions: sim.instructions as unknown as Record<string, string | null>,
        last_error: null,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    return { order: (updated as unknown as EsimOrder) ?? order, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not finish that order.";
    await supabaseAdmin
      .from("esim_orders")
      .update({ status: "failed", last_error: message })
      .eq("id", order.id);
    await alertOrder(supabaseAdmin as unknown as SB, userId, order, "failed", message);
    return { order: { ...order, status: "failed", last_error: message }, error: message };
  }
}

export async function orderUsage(supabase: SB, userId: string, orderId: string) {
  const { data } = await supabase
    .from("esim_orders")
    .select("iccid")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  const iccid = (data as { iccid: string | null } | null)?.iccid;
  if (!iccid) return null;
  return fetchUsage(iccid);
}
