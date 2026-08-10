import { createFileRoute } from "@tanstack/react-router";

/**
 * Twilio Debugger callback. Twilio POSTs alert payloads here whenever one of
 * our webhooks misbehaves, which is the only way to see the real error code
 * behind the caller-facing "an application error has occurred".
 */
export const Route = createFileRoute("/api/public/twilio/error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["TWILIO_WEBHOOK_TOKEN"];
        if (expected && url.searchParams.get("t") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = await request.text();
        const params: Record<string, string> = {};
        for (const [key, value] of new URLSearchParams(body)) params[key] = value;

        let payload: Record<string, unknown> = {};
        try {
          payload = params["Payload"] ? JSON.parse(params["Payload"]) : {};
        } catch {
          payload = { raw: params["Payload"] ?? body.slice(0, 2000) };
        }

        const webhook = (payload["webhook"] ?? {}) as Record<string, unknown>;
        const requestInfo = (webhook["request"] ?? {}) as Record<string, unknown>;
        const resource = (payload["resource_sid"] ?? params["Sid"]) as string | undefined;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { logWebhookError } = await import("@/lib/webhook-errors.server");
        await logWebhookError(supabaseAdmin as never, {
          errorCode: (payload["error_code"] as string) ?? null,
          message:
            (payload["Msg"] as string) ??
            (payload["message"] as string) ??
            params["Level"] ??
            "Twilio debugger alert",
          url: (requestInfo["url"] as string) ?? (payload["url"] as string) ?? null,
          callSid: typeof resource === "string" && resource.startsWith("CA") ? resource : null,
          payload,
        });

        return new Response("ok");
      },
    },
  },
});