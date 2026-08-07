import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareShare, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { errorMessage, formatPhone } from "@/lib/format";
import {
  addNumberToMessagingService,
  createMessagingService,
  listMessagingServices,
  messagingServiceDetail,
  removeNumberFromMessagingService,
} from "@/lib/twilio.functions";

export type ServiceRow = { sid: string; friendly_name: string };
type PoolNumber = { sid: string; phone_number: string };
type Campaign = {
  campaign_status?: string;
  campaign_id?: string;
  brand_registration_sid?: string;
  us_app_to_person_registration_status?: string;
  message_samples?: string[];
};

export function MessagingServicesSection({
  numbers,
}: {
  numbers: Array<{ sid: string; phone_number: string }>;
}) {
  const [open, setOpen] = useState<ServiceRow | null>(null);
  const services = useQuery({
    queryKey: ["messaging-services"],
    queryFn: () => listMessagingServices(),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => createMessagingService({ data: { name: "Signalbox" } }),
    onSuccess: async () => {
      await services.refetch();
      toast.success("Messaging Service created and pointed at Signalbox.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const list = (services.data ?? []) as unknown as ServiceRow[];

  return (
    <section className="space-y-3 border-t border-border px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Messaging Services</h2>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sender pools for US A2P 10DLC. Numbers in a pool share one registered campaign.
      </p>

      {services.isError ? (
        <p className="glass-panel rounded-2xl p-3 text-xs text-muted-foreground">
          {errorMessage(services.error)}
        </p>
      ) : list.length === 0 ? (
        <p className="glass-panel rounded-2xl p-3 text-xs text-muted-foreground">
          No Messaging Services yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.sid}>
              <button
                type="button"
                onClick={() => setOpen(s)}
                className="glass-panel flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left"
              >
                <MessageSquareShare className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.friendly_name}</span>
                  <span className="block truncate text-[0.65rem] text-muted-foreground">
                    {s.sid}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <ServiceSheet key={open.sid} service={open} numbers={numbers} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}

function ServiceSheet({
  service,
  numbers,
  onClose,
}: {
  service: ServiceRow;
  numbers: Array<{ sid: string; phone_number: string }>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [toAdd, setToAdd] = useState("");

  const detail = useQuery({
    queryKey: ["messaging-service", service.sid],
    queryFn: () => messagingServiceDetail({ data: { serviceSid: service.sid } }),
    retry: false,
  });

  const pool = (detail.data?.numbers ?? []) as unknown as PoolNumber[];
  const campaigns = (detail.data?.campaigns ?? []) as unknown as Campaign[];
  const poolSids = new Set(pool.map((p) => p.sid));
  const addable = numbers.filter((n) => !poolSids.has(n.sid));

  async function refresh() {
    await detail.refetch();
    await queryClient.invalidateQueries({ queryKey: ["messaging-services"] });
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="app-gradient max-h-[88dvh] overflow-y-auto rounded-t-[2rem] border-border"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display">{service.friendly_name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
          <div className="glass-panel rounded-2xl px-3.5 py-3">
            <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
              A2P 10DLC registration
            </p>
            {campaigns.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No campaign registered for this service.
              </p>
            ) : (
              campaigns.map((c, i) => (
                <div key={c.campaign_id ?? i} className="mt-1.5 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[0.6rem]">
                    {c.campaign_status ?? c.us_app_to_person_registration_status ?? "unknown"}
                  </Badge>
                  <span className="truncate text-[0.65rem] text-muted-foreground">
                    {c.campaign_id ?? c.brand_registration_sid ?? ""}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <Label>Numbers in this pool</Label>
            {pool.length === 0 ? (
              <p className="text-xs text-muted-foreground">Pool is empty.</p>
            ) : (
              <ul className="space-y-2">
                {pool.map((p) => (
                  <li
                    key={p.sid}
                    className="glass-panel flex items-center gap-2 rounded-2xl px-3.5 py-2.5"
                  >
                    <span className="tabular flex-1 text-sm">{formatPhone(p.phone_number)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full"
                      onClick={async () => {
                        try {
                          await removeNumberFromMessagingService({
                            data: { serviceSid: service.sid, numberSid: p.sid },
                          });
                          await refresh();
                          toast.success("Number removed from pool.");
                        } catch (error) {
                          toast.error(errorMessage(error));
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {addable.length > 0 ? (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Add a number</Label>
                <Select value={toAdd} onValueChange={setToAdd}>
                  <SelectTrigger className="h-11 w-full rounded-full px-4">
                    <SelectValue placeholder="Choose a number" />
                  </SelectTrigger>
                  <SelectContent>
                    {addable.map((n) => (
                      <SelectItem key={n.sid} value={n.sid}>
                        {formatPhone(n.phone_number)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="key-signal h-11 rounded-full"
                disabled={!toAdd}
                onClick={async () => {
                  try {
                    await addNumberToMessagingService({
                      data: { serviceSid: service.sid, numberSid: toAdd },
                    });
                    setToAdd("");
                    await refresh();
                    toast.success("Number added to pool.");
                  } catch (error) {
                    toast.error(errorMessage(error));
                  }
                }}
              >
                Add
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}