import { Link, createFileRoute } from "@tanstack/react-router";

import {
  CtaBand,
  Eyebrow,
  FaqAccordion,
  MarketingLayout,
  Section,
} from "@/components/MarketingLayout";
import { E911Disclosure, TextingDisclosure } from "@/components/marketing/Disclosures";
import { TRIAL_DAYS, TRIAL_LIMITS } from "@/lib/plans";
import { SITE_URL, breadcrumbLd, faqLd, pageHead } from "@/lib/seo";

const TITLE = "FAQ — SixVox for tradespeople";
const DESCRIPTION =
  "Trials, canceling, forwarding a number, the AI receptionist, call recording, 911 on a VoIP line, and US texting registration.";

const GROUPS = [
  {
    heading: "Getting started",
    items: [
      {
        q: "Who is SixVox for?",
        a: "A US owner-operator or a crew of 2–5 in plumbing, HVAC, electrical, handyman, cleaning, landscaping, or garage doors. You run the business from your phone and miss calls while you're on a job.",
      },
      {
        q: "Do I need a card to start?",
        a: `You can create an account without paying. Choosing a plan collects payment details and starts the ${TRIAL_DAYS}-day trial. Nothing is charged until it ends. The trial includes ${TRIAL_LIMITS.numbers} number, ${TRIAL_LIMITS.seats} seat, and ${TRIAL_LIMITS.aiCalls} AI receptionist calls.`,
      },
      {
        q: "Does it work on my phone?",
        a: "The app runs in the browser, and Android can install it. Calls use web push when the app is in the background. A native iPhone and Android calling app is coming soon — there is no iPhone app today.",
      },
    ],
  },
  {
    heading: "Billing",
    items: [
      {
        q: "How do I cancel?",
        a: "Open Billing and tap Cancel plan. You keep access until the end of the period you've already paid for.",
      },
      {
        q: "Is the AI receptionist extra?",
        a: "No. It is on Solo, Team, and Scale. Solo includes 50 AI calls, Team 200, and Scale 600. The trial includes 20.",
      },
      {
        q: "Is tax included?",
        a: "Prices are in USD before tax. Sales tax or VAT is calculated at checkout.",
      },
    ],
  },
  {
    heading: "Your number and texts",
    items: [
      {
        q: "Can I keep the number on my truck?",
        a: "Yes. Forward it to SixVox and callers keep dialing the same digits. Porting the number in is coming soon.",
      },
      {
        q: "Do I need carrier registration to text?",
        a: "Yes. US carriers filter unregistered business texts. SixVox handles A2P 10DLC registration on every plan. Texts may not deliver until the carrier approves it.",
      },
      {
        q: "Can I text a Google review request after a job?",
        a: "Yes. Save the Google review link in Integrations, along with quiet hours and a cooldown. On a thread, Mark job done sends one review text when that setting is on. The text includes STOP. Quiet hours and the cooldown can hold it.",
      },
      {
        q: "Can I text a payment link from a conversation?",
        a: "Yes. Open Payment link on the thread, enter the amount, and text it. Stripe Connect is test mode. The charge is created on the connected account, not on SixVox.",
      },
      {
        q: "Can I send a call into Jobber?",
        a: "Yes. Connect Jobber under Integrations, then create or match a client and open a request from the call thread. Connect stays off until JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET are set. Tokens stay on the server.",
      },
    ],
  },
  {
    heading: "Answering and recording",
    items: [
      {
        q: "What happens when I can't pick up?",
        a: "If that number is set to the AI receptionist, it answers and leaves a transcript. Voicemail is the fallback. Missed-call text-back is included on every plan. Turn it on in that line's settings and an unanswered inbound call gets a text from that number.",
      },
      {
        q: "Are calls recorded?",
        a: "Call recording is off for each line until you turn it on. When it is on, everyone on the call hears a recording notice before recording starts, including voicemail and the AI receptionist.",
      },
      {
        q: "Will it book the job by itself?",
        a: "Google Calendar booking is in line settings. The default waits for you to approve the time before the customer is texted. Automatic booking is an optional setting on that line.",
      },
    ],
  },
  {
    heading: "Emergencies and other products",
    items: [
      {
        q: "Can I call 911 from SixVox?",
        a: "SixVox is a VoIP line. 911 can fail if power, the internet, or SixVox is down, and responders are sent to the service address registered for that number, not to wherever the handset is. Registering that address is $0.75 per number per month. A 911 call with no registered address is $75 and goes to a national emergency center. Use a traditional phone when you can.",
      },
      {
        q: "Who owns my data?",
        a: "You do. Messages, voicemail, transcripts and contacts belong to your workspace, and roles are enforced at the database level so agents only see what's assigned to them. Call recording is off for each line until you turn it on. When it is on, everyone on the call hears a recording notice before recording starts, including voicemail and the AI receptionist.",
      },
      {
        q: "How is this different from Quo, Grasshopper, Google Voice, or Jobber Receptionist?",
        a: "Those comparisons, with list prices as of Sep 2026, are on the compare page. SixVox is the business line and inbox, with the AI receptionist included on Solo. It is not a field-service CRM.",
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
      { type: "application/ld+json", children: JSON.stringify(faqLd(ALL_FAQS)) },
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
      <Section className="pb-6">
        <Eyebrow>Straight answers</Eyebrow>
        <h1 className="font-display mt-5 text-[2rem] leading-[1.08] font-semibold sm:text-5xl">
          Questions from the truck
        </h1>
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="key-signal mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-base font-semibold sm:w-auto"
        >
          Start free trial
        </Link>
      </Section>
      <Section className="space-y-8 py-4">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <h2 className="font-display text-sm font-semibold tracking-wide text-primary uppercase">
              {group.heading}
            </h2>
            <div className="mt-3">
              <FaqAccordion items={group.items} />
            </div>
          </div>
        ))}
        <TextingDisclosure className="text-sm leading-relaxed text-muted-foreground" />
        <E911Disclosure className="text-sm leading-relaxed text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Still stuck?{" "}
          <Link to="/contact" className="font-semibold text-primary underline">
            Contact the team
          </Link>
          .
        </p>
        <CtaBand
          title="See it on your own number."
          body="Start the trial and forward the line customers already call."
          label="Start free trial"
        />
      </Section>
    </MarketingLayout>
  );
}
