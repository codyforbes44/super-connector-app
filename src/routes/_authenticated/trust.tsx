import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { TrustHubPanel, type TrustHubForm } from "@/components/compliance/TrustHubPanel";
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
import {
  confirmMessagingAdvancedOptOut,
  getTrustHubDraft,
  logAiVoiceConsent,
  logSmsConsent,
  saveTrustHubConfirmation,
} from "@/lib/compliance.functions";
import { inferBusinessIdType } from "@/lib/compliance/trusthub";
import { errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trust")({
  head: () => ({
    meta: [
      { title: "Caller trust — SixVox" },
      {
        name: "description",
        content: "SHAKEN/STIR, CNAM, and Voice Integrity drafts. Nothing is submitted to Twilio.",
      },
    ],
  }),
  component: TrustScreen,
});

const EMPTY_FORM: TrustHubForm = {
  cnamDisplayName: "",
  businessIdType: "none",
  voiceIntegrityUseCase: "Customer Support",
  employeeCount: 1,
  dailyCallVolume: 10,
  includeShakenStir: true,
  includeCnam: false,
  includeVoiceIntegrity: true,
  ownerConfirmed: false,
};

function TrustScreen() {
  const boot = useBootstrap();
  const draft = useQuery({
    queryKey: ["trust-hub"],
    queryFn: () => getTrustHubDraft(),
    enabled: boot.isOwner,
  });
  const [form, setForm] = useState<TrustHubForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!boot.isOwner) {
    return (
      <div>
        <ScreenHeader title="Caller trust" subtitle="Owners confirm Trust Hub drafts." />
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Ask the account owner to review SHAKEN/STIR, CNAM, and Voice Integrity.
        </p>
      </div>
    );
  }

  const business = draft.data?.business ?? {};
  const value: TrustHubForm = form ?? {
    ...EMPTY_FORM,
    businessIdType: inferBusinessIdType(business.registrationNumber),
    cnamDisplayName: (business.legalName ?? "").slice(0, 15),
  };

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Caller trust"
        subtitle="Draft only. SixVox does not create Trust Hub bundles in this release."
      />
      <TrustHubPanel
        business={business}
        customerProfileSid={draft.data?.customerProfileSid ?? null}
        value={value}
        busy={busy}
        resultMessage={message}
        onChange={setForm}
        onSave={() => {
          setBusy(true);
          void saveTrustHubConfirmation({ data: value })
            .then((result) => {
              setMessage(result.message);
              toast.success(result.message);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)))
            .finally(() => setBusy(false));
        }}
      />
      <ConsentLogs />
    </div>
  );
}

function ConsentLogs() {
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState<"review" | "marketing">("review");
  const [source, setSource] = useState("written");
  const [serviceSid, setServiceSid] = useState("");
  const [aiPhone, setAiPhone] = useState("");
  const [aiSource, setAiSource] = useState("");

  return (
    <div className="space-y-6 border-t border-border px-4 py-4">
      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold">Review and marketing consent</h2>
        <p className="text-xs text-muted-foreground">
          Automated review and marketing texts stay blocked until a consent row exists for that
          number. This log does not send a message.
        </p>
        <Label htmlFor="consent-phone">Phone</Label>
        <Input
          id="consent-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="h-11 rounded-xl"
        />
        <Select
          value={purpose}
          onValueChange={(next) => {
            if (next === "review" || next === "marketing") setPurpose(next);
          }}
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="review">Review request</SelectItem>
            <SelectItem value="marketing">Marketing</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="consent-source">How they consented</Label>
        <Input
          id="consent-source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className="h-11 rounded-xl"
        />
        <Button
          className="h-11 rounded-xl"
          onClick={() => {
            void logSmsConsent({
              data: { phoneNumber: phone, purpose, consented: true, source },
            })
              .then(() => toast.success("Consent saved."))
              .catch((error: unknown) => toast.error(errorMessage(error)));
          }}
        >
          Save consent
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold">AI voice consent</h2>
        <p className="text-xs text-muted-foreground">
          Outbound AI calls stay blocked without a prior-consent row. Saving consent does not place
          a call. SixVox does not dial outbound AI calls in this release.
        </p>
        <Label htmlFor="ai-phone">Phone</Label>
        <Input
          id="ai-phone"
          value={aiPhone}
          onChange={(event) => setAiPhone(event.target.value)}
          className="h-11 rounded-xl"
        />
        <Label htmlFor="ai-source">How they consented</Label>
        <Input
          id="ai-source"
          value={aiSource}
          onChange={(event) => setAiSource(event.target.value)}
          className="h-11 rounded-xl"
        />
        <Button
          className="h-11 rounded-xl"
          onClick={() => {
            void logAiVoiceConsent({
              data: { phoneNumber: aiPhone, consented: true, source: aiSource },
            })
              .then(() => toast.success("AI voice consent saved. No call was placed."))
              .catch((error: unknown) => toast.error(errorMessage(error)));
          }}
        >
          Save AI voice consent
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold">Messaging Service Advanced Opt-Out</h2>
        <p className="text-xs text-muted-foreground">
          Twilio’s Messaging Service API cannot turn Advanced Opt-Out on. Enable it in the Twilio
          Console on the service’s Opt-out tab, then confirm the SID here. STOP, HELP, and START are
          still honored from the local opt-out list on every send.
        </p>
        <Label htmlFor="mg-sid">Messaging Service SID</Label>
        <Input
          id="mg-sid"
          value={serviceSid}
          onChange={(event) => setServiceSid(event.target.value)}
          placeholder="MG…"
          className="h-11 rounded-xl"
        />
        <Button
          variant="secondary"
          className="h-11 rounded-xl"
          onClick={() => {
            void confirmMessagingAdvancedOptOut({
              data: { messagingServiceSid: serviceSid, confirmed: true },
            })
              .then((result) => toast.success(result.note))
              .catch((error: unknown) => toast.error(errorMessage(error)));
          }}
        >
          I enabled Advanced Opt-Out in the Console
        </Button>
      </section>
    </div>
  );
}
