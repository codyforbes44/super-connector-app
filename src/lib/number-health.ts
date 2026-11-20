export type NumberHealthStatus = "healthy" | "attention" | "not_connected";
export type NumberHealth = {
  number: string;
  label: string;
  wired: boolean;
  lastActivity: string | null;
  errors7d: number;
  status: NumberHealthStatus;
  reason: string;
};

/** Pure health rollup per number, so the rules are testable without a database. */
export function numberHealth(
  numbers: { number: string; label: string; wired: boolean }[],
  activity: { from: string | null; to: string | null; at: string }[],
  errorNumbers: (string | null)[],
  now: number,
): NumberHealth[] {
  return numbers.map((n) => {
    const last = activity
      .filter((a) => a.from === n.number || a.to === n.number)
      .reduce<string | null>((m, a) => (!m || a.at > m ? a.at : m), null);
    const errors7d = errorNumbers.filter((e) => e === n.number).length;
    let status: NumberHealthStatus = "healthy";
    let reason = "Working normally";
    if (!n.wired) {
      status = "not_connected";
      reason = "Calls and texts aren't set up to reach SixVox";
    } else if (errors7d >= 3) {
      status = "attention";
      reason = `${errors7d} errors in the last 7 days`;
    } else if (!last || now - Date.parse(last) > 14 * 86400_000) {
      status = "attention";
      reason = "No calls or texts in 14 days";
    }
    return { ...n, lastActivity: last, errors7d, status, reason };
  });
}
