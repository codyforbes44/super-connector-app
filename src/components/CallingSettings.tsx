import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneOutgoing, Trash2 } from "lucide-react";
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
  listCallerIds,
  requestCallerIdVerification,
  setDefaultNumber,
  setOutboundCallerId,
} from "@/lib/twilio.functions";

const NONE = "__none__";

export function CallingSettings() {
  const boot = useBootstrap();
  const queryClient = useQueryClient();
  const [defaultNumber, setDefault] = useState(
    (boot.profile?.default_number as string | null) ?? boot.numbers[0]?.phone_number ?? "",
  );
  const [newCallerId, setNewCallerId] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const callerIds = useQuery({
    queryKey: ["caller-ids"],
    queryFn: () => listCallerIds(),
    enabled: boot.isAdmin,
    retry: false,
  });

  const refreshBoot = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });

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
    onSuccess: (result) => {
      setCode(result.validationCode);
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
                      <p className="tabular truncate text-sm font-medium">
                        {formatPhone(item.phoneNumber)}
                      </p>
                      <p className="truncate text-[0.7rem] text-muted-foreground">
                        {item.friendlyName ?? "Verified"}
                      </p>
                    </div>
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
                    {(callerIds.data ?? []).map((item) => (
                      <SelectItem key={item.sid} value={item.phoneNumber}>
                        {formatPhone(item.phoneNumber)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}