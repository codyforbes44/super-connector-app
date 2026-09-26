import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import { CtaBand, Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { E911Disclosure } from "@/components/marketing/Disclosures";
import { PLANS, POSITIONING_LINE } from "@/lib/plans";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";
import { TRADES, tradeBySlug } from "@/lib/trades";

export const Route = createFileRoute("/for/$trade")({
  beforeLoad: ({ params }) => {
    if (!tradeBySlug(params.trade)) throw notFound();
  },
  head: ({ params }) => {
    const trade = tradeBySlug(params.trade);
    if (!trade) {
      return { meta: [{ title: "Not found — SixVox" }] };
    }
    return {
      ...pageHead({
        path: `/for/${trade.slug}`,
        title: trade.title,
        description: trade.description,
        image: `${SITE_URL}/og-use-cases.jpg`,
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbLd([
              { name: "Home", path: "/" },
              { name: "For trades", path: "/use-cases" },
              { name: trade.name, path: `/for/${trade.slug}` },
            ]),
          ),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: trade.title,
            description: trade.description,
            url: `${SITE_URL}/for/${trade.slug}`,
            about: trade.name,
            isPartOf: { "@type": "WebSite", name: "SixVox", url: SITE_URL },
          }),
        },
      ],
    };
  },
  component: TradeLanding,
});

function TradeLanding() {
  const { trade: slug } = Route.useParams();
  const trade = tradeBySlug(slug);
  if (!trade) return null;
  const solo = PLANS[0];

  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>For {trade.name.toLowerCase()}</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.08] font-semibold text-balance sm:text-5xl">
          {trade.headline}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {trade.lede}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {POSITIONING_LINE}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/auth"
            search={{ mode: "signup", plan: "solo", interval: "month" }}
            className="key-signal inline-flex min-h-14 items-center justify-center rounded-xl px-6 text-base font-semibold"
          >
            Start free trial
          </Link>
          <Link
            to="/pricing"
            className="surface-row inline-flex min-h-14 items-center justify-center rounded-xl px-6 text-base font-semibold"
          >
            See plans from ${solo?.monthly}/mo
          </Link>
        </div>
      </Section>

      <Section className="py-6">
        <h2 className="font-display text-2xl font-semibold">Example calls</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Written examples of the job. Not customer stories.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {trade.scenarios.map((scenario) => (
            <li key={scenario.when} className="surface-row rounded-3xl p-5">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                {scenario.label}
              </p>
              <h3 className="font-display mt-2 text-lg font-semibold">{scenario.when}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{scenario.what}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="py-6">
        <h2 className="font-display text-2xl font-semibold">Jobs this line is meant to catch</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {trade.jobs.map((job) => (
            <li key={job} className="surface-row rounded-full px-4 py-2 text-sm">
              {job}
            </li>
          ))}
        </ul>
        <ul className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li>
            AI receptionist on every plan, including Solo at ${solo?.monthly}/mo for {solo?.aiCalls}{" "}
            AI calls.
          </li>
          <li>
            Missed-call text-back is included on every plan. Turn it on in that line's settings.{" "}
            <ComingSoonBadge flag="missedCallTextBack" />
          </li>
          <li>
            Calls are only recorded if you turn on transcription for a line, and callers hear a
            recording notice first.
          </li>
        </ul>
        <E911Disclosure className="mt-4 text-sm leading-relaxed text-muted-foreground" />
      </Section>

      <Section className="py-6">
        <h2 className="font-display text-xl font-semibold">Other trades</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {TRADES.filter((item) => item.slug !== trade.slug).map((item) => (
            <li key={item.slug}>
              <Link
                to="/for/$trade"
                params={{ trade: item.slug }}
                className="surface-row inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium"
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CtaBand
            title={`Get a number for the ${trade.noun} work.`}
            body="14 days free. Forward the number customers already call, or claim a new one."
            label="Start free trial"
          />
        </div>
      </Section>
    </MarketingLayout>
  );
}
