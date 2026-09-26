import { createFileRoute } from "@tanstack/react-router";
import {
  BellRing,
  Bot,
  CalendarClock,
  Hash,
  Inbox,
  Mail,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Terminal,
  Wand2,
  Waves,
} from "lucide-react";

import { CtaBand, Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { FeatureGroup, FeatureRow, TONES } from "@/components/marketing/FeatureList";
import { SITE_URL, breadcrumbLd, pageHead } from "@/lib/seo";

const TITLE = "Features — everything SixVox does for your business line";
const DESCRIPTION =
  "Unified inbox, in-app calling, an AI receptionist, instant numbers, verification, caller insight and connected mail, calendar and maps tools.";

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

const GROUPS = [
  {
    heading: "Messaging",
    items: [
      {
        icon: Inbox,
        title: "Live shared inbox",
        body: "SMS and MMS threads across every number, streaming in over realtime with unread counts, assignment and internal notes.",
      },
      {
        icon: Wand2,
        title: "Templates and scheduling",
        body: "Save reusable replies, attach media and queue messages to send later from the right number or messaging service pool.",
      },
    ],
  },
  {
    heading: "Voice",
    items: [
      {
        icon: PhoneCall,
        title: "In-app calling",
        body: "A custom TwiML app mints access tokens so calls ring your device directly — mute, keypad, speaker and call timer included.",
      },
      {
        icon: Waves,
        title: "Voicemail and transcripts",
        body: "Every call logged with duration, price and device, plus voicemail playback and transcription, searchable by number, agent or SID. Calls are only recorded if you turn on transcription for a line, and callers hear a recording notice first.",
      },
      {
        icon: Bot,
        title: "AI voicemail assistants",
        body: "Lifelike AI voices greet callers, qualify them, answer questions and book appointments — with transcripts and summaries per call.",
      },
    ],
  },
  {
    heading: "Administration",
    items: [
      {
        icon: Hash,
        title: "Numbers on demand",
        body: "Search, claim and assign numbers to teammates in a couple of taps. Setup happens automatically.",
      },
      {
        icon: ShieldCheck,
        title: "Roles that actually scope data",
        body: "Owner, admin and agent roles enforced in the database, so agents only ever see their own numbers and conversations.",
      },
      {
        icon: Terminal,
        title: "Unrestricted API console",
        body: "For power users: an advanced console with direct access to every messaging, voice, verification and number endpoint on your account.",
      },
    ],
  },
  {
    heading: "Connected tools",
    items: [
      {
        icon: Mail,
        title: "Gmail and branded email",
        body: "Read and reply to a contact's email thread beside their texts, and send branded alerts from your own sending domain.",
      },
      {
        icon: CalendarClock,
        title: "Calendar booking",
        body: "Free/busy aware slot suggestions so a caller — or the AI assistant — can book straight into your calendar.",
      },
      {
        icon: MapPin,
        title: "Maps and places",
        body: "Geocode addresses, look up places and give context to inbound callers before you pick up.",
      },
      {
        icon: BellRing,
        title: "Push and email alerts",
        body: "High-priority push for inbound calls, plus missed-call, voicemail and message emails with quiet hours per user.",
      },
    ],
  },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>Everything, not a curated subset</Eyebrow>
        <h1 className="font-display mt-5 max-w-3xl text-[2rem] leading-[1.06] font-semibold text-balance sm:text-4xl md:text-5xl">
          Built for people who actually run their business on their phone.
        </h1>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
          Talkyto, Toktiv and Mango each give you a slice. SixVox gives you the whole account —
          messaging, telephony, provisioning, AI and raw API access, on a phone.
        </p>
      </Section>

      {GROUPS.map((group) => (
        <Section
          key={group.heading}
          className="scroll-mt-24 py-8"
        >
          <h2 className="font-display text-sm font-semibold tracking-wide text-primary uppercase">
            {group.heading}
          </h2>
          <FeatureGroup className="mt-5">
            {group.items.map((item, itemIndex) => (
              <FeatureRow
                key={item.title}
                icon={item.icon}
                tone={TONES[itemIndex % TONES.length]!}
                title={item.title}
                body={item.body}
              />
            ))}
          </FeatureGroup>
        </Section>
      ))}

      <Section className="pt-4">
        <CtaBand
          title="See it on your own number."
          body="Claim a number or forward the one you already use, and watch the inbox, calling and AI answering work together."
          note="14 days free · no card · cancel any time"
        />
      </Section>
    </MarketingLayout>
  );
}