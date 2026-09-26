/** Pull structured lead fields out of a transcript without calling a model. */

export type LeadFields = {
  name: string | null;
  callbackNumber: string | null;
  address: string | null;
  jobType: string | null;
  urgency: "low" | "normal" | "high";
  tags: string[];
};

const JOBS: Array<{ tag: string; pattern: RegExp }> = [
  {
    tag: "plumbing",
    pattern: /\b(plumb\w*|leak|leaking|fuga|tuber[ií]a|sink|drain|water heater|calentador)\b/i,
  },
  {
    tag: "hvac",
    pattern: /\b(hvac|furnace|ac|a\/c|air conditioning|heater|no heat|no cool|calefacci[oó]n)\b/i,
  },
  { tag: "electrical", pattern: /\b(electric\w*|outlet|breaker|panel|el[eé]ctric\w*)\b/i },
  { tag: "garage door", pattern: /\b(garage door|puerta de garaje)\b/i },
  { tag: "cleaning", pattern: /\b(clean\w*|limpieza|housekeep\w*)\b/i },
  { tag: "landscaping", pattern: /\b(lawn|landscap\w*|mow\w*|jard[ií]n)\b/i },
];

const HIGH =
  /\b(emergency|emergencia|urgent|urgente|asap|burst|flood\w*|flooding|no heat|no water|sparking|right now|hoy mismo|ahora mismo)\b/i;

function clean(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  return text.length >= 2 ? text : null;
}

function titleName(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeCallback(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function extractLeadFields(transcript: string): LeadFields {
  const text = transcript.replace(/\s+/g, " ").trim();
  const nameMatch =
    text.match(
      /\b(?:my name is|this is|i am|i'm|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][\p{L}'’-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'’-]+){0,2})/iu,
    ) ??
    text.match(
      /\b(?:name is|nombre es)\s+([A-ZÁÉÍÓÚÑ][\p{L}'’-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'’-]+){0,2})/iu,
    );

  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);

  const addressMatch = text.match(
    /\b(\d{1,6}\s+[A-Z0-9][\p{L}0-9.'’\- ]{2,40}?,\s*[A-Z][\p{L} .'-]{1,30},?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/iu,
  );

  const jobs = JOBS.filter((job) => job.pattern.test(text)).map((job) => job.tag);
  const urgency = HIGH.test(text) ? "high" : jobs.length ? "normal" : "low";

  return {
    name: nameMatch?.[1] ? titleName(nameMatch[1]) : null,
    callbackNumber: phoneMatch ? normalizeCallback(phoneMatch[0]) : null,
    address: clean(addressMatch?.[1]),
    jobType: jobs[0] ?? null,
    urgency,
    tags: jobs,
  };
}

/** Prefer a clearly stated transcript field, then the model entity, never a guess. */
export function mergeLeadFields(
  extracted: LeadFields,
  entities: Record<string, string | undefined> | null | undefined,
  modelUrgency?: string | null,
): LeadFields {
  const entity = (key: string) => {
    const value = entities?.[key]?.trim();
    return value ? value : null;
  };
  const urgency =
    extracted.urgency === "high" || modelUrgency === "high"
      ? "high"
      : extracted.urgency === "normal" || modelUrgency === "normal"
        ? "normal"
        : "low";
  return {
    name: extracted.name ?? entity("name"),
    callbackNumber:
      extracted.callbackNumber ??
      (entity("callback_number") ? normalizeCallback(entity("callback_number")!) : null),
    address: extracted.address ?? entity("address"),
    jobType: extracted.jobType ?? entity("job_type"),
    urgency,
    tags: extracted.tags,
  };
}
