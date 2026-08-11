import { Link, createFileRoute } from "@tanstack/react-router";

import {
  CtaBand,
  Eyebrow,
  FaqAccordion,
  MarketingLayout,
  Section,
} from "@/components/MarketingLayout";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";

const TITLE = "FAQ — SixVox questions answered";
const DESCRIPTION =
  "Answers on trials, pricing, numbers, WhatsApp, the AI receptionist, data ownership and how SixVox compares to other business phone apps.";

const GROUPS = [
  {
    heading: "Getting started",
    items: [
      {
        q: "Do I need anything before I start?",
        a: "No. Sign up with an email address and your 14-day trial starts immediately — no card, no setup call. Your numbers, data and usage always stay yours.",
      },
      {
        q: "Does it work on mobile?",
        a: "SixVox is mobile-first and installable to your home screen. Calls ring inside the app, and push notifications alert you even when the app is in the background.",
      },
      {
        q: "How long does setup take?",
        a: "Most workspaces are sending and receiving within a couple of minutes. Wiring an existing number is one tap; carrier forwarding takes a short code you dial once.",
      },
    ],
  },
  {
    heading: "Billing and plans",
    items: [
      {
        q: "When am I charged?",
        a: "Never during the trial. When you pick a plan you're charged immediately, then automatically each month or year until you cancel.",
      },
      {
        q: "Is tax included?",
        a: "Prices are in USD excluding tax. Applicable sales tax or VAT is calculated at checkout from your billing address and shown before you pay.",
      },
      {
        q: "Can I cancel any time?",
        a: "Yes. Manage or cancel your subscription from Billing at any point; access continues until the end of the paid period and you won't be charged again.",
      },
      {
        q: "Do you offer refunds?",
        a: "Fees already paid aren't refunded except where required by law — that's why the trial gives you the full product for 14 days first. If something went wrong with a charge, contact us and we'll sort it out.",
      },
      {
        q: "How is usage billed?",
        a: "Calls, messages and AI minutes are billed at cost with no markup, itemised on your invoice alongside your plan fee.",
      },
    ],
  },
  {
    heading: "Numbers and porting",
    items: [
      {
        q: "Can I keep my existing numbers?",
        a: "Absolutely. Numbers already on your account appear as soon as you connect, and one tap wires their voice and messaging webhooks to SixVox.",
      },
      {
        q: "What if I don't want to port?",
        a: "Leave the number with your carrier and forward calls to SixVox. Callers keep dialling the same digits, and SixVox handles answering, voicemail and transcription.",
      },
      {
        q: "Is WhatsApp supported?",
        a: "Yes, on Team and Scale. WhatsApp threads sit in the same inbox as SMS and MMS.",
      },
      {
        q: "Do I need A2P registration to text US numbers?",
        a: "Yes — US carriers require it. SixVox walks you through 10DLC brand and campaign registration inside the app and tracks approval status for you.",
      },
    ],
  },
  {
    heading: "AI receptionist",
    items: [
      {
        q: "How do the AI voicemail assistants work?",
        a: "Each number can play a lifelike synthesized greeting or hand the caller to a conversational agent with your own prompt, tone, language, time limit and fallback behaviour. Transcripts and summaries land on the call record.",
      },
      {
        q: "What happens if the AI can't help?",
        a: "It falls back cleanly — taking a message, transferring to you, or offering a booking slot, depending on how you configure the number.",
      },
    ],
  },
  {
    heading: "Privacy, data and control",
    items: [
      {
        q: "Who owns my data?",
        a: "You do. Messages, voicemail, transcripts and contacts belong to your workspace, and roles are enforced at the database level so agents only see what's assigned to them. SixVox never records live calls.",
      },
      {
        q: "What is the unrestricted API console?",
        a: "An admin-only screen with direct access to every messaging, voice, verification and number endpoint on your account. Nothing is walled off behind our feature list.",
      },
      {
        q: "How is this different from Talkyto, Toktiv or Mango?",
        a: "Those apps expose a slice of what a business line can do. SixVox covers messaging, calling, numbers, AI answering, and connected mail, calendar and maps tools in one place, with real roles for teams.",
      },
    ],
  },
];

const ALL_FAQS = GROUPS.flatMap((group) => group.items);

export const Route = createFileRoute("/faq")({
  head: () => ({
    ...pageHead({
      path: "/faq",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-faq.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: ALL_FAQS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "FAQ", path: "/faq" },
          ]),
        ),
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
        <h1 className="font-display mt-5 text-[2rem] leading-[1.06] font-semibold text-balance sm:text-4xl md:text-5xl">
          Frequently asked questions
        </h1>
      </Section>

      <Section className="py-4">
        <div className="space-y-8">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <h2 className="font-display text-sm font-semibold tracking-wide text-primary uppercase">
                {group.heading}
              </h2>
              <div className="mt-4">
                <FaqAccordion items={group.items} />
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Still stuck?{" "}
          <Link
            to="/contact"
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            Talk to us
          </Link>
          .
        </p>

        <div className="mt-8">
          <CtaBand
            title="Answers are easier with the app open."
            body="Start the free trial and see how SixVox handles your line before you decide anything."
          />
        </div>
      </Section>
    </MarketingLayout>
  );
}