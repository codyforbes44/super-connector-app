import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EMPTY_ADDRESS, type AddressDraft } from "@/components/compliance/address-draft";
import { E911AddressForm } from "@/components/compliance/E911AddressForm";
import { RecordingToggle } from "@/components/compliance/RecordingToggle";
import {
  getEmergencyAddresses,
  saveEmergencyAddress,
  setCallRecording,
} from "@/lib/compliance.functions";
import type { SuggestedAddress } from "@/lib/compliance/e911";
import { errorMessage } from "@/lib/format";

type StoredAddress = {
  phone_number_sid: string;
  twilio_address_sid: string | null;
  customer_name: string;
  street: string;
  street_secondary: string | null;
  city: string;
  region: string;
  postal_code: string;
  iso_country: string;
  emergency_address_status: string | null;
  suggested_addresses: unknown;
};

function asSuggestions(value: unknown): SuggestedAddress[] {
  if (!Array.isArray(value)) return [];
  const suggestions: SuggestedAddress[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as SuggestedAddress;
    if (!row.street || !row.city || !row.region || !row.postalCode || !row.customerName) continue;
    suggestions.push(row);
  }
  return suggestions;
}

function draftFrom(row: StoredAddress | undefined): AddressDraft {
  if (!row) return EMPTY_ADDRESS;
  return {
    customerName: row.customer_name,
    street: row.street,
    streetSecondary: row.street_secondary ?? "",
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    isoCountry: row.iso_country || "US",
  };
}

export function LineCompliance({
  sid,
  phoneNumber,
  phoneLabel,
  recordCalls,
}: {
  sid: string;
  phoneNumber: string;
  phoneLabel: string;
  recordCalls: boolean;
}) {
  const queryClient = useQueryClient();
  const addresses = useQuery({
    queryKey: ["emergency-addresses"],
    queryFn: () => getEmergencyAddresses(),
  });
  const stored = ((addresses.data ?? []) as StoredAddress[]).find(
    (row) => row.phone_number_sid === sid,
  );
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_ADDRESS);
  const [suggestions, setSuggestions] = useState<SuggestedAddress[]>([]);
  const [recording, setRecording] = useState(recordCalls);
  const [busyAddress, setBusyAddress] = useState(false);
  const [busyRecording, setBusyRecording] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !stored) return;
    setDraft(draftFrom(stored));
    setSuggestions(asSuggestions(stored.suggested_addresses));
    setHydrated(true);
  }, [hydrated, stored]);

  const moved = Boolean(stored?.twilio_address_sid);

  return (
    <div className="space-y-3">
      <RecordingToggle
        enabled={recording}
        disabled={busyRecording}
        onChange={(enabled) => {
          setBusyRecording(true);
          void setCallRecording({ data: { sid, recordCalls: enabled } })
            .then(async () => {
              setRecording(enabled);
              await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
              toast.success(
                enabled ? "Recording is on for this line." : "Recording is off for this line.",
              );
            })
            .catch((error: unknown) => toast.error(errorMessage(error)))
            .finally(() => setBusyRecording(false));
        }}
      />
      <E911AddressForm
        phoneLabel={phoneLabel}
        value={draft}
        suggestions={suggestions}
        status={stored?.emergency_address_status ?? null}
        moved={moved}
        busy={busyAddress}
        onChange={setDraft}
        onUseSuggestion={(suggestion) => {
          setDraft({
            customerName: suggestion.customerName,
            street: suggestion.street,
            streetSecondary: suggestion.streetSecondary ?? "",
            city: suggestion.city,
            region: suggestion.region,
            postalCode: suggestion.postalCode,
            isoCountry: suggestion.isoCountry || "US",
          });
        }}
        onSubmit={(confirmMonthlyFee) => {
          setBusyAddress(true);
          void saveEmergencyAddress({
            data: {
              phoneNumberSid: sid,
              phoneNumber,
              customerName: draft.customerName,
              street: draft.street,
              streetSecondary: draft.streetSecondary,
              city: draft.city,
              region: draft.region,
              postalCode: draft.postalCode,
              isoCountry: draft.isoCountry,
              confirmMonthlyFee,
              moved,
            },
          })
            .then(async (result) => {
              if (!result.ok) {
                setSuggestions(result.suggestions);
                toast.error(result.message);
                return;
              }
              setSuggestions([]);
              await queryClient.invalidateQueries({ queryKey: ["emergency-addresses"] });
              toast.success(
                `Address saved. Emergency calling is $${(result.feeCents / 100).toFixed(2)} per number per month.`,
              );
            })
            .catch((error: unknown) => toast.error(errorMessage(error)))
            .finally(() => setBusyAddress(false));
        }}
      />
    </div>
  );
}
