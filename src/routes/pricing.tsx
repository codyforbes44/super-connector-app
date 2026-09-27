import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { useState } from "react";

import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import {
  CtaBand,
  Eyebrow,
  FaqAccordion,
  MarketingLayout,
  Section,
} from "@/components/MarketingLayout";
import {
  E911Disclosure,
  TextingDisclosure,
  TrialLimitsNote,
} from "@/components/marketing/Disclosures";
import {
  FEATURE_MATRIX,
  PLANS,
  TRIAL_DAYS,
  featureIsSoon,
  type BillingInterval,
} from "@/lib/plans";
import { SITE_URL, breadcrumbLd, faqLd, pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const solo = PLANS.find((plan) => plan.code === "solo");
const team = PLANS.find((plan) => plan.code === "team");
const scale = PLANS.find((plan) => plan.code === "scale");
const TITLE = `Pricing — SixVox plans from $${solo?.monthly}/mo with AI answering included`;
const DESCRIPTION = `Solo $${solo?.monthly}, Team $${team?.monthly}, Scale $${scale?.monthly}. AI receptionist and missed-call text-back on every plan. 14-day trial: 1 number, 1 seat, 20 AI calls. Cancel in the app.`;

const BILLING_FAQS = [
  {
    q: "Is tax included in these prices?",
    a: "Prices are shown in USD excluding tax. Sales tax or VAT is calculated at checkout from your billing address.",
  },
  {
    q: "When am I charged?",
    a: `Not during the ${TRIAL_DAYS}-day trial. After that, the plan renews monthly or yearly until you cancel. The trial includes 1 number, 1 seat, and 20 AI receptionist calls.`,
  },
  {
    q: "How do I cancel?",
    a: "Open Billing and tap Cancel plan. You keep access until the end of the period you've already paid for.",
  },
  {
    q: "Is the AI receptionist only on Team?",
    a: "No. The AI receptionist is on Solo, Team, and Scale. Solo includes 50 AI calls, Team 200, and Scale 600.",
  },
  {
    q: "Do I pay extra for texting registration?",
    a: "US carriers require business texting registration. SixVox handles that registration on every plan. Texts can be filtered until the carrier approves it.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade or downgrade from Billing. The difference is handled on your next invoice.",
  },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    ...pageHead({
      path: "/pricing",
      title: TITLE,
      description: DESCRIPTION,
      type: "product",
      image: `${SITE_URL}/og-pricing.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "SixVox",
          description: DESCRIPTION,
          url: `${SITE_URL}/pricing`,
          offers: PLANS.map((plan) => ({
            "@type": "Offer",
            name: plan.name,
            price: String(plan.monthly),
            priceCurrency: "USD",
            url: `${SITE_URL}/pricing`,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
        ),
      },
      { type: "application/ld+json", children: JSON.stringify(faqLd(BILLING_FAQS)) },
    ],
  }),
  component: PricingPage,
});

function Cell({ value }: { value: string }) {
  if (value === "Yes") {
    return (
      <>
        <Check className="h-4 w-4 text-success" aria-hidden />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === "Handled") {
    return <span>Handled</span>;
  }
  if (value === "—") {
    return (
      <>
        <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  if (value === "Coming soon") {
    return <ComingSoonBadge />;
  }
  return <span>{value}</span>;
}

function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>Flat plans for a one-truck shop</Eyebrow>
        <h1 className="font-display mt-5 text-[2rem] leading-[1.08] font-semibold text-balance sm:text-5xl">
          AI answering on every plan, including Solo.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Solo is ${PLANS[0]?.monthly}/mo, Team is ${PLANS[1]?.monthly}/mo, Scale is $
          {PLANS[2]?.monthly}/mo. Missed-call text-back and carrier texting registration are on
          every plan.
        </p>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="key-signal mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-base font-semibold sm:w-auto"
        >
          Start free trial
        </Link>

        <div
          role="group"
          aria-label="Billing interval"
          className="mt-8 inline-flex max-w-full gap-1 rounded-lg border border-border bg-card p-1"
        >
          {(["month", "year"] as BillingInterval[]).map((option) => (
            <Button
              key={option}
              type="button"
              aria-pressed={interval === option}
              onClick={() => setInterval(option)}
              variant={interval === option ? "default" : "ghost"}
              className={cn(
                "min-h-11 min-w-0 rounded-md px-3 text-xs font-semibold sm:px-5 sm:text-sm",
                interval === option ? "key-signal" : "text-muted-foreground",
              )}
            >
              {option === "month" ? "Monthly" : "Yearly · 2 months free"}
            </Button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.code}
              className={cn("glass-panel rounded-lg p-6", plan.highlighted && "border-primary/50")}
            >
              {plan.highlighted ? (
                <span className="key-signal inline-flex rounded-full px-3 py-1 text-xs font-semibold">
                  Most crews start here
                </span>
              ) : null}
              <h2 className="font-display mt-3 text-xl font-semibold">{plan.name}</h2>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="font-display mt-4 text-4xl font-semibold">
                ${interval === "month" ? plan.monthly : plan.yearly}
                <span className="text-base font-normal text-muted-foreground">
                  /{interval === "month" ? "mo" : "yr"}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.numbers} number{plan.numbers === 1 ? "" : "s"} · {plan.seats} seats ·{" "}
                {plan.aiCalls} AI calls
              </p>
              <Link
                to="/auth"
                search={{ mode: "signup", plan: plan.code, interval }}
                className={cn(
                  "mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-semibold",
                  plan.highlighted ? "key-signal" : "surface-row",
                )}
              >
                Start {plan.name} trial
              </Link>
              <ul className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    <span className="text-muted-foreground">
                      {feature.label}{" "}
                      {feature.flag && featureIsSoon(feature) ? (
                        <ComingSoonBadge flag={feature.flag} />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <TrialLimitsNote className="mt-4 text-sm leading-relaxed text-muted-foreground" />
      </Section>

      <Section className="py-8">
        <h2 className="font-display text-2xl font-semibold">What's on each plan</h2>
        <div className="mt-5 grid gap-3 md:hidden">
          {PLANS.map((plan, planIndex) => (
            <div key={plan.code} className="glass-panel rounded-3xl p-5">
              <h3 className="font-display font-semibold">{plan.name}</h3>
              <dl className="mt-3 divide-y divide-border/60">
                {FEATURE_MATRIX.map((row) => {
                  const value = [row.solo, row.team, row.scale][planIndex] ?? "—";
                  return (
                    <div
                      key={row.label}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5"
                    >
                      <dt className="text-sm text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-medium">
                        <Cell value={value} />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
        <div className="glass-panel mt-5 hidden overflow-x-auto rounded-3xl md:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">SixVox plan comparison</caption>
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase"
                >
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th key={plan.code} scope="col" className="px-5 py-3 text-xs font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-5 py-3 text-left font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  {[row.solo, row.team, row.scale].map((value, index) => (
                    <td key={PLANS[index]?.code ?? index} className="px-5 py-3">
                      <Cell value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Prices in USD, before tax. Subscriptions renew until you cancel. Cancel from Billing in
            one tap.
          </p>
          <TextingDisclosure />
          <E911Disclosure />
          <p>
            Connect Jobber under Integrations, then create or match a client and request from a call
            thread. Connect stays off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET are set.
            Tokens stay on the server.
          </p>
          <p>
            Save a Housecall Pro MAX-plan API key under Integrations, then create a customer and
            lead from a call thread. Basic and Essentials cannot use the public API.
          </p>
          <p>
            <Link to="/compare" className="font-semibold text-primary underline">
              Compare these prices with Quo, Grasshopper, Google Voice, and Jobber Receptionist
            </Link>
            . Competitor figures are list prices as of Sep 2026.
          </p>
        </div>
      </Section>

      <Section>
        <h2 className="font-display text-2xl font-semibold">Billing questions</h2>
        <div className="mt-5">
          <FaqAccordion items={BILLING_FAQS} />
        </div>
        <div className="mt-8">
          <CtaBand
            title="Start on Solo if it's just you."
            body="Move to Team when a second person needs the same inbox. The AI receptionist stays on either way."
            label="Start free trial"
          />
        </div>
      </Section>
    </MarketingLayout>
  );
}
