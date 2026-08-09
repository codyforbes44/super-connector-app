import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_contacts",
  title: "List contacts",
  description: "List or search the signed-in user's saved contacts.",
  inputSchema: {
    search: z.string().nullable().describe("Match against contact name or phone number."),
    limit: z.number().int().nullable().describe("How many contacts to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("contacts")
      .select("id, name, phone_number, email, address, notes, outbound_caller_id")
      .order("name")
      .limit(Math.min(Math.max(limit ?? 25, 1), 100));
    const term = search?.trim();
    if (term) query = query.or(`name.ilike.%${term}%,phone_number.ilike.%${term}%`);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(data ?? []);
  },
});