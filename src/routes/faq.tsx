import { Link, createFileRoute } from "@tanstack/react-router";

import { Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";

const TITLE = "FAQ — SignalBox questions answered";
const DESCRIPTION =
  "Answers on trials, pricing, numbers, WhatsApp, the AI receptionist, data ownership and how SignalBox compares to other business phone apps.";

const FAQS = [
  {
    q: "Do I need anything before I start?",
    a: "No. Sign up with an email address and your 14-day trial starts immediately — no card, no setup call. Your numbers, data and usage always stay yours.",
  },
  {
    q: "Can I keep my existing numbers?",
    a: "Absolutely. Numbers already on your account appear as soon as you connect, and one tap wires their voice and messaging webhooks to SignalBox.",
  },
  {
    q: "Does it work on mobile?",
    a: "SignalBox is mobile-first and installable to your home screen. Calls ring inside the app, and push notifications alert you even when the app is in the background.",
  },
  {
    q: "How do the AI voicemail assistants work?",
    a: "Each number can play a lifelike synthesized greeting or hand the caller to a conversational agent with your own prompt, tone, language, time limit and fallback behaviour. Transcripts and summaries land on the call record.",
  },
  {
    q: "Is WhatsApp supported?",
    a: "Yes, on Team and Scale. WhatsApp threads sit in the same inbox as SMS and MMS.",
  },
  {
    q: "What is the unrestricted API console?",
    a: "An admin-only screen with direct access to every messaging, voice, verification and number endpoint on your account. Nothing is walled off behind our feature list.",
  },
  {
    q: "How is this different from Talkyto, Toktiv or Mango?",
    a: "Those apps expose a slice of what a business line can do. SignalBox covers messaging, calling, numbers, AI answering, and connected mail, calendar and maps tools in one place, with real roles for teams.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Manage or cancel your subscription from Billing at any point; access continues until the end of the paid period.",
  },
];

export const Route = createFileRoute("/faq")({
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
          "@type": "FAQPage",
          mainEntity: FAQS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>Questions, answered</Eyebrow>
        <h1 className="font-display mt-5 text-4xl leading-[1.05] font-semibold md:text-5xl">
          Frequently asked questions
        </h1>
      </Section>

      <Section className="py-4">
        <div className="grid gap-3 md:grid-cols-2">
          {FAQS.map((item) => (
            <article key={item.q} className="glass-panel rounded-3xl p-5">
              <h2 className="font-display text-sm font-semibold">{item.q}</h2>
              <p className="mt-2 text-[0.82rem] leading-relaxed text-muted-foreground">{item.a}</p>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Still stuck?{" "}
          <Link to="/contact" className="text-primary underline">
            Talk to us
          </Link>
          .
        </p>
      </Section>
    </MarketingLayout>
  );
}