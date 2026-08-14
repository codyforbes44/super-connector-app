/**
 * Server-side implementations for the concierge's tools.
 *
 * Every handler receives the resolved conversation (from the session key) so
 * account-aware tools can trust the signed-in user recorded at session start,
 * never a value supplied by the model.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { PLANS, TRIAL_DAYS, planByCode } from "@/lib/plans";
import type { ToolName } from "./tool-defs";
import { alertTeam, logToolCall, type ConversationRow } from "./store.server";

export type ToolResult = Record<string, unknown>;

type Args = Record<string, unknown>;

const str = (args: Args, key: string): string => String(args[key] ?? "").trim();

function pricing(args: Args): ToolResult {
  const code = str(args, "plan").toLowerCase();
  const one = planByCode(code);
  const shape = (plan: (typeof PLANS)[number]) => ({
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline,
    monthly_usd: plan.monthly,
    yearly_usd: plan.yearly,
    included_numbers: plan.numbers,
    seats: plan.seats ?? "unlimited",
    features: plan.features,
  });
  return {
    trial_days: TRIAL_DAYS,
    billing: "Monthly or yearly, cancel any time. Yearly is about two months cheaper.",
    plans: one ? [shape(one)] : PLANS.map(shape),
  };
}

async function captureLead(
  admin: SupabaseClient,
  conversation: ConversationRow,
  args: Args,
): Promise<ToolResult> {
  const name = str(args, "name");
  const email = str(args, "email");
  const phone = str(args, "phone");
  if (!name) return { ok: false, message: "Ask for their name first." };
  if (!email && !phone) {
    return { ok: false, message: "Ask for an email address or a phone number before saving." };
  }

  const { data, error } = await admin
    .from("chat_leads")
    .insert({
      conversation_id: conversation.id,
      name,
      email: email || null,
      phone: phone || null,
      company: str(args, "company") || null,
      need: str(args, "need") || null,
      urgency: str(args, "urgency") || "normal",
      plan_interest: str(args, "plan_interest") || null,
      page: conversation.page,
      quality: str(args, "urgency") === "high" ? "hot" : "new",
      notified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("concierge: lead insert failed", error);
    return { ok: false, message: "That did not save. Offer to try again in a moment." };
  }

  await admin
    .from("chat_conversations")
    .update({ outcome: "lead", lead_quality: str(args, "urgency") === "high" ? "hot" : "new" })
    .eq("id", conversation.id);

  await alertTeam(admin, {
    eyebrow: "New concierge lead",
    title: name,
    intro: str(args, "need") || "A visitor asked the website concierge to follow up.",
    rows: [
      { label: "Name", value: name },
      { label: "Email", value: email },
      { label: "Phone", value: phone },
      { label: "Company", value: str(args, "company") },
      { label: "Interest", value: str(args, "plan_interest") },
      { label: "Urgency", value: str(args, "urgency") || "normal" },
      { label: "Page", value: conversation.page ?? "" },
    ],
    cta: { label: "Open the concierge inbox", path: "/concierge" },
  });

  return {
    ok: true,
    lead_id: data.id,
    message: `Saved. Tell ${name} the team will follow up${email ? ` at ${email}` : ""}.`,
  };
}

async function sendFollowup(
  admin: SupabaseClient,
  conversation: ConversationRow,
  args: Args,
): Promise<ToolResult> {
  const email = str(args, "email");
  const recap = str(args, "recap");
  if (!email || !recap) return { ok: false, message: "Need an email address and a recap." };

  const [{ sendEmail, FROM_ACCOUNT }, { button, layout, paragraph }, { PUBLIC_BASE_URL }] =
    await Promise.all([
      import("@/lib/email.server"),
      import("@/lib/email-templates/layout"),
      import("@/lib/app.server"),
    ]);

  const nextStep = str(args, "next_step") || "Start your free trial";
  const name = str(args, "name");
  const body =
    paragraph(name ? `Hi ${name},` : "Hi,") +
    paragraph(recap) +
    button(nextStep, `${PUBLIC_BASE_URL}/auth?mode=signup`) +
    paragraph("Reply to this email if you'd rather talk to a person.");

  const result = await sendEmail(admin, {
    to: email,
    template: "account",
    from: FROM_ACCOUNT,
    context: { source: "concierge", conversation_id: conversation.id },
    rendered: {
      subject: "SixVox · here's what we talked about",
      html: layout({
        preheader: recap.slice(0, 120),
        eyebrow: "From the SixVox concierge",
        title: "Your recap",
        body,
      }),
    },
  });

  return result.sent
    ? { ok: true, message: `Sent to ${email}.` }
    : { ok: false, message: "The email did not send. Offer a callback instead." };
}

async function bookCallback(
  admin: SupabaseClient,
  conversation: ConversationRow,
  args: Args,
): Promise<ToolResult> {
  const name = str(args, "name");
  const phone = str(args, "phone");
  const windowLabel = str(args, "window");
  if (!phone || !windowLabel) {
    return { ok: false, message: "Ask for a phone number and roughly when to call." };
  }

  const { error } = await admin.from("chat_callbacks").insert({
    conversation_id: conversation.id,
    name: name || null,
    phone,
    email: str(args, "email") || null,
    window_label: windowLabel,
    timezone: str(args, "timezone") || null,
    topic: str(args, "topic") || null,
  });
  if (error) {
    console.error("concierge: callback insert failed", error);
    return { ok: false, message: "That did not save. Offer to take an email instead." };
  }

  await admin.from("chat_conversations").update({ outcome: "callback" }).eq("id", conversation.id);

  await alertTeam(admin, {
    eyebrow: "Callback requested",
    title: `${name || "Visitor"} — ${windowLabel}`,
    intro: str(args, "topic") || "A visitor asked for a callback from the website concierge.",
    rows: [
      { label: "Name", value: name },
      { label: "Phone", value: phone },
      { label: "Email", value: str(args, "email") },
      { label: "Window", value: windowLabel },
      { label: "Timezone", value: str(args, "timezone") },
    ],
    cta: { label: "Open the concierge inbox", path: "/concierge" },
  });

  return { ok: true, message: `Booked. Confirm back: a callback ${windowLabel} on ${phone}.` };
}

async function handoff(
  admin: SupabaseClient,
  conversation: ConversationRow,
  args: Args,
): Promise<ToolResult> {
  const reason = str(args, "reason") || "The visitor asked for a person.";
  await admin
    .from("chat_conversations")
    .update({ handoff_requested: true, outcome: "handoff", status: "needs_human" })
    .eq("id", conversation.id);

  await alertTeam(admin, {
    eyebrow: "Handoff requested",
    title: reason.slice(0, 80),
    intro: reason,
    rows: [
      { label: "Contact", value: str(args, "contact") },
      { label: "Urgency", value: str(args, "urgency") || "normal" },
      { label: "Page", value: conversation.page ?? "" },
    ],
    cta: { label: "Read the conversation", path: "/concierge" },
  });

  return {
    ok: true,
    message: "Flagged for the team. Tell them a person will reply by email, usually same day.",
  };
}

async function myAccount(
  admin: SupabaseClient,
  conversation: ConversationRow,
): Promise<ToolResult> {
  if (!conversation.user_id) {
    return { ok: false, signed_in: false, message: "They're not signed in. Offer to open /auth." };
  }
  const userId = conversation.user_id;

  const [{ data: subscription }, { data: numbers }, { data: profile }] = await Promise.all([
    admin
      .from("subscriptions")
      .select(
        "plan_code, status, billing_interval, seats, trial_ends_at, current_period_end, cancel_at_period_end",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("phone_numbers")
      .select("phone_number, friendly_name, answer_mode")
      .eq("assigned_to", userId),
    admin.from("profiles").select("display_name, default_number").eq("id", userId).maybeSingle(),
  ]);

  const plan = planByCode((subscription?.["plan_code"] as string | null) ?? null);
  return {
    ok: true,
    signed_in: true,
    name: profile?.["display_name"] ?? null,
    plan: plan?.name ?? "No plan yet",
    status: subscription?.["status"] ?? "none",
    billing_interval: subscription?.["billing_interval"] ?? null,
    trial_ends_at: subscription?.["trial_ends_at"] ?? null,
    renews_at: subscription?.["current_period_end"] ?? null,
    cancels_at_period_end: subscription?.["cancel_at_period_end"] ?? false,
    default_number: profile?.["default_number"] ?? null,
    numbers: (numbers ?? []).map((row) => ({
      number: row["phone_number"],
      label: row["friendly_name"],
      answer_mode: row["answer_mode"],
    })),
  };
}

async function myActivity(
  admin: SupabaseClient,
  conversation: ConversationRow,
): Promise<ToolResult> {
  if (!conversation.user_id) {
    return { ok: false, signed_in: false, message: "They're not signed in." };
  }
  const userId = conversation.user_id;

  const { data: numbers } = await admin
    .from("phone_numbers")
    .select("phone_number")
    .eq("assigned_to", userId);
  const mine = (numbers ?? []).map((row) => row["phone_number"] as string);
  if (!mine.length) return { ok: true, signed_in: true, calls: [], unread_messages: 0 };

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const [{ data: calls }, { data: conversations }] = await Promise.all([
    admin
      .from("calls")
      .select("from_number, to_number, direction, status, duration, started_at, transcription")
      .in("app_number", mine)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(8),
    admin.from("conversations").select("contact_number, unread_count").in("app_number", mine),
  ]);

  return {
    ok: true,
    signed_in: true,
    window: "last 7 days",
    unread_messages: (conversations ?? []).reduce(
      (total, row) => total + Number(row["unread_count"] ?? 0),
      0,
    ),
    calls: (calls ?? []).map((row) => ({
      direction: row["direction"],
      with: row["direction"] === "inbound" ? row["from_number"] : row["to_number"],
      status: row["status"],
      seconds: row["duration"],
      at: row["started_at"],
      summary: (row["transcription"] as string | null)?.slice(0, 200) ?? null,
    })),
  };
}

export async function runTool(
  admin: SupabaseClient,
  name: ToolName,
  conversation: ConversationRow,
  args: Args,
): Promise<ToolResult> {
  const result = await (async (): Promise<ToolResult> => {
    switch (name) {
      case "get_pricing":
        return pricing(args);
      case "capture_lead":
        return captureLead(admin, conversation, args);
      case "send_followup_email":
        return sendFollowup(admin, conversation, args);
      case "book_callback":
        return bookCallback(admin, conversation, args);
      case "handoff_to_human":
        return handoff(admin, conversation, args);
      case "get_my_account":
        return myAccount(admin, conversation);
      case "get_my_recent_activity":
        return myActivity(admin, conversation);
      default:
        return { ok: false, message: "Unknown tool." };
    }
  })();

  await logToolCall(admin, conversation.id, name, { args, result });
  return result;
}
