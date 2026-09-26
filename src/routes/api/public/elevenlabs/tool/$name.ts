import { createFileRoute } from "@tanstack/react-router";

import { RECEPTIONIST_TOOL_NAMES, type ReceptionistToolName } from "@/lib/receptionist-tools";

function isToolName(value: string): value is ReceptionistToolName {
  return (RECEPTIONIST_TOOL_NAMES as readonly string[]).includes(value);
}

export const Route = createFileRoute("/api/public/elevenlabs/tool/$name")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const raw = await request.text();
        const { verifyElevenLabsRequest } = await import("@/lib/elevenlabs-signature.server");
        const auth = await verifyElevenLabsRequest(request, raw);
        if (!auth.ok) return Response.json({ ok: false, message: "unauthorized" }, { status: 401 });

        if (!isToolName(params.name)) {
          return Response.json({ ok: false, message: "unknown tool" }, { status: 404 });
        }

        let body: Record<string, string | undefined>;
        try {
          body = JSON.parse(raw) as Record<string, string | undefined>;
        } catch {
          return Response.json({ ok: false, message: "bad request" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const booking = await import("@/lib/booking-ops.server");
        const name = params.name;

        switch (name) {
          case "check_availability":
            return Response.json(await booking.toolCheckAvailability(supabaseAdmin, body));
          case "check_service_area":
            return Response.json(await booking.toolCheckServiceArea(supabaseAdmin, body));
          case "propose_booking":
            return Response.json(await booking.toolProposeBooking(supabaseAdmin, body));
          case "capture_lead":
            return Response.json(await booking.toolCaptureLead(supabaseAdmin, body));
          default: {
            const unreachable: never = name;
            return Response.json({ ok: false, message: unreachable }, { status: 404 });
          }
        }
      },
    },
  },
});
