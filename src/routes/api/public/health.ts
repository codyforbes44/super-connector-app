import { createFileRoute } from "@tanstack/react-router";

/** Public liveness check. Returns only up/down per component — never data. */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const started = Date.now();
        let database: "up" | "down" = "down";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("workspaces").select("id", { head: true, count: "exact" }).limit(1);
          database = error ? "down" : "up";
        } catch {
          database = "down";
        }
        const ok = database === "up";
        return Response.json(
          { ok, components: { app: "up", database }, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started },
          { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
