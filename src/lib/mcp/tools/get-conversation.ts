import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "get_conversation",
  title: "Read a conversation",
  description: "Read the messages in one conversation by its id, oldest first.",
  inputSchema: {
    conversationId: z.string().describe("Conversation id from list_conversations."),
    limit: z.number().int().nullable().describe("How many messages to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ conversationId, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data: conversation, error: convoError } = await supabase
      .from("conversations")
      .select("id, channel, app_number, contact_number, contact_name")
      .eq("id", conversationId)
      .maybeSingle();
    if (convoError) return errorResult(convoError.message);
    if (!conversation) return errorResult("Conversation not found.");

    const { data, error } = await supabase
      .from("messages")
      .select(
        "id, direction, channel, from_number, to_number, body, status, is_internal_note, created_at",
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (error) return errorResult(error.message);
    return textResult({ conversation, messages: data ?? [] });
  },
});