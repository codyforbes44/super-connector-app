export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const value = raw.replace(/^whatsapp:/, "");
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(value);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return value;
}

export function initialsFor(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  return cleaned.slice(-2).toUpperCase() || "?";
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minute = 60_000;
  if (diff < minute) return "now";
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h`;
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function duration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/^Error:\s*/, "");
  return "Something went wrong.";
}