import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SHARED_KEY_REASON,
  elevenLabsDedicated,
  receptionistAgentPatch,
  receptionistTools,
} from "./receptionist-tools";

export const listPendingBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("booking_proposals")
      .select("*")
      .in("status", ["proposed", "reschedule_requested"])
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const approveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { confirmProposal } = await import("./booking-ops.server");
    return confirmProposal(supabaseAdmin, data.id, { actorId: context.userId });
  });

export const declineBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase
      .from("booking_proposals")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Booking not found.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { declineProposal } = await import("./booking-ops.server");
    return declineProposal(supabaseAdmin, data.id);
  });

export const listCallerRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("caller_lists")
      .select("id, phone_number, list, note")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const saveCallerRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumber: string; list: "allow" | "block"; note?: string }) => input)
  .handler(async ({ context, data }) => {
    const { normalizePhone } = await import("./twilio.server");
    const phone = normalizePhone(data.phoneNumber);
    const { error } = await context.supabase.from("caller_lists").upsert(
      {
        user_id: context.userId,
        phone_number: phone,
        list: data.list,
        note: data.note ?? null,
      },
      { onConflict: "user_id,phone_number" },
    );
    if (error) throw error;
    return { ok: true as const, phoneNumber: phone };
  });

export const removeCallerRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("caller_lists")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true as const };
  });

export const previewWeeklyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildWeeklyReport } = await import("./weekly-report.server");
    const { weeklyMissed } = await import("./email-templates/index");
    const report = await buildWeeklyReport(supabaseAdmin, context.userId);
    return weeklyMissed(report);
  });

export const emailWeeklyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();
    const to = profile?.email;
    if (!to) throw new Error("Add an email on your profile first.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWeeklyReport } = await import("./weekly-report.server");
    return sendWeeklyReport(supabaseAdmin, context.userId, to);
  });

export const prepareReceptionistTools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { language: string; agentId?: string | null }) => input)
  .handler(async ({ data }) => {
    const patch = receptionistAgentPatch(data.language);
    if (!elevenLabsDedicated() || !data.agentId) {
      return {
        attached: false as const,
        reason: SHARED_KEY_REASON,
        tools: receptionistTools(),
        patch,
      };
    }
    const { el } = await import("./elevenlabs.server");
    await el(`/v1/convai/agents/${encodeURIComponent(data.agentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    return {
      attached: true as const,
      reason: "Booking tools were attached to this agent.",
      tools: receptionistTools(),
      patch,
    };
  });

export const assignCallLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { callSid: string; assignedTo: string | null; tags?: string[] }) => input)
  .handler(async ({ context, data }) => {
    const patch: { assigned_to: string | null; tags?: string[] } = { assigned_to: data.assignedTo };
    if (data.tags) patch.tags = data.tags;
    const { error } = await context.supabase
      .from("call_intelligence")
      .update(patch)
      .eq("call_sid", data.callSid);
    if (error) throw error;
    return { ok: true as const };
  });
