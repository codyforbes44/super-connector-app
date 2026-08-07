import { Link, createFileRoute } from "@tanstack/react-router";

import { Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";

const TITLE = "How it works — SixVox onboarding in minutes";
const DESCRIPTION =
  "Create your account, claim a number, invite your team and start answering calls and texts in under ten minutes.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    title: "Create your workspace",
    body: "Sign up with email or Google and pick a plan. Your workspace is live immediately — no sales call, no onboarding queue.",
  },
  {
    title: "Create your workspace",
    body: "Sign up with email or Google and your 14-day trial starts instantly. Numbers, messages, calls and usage sync straight in.",
  },
  {
    title: "Wire your numbers",
    body: "One tap wires webhooks for voice and messaging, so inbound texts land in the shared inbox and calls ring your device.",
  },
  {
    title: "Choose how calls are answered",
    body: "Per number: ring in-app, forward to a handset, play a lifelike greeting, or hand the call to an AI assistant with your own prompt and fallback.",
  },
  {
    title: "Invite the team",
    body: "Assign numbers and conversations to agents. Roles are enforced in the database, so people only see what belongs to them.",
  },
  {
    title: "Stay in the loop",
    body: "Push notifications for inbound calls and messages, branded email alerts for missed calls and voicemail, with quiet hours per person.",
  },
];

function HowItWorksPage() {
  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>Live in under ten minutes</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold md:text-5xl">
          From signup to your first answered call.
        </h1>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          No migration project. Keep the numbers you already use, and put a proper
          product on top of them.
        </p>
      </Section>

      <Section className="py-4">
        <ol className="grid gap-3 md:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step.title} className="glass-panel rounded-3xl p-5">
              <span className="key-signal font-display flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <h2 className="font-display mt-4 text-sm font-semibold">{step.title}</h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="glass-panel mt-8 flex flex-col items-start gap-4 rounded-3xl p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Ready when you are.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start on Solo, move up whenever your team does.
            </p>
          </div>
          <Link
            to="/auth"
            className="key-call inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold"
          >
            Create your workspace
          </Link>
        </div>
      </Section>
    </MarketingLayout>
  );
}