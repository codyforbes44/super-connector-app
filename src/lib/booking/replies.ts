/** Customer SMS replies that confirm, cancel, or reschedule a proposed job. */

export type ReplyIntent = "confirm" | "cancel" | "reschedule" | "unknown";

const CONFIRM = [
  "yes",
  "y",
  "yeah",
  "yep",
  "ok",
  "okay",
  "confirm",
  "confirmed",
  "book",
  "book it",
  "si",
  "sí",
  "confirmar",
  "confirmo",
  "vale",
  "de acuerdo",
  "claro",
];

const CANCEL = ["no", "nope", "cancel", "cancel it", "cancelar", "cancela", "no gracias", "anular"];

const RESCHEDULE = [
  "reschedule",
  "change",
  "different time",
  "another time",
  "reprogramar",
  "cambiar",
  "otro horario",
  "otra hora",
];

/** Carrier keywords stay with the opt-out handler, not the booking parser. */
const CARRIER = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "end",
  "quit",
  "start",
  "unstop",
  "help",
  "info",
]);

function normalize(body: string): string {
  return body
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[¡!¿?.,]/g, "")
    .replace(/\s+/g, " ");
}

export function parseBookingReply(body: string): ReplyIntent {
  const text = normalize(body);
  if (!text || CARRIER.has(text)) return "unknown";
  if (CONFIRM.includes(text)) return "confirm";
  if (CANCEL.includes(text)) return "cancel";
  if (RESCHEDULE.some((phrase) => text === phrase || text.startsWith(`${phrase} `))) {
    return "reschedule";
  }
  return "unknown";
}
