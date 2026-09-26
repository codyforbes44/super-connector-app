export function formatPhone(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return raw;
}

export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

export function toE164(input: string): string | null {
  const digits = digitsOnly(input);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && input.trim().startsWith("+")) return `+${digits}`;
  return null;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const delta = Date.now() - then;
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString();
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const whole = Math.max(0, Math.round(seconds));
  const mins = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${mins}:${rest.toString().padStart(2, "0")}`;
}
