/**
 * FCC 2024: an AI-generated voice is an artificial voice under the TCPA.
 * Outbound AI calls require a stored prior-consent row for that number.
 */

export type AiConsentRow = {
  phoneNumber: string;
  consented: boolean;
  recordedAt: string;
};

export function latestAiConsent(rows: AiConsentRow[]): boolean {
  const sorted = [...rows].sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  return sorted[0]?.consented === true;
}

export function assertAiOutboundConsent(consented: boolean): void {
  if (!consented) {
    throw new Error(
      "No recorded prior consent for an AI voice call to this number. Outbound AI calls stay blocked.",
    );
  }
}
