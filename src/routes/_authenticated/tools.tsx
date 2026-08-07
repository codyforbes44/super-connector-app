import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { CalendarPanel } from "@/components/tools/CalendarPanel";
import { EmailLogPanel } from "@/components/tools/EmailLogPanel";
import { MailPanel } from "@/components/tools/MailPanel";
import { PlacesPanel } from "@/components/tools/PlacesPanel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, formatPhone, relativeTime } from "@/lib/format";
import {
  checkVerification,
  createVerifyService,
  listLookups,
  listVerifyServices,
  lookupNumber,
  startVerification,
} from "@/lib/twilio.functions";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Tools — Signalbox" },
      { name: "description", content: "Twilio Verify OTPs and phone number Lookup intelligence." },
      { property: "og:title", content: "Tools — Signalbox" },
      {
        property: "og:description",
        content: "Twilio Verify OTPs and phone number Lookup intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ToolsScreen,
});

function ToolsScreen() {
  return (
    <div>
      <ScreenHeader title="Tools" subtitle="Verify · Lookup · Mail · Calendar · Maps" />
      <div className="px-4 py-3">
        <Tabs defaultValue="verify">
          <TabsList className="glass-panel grid w-full grid-cols-3 gap-1 rounded-2xl p-1">
            <TabsTrigger value="verify" className="rounded-full">
              Verify
            </TabsTrigger>
            <TabsTrigger value="lookup" className="rounded-full">
              Lookup
            </TabsTrigger>
            <TabsTrigger value="mail" className="rounded-full">
              Mail
            </TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-full">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="maps" className="rounded-full">
              Maps
            </TabsTrigger>
            <TabsTrigger value="email" className="rounded-full">
              Email log
            </TabsTrigger>
          </TabsList>
          <TabsContent value="verify" className="pt-4">
            <VerifyPanel />
          </TabsContent>
          <TabsContent value="lookup" className="pt-4">
            <LookupPanel />
          </TabsContent>
          <TabsContent value="mail" className="pt-4">
            <MailPanel />
          </TabsContent>
          <TabsContent value="calendar" className="pt-4">
            <CalendarPanel />
          </TabsContent>
          <TabsContent value="maps" className="pt-4">
            <PlacesPanel />
          </TabsContent>
          <TabsContent value="email" className="pt-4">
            <EmailLogPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

type VerifyService = { sid: string; friendly_name: string };

function VerifyPanel() {
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState("sms");
  const [code, setCode] = useState("");
  const [service, setService] = useState("");

  const services = useQuery({
    queryKey: ["verify-services"],
    queryFn: () => listVerifyServices(),
    retry: false,
  });

  if (services.isError) {
    return (
      <p className="glass-panel rounded-3xl p-4 text-sm text-muted-foreground">
        {errorMessage(services.error)}
      </p>
    );
  }

  const list = (services.data ?? []) as unknown as VerifyService[];
  const activeService = service || list[0]?.sid || "";

  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <div className="glass-panel space-y-3 rounded-3xl p-4">
          <p className="text-sm text-muted-foreground">
            No Verify service exists yet. Create one to start sending one-time passcodes.
          </p>
          <Button
            variant="secondary"
            className="w-full rounded-full"
            onClick={async () => {
              try {
                await createVerifyService({ data: { name: "Signalbox" } });
                await services.refetch();
                toast.success("Verify service created.");
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            Create Verify service
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Service</Label>
          <Select value={activeService} onValueChange={setService}>
            <SelectTrigger className="h-11 w-full rounded-full px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {list.map((s) => (
                <SelectItem key={s.sid} value={s.sid}>
                  {s.friendly_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="verify-phone">Phone</Label>
          <Input
            id="verify-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            maxLength={20}
            className="h-11 rounded-full px-4"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-11 w-full rounded-full px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        className="key-signal h-11 w-full rounded-full"
        disabled={!activeService || !phone}
        onClick={async () => {
          try {
            await startVerification({ data: { serviceSid: activeService, to: phone, channel } });
            toast.success("Passcode sent.");
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      >
        Send passcode
      </Button>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="verify-code">Code</Label>
          <Input
            id="verify-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            className="tabular h-11 rounded-full px-4"
          />
        </div>
        <Button
          variant="secondary"
          className="h-11 rounded-full"
          disabled={!activeService || !code}
          onClick={async () => {
            try {
              const result = (await checkVerification({
                data: { serviceSid: activeService, to: phone, code },
              })) as { status?: string };
              if (result.status === "approved") toast.success("Code approved.");
              else toast.error(`Verification ${result.status ?? "failed"}.`);
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          Check
        </Button>
      </div>
    </div>
  );
}

function LookupPanel() {
  const [phone, setPhone] = useState("");
  const history = useQuery({ queryKey: ["lookups"], queryFn: () => listLookups() });

  const run = useMutation({
    mutationFn: () => lookupNumber({ data: { phone } }),
    onSuccess: async () => {
      await history.refetch();
      toast.success("Lookup complete.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="lookup-phone">Phone number</Label>
          <Input
            id="lookup-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            maxLength={20}
            className="h-11 rounded-full px-4"
          />
        </div>
        <Button
          className="key-signal h-11 rounded-full"
          disabled={!phone || run.isPending}
          onClick={() => run.mutate()}
        >
          Look up
        </Button>
      </div>

      <ul className="space-y-2">
        {(history.data ?? []).map((row) => {
          const result = (row.result ?? {}) as {
            valid?: boolean;
            country_code?: string;
            caller_name?: { caller_name?: string | null } | null;
            line_type_intelligence?: { type?: string; carrier_name?: string } | null;
          };
          return (
            <li key={row.id} className="glass-panel rounded-2xl px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="tabular text-sm font-semibold">{formatPhone(row.phone_number)}</p>
                <span className="text-[0.7rem] text-muted-foreground">
                  {relativeTime(row.created_at)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[
                  result.valid === false ? "invalid" : "valid",
                  result.line_type_intelligence?.type,
                  result.line_type_intelligence?.carrier_name,
                  result.caller_name?.caller_name,
                  result.country_code,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}