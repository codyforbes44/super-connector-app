import { createFileRoute } from "@tanstack/react-router";

import { isDigestRequestAuthorized } from "@/lib/digest-auth.server";

/** Weekly "calls you would have missed" email. Same scheduler secret as the daily digest. */
export const Route = createFileRoute("/api/public/reports/weekly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isDigestRequestAuthorized(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runWeeklyReports } = await import("@/lib/weekly-report.server");
        try {
          const result = await runWeeklyReports(supabaseAdmin);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("weekly report failed", error);
          return Response.json({ ok: false, error: "weekly report failed" }, { status: 500 });
        }
      },
    },
  },
});
