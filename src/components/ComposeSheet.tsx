import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, formatPhone } from "@/lib/format";
import { listMessagingServices, sendMessage, textingReadiness } from "@/lib/twilio.functions";

export type AppNumber = { sid: string; phone_number: string; friendly_name: string | null };

export function ComposeSheet({
  open,
  onOpenChange,
  numbers,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  numbers: AppNumber[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(numbers[0]?.phone_number ?? "");
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [sender, setSender] = useState("number");
  const [busy, setBusy] = useState(false);

  const services = useQuery({
    queryKey: ["messaging-services"],
    queryFn: () => listMessagingServices(),
    retry: false,
  });
  const readiness = useQuery({
    queryKey: ["texting-readiness"],
    queryFn: () => textingReadiness(),
    retry: false,
  });
  const readinessList = (readiness.data ?? []) as unknown as Array<{
    phoneNumber: string;
    campaignStatus: string | null;
    ready: boolean;
  }>;
  const fromState = readinessList.find((s) => s.phoneNumber === from) ?? null;
  const blocked =
    channel === "sms" && sender === "number" && Boolean(fromState) && !fromState?.ready;
  const serviceList = (services.data ?? []) as unknown as Array<{
    sid: string;
    friendly_name: string;
  }>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!from) {
      toast.error("No SixVox number is assigned to you yet.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendMessage({
        data: {
          appNumber: from,
          to,
          body,
          channel,
          messagingServiceSid: sender === "number" ? null : sender,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onOpenChange(false);
      setTo("");
      setBody("");
      await navigate({ to: "/inbox/$id", params: { id: result.conversationId } });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="px-0">
          <SheetTitle className="font-display">New message</SheetTitle>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Number" />
                </SelectTrigger>
                <SelectContent>
                  {numbers.map((n) => (
                    <SelectItem key={n.sid} value={n.phone_number}>
                      {n.friendly_name || formatPhone(n.phone_number)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as "sms" | "whatsapp")}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS / MMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {blocked ? (
            <p className="rounded-xl bg-destructive/15 px-3 py-2 text-xs text-destructive">
              {formatPhone(from)} isn&apos;t approved for US texting yet.{" "}
              <Link to="/a2p" className="font-medium underline underline-offset-2">
                Finish US texting approval
              </Link>
              , or pick an approved number.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+1 555 010 2030"
              inputMode="tel"
              required
              maxLength={20}
              className="h-11"
            />
          </div>

          {channel === "sms" && serviceList.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Send via</Label>
              <Select value={sender} onValueChange={setSender}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">This number directly</SelectItem>
                  {serviceList.map((s) => (
                    <SelectItem key={s.sid} value={s.sid}>
                      {s.friendly_name} (Messaging Service)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
              maxLength={1500}
            />
          </div>

          <Button type="submit" className="h-12 w-full font-semibold" disabled={busy || blocked}>
            {busy ? "Sending…" : "Send message"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
