import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRIAL_DAYS } from "@/lib/plans";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import type Stripe from "stripe";

type InvoiceLineShape = {
  period?: { start?: number | null; end?: number | null } | null;
  description?: string | null;
};

type WithPeriodEnd = {
  current_period_end?: number | null;
};

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

export type BillingInvoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  amountDue: number;
  currency: string;
  created: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  description: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
};

export type BillingTimelineEvent = {
  key: string;
  at: string | null;
  kind: "created" | "trialing" | "active" | "past_due" | "canceled" | "renewal" | "payment";
  title: string;
  detail: string | null;
  future?: boolean;
};

export type BillingHistoryResult =
  | {
      customerId: string | null;
      status: string | null;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string | null;
      invoices: BillingInvoice[];
      timeline: BillingTimelineEvent[];
    }
  | { error: string };

const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

function toMajor(amount: number | null | undefined, currency: string): number {
  const value = amount ?? 0;
  const c = (currency ?? "").toLowerCase();
  if (ZERO_DECIMAL.has(c)) return value;
  if (THREE_DECIMAL.has(c)) return value / 1000;
  return value / 100;
}

function iso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string | undefined; userId?: string | undefined },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length && found.data[0]) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (options.userId && customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const { userId, supabase } = context;
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      const stripePrice = prices.data[0];
      if (!stripePrice) throw new Error("Price not found");

      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId,
      });

      // First-time subscribers get the free trial; anyone who has ever had a
      // subscription on this customer does not.
      const priorSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 1,
      });
      const trialEligible = priorSubs.data.length === 0;

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: { userId, managed_payments: "true" },
        subscription_data: {
          metadata: { userId },
          ...(trialEligible && { trial_period_days: TRIAL_DAYS }),
        },
      } as Stripe.Checkout.SessionCreateParams);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) return { error: "No billing account yet." };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Invoices + subscription status timeline for the signed-in subscriber. */
export const getBillingHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<BillingHistoryResult> => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userId)
      .or(`environment.eq.${data.environment},environment.is.null`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = (sub?.stripe_customer_id as string | null) ?? null;
    if (!customerId) {
      return {
        customerId: null,
        status: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        invoices: [],
        timeline: [],
      };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const [invoiceList, subList] = await Promise.all([
        stripe.invoices.list({ customer: customerId, limit: 24 }),
        stripe.subscriptions.list({ customer: customerId, status: "all", limit: 5 }),
      ]);

      const invoices: BillingInvoice[] = invoiceList.data.map((inv) => {
        const line = inv.lines?.data?.[0];
        return {
          id: inv.id ?? "",
          number: inv.number ?? null,
          status: inv.status ?? null,
          amountPaid: toMajor(inv.amount_paid, inv.currency),
          amountDue: toMajor(inv.amount_due, inv.currency),
          currency: (inv.currency ?? "usd").toUpperCase(),
          created: iso(inv.created),
          periodStart: iso((line as InvoiceLineShape | undefined)?.period?.start),
          periodEnd: iso((line as InvoiceLineShape | undefined)?.period?.end),
          description: (line as InvoiceLineShape | undefined)?.description ?? null,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          pdfUrl: inv.invoice_pdf ?? null,
        };
      });

      const current =
        subList.data.find((s) => s.id === sub?.stripe_subscription_id) ?? subList.data[0] ?? null;

      const timeline: BillingTimelineEvent[] = [];
      if (current) {
        const item = current.items?.data?.[0];
        const periodEnd =
          (item as WithPeriodEnd | undefined)?.current_period_end ??
          (current as WithPeriodEnd).current_period_end;

        timeline.push({
          key: "created",
          at: iso(current.created),
          kind: "created",
          title: "Subscription started",
          detail: null,
        });
        if (current.trial_start) {
          timeline.push({
            key: "trial",
            at: iso(current.trial_start),
            kind: "trialing",
            title: "Free trial began",
            detail: current.trial_end
              ? `Ends ${new Date(current.trial_end * 1000).toLocaleDateString()}`
              : null,
          });
        }
        if (current.trial_end && current.trial_end * 1000 < Date.now()) {
          timeline.push({
            key: "trial-end",
            at: iso(current.trial_end),
            kind: "active",
            title: "Trial ended — billing began",
            detail: null,
          });
        }
        if (current.status === "past_due" || current.status === "unpaid") {
          timeline.push({
            key: "past-due",
            at: iso(current.created),
            kind: "past_due",
            title: "Payment failed — retrying",
            detail: "Update your card to avoid interruption.",
          });
        }
        if (current.canceled_at) {
          timeline.push({
            key: "canceled",
            at: iso(current.canceled_at),
            kind: "canceled",
            title: "Cancellation requested",
            detail: periodEnd
              ? `Access until ${new Date(periodEnd * 1000).toLocaleDateString()}`
              : null,
          });
        }
        if (periodEnd) {
          timeline.push({
            key: "next",
            at: iso(periodEnd),
            kind: current.cancel_at_period_end ? "canceled" : "renewal",
            title: current.cancel_at_period_end ? "Access ends" : "Next renewal",
            detail: null,
            future: true,
          });
        }
      }

      for (const inv of invoices.slice(0, 6)) {
        if (inv.status !== "paid" || !inv.created) continue;
        timeline.push({
          key: `inv-${inv.id}`,
          at: inv.created,
          kind: "payment",
          title: `Payment received — ${inv.currency} ${inv.amountPaid.toFixed(2)}`,
          detail: inv.number,
        });
      }

      timeline.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

      return {
        customerId,
        status: current?.status ?? null,
        cancelAtPeriodEnd: current?.cancel_at_period_end ?? false,
        currentPeriodEnd: current
          ? iso(
              (current.items?.data?.[0] as WithPeriodEnd | undefined)?.current_period_end ??
                (current as WithPeriodEnd).current_period_end,
            )
          : null,
        invoices,
        timeline,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Super-admin view of every subscriber. */
export const listSubscribers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSuper) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: subs }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, display_name, created_at"),
      supabaseAdmin.from("subscriptions").select("*"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    return (profiles ?? []).map((p) => ({
      id: p.id as string,
      email: (p.email as string) ?? "",
      displayName: (p.display_name as string) ?? "",
      createdAt: p.created_at as string,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      subscription: (subs ?? []).find((s) => s.user_id === p.id) ?? null,
    }));
  });

export const updateSubscriber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      targetUserId: string;
      comped?: boolean;
      suspended?: boolean;
      planCode?: string;
      role?: "admin" | "agent" | "owner";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isSuper) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.comped !== undefined || data.suspended !== undefined || data.planCode) {
      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("user_id", data.targetUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const patch: {
        comped?: boolean;
        suspended?: boolean;
        plan_code?: string;
        status?: string;
      } = {};
      if (data.comped !== undefined) {
        patch.comped = data.comped;
        if (data.comped) patch.status = "active";
      }
      if (data.suspended !== undefined) patch.suspended = data.suspended;
      if (data.planCode) patch.plan_code = data.planCode;

      if (existing?.id) {
        await supabaseAdmin.from("subscriptions").update(patch).eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("subscriptions")
          .insert({ user_id: data.targetUserId, status: "active", ...patch });
      }
    }

    if (data.role) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .in("role", ["owner", "admin", "agent"]);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.targetUserId, role: data.role });
    }

    return { ok: true };
  });

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; email: string; company?: string; message: string }) => {
    const name = data.name?.trim() ?? "";
    const email = data.email?.trim() ?? "";
    const message = data.message?.trim() ?? "";
    if (name.length < 2 || name.length > 120) throw new Error("Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200)
      throw new Error("Please enter a valid email address.");
    if (message.length < 10 || message.length > 4000)
      throw new Error("Please tell us a little more.");
    return { name, email, message, company: (data.company ?? "").trim().slice(0, 160) };
  })
  .handler(async ({ data }) => {
    const { recordLead } = await import("@/lib/leads.server");
    return recordLead(data);
  });
