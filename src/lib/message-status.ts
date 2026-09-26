/**
 * Client-safe copy for carrier keywords and Twilio message error codes.
 * Imported by both UI components and server code, so keep it dependency-free.
 */

const STOP_WORDS = [
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "revoke",
  "optout",
  "opt-out",
];
const START_WORDS = ["start", "unstop", "yes", "optin", "opt-in"];

export type OptOutSignal = "stop" | "start" | null;

/** Carrier-standard keyword in an inbound message, if any. */
export function optOutSignal(body: string): OptOutSignal {
  const word = body
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
  if (!word) return null;
  if (STOP_WORDS.includes(word)) return "stop";
  if (START_WORDS.includes(word)) return "start";
  return null;
}

/* --------------------------------------------------------- error copy */

const ERROR_COPY: Record<string, string> = {
  "30034": "This number isn't registered for US texting yet, so carriers blocked the message.",
  "21610": "This person replied STOP, so we can't text them until they reply START.",
  "21408": "Texting isn't enabled for that country on your Twilio account.",
  "30007": "The carrier filtered this message as spam. Try shorter, plainer wording.",
  "30003": "The phone was unreachable — switched off or out of coverage.",
  "30005": "That number doesn't exist or is no longer in service.",
  "30006": "That number is a landline and can't receive texts.",
  "21723": "Scheduled texts need an approved messaging service.",
  "21606": "That SixVox number can't send texts.",
  "12300": "The carrier rejected the message content type.",
  "30039": "The carrier rejected this message on a toll-free route.",
};

/** Human explanation for a Twilio message error code. */
export function describeMessageError(code: string | number | null | undefined): string | null {
  if (!code) return null;
  return ERROR_COPY[String(code)] ?? `Carrier error ${code}. The message was not delivered.`;
}

/** Best-effort friendly message from a raw Twilio API error body. */
export function friendlySendError(body: string): string | null {
  const match = /"code"\s*:\s*(\d+)/.exec(body);
  return match ? describeMessageError(match[1]) : null;
}
