/** Retain the first complete row for a provider identity, never by display name. */
export function uniqueProviderRows<T>(rows: readonly T[], identity: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = identity(row)?.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function importableMessage(row: {
  sid: string;
  from: string;
  to: string;
  body: string;
  num_media: string;
}) {
  return Boolean(row.sid && row.from && row.to && (row.body?.trim() || Number(row.num_media) > 0));
}

export function importableCall(row: {
  sid: string;
  from: string;
  to: string;
  parent_call_sid?: string | null;
}) {
  return Boolean(
    row.sid &&
    row.from &&
    row.to &&
    !row.parent_call_sid &&
    !row.from.startsWith("client:") &&
    !row.to.startsWith("client:"),
  );
}

export function validateImportConfirmation(input: { confirmedIds?: string[] }) {
  if (
    !Array.isArray(input.confirmedIds) ||
    input.confirmedIds.length > 300 ||
    input.confirmedIds.some((id) => typeof id !== "string" || !/^(CA|SM|MM)[a-f0-9]{32}$/.test(id))
  ) {
    throw new Error("Preview and confirm the import first.");
  }
  return { confirmedIds: [...new Set(input.confirmedIds)] };
}

export type CarrierCall = {
  sid: string;
  parent_call_sid?: string | null;
  direction: string;
  from: string;
  to: string;
  forwarded_from?: string | null;
  start_time?: string | null;
  date_created: string;
  duration?: string | null;
};

/** A self-forwarded inbound leg needs matching carrier child-leg evidence, not just phone/time. */
export function forwardedCallParent(call: CarrierCall, calls: readonly CarrierCall[]): string | null {
  if (call.direction !== "inbound" || call.forwarded_from !== call.to) return null;
  if ([call.from, call.to, call.forwarded_from].includes("+12149786445")) return null;
  const start = Date.parse(call.start_time || call.date_created);
  const matches = calls.filter((leg) =>
    leg.direction === "outbound-dial" && leg.parent_call_sid &&
    leg.parent_call_sid !== call.sid && leg.from === call.from && leg.to === call.to &&
    leg.forwarded_from && leg.forwarded_from !== call.to &&
    leg.forwarded_from !== "+12149786445" &&
    Math.abs(Date.parse(leg.start_time || leg.date_created) - start) <= 3000 &&
    Math.abs(Number(leg.duration) - Number(call.duration)) <= 1,
  );
  return matches.length === 1 ? matches[0]?.parent_call_sid ?? null : null;
}
