import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FORWARDING_DEFAULT_COPY,
  PORT_IN_BETA_COPY,
  type PortDraft,
  type PortLoa,
} from "@/lib/integrations/port-in";

import type { IntegrationsSnapshot } from "./types";

const PORT_WEBHOOK_URL = "https://sixvox.3bi.io/api/public/twilio/port-in";

const EMPTY_LOA: PortLoa = {
  customerType: "Business",
  customerName: "",
  accountNumber: "",
  accountTelephoneNumber: "",
  authorizedRepresentative: "",
  authorizedRepresentativeEmail: "",
  street: "",
  city: "",
  state: "",
  zip: "",
};

export function PortInWizard({
  port,
  busy,
  onSaveDraft,
  onConfirm,
}: {
  port: IntegrationsSnapshot["port"];
  busy: boolean;
  onSaveDraft: (
    draft: PortDraft,
    bill: { filename: string; mime: string; base64: string },
  ) => Promise<{ id: string }>;
  onConfirm: (portId: string) => Promise<{ submitted: boolean; reason: string | null }>;
}) {
  const [phoneNumber, setPhoneNumber] = useState(port.phoneNumber ?? "");
  const [loa, setLoa] = useState<PortLoa>({
    ...EMPTY_LOA,
    accountTelephoneNumber: port.phoneNumber ?? "",
  });
  const [billName, setBillName] = useState("");
  const [bill, setBill] = useState<{ filename: string; mime: string; base64: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(port.status === "ready" ? port.id : null);

  const inFlight =
    port.status !== null &&
    port.status !== "canceled" &&
    port.status !== "rejected" &&
    port.status !== "draft";
  const showForm = !inFlight || port.status === "ready";

  function patchLoa(patch: Partial<PortLoa>) {
    setLoa((current) => ({ ...current, ...patch }));
  }

  async function readBill(file: File) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error("Could not read the utility bill."));
      reader.readAsDataURL(file);
    });
    setBill({ filename: file.name, mime: file.type || "application/pdf", base64 });
    setBillName(file.name);
  }

  return (
    <div className="space-y-4" data-testid="port-in-wizard">
      <p className="text-xs text-muted-foreground">{PORT_IN_BETA_COPY}</p>
      <p className="text-xs text-muted-foreground">{FORWARDING_DEFAULT_COPY}</p>
      <p className="text-xs">
        <Link to="/numbers" className="font-medium text-primary underline underline-offset-2">
          Set up forwarding
        </Link>{" "}
        on your numbers page. That stays the path until a port shows completed.
      </p>

      {port.status ? (
        <div className="rounded-2xl border border-border bg-muted/40 px-3 py-3 text-sm">
          <p className="font-medium">Port status: {port.status.replaceAll("_", " ")}</p>
          {port.phoneNumber ? (
            <p className="text-xs text-muted-foreground">Number {port.phoneNumber}</p>
          ) : null}
          {port.accountLast4 ? (
            <p className="text-xs text-muted-foreground">Account ending {port.accountLast4}</p>
          ) : null}
          {port.rejectionReason ? (
            <p className="mt-1 text-xs text-destructive">{port.rejectionReason}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {port.forwardingDefault
              ? "Forwarding your old number is still the default."
              : "This port is complete. Forwarding is no longer required for this number."}
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border px-3 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Status webhook</p>
        <p className="mt-1 break-all">{PORT_WEBHOOK_URL}</p>
        <p className="mt-1">
          Paste that URL in the Twilio console for port-in status. If TWILIO_WEBHOOK_TOKEN is set,
          append <span className="font-medium">?t=</span> and the token. SixVox does not overwrite
          the account-level porting webhook.
        </p>
      </div>

      {showForm ? (
        <div className="space-y-3">
          <Field label="Number to port" id="port-phone">
            <Input
              id="port-phone"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+1 580 555 0190"
              autoComplete="tel"
            />
          </Field>
          <div className="space-y-1.5">
            <Label>Account type</Label>
            <Select
              value={loa.customerType}
              onValueChange={(value) =>
                patchLoa({ customerType: value === "Individual" ? "Individual" : "Business" })
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Name on the carrier account" id="port-name">
            <Input
              id="port-name"
              value={loa.customerName}
              onChange={(event) => patchLoa({ customerName: event.target.value })}
            />
          </Field>
          <Field label="Account number at the losing carrier" id="port-account">
            <Input
              id="port-account"
              value={loa.accountNumber}
              onChange={(event) => patchLoa({ accountNumber: event.target.value })}
            />
          </Field>
          <Field label="Account telephone number" id="port-atn">
            <Input
              id="port-atn"
              value={loa.accountTelephoneNumber}
              onChange={(event) => patchLoa({ accountTelephoneNumber: event.target.value })}
            />
          </Field>
          <Field label="Authorized representative" id="port-rep">
            <Input
              id="port-rep"
              value={loa.authorizedRepresentative}
              onChange={(event) => patchLoa({ authorizedRepresentative: event.target.value })}
            />
          </Field>
          <Field label="Representative email" id="port-email">
            <Input
              id="port-email"
              type="email"
              value={loa.authorizedRepresentativeEmail}
              onChange={(event) => patchLoa({ authorizedRepresentativeEmail: event.target.value })}
            />
          </Field>
          <Field label="Billing street" id="port-street">
            <Input
              id="port-street"
              value={loa.street}
              onChange={(event) => patchLoa({ street: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="City" id="port-city">
              <Input
                id="port-city"
                value={loa.city}
                onChange={(event) => patchLoa({ city: event.target.value })}
              />
            </Field>
            <Field label="State" id="port-state">
              <Input
                id="port-state"
                value={loa.state}
                onChange={(event) => patchLoa({ state: event.target.value })}
              />
            </Field>
            <Field label="ZIP" id="port-zip">
              <Input
                id="port-zip"
                value={loa.zip}
                onChange={(event) => patchLoa({ zip: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Utility bill (last 30 days)" id="port-bill">
            <Input
              id="port-bill"
              type="file"
              accept="application/pdf,image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readBill(file);
              }}
            />
            {billName ? <p className="text-xs text-muted-foreground">{billName}</p> : null}
          </Field>
          <div className="flex items-start gap-2">
            <Checkbox
              id="port-confirm"
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor="port-confirm" className="text-xs leading-snug font-normal">
              I confirm this letter of authorization and want SixVox to submit the port. Nothing is
              sent until this box is checked.
            </Label>
          </div>
          {!port.liveEnabled ? (
            <p className="text-xs text-muted-foreground">
              Live submission is off. Saving a draft stores the letter and the bill. Confirming will
              not call Twilio until PORT_IN_LIVE is true.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setNotice(null);
                if (!bill && !savedId) {
                  setNotice("Upload a utility bill before saving the draft.");
                  return;
                }
                if (!bill) return;
                const saved = await onSaveDraft({ phoneNumber, loa, hasUtilityBill: true }, bill);
                setSavedId(saved.id);
                setNotice("Draft saved. The carrier has not been contacted.");
              }}
            >
              Save draft
            </Button>
            <Button
              type="button"
              disabled={busy || !confirmed}
              onClick={async () => {
                setNotice(null);
                let id = savedId;
                if (!id) {
                  if (!bill) {
                    setNotice("Upload a utility bill before submitting.");
                    return;
                  }
                  const saved = await onSaveDraft({ phoneNumber, loa, hasUtilityBill: true }, bill);
                  id = saved.id;
                  setSavedId(id);
                }
                const result = await onConfirm(id);
                setNotice(
                  result.submitted
                    ? "Submitted to Twilio. Forwarding stays in place until the port completes."
                    : (result.reason ?? "Nothing was sent to Twilio."),
                );
              }}
            >
              Submit port
            </Button>
          </div>
          {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
