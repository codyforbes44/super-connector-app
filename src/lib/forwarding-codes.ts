/**
 * Carrier call-forwarding dial codes. Pure data + formatting — safe to import
 * from the browser. The user dials these on their own handset; there is no API
 * that can set them for them.
 */

export type ForwardMode = "conditional" | "all";

export type ForwardStep = {
  id: string;
  label: string;
  hint: string;
  /** Template with {number} replaced by the SixVox line. */
  on: string;
  off: string;
};

export type Carrier = {
  id: string;
  name: string;
  note?: string;
  conditional: ForwardStep[];
  all: ForwardStep[];
};

const GSM_CONDITIONAL: ForwardStep[] = [
  {
    id: "no-answer",
    label: "When you don't answer",
    hint: "Rings your phone first, then hands the call to SixVox.",
    on: "*61*{number}#",
    off: "#61#",
  },
  {
    id: "busy",
    label: "When you're on another call",
    hint: "Keeps callers out of a busy tone.",
    on: "*67*{number}#",
    off: "#67#",
  },
  {
    id: "unreachable",
    label: "When your phone is off or out of signal",
    hint: "Covers dead zones and flight mode.",
    on: "*62*{number}#",
    off: "#62#",
  },
];

const GSM_ALL: ForwardStep[] = [
  {
    id: "all",
    label: "Send every call to SixVox",
    hint: "Your phone stops ringing — SixVox answers first.",
    on: "*21*{number}#",
    off: "#21#",
  },
];

const CDMA_CONDITIONAL: ForwardStep[] = [
  {
    id: "conditional",
    label: "When you're busy or don't answer",
    hint: "Your phone rings first, then the call moves to SixVox.",
    on: "*71{number}",
    off: "*73",
  },
];

const CDMA_ALL: ForwardStep[] = [
  {
    id: "all",
    label: "Send every call to SixVox",
    hint: "Your phone stops ringing — SixVox answers first.",
    on: "*72{number}",
    off: "*73",
  },
];

export const CARRIERS: Carrier[] = [
  { id: "att", name: "AT&T", conditional: GSM_CONDITIONAL, all: GSM_ALL },
  { id: "tmobile", name: "T-Mobile", conditional: GSM_CONDITIONAL, all: GSM_ALL },
  {
    id: "verizon",
    name: "Verizon",
    note: "Dial the code and wait for the confirmation tone before hanging up.",
    conditional: CDMA_CONDITIONAL,
    all: CDMA_ALL,
  },
  {
    id: "uscellular",
    name: "US Cellular",
    note: "Dial the code and wait for the confirmation tone before hanging up.",
    conditional: CDMA_CONDITIONAL,
    all: CDMA_ALL,
  },
  {
    id: "googlefi",
    name: "Google Fi",
    note: "Fi also lets you set forwarding in the Fi app under Phone settings.",
    conditional: GSM_CONDITIONAL,
    all: GSM_ALL,
  },
  {
    id: "other",
    name: "Another carrier",
    note: "These are the standard codes most networks accept. If one is rejected, ask your carrier for their call-forwarding codes.",
    conditional: GSM_CONDITIONAL,
    all: GSM_ALL,
  },
];

export function carrierById(id: string | null | undefined): Carrier {
  return CARRIERS.find((c) => c.id === id) ?? (CARRIERS[CARRIERS.length - 1] as Carrier);
}

/** Codes must be dialled with digits only — no +, spaces or dashes. */
export function dialDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function fillCode(template: string, sixvoxNumber: string): string {
  return template.replace("{number}", dialDigits(sixvoxNumber));
}

export function stepsFor(carrierId: string | null | undefined, mode: ForwardMode): ForwardStep[] {
  const carrier = carrierById(carrierId);
  return mode === "all" ? carrier.all : carrier.conditional;
}

export const FORWARD_MODE_LABEL: Record<ForwardMode, string> = {
  conditional: "Only when I can't answer",
  all: "Send every call to SixVox",
};