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
