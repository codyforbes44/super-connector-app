/**
 * 47 CFR 9.11 disclosure for interconnected VoIP 911.
 * The version string is stored with each affirmative acknowledgment.
 */

export const E911_DISCLOSURE_VERSION = "cfr-47-9.11-2026-09-26";

/** Twilio emergency calling add-on. Shown before any address is created. */
export const E911_MONTHLY_FEE_CENTS = 75;
export const E911_MONTHLY_FEE_LABEL = "$0.75 per number per month";

/** Twilio charge when 911 is dialed and the number has no registered address. */
export const E911_UNREGISTERED_CALL_FEE_LABEL = "$75 per call";

export const E911_DISCLOSURE_PARAGRAPHS = [
  "SixVox is an interconnected VoIP service. 911 calling from a SixVox number is not the same as 911 on a traditional phone line (47 CFR 9.11).",
  "911 may not work if the internet connection, power, or SixVox is down. Keep a mobile phone or another way to reach 911.",
  "Responders are sent to the service address you register for that number, not to wherever the phone happens to be. If you move, update the address before you rely on 911.",
  `Without a registered emergency address, Twilio routes 911 to a national emergency call center and charges ${E911_UNREGISTERED_CALL_FEE_LABEL}.`,
  `Registering an emergency address costs ${E911_MONTHLY_FEE_LABEL}. That fee is billed by Twilio for each number that has emergency calling turned on.`,
] as const;

export const E911_ACK_LABEL =
  "I understand these 911 limitations and that I must keep the registered service address up to date.";
