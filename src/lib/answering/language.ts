/** Per-line language, Spanish detection, and the SMS copy the customer sees. */

export type LineLanguage = "en" | "es" | "auto";
export type SpokenLanguage = "en" | "es";

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
