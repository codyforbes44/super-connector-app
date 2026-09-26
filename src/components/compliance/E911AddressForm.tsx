import { useState } from "react";

import type { AddressDraft } from "@/components/compliance/address-draft";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  E911_MONTHLY_FEE_LABEL,
  E911_UNREGISTERED_CALL_FEE_LABEL,
} from "@/lib/compliance/disclosure";
import type { SuggestedAddress } from "@/lib/compliance/e911";

export function E911AddressForm({
  phoneLabel,
  value,
  suggestions,
  status,
  moved,
  busy,
  onChange,
  onSubmit,
  onUseSuggestion,
  initialFeeConfirmed = false,
}: {
  phoneLabel: string;
  value: AddressDraft;
  suggestions: SuggestedAddress[];
  status: string | null;
  moved: boolean;
  busy?: boolean;
  onChange: (value: AddressDraft) => void;
  onSubmit: (confirmMonthlyFee: boolean) => void;
  onUseSuggestion: (suggestion: SuggestedAddress) => void;
  initialFeeConfirmed?: boolean;
}) {
  const [feeConfirmed, setFeeConfirmed] = useState(initialFeeConfirmed);
  const field = (key: keyof AddressDraft, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`e911-${key}`}>{label}</Label>
      <Input
        id={`e911-${key}`}
        value={value[key]}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        className="h-11 rounded-xl"
      />
    </div>
  );

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <div>
        <p className="text-sm font-medium">Emergency address for {phoneLabel}</p>
        <p className="text-xs text-muted-foreground">
          Status: {status ?? "not registered"}. Emergency calling is {E911_MONTHLY_FEE_LABEL}. A 911
          call with no registered address costs {E911_UNREGISTERED_CALL_FEE_LABEL}.
          {moved
            ? " Replacing the address keeps the same monthly fee. It does not add a second charge."
            : ""}
        </p>
      </div>
      {field("customerName", "Name at this address")}
      {field("street", "Street")}
      {field("streetSecondary", "Apt or suite")}
      <div className="grid grid-cols-2 gap-3">
        {field("city", "City")}
        {field("region", "State")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("postalCode", "ZIP")}
        {field("isoCountry", "Country")}
      </div>
      {suggestions.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">Twilio suggested these addresses</p>
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.street}-${suggestion.postalCode}`}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-border px-3 py-2 text-left text-xs"
                  onClick={() => onUseSuggestion(suggestion)}
                >
                  {suggestion.street}, {suggestion.city}, {suggestion.region}{" "}
                  {suggestion.postalCode}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="flex items-start gap-2 text-xs">
        <Checkbox
          checked={feeConfirmed}
          onCheckedChange={(checked) => setFeeConfirmed(checked === true)}
          className="mt-0.5"
        />
        <span>
          I confirm the {E911_MONTHLY_FEE_LABEL} emergency calling fee. Nothing is sent to Twilio
          until this box is checked.
        </span>
      </label>
      <Button
        type="button"
        className="h-11 w-full rounded-xl"
        disabled={!feeConfirmed || busy}
        onClick={() => onSubmit(feeConfirmed)}
      >
        {busy
          ? "Checking address…"
          : moved
            ? "Save new service address"
            : "Register emergency address"}
      </Button>
    </div>
  );
}
