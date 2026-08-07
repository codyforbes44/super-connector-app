import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; to?: string[]; subject?: string; bounce?: { message?: string } };
};

/** Svix-style signature verification used by Resend webhooks. */
function verify(headers: Headers, body: string, secret: string): boolean {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const timestamp = headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const signatureHeader = headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return signatureHeader
    .split(" ")
    .map((part) => part.split(",").pop() ?? "")
    .some((candidate) => {
      const buf = Buffer.from(candidate);
      return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
    });
}

export const Route = createFileRoute("/api/public/resend/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        const body = await request.text();
        if (!secret) return new Response("Webhook secret not configured", { status: 503 });
        if (!verify(request.headers, body, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: ResendEvent;
        try {
          event = JSON.parse(body) as ResendEvent;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const providerId = event.data?.email_id;
        const type = event.type ?? "";
        if (!providerId || !type.startsWith("email.")) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const at = event.created_at ?? new Date().toISOString();

        const { data: row } = await supabaseAdmin
          .from("email_log")
          .select("id, open_count, click_count")
          .eq("provider_id", providerId)
          .maybeSingle();
        if (!row) return new Response("ok");

        const patch: Record<string, unknown> = { last_event_at: at };
        switch (type) {
          case "email.delivered":
            patch["delivered_at"] = at;
            patch["status"] = "delivered";
            break;
          case "email.opened":
            patch["opened_at"] = at;
            patch["open_count"] = (row.open_count ?? 0) + 1;
            break;
          case "email.clicked":
            patch["clicked_at"] = at;
            patch["click_count"] = (row.click_count ?? 0) + 1;
            break;
          case "email.bounced":
            patch["bounced_at"] = at;
            patch["status"] = "bounced";
            patch["error"] = event.data?.bounce?.message ?? "Bounced";
            break;
          case "email.complained":
            patch["complained_at"] = at;
            patch["status"] = "complained";
            break;
          case "email.delivery_delayed":
            patch["status"] = "delayed";
            break;
          default:
            break;
        }

        await supabaseAdmin.from("email_log").update(patch).eq("id", row.id);
        return new Response("ok");
      },
    },
  },
});