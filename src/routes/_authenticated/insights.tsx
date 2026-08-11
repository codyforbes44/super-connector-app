import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Lightbulb } from "lucide-react";

import { ScreenHeader } from "@/components/AppShell";
import { getInsights } from "@/lib/intelligence.functions";

const DESCRIPTION =
  "See how your week went: calls answered and missed, busiest hours, and what people called about.";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Your week — SixVox" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Your week — SixVox" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsScreen,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-panel rounded-2xl px-3.5 py-3">
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  );
}

function InsightsScreen() {
  const insights = useQuery({ queryKey: ["insights"], queryFn: () => getInsights() });
  const data = insights.data;

  const busiest =
    data?.byHour && data.byHour.some((count) => count > 0)
      ? data.byHour.indexOf(Math.max(...data.byHour))
      : null;

  const nudges: string[] = [];
  if (data) {
    if (data.afterHours >= 3) {
      nudges.push(
        `${data.afterHours} calls came in outside 8am–6pm. Turning the assistant on for evenings would catch them.`,
      );
    }
    if (data.missed >= 3) {
      nudges.push(
        `You missed ${data.missed} calls this week. Every one of them can get a summary and a callback card.`,
      );
    }
    if (data.urgent > 0) {
      nudges.push(`${data.urgent} caller${data.urgent === 1 ? "" : "s"} sounded urgent — worth a look.`);
    }
    if (data.inbound > 0 && data.analysed === 0) {
      nudges.push(
        "No calls were summarised yet. Turn on transcription in Settings, or let your assistant answer.",
      );
    }
  }

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Your week"
        subtitle="The last seven days"
        action={
          <Link
            to="/settings"
            className="key-raised grid size-9 place-items-center rounded-full text-muted-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2 px-4 pt-4 sm:grid-cols-3">
        <Stat label="Calls" value={data?.total ?? 0} />
        <Stat label="Incoming" value={data?.inbound ?? 0} />
        <Stat label="Missed" value={data?.missed ?? 0} />
        <Stat label="Answered in app" value={data?.answeredInApp ?? 0} />
        <Stat label="Minutes talking" value={data?.talkMinutes ?? 0} />
        <Stat
          label="Busiest hour"
          value={busiest === null ? "—" : `${String(busiest).padStart(2, "0")}:00`}
        />
      </div>

      {data?.topIntents.length ? (
        <section className="space-y-2 px-4 pt-5">
          <h2 className="font-display text-sm font-semibold">What people called about</h2>
          <ul className="space-y-1.5">
            {data.topIntents.map((intent) => (
              <li
                key={intent.label}
                className="glass-panel flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm capitalize">{intent.label}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {intent.count}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data ? (
        <section className="space-y-2 px-4 pt-5">
          <h2 className="font-display text-sm font-semibold">How callers sounded</h2>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Happy" value={data.sentiment.positive} />
            <Stat label="Neutral" value={data.sentiment.neutral} />
            <Stat label="Unhappy" value={data.sentiment.negative} />
          </div>
        </section>
      ) : null}

      {nudges.length ? (
        <section className="space-y-2 px-4 pt-5">
          <h2 className="font-display text-sm font-semibold">Worth doing</h2>
          <ul className="space-y-1.5">
            {nudges.map((nudge) => (
              <li key={nudge} className="glass-panel flex items-start gap-2.5 rounded-2xl px-3.5 py-3">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">{nudge}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}