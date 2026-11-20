import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/version")({
  server: { handlers: { GET: () => Response.json({ version: "phase6-reliability-2026-11-20.1" }, { headers: { "Cache-Control": "no-store" } }) } },
});