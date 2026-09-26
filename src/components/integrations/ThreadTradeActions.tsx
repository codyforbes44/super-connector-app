import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notRegisteredCopy } from "@/lib/integrations/automated-text";
import { errorMessage } from "@/lib/format";
import {
  markJobDone,
  pushCallToHousecall,
  pushCallToJobber,
  sendPaymentLink,
} from "@/lib/trade.functions";

type Panel = "jobber" | "housecall" | "payment" | null;

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function outcomeCopy(reason: string | undefined, appNumber: string | null): string {
  switch (reason) {
    case "opted_out":
      return "This contact opted out. No text was sent.";
    case "not_registered":
      return notRegisteredCopy(appNumber);
    case "duplicate":
      return "A review request was already sent for this job.";
    case "cooldown":
      return "This contact is still inside the review cooldown. No text was sent.";
    case "quiet_hours":
      return "Quiet hours are in effect. The job is marked done and the review text was held.";
    case "missing_review_url":
      return "Add a Google review link under Integrations before sending.";
    case "reviews_disabled":
      return "Review requests are off. The job is marked done.";
    case "no_conversation":
      return "This job has no conversation to text.";
    default:
      return reason ? reason.replaceAll("_", " ") : "Nothing was sent.";
  }
}

export function ThreadTradeActions({
  conversationId,
  contactName,
  contactNumber,
  optedOut,
  textingReady,
  appNumber,
  summary,
  jobStatus,
  preview = false,
  initialPanel = null,
}: {
  conversationId: string;
  contactName: string | null;
  contactNumber: string;
  optedOut: boolean;
  textingReady: boolean;
  appNumber: string | null;
  summary: string | null;
  jobStatus: string | null;
  preview?: boolean;
  initialPanel?: Panel;
}) {
  const name = splitName(contactName);
  const [panel, setPanel] = useState<Panel>(initialPanel);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(jobStatus === "done");
  const [firstName, setFirstName] = useState(name.firstName);
  const [lastName, setLastName] = useState(name.lastName);
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [callSummary, setCallSummary] = useState(summary ?? "");
  const [amount, setAmount] = useState(preview ? "125.00" : "");
  const [description, setDescription] = useState(preview ? "Water heater replacement" : "");

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="border-t border-border bg-background/80 px-3 py-2"
      data-testid="thread-trade-actions"
    >
      {!textingReady ? (
        <p className="mb-2 text-xs text-muted-foreground">{notRegisteredCopy(appNumber)}</p>
      ) : null}
      {optedOut ? (
        <p className="mb-2 text-xs text-destructive">
          This contact opted out. Automated texts stay off.
        </p>
      ) : null}
      <div className="flex gap-2 overflow-x-auto">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || done}
          onClick={() =>
            void run(async () => {
              if (preview) {
                setDone(true);
                toast.success("Job marked done. Review request logged on this thread.");
                return;
              }
              const result = await markJobDone({ data: { conversationId } });
              setDone(true);
              if (result.sent) toast.success("Job marked done. Review request sent.");
              else
                toast.message(
                  outcomeCopy("reason" in result ? result.reason : undefined, appNumber),
                );
            })
          }
        >
          {done ? "Job done" : "Mark job done"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setPanel(panel === "jobber" ? null : "jobber")}
        >
          Jobber
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setPanel(panel === "housecall" ? null : "housecall")}
        >
          Housecall Pro
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setPanel(panel === "payment" ? null : "payment")}
        >
          Payment link
        </Button>
      </div>

      {panel === "jobber" || panel === "housecall" ? (
        <form
          className="mt-3 space-y-2"
          data-testid={panel === "jobber" ? "jobber-sync-form" : "housecall-sync-form"}
          onSubmit={(event) => {
            event.preventDefault();
            const provider = panel;
            void run(async () => {
              if (preview) {
                toast.success(
                  provider === "jobber"
                    ? "Preview: Jobber client and request would be created."
                    : "Preview: Housecall Pro customer and lead would be created.",
                );
                setPanel(null);
                return;
              }
              const payload = {
                conversationId,
                firstName,
                lastName,
                phone: contactNumber,
                street,
                city,
                state,
                postalCode,
                summary: callSummary,
              };
              if (provider === "jobber") {
                const result = await pushCallToJobber({ data: payload });
                toast.success(
                  result.matchedExistingClient
                    ? "Matched a Jobber client and created a request."
                    : "Created a Jobber client and request.",
                );
              } else {
                await pushCallToHousecall({ data: payload });
                toast.success("Created a Housecall Pro customer and lead.");
              }
              setPanel(null);
            });
          }}
        >
          <p className="text-xs text-muted-foreground">
            {panel === "jobber"
              ? "Match an existing Jobber client by phone, or create one, then open a request and log this summary as a note."
              : "Create a Housecall Pro customer and lead from this call. Requires a MAX-plan API key."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="First name"
            />
            <Input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Last name"
            />
            <Input
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              placeholder="Street"
            />
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City"
            />
            <Input
              value={state}
              onChange={(event) => setState(event.target.value)}
              placeholder="State"
            />
            <Input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              placeholder="ZIP"
            />
          </div>
          <Textarea
            value={callSummary}
            onChange={(event) => setCallSummary(event.target.value)}
            placeholder="Call summary"
            rows={3}
          />
          <Button type="submit" size="sm" disabled={busy}>
            {panel === "jobber" ? "Create Jobber request" : "Create Housecall Pro lead"}
          </Button>
        </form>
      ) : null}

      {panel === "payment" ? (
        <form
          className="mt-3 space-y-2"
          data-testid="payment-link-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (preview) {
                toast.success(
                  "Preview: test payment link would be texted. Money stays on the connected account.",
                );
                return;
              }
              const result = await sendPaymentLink({
                data: { conversationId, amount, description },
              });
              if (result.sent)
                toast.success("Payment link texted. Status updates land in this thread.");
              else toast.message(outcomeCopy(result.reason, appNumber));
            });
          }}
        >
          <p className="text-xs text-muted-foreground">
            Test mode. The charge is created on the connected Stripe account, not on SixVox.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount (USD)</Label>
            <Input
              id="pay-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="125.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-desc">Description</Label>
            <Input
              id="pay-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Water heater replacement"
            />
          </div>
          <Button type="submit" size="sm" disabled={busy || !textingReady || optedOut}>
            Text payment link
          </Button>
        </form>
      ) : null}
    </div>
  );
}
