import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Hash, Link2, RefreshCw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { Empty, ListGroup, Screen, Section, usePagedList, LoadMore } from "@/components/screen";
import { MessagingServicesSection } from "@/components/MessagingServices";
import { BringYourOwnNumber } from "@/components/line/BringYourOwnNumber";
import { EsimExplainer } from "@/components/line/EsimExplainer";
import { VoiceAssistant } from "@/components/VoiceAssistant";
import { Badge } from "@/components/ui/badge";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBootstrap } from "@/hooks/useBootstrap";
import { errorMessage, formatPhone } from "@/lib/format";
import {
  assignNumber,
  listTeam,
  purchaseNumber,
  releaseNumber,
  searchAvailableNumbers,
  syncNumbers,
  updateNumberSettings,
  wireNumber,
} from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/numbers")({
  head: () => ({
    meta: [
      { title: "Numbers — SixVox" },
      { name: "description", content: "Buy, wire and assign Twilio phone numbers to your team." },
      { property: "og:title", content: "Numbers — SixVox" },
      {
        property: "og:description",
        content: "Buy, wire and assign Twilio phone numbers to your team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NumbersScreen,
});

type Available = { phone_number: string; friendly_name: string; locality?: string; region?: string };

function NumbersScreen() {
  const boot = useBootstrap();
  const queryClient = useQueryClient();
  const [buying, setBuying] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => listTeam(),
    enabled: boot.isAdmin,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    if (boot.isAdmin) await queryClient.invalidateQueries({ queryKey: ["team"] });
  };

  const paged = usePagedList(boot.numbers, 25);

  async function runSync() {
    setSyncing(true);
    try {
      const result = await syncNumbers();
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      await queryClient.refetchQueries({ queryKey: ["bootstrap"] });
      toast.success(
        result.removed > 0
          ? `Synced ${result.synced} number${result.synced === 1 ? "" : "s"} · removed ${result.removed} released`
          : `Synced ${result.synced} number${result.synced === 1 ? "" : "s"} from Twilio.`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSyncing(false);
    }
  }

  const current = boot.numbers.find((n) => n.sid === editing);

  return (
    <div>
      <ScreenHeader
        title="Your lines"
        subtitle={boot.isAdmin ? "SixVox numbers and your own carrier line" : "Lines that ring on this phone"}
        action={
          boot.isAdmin ? (
            <Button size="icon" variant="ghost" onClick={runSync} disabled={syncing}>
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              <span className="sr-only">Sync numbers</span>
            </Button>
          ) : null
        }
      />

      <Screen className="px-3 pt-0 sm:px-3" onRefresh={refresh}>
      {boot.isOwner ? (
        <div className="py-3">
          <Button
            className="key-signal h-12 w-full rounded-xl font-semibold"
            onClick={() => setBuying(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            Find & buy a number
          </Button>
        </div>
      ) : null}

      {boot.numbers.length === 0 ? (
        <Empty
          icon={Hash}
          title="No SixVox line yet"
          description={
            boot.isAdmin
              ? "Sync the numbers you already own, or search and claim a new one."
              : "An admin hasn't assigned you a number yet."
          }
          action={
            boot.isAdmin ? (
              <Button variant="secondary" onClick={runSync}>
                Sync my numbers
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
        <ListGroup>
          {paged.items.map((n) => {
            const owner = (team.data ?? []).find((t) => t.id === n.assigned_to);
            return (
              <div key={n.sid} className="px-4 py-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => boot.isAdmin && setEditing(n.sid)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="tabular text-sm font-semibold">{formatPhone(n.phone_number)}</p>
                    <div className="flex gap-1.5">
                      {n.webhook_wired ? (
                        <Badge variant="secondary" className="text-[0.6rem]">
                          live
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[0.6rem] text-destructive">
                          not wired
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {n.friendly_name || "Unnamed"}
                    {owner ? ` · ${owner.display_name || owner.email}` : " · unassigned"}
                  </p>
                </button>
              </div>
            );
          })}
        </ListGroup>
        <LoadMore
          hasMore={paged.hasMore}
          remaining={paged.remaining}
          onLoadMore={paged.loadMore}
        />
        </>
      )}

      <Section title="Your own phone number" className="space-y-3 pb-2">
        <BringYourOwnNumber lines={boot.numbers.map((n) => ({ phone_number: n.phone_number }))} />
        <EsimExplainer />
      </Section>

      {boot.isOwner ? (
        <MessagingServicesSection numbers={boot.numbers} />
      ) : null}
      </Screen>

      {boot.isOwner ? (
        <BuySheet
          open={buying}
          onOpenChange={setBuying}
          onDone={async () => {
            await refresh();
            setBuying(false);
          }}
        />
      ) : null}

      {current ? (
        <NumberSheet
          key={current.sid}
          number={current}
          team={team.data ?? []}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

function BuySheet({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [type, setType] = useState("Local");
  const [results, setResults] = useState<Available[]>([]);

  const search = useMutation({
    mutationFn: () =>
      searchAvailableNumbers({ data: areaCode ? { country, areaCode, type } : { country, type } }),
    onSuccess: (data) => setResults(data as unknown as Available[]),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const buy = useMutation({
    mutationFn: (phoneNumber: string) => purchaseNumber({ data: { phoneNumber } }),
    onSuccess: async () => {
      toast.success("Number purchased and webhooks wired.");
      await onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="app-gradient max-h-[85dvh] overflow-y-auto rounded-t-[2rem] border-border"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display">Find a number</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                className="h-11 rounded-xl px-4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Area</Label>
              <Input
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                className="h-11 rounded-xl px-4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-11 w-full rounded-xl px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Local">Local</SelectItem>
                  <SelectItem value="TollFree">Toll-free</SelectItem>
                  <SelectItem value="Mobile">Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="h-11 w-full rounded-xl"
            variant="secondary"
            onClick={() => search.mutate()}
            disabled={search.isPending}
          >
            {search.isPending ? "Searching…" : "Search available numbers"}
          </Button>

          <ul className="space-y-2">
            {results.map((r) => (
              <li
                key={r.phone_number}
                className="glass-panel flex items-center gap-3 rounded-2xl px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="tabular text-sm font-semibold">{formatPhone(r.phone_number)}</p>
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    {[r.locality, r.region].filter(Boolean).join(", ") || r.friendly_name}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="key-call rounded-full"
                  onClick={() => buy.mutate(r.phone_number)}
                  disabled={buy.isPending}
                >
                  Buy
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type NumberRow = {
  sid: string;
  phone_number: string;
  friendly_name: string | null;
  forward_to: string | null;
  voicemail_greeting: string | null;
  assigned_to: string | null;
  webhook_wired: boolean;
  answer_mode?: string | null;
  elevenlabs_voice_id?: string | null;
  elevenlabs_agent_id?: string | null;
};

function NumberSheet({
  number,
  team,
  onClose,
  onChanged,
}: {
  number: NumberRow;
  team: Array<{ id: string; display_name: string | null; email: string | null }>;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const [friendlyName, setFriendlyName] = useState(number.friendly_name ?? "");
  const [forwardTo, setForwardTo] = useState(number.forward_to ?? "");
  const [greeting, setGreeting] = useState(number.voicemail_greeting ?? "");
  const [assigned, setAssigned] = useState(number.assigned_to ?? "unassigned");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateNumberSettings({
        data: {
          sid: number.sid,
          friendlyName,
          forwardTo: forwardTo || null,
          voicemailGreeting: greeting || null,
        },
      });
      await assignNumber({
        data: { sid: number.sid, assignedTo: assigned === "unassigned" ? null : assigned },
      });
      await onChanged();
      toast.success("Number updated.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="app-gradient max-h-[88dvh] overflow-y-auto rounded-t-[2rem] border-border"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display tabular">
            {formatPhone(number.phone_number)}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
          <div className="space-y-1.5">
            <Label>Label</Label>
            <Input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              maxLength={64}
              className="h-11 rounded-xl px-4"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assigned agent</Label>
            <Select value={assigned} onValueChange={setAssigned}>
              <SelectTrigger className="h-11 w-full rounded-xl px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Shared (all admins)</SelectItem>
                {team.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.display_name || t.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Forward inbound calls to</Label>
            <Input
              value={forwardTo}
              onChange={(e) => setForwardTo(e.target.value)}
              placeholder="Leave empty to send to voicemail"
              inputMode="tel"
              maxLength={20}
              className="h-11 rounded-xl px-4"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Voicemail greeting</Label>
            <Input
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              maxLength={300}
              className="h-11 rounded-xl px-4"
            />
          </div>

          <VoiceAssistant number={number} onChanged={onChanged} />

          <Button
            className="key-signal h-12 w-full rounded-xl font-semibold"
            onClick={save}
            disabled={busy}
          >
            Save changes
          </Button>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 rounded-full"
              onClick={async () => {
                try {
                  await wireNumber({ data: { sid: number.sid } });
                  await onChanged();
                  toast.success("Webhooks pointed at SixVox.");
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Wire webhooks
            </Button>
            <Button
              variant="ghost"
              className="key-end rounded-full"
              onClick={async () => {
                if (!confirm("Release this number? This cannot be undone.")) return;
                try {
                  await releaseNumber({ data: { sid: number.sid } });
                  await onChanged();
                  onClose();
                  toast.success("Number released.");
                } catch (error) {
                  toast.error(errorMessage(error));
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}