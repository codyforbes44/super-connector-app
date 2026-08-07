import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Hash, Inbox, PhoneCall, ShieldCheck, Terminal, Wand2 } from "lucide-react";

const TITLE = "Signalbox — the full Twilio console in your pocket";
const DESCRIPTION =
  "Unified SMS, MMS and WhatsApp inbox, click-to-call, number provisioning, Verify, Lookup and raw API access. Every Twilio resource, one mobile app.";

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
    <div className="app-gradient relative mx-auto w-full max-w-lg overflow-hidden px-5 pt-[calc(env(safe-area-inset-top)+3rem)] pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-64 -left-20 h-56 w-56 rounded-full bg-success/20 blur-3xl"
      />

      <span className="glass-panel relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Twilio, unrestricted
      </span>

      <h1 className="font-display relative mt-5 text-4xl leading-[1.05] font-semibold">
        Your whole Twilio account.
        <span className="text-primary"> One mobile app.</span>
      </h1>
      <p className="relative mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
        Signalbox is the command center Talkyto, Toktiv and Mango don&apos;t give you: a live
        omnichannel inbox, real telephony, full number administration — and a raw API console for
        everything else.
      </p>

      <Link
        to="/auth"
        className="key-call relative mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-semibold transition-transform active:scale-[0.98]"
      >
        Open the command center
        <ArrowRight className="h-4 w-4" />
      </Link>

      <ul className="relative mt-10 space-y-3">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className="glass-panel rounded-3xl p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-start gap-3">
              <span className="key-raised mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <feature.icon className="h-[1.05rem] w-[1.05rem] text-primary" />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">{feature.title}</h2>
                <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
