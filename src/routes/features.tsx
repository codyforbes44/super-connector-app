import { createFileRoute } from "@tanstack/react-router";
import {
  BellRing,
  Bot,
  CalendarClock,
  Hash,
  Inbox,
  MapPin,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  Smartphone,
  Star,
  Wallet,
} from "lucide-react";

import { ComingSoonBadge } from "@/components/ComingSoonBadge";
import { CtaBand, Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { FeatureGroup, FeatureRow, TONES } from "@/components/marketing/FeatureList";
import { E911Disclosure, TextingDisclosure } from "@/components/marketing/Disclosures";
import type { FeatureFlag } from "@/lib/feature-flags";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";

const TITLE = "Features — a business line that answers for trades";
const DESCRIPTION =
  "In-app calling, texts, voicemail, and an ElevenLabs AI receptionist on every SixVox plan. Missed-call text-back, Jobber, and a native app are marked coming soon.";

export const Route = createFileRoute("/features")({
  head: () => ({
    ...pageHead({
      path: "/features",
      title: TITLE,
      description: DESCRIPTION,
      image: `${SITE_URL}/og-features.jpg`,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Features", path: "/features" },
          ]),
        ),
      },
    ],
  }),
  component: FeaturesPage,
});

const GROUPS: Array<{
  heading: string;
  items: Array<{
    icon: typeof Inbox;
    title: string;
    body: string;
    flag?: FeatureFlag;
  }>;
}> = [
  {
    heading: "On the job today",
    items: [
      {
        icon: PhoneCall,
        title: "Calls ring in the app",
        body: "Answer from the app with your business caller ID. Mute, keypad, and a call timer are on the call screen. On iPhone this is the browser and web push until the native app ships. Call recording is off for each line until you turn it on. When it is on, everyone on the call hears a recording notice before recording starts, including voicemail and the AI receptionist.",
      },
      {
        icon: Bot,
        title: "AI receptionist",
        body: "An ElevenLabs voice answers when you set a number to the assistant. It uses your greeting and instructions, then leaves a transcript on the call. Included on Solo, Team, and Scale.",
      },
      {
        icon: Inbox,
        title: "One inbox for texts",
        body: "SMS and MMS land in one list with unread counts. Team and Scale add assignment so a crew of 2–5 can see who owns the reply.",
      },
      {
        icon: Hash,
        title: "A business number",
        body: "Search and claim a number, or forward the one already on your truck and website. Callers keep dialing the same digits.",
      },
    ],
  },
  {
    heading: "Coming to the line",
    items: [
      {
        icon: MessageSquare,
        title: "Missed-call text-back",
        body: "Every missed call gets an automatic text. It is included on every plan, including Solo.",
        flag: "missedCallTextBack",
      },
      {
        icon: BellRing,
        title: "Business hours and after-hours routing",
        body: "Ring you during the day. Send after-hours and overflow calls to the receptionist.",
        flag: "businessHours",
      },
      {
        icon: CalendarClock,
        title: "AI booking you approve",
        body: "The receptionist proposes a time from your real availability. You approve it with one tap before it is booked. Google Calendar is already a tool in the app.",
        flag: "aiBookingWithApproval",
      },
      {
        icon: Smartphone,
        title: "Native iPhone and Android app",
        body: "Calls that ring like a normal phone call with the app closed. Today, Android can install the site and iPhone uses the browser.",
        flag: "nativeApp",
      },
      {
        icon: Hash,
        title: "Port your number in",
        body: "Forwarding works now. A guided port-in, with status you can see in the app, is next.",
        flag: "portIn",
      },
      {
        icon: ShieldCheck,
        title: "Jobber",
        body: "Send the caller, the address, and the call summary into Jobber when you already use it.",
        flag: "jobber",
      },
      {
        icon: Star,
        title: "Review requests",
        body: "Text a review link after the job is marked done, with a way for the customer to opt out.",
        flag: "reviewRequests",
      },
      {
        icon: Wallet,
        title: "Payment links",
        body: "Text a link so the customer pays you, not SixVox.",
        flag: "paymentLinks",
      },
    ],
  },
  {
    heading: "Also in the app",
    items: [
      {
        icon: MapPin,
        title: "Gmail, Calendar, and Maps",
        body: "Read a contact's email beside the text thread, check the calendar, and look up an address before you roll the truck.",
      },
      {
        icon: ShieldCheck,
        title: "Texting registration",
        body: "US carriers require A2P 10DLC registration. SixVox walks through it in the app on every plan. Texts can be blocked until the carrier says yes.",
      },
      {
        icon: BellRing,
        title: "Alerts",
        body: "Push and email for calls, voicemail, and texts, with quiet hours you set.",
      },
    ],
  },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <Section className="pb-6">
        <Eyebrow>What the line actually does</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.08] font-semibold text-balance sm:text-5xl">
          Pick up the jobs you miss while you're working.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Calls are only recorded if you turn on transcription for a line, and callers hear a
          recording notice first. Anything still being built is marked coming soon.
        </p>
      </Section>

      {GROUPS.map((group) => (
        <Section key={group.heading} className="py-6">
          <h2 className="font-display text-sm font-semibold tracking-wide text-primary uppercase">
            {group.heading}
          </h2>
          <FeatureGroup className="mt-4">
            {group.items.map((item, index) => (
              <FeatureRow
                key={item.title}
                icon={item.icon}
                tone={TONES[index % TONES.length]!}
                title={item.title}
                body={item.body}
                trailing={item.flag ? <ComingSoonBadge flag={item.flag} /> : undefined}
              />
            ))}
          </FeatureGroup>
        </Section>
      ))}

      <Section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <TextingDisclosure />
        <E911Disclosure />
        <CtaBand
          title="Put it on the number you already give customers."
          body="Start the trial, then forward that line or claim a new one."
          label="Start free trial"
        />
      </Section>
    </MarketingLayout>
  );
}
