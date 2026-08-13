import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Briefcase, Globe, Users, Wrench } from "lucide-react";

import {
  CtaBand,
  Eyebrow,
  MarketingLayout,
  Section,
} from "@/components/MarketingLayout";
import { Reveal } from "@/components/marketing/Reveal";
import { FeatureGroup, IconTile, TONES } from "@/components/marketing/FeatureList";
import { SITE_URL, pageHead } from "@/lib/seo";

const TITLE = "Use Cases — SixVox for modern business communication";
const DESCRIPTION =
  "See how solopreneurs, trades, teams and mobile workers use SixVox as a business phone, shared inbox, AI receptionist and global calling app.";

export const Route = createFileRoute("/use-cases")({
  head: () => ({
    ...pageHead({
      path: "/use-cases",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-use-cases.jpg`,
    }),
  }),
  component: UseCasesPage,
});

const USE_CASES = [
  {
    icon: Briefcase,
    title: "Solopreneurs & side businesses",
    problem: "Your personal number is your business number, and customers call at all hours.",
    outcome:
      "Give your business its own line with a professional voicemail, searchable transcripts, and a clear boundary between work and life.",
    bullets: [
      "Separate business caller ID",
      "Voicemail-to-text and summaries",
      "One inbox for texts and calls",
    ],
  },
  {
    icon: Wrench,
    title: "Trades & service professionals",
    problem: "You're on the job when leads call. Missed calls mean missed work.",
    outcome:
      "Your AI receptionist answers every call, qualifies the job, books the estimate, and leaves you a summary so you follow up with the right customers first.",
    bullets: [
      "AI voice agent answers 24/7",
      "Calendar-aware booking",
      "Caller qualification and notes",
    ],
  },
  {
    icon: Users,
    title: "Small teams & agencies",
    problem: "Messages are scattered across personal phones and no one knows who owns the reply.",
    outcome:
      "Share one inbox across calls, SMS and WhatsApp with role-based access, internal notes, and assignment so the whole team stays in sync.",
    bullets: [
      "Real-time shared inbox",
      "Internal notes and assignment",
      "Owner, admin and agent roles",
    ],
  },
  {
    icon: Globe,
    title: "Remote & mobile workers",
    problem: "You travel, work from the field, or need to keep a number you already own.",
    outcome:
      "Forward your existing number to SixVox, pick up local data eSIMs abroad, and call or text from the same business line wherever you are.",
    bullets: [
      "Keep your current number via forwarding",
      "Travel eSIMs in the app",
      "Works on iOS, Android and the web",
    ],
  },
];

function UseCasesPage() {
  return (
    <MarketingLayout>
      <Section className="relative pt-8 pb-10 md:pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[90px]"
        />
        <div className="max-w-3xl">
          <Eyebrow>Built for the way you actually work</Eyebrow>
          <h1 className="font-display mt-5 text-[2.15rem] leading-[1.05] font-semibold text-balance sm:text-4xl md:text-6xl">
            SixVox for every kind of
            <span className="text-primary text-glow"> small business.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[0.95rem] leading-relaxed text-pretty text-muted-foreground md:text-[1rem]">
            Whether you run a one-person shop, a service crew, a team, or a mobile operation, SixVox gives you a business phone, shared inbox, AI receptionist and global calling in one app.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="key-signal inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] sm:min-h-12 sm:text-sm"
            >
              Start free — 14 days
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="surface-row inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold sm:min-h-12 sm:text-sm"
            >
              See plans
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((useCase, index) => (
            <Reveal
              key={useCase.title}
              as="article"
              delay={(index % 4) * 80}
              className="surface-row flex h-full flex-col rounded-3xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
            >
              <IconTile icon={useCase.icon} tone={TONES[index % TONES.length]!} />
              <h2 className="font-display mt-4 text-sm font-semibold">{useCase.title}</h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                {useCase.problem}
              </p>
              <p className="mt-3 text-[0.82rem] leading-relaxed">{useCase.outcome}</p>
              <ul className="mt-4 flex-1 space-y-1.5">
                {useCase.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="text-[0.75rem] leading-relaxed text-muted-foreground"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="py-9 md:py-14">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold md:text-3xl">
            What changes when you switch.
          </h2>
        </Reveal>
        <FeatureGroup className="mt-6">
          {[
            {
              label: "Never miss a lead again",
              value: "AI + shared inbox means every caller gets a response, even when the team is busy.",
            },
            {
              label: "One bill, one app",
              value: "Cancel the separate voicemail, forwarding, and answering-service subscriptions.",
            },
            {
              label: "Work from anywhere",
              value: "Calls, texts, WhatsApp and eSIM data travel with you, not your desk phone.",
            },
          ].map((row, index) => (
            <Reveal
              key={row.label}
              as="div"
              delay={index * 60}
              className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"
            >
              <div>
                <p className="font-display text-[0.95rem] font-semibold">{row.label}</p>
                <p className="mt-1 max-w-2xl text-[0.82rem] leading-relaxed text-muted-foreground">
                  {row.value}
                </p>
              </div>
            </Reveal>
          ))}
        </FeatureGroup>
      </Section>

      <Section className="pt-9 pb-16 md:pt-14 md:pb-20">
        <Reveal>
          <CtaBand
            title="Find your use case. Start your free line."
            body="Get a business number, shared inbox and AI receptionist — 14 days free, no card required."
            label="Start free trial"
          />
        </Reveal>
      </Section>
    </MarketingLayout>
  );
}
