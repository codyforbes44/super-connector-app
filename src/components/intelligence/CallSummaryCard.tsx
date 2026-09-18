import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ActionSuggestions } from "@/components/intelligence/ActionSuggestions";
import { TranscriptView } from "@/components/intelligence/TranscriptView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/format";
import { getCallDetail, reanalyseCall } from "@/lib/intelligence.functions";

type Turn = { speaker?: string; text?: string };

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Unhappy",
};

export function CallSummaryCard({
  callSid,
  contactNumber,
  appNumber,
}: {
  callSid: string;
  contactNumber?: string | null;
  appNumber?: string | null;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["call-detail", callSid],
    queryFn: () => getCallDetail({ data: { callSid } }),
  });

  const rerun = useMutation({
    mutationFn: () => reanalyseCall({ data: { callSid } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["call-detail", callSid] });
      await qc.invalidateQueries({ queryKey: ["call-summaries"] });
      toast.success("Summary refreshed.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const intel = detail.data?.intelligence as
    | {
        summary: string | null;
        intent: string | null;
        sentiment: string | null;
        urgency: string | null;
        topics: string[] | null;
        entities: Record<string, string> | null;
        action_items: Array<{ kind: string; label: string; value?: string }> | null;
      }
    | null
    | undefined;

  const turns = (detail.data?.transcripts ?? []).flatMap(
    (row) => ((row.turns as Turn[] | null) ?? []) as Turn[],
  );

  if (!detail.data) return null;

  if (!intel && turns.length === 0) {
    return (
      <div className="glass-panel mt-2 rounded-2xl p-3.5">
        <p className="text-xs font-medium">Summary unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Summaries appear after transcribed calls — voicemails and calls your AI receptionist
          answers.
        </p>
      </div>
    );
  }

  const entities = Object.entries(intel?.entities ?? {}).filter(([, value]) => value);

  return (
    <div className="glass-panel mt-2 space-y-3 rounded-2xl p-3.5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="font-display text-sm font-semibold">What this call was about</p>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-8"
          disabled={rerun.isPending}
          onClick={() => rerun.mutate()}
        >
          <RefreshCw className={rerun.isPending ? "size-4 animate-spin" : "size-4"} />
          <span className="sr-only">Summarise again</span>
        </Button>
      </div>

      {intel?.summary ? (
        <p className="text-sm">{intel.summary}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Summary unavailable — summaries appear after transcribed calls.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {intel?.intent ? <Badge variant="secondary">{intel.intent}</Badge> : null}
        {intel?.sentiment ? (
          <Badge variant="outline">{SENTIMENT_LABEL[intel.sentiment] ?? intel.sentiment}</Badge>
        ) : null}
        {intel?.urgency === "high" ? <Badge className="key-end">Urgent</Badge> : null}
        {(intel?.topics ?? []).map((topic) => (
          <Badge key={topic} variant="outline">
            {topic}
          </Badge>
        ))}
      </div>

      {entities.length ? (
        <dl className="grid gap-1.5">
          {entities.map(([key, value]) => (
            <div key={key} className="flex items-start justify-between gap-3 text-xs">
              <dt className="shrink-0 tracking-wide text-muted-foreground uppercase">
                {key.replace(/_/g, " ")}
              </dt>
              <dd className="min-w-0 text-right break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ActionSuggestions
        items={intel?.action_items ?? []}
        callSid={callSid}
        contactNumber={contactNumber ?? null}
        appNumber={appNumber ?? null}
      />

      <TranscriptView turns={turns} />
    </div>
  );
}