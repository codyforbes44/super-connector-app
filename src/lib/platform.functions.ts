import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/lib/plans";
import { isElPrimaryNumber } from "@/lib/wiring";

type Ctx = { supabase: { rpc: (fn: "is_super_admin", args: { _user_id: string }) => PromiseLike<{ data: unknown }> }; userId: string };

/** Every platform function re-checks super admin on the server. */
async function requireSuper(context: Ctx) {
  const { data } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const since = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

export const platformOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireSuper(context as unknown as Ctx);
    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
    const [subsRes, profiles, workspaces, numbers, calls24, calls7, msgs24, msgs7, errors7, unattributed, leads] =
      await Promise.all([
        admin.from("subscriptions").select("plan_code, status, comped, suspended, user_id"),
        count(admin.from("profiles").select("id", { count: "exact", head: true })),
        count(admin.from("workspaces").select("id", { count: "exact", head: true })),
        count(admin.from("phone_numbers").select("id", { count: "exact", head: true })),
        count(admin.from("calls").select("id", { count: "exact", head: true }).gte("created_at", since(24))),
        count(admin.from("calls").select("id", { count: "exact", head: true }).gte("created_at", since(168))),
        count(admin.from("messages").select("id", { count: "exact", head: true }).gte("created_at", since(24))),
        count(admin.from("messages").select("id", { count: "exact", head: true }).gte("created_at", since(168))),
        count(admin.from("webhook_errors").select("id", { count: "exact", head: true }).gte("created_at", since(168))),
        count(admin.from("webhook_errors").select("id", { count: "exact", head: true }).is("workspace_id", null).gte("created_at", since(168))),
        count(admin.from("chat_leads").select("id", { count: "exact", head: true }).eq("handled", false)),
      ]);
    const subs = subsRes.data ?? [];
    const tally = { active: 0, trialing: 0, comped: 0, suspended: 0, pastDue: 0 };
    let mrr = 0;
    for (const s of subs) {
      if (s.suspended) { tally.suspended++; continue; }
      if (s.comped) { tally.comped++; continue; }
      if (s.status === "trialing") tally.trialing++;
      if (s.status === "past_due") tally.pastDue++;
      if (s.status === "active") {
        tally.active++;
        mrr += PLANS.find((p) => p.code === s.plan_code)?.monthly ?? 0;
      }
    }
    return { accounts: profiles, workspaces, numbers, calls24, calls7, msgs24, msgs7, errors7, unattributed, openLeads: leads, mrr, ...tally };
  });

export const platformWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireSuper(context as unknown as Ctx);
    const [{ data: ws }, { data: members }, { data: nums }, { data: profiles }] = await Promise.all([
      admin.from("workspaces").select("id, name, business_name, a2p_status, created_at").order("created_at", { ascending: false }),
      admin.from("workspace_members").select("workspace_id, user_id, role"),
      admin.from("phone_numbers").select("workspace_id, phone_number"),
      admin.from("profiles").select("id, email"),
    ]);
    const email = new Map((profiles ?? []).map((p) => [p.id as string, (p.email as string) ?? ""]));
    return (ws ?? []).map((w) => {
      const m = (members ?? []).filter((x) => x.workspace_id === w.id);
      const owner = m.find((x) => x.role === "owner");
      return {
        id: w.id as string,
        name: (w.business_name || w.name || "Untitled team") as string,
        a2pStatus: (w.a2p_status as string | null) ?? null,
        createdAt: w.created_at as string,
        ownerEmail: owner ? email.get(owner.user_id as string) ?? "" : "",
        seats: m.length,
        numbers: (nums ?? []).filter((n) => n.workspace_id === w.id).map((n) => n.phone_number as string),
      };
    });
  });

export const platformNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireSuper(context as unknown as Ctx);
    const [{ data: nums }, { data: ws }] = await Promise.all([
      admin.from("phone_numbers").select("id, phone_number, friendly_name, workspace_id, webhook_wired, answer_mode, campaign_status").order("phone_number"),
      admin.from("workspaces").select("id, name, business_name"),
    ]);
    const names = new Map((ws ?? []).map((w) => [w.id as string, (w.business_name || w.name) as string]));
    return (nums ?? []).map((n) => ({
      id: n.id as string,
      number: n.phone_number as string,
      label: (n.friendly_name as string | null) ?? "",
      workspace: n.workspace_id ? names.get(n.workspace_id as string) ?? "Unknown team" : "Unassigned",
      wired: Boolean(n.webhook_wired),
      answerMode: (n.answer_mode as string | null) ?? "ring",
      textingStatus: (n.campaign_status as string | null) ?? null,
      protected: isElPrimaryNumber(n.phone_number as string),
    }));
  });

export const platformHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireSuper(context as unknown as Ctx);
    const [{ data: errors }, { data: deliveries }] = await Promise.all([
      admin.from("webhook_errors").select("id, source, error_code, message, app_number, workspace_id, created_at").order("created_at", { ascending: false }).limit(50),
      admin.from("outbound_webhook_deliveries").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    const failed = (deliveries ?? []).filter((d) => {
      const row = d as Record<string, unknown>;
      const code = row["response_status"];
      return row["status"] === "failed" || (typeof code === "number" && code >= 400);
    });
    return {
      errors: (errors ?? []).map((e) => ({
        id: e.id as string,
        source: e.source as string,
        code: (e.error_code as string | null) ?? null,
        message: (e.message as string | null) ?? "",
        appNumber: (e.app_number as string | null) ?? null,
        unattributed: !e.workspace_id,
        at: e.created_at as string,
      })),
      failedDeliveries: failed.length,
    };
  });

export const platformAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await requireSuper(context as unknown as Ctx);
    const [{ data: rows }, { data: profiles }] = await Promise.all([
      admin.from("audit_log").select("id, actor, action, detail, created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("profiles").select("id, email"),
    ]);
    const email = new Map((profiles ?? []).map((p) => [p.id as string, (p.email as string) ?? ""]));
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      actor: email.get(r.actor as string) || "system",
      action: r.action as string,
      detail: JSON.stringify(r.detail ?? {}),
      at: r.created_at as string,
    }));
  });
