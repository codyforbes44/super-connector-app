import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
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
      <ScreenHeader title="Tools" subtitle="Verify OTP · Lookup intelligence" />
      <div className="px-4 py-3">
        <Tabs defaultValue="verify">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="verify">Verify</TabsTrigger>
            <TabsTrigger value="lookup">Lookup</TabsTrigger>
          </TabsList>
          <TabsContent value="verify" className="pt-4">
            <VerifyPanel />
          </TabsContent>
          <TabsContent value="lookup" className="pt-4">
            <LookupPanel />
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
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {errorMessage(services.error)}
      </p>
    );
  }

  const list = (services.data ?? []) as unknown as VerifyService[];
  const activeService = service || list[0]?.sid || "";

  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground">
            No Verify service exists yet. Create one to start sending one-time passcodes.
          </p>
          <Button
            variant="secondary"
            className="w-full"
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
            <SelectTrigger className="h-11 w-full">
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
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-11 w-full">
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
        className="h-11 w-full"
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
            className="tabular h-11"
          />
        </div>
        <Button
          variant="secondary"
          className="h-11"
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
            className="h-11"
          />
        </div>
        <Button className="h-11" disabled={!phone || run.isPending} onClick={() => run.mutate()}>
          Look up
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {(history.data ?? []).map((row) => {
          const result = (row.result ?? {}) as {
            valid?: boolean;
            country_code?: string;
            caller_name?: { caller_name?: string | null } | null;
            line_type_intelligence?: { type?: string; carrier_name?: string } | null;
          };
          return (
            <li key={row.id} className="py-3">
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