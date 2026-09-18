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
      "Share one inbox across calls and texts with role-based access, internal notes, and assignment so the whole team stays in sync.",
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

const CASE_STUDIES = [
  {
    title: "Solopreneurs & side businesses",
    name: "Maya Chen Design Co.",
    narrative:
      "Maya ran her freelance branding business from her personal iPhone. Clients texted at 10 p.m., voicemails lived in three apps, and she never knew if a missed call was a friend or a $5,000 project. She needed a boundary without losing the personal touch.",
    bullets: [
      "Set up a dedicated business line in under 5 minutes",
      "Enabled AI voicemail that summarizes every missed call",
      "Routed all texts, calls, and voicemails into one searchable inbox",
    ],
    outcomes: [
      { metric: "40%", label: "fewer after-hours interruptions" },
      { metric: "2.1x", label: "faster client follow-up" },
      { metric: "100%", label: "personal number kept private" },
    ],
  },
  {
    title: "Trades & service professionals",
    name: "Atlas HVAC",
    narrative:
      "Atlas HVAC's two technicians were usually under a sink or on a roof when homeowners called. Missed calls meant competitors got the job, and the office admin was spending hours returning voicemails every evening.",
    bullets: [
      "AI receptionist answers every call and qualifies the lead",
      "Captures address, issue type, and urgency before hanging up",
      "Sends a summary and booking link to the dispatch team",
    ],
    outcomes: [
      { metric: "6 hrs", label: "saved weekly on callbacks" },
      { metric: "28%", label: "more estimates booked" },
      { metric: "24/7", label: "call capture, even on weekends" },
    ],
  },
  {
    title: "Small teams & agencies",
    name: "Pine & Co. Marketing",
    narrative:
      "Pine & Co. had six account managers juggling client SMS threads across personal phones. Messages got lost, replies were duplicated, and there was no record of who promised what. Onboarding new hires meant handing over a phone number.",
    bullets: [
      "Shared team inbox with role-based access",
      "Internal notes and assignment for every thread",
      "One business number used by the whole team",
    ],
    outcomes: [
      { metric: "3", label: "separate phone services retired" },
      { metric: "90%", label: "faster thread resolution" },
      { metric: "Zero", label: "duplicated client replies" },
    ],
  },
  {
    title: "Remote & mobile workers",
    name: "Bridge Consulting",
    narrative:
      "Bridge Consulting's founder split time between Nashville, Lisbon, and client sites. She wanted to keep her U.S. business number but local data abroad, and she needed calls to follow her laptop, not a desk phone.",
    bullets: [
      "Forwarded her existing U.S. number to SixVox",
      "Purchased travel eSIMs inside the app before each trip",
      "Made and received business calls from her laptop or phone",
    ],
    outcomes: [
      { metric: "$180/mo", label: "saved on roaming" },
      { metric: "1 app", label: "for calls, texts, and data" },
      { metric: "Global", label: "coverage, local caller ID" },
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

      <Section className="py-6 md:py-10">
        <Reveal>
          <h2 className="font-display text-2xl font-semibold md:text-3xl">
            Case studies in detail.
          </h2>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
            Real workflows, real outcomes. See how each persona puts SixVox to work.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-5">
          {CASE_STUDIES.map((study, index) => (
            <Reveal
              key={study.name}
              as="article"
              delay={index * 60}
              className="surface-row rounded-3xl p-5 md:p-7"
            >
              <div className="flex flex-col gap-6 md:flex-row md:gap-10">
                <div className="flex-1">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-primary">
                    {study.title}
                  </span>
                  <h3 className="font-display mt-1.5 text-lg font-semibold md:text-xl">
                    {study.name}
                  </h3>
                  <p className="mt-3 text-[0.9rem] leading-relaxed text-muted-foreground">
                    {study.narrative}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {study.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-[0.85rem] leading-relaxed text-foreground"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col justify-between gap-3 md:w-56">
                  {study.outcomes.map((outcome) => (
                    <div
                      key={outcome.label}
                      className="glass-panel flex flex-col rounded-2xl px-4 py-3"
                    >
                      <span className="font-display text-2xl font-semibold text-primary">
                        {outcome.metric}
                      </span>
                      <span className="text-[0.75rem] leading-snug text-muted-foreground">
                        {outcome.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
              value: "Calls, texts and eSIM data travel with you, not your desk phone.",
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
