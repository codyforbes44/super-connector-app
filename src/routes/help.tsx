import { Link, createFileRoute } from "@tanstack/react-router";

import { MarketingLayout, Section } from "@/components/MarketingLayout";
import { pageHead } from "@/lib/seo";

const TITLE = "SixVox help — set up calls, texts and the AI receptionist";
const DESCRIPTION =
  "Short how-to guides for SixVox: connect your number, choose who answers, turn on notifications, add the app to your Home Screen and fix common problems.";

export const Route = createFileRoute("/help")({
  head: () => pageHead({ path: "/help", title: TITLE, description: DESCRIPTION }),
  component: HelpPage,
});

const GUIDES: { id: string; title: string; steps: string[] }[] = [
  {
    id: "number",
    title: "Connect your business number",
    steps: [
      "Open Numbers and pick a new number, or connect one you already have.",
      "Wait for the green “Connected” label. Calls and texts now reach SixVox.",
      "Put the number on your website, truck and voicemail greeting.",
    ],
  },
  {
    id: "answer",
    title: "Choose who answers your calls",
    steps: [
      "Open Receptionist and pick a number.",
      "Choose Ring me first, AI receptionist or Voicemail. Each choice says what callers will hear.",
      "If you choose the AI receptionist, pick one of your SixVox agents and save.",
    ],
  },
  {
    id: "notifications",
    title: "Turn on notifications",
    steps: [
      "Open Settings, then Notifications, and tap Enable.",
      "Allow notifications when your phone or browser asks.",
      "On iPhone, add SixVox to your Home Screen first. iPhone only sends notifications to installed apps.",
    ],
  },
  {
    id: "install",
    title: "Add SixVox to your Home Screen",
    steps: [
      "iPhone (Safari): tap Share, then Add to Home Screen.",
      "Android (Chrome): tap the ⋮ menu, then Install app.",
      "Computer (Chrome or Edge): click the install icon in the address bar.",
    ],
  },
  {
    id: "texting",
    title: "US business texting registration",
    steps: [
      "US carriers require businesses to register before texting customers.",
      "Open A2P to see where your registration stands and what is still needed.",
      "Until you're approved, carriers may block some texts. Calls still work.",
    ],
  },
  {
    id: "trouble",
    title: "Calls or texts not arriving?",
    steps: [
      "Check the Status page to see if SixVox is having a problem.",
      "Open Numbers and make sure the number shows “Connected”.",
      "Make sure notifications are allowed for SixVox in your phone's settings.",
      "Still stuck? Call or text 580-217-8444, or email support@3bi.io.",
    ],
  },
];

function HelpPage() {
  return (
    <MarketingLayout>
      <Section className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">Help</h1>
        <p className="mt-2 text-muted-foreground">Quick guides to get the most out of SixVox.</p>
        <nav aria-label="Guides" className="mt-6">
          <ul className="flex flex-wrap gap-2">
            {GUIDES.map((g) => (
              <li key={g.id}>
                <a href={`#${g.id}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm hover:bg-accent">
                  {g.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-8 space-y-6">
          {GUIDES.map((g) => (
            <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5">
              <h2 id={`${g.id}-h`} className="font-display text-lg font-semibold">{g.title}</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                {g.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          More answers in the <Link to="/faq" className="underline">FAQ</Link>, or check the <Link to="/status" className="underline">system status</Link>.
        </p>
      </Section>
    </MarketingLayout>
  );
}
