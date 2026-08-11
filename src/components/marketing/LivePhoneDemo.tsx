import { Bot, Calendar, MessageSquare, Mic, PhoneCall, PhoneOff, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A self-running miniature of the app: a call comes in, the AI receptionist
 * answers and transcribes it, a booking lands, and the summary drops into the
 * inbox. Autoplays on loop, pauses when off-screen, and freezes on the final
 * frame when the visitor prefers reduced motion.
 */

type Scene = "ring" | "answer" | "booked" | "inbox";

const SCENES: Array<{ id: Scene; ms: number; label: string }> = [
  { id: "ring", ms: 3200, label: "A call comes in" },
  { id: "answer", ms: 6200, label: "Your assistant answers" },
  { id: "booked", ms: 3400, label: "It books the job" },
  { id: "inbox", ms: 4200, label: "You get the summary" },
];

const TRANSCRIPT = [
  { who: "Assistant", text: "Thanks for calling Ridgeline Plumbing — how can I help?" },
  { who: "Caller", text: "My water heater's leaking. Can someone come out tomorrow?" },
  { who: "Assistant", text: "I can do 9:30am or 2pm tomorrow. Which suits you?" },
  { who: "Caller", text: "9:30 works. It's 214 Alder Street." },
  { who: "Assistant", text: "Booked for 9:30am. You'll get a text confirmation." },
];

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
  const [index, setIndex] = useState(0);
  const [turns, setTurns] = useState(0);
  const [visible, setVisible] = useState(true);
  const frame = useRef<HTMLDivElement>(null);

  const scene = SCENES[reduce ? 3 : index]!;

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
    if (reduce || !visible) return;
    const timer = window.setTimeout(() => {
      setIndex((value) => (value + 1) % SCENES.length);
      setTurns(0);
    }, scene.ms);
    return () => window.clearTimeout(timer);
  }, [reduce, visible, index, scene.ms]);

  // Transcript lines land one at a time while the assistant is talking.
  useEffect(() => {
    if (reduce || !visible || scene.id !== "answer") return;
    if (turns >= TRANSCRIPT.length) return;
    const timer = window.setTimeout(() => setTurns((value) => value + 1), turns === 0 ? 500 : 1150);
    return () => window.clearTimeout(timer);
  }, [reduce, visible, scene.id, turns]);

  const shownTurns = useMemo(
    () => (reduce ? TRANSCRIPT : TRANSCRIPT.slice(0, turns)),
    [reduce, turns],
  );

  return (
    <div ref={frame} className="relative mx-auto w-full max-w-[19.5rem]">
      {/* Ambient glow behind the handset */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="glass-panel relative overflow-hidden rounded-[2.4rem] p-2.5 shadow-2xl">
        <div className="app-gradient relative flex h-[32rem] flex-col rounded-[1.9rem] px-4 pt-5 pb-4">
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-foreground/15" aria-hidden />

          {scene.id === "ring" ? <RingScene /> : null}
          {scene.id === "answer" ? <AnswerScene turns={shownTurns} /> : null}
          {scene.id === "booked" ? <BookedScene /> : null}
          {scene.id === "inbox" ? <InboxScene /> : null}
        </div>
      </div>

      {/* Scene captions double as progress dots */}
      <div className="mt-4 flex items-center justify-center gap-2" aria-hidden>
        {SCENES.map((item, itemIndex) => (
          <span
            key={item.id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              item.id === scene.id ? "w-6 bg-primary" : "w-1.5 bg-foreground/20",
            )}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="mt-2 text-center text-xs text-muted-foreground"
      >
        {scene.label}
      </p>
    </div>
  );
}

function SceneShell({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in flex min-h-0 flex-1 flex-col">{children}</div>;
}

function RingScene() {
  return (
    <SceneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="ring-glow grid size-24 place-items-center rounded-full text-2xl font-semibold motion-safe:animate-pulse">
          DM
        </span>
        <div>
          <p className="font-display text-lg font-semibold">Dana Moreno</p>
          <p className="text-xs text-muted-foreground">(512) 555-0148 · Incoming</p>
        </div>
        <p className="glass-panel rounded-2xl px-3 py-2 text-[0.7rem] text-muted-foreground">
          Called twice last month · Water heater install
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

function AnswerScene({ turns }: { turns: Array<{ who: string; text: string }> }) {
  return (
    <SceneShell>
      <div className="flex items-center gap-2.5">
        <span className="key-signal grid size-9 shrink-0 place-items-center rounded-full">
          <Bot className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Assistant is answering</p>
          <p className="text-[0.7rem] text-muted-foreground">Live transcript · 00:32</p>
        </div>
        <Mic className="ml-auto size-4 shrink-0 text-primary motion-safe:animate-pulse" />
      </div>

      <ul className="mt-4 flex-1 space-y-2 overflow-hidden">
        {turns.map((turn, turnIndex) => (
          <li
            key={turnIndex}
            className={cn(
              "animate-fade-in max-w-[85%] rounded-2xl px-3 py-2 text-[0.78rem] leading-relaxed",
              turn.who === "Assistant"
                ? "key-raised"
                : "ml-auto bg-primary/15 text-foreground",
            )}
          >
            {turn.text}
          </li>
        ))}
      </ul>
    </SceneShell>
  );
}

function BookedScene() {
  return (
    <SceneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="key-call grid size-16 place-items-center rounded-full motion-safe:animate-scale-in">
          <Calendar className="size-6" />
        </span>
        <div>
          <p className="font-display text-base font-semibold">Booked into your calendar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Water heater repair · Tomorrow 9:30am
          </p>
        </div>
        <div className="glass-panel w-full rounded-2xl px-3.5 py-3 text-left">
          <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
            Confirmation sent
          </p>
          <p className="mt-1 text-[0.78rem]">
            "You're booked for 9:30am at 214 Alder St. Reply R to reschedule."
          </p>
        </div>
      </div>
    </SceneShell>
  );
}

function InboxScene() {
  const rows = [
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
  ];

  return (
    <SceneShell>
      <p className="font-display text-base font-semibold">Inbox</p>
      <p className="text-[0.7rem] text-muted-foreground">Everything, already written down</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li
            key={row.title}
            className={cn(
              "animate-fade-in flex gap-2.5 rounded-2xl px-3 py-2.5",
              row.accent ? "glass-panel border-primary/40" : "surface-row",
            )}
          >
            <row.icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8rem] font-semibold">{row.title}</p>
              <p className="line-clamp-2 text-[0.72rem] text-muted-foreground">{row.body}</p>
            </div>
            <span className="shrink-0 text-[0.65rem] text-muted-foreground">{row.meta}</span>
          </li>
        ))}
      </ul>
    </SceneShell>
  );
}