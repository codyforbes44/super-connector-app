import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_calls",
  title: "List calls",
  description:
    "List recent calls on the user's lines, including missed calls, voicemail recordings and transcriptions.",
  inputSchema: {
    limit: z.number().int().nullable().describe("How many calls to return (default 20)."),
    direction: z
      .enum(["inbound", "outbound"])
      .nullable()
      .describe("Filter by call direction."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, direction }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("calls")
      .select(
        "sid, direction, app_number, from_number, to_number, status, duration, started_at, answered_in_app, answer_path, recording_url, transcription",
      )
      .order("started_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 20, 1), 100));
    if (direction) query = query.eq("direction", direction);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(data ?? []);
  },
});