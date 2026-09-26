import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, Check, MessageSquare, PhoneCall, Wrench } from "lucide-react";

import receptionistAvifSrcSet from "@/assets/ai-receptionist.jpg?w=420;640;900&format=avif&as=srcset";
import receptionistSrcSet from "@/assets/ai-receptionist.jpg?w=420;640;900&format=webp&as=srcset";
import receptionistShot from "@/assets/ai-receptionist.jpg?w=640&format=webp";
import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import {
  CtaBand,
  Eyebrow,
  FaqAccordion,
  MarketingLayout,
  Section,
} from "@/components/MarketingLayout";
import { LivePhoneDemo } from "@/components/marketing/LivePhoneDemo";
import { TextingDisclosure } from "@/components/marketing/Disclosures";
import { PLANS, POSITIONING_LINE, featureIsSoon } from "@/lib/plans";
import { SITE_URL, faqLd, organizationLd, pageHead, softwareApplicationLd } from "@/lib/seo";
import { TRADES } from "@/lib/trades";
import { cn } from "@/lib/utils";

const soloMonthly = PLANS.find((plan) => plan.code === "solo")?.monthly;
const TITLE = "SixVox — the business line that picks up when you can't";
const DESCRIPTION = `Your business line for plumbers, HVAC, electricians, and small crews. It answers when you're on a job, books the work, and texts missed callers back. From $${soloMonthly} a month.`;

const HOME_FAQS = [
  {
    q: "Do I need a card to start?",
    a: "You can create an account without paying. When you pick a plan, checkout collects payment details and starts the 14-day trial. Nothing is charged until the trial ends. The trial includes 1 number, 1 seat, and 20 AI receptionist calls.",
  },
  {
    q: "Can I keep the number customers already call?",
    a: "Yes. Leave it with your carrier and forward it to SixVox. Callers keep dialing the same digits. Moving the number in (port-in) is coming soon.",
  },
  {
    q: "What if I'm on a roof or under a sink?",
    a: "The AI receptionist is on every plan, including Solo. It answers, asks what the job is, and leaves the summary in your inbox. Missed-call text-back is included on every plan and is coming soon.",
  },
  {
    q: "Are calls recorded?",
    a: "Call recording is off for each line until you turn it on. When it is on, everyone on the call hears a recording notice before recording starts, including voicemail and the AI receptionist.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Billing has a Cancel plan button. You keep access until the end of the period you've paid for.",
  },
];

const EXAMPLES = [
  {
    when: "On a roof",
    body: "An HVAC homeowner calls about no cool. You're on the condenser. The receptionist takes the address and whether the house has air.",
  },
  {
    when: "Under a sink",
    body: "A leak call comes in while your hands are wet. The line still answers and writes down what's leaking and where.",
  },
  {
    when: "After hours",
    body: "A 9 p.m. call about a stuck garage door or a dead circuit still reaches the business number, not your personal voicemail.",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    ...pageHead({
      path: "/",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-home.jpg`,
    }),
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(softwareApplicationLd(DESCRIPTION)) },
      { type: "application/ld+json", children: JSON.stringify(organizationLd(DESCRIPTION)) },
      { type: "application/ld+json", children: JSON.stringify(faqLd(HOME_FAQS)) },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <MarketingLayout>
      <div className="theme-dark hero-band -mt-px">
        <Section className="relative overflow-hidden pt-7 pb-10 md:pt-12 md:pb-14">
          <div
            aria-hidden
            className="signal-rings pointer-events-none absolute top-[-6rem] right-[-8rem] -z-10 hidden size-[36rem] md:block"
          />
          <div className="grid gap-8 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-10">
            <div>
              <Eyebrow>For solo trades and crews of 2–5</Eyebrow>
              <h1 className="font-display mt-5 text-[2rem] leading-[1.08] font-semibold text-balance sm:text-5xl">
                {POSITIONING_LINE}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
                Built for plumbers, HVAC, electricians, cleaners, and other owner-operators who miss
                calls while they're on a job. The AI receptionist is on every plan, including Solo.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="key-signal inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="surface-row inline-flex min-h-14 items-center justify-center rounded-xl px-6 text-base font-semibold"
                >
                  Get a number
                </Link>
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                {["14 days free", "Not charged until the trial ends", "Cancel in the app"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Example — not a customer recording
              </p>
              <LivePhoneDemo />
            </div>
          </div>
        </Section>
      </div>

      <Section className="py-10 md:py-14">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">
          What it looks like on a job
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          These are examples of the situation SixVox is for. They are not stories from customers.
        </p>
        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {EXAMPLES.map((example) => (
            <li key={example.when} className="surface-row h-full rounded-3xl p-5">
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">Example</p>
              <h3 className="font-display mt-2 text-lg font-semibold">{example.when}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{example.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="py-8 md:py-12">
        <h2 className="font-display text-2xl font-semibold md:text-3xl">A line for your trade</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((trade) => (
            <li key={trade.slug}>
              <Link
                to="/for/$trade"
                params={{ trade: trade.slug }}
                className="surface-row flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3"
              >
                <trade.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-semibold">{trade.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {trade.headline}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="py-8 md:py-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <Eyebrow>On every plan, including Solo</Eyebrow>
            <h2 className="font-display mt-4 text-2xl font-semibold md:text-3xl">
              An AI receptionist that takes the job details
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              It greets callers in a voice you pick, follows your instructions, and leaves a
              transcript on the call. You turn it on per number.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Call recording is off for each line until you turn it on. When it is on, everyone on
              the call hears a recording notice before recording starts, including voicemail and the
              AI receptionist.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" aria-hidden />
                Included on Solo, Team, and Scale
              </li>
              <li className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" aria-hidden />
                Missed-call text-back
                <ComingSoonBadge flag="missedCallTextBack" />
              </li>
              <li className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-primary" aria-hidden />
                Native iPhone and Android calling
                <ComingSoonBadge flag="nativeApp" />
              </li>
            </ul>
          </div>
          <picture>
            <source
              type="image/avif"
              srcSet={receptionistAvifSrcSet}
              sizes="(min-width: 768px) 30rem, 100vw"
            />
            <source
              type="image/webp"
              srcSet={receptionistSrcSet}
              sizes="(min-width: 768px) 30rem, 100vw"
            />
            <img
              src={receptionistShot}
              srcSet={receptionistSrcSet}
              sizes="(min-width: 768px) 30rem, 100vw"
              width={1024}
              height={1024}
              loading="lazy"
              decoding="async"
              alt="SixVox AI receptionist screen with call controls and a live transcript"
              className="aspect-square w-full rounded-[1.5rem] object-cover"
            />
          </picture>
        </div>
      </Section>

      <Section className="py-8 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">
            Plans from ${PLANS[0]?.monthly}/mo
          </h2>
          <Link
            to="/pricing"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline"
          >
            Full pricing
          </Link>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.code}
              className={cn("glass-panel rounded-3xl p-5", plan.highlighted && "border-primary/50")}
            >
              <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="font-display mt-4 text-3xl font-semibold">
                ${plan.monthly}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.numbers} number{plan.numbers === 1 ? "" : "s"} · {plan.seats} seat
                {plan.seats === 1 ? "" : "s"} · {plan.aiCalls} AI calls
              </p>
              <Link
                to="/auth"
                search={{ mode: "signup", plan: plan.code, interval: "month" }}
                className={cn(
                  "mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-semibold",
                  plan.highlighted ? "key-signal" : "surface-row",
                )}
              >
                Start free trial
              </Link>
              <ul className="mt-4 space-y-1.5">
                {plan.features.slice(0, 4).map((feature) => (
                  <li
                    key={feature.label}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                    <span>
                      {feature.label}
                      {feature.flag && featureIsSoon(feature) ? (
                        <ComingSoonBadge flag={feature.flag} className="ml-2 align-middle" />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section className="py-8 md:py-12">
        <h2 className="font-display text-2xl font-semibold">Common questions</h2>
        <div className="mt-5">
          <FaqAccordion items={HOME_FAQS} />
        </div>
        <TextingDisclosure className="mt-4 text-xs leading-relaxed text-muted-foreground" />
      </Section>

      <Section className="pt-4 pb-16">
        <CtaBand
          title="Get the number. Take the next job."
          body="Start a 14-day trial, then forward the line customers already call or claim a SixVox number."
          label="Start free trial"
          note="Not charged until the trial ends · cancel in the app"
        />
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Wrench className="h-4 w-4" aria-hidden />
          <Link to="/compare" className="font-semibold text-primary underline">
            Compare SixVox with Quo, Grasshopper, Google Voice, and Jobber Receptionist
          </Link>
        </p>
      </Section>
    </MarketingLayout>
  );
}
