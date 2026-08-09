import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_conversations",
  title: "List conversations",
  description:
    "List recent SMS/MMS/WhatsApp conversations for the signed-in user, newest activity first.",
  inputSchema: {
    limit: z.number().int().nullable().describe("How many conversations to return (default 20)."),
    unreadOnly: z.boolean().nullable().describe("Only conversations with unread messages."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, unreadOnly }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("conversations")
      .select(
        "id, channel, app_number, contact_number, contact_name, last_message_at, last_message_preview, unread_count, archived",
      )
      .order("last_message_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));
    if (unreadOnly) query = query.gt("unread_count", 0);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(data ?? []);
  },
});