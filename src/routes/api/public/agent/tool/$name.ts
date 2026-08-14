import { createFileRoute } from "@tanstack/react-router";

import { SERVER_TOOLS, type ToolName } from "@/lib/concierge/tool-defs";

const NAMES = new Set<string>(SERVER_TOOLS.map((tool) => tool.name));

/** Webhook endpoint the ElevenLabs concierge calls for its server tools. */
export const Route = createFileRoute("/api/public/agent/tool/$name")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const url = new URL(request.url);
        const expected = process.env["TWILIO_WEBHOOK_TOKEN"] ?? "";
        if (!expected || url.searchParams.get("t") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const name = params["name"] ?? "";
        if (!NAMES.has(name)) return new Response("Unknown tool", { status: 404 });

        const args = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const sessionKey = String(args["session_key"] ?? "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { conversationForKey } = await import("@/lib/concierge/store.server");
        const conversation = await conversationForKey(supabaseAdmin as never, sessionKey);
        if (!conversation) {
          return Response.json({
            ok: false,
            message: "This session expired. Ask the visitor to start a new chat.",
          });
        }

        try {
          const { runTool } = await import("@/lib/concierge/tools.server");
          const result = await runTool(
            supabaseAdmin as never,
            name as ToolName,
            conversation,
            args,
          );
          return Response.json(result);
        } catch (error) {
          console.error(`concierge tool ${name} failed`, error);
          return Response.json({
            ok: false,
            message: "That didn't work just now. Offer to take their details instead.",
          });
        }
      },
    },
  },
});
