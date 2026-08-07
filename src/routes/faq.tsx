import { Link, createFileRoute } from "@tanstack/react-router";

import { Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";

const TITLE = "FAQ — Signalbox Twilio app questions answered";
const DESCRIPTION =
  "Answers on Twilio accounts, pricing, numbers, WhatsApp, AI voicemail assistants, data ownership and how Signalbox compares to Talkyto, Toktiv and Mango.";

const FAQS = [
  {
    q: "Do I need my own Twilio account?",
    a: "Yes. Signalbox is the product layer on top of your Twilio account, so your numbers, usage and rates stay yours. We never mark up Twilio usage.",
  },
  {
    q: "Can I keep my existing numbers?",
    a: "Absolutely. Numbers already on your account appear as soon as you connect, and one tap wires their voice and messaging webhooks to Signalbox.",
  },
  {
    q: "Does it work on mobile?",
    a: "Signalbox is mobile-first and installable to your home screen. Calls ring your device through the Twilio Voice SDK, and push notifications alert you even when the app is in the background.",
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
    a: "An admin-only screen that can call any Twilio REST endpoint — core, Verify, Lookup and Messaging — with any method. Nothing about your account is walled off behind our feature list.",
  },
  {
    q: "How is this different from Talkyto, Toktiv or Mango?",
    a: "Those apps expose a slice of Twilio. Signalbox covers messaging, telephony, provisioning, AI answering, connected Gmail/Calendar/Maps tools and raw API access in one place, with database-enforced roles for teams.",
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