/**
 * Emergency phrases that warm-transfer an AI call to the owner's cell.
 * Matching is local and tested. The live transfer is ElevenLabs' transfer_to_number
 * tool (conference / warm transfer), configured from these keywords.
 */

export const DEFAULT_EMERGENCY_KEYWORDS = [
  "burst pipe",
  "flooding",
  "gas leak",
  "no heat",
] as const;

export const EMERGENCY_PROMPT_START = "[sixvox-emergency]";
export const EMERGENCY_PROMPT_END = "[/sixvox-emergency]";

export function normalizeSpeech(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseEmergencyKeywords(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,]/) : [];
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 40);
    const key = normalizeSpeech(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keywords.push(trimmed);
    if (keywords.length >= 30) break;
  }
  return keywords;
}

/** Longest phrase wins so "gas leak" matches before a shorter keyword. */
export function matchEmergencyKeyword(text: string, keywords: readonly string[]): string | null {
  const hay = normalizeSpeech(text);
  if (!hay) return null;
  const ordered = [...keywords].sort(
    (a, b) => normalizeSpeech(b).length - normalizeSpeech(a).length,
  );
  for (const keyword of ordered) {
    const needle = normalizeSpeech(keyword);
    if (!needle) continue;
    if (hay.includes(needle)) return keyword.trim();
  }
  return null;
}

export function emergencyPromptBlock(keywords: readonly string[], phone: string): string {
  const list = keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .join(", ");
  return [
    EMERGENCY_PROMPT_START,
    `If the caller mentions any of these emergencies — ${list} — immediately call transfer_to_number and conference-transfer them to ${phone}.`,
    "Tell the caller you are connecting them to the owner now.",
    "Tell the owner which emergency you heard and the caller's number.",
    EMERGENCY_PROMPT_END,
  ].join("\n");
}

export function extractEmergencyBlock(prompt: string): string | null {
  const match = prompt.match(
    new RegExp(
      `${escapeRegExp(EMERGENCY_PROMPT_START)}[\\s\\S]*?${escapeRegExp(EMERGENCY_PROMPT_END)}`,
    ),
  );
  return match ? match[0].trim() : null;
}

export function mergeEmergencyPrompt(
  prompt: string,
  keywords: readonly string[],
  phone: string | null,
): string {
  const stripped = prompt
    .replace(
      new RegExp(
        `\\s*${escapeRegExp(EMERGENCY_PROMPT_START)}[\\s\\S]*?${escapeRegExp(EMERGENCY_PROMPT_END)}\\s*`,
        "g",
      ),
      "\n",
    )
    .trim();
  const usable = keywords.map((keyword) => keyword.trim()).filter(Boolean);
  if (!phone || usable.length === 0) return stripped;
  return `${stripped}\n\n${emergencyPromptBlock(usable, phone)}`.trim();
}

/**
 * Conference transfer is ElevenLabs' warm transfer: the agent dials the owner,
 * speaks a handoff, then leaves the caller and the owner together.
 * https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number
 */
export function transferToolConfig(phone: string, keywords: readonly string[]) {
  const list = keywords.map((keyword) => keyword.trim()).filter(Boolean);
  return {
    type: "system" as const,
    name: "transfer_to_number",
    description: `Warm-transfer the caller to the owner when they mention an emergency: ${list.join(", ")}.`,
    params: {
      system_tool_type: "transfer_to_number" as const,
      transfers: [
        {
          transfer_destination: { type: "phone" as const, phone_number: phone },
          condition: `The caller mentions an emergency such as ${list.join(", ")}.`,
          transfer_type: "conference" as const,
        },
      ],
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
