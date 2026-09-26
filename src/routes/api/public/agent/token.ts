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
        const { ANON_LIMIT, SIGNED_IN_LIMIT, clientIp, hit, originAllowed } =
          await import("@/lib/concierge/rate-limit.server");

        const ip = clientIp(request);
        if (!originAllowed(request)) {
          console.error("concierge token blocked: off-site origin", {
            ip,
            origin: request.headers.get("origin") ?? request.headers.get("referer"),
          });
          return Response.json({ error: "Forbidden." }, { status: 403 });
        }

        const auth = request.headers.get("authorization") ?? "";
        const hasBearer = auth.toLowerCase().startsWith("bearer ");
        const tooMany = () => {
          console.error("concierge token rate limited", { ip, signedIn: hasBearer });
          return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
        };
        // Gate on IP before doing any work; bearer callers get the wider window.
        if (!hit(`ip:${ip}`, hasBearer ? SIGNED_IN_LIMIT : ANON_LIMIT)) return tooMany();

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const text = (key: string, max = 200): string | null => {
          const value = body[key];
          return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let userId: string | null = null;
        let firstName = "";
        if (hasBearer) {
          const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
          userId = data.user?.id ?? null;
          firstName =
            (
              (data.user?.user_metadata?.["display_name"] as string | undefined) ??
              data.user?.email ??
              ""
            ).split(/[@\s]/)[0] ?? "";
        }
        // Per-account ceiling so one signed-in user cannot burn the whole budget.
        if (userId && !hit(`user:${userId}`, SIGNED_IN_LIMIT)) return tooMany();

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
