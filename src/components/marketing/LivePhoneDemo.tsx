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

/** Cumulative start time of each scene, plus the full loop length. */
const SCENE_STARTS = SCENE_ORDER.reduce<number[]>((acc, id, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1]! + SCENE_MS[SCENE_ORDER[i - 1]!]);
  return acc;
}, []);
const TOTAL_MS = SCENE_STARTS[SCENE_STARTS.length - 1]! + SCENE_MS[SCENE_ORDER[3]!];

const TURN_DELAY = 500;
const TURN_GAP = 1150;

function sceneIndexAt(elapsed: number) {
  let index = 0;
  for (let i = 0; i < SCENE_ORDER.length; i += 1) {
    if (elapsed >= SCENE_STARTS[i]!) index = i;
  }
  return index;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const CALLOUTS: Record<SceneId, { left: string; right: string }> = {
  ring: { left: "Rings your phone, not a desk", right: "Caller history on screen" },
  answer: { left: "AI answered in 1.2s", right: "Live transcript, your script" },
  outcome: { left: "Handled without you", right: "Confirmation text sent" },
  inbox: { left: "Summary in your inbox", right: "Every channel, one thread list" },
};

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
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0]!;
  const index = reduce ? 3 : sceneIndexAt(elapsed);
  const scene = SCENE_ORDER[index]!;
  const running = playing && visible && !reduce && !scrubbing;

  const sceneLabels: Record<SceneId, string> = {
    ring: "A call comes in",
    answer: "Your assistant answers",
    outcome: scenario.outcome.label,
    inbox: "You get the summary",
  };

  const goTo = (next: number) => setElapsed(SCENE_STARTS[clamp(next, 0, 3)]!);

  const pickScenario = (id: string) => {
    setScenarioId(id);
    setElapsed(0);
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
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      setElapsed((value) => (value + delta) % TOTAL_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Transcript lines land one at a time, derived from the timeline position.
  const sceneElapsed = elapsed - SCENE_STARTS[index]!;
  const shownTurns = useMemo(() => {
    if (reduce || scene !== "answer") {
      return index >= SCENE_ORDER.indexOf("answer") ? scenario.transcript : [];
    }
    const count = clamp(
      Math.floor((sceneElapsed - TURN_DELAY) / TURN_GAP) + 1,
      0,
      scenario.transcript.length,
    );
    return scenario.transcript.slice(0, count);
  }, [reduce, scene, index, sceneElapsed, scenario.transcript]);

  const seekFromPointer = (clientX: number) => {
    const node = track.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    setElapsed(clamp(ratio * TOTAL_MS, 0, TOTAL_MS - 1));
  };

  const progress = reduce ? 1 : elapsed / TOTAL_MS;

  return (
    <div ref={frame} className="relative mx-auto w-full max-w-[19.5rem]">
      {/* Ambient glow behind the handset */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/20 blur-3xl"
      />

      {/* One object: picker docked to the top of the frame, controls to the bottom. */}
      <div className="glass-panel relative overflow-hidden rounded-[2.6rem] p-2.5 shadow-2xl">
        <div
          role="tablist"
          aria-label="Choose a call scenario"
          className="surface-track mb-2.5 flex items-center gap-1 rounded-full p-1"
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
                  "flex min-h-10 flex-1 items-center justify-center rounded-full px-2 py-1.5 text-[0.68rem] font-semibold transition-colors",
                  active ? "key-signal" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.tab}
              </button>
            );
          })}
        </div>

        <div className="app-gradient relative flex h-[28.5rem] flex-col overflow-hidden rounded-[1.9rem] pt-2.5 pb-2.5">
          <StatusBar />
          {/* Scenes are stacked so switching cross-fades instead of cutting. */}
          <div className="relative min-h-0 flex-1">
            <SceneLayer active={scene === "ring"}>
              <RingScene scenario={scenario} />
            </SceneLayer>
            <SceneLayer active={scene === "answer"}>
              <AnswerScene scenario={scenario} turns={shownTurns} />
            </SceneLayer>
            <SceneLayer active={scene === "outcome"}>
              <OutcomeScene scenario={scenario} />
            </SceneLayer>
            <SceneLayer active={scene === "inbox"}>
              <InboxScene scenario={scenario} />
            </SceneLayer>
          </div>
        </div>

        {/* Slim transport bar docked to the device */}
        <div className="mt-2.5 flex items-center gap-2.5 px-1 pb-0.5">
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            disabled={reduce}
            aria-label={playing ? "Pause demo" : "Play demo"}
            className="surface-row grid size-8 shrink-0 place-items-center rounded-full text-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>

          {/* Segmented scrubber: click or drag anywhere to jump through the story. */}
          <div
            ref={track}
            role="slider"
            tabIndex={0}
            aria-label="Demo progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={sceneLabels[scene]}
            onPointerDown={(event) => {
              if (reduce) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setScrubbing(true);
              setPlaying(false);
              seekFromPointer(event.clientX);
            }}
            onPointerMove={(event) => {
              if (scrubbing) seekFromPointer(event.clientX);
            }}
            onPointerUp={() => setScrubbing(false)}
            onPointerCancel={() => setScrubbing(false)}
            onKeyDown={(event) => {
              if (reduce) return;
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                setPlaying(false);
                const step = event.key === "ArrowRight" ? 1000 : -1000;
                setElapsed((value) => clamp(value + step, 0, TOTAL_MS - 1));
              }
              if (event.key === "Home") goTo(0);
              if (event.key === "End") goTo(3);
            }}
            className="flex min-w-0 flex-1 cursor-pointer touch-none items-center gap-1 py-2 focus-visible:outline-none"
          >
            {SCENE_ORDER.map((item, itemIndex) => {
              const fill = clamp((elapsed - SCENE_STARTS[itemIndex]!) / SCENE_MS[item], 0, 1);
              return (
                <span
                  key={item}
                  title={sceneLabels[item]}
                  style={{ flexGrow: SCENE_MS[item] }}
                  className="h-1.5 overflow-hidden rounded-full bg-foreground/20"
                >
                  <span
                    className={cn(
                      "block h-full rounded-full bg-primary",
                      scrubbing ? "" : "transition-[width] duration-150 ease-linear",
                    )}
                    style={{ width: `${(reduce ? 1 : fill) * 100}%` }}
                  />
                </span>
              );
            })}
          </div>

          <p
            aria-live="polite"
            className="w-[6.6rem] shrink-0 truncate text-right text-[0.7rem] font-medium text-muted-foreground"
          >
            {sceneLabels[scene]}
          </p>
        </div>
      </div>

      {/* Scene-synced call-outs: the story for people who don't watch the loop. */}
      <span
        key={`left-${scene}`}
        className="glass-panel animate-fade-in pointer-events-none absolute top-[30%] hidden rounded-full px-3 py-1.5 text-[0.68rem] font-semibold whitespace-nowrap shadow-lg lg:block lg:right-full lg:mr-[-1.25rem]"
      >
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
        {CALLOUTS[scene].left}
      </span>
      <span
        key={`right-${scene}`}
        className="glass-panel animate-fade-in pointer-events-none absolute top-[70%] hidden rounded-full px-3 py-1.5 text-[0.68rem] font-semibold whitespace-nowrap shadow-lg lg:block lg:right-full lg:mr-[-1.25rem]"
      >
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-success align-middle" />
        {CALLOUTS[scene].right}
      </span>

      <p className="mt-2 text-center text-[0.72rem] text-muted-foreground">{scenario.blurb}</p>
    </div>
  );
}

function SceneShell({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col px-3">{children}</div>;
}

/** Stacked scene layer: cross-fades and lifts slightly as it becomes active. */
function SceneLayer({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!active}
      className={cn(
        "absolute inset-0 transition-all duration-500 ease-out motion-reduce:transition-none",
        active
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-1.5 scale-[0.985] opacity-0",
      )}
    >
      {children}
    </div>
  );
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
      <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center">
        <span className="surface-row inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.65rem] font-semibold text-primary">
          <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
          SixVox is answering
        </span>
        <span className="ring-glow grid size-24 place-items-center rounded-full text-2xl font-semibold motion-safe:animate-pulse">
          {scenario.caller.initials}
        </span>
        <div>
          <p className="font-display text-lg font-semibold">{scenario.caller.name}</p>
          <p className="tabular text-xs text-muted-foreground">
            {scenario.caller.number} · Incoming · 00:03
          </p>
        </div>
        <Waveform />
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

const WAVE_BARS = [40, 72, 96, 58, 82, 100, 64, 44, 88, 56, 76, 92, 48, 68, 36];

/** Purely decorative live-audio bars so the ring frame never reads as idle. */
function Waveform() {
  return (
    <div aria-hidden className="flex h-6 items-center justify-center gap-[3px]">
      {WAVE_BARS.map((height, barIndex) => (
        <span
          key={barIndex}
          className="w-[3px] rounded-full bg-primary/70 motion-safe:animate-pulse"
          style={{
            height: `${height}%`,
            animationDelay: `${barIndex * 80}ms`,
            animationDuration: "1100ms",
          }}
        />
      ))}
    </div>
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
    <div className="flex h-full min-h-0 flex-col">
      <PillHeader title="Inbox" subtitle="6 numbers · SMS & MMS" action={RefreshCw} />
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
