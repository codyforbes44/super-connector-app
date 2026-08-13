import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AnswerModeCard } from "@/components/receptionist/AnswerModeCard";
import { ScreenHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBootstrap } from "@/hooks/useBootstrap";
import { listForwardingSetups, setForwardingStatus } from "@/lib/byo.functions";
import { FORWARD_MODE_LABEL, carrierById, type ForwardMode } from "@/lib/forwarding-codes";
import { errorMessage, formatPhone } from "@/lib/format";
import { assignNumber, listTeam } from "@/lib/twilio.functions";

const TITLE = "Member account — SixVox";
const DESCRIPTION = "Set up a member's line, answering and forwarding on their behalf.";

export const Route = createFileRoute("/_authenticated/admin/$userId")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemberAccount,
});

function MemberAccount() {
  const { userId } = Route.useParams();
  const boot = useBootstrap();
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: () => listTeam(), enabled: boot.isAdmin });
  const forwarding = useQuery({
    queryKey: ["forwarding-setups"],
    queryFn: () => listForwardingSetups(),
    enabled: boot.isAdmin,
  });
  const [assigning, setAssigning] = useState<string>("");

  if (!boot.isAdmin) {
    return (
      <div className="px-6 py-20 text-center text-sm text-muted-foreground">
        This area is for account administrators.
      </div>
    );
  }

  const member = (team.data ?? []).find((t) => t.id === userId);
  const theirNumbers = boot.numbers.filter((n) => n.assigned_to === userId);
  const spare = boot.numbers.filter((n) => !n.assigned_to);
  const fwd = (forwarding.data ?? []).find((f) => f.user_id === userId) ?? null;

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["bootstrap"] }),
      qc.invalidateQueries({ queryKey: ["forwarding-setups"] }),
    ]);
  };

  const assign = useMutation({
    mutationFn: (sid: string) => assignNumber({ data: { sid, assignedTo: userId } }),
    onSuccess: async () => {
      await refresh();
      setAssigning("");
      toast.success("Line assigned to this member.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="pb-10">
      <ScreenHeader
        title={member?.display_name || member?.email || "Member"}
        subtitle={member?.email ?? userId}
        action={
          <Link
            to="/subscribers"
            className="key-raised grid size-9 place-items-center rounded-full text-muted-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Link>
        }
      />

      <section className="space-y-3 px-4 py-4">
        <h2 className="font-display text-sm font-semibold">Their line</h2>
        {theirNumbers.length ? (
          <ul className="space-y-2">
            {theirNumbers.map((n) => (
              <li key={n.sid} className="glass-panel rounded-2xl px-4 py-3">
                <p className="tabular text-sm font-semibold">{formatPhone(n.phone_number)}</p>
                <p className="text-[0.7rem] text-muted-foreground">
                  {n.friendly_name || "No label"} ·{" "}
                  {n.outbound_caller_id
                    ? `calls out as ${formatPhone(n.outbound_caller_id)}`
                    : "calls out as itself"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No line assigned yet.</p>
        )}

        <div className="space-y-1.5">
          <Label>Assign a spare line</Label>
          <Select value={assigning} onValueChange={setAssigning}>
            <SelectTrigger className="h-11 w-full rounded-xl px-4">
              <SelectValue placeholder={spare.length ? "Pick a line" : "No spare lines"} />
            </SelectTrigger>
            <SelectContent>
              {spare.map((n) => (
                <SelectItem key={n.sid} value={n.sid}>
                  {formatPhone(n.phone_number)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="key-signal h-11 w-full rounded-xl font-semibold"
            disabled={!assigning || assign.isPending}
            onClick={() => assign.mutate(assigning)}
          >
            Assign line
          </Button>
          <Link
            to="/numbers"
            className="block text-center text-[0.7rem] text-muted-foreground underline-offset-4 hover:underline"
          >
            Need a new one? Find and claim a number
          </Link>
        </div>
      </section>

      {theirNumbers.length ? (
        <section className="space-y-3 border-t border-border px-4 py-4">
          <h2 className="font-display text-sm font-semibold">How their calls are answered</h2>
          {theirNumbers.map((n) => (
            <div key={n.sid} className="glass-panel space-y-3 rounded-3xl p-4">
              <p className="tabular text-xs font-semibold text-muted-foreground">
                {formatPhone(n.phone_number)}
              </p>
              <AnswerModeCard number={n} canEdit onChanged={refresh} />
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border px-4 py-4">
        <h2 className="font-display text-sm font-semibold">Their own number</h2>
        {fwd ? (
          <div className="glass-panel space-y-2 rounded-3xl p-4">
            <div className="flex items-center gap-2">
              <p className="tabular flex-1 text-sm font-semibold">
                {formatPhone(fwd.personal_number)}
              </p>
              <Badge variant={fwd.status === "verified" ? "secondary" : "outline"}>
                {fwd.status}
              </Badge>
            </div>
            <p className="text-[0.7rem] text-muted-foreground">
              {FORWARD_MODE_LABEL[(fwd.forward_mode === "all" ? "all" : "conditional") as ForwardMode]}{" "}
              · {carrierById(fwd.carrier).name} · forwards to{" "}
              {fwd.assigned_number ? formatPhone(fwd.assigned_number) : "no line yet"}
            </p>
            {fwd.last_forwarded_call_at ? (
              <p className="text-[0.7rem] text-muted-foreground">
                Last forwarded call {new Date(fwd.last_forwarded_call_at).toLocaleString()}
              </p>
            ) : null}
            <Button
              variant="secondary"
              className="h-10 w-full rounded-xl"
              onClick={async () => {
                try {
                  await setForwardingStatus({
                    data: {
                      targetUserId: userId,
                      status: fwd.status === "verified" ? "pending" : "verified",
                    },
                  });
                  await refresh();
                  toast.success("Forwarding status updated.");
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <CheckCircle2 className="mr-2 size-4" />
              {fwd.status === "verified" ? "Mark as not working" : "Mark forwarding as working"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This member hasn&apos;t set up call forwarding from their own phone.
          </p>
        )}
      </section>

      <section className="border-t border-border px-4 py-4">
        <Link to="/subscribers" className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Plan, seats and access</p>
            <p className="text-[0.7rem] text-muted-foreground">
              Change plan, comp, suspend or set their role
            </p>
          </div>
        </Link>
      </section>
    </div>
  );
}