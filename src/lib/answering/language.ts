/** Per-line language, Spanish detection, and the SMS copy the customer sees. */

export type LineLanguage = "en" | "es" | "auto";
export type SpokenLanguage = "en" | "es";

export const ANSWERING_LANGUAGE_START = "[sixvox-language]";
export const ANSWERING_LANGUAGE_END = "[/sixvox-language]";

/** Stored on `phone_numbers.ai_language`. Anything else behaves as English. */
export function parseLineLanguage(value: unknown): LineLanguage {
  if (value === "es" || value === "auto") return value;
  return "en";
}

const SPANISH =
  /\b(hola|buenos|buenas|gracias|necesito|quiero|plomero|fuga|cita|mañana|hoy|emergencia|dirección|número|por favor|servicio)\b/i;

export function detectCallerLanguage(utterance: string): SpokenLanguage {
  const letters = utterance.normalize("NFD");
  if (/[áéíóúñ¿¡]/i.test(letters)) return "es";
  const hits = utterance.match(SPANISH);
  return hits && hits.length >= 1 ? "es" : "en";
}

/** `auto` detects Spanish. A fixed line language stays put. */
export function resolveAnsweringLanguage(
  line: string | null | undefined,
  utterance: string,
): SpokenLanguage {
  if (line === "es") return "es";
  if (line === "auto") return detectCallerLanguage(utterance);
  return "en";
}

export type SmsKind = "proposal" | "confirmed" | "cancelled" | "reschedule" | "not_registered";

const COPY: Record<SmsKind, Record<SpokenLanguage, string>> = {
  proposal: {
    en: "SixVox: {{name}} proposed {{when}} for {{job}}. Reply YES to confirm, NO to cancel, or RESCHEDULE.",
    es: "SixVox: {{name}} propuso {{when}} para {{job}}. Responde SI para confirmar, NO para cancelar, o REPROGRAMAR.",
  },
  confirmed: {
    en: "SixVox: You're booked for {{job}} on {{when}} at {{address}}. Reply RESCHEDULE to change it or CANCEL to drop it.",
    es: "SixVox: Su cita de {{job}} quedó confirmada para {{when}} en {{address}}. Responda REPROGRAMAR para cambiarla o CANCELAR para anularla.",
  },
  cancelled: {
    en: "SixVox: That appointment is cancelled. Call again anytime to pick a new time.",
    es: "SixVox: Esa cita quedó cancelada. Llame de nuevo cuando quiera otra hora.",
  },
  reschedule: {
    en: "SixVox: No problem — we'll send another time shortly. Reply YES when you see one you want.",
    es: "SixVox: Sin problema — le enviaremos otro horario. Responda SI cuando vea uno que le sirva.",
  },
  not_registered: {
    en: "This line is not registered for texting, so the confirmation text was not sent.",
    es: "Esta línea no está registrada para mensajes de texto, así que no se envió la confirmación.",
  },
};

export function smsTemplate(
  kind: SmsKind,
  language: SpokenLanguage,
  vars: Record<string, string | null | undefined> = {},
): string {
  return COPY[kind][language].replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value && value.trim()
      ? value.trim()
      : key === "job"
        ? language === "es"
          ? "el trabajo"
          : "the job"
        : "";
  });
}

export type SpokenKind = "proposed" | "booked" | "rejected_busy" | "rejected_area";

const SPOKEN: Record<SpokenKind, Record<SpokenLanguage, string>> = {
  proposed: {
    en: "I can hold {{when}}. The owner will confirm it, and you'll get a text once it's booked.",
    es: "Puedo apartar {{when}}. El dueño lo confirma y le llega un texto cuando quede reservado.",
  },
  booked: {
    en: "You're booked for {{when}}. I'll text you the confirmation.",
    es: "Quedó reservado para {{when}}. Le envío la confirmación por texto.",
  },
  rejected_busy: {
    en: "That time is already booked. I can offer another opening.",
    es: "Esa hora ya está ocupada. Puedo ofrecer otro horario.",
  },
  rejected_area: {
    en: "That address is outside the service area, so I can't book it.",
    es: "Esa dirección está fuera del área de servicio, así que no puedo reservarla.",
  },
};

export function bookingSpokenLine(
  kind: SpokenKind,
  language: SpokenLanguage,
  vars: Record<string, string | null | undefined> = {},
): string {
  return SPOKEN[kind][language].replace(
    /\{\{(\w+)\}\}/g,
    (_match, key: string) => vars[key]?.trim() || "",
  );
}

/** ElevenLabs `agent.language` is a single code. Auto stays English and the prompt switches. */
export function elevenLabsAgentLanguage(language: string): string {
  if (language === "auto") return "en";
  const trimmed = language.trim();
  return trimmed || "en";
}

function languageInstructions(language: string): string | null {
  if (language === "es") {
    return [
      "Answer this entire call in Spanish, including booking, the address check, and the goodbye.",
      "If a tool result is in English, say the same thing in Spanish.",
      "Never invent an open time. If a tool says the time is taken or the address is outside the service area, say that and offer another option.",
      "The default is booking-by-confirmation: the owner confirms, then the caller gets a text.",
      "Only say the job is booked when the tool result says booked.",
    ].join(" ");
  }
  if (language === "auto") {
    return [
      "Detect the caller's language on the first turn.",
      "If they speak Spanish, continue the whole call in Spanish, including booking, the address check, and the goodbye.",
      "If they speak English, stay in English.",
      "Never invent an open time. If a tool says the time is taken or the address is outside the service area, say that in the caller's language and offer another option.",
      "The default is booking-by-confirmation: the owner confirms, then the caller gets a text.",
      "Only say the job is booked when the tool result says booked.",
    ].join(" ");
  }
  return null;
}

/** Insert or remove the Spanish block without touching the rest of the agent prompt. */
export function mergeAnsweringLanguagePrompt(prompt: string, language: string): string {
  const stripped = prompt
    .replace(
      new RegExp(
        `\\s*${escapeRegExp(ANSWERING_LANGUAGE_START)}[\\s\\S]*?${escapeRegExp(ANSWERING_LANGUAGE_END)}\\s*`,
        "g",
      ),
      "\n",
    )
    .trim();
  const instructions = languageInstructions(language);
  if (!instructions) return stripped;
  return `${stripped}\n\n${ANSWERING_LANGUAGE_START}\n${instructions}\n${ANSWERING_LANGUAGE_END}`.trim();
}

/** Join an ElevenLabs transcript (and summary) so language detection can read it. */
export function transcriptUtterance(transcript: unknown, summary?: string | null): string {
  const turns = Array.isArray(transcript)
    ? transcript.map((turn) => {
        if (!turn || typeof turn !== "object") return "";
        const row = turn as Record<string, unknown>;
        const message = row["message"] ?? row["text"];
        return typeof message === "string" ? message : "";
      })
    : [];
  return [summary ?? "", ...turns].filter(Boolean).join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
