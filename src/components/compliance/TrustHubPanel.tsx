import { useState } from "react";

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
import type { A2pBusinessSnapshot, BusinessIdType } from "@/lib/compliance/trusthub";
import { TRUST_FEES, VOICE_INTEGRITY_USE_CASES, cnamEligible } from "@/lib/compliance/trusthub";

export type TrustHubForm = {
  cnamDisplayName: string;
  businessIdType: BusinessIdType;
  voiceIntegrityUseCase: string;
  employeeCount: number;
  dailyCallVolume: number;
  includeShakenStir: boolean;
  includeCnam: boolean;
  includeVoiceIntegrity: boolean;
  ownerConfirmed: boolean;
};

export function TrustHubPanel({
  business,
  customerProfileSid,
  value,
  busy,
  resultMessage,
  onChange,
  onSave,
  startOnConfirm = false,
}: {
  business: A2pBusinessSnapshot;
  customerProfileSid: string | null;
  value: TrustHubForm;
  busy?: boolean;
  resultMessage?: string | null;
  onChange: (value: TrustHubForm) => void;
  onSave: () => void;
  startOnConfirm?: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(startOnConfirm);
  const eligible = cnamEligible(value.businessIdType);
  return (
    <div className="space-y-4 px-4 py-4">
      <section className="space-y-2">
        <h2 className="font-display text-sm font-semibold">Business profile</h2>
        <p className="text-xs text-muted-foreground">
          {customerProfileSid
            ? `Reusing the Secondary Customer Profile from A2P (${customerProfileSid}).`
            : "No A2P profile yet. Confirming this draft will describe a Secondary Customer Profile, and nothing is created at Twilio until a later release."}
        </p>
        <p className="text-sm">
          {business.legalName || "No legal name saved yet"}{" "}
          <span className="text-muted-foreground">
            {business.registrationNumber ? `· ${business.registrationNumber}` : "· no EIN or DUNS"}
          </span>
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-border p-3">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={value.includeShakenStir}
            onCheckedChange={(checked) =>
              onChange({ ...value, includeShakenStir: checked === true })
            }
          />
          <span>
            <span className="font-medium">SHAKEN/STIR</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {TRUST_FEES.shakenStir}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={value.includeCnam}
            onCheckedChange={(checked) => onChange({ ...value, includeCnam: checked === true })}
          />
          <span>
            <span className="font-medium">CNAM</span>
            <span className="mt-1 block text-xs text-muted-foreground">{TRUST_FEES.cnam}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={value.includeVoiceIntegrity}
            onCheckedChange={(checked) =>
              onChange({ ...value, includeVoiceIntegrity: checked === true })
            }
          />
          <span>
            <span className="font-medium">Voice Integrity</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {TRUST_FEES.voiceIntegrity}
            </span>
          </span>
        </label>
        <p className="text-xs text-muted-foreground">{TRUST_FEES.brandedCalling}</p>
      </section>

      <div className="space-y-1.5">
        <Label>Business ID for CNAM</Label>
        <Select
          value={value.businessIdType}
          onValueChange={(businessIdType) =>
            onChange({ ...value, businessIdType: businessIdType as BusinessIdType })
          }
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EIN">EIN</SelectItem>
            <SelectItem value="DUNS">DUNS</SelectItem>
            <SelectItem value="none">Neither</SelectItem>
          </SelectContent>
        </Select>
        {value.includeCnam && !eligible ? (
          <p className="text-xs text-destructive">
            CNAM stays off until the profile has an EIN or DUNS.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cnam-name">CNAM display name (15 characters)</Label>
        <Input
          id="cnam-name"
          maxLength={15}
          value={value.cnamDisplayName}
          onChange={(event) => onChange({ ...value, cnamDisplayName: event.target.value })}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Voice Integrity use case</Label>
        <Select
          value={value.voiceIntegrityUseCase}
          onValueChange={(voiceIntegrityUseCase) => onChange({ ...value, voiceIntegrityUseCase })}
        >
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOICE_INTEGRITY_USE_CASES.map((useCase) => (
              <SelectItem key={useCase} value={useCase}>
                {useCase}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="employees">Employees</Label>
          <Input
            id="employees"
            inputMode="numeric"
            value={String(value.employeeCount)}
            onChange={(event) =>
              onChange({ ...value, employeeCount: Number(event.target.value) || 0 })
            }
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="volume">Calls per day</Label>
          <Input
            id="volume"
            inputMode="numeric"
            value={String(value.dailyCallVolume)}
            onChange={(event) =>
              onChange({ ...value, dailyCallVolume: Number(event.target.value) || 0 })
            }
            className="h-11 rounded-xl"
          />
        </div>
      </div>

      {showConfirm ? (
        <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
          <Checkbox
            checked={value.ownerConfirmed}
            onCheckedChange={(checked) => onChange({ ...value, ownerConfirmed: checked === true })}
          />
          <span>
            I am the account owner. Save this Trust Hub draft. Do not submit it to Twilio.
            SHAKEN/STIR and Voice Integrity have no Twilio registration fee. CNAM needs an EIN or
            DUNS and has no separate monthly fee. Branded Calling ($0.12 per call) is not included.
          </span>
        </label>
      ) : null}

      {resultMessage ? <p className="text-sm text-muted-foreground">{resultMessage}</p> : null}

      <Button
        className="h-11 w-full rounded-xl"
        disabled={busy || (showConfirm && !value.ownerConfirmed)}
        onClick={() => {
          if (!showConfirm) {
            setShowConfirm(true);
            return;
          }
          onSave();
        }}
      >
        {busy
          ? "Saving…"
          : showConfirm
            ? "Save draft (no Twilio submission)"
            : "Review and confirm"}
      </Button>
    </div>
  );
}
