import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { errorMessage } from "@/lib/format";
import { createPortalSession } from "@/lib/payments.functions";
import { PLANS, priceIdFor, type BillingInterval } from "@/lib/plans";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/billing")({
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
  const { subscription, plan, isActive, isSuperAdmin, loading, refetch } = useSubscription();
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [checkoutPrice, setCheckoutPrice] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

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
    <div className="pb-10">
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

      <div className="space-y-4 px-4 pt-4">
        {loading ? (
          <div className="glass-panel flex items-center justify-center rounded-3xl p-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : null}

        {subscription && isActive ? (
          <div className="glass-panel rounded-3xl p-4">
            <div className="flex items-center gap-3">
              <span className="key-signal flex h-11 w-11 items-center justify-center rounded-full">
                <Sparkles className="h-[1.05rem] w-[1.05rem] text-primary" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold">
                  {plan?.name ?? "SixVox"} · {subscription.comped ? "Complimentary" : subscription.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscription.current_period_end
                    ? `${subscription.cancel_at_period_end ? "Ends" : "Renews"} ${new Date(
                        subscription.current_period_end,
                      ).toLocaleDateString()}`
                    : "No renewal date on file"}
                </p>
              </div>
            </div>
            {subscription.stripe_customer_id ? (
              <Button
                variant="secondary"
                className="mt-4 w-full rounded-full"
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
            ) : null}
            <Button
              className="key-call mt-2 w-full rounded-full"
              onClick={() => navigate({ to: "/inbox" })}
            >
              Go to the command center
            </Button>
          </div>
        ) : null}

        {checkoutPrice ? (
          <div className="space-y-3">
            <StripeEmbeddedCheckout
              priceId={checkoutPrice}
              returnUrl={`${window.location.origin}/billing?checkout=done`}
            />
            <Button
              variant="ghost"
              className="w-full rounded-full"
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
            <div className="glass-panel flex rounded-full p-1">
              {(["month", "year"] as BillingInterval[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setInterval(option)}
                  className={cn(
                    "flex-1 rounded-full py-2 text-xs font-semibold transition-all",
                    interval === option
                      ? "key-signal text-primary"
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
                  "glass-panel rounded-3xl p-4",
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
                    <li key={feature} className="flex items-start gap-2 text-[0.8rem]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn("mt-4 w-full rounded-full", item.highlighted && "key-call")}
                  variant={item.highlighted ? "default" : "secondary"}
                  disabled={!paymentsConfigured()}
                  onClick={() => setCheckoutPrice(priceIdFor(item.code, interval))}
                >
                  {plan?.code === item.code && isActive ? "Change billing" : `Choose ${item.name}`}
                </Button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}