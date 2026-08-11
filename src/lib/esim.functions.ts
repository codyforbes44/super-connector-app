import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StripeEnv } from "@/lib/stripe.server";
import * as esim from "./esim.server";

export const listEsimPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => esim.listPackages());

export const listMyEsims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => esim.listOrders(context.supabase, context.userId));

export const startEsimCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { packageId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!data.packageId || data.packageId.length > 200) throw new Error("Invalid plan.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const {
      data: { user },
    } = await context.supabase.auth.getUser();
    return esim.startCheckout(context.supabase, context.userId, {
      packageId: data.packageId,
      returnUrl: data.returnUrl,
      environment: data.environment,
      ...(user?.email ? { email: user.email } : {}),
    });
  });

export const finalizeEsimOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }) =>
    esim.finalizeOrder(context.supabase, context.userId, data),
  );

export const esimUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data, context }) =>
    esim.orderUsage(context.supabase, context.userId, data.orderId),
  );
