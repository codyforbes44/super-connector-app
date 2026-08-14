import { createFileRoute } from "@tanstack/react-router";

/**
 * Mints a short-lived ElevenLabs conversation token for the website concierge
 * and opens the conversation record. Anonymous visitors are allowed; a bearer
 * token, when present, binds the session to that signed-in user.
 */
export const Route = createFileRoute("/api/public/agent/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const text = (key: string, max = 200): string | null => {
          const value = body[key];
          return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let userId: string | null = null;
        let firstName = "";
        const auth = request.headers.get("authorization") ?? "";
        if (auth.toLowerCase().startsWith("bearer ")) {
          const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
          userId = data.user?.id ?? null;
          firstName =
            ((data.user?.user_metadata?.["display_name"] as string | undefined) ??
              data.user?.email ??
              "")
              .split(/[@\s]/)[0] ?? "";
        }

        let planName = "none";
        let trialDaysLeft = "0";
        let numberCount = "0";
        if (userId) {
          const [{ data: subscription }, { count }] = await Promise.all([
            supabaseAdmin
              .from("subscriptions")
              .select("plan_code, trial_ends_at")
              .eq("user_id", userId)
              .maybeSingle(),
            supabaseAdmin
              .from("phone_numbers")
              .select("id", { count: "exact", head: true })
              .eq("assigned_to", userId),
          ]);
          const { planByCode } = await import("@/lib/plans");
          planName = planByCode(subscription?.["plan_code"] as string | null)?.name ?? "none";
          const trialEnds = subscription?.["trial_ends_at"] as string | null;
          if (trialEnds) {
            const days = Math.ceil((Date.parse(trialEnds) - Date.now()) / 86_400_000);
            trialDaysLeft = String(Math.max(days, 0));
          }
          numberCount = String(count ?? 0);
        }

        const sessionKey = crypto.randomUUID();
        const variables: Record<string, string> = {
          session_key: sessionKey,
          page: text("page") ?? "/",
          page_title: text("pageTitle") ?? "SixVox",
          referrer: text("referrer") ?? "",
          is_signed_in: userId ? "true" : "false",
          first_name: firstName || "there",
          plan_name: planName,
          trial_days_left: trialDaysLeft,
          number_count: numberCount,
          timezone: text("timezone", 60) ?? "",
          local_time: text("localTime", 40) ?? "",
          device: text("device", 40) ?? "web",
        };

        try {
          const { createConversation } = await import("@/lib/concierge/store.server");
          await createConversation(supabaseAdmin as never, {
            sessionKey,
            userId,
            mode: body["mode"] === "voice" ? "voice" : "text",
            page: variables["page"] ?? null,
            referrer: variables["referrer"] || null,
            variables,
          });

          const { conversationToken } = await import("@/lib/concierge/sync.server");
          const token = await conversationToken();
          return Response.json({ token, sessionKey, variables });
        } catch (error) {
          console.error("concierge token failed", error);
          return Response.json(
            { error: "The concierge is unavailable right now." },
            { status: 503 },
          );
        }
      },
    },
  },
});
