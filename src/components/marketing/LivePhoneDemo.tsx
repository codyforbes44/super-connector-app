import {
  Bot,
  Calendar,
  Hash,
  Inbox as InboxIcon,
  MessageSquare,
  Mic,
  Pause,
  PhoneCall,
  PhoneOff,
  Play,
  RefreshCw,
  Settings,
  ShieldBan,
  Sparkles,
  SquarePen,
  Voicemail,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A self-running miniature of the app: a call comes in, the AI receptionist
 * answers and transcribes it, an outcome lands, and the summary drops into the
 * inbox. Visitors can pick a scenario, scrub scenes, and pause playback.
 * Autoplays on loop, pauses when off-screen, and freezes on the final frame
 * when the visitor prefers reduced motion.
 */

type SceneId = "ring" | "answer" | "outcome" | "inbox";

type Turn = { who: "Assistant" | "Caller"; text: string };

type InboxRow = {
  icon: LucideIcon;
  title: string;
  body: string;
  meta: string;
  accent?: boolean;
};

type Scenario = {
  id: string;
  tab: string;
  blurb: string;
  caller: { name: string; initials: string; number: string; context: string };
  transcript: Turn[];
  answerLabel: string;
  outcome: {
    icon: LucideIcon;
    tone: "call" | "signal" | "end";
    title: string;
    detail: string;
    noteLabel: string;
    note: string;
    label: string;
  };
  inbox: InboxRow[];
};

const SCENARIOS: Scenario[] = [
  {
    id: "booked",
    tab: "Books the job",
    blurb: "A new customer calls while you're under a sink.",
    caller: {
      name: "Dana Moreno",
      initials: "DM",
      number: "(512) 555-0148",
      context: "Called twice last month · Water heater install",
    },
    answerLabel: "Live transcript · 00:32",
    transcript: [
      { who: "Assistant", text: "Thanks for calling Ridgeline Plumbing — how can I help?" },
      { who: "Caller", text: "My water heater's leaking. Can someone come out tomorrow?" },
      { who: "Assistant", text: "I can do 9:30am or 2pm tomorrow. Which suits you?" },
      { who: "Caller", text: "9:30 works. It's 214 Alder Street." },
      { who: "Assistant", text: "Booked for 9:30am. You'll get a text confirmation." },
    ],
    outcome: {
      icon: Calendar,
      tone: "call",
      title: "Booked into your calendar",
      detail: "Water heater repair · Tomorrow 9:30am",
      noteLabel: "Confirmation sent",
      note: '"You\'re booked for 9:30am at 214 Alder St. Reply R to reschedule."',
      label: "It books the job",
    },
    inbox: [
      {
        icon: Sparkles,
        title: "Dana Moreno",
        body: "Leaking water heater — booked 9:30am tomorrow. Needs parking info.",
        meta: "Just now",
        accent: true,
      },
      {
        icon: MessageSquare,
        title: "Ali Haddad",
        body: "Sending the gate code before you arrive 👍",
        meta: "12m",
      },
      {
        icon: PhoneCall,
        title: "Unknown · (737) 555-0102",
        body: "Voicemail transcribed: quote request for a full re-pipe.",
        meta: "1h",
      },
    ],
  },
  {
    id: "screened",
    tab: "Screens spam",
    blurb: "An unknown number tries you for the fourth time today.",
    caller: {
      name: "Unknown caller",
      initials: "?",
      number: "(888) 555-0173",
      context: "4 attempts today · Flagged by 1,200+ people",
    },
    answerLabel: "Screening caller · 00:11",
    transcript: [
      { who: "Assistant", text: "Who's calling, and what is this regarding?" },
      { who: "Caller", text: "We're reaching out about your vehicle's extended warranty…" },
      { who: "Assistant", text: "They're not accepting sales calls. Removing this number." },
    ],
    outcome: {
      icon: ShieldBan,
      tone: "end",
      title: "Screened and blocked",
      detail: "Your phone never rang",
      noteLabel: "What we did",
      note: "Added to your block list and filed under Spam. No notification sent.",
      label: "It blocks the junk",
    },
    inbox: [
      {
        icon: ShieldBan,
        title: "Spam · (888) 555-0173",
        body: "Screened and blocked automatically. Tap to unblock.",
        meta: "Just now",
        accent: true,
      },
      {
        icon: Sparkles,
        title: "Weekly digest",
        body: "17 spam calls screened this week — about 40 minutes back.",
        meta: "Mon",
      },
    ],
  },
  {
    id: "afterhours",
    tab: "After hours",
    blurb: "It's 9:40pm and someone needs an emergency quote.",
    caller: {
      name: "Priya Raman",
      initials: "PR",
      number: "(737) 555-0199",
      context: "After hours · First-time caller",
    },
    answerLabel: "After-hours assistant · 00:24",
    transcript: [
      { who: "Assistant", text: "We're closed for the evening — I can take the details." },
      { who: "Caller", text: "Burst pipe in the garage. What would that run me?" },
      { who: "Assistant", text: "Emergency callouts start at $180. Want the first slot at 7am?" },
      { who: "Caller", text: "Yes please, and text me when you're on the way." },
    ],
    outcome: {
      icon: Voicemail,
      tone: "signal",
      title: "Held for the morning",
      detail: "Urgent lead · 7:00am callback requested",
      noteLabel: "Summary waiting for you",
      note: "Burst pipe, garage. Quoted $180 callout. Wants a text en route.",
      label: "It covers the night shift",
    },
    inbox: [
      {
        icon: Sparkles,
        title: "Priya Raman",
        body: "Burst pipe — wants 7am callback. Quoted $180 emergency callout.",
        meta: "9:41pm",
        accent: true,
      },
      {
        icon: MessageSquare,
        title: "Auto-reply sent",
        body: '"Got it — we\'ll confirm your 7am slot first thing."',
        meta: "9:41pm",
      },
      {
        icon: PhoneCall,
        title: "Marcus Bell",
        body: "Voicemail transcribed: asking about annual service plan.",
        meta: "8:02pm",
      },
    ],
  },
];

const SCENE_MS: Record<SceneId, number> = {
  ring: 3200,
  answer: 6200,
  outcome: 3400,
  inbox: 4200,
};

const SCENE_ORDER: SceneId[] = ["ring", "answer", "outcome", "inbox"];

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduce(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduce;
}

export function LivePhoneDemo() {
  const reduce = useReducedMotion();
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0]!.id);
  const [index, setIndex] = useState(0);
  const [turns, setTurns] = useState(0);
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(true);
  const frame = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0]!;
  const scene = SCENE_ORDER[reduce ? 3 : index]!;
  const running = playing && visible && !reduce;

  const sceneLabels: Record<SceneId, string> = {
    ring: "A call comes in",
    answer: "Your assistant answers",
    outcome: scenario.outcome.label,
    inbox: "You get the summary",
  };

  const goTo = (next: number) => {
    setIndex(next);
    setTurns(next > SCENE_ORDER.indexOf("answer") ? scenario.transcript.length : 0);
  };

  const pickScenario = (id: string) => {
    setScenarioId(id);
    setIndex(0);
    setTurns(0);
    setPlaying(true);
  };

  // Pause the loop when the demo is scrolled out of view — no work off-screen.
  useEffect(() => {
    const node = frame.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % SCENE_ORDER.length);
      setTurns(0);
    }, SCENE_MS[scene]);
    return () => window.clearTimeout(timer);
  }, [running, index, scene]);

  // Transcript lines land one at a time while the assistant is talking.
  useEffect(() => {
    if (!running || scene !== "answer") return;
    if (turns >= scenario.transcript.length) return;
    const timer = window.setTimeout(() => setTurns((value) => value + 1), turns === 0 ? 500 : 1150);
    return () => window.clearTimeout(timer);
  }, [running, scene, turns, scenario.transcript.length]);

  const shownTurns = useMemo(
    () => (reduce ? scenario.transcript : scenario.transcript.slice(0, turns)),
    [reduce, scenario.transcript, turns],
  );

  return (
    <div ref={frame} className="relative mx-auto w-full max-w-[19.5rem]">
      {/* Ambient glow behind the handset */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/20 blur-3xl"
      />

      {/* Scenario picker */}
      <div
        role="tablist"
        aria-label="Choose a call scenario"
        className="glass-panel mb-3 flex items-center gap-1 rounded-full p-1"
      >
        {SCENARIOS.map((item) => {
          const active = item.id === scenario.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pickScenario(item.id)}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center rounded-full px-2 py-2 text-[0.7rem] font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.tab}
            </button>
          );
        })}
      </div>

      <div className="glass-panel relative overflow-hidden rounded-[2.4rem] p-2.5 shadow-2xl">
        <div className="app-gradient relative flex h-[32rem] flex-col overflow-hidden rounded-[1.9rem] pt-2.5 pb-2.5">
          <StatusBar />
          {scene === "ring" ? <RingScene scenario={scenario} /> : null}
          {scene === "answer" ? <AnswerScene scenario={scenario} turns={shownTurns} /> : null}
          {scene === "outcome" ? <OutcomeScene scenario={scenario} /> : null}
          {scene === "inbox" ? <InboxScene scenario={scenario} /> : null}
        </div>
      </div>

      {/* Scene scrubber + playback control */}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          disabled={reduce}
          aria-label={playing ? "Pause demo" : "Play demo"}
          className="surface-row grid size-8 shrink-0 place-items-center rounded-full text-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <div className="flex items-center gap-2">
          {SCENE_ORDER.map((item, itemIndex) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setPlaying(false);
                goTo(itemIndex);
              }}
              aria-label={sceneLabels[item]}
              aria-current={item === scene}
              className="grid h-6 place-items-center px-0.5"
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  item === scene ? "w-6 bg-primary" : "w-1.5 bg-foreground/25",
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="mt-1 text-center text-xs text-muted-foreground">
        {sceneLabels[scene]}
      </p>
      <p className="mt-1 text-center text-[0.7rem] text-muted-foreground/70">{scenario.blurb}</p>
    </div>
  );
}

function SceneShell({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in flex min-h-0 flex-1 flex-col px-3">{children}</div>;
}

/** Thin iOS-style status strip so the frame reads as the real installed app. */
function StatusBar() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-between px-5 pb-1 text-[0.6rem] font-semibold text-foreground/70"
    >
      <span className="flex items-center gap-1">
        <span className="flex items-end gap-[2px]">
          <span className="h-1 w-[3px] rounded-[1px] bg-current" />
          <span className="h-1.5 w-[3px] rounded-[1px] bg-current" />
          <span className="h-2 w-[3px] rounded-[1px] bg-current" />
          <span className="h-2.5 w-[3px] rounded-[1px] bg-current opacity-40" />
        </span>
      </span>
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="relative h-2.5 w-5 rounded-[3px] border border-current/70">
          <span className="absolute inset-[1.5px] right-1/3 rounded-[1px] bg-current" />
        </span>
      </span>
    </div>
  );
}

/** Floating rounded pill header, same as every in-app screen. */
function PillHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: LucideIcon;
}) {
  const Action = action;
  return (
    <div className="flex items-start gap-2 px-3 pt-1 pb-2">
      <div className="glass-panel min-w-0 flex-1 rounded-[1.4rem] px-4 py-2.5">
        <p className="font-display truncate text-[1.05rem] leading-tight font-semibold">{title}</p>
        <p className="truncate text-[0.68rem] text-muted-foreground">{subtitle}</p>
      </div>
      {Action ? (
        <span className="glass-panel grid size-11 shrink-0 place-items-center rounded-full text-foreground/80">
          <Action className="size-4" />
        </span>
      ) : null}
    </div>
  );
}

const TABS = [
  { icon: InboxIcon, label: "Inbox" },
  { icon: PhoneCall, label: "Calls" },
  { icon: Hash, label: "Numbers" },
  { icon: Wand2, label: "Tools" },
  { icon: Settings, label: "Settings" },
] as const;

/** Detached tab pod + primary action button, mirroring the app shell. */
function TabPod({ active = "Inbox", fab = SquarePen }: { active?: string; fab?: LucideIcon }) {
  const Fab = fab;
  return (
    <div aria-hidden className="mt-2 flex items-center gap-2 px-2.5">
      <div className="glass-panel flex flex-1 items-center justify-between rounded-full px-2 py-1.5">
        {TABS.map((tab) => {
          const on = tab.label === active;
          return (
            <span
              key={tab.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[0.5rem]"
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full",
                  on ? "key-signal" : "text-muted-foreground",
                )}
              >
                <tab.icon className="size-3.5" />
              </span>
              <span className={on ? "text-primary" : "text-muted-foreground"}>{tab.label}</span>
            </span>
          );
        })}
      </div>
      <span className="key-call grid size-11 shrink-0 place-items-center rounded-full">
        <Fab className="size-4" />
      </span>
    </div>
  );
}

function RingScene({ scenario }: { scenario: Scenario }) {
  return (
    <SceneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="ring-glow grid size-24 place-items-center rounded-full text-2xl font-semibold motion-safe:animate-pulse">
          {scenario.caller.initials}
        </span>
        <div>
          <p className="font-display text-lg font-semibold">{scenario.caller.name}</p>
          <p className="text-xs text-muted-foreground">{scenario.caller.number} · Incoming</p>
        </div>
        <p className="glass-panel rounded-2xl px-3 py-2 text-[0.7rem] text-muted-foreground">
          {scenario.caller.context}
        </p>
      </div>
      <div className="flex items-center justify-center gap-10 pb-2">
        <span className="key-end grid size-14 place-items-center rounded-full">
          <PhoneOff className="size-5" />
        </span>
        <span className="key-call grid size-14 place-items-center rounded-full motion-safe:animate-bounce">
          <PhoneCall className="size-5" />
        </span>
      </div>
    </SceneShell>
  );
}

function AnswerScene({ scenario, turns }: { scenario: Scenario; turns: Turn[] }) {
  return (
    <SceneShell>
      <div className="glass-panel flex items-center gap-2.5 rounded-[1.4rem] px-3 py-2.5">
        <span className="key-signal grid size-9 shrink-0 place-items-center rounded-full">
          <Bot className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Assistant is answering</p>
          <p className="text-[0.7rem] text-muted-foreground">{scenario.answerLabel}</p>
        </div>
        <Mic className="ml-auto size-4 shrink-0 text-primary motion-safe:animate-pulse" />
      </div>

      <ul className="mt-3 flex-1 space-y-2 overflow-hidden px-1">
        {turns.map((turn, turnIndex) => (
          <li
            key={turnIndex}
            className={cn(
              "animate-fade-in max-w-[85%] rounded-2xl px-3 py-2 text-[0.78rem] leading-relaxed",
              turn.who === "Assistant" ? "key-raised" : "ml-auto bg-primary/15 text-foreground",
            )}
          >
            {turn.text}
          </li>
        ))}
      </ul>
    </SceneShell>
  );
}

function OutcomeScene({ scenario }: { scenario: Scenario }) {
  const { icon: Icon, tone, title, detail, noteLabel, note } = scenario.outcome;
  return (
    <SceneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span
          className={cn(
            "grid size-16 place-items-center rounded-full motion-safe:animate-scale-in",
            tone === "call" ? "key-call" : tone === "signal" ? "key-signal" : "key-end",
          )}
        >
          <Icon className="size-6" />
        </span>
        <div>
          <p className="font-display text-base font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="glass-panel w-full rounded-2xl px-3.5 py-3 text-left">
          <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">{noteLabel}</p>
          <p className="mt-1 text-[0.78rem]">{note}</p>
        </div>
      </div>
    </SceneShell>
  );
}

function InboxScene({ scenario }: { scenario: Scenario }) {
  return (
    <div className="animate-fade-in flex min-h-0 flex-1 flex-col">
      <PillHeader
        title="Inbox"
        subtitle="6 numbers · SMS, MMS & WhatsApp"
        action={RefreshCw}
      />
      <div className="px-3 pb-1">
        <div className="surface-row rounded-full px-4 py-2 text-[0.72rem] text-muted-foreground">
          Search conversations
        </div>
      </div>
      <ul className="mt-1 flex-1 divide-y divide-border/60 overflow-hidden border-t border-border/60">
        {scenario.inbox.map((row) => (
          <li key={row.title} className="animate-fade-in flex items-center gap-3 px-4 py-2.5">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                row.accent ? "key-signal" : "surface-row text-primary",
              )}
            >
              <row.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8rem] font-semibold">{row.title}</p>
              <p className="truncate text-[0.72rem] text-muted-foreground">{row.body}</p>
            </div>
            <span className="shrink-0 text-[0.65rem] text-muted-foreground">{row.meta}</span>
          </li>
        ))}
      </ul>
      <TabPod />
    </div>
  );
}
