import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Minus } from "lucide-react";
import { useState } from "react";

import {
  CtaBand,
  Eyebrow,
  FaqAccordion,
  MarketingLayout,
  Section,
} from "@/components/MarketingLayout";
import { FEATURE_MATRIX, PLANS, type BillingInterval } from "@/lib/plans";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

const TITLE = "Pricing — SixVox business phone plans from $29/mo";
const DESCRIPTION =
  "Compare SixVox Solo, Team and Scale: numbers, seats, WhatsApp, AI receptionist and API access. Every plan starts with a 14-day free trial, no card required.";

const BILLING_FAQS = [
  {
    q: "Is tax included in these prices?",
    a: "Prices are shown in USD excluding tax. Any applicable sales tax or VAT is calculated and shown at checkout based on your billing address.",
  },
  {
    q: "When am I charged?",
    a: "Never during the 14-day trial. Once you pick a plan you're charged immediately, then automatically each month or year until you cancel.",
  },
  {
    q: "How do I cancel?",
    a: "From Billing inside the app, in one tap. You keep access until the end of the period you've already paid for, and we don't charge again.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade or downgrade at any time — the difference is pro-rated on your next invoice.",
  },
  {
    q: "What about call and message usage?",
    a: "Usage is billed at cost with no markup and no per-message surcharge, itemised on your invoice alongside your plan.",
  },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    ...pageHead({ path: "/pricing", title: TITLE, description: DESCRIPTION, type: "product" }),
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
            availability: "https://schema.org/InStock",
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
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: BILLING_FAQS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <MarketingLayout>
      <Section className="pb-10">
        <Eyebrow>Simple, per-workspace pricing</Eyebrow>
        <h1 className="font-display mt-5 text-4xl leading-[1.05] font-semibold md:text-5xl">
          Start free. Pick a plan when you're ready.
        </h1>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          Every plan starts with 14 days free and no card. Usage is billed at cost — no markup, no
          per-message surcharge, no locked features.
        </p>

        <div className="glass-panel mt-8 inline-flex rounded-full p-1">
          {(["month", "year"] as BillingInterval[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={interval === option}
              onClick={() => setInterval(option)}
              className={cn(
                "rounded-full px-5 py-2 text-xs font-semibold transition-all",
                interval === option
                  ? "key-signal text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "month" ? "Monthly" : "Yearly · 2 months free"}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.code}
              className={cn("glass-panel rounded-3xl p-6", plan.highlighted && "border-primary/45")}
            >
              {plan.highlighted ? (
                <span className="key-signal inline-flex rounded-full px-3 py-1 text-[0.65rem] font-semibold text-primary">
                  Most popular
                </span>
              ) : null}
              <h2 className="font-display mt-3 text-lg font-semibold">{plan.name}</h2>
              <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              <p className="font-display mt-5 text-3xl font-semibold">
                ${interval === "month" ? plan.monthly : plan.yearly}
                <span className="text-sm font-normal text-muted-foreground">
                  /{interval === "month" ? "mo" : "yr"}
                </span>
              </p>
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                USD, excluding tax · {plan.numbers} number{plan.numbers === 1 ? "" : "s"} ·{" "}
                {plan.seats === null
                  ? "unlimited seats"
                  : `${plan.seats} seat${plan.seats === 1 ? "" : "s"}`}
              </p>
              <Link
                to="/auth"
                search={{ mode: "signup", plan: plan.code, interval }}
                className={cn(
                  "mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold",
                  plan.highlighted ? "key-call" : "key-raised",
                )}
              >
                Start {plan.name} free
              </Link>
              <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
                14 days free, then ${interval === "month" ? plan.monthly : plan.yearly}/
                {interval === "month" ? "mo" : "yr"}
              </p>
              <ul className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[0.82rem]">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section className="py-8">
        <h2 className="font-display text-xl font-semibold">Compare every plan</h2>
        <div className="glass-panel mt-5 overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th key={plan.code} className="px-5 py-3 text-xs font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 text-[0.82rem] text-muted-foreground">{row.label}</td>
                  {[row.solo, row.team, row.scale].map((value, index) => (
                    <td key={index} className="px-5 py-3 text-[0.82rem]">
                      {value === "Yes" ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : value === "—" ? (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          All prices in USD and exclusive of tax; applicable sales tax or VAT is calculated at
          checkout. Subscriptions renew automatically each billing period until cancelled. Cancel
          any time from Billing and keep access until the end of the paid period. Call and message
          usage is billed at cost.
        </p>
      </Section>

      <Section className="py-8">
        <h2 className="font-display text-xl font-semibold">Billing questions</h2>
        <div className="mt-5">
          <FaqAccordion items={BILLING_FAQS} />
        </div>
      </Section>

      <Section className="pt-4">
        <CtaBand
          title="Try the whole thing free."
          body="Every plan starts with the full feature set for 14 days. Pick the one that fits once you've seen it working."
          note="No card required to start"
        />
      </Section>
    </MarketingLayout>
  );
}