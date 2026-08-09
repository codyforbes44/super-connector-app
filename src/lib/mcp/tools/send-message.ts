import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "send_message",
  title: "Send a text message",
  description:
    "Send an SMS or WhatsApp message from one of the user's lines to a phone number in E.164 format.",
  inputSchema: {
    appNumber: z.string().describe("One of the user's own lines, from list_phone_numbers."),
    to: z.string().describe("Recipient phone number, e.g. +15551234567."),
    body: z.string().describe("Message text to send."),
    channel: z.enum(["sms", "whatsapp"]).nullable().describe("Defaults to sms."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async ({ appNumber, to, body, channel }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const userId = ctx.getUserId();
    if (!userId) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { sendMessage } = await import("@/lib/twilio-ops.server");
    try {
      const result = await sendMessage(supabase, userId, {
        appNumber,
        to,
        body,
        channel: channel ?? "sms",
      });
      return textResult(result);
    } catch (error) {
      return errorResult(error instanceof Error ? error.message : String(error));
    }
  },
});