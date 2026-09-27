import { createFileRoute, redirect } from "@tanstack/react-router";

import { CallSummaryCard } from "@/components/intelligence/CallSummaryCard";
import { AnsweringLanguageControl } from "@/components/line/AnsweringLanguageControl";
import { BookingSettings } from "@/components/line/BookingSettings";
import { LineAutomationSettings } from "@/components/line/LineAutomationSettings";
import { PendingBookings } from "@/components/line/PendingBookings";
import { SpamSettings } from "@/components/line/SpamSettings";
import type { LineLanguage } from "@/lib/answering/language";
import { DEFAULT_BUSINESS_TIMEZONE, DEFAULT_WEEKLY_SCHEDULE } from "@/lib/business-hours";
import { weeklyMissed } from "@/lib/email-templates/index";
import { DEFAULT_EMERGENCY_KEYWORDS } from "@/lib/emergency-keywords";
import {
  DEFAULT_TEXT_BACK_DEDUPE_MINUTES,
  DEFAULT_TEXT_BACK_TEMPLATE,
  DEFAULT_TEXT_BACK_TEMPLATE_ES,
} from "@/lib/missed-call";

export const Route = createFileRoute("/dev/receptionist-preview")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  component: ReceptionistPreview,
});

const email = weeklyMissed({
  baseUrl: "https://sixvox.3bi.io",
  rangeLabel: "this week",
  missed: [
    {
      from: "+15805550142",
      at: "Mon, 22 Sep 2026 14:12:00 GMT",
      summary: "Maria Lopez needs a plumber at 418 Oak Street, Tulsa. Burst pipe, emergency.",
    },
  ],
  booked: [
    {
      summary: "Burst pipe repair",
      when: "Mon, 28 Sep 2026 14:00:00 GMT",
      contact: "+15805550142",
    },
  ],
});

const LANGUAGE_OPTIONS = ["en", "es", "auto"] as const satisfies readonly LineLanguage[];

function linePreview(language: LineLanguage) {
  return {
    textBackEnabled: true,
    textBackTemplate:
      language === "es" ? DEFAULT_TEXT_BACK_TEMPLATE_ES : DEFAULT_TEXT_BACK_TEMPLATE,
    textBackOnAi: false,
    textBackOnVoicemail: false,
    textBackDedupeMinutes: DEFAULT_TEXT_BACK_DEDUPE_MINUTES,
    businessHoursEnabled: false,
    businessTimezone: DEFAULT_BUSINESS_TIMEZONE,
    schedule: DEFAULT_WEEKLY_SCHEDULE,
    holidays: "",
    afterHours: "ai" as const,
    emergencyKeywords: DEFAULT_EMERGENCY_KEYWORDS.join("\n"),
    emergencyTransferNumber: "",
    textingNotice: null,
    textingRegistered: true,
    language,
  };
}

function ReceptionistPreview() {
  return (
    <main className="mx-auto max-w-lg space-y-6 bg-background px-4 py-6 text-foreground">
      <h1 className="font-display text-lg font-semibold">Receptionist preview</h1>
      {LANGUAGE_OPTIONS.map((language) => (
        <section
          key={language}
          data-testid={`language-sheet-${language}`}
          className="space-y-3 rounded-3xl border border-border bg-card p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">AI receptionist</p>
          <h2 className="font-display text-base font-semibold">+1 (580) 555-0142</h2>
          <AnsweringLanguageControl value={language} onChange={() => undefined} />
        </section>
      ))}
      <section data-testid="line-settings-language" className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Line settings</p>
        <LineAutomationSettings sid="preview" preview={linePreview("en")} />
      </section>
      <BookingSettings
        preview={{
          enabled: true,
          confirmMode: "confirm",
          slotMinutes: 60,
          bufferMinutes: 15,
          travelMinutes: 20,
          timezone: "America/Chicago",
          hours: { start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5] },
          serviceAreaMode: "radius",
          serviceAreaRadiusMiles: 25,
          serviceAreaAddress: "Tulsa, OK",
          serviceAreaZips: "",
          textingRegistered: true,
        }}
      />
      <PendingBookings
        preview={[
          {
            id: "preview-booking",
            contact_name: "Maria Lopez",
            contact_number: "+15805550142",
            address: "418 Oak Street, Tulsa, OK 74103",
            job_type: "plumbing",
            summary: "Burst pipe repair",
            slot_start: "2026-09-28T14:00:00.000Z",
            slot_end: "2026-09-28T15:00:00.000Z",
            sms_status: null,
            status: "proposed",
          },
        ]}
      />
      <CallSummaryCard
        callSid="preview-call"
        preview={{
          summary:
            "Maria Lopez called about a burst pipe at 418 Oak Street, Tulsa. She asked for a same-day plumber.",
          intent: "new job",
          sentiment: "neutral",
          urgency: "high",
          topics: ["plumbing"],
          tags: ["emergency", "plumbing"],
          lead_name: "Maria Lopez",
          lead_callback: "+15805550142",
          lead_address: "418 Oak Street, Tulsa, OK 74103",
          lead_address_valid: true,
          lead_job_type: "plumbing",
          lead_urgency: "high",
          assigned_label: "Cody",
          turns: [
            {
              speaker: "caller",
              text: "This is Maria Lopez. I have a burst pipe at 418 Oak Street in Tulsa.",
            },
          ],
        }}
      />
      <SpamSettings
        preview={[
          { id: "allow", phone_number: "+15805550100", list: "allow", note: null },
          { id: "block", phone_number: "+18005550199", list: "block", note: null },
        ]}
      />
      <section className="space-y-2" aria-label="Weekly report email">
        <h2 className="font-display text-sm font-semibold">{email.subject}</h2>
        <iframe
          title="Weekly report email"
          className="h-96 w-full rounded-2xl border border-border bg-white"
          srcDoc={email.html}
        />
      </section>
    </main>
  );
}
