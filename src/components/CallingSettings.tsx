import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, PhoneCall, PhoneOutgoing, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBootstrap } from "@/hooks/useBootstrap";
import { errorMessage, formatPhone } from "@/lib/format";
import {
  deleteCallerId,
  deleteCallerIdRoute,
  listCallerIds,
  listCallerIdRoutes,
  requestCallerIdVerification,
  sendTestCall,
  setDefaultNumber,
  setOutboundCallerId,
  updateMyProfile,
  upsertCallerIdRoute,
} from "@/lib/twilio.functions";

const NONE = "__none__";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  verified: { label: "Verified", className: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" },
  pending: { label: "Pending", className: "text-amber-300 border-amber-400/30 bg-amber-400/10" },
  failed: { label: "Failed", className: "text-rose-300 border-rose-400/30 bg-rose-400/10" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES["pending"]!;
  const Icon = status === "verified" ? CheckCircle2 : status === "failed" ? XCircle : Loader2;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium ${style.className}`}
    >
      <Icon className={`h-3 w-3 ${status === "pending" ? "animate-spin" : ""}`} />
      {style.label}
    </span>
  );
}

export function CallingSettings() {
  const boot = useBootstrap();
  const queryClient = useQueryClient();
  const [defaultNumber, setDefault] = useState(
    (boot.profile?.default_number as string | null) ?? boot.numbers[0]?.phone_number ?? "",
  );
  const [newCallerId, setNewCallerId] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [routePattern, setRoutePattern] = useState("");
  const [routeCallerId, setRouteCallerId] = useState("");
  const [routeLabel, setRouteLabel] = useState("");
  const [testTo, setTestTo] = useState((boot.profile?.agent_phone as string | null) ?? "");
  const [agentPhone, setAgentPhone] = useState((boot.profile?.agent_phone as string | null) ?? "");

  const callerIds = useQuery({
    queryKey: ["caller-ids"],
    queryFn: () => listCallerIds(),
    enabled: boot.isAdmin,
    retry: false,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((item) => item.status === "pending") ? 5000 : false,
  });

  const verified = (callerIds.data ?? []).filter((item) => item.status === "verified");

  const routes = useQuery({
    queryKey: ["caller-id-routes"],
    queryFn: () => listCallerIdRoutes(),
    retry: false,
  });

  const refreshBoot = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });

  const saveAgentPhone = useMutation({
    mutationFn: () => updateMyProfile({ data: { agentPhone: agentPhone.trim() || null } }),
    onSuccess: async () => {
      await refreshBoot();
      toast.success("Callback number saved.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const testCall = useMutation({
    mutationFn: () =>
      sendTestCall({ data: { appNumber: defaultNumber || null, to: testTo.trim() || null } }),
    onSuccess: (result) =>
      toast.success(`Calling ${formatPhone(result.to)} from ${formatPhone(result.callerId)}…`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveRoute = useMutation({
    mutationFn: () =>
      upsertCallerIdRoute({
        data: { pattern: routePattern, callerId: routeCallerId, label: routeLabel || null },
      }),
    onSuccess: async () => {
      setRoutePattern("");
      setRouteLabel("");
      await routes.refetch();
      toast.success("Caller ID rule saved.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeRoute = useMutation({
    mutationFn: (id: string) => deleteCallerIdRoute({ data: { id } }),
    onSuccess: async () => {
      await routes.refetch();
      toast.success("Rule removed.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveDefault = useMutation({
    mutationFn: (phoneNumber: string) => setDefaultNumber({ data: { phoneNumber } }),
    onSuccess: async () => {
      await refreshBoot();
      toast.success("Default number saved.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const startVerification = useMutation({
    mutationFn: () => requestCallerIdVerification({ data: { phoneNumber: newCallerId } }),
    onSuccess: async (result) => {
      setCode(result.validationCode);
      setNewCallerId("");
      await callerIds.refetch();
      toast.success("We're calling that number now — enter the code shown below.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeCallerId = useMutation({
    mutationFn: (item: { sid: string; phoneNumber: string }) =>
      deleteCallerId({ data: { sid: item.sid, phoneNumber: item.phoneNumber } }),
    onSuccess: async () => {
      await Promise.all([callerIds.refetch(), refreshBoot()]);
      toast.success("Caller ID removed.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const assignCallerId = useMutation({
    mutationFn: (input: { sid: string; callerId: string | null }) =>
      setOutboundCallerId({ data: input }),
    onSuccess: async () => {
      await refreshBoot();
      toast.success("Outbound caller ID updated.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="space-y-4 border-t border-border px-4 py-4">
      <h2 className="font-display flex items-center gap-2 text-sm font-semibold">
        <PhoneOutgoing className="h-4 w-4 text-primary" />
        Calling
      </h2>

      <div className="space-y-1.5">
        <Label>Default number</Label>
        <Select
          value={defaultNumber}
          onValueChange={(value) => {
            setDefault(value);
            saveDefault.mutate(value);
          }}
        >
          <SelectTrigger className="h-11 w-full rounded-full px-4">
            <SelectValue placeholder="Pick a number" />
          </SelectTrigger>
          <SelectContent>
            {boot.numbers.map((n) => (
              <SelectItem key={n.sid} value={n.phone_number}>
                {n.friendly_name || formatPhone(n.phone_number)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.7rem] text-muted-foreground">
          Your dialer and composer start from this number.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="callback-phone">Your phone (we ring this for bridged calls)</Label>
        <div className="flex gap-2">
          <Input
            id="callback-phone"
            inputMode="tel"
            maxLength={20}
            placeholder="+1 555 010 2030"
            value={agentPhone}
            onChange={(event) => setAgentPhone(event.target.value)}
            className="h-11 flex-1 rounded-full px-4"
          />
          <Button
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={saveAgentPhone.isPending}
            onClick={() => saveAgentPhone.mutate()}
          >
            Save
          </Button>
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          When in-app calling is unavailable, we call you here first, then connect the contact.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="test-call-to">Call this number</Label>
        <Input
          id="test-call-to"
          inputMode="tel"
          placeholder="+15551234567"
          value={testTo}
          onChange={(event) => setTestTo(event.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <Button
        variant="outline"
        className="h-11 w-full rounded-full"
        disabled={testCall.isPending || !defaultNumber || testTo.trim().length < 7}
        onClick={() => testCall.mutate()}
      >
        {testCall.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <PhoneCall className="mr-2 h-4 w-4" />
        )}
        Send test outbound call
      </Button>
      <p className="-mt-2 text-[0.7rem] text-muted-foreground">
        We ring this number using the caller ID a real call would present, then hang up. It defaults
        to your own number from Settings → Profile.
      </p>

      {boot.isAdmin ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="new-caller-id">Verify a caller ID</Label>
            <div className="flex gap-2">
              <Input
                id="new-caller-id"
                value={newCallerId}
                onChange={(e) => setNewCallerId(e.target.value)}
                inputMode="tel"
                maxLength={20}
                placeholder="+1 555 010 2030"
                className="h-11 flex-1 rounded-full px-4"
              />
              <Button
                className="key-signal h-11 rounded-full px-5"
                disabled={!newCallerId.trim() || startVerification.isPending}
                onClick={() => startVerification.mutate()}
              >
                Verify
              </Button>
            </div>
            {code ? (
              <div className="glass-panel rounded-2xl px-4 py-3">
                <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                  Enter this code on the call
                </p>
                <p className="tabular font-display mt-1 text-2xl font-semibold">{code}</p>
              </div>
            ) : (
              <p className="text-[0.7rem] text-muted-foreground">
                We place a quick call to that number and read out a code to confirm you own it.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
              Verified caller IDs
            </p>
            {callerIds.isError ? (
              <p className="text-xs text-muted-foreground">{errorMessage(callerIds.error)}</p>
            ) : (callerIds.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No verified caller IDs yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(callerIds.data ?? []).map((item) => (
                  <li
                    key={item.sid}
                    className="glass-panel flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="tabular truncate text-sm font-medium">
                          {formatPhone(item.phoneNumber)}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="truncate text-[0.7rem] text-muted-foreground">
                        {item.status === "pending"
                          ? `Awaiting code${item.validationCode ? ` ${item.validationCode}` : ""}`
                          : (item.error ?? item.friendlyName ?? "Verified")}
                      </p>
                    </div>
                    {item.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewCallerId(item.phoneNumber);
                          startVerification.mutate();
                        }}
                        className="key-raised shrink-0 rounded-full px-3 py-1.5 text-[0.7rem] font-medium"
                      >
                        Retry
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Remove ${item.phoneNumber}`}
                      onClick={() =>
                        removeCallerId.mutate({ sid: item.sid, phoneNumber: item.phoneNumber })
                      }
                      className="key-raised flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
              Outbound caller ID per number
            </p>
            {boot.numbers.map((n) => (
              <div key={n.sid} className="glass-panel space-y-2 rounded-2xl px-3.5 py-3">
                <p className="tabular truncate text-sm font-medium">
                  {n.friendly_name || formatPhone(n.phone_number)}
                </p>
                <Select
                  value={(n.outbound_caller_id as string | null) ?? NONE}
                  onValueChange={(value) =>
                    assignCallerId.mutate({
                      sid: n.sid,
                      callerId: value === NONE ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-full px-4">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Show this number</SelectItem>
                    {verified.map((item) => (
                      <SelectItem key={item.sid} value={item.phoneNumber}>
                        {formatPhone(item.phoneNumber)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
              Caller ID rules by destination
            </p>
            <p className="text-[0.7rem] text-muted-foreground">
              Match a full contact number (+15550102030) or a prefix (+1512). The longest match
              wins, and a contact-specific rule always beats a prefix.
            </p>
            {(routes.data ?? []).map((route) => (
              <div
                key={route.id}
                className="glass-panel flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="tabular truncate text-sm font-medium">
                    {route.pattern} → {formatPhone(route.callerId)}
                  </p>
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    {route.label ?? "Routing rule"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove rule ${route.pattern}`}
                  onClick={() => removeRoute.mutate(route.id)}
                  className="key-raised flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="glass-panel space-y-2 rounded-2xl px-3.5 py-3">
              <Input
                value={routePattern}
                onChange={(e) => setRoutePattern(e.target.value)}
                inputMode="tel"
                placeholder="+1512 or +15550102030"
                className="h-10 rounded-full px-4"
              />
              <Input
                value={routeLabel}
                onChange={(e) => setRouteLabel(e.target.value)}
                placeholder="Label (optional)"
                className="h-10 rounded-full px-4"
              />
              <Select value={routeCallerId} onValueChange={setRouteCallerId}>
                <SelectTrigger className="h-10 w-full rounded-full px-4">
                  <SelectValue placeholder="Present this caller ID" />
                </SelectTrigger>
                <SelectContent>
                  {verified.map((item) => (
                    <SelectItem key={item.sid} value={item.phoneNumber}>
                      {formatPhone(item.phoneNumber)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="key-signal h-10 w-full rounded-full"
                disabled={!routePattern.trim() || !routeCallerId || saveRoute.isPending}
                onClick={() => saveRoute.mutate()}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add rule
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}