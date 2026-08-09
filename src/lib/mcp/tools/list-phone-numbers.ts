import { defineTool } from "@lovable.dev/mcp-js";

import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_phone_numbers",
  title: "List my lines",
  description:
    "List the phone lines the signed-in user can use, with answering mode and AI receptionist settings.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("phone_numbers")
      .select(
        "sid, phone_number, friendly_name, answer_mode, forward_to, outbound_caller_id, channel_whatsapp, webhook_wired",
      )
      .order("phone_number");
    if (error) return errorResult(error.message);
    return textResult(data ?? []);
  },
});