export function deliveryCounts(rows: readonly { direction?: string; status: string | null }[]) {
  const outbound = rows.filter((row) => row.direction === "outbound");
  return {
    total: outbound.length,
    sent: outbound.filter((r) => ["sent", "delivered", "read"].includes(r.status ?? "")).length,
    delivered: outbound.filter((r) => ["delivered", "read"].includes(r.status ?? "")).length,
    pending: outbound.filter((r) => ["accepted", "scheduled", "queued", "sending"].includes(r.status ?? "")).length,
    failed: outbound.filter((r) => ["failed", "undelivered", "canceled"].includes(r.status ?? "")).length,
  };
}
export function carrierMediaPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "api.twilio.com") return null;
    const match = parsed.pathname.match(/^\/2010-04-01\/Accounts\/AC[a-f0-9]{32}(\/Messages\/(?:SM|MM)[a-f0-9]{32}\/Media\/ME[a-f0-9]{32})(?:\.json)?$/);
    return match?.[1] ?? null;
  } catch { return null; }
}