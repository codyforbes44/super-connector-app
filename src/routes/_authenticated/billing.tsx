import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { Screen, Skeleton } from "@/components/screen";
import { BillingHistory } from "@/components/BillingHistory";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { errorMessage } from "@/lib/format";
import { createPortalSession } from "@/lib/payments.functions";
import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import {
  PLANS,
  TRIAL_DAYS,
  featureIsSoon,
  priceIdFor,
  type BillingInterval,
  type PlanCode,
} from "@/lib/plans";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/billing")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { plan?: PlanCode; interval?: BillingInterval; checkout?: "done" } => {
    const plan = PLANS.find((item) => item.code === search["plan"])?.code;
    return {
      ...(plan ? { plan } : {}),
      ...(plan ? { interval: search["interval"] === "year" ? "year" : "month" } : {}),
      ...(search["checkout"] === "done" ? { checkout: "done" as const } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Billing — SixVox" },
      { name: "description", content: "Choose a SixVox plan and manage your subscription." },
    ],
  }),
  component: BillingScreen,
});

function BillingScreen() {
  const navigate = useNavigate();
  const { plan: wantedPlan, interval: wantedInterval, checkout } = Route.useSearch();
  const { subscription, plan, isActive, isSuperAdmin, loading, refetch } = useSubscription();
  const [interval, setInterval] = useState<BillingInterval>(wantedInterval ?? "month");
  const [checkoutPrice, setCheckoutPrice] = useState<string | null>(
    wantedPlan && paymentsConfigured() ? priceIdFor(wantedPlan, wantedInterval ?? "month") : null,
  );
  const [portalBusy, setPortalBusy] = useState(false);
  const [activating, setActivating] = useState(checkout === "done");
  const pollRef = useRef<number | null>(null);

  const trialEndsAt = subscription?.trial_ends_at ?? null;
  const trialDaysLeft =
    subscription?.status === "trialing" && trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;
  const currentAmount = plan
    ? subscription?.billing_interval === "year"
      ? `$${plan.yearly}/yr`
      : `$${plan.monthly}/mo`
    : null;

  // After returning from Stripe, trust the database (written by the webhook)
  // rather than the redirect. Poll briefly so a slow webhook never looks like
  // a failed payment.
  useEffect(() => {
    if (checkout !== "done") return;
    let attempts = 0;
    setActivating(true);
    setCheckoutPrice(null);
    const tick = async () => {
      attempts += 1;
      const result = await refetch();
      const row = result.data?.row ?? null;
      const live = Boolean(result.data?.isSuperAdmin) || (row?.stripe_subscription_id ?? null);
      if (live || attempts >= 12) {
        setActivating(false);
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 2500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [checkout, refetch]);

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const result = await createPortalSession({
        data: { returnUrl: window.location.href, environment: getStripeEnvironment() },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank", "noopener");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPortalBusy(false);
    }
  };

  return (
    <div className="min-w-0">
      <ScreenHeader
        title="Billing"
        subtitle={
          isSuperAdmin
            ? "Super admin — full access, no plan required"
            : isActive
              ? `${plan?.name ?? "Active"} plan`
              : "Choose a plan to unlock SixVox"
        }
      />
      <PaymentTestModeBanner />

      <Screen className="space-y-4" onRefresh={() => refetch()}>
        {activating ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Payment received — we&apos;re activating your workspace. This usually takes a few
              seconds.
            </p>
          </div>
        ) : null}

        {subscription?.status === "past_due" && !subscription.comped ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-card p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold">We couldn&apos;t take your last payment</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your workspace keeps working while we retry. Update your card to avoid interruption.
              </p>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-3 h-3 w-2/3" />
            <Skeleton className="mt-5 h-11 w-full rounded-xl" />
          </div>
        ) : null}

        {subscription && isActive ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="key-signal flex h-11 w-11 items-center justify-center rounded-xl">
                <Sparkles className="h-[1.05rem] w-[1.05rem] text-primary" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold">
                  {plan?.name ?? "SixVox"} ·{" "}
                  {subscription.comped ? "Complimentary" : subscription.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  {trialDaysLeft !== null
                    ? `Trial — ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left${
                        trialEndsAt
                          ? `, first charge ${new Date(trialEndsAt).toLocaleDateString()}`
                          : ""
                      }${currentAmount ? ` (${currentAmount})` : ""}`
                    : subscription.current_period_end
                      ? `${subscription.cancel_at_period_end ? "Ends" : "Renews"} ${new Date(
                          subscription.current_period_end,
                        ).toLocaleDateString()}${currentAmount ? ` · ${currentAmount}` : ""}`
                      : "No renewal date on file"}
                </p>
              </div>
            </div>
            {subscription.stripe_customer_id ? (
              <div className="mt-4 grid gap-2">
                <Button
                  variant="secondary"
                  className="h-12 w-full rounded-xl"
                  onClick={openPortal}
                  disabled={portalBusy}
                >
                  {portalBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Manage payment & invoices
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl"
                  onClick={openPortal}
                  disabled={portalBusy}
                >
                  Cancel plan
                </Button>
                <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
                  Cancel plan opens billing. You keep access until the end of the period you have
                  already paid for.
                </p>
              </div>
            ) : null}
            <Button
              className="key-call mt-2 h-11 w-full rounded-xl"
              onClick={() => navigate({ to: "/inbox" })}
            >
              Go to the command center
            </Button>
          </div>
        ) : null}

        {checkoutPrice ? null : <BillingHistory />}

        {checkoutPrice ? (
          <div className="space-y-3">
            <StripeEmbeddedCheckout
              priceId={checkoutPrice}
              returnUrl={`${window.location.origin}/billing?checkout=done`}
            />
            <Button
              variant="ghost"
              className="h-11 w-full rounded-xl"
              onClick={() => {
                setCheckoutPrice(null);
                void refetch();
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="flex rounded-xl border border-border bg-card p-1">
              {(["month", "year"] as BillingInterval[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setInterval(option)}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
                    interval === option
                      ? "key-signal text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option === "month" ? "Monthly" : "Yearly · 2 months free"}
                </button>
              ))}
            </div>

            {PLANS.map((item) => (
              <div
                key={item.code}
                className={cn(
                  "rounded-2xl border border-border bg-card p-4",
                  item.highlighted && "border-primary/45",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold">{item.name}</h2>
                    <p className="text-xs text-muted-foreground">{item.tagline}</p>
                  </div>
                  <p className="font-display text-lg font-semibold whitespace-nowrap">
                    ${interval === "month" ? item.monthly : item.yearly}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{interval === "month" ? "mo" : "yr"}
                    </span>
                  </p>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {item.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2 text-[0.8rem]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span className="text-muted-foreground">
                        {feature.label}
                        {feature.flag && featureIsSoon(feature) ? (
                          <ComingSoonBadge flag={feature.flag} className="ml-2 align-middle" />
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn("mt-4 h-11 w-full rounded-xl", item.highlighted && "key-call")}
                  variant={item.highlighted ? "default" : "secondary"}
                  disabled={!paymentsConfigured()}
                  onClick={() => setCheckoutPrice(priceIdFor(item.code, interval))}
                >
                  {plan?.code === item.code && isActive ? "Change billing" : `Choose ${item.name}`}
                </Button>
                <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
                  {TRIAL_DAYS} days free, then ${interval === "month" ? item.monthly : item.yearly}/
                  {interval === "month" ? "mo" : "yr"}
                </p>
              </div>
            ))}

            <p className="px-1 pb-2 text-[0.7rem] leading-relaxed text-muted-foreground">
              Prices in USD. Sales tax or VAT is calculated at checkout. Subscriptions renew
              automatically each {interval === "month" ? "month" : "year"} until cancelled — cancel
              any time from this screen and keep access until the end of the paid period. Payments
              are handled by our payment network partner, whose descriptor may appear on your card
              statement.
            </p>
          </>
        )}
      </Screen>
    </div>
  );
}
