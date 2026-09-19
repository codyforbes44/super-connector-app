import { createFileRoute } from "@tanstack/react-router";
import { isDigestRequestAuthorized } from "@/lib/digest-auth.server";

/**
 * Hourly scheduled job (pg_cron -> pg_net). Sends each user their daily
 * digest when the local hour matches their preference.
 */
export const Route = createFileRoute("/api/public/digest/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isDigestRequestAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } =
          await import("@/integrations/supabase/client.server");
        const { runDueDigests } = await import("@/lib/digest.server");
        try {
          const result = await runDueDigests(supabaseAdmin as never);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("digest run failed", error);
          return Response.json(
            { ok: false, error: "digest run failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
