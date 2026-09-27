import { Link, createFileRoute } from "@tanstack/react-router";

import { CtaBand, Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import {
  CAPABILITY_ROWS,
  COMPARE_SOURCES,
  JOBBER_NOTES,
  PRICE_AS_OF,
  SOLO_COST_ROWS,
} from "@/lib/compare";
import { PLANS } from "@/lib/plans";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";

const soloMonthly = PLANS.find((plan) => plan.code === "solo")?.monthly;
const TITLE = "Compare SixVox with Quo, Grasshopper, Google Voice, and Jobber";
const DESCRIPTION = `List prices as of Sep 2026 for a solo tradesperson who wants a business line plus AI answering. SixVox Solo is $${soloMonthly} with the receptionist included.`;

const COLUMNS = [
  { key: "sixvox", label: "SixVox" },
  { key: "quo", label: "Quo (OpenPhone)" },
  { key: "grasshopper", label: "Grasshopper" },
  { key: "googleVoice", label: "Google Voice" },
  { key: "jobber", label: "Jobber Receptionist" },
] as const;

export const Route = createFileRoute("/compare")({
  head: () => ({
    ...pageHead({
      path: "/compare",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-features.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Compare", path: "/compare" },
          ]),
        ),
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  return (
    <MarketingLayout>
      <Section className="pb-6">
        <Eyebrow>{PRICE_AS_OF}</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.08] font-semibold text-balance sm:text-5xl">
          A line plus someone to answer it, without buying a whole field-service platform.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Figures below are copied from public list prices checked on Sep 26, 2026. "n/v" means that
          cell was not verified from a primary source. Nothing else was filled in.
        </p>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="key-signal mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-base font-semibold sm:w-auto"
        >
          Start free trial
        </Link>
      </Section>

      <Section className="py-6">
        <h2 className="font-display text-2xl font-semibold">
          A solo operator who wants a line and AI answering
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {PRICE_AS_OF}. Month-to-month unless noted.
        </p>
        <div className="mt-4 grid gap-3">
          {SOLO_COST_ROWS.map((row) => (
            <article key={row.setup} className="surface-row rounded-3xl p-5">
              <h3 className="font-display text-lg font-semibold">{row.setup}</h3>
              <p className="mt-1 text-2xl font-semibold">{row.monthly}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{row.gets}</p>
              <a
                href={row.href}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
              >
                Source
              </a>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Google Voice is not in this cost list. Section 3.1 prices it at $10 standalone, or
          $10/user plus Workspace, and lists its AI receptionist as "No".
        </p>
      </Section>

      <Section className="py-6">
        <h2 className="font-display text-2xl font-semibold">Feature comparison</h2>
        <p className="mt-2 text-sm text-muted-foreground">{PRICE_AS_OF}.</p>
        <div className="mt-4 grid gap-4 lg:hidden">
          {CAPABILITY_ROWS.map((row) => (
            <article key={row.capability} className="surface-row rounded-3xl p-4">
              <h3 className="font-semibold">{row.capability}</h3>
              <dl className="mt-3 space-y-3">
                {COLUMNS.map((column) => (
                  <div key={column.key}>
                    <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {column.label}
                    </dt>
                    <dd className="mt-0.5 text-sm leading-relaxed">{row[column.key]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <div className="mt-4 hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[64rem] border-separate border-spacing-0 text-left text-sm">
            <caption className="mb-3 text-left text-sm text-muted-foreground">
              {PRICE_AS_OF}.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-background px-3 py-3">
                  Capability
                </th>
                {COLUMNS.map((column) => (
                  <th key={column.key} scope="col" className="px-3 py-3 font-semibold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_ROWS.map((row) => (
                <tr key={row.capability} className="align-top">
                  <th
                    scope="row"
                    className="sticky left-0 bg-background px-3 py-3 text-left font-medium"
                  >
                    {row.capability}
                  </th>
                  {COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className="border-t border-border px-3 py-3 leading-relaxed"
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section className="py-6">
        <h2 className="font-display text-2xl font-semibold">Jobber Receptionist, in their words</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          {JOBBER_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          For a shop already committed to Jobber, their receptionist is the in-platform option.
          SixVox is the line and inbox when you don't want to buy the whole platform. Connect Jobber
          under Integrations, then create or match a client and request from a call thread. Connect
          stays off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET are set. Tokens stay on the
          server.
        </p>
      </Section>

      <Section className="py-6">
        <h2 className="font-display text-2xl font-semibold">Sources</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Checked September 26, 2026. Third-party writeups from the research notes are not repeated
          here when a primary page is listed.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {COMPARE_SOURCES.map((source) => (
            <li key={source.href}>
              <a
                href={source.href}
                className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <CtaBand
            title={`Start with the $${soloMonthly} line.`}
            body="Solo includes the AI receptionist. You can cancel from Billing in the app."
            label="Start free trial"
          />
        </div>
      </Section>
    </MarketingLayout>
  );
}
