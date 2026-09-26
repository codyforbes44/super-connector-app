import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mobile/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // Route modules are in the client graph. Load the server handler inside
        // the request so this file does not pull Twilio and Supabase admin into it.
        const { handleMobileRequest } = await import("@/lib/mobile-api.server");
        return handleMobileRequest(request, "GET", params["_splat"]);
      },
      POST: async ({ request, params }) => {
        const { handleMobileRequest } = await import("@/lib/mobile-api.server");
        return handleMobileRequest(request, "POST", params["_splat"]);
      },
    },
  },
});
