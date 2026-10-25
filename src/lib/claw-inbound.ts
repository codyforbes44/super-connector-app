/**
 * Pure helpers for Claw Messenger's managed inbound webhook (iMessage / RCS / SMS).
 * Payload shape mirrors Claw's documented `message` event.
 */
import { z } from "zod";

const e164 = z.string().trim().regex(/^\+[1-9]\d{6,14}$/);

export const clawMessageSchema = z.object({
  type: z.literal("message").optional(),
  messageId: z.string().min(1).max(200),
  chatId: z.string().max(200).optional(),
  from: e164,
  text: z.string().max(10000).optional().default(""),
  attachments: z
    .array(z.object({ url: z.string().url().max(2000), mimeType: z.string().max(200).optional() }))
    .max(20)
    .optional()
    .default([]),
  service: z.string().max(20).optional(),
  isGroup: z.boolean().optional(),
  sentAt: z.string().max(64).optional(),
});

export type ClawMessage = z.infer<typeof clawMessageSchema>;

/** Maps Claw's service label to the SixVox message channel. Unknown → imessage. */
export function clawChannel(service: string | undefined): "imessage" | "rcs" | "sms" {
  const s = (service ?? "").toLowerCase();
  if (s === "rcs") return "rcs";
  if (s === "sms") return "sms";
  return "imessage";
}

/** Constant-time compare of the shared webhook token. Empty expected → always reject. */
export function tokenMatches(provided: string | null | undefined, expected: string | undefined) {
  if (!expected || !provided) return false;
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Reads the token from `Authorization: Bearer`, `x-claw-token`, or `?token=`. */
export function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-claw-token") ?? new URL(request.url).searchParams.get("token");
}

export function channelLabel(channel: string | null | undefined): string | null {
  if (channel === "imessage") return "iMessage";
  if (channel === "rcs") return "RCS";
  return null;
}
