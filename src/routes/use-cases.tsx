import { Link, createFileRoute } from "@tanstack/react-router";

import { CtaBand, Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";
import { TRADES } from "@/lib/trades";

const TITLE = "SixVox for plumbers, HVAC, electricians, and small crews";
const DESCRIPTION =
  "Example situations for trades that miss calls on the job. Not customer stories. Open a page for your trade and start a trial.";

export const Route = createFileRoute("/use-cases")({
  head: () => ({
    ...pageHead({
      path: "/use-cases",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-use-cases.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "For trades", path: "/use-cases" },
          ]),
        ),
      },
    ],
  }),
  component: UseCasesPage,
});

function UseCasesPage() {
  return (
    <MarketingLayout>
      <Section className="pb-6">
        <Eyebrow>Built for the person on the tools</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.08] font-semibold text-balance sm:text-5xl">
          The call comes in while you're already on a job.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          SixVox is for a US owner-operator or a crew of 2–5. The scenes below are examples, not
          customer stories. Pick your trade for the version of that call.
        </p>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="key-signal mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-base font-semibold sm:w-auto"
        >
          Start free trial
        </Link>
      </Section>

      <Section className="py-4">
        <ul className="grid gap-3 md:grid-cols-2">
          {TRADES.map((trade) => (
            <li key={trade.slug} className="surface-row rounded-3xl p-5">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">Example</p>
              <h2 className="font-display mt-2 text-xl font-semibold">{trade.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {trade.scenarios[0]?.what}
              </p>
              <Link
                to="/for/$trade"
                params={{ trade: trade.slug }}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
              >
                SixVox for {trade.name.toLowerCase()}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CtaBand
            title="One number for the work, not your personal cell."
            body="Forward the line on your truck, or claim a new one, and let the receptionist cover the calls you can't take."
            label="Get a number"
          />
        </div>
      </Section>
    </MarketingLayout>
  );
}
