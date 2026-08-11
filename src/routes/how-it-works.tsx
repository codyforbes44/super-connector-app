import { createFileRoute } from "@tanstack/react-router";

import { CtaBand, Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { breadcrumbLd, pageHead } from "@/lib/seo";

const TITLE = "How it works — SixVox onboarding in minutes";
const DESCRIPTION =
  "Create your account, claim a number, invite your team and start answering calls and texts in under ten minutes.";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    ...pageHead({ path: "/how-it-works", title: TITLE, description: DESCRIPTION }),
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

const STEPS = [
  {
    title: "Create your workspace",
    time: "about 30 seconds",
    body: "Sign up with email or Google and pick a plan. Your workspace is live immediately — no sales call, no onboarding queue.",
    detail: "Behind the scenes we provision your workspace, roles and notification settings.",
  },
  {
    title: "Sync your existing numbers",
    time: "2 minutes",
    body: "Port your current numbers or set call forwarding from your existing carrier. SixVox answers behind the scenes while your callers keep dialing the same digits.",
    detail: "We generate the exact carrier forwarding codes for your provider so you just dial them.",
  },
  {
    title: "Wire your numbers",
    time: "one tap",
    body: "One tap wires webhooks for voice and messaging, so inbound texts land in the shared inbox and calls ring your device.",
    detail: "Voice, SMS and status callbacks are pointed at SixVox and verified straight away.",
  },
  {
    title: "Choose how calls are answered",
    time: "3 minutes",
    body: "Per number: ring in-app, forward to a handset, play a lifelike greeting, or hand the call to an AI assistant with your own prompt and fallback.",
    detail: "Callers hear three real rings before the AI or voicemail picks up.",
  },
  {
    title: "Invite the team",
    time: "1 minute per person",
    body: "Assign numbers and conversations to agents. Roles are enforced in the database, so people only see what belongs to them.",
    detail: "Owner, admin and agent scopes are applied at the row level, not just in the UI.",
  },
  {
    title: "Stay in the loop",
    time: "ongoing",
    body: "Push notifications for inbound calls and messages, branded email alerts for missed calls and voicemail, with quiet hours per person.",
    detail: "High-priority push for calls, batched email for everything that can wait.",
  },
];

function HowItWorksPage() {
  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>Live in under ten minutes</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.06] font-semibold text-balance sm:text-4xl md:text-5xl">
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
            <li key={step.title} className="surface-row rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display flex size-10 items-center justify-center rounded-2xl bg-primary/18 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                  {step.time}
                </span>
              </div>
              <h2 className="font-display mt-4 text-sm font-semibold">{step.title}</h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
              <p className="mt-3 border-t border-border/60 pt-3 text-[0.75rem] leading-relaxed text-muted-foreground">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <CtaBand
            title="Ready when you are."
            body="Start on Solo and move up whenever your team does."
            label="Create your workspace"
            note="14 days free · no card required"
          />
        </div>
      </Section>
    </MarketingLayout>
  );
}