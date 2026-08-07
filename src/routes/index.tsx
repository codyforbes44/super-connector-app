import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Check,
  Hash,
  Inbox,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

const TITLE = "SignalBox — your business phone, inbox and AI receptionist";
const DESCRIPTION =
  "SignalBox puts calls, texts, WhatsApp, voicemail and an AI receptionist for your business number in one mobile app. Start a 14-day free trial in under a minute.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "SignalBox",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "29", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Inbox,
    title: "One live inbox",
    body: "Texts, picture messages and WhatsApp across every number, updating in real time with teammate assignment and internal notes.",
  },
  {
    icon: PhoneCall,
    title: "Calls that just connect",
    body: "Calls ring inside the app with your business caller ID, plus recordings, transcripts and voicemail you can read.",
  },
  {
    icon: Hash,
    title: "Numbers on demand",
    body: "Search, claim and hand a number to a teammate in a couple of taps. Setup is automatic.",
  },
  {
    icon: Wand2,
    title: "Verification & caller insight",
    body: "Send one-time passcodes, check them, and profile any number for carrier, line type and caller name.",
  },
  {
    icon: Bot,
    title: "An AI receptionist",
    body: "A lifelike voice answers, qualifies and books for you — with your script, tone and language, plus transcripts and summaries.",
  },
  {
    icon: Sparkles,
    title: "Connected tools",
    body: "Mail, calendar and maps live alongside the inbox so you can reply, book and route without app-switching.",
  },
  {
    icon: ShieldCheck,
    title: "Team-safe by default",
    body: "Owner, admin and agent roles. Agents only ever see the numbers and conversations assigned to them.",
  },
];

const STEPS = [
  { n: "1", title: "Create your account", body: "Email or Google. No card, no sales call." },
  { n: "2", title: "Pick your number", body: "Claim a new number or bring the one you already use." },
  { n: "3", title: "Start talking", body: "Send your first text, take your first call — right away." },
];

function Landing() {
  return (
    <MarketingLayout>
      <Section className="pt-10 pb-10 md:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
          <div>
            <Eyebrow>14-day free trial · no card required</Eyebrow>
            <h1 className="font-display mt-5 text-[2.1rem] leading-[1.06] font-semibold sm:text-4xl md:text-6xl">
              Your business line,
              <span className="text-primary"> answered beautifully.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground md:text-[0.98rem]">
              SignalBox brings calls, texts, WhatsApp, voicemail and an AI receptionist into one
              app that fits in your pocket. Set it up in about a minute.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="key-call inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold transition-transform active:scale-[0.98]"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="key-raised inline-flex items-center justify-center rounded-full px-6 py-4 text-sm font-semibold"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free for 14 days · Cancel any time · Keep your number
            </p>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <p className="font-display text-xs font-semibold tracking-wide text-primary uppercase">
              What you get on day one
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                "A shared text, picture and WhatsApp inbox",
                "Calls ringing your device in-app",
                "Voicemail, recordings and transcripts",
                "An AI receptionist per number",
                "Instant number search and setup",
                "Push and branded email alerts",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[0.85rem]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section className="py-8">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Live in three steps</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="glass-panel rounded-3xl p-5">
              <span className="key-signal flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-semibold text-primary">
                {step.n}
              </span>
              <h3 className="font-display mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="py-8">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          Everything a business line should do.
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="glass-panel rounded-3xl p-5 transition-colors hover:border-primary/40"
            >
              <span className="key-raised flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <feature.icon className="h-[1.05rem] w-[1.05rem] text-primary" />
              </span>
              <h3 className="font-display mt-4 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">
            Free for 14 days, then plans that scale
          </h2>
          <Link to="/pricing" className="text-sm text-primary underline">
            Full comparison
          </Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.code}
              className={cn("glass-panel rounded-3xl p-5", plan.highlighted && "border-primary/45")}
            >
              <h3 className="font-display text-base font-semibold">{plan.name}</h3>
              <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              <p className="font-display mt-4 text-2xl font-semibold">
                ${plan.monthly}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className={cn(
                  "mt-4 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold",
                  plan.highlighted ? "key-call" : "key-raised",
                )}
              >
                Start free
              </Link>
            </article>
          ))}
        </div>
      </Section>

      <Section className="pt-8">
        <div className="glass-panel flex flex-col items-start gap-4 rounded-[2rem] p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Ready when you are.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your workspace and send your first message in about a minute.
            </p>
          </div>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="key-call inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold md:w-auto"
          >
            Start free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>
    </MarketingLayout>
  );
}
