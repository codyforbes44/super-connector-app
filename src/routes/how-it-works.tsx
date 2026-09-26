import { Link, createFileRoute } from "@tanstack/react-router";

import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import { CtaBand, Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { E911Disclosure } from "@/components/marketing/Disclosures";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";

const TITLE = "How SixVox works for a trades business line";
const DESCRIPTION =
  "Sign up, forward the number customers already call or claim one, and turn on the AI receptionist. Text-back, port-in, and the native app are marked coming soon.";

const STEPS = [
  {
    title: "Start the trial",
    body: "Create an account with email or Google. Choosing a plan collects payment details and starts a 14-day trial with 1 number, 1 seat, and 20 AI receptionist calls. Nothing is charged until the trial ends.",
  },
  {
    title: "Put your business number on SixVox",
    body: "Forward the number already on your truck, website, and Google listing. Callers keep dialing the same digits. Claiming a new local number is in onboarding when your account can buy one.",
  },
  {
    title: "Choose who answers",
    body: "Per number: ring the app, forward to your cell, take a voicemail, or hand the call to the AI receptionist. Callers hear rings before the assistant or voicemail picks up.",
  },
  {
    title: "Read it when you climb down",
    body: "The call, the text, and the voicemail land in one inbox. Team and Scale let you assign a thread to someone else on the crew.",
  },
];

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    ...pageHead({
      path: "/how-it-works",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-how-it-works.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "How it works", path: "/how-it-works" },
          ]),
        ),
      },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <MarketingLayout>
      <Section className="pb-6">
        <Eyebrow>From the phone you already carry</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.08] font-semibold text-balance sm:text-5xl">
          Keep the number. Change what happens when you can't answer.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Calls are only recorded if you turn on transcription for a line, and callers hear a
          recording notice first.
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
        <ol className="grid gap-3 md:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="surface-row rounded-3xl p-5">
              <span className="font-display flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h2 className="font-display mt-4 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
          <li className="flex flex-wrap items-center gap-2">
            Missed-call text-back <ComingSoonBadge flag="missedCallTextBack" />
          </li>
          <li className="flex flex-wrap items-center gap-2">
            Port-in for the old number <ComingSoonBadge flag="portIn" />
          </li>
          <li className="flex flex-wrap items-center gap-2">
            Native iPhone and Android calling <ComingSoonBadge flag="nativeApp" />
          </li>
        </ul>
        <E911Disclosure className="mt-4 text-sm leading-relaxed text-muted-foreground" />
        <div className="mt-8">
          <CtaBand
            title="Get a number on the trial."
            body="Solo is enough if it's just you. Team is there when a second person needs the inbox."
            label="Start free trial"
          />
        </div>
      </Section>
    </MarketingLayout>
  );
}
