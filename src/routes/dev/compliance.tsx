import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { EMPTY_ADDRESS, type AddressDraft } from "@/components/compliance/address-draft";
import { DialerE911Warning } from "@/components/compliance/DialerE911Warning";
import { E911AddressForm } from "@/components/compliance/E911AddressForm";
import { E911DisclosureDialog } from "@/components/compliance/E911DisclosureDialog";
import { QuietHoursCard, type QuietHoursValue } from "@/components/compliance/QuietHoursCard";
import { RecordingToggle } from "@/components/compliance/RecordingToggle";
import { TrustHubPanel, type TrustHubForm } from "@/components/compliance/TrustHubPanel";
import type { SuggestedAddress } from "@/lib/compliance/e911";

type PreviewView = "address" | "disclosure" | "dialer" | "recording" | "trust" | "quiet";

const VIEWS: PreviewView[] = ["address", "disclosure", "dialer", "recording", "trust", "quiet"];

function isView(value: string): value is PreviewView {
  return (VIEWS as readonly string[]).includes(value);
}

export const Route = createFileRoute("/dev/compliance")({
  validateSearch: (search: Record<string, unknown>): { view: PreviewView } => {
    const view = typeof search["view"] === "string" ? search["view"] : "";
    return { view: isView(view) ? view : "address" };
  },
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex" }, { title: "Compliance preview" }] }),
  component: CompliancePreview,
});

const SUGGESTION: SuggestedAddress = {
  customerName: "ACME PLUMBING",
  street: "123 MAIN ST",
  city: "AUSTIN",
  region: "TX",
  postalCode: "78701",
  isoCountry: "US",
};

function CompliancePreview() {
  const { view } = Route.useSearch();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-md">
        <nav className="flex flex-wrap gap-2 px-4 pt-4" aria-label="Preview screens">
          {VIEWS.map((item) => (
            <a
              key={item}
              href={`/dev/compliance?view=${item}`}
              className={
                item === view
                  ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                  : "rounded-full border border-border px-3 py-1 text-xs"
              }
            >
              {item}
            </a>
          ))}
        </nav>
        <PreviewBody view={view} />
      </div>
    </div>
  );
}

function PreviewBody({ view }: { view: PreviewView }) {
  switch (view) {
    case "address":
      return <AddressPreview />;
    case "disclosure":
      return <DisclosurePreview />;
    case "dialer":
      return <DialerPreview />;
    case "recording":
      return <RecordingPreview />;
    case "trust":
      return <TrustPreview />;
    case "quiet":
      return <QuietPreview />;
    default: {
      const _exhaustive: never = view;
      return _exhaustive;
    }
  }
}

function AddressPreview() {
  const [value, setValue] = useState<AddressDraft>({
    ...EMPTY_ADDRESS,
    customerName: "Acme Plumbing",
    street: "123 Main Street",
    city: "Austin",
    region: "TX",
    postalCode: "78701",
  });
  const [note, setNote] = useState("Nothing has been sent to Twilio.");
  return (
    <div className="space-y-3 px-4 py-4">
      <h1 className="font-display text-xl font-semibold">Emergency address</h1>
      <E911AddressForm
        phoneLabel="+1 512 555 0100"
        value={value}
        suggestions={[SUGGESTION]}
        status="unregistered"
        moved
        initialFeeConfirmed
        onChange={setValue}
        onUseSuggestion={(suggestion) =>
          setValue({
            customerName: suggestion.customerName,
            street: suggestion.street,
            streetSecondary: "",
            city: suggestion.city,
            region: suggestion.region,
            postalCode: suggestion.postalCode,
            isoCountry: suggestion.isoCountry,
          })
        }
        onSubmit={() => setNote("Fee confirmed in the preview. No Twilio address was created.")}
      />
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function DisclosurePreview() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  return (
    <div className="px-4 py-8">
      <h1 className="font-display text-xl font-semibold">911 acknowledgment</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {saved
          ? "Acknowledgment recorded in this preview only."
          : "The disclosure stays open until you confirm it."}
      </p>
      <E911DisclosureDialog
        open={open}
        onAcknowledge={() => {
          setSaved(true);
          setOpen(false);
        }}
      />
    </div>
  );
}

function DialerPreview() {
  return (
    <div className="space-y-4 px-4 py-6">
      <h1 className="font-display text-center text-xl font-semibold">Dialer</h1>
      <p className="text-center font-display text-3xl tabular-nums">(512) 555-0199</p>
      <DialerE911Warning acknowledged={false} />
      <button
        type="button"
        disabled
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-foreground opacity-40"
      >
        Call
      </button>
      <p className="text-center text-xs text-muted-foreground">
        The call button stays off until this user acknowledges the 911 limitations.
      </p>
    </div>
  );
}

function RecordingPreview() {
  const [enabled, setEnabled] = useState(false);
  return (
    <div className="space-y-3 px-4 py-6">
      <h1 className="font-display text-xl font-semibold">Recording</h1>
      <RecordingToggle enabled={enabled} onChange={setEnabled} />
    </div>
  );
}

function TrustPreview() {
  const [value, setValue] = useState<TrustHubForm>({
    cnamDisplayName: "ACME PLUMBING",
    businessIdType: "EIN",
    voiceIntegrityUseCase: "Customer Support",
    employeeCount: 8,
    dailyCallVolume: 40,
    includeShakenStir: true,
    includeCnam: true,
    includeVoiceIntegrity: true,
    ownerConfirmed: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <h1 className="px-4 pt-4 font-display text-xl font-semibold">Caller trust</h1>
      <TrustHubPanel
        startOnConfirm
        business={{
          legalName: "Acme Plumbing LLC",
          registrationNumber: "12-3456789",
          contactEmail: "owner@example.com",
        }}
        customerProfileSid="BUaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        value={value}
        resultMessage={message}
        onChange={setValue}
        onSave={() =>
          setMessage("Saved in this preview. Nothing was submitted to Twilio Trust Hub.")
        }
      />
    </div>
  );
}

function QuietPreview() {
  const [value, setValue] = useState<QuietHoursValue>({
    enabled: true,
    quietStart: "21:00",
    quietEnd: "08:00",
    timezone: "America/Chicago",
  });
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <h1 className="px-4 pt-4 font-display text-xl font-semibold">Quiet hours</h1>
      <QuietHoursCard value={value} onChange={setValue} onSave={() => setSaved(true)} />
      {saved ? (
        <p className="px-4 text-xs text-muted-foreground">Saved in this preview only.</p>
      ) : null}
    </div>
  );
}
