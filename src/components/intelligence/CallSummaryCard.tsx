import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ActionSuggestions } from "@/components/intelligence/ActionSuggestions";
import { TranscriptView } from "@/components/intelligence/TranscriptView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage, formatPhone } from "@/lib/format";
import { getCallDetail, reanalyseCall } from "@/lib/intelligence.functions";
import { assignCallLead } from "@/lib/receptionist.functions";
import { listTeam } from "@/lib/twilio.functions";

type Turn = { speaker?: string; text?: string };

export type CallRecordPreview = {
  summary: string;
  intent: string | null;
  sentiment: string | null;
  urgency: string | null;
  topics: string[];
  tags: string[];
  lead_name: string | null;
  lead_callback: string | null;
  lead_address: string | null;
  lead_address_valid: boolean | null;
  lead_job_type: string | null;
  lead_urgency: string | null;
  assigned_label: string | null;
  turns: Turn[];
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Unhappy",
};

export function CallSummaryCard({
  callSid,
  contactNumber,
  appNumber,
  preview,
}: {
  callSid: string;
  contactNumber?: string | null;
  appNumber?: string | null;
  preview?: CallRecordPreview;
}) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["call-detail", callSid],
    queryFn: () => getCallDetail({ data: { callSid } }),
    enabled: !preview,
  });
  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => listTeam(),
    enabled: !preview,
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
        tags?: string[] | null;
        lead_name?: string | null;
        lead_callback?: string | null;
        lead_address?: string | null;
        lead_address_valid?: boolean | null;
        lead_job_type?: string | null;
        lead_urgency?: string | null;
        assigned_to?: string | null;
      }
    | null
    | undefined;

  const turns = preview
    ? preview.turns
    : (detail.data?.transcripts ?? []).flatMap(
        (row) => ((row.turns as Turn[] | null) ?? []) as Turn[],
      );
  const shown = preview
    ? {
        summary: preview.summary,
        intent: preview.intent,
        sentiment: preview.sentiment,
        urgency: preview.urgency,
        topics: preview.topics,
        entities: null,
        action_items: [],
        tags: preview.tags,
        lead_name: preview.lead_name,
        lead_callback: preview.lead_callback,
        lead_address: preview.lead_address,
        lead_address_valid: preview.lead_address_valid,
        lead_job_type: preview.lead_job_type,
        lead_urgency: preview.lead_urgency,
        assigned_to: null,
      }
    : intel;

  if (!preview && !detail.data) return null;

  if (!shown && turns.length === 0) {
    return (
      <div className="glass-panel mt-2 rounded-2xl p-3.5">
        <p className="text-xs font-medium">Summary unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Summaries appear on every finished call — in-app, voicemail, and calls your AI
          receptionist answers.
        </p>
      </div>
    );
  }

  const entities = Object.entries(shown?.entities ?? {}).filter(([, value]) => value);
  const leadRows = [
    ["Name", shown?.lead_name],
    ["Callback", shown?.lead_callback ? formatPhone(shown.lead_callback) : null],
    ["Address", shown?.lead_address],
    [
      "Address check",
      shown?.lead_address ? (shown.lead_address_valid ? "On the map" : "Not verified") : null,
    ],
    ["Job", shown?.lead_job_type],
    ["Urgency", shown?.lead_urgency],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const assignedLabel = preview
    ? preview.assigned_label
    : (team.data ?? []).find((member) => member.id === shown?.assigned_to)?.display_name ||
      (team.data ?? []).find((member) => member.id === shown?.assigned_to)?.email ||
      null;

  return (
    <div className="glass-panel mt-2 space-y-3 rounded-2xl p-3.5" aria-label="Call record">
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

      {shown?.summary ? (
        <p className="text-sm">{shown.summary}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Summary unavailable — summaries appear on finished calls, including in-app calls.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {shown?.intent ? <Badge variant="secondary">{shown.intent}</Badge> : null}
        {shown?.sentiment ? (
          <Badge variant="outline">{SENTIMENT_LABEL[shown.sentiment] ?? shown.sentiment}</Badge>
        ) : null}
        {shown?.urgency === "high" || shown?.lead_urgency === "high" ? (
          <Badge className="key-end">Urgent</Badge>
        ) : null}
        {(shown?.topics ?? []).map((topic) => (
          <Badge key={topic} variant="outline">
            {topic}
          </Badge>
        ))}
        {(shown?.tags ?? []).map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>

      {leadRows.length ? (
        <dl className="grid gap-1.5">
          {leadRows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3 text-xs">
              <dt className="shrink-0 tracking-wide text-muted-foreground uppercase">{label}</dt>
              <dd className="min-w-0 text-right break-words">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {preview ? (
        assignedLabel ? (
          <p className="text-xs text-muted-foreground">Assigned to {assignedLabel}</p>
        ) : null
      ) : (
        <label className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Assigned to</span>
          <select
            className="rounded-xl bg-muted/40 px-2 py-1"
            value={shown?.assigned_to ?? ""}
            onChange={(event) => {
              const assignedTo = event.target.value || null;
              void assignCallLead({ data: { callSid, assignedTo } })
                .then(async () => {
                  await qc.invalidateQueries({ queryKey: ["call-detail", callSid] });
                  toast.success("Assignment saved.");
                })
                .catch((error: unknown) => toast.error(errorMessage(error)));
            }}
          >
            <option value="">Unassigned</option>
            {(team.data ?? []).map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name || member.email}
              </option>
            ))}
          </select>
        </label>
      )}

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
        items={shown?.action_items ?? []}
        callSid={callSid}
        contactNumber={contactNumber ?? null}
        appNumber={appNumber ?? null}
      />

      <TranscriptView turns={turns} />
    </div>
  );
}
