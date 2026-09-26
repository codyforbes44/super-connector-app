import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { ScreenHeader } from "@/components/AppShell";
import { CallFilters, type CallFilterState } from "@/components/CallFilters";
import { CallHistoryRow } from "@/components/calls/CallHistoryRow";
import { CallSpamPanel } from "@/components/calls/CallSpamPanel";
import { ListGroup, Screen } from "@/components/screen";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  callerListForNumber,
  hasCallFilters,
  isSpamBlocked,
  matchesScreening,
  otherPartyNumber,
  sameCallerNumber,
  type CallerListKind,
} from "@/lib/call-spam";
import { duration, formatPhone } from "@/lib/format";

type PreviewCall = {
  id: string;
  sid: string;
  direction: "inbound";
  from_number: string;
  to_number: string;
  app_number: string;
  status: string;
  answer_path: string | null;
  spam_action: string | null;
  spam_score: number | null;
  spam_reason: string | null;
  line_type: string | null;
  stir_verstat: string | null;
  started_at: string;
  duration: number | null;
  recording_url: string | null;
  answered_in_app: boolean;
  answered_by: string | null;
  client_identity: string | null;
  price: string | null;
  transcription: string | null;
};

const LINE = "+19185550100";

const CALLS: PreviewCall[] = [
  {
    id: "spam",
    sid: "CApreviewspam",
    direction: "inbound",
    from_number: "+19185550199",
    to_number: LINE,
    app_number: LINE,
    status: "blocked",
    answer_path: "spam",
    spam_action: "block",
    spam_score: 82,
    spam_reason: "Known spam (StirVerstat Failed, non-fixed VoIP).",
    line_type: "nonFixedVoip",
    stir_verstat: "Failed",
    started_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    duration: null,
    recording_url: null,
    answered_in_app: false,
    answered_by: null,
    client_identity: null,
    price: null,
    transcription: null,
  },
  {
    id: "missed",
    sid: "CApreviewmissed",
    direction: "inbound",
    from_number: "+19185550142",
    to_number: LINE,
    app_number: LINE,
    status: "no-answer",
    answer_path: null,
    spam_action: "allow",
    spam_score: 0,
    spam_reason: "Looks legitimate (StirVerstat A, mobile).",
    line_type: "mobile",
    stir_verstat: "A",
    started_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    duration: null,
    recording_url: null,
    answered_in_app: false,
    answered_by: null,
    client_identity: null,
    price: null,
    transcription: null,
  },
  {
    id: "answered",
    sid: "CApreviewanswered",
    direction: "inbound",
    from_number: "+19185550110",
    to_number: LINE,
    app_number: LINE,
    status: "completed",
    answer_path: "app",
    spam_action: null,
    spam_score: null,
    spam_reason: null,
    line_type: null,
    stir_verstat: null,
    started_at: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    duration: 94,
    recording_url: null,
    answered_in_app: true,
    answered_by: null,
    client_identity: "owner",
    price: null,
    transcription: null,
  },
];

export const Route = createFileRoute("/dev/calls-preview")({
  validateSearch: (search: Record<string, unknown>): { detail: "open" | "closed" } => ({
    detail: search["detail"] === "open" || search["detail"] === "1" ? "open" : "closed",
  }),
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [{ title: "Calls preview — SixVox" }, { name: "robots", content: "noindex" }],
  }),
  component: CallsPreview,
});

function CallsPreview() {
  const { detail: initialDetail } = Route.useSearch();
  const [filters, setFilters] = useState<CallFilterState>({
    q: "",
    direction: "all",
    range: "all",
    device: "all",
    screening: "all",
  });
  const [openId, setOpenId] = useState<string | null>(initialDetail === "open" ? "spam" : null);
  const [rules, setRules] = useState<{ phone_number: string; list: CallerListKind }[]>([]);
  const visible = CALLS.filter((call) => matchesScreening(call, filters.screening));
  const detail = CALLS.find((call) => call.id === openId) ?? null;
  const detailPhone = detail ? otherPartyNumber(detail) : "";

  function setList(phone: string, list: CallerListKind) {
    setRules((current) => {
      const rest = current.filter((rule) => !sameCallerNumber(rule.phone_number, phone));
      return [...rest, { phone_number: phone, list }];
    });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ScreenHeader
        title="Calls"
        subtitle="Blocked spam is marked so you don't call it back by mistake"
      />
      <CallFilters
        value={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      />
      <Screen>
        {visible.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            {hasCallFilters(filters) ? "No matching calls" : "No calls on this line yet"}
          </p>
        ) : (
          <ListGroup className="min-w-0">
            {visible.map((call) => {
              const phone = otherPartyNumber(call);
              return (
                <CallHistoryRow
                  key={call.id}
                  call={call}
                  listStatus={phone ? callerListForNumber(rules, phone) : null}
                  pending={false}
                  onOpen={() => setOpenId(call.id)}
                  onPlay={() => undefined}
                  onCallBack={() => undefined}
                  onSetList={(list) => setList(phone, list)}
                />
              );
            })}
          </ListGroup>
        )}
      </Screen>

      <Sheet open={detail !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-border bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <SheetHeader className="px-0">
            <SheetTitle className="font-display text-center">Call details</SheetTitle>
          </SheetHeader>
          {detail ? (
            <CallSpamPanel
              call={detail}
              phone={detailPhone}
              listStatus={callerListForNumber(rules, detailPhone)}
              pending={false}
              onSetList={(list) => setList(detailPhone, list)}
            />
          ) : null}
          {detail ? (
            <dl className="space-y-1.5 text-sm">
              {[
                ["From", formatPhone(detail.from_number)],
                ["To", formatPhone(detail.to_number)],
                ["Status", isSpamBlocked(detail) ? "Spam blocked" : detail.status],
                ["Duration", duration(detail.duration)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-3.5 py-2.5"
                >
                  <dt className="shrink-0 text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                    {label}
                  </dt>
                  <dd className="tabular min-w-0 text-right break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
