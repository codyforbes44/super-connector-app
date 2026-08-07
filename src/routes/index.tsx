import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Check,
  Hash,
  Inbox,
  PhoneCall,
  ShieldCheck,
  Terminal,
  Wand2,
} from "lucide-react";

import { Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

const TITLE = "Signalbox — the full Twilio console in your pocket";
const DESCRIPTION =
  "Unified SMS, MMS and WhatsApp inbox, in-app calling, AI voicemail assistants, number provisioning and unrestricted Twilio API access in one mobile app.";

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
          name: "Signalbox",
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
    body: "SMS, MMS and WhatsApp threads across every number, updating in real time with agent assignment and internal notes.",
  },
  {
    icon: PhoneCall,
    title: "Calls that just connect",
    body: "Click-to-call bridges your handset to the contact with your Twilio caller ID, plus recordings, transcripts and voicemail.",
  },
  {
    icon: Hash,
    title: "Numbers on demand",
    body: "Search, buy, wire webhooks and hand a number to a teammate — without ever opening the Twilio console.",
  },
  {
    icon: Wand2,
    title: "Verify & Lookup built in",
    body: "Send OTPs, check codes and profile any phone number for carrier, line type and caller name.",
  },
  {
    icon: Bot,
    title: "AI that answers for you",
    body: "Lifelike greetings and conversational assistants per number, with your prompt, tone, language and fallback — plus transcripts and summaries.",
  },
  {
    icon: Terminal,
    title: "Unrestricted API console",
    body: "Any Twilio endpoint, any method, straight from the app. Nothing is walled off behind a curated feature list.",
  },
  {
    icon: ShieldCheck,
    title: "Team-safe by default",
    body: "Owner, admin and agent roles. Agents only ever see the numbers and conversations assigned to them.",
  },
];

function Landing() {
  return (
    <MarketingLayout>
      <Section className="pb-10">
        <div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
          <div>
            <Eyebrow>Twilio, unrestricted</Eyebrow>
            <h1 className="font-display mt-5 text-4xl leading-[1.05] font-semibold md:text-6xl">
              Your whole Twilio account.
              <span className="text-primary"> One mobile app.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-muted-foreground">
              Signalbox is the command center Talkyto, Toktiv and Mango don&apos;t give you: a live
              omnichannel inbox, real telephony, AI answering, full number administration — and a
              raw API console for everything else.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="key-call inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-transform active:scale-[0.98]"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="key-raised inline-flex items-center rounded-full px-6 py-3.5 text-sm font-semibold"
              >
                See pricing
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Bring your own Twilio account · No usage markup · Cancel any time
            </p>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <p className="font-display text-xs font-semibold tracking-wide text-primary uppercase">
              What you get on day one
            </p>
            <ul className="mt-4 space-y-2.5">
              {[
                "Shared SMS, MMS and WhatsApp inbox",
                "Calls ringing your device in-app",
                "Voicemail, recordings and transcripts",
                "AI assistants answering per number",
                "Number search, purchase and webhook wiring",
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
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          Everything your Twilio account can do — finally usable.
        </h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
          <h2 className="font-display text-2xl font-semibold md:text-3xl">Plans that scale</h2>
          <Link to="/pricing" className="text-sm text-primary underline">
            Full comparison
          </Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
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
                className={cn(
                  "mt-4 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold",
                  plan.highlighted ? "key-call" : "key-raised",
                )}
              >
                Get started
              </Link>
            </article>
          ))}
        </div>
      </Section>

      <Section className="pt-8">
        <div className="glass-panel flex flex-col items-start gap-4 rounded-[2rem] p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Put your Twilio account to work.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Set up in minutes. Keep your numbers, keep your rates.
            </p>
          </div>
          <Link
            to="/auth"
            className="key-call inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold"
          >
            Create your workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Section>
    </MarketingLayout>
  );
}
