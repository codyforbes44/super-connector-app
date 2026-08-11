import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  Check,
  Hash,
  Inbox,
  PhoneCall,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

import receptionistSrcSet from "@/assets/ai-receptionist.jpg?w=420;640;900&format=webp&as=srcset";
import receptionistShot from "@/assets/ai-receptionist.jpg?w=640&format=webp";
import {
  CtaBand,
  Eyebrow,
  FaqAccordion,
  MarketingLayout,
  Section,
  StatBand,
} from "@/components/MarketingLayout";
import { LivePhoneDemo } from "@/components/marketing/LivePhoneDemo";
import { Reveal } from "@/components/marketing/Reveal";
import { StickySignupBar } from "@/components/marketing/StickySignupBar";
import { PLANS } from "@/lib/plans";
import { SITE_URL, pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

const TITLE = "SixVox — business phone, shared inbox and AI receptionist";
const DESCRIPTION =
  "Run your business line from your phone: calls, texts, WhatsApp, voicemail and an AI receptionist in one app. 14-day free trial, no card required.";

export const Route = createFileRoute("/")({
  head: () => ({
    ...pageHead({
      path: "/",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-home.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "SixVox",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          description: DESCRIPTION,
          url: SITE_URL,
          offers: PLANS.map((plan) => ({
            "@type": "Offer",
            name: plan.name,
            price: String(plan.monthly),
            priceCurrency: "USD",
            url: `${SITE_URL}/pricing`,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "SixVox",
          url: SITE_URL,
          description: DESCRIPTION,
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
    body: "Calls ring inside the app with your business caller ID, plus voicemail and transcripts you can read. Live calls are never recorded.",
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

const REPLACES = [
  "A second phone in your pocket",
  "A voicemail app that only records",
  "An answering service you pay per call",
  "A desk phone system nobody answers",
];

const CONTRAST = [
  {
    them: "A curated slice of what your line can do",
    us: "Messaging, calling, numbers, AI answering and raw API access",
  },
  { them: "Voicemail you have to listen to", us: "Voicemail read as text, summarised and searchable" },
  { them: "One login, one user", us: "Real owner, admin and agent roles scoped in the database" },
  { them: "Per-message surcharges", us: "Flat plan, usage billed at cost" },
];

const HOME_FAQS = [
  {
    q: "Do I need a card to start?",
    a: "No. The 14-day trial starts the moment you sign up. Add a plan when you're ready — prices are in USD and tax is calculated at checkout.",
  },
  {
    q: "Can I keep the number I already use?",
    a: "Yes. Port it in, or leave it where it is and forward calls to SixVox so callers keep dialling the same digits.",
  },
  {
    q: "Does it really ring like a phone?",
    a: "Calls ring inside the app with your business caller ID, with push notifications when the app is in the background.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes, from Billing in one tap. Access continues to the end of the period you've paid for.",
  },
];

function Landing() {
  return (
    <MarketingLayout>
      <Section className="pt-8 pb-10 md:pt-14">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_1fr]">
          <div>
            <Eyebrow>14-day free trial · no card required</Eyebrow>
            <h1 className="font-display mt-5 text-[2.15rem] leading-[1.05] font-semibold text-balance sm:text-4xl md:text-6xl">
              Your business line,
              <span className="text-primary"> answered beautifully.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-pretty text-muted-foreground md:text-[1rem]">
              SixVox brings calls, texts, WhatsApp, voicemail and an AI receptionist into one
              app that fits in your pocket. Set it up in about a minute.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="key-call inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-transform active:scale-[0.98] sm:min-h-12 sm:text-sm"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/how-it-works"
                className="key-raised inline-flex min-h-14 items-center justify-center rounded-full px-6 text-base font-semibold sm:min-h-12 sm:text-sm"
              >
                See how it works
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free for 14 days · Cancel any time · Keep your number
            </p>
          </div>

          <div className="relative">
            <img
              src={heroApp}
              srcSet={heroSrcSet}
              sizes="(min-width: 768px) 44rem, 100vw"
              width={1280}
              height={1024}
              fetchPriority="high"
              decoding="async"
              alt="SixVox running on a phone, showing the unified inbox of calls, texts and voicemail"
              className="aspect-[5/4] w-full rounded-[2rem] object-cover shadow-2xl"
            />
          </div>
        </div>

        <div className="mt-10">
          <StatBand
            stats={[
              { value: "14 days", label: "Free trial, no card required" },
              { value: "< 1 min", label: "From signup to your first message" },
              { value: "3 channels", label: "Calls, SMS/MMS and WhatsApp in one thread list" },
              { value: "24/7", label: "AI receptionist answering when you can't" },
            ]}
          />
        </div>
      </Section>

      <Section className="py-9 md:py-14">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          One app instead of four half-solutions.
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {REPLACES.map((item) => (
            <li key={item} className="glass-panel rounded-3xl p-4 text-[0.85rem] sm:p-5">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <X className="h-3.5 w-3.5 text-destructive" aria-hidden />
                Replaces
              </span>
              <p className="mt-2 leading-relaxed text-pretty">{item}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="py-9 md:py-14">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Live in three steps</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="glass-panel rounded-3xl p-5">
              <span className="key-signal flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-semibold">
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

      <Section className="py-9 md:py-14">
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

      <Section className="py-9 md:py-14">
        <div className="glass-panel grid items-center gap-8 rounded-[2rem] p-6 sm:p-8 md:grid-cols-[1fr_0.85fr]">
          <div>
            <Eyebrow>Answering, handled</Eyebrow>
            <h2 className="font-display mt-4 text-2xl font-semibold md:text-3xl">
              An AI receptionist that sounds like a person.
            </h2>
            <p className="mt-3 text-[0.9rem] leading-relaxed text-muted-foreground">
              Give it your script, tone and language. It greets callers, answers the usual
              questions, qualifies the ones worth your time and books straight into your calendar —
              then leaves you a transcript and a one-line summary.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                "Per-number greeting and prompt",
                "Live transcripts and summaries",
                "Calendar-aware booking",
                "Falls back to voicemail cleanly",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[0.82rem]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <img
            src={receptionistShot}
            srcSet={receptionistSrcSet}
            sizes="(min-width: 768px) 30rem, 100vw"
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
            alt="The SixVox AI receptionist answering a call, with a live transcript below the call controls"
            className="aspect-square w-full rounded-[1.5rem] object-cover"
          />
        </div>
      </Section>

      <Section className="py-9 md:py-14">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          Why people move off closed boxes.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Talkyto, Toktiv and Mango each hand you a slice of your own phone account. SixVox hands
          you the whole thing.
        </p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {CONTRAST.map((row) => (
            <li key={row.us} className="glass-panel rounded-3xl p-5">
              <p className="flex items-start gap-2 text-[0.82rem] text-muted-foreground line-through decoration-destructive/60">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive no-underline" aria-hidden />
                {row.them}
              </p>
              <p className="mt-2 flex items-start gap-2 text-[0.85rem] font-medium">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                {row.us}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="py-9 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">
            Free for 14 days, then plans that scale
          </h2>
          <Link to="/pricing" className="inline-flex min-h-11 items-center text-sm text-primary underline">
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
                search={{ mode: "signup", plan: plan.code, interval: "month" }}
                className={cn(
                  "mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-sm font-semibold",
                  plan.highlighted ? "key-call" : "key-raised",
                )}
              >
                Start free
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          USD. Tax calculated at checkout. Renews automatically until cancelled.
        </p>
      </Section>

      <Section className="py-9 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">Common questions</h2>
          <Link to="/faq" className="inline-flex min-h-11 items-center text-sm text-primary underline">
            All answers
          </Link>
        </div>
        <div className="mt-6">
          <FaqAccordion items={HOME_FAQS} />
        </div>
      </Section>

      <Section className="pt-9 pb-16 md:pt-14 md:pb-20">
        <CtaBand
          title="Ready when you are."
          body="Create your workspace and send your first message in about a minute."
          note="14 days free · no card · cancel any time"
        />
      </Section>
    </MarketingLayout>
  );
}
