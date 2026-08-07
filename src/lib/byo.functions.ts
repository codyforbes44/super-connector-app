import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as byo from "./byo.server";

export const getMyForwarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => byo.getForwarding(context.supabase, context.userId));

export const saveMyForwarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      personalNumber: string;
      carrier: string;
      forwardMode: "conditional" | "all";
      assignedNumber: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => byo.saveForwarding(context.supabase, context.userId, data));

export const stopMyForwarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => byo.stopForwarding(context.supabase, context.userId));

export const listForwardingSetups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => byo.listForwarding(context.supabase, context.userId));

export const setForwardingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { targetUserId: string; status: "pending" | "verified" | "off" }) => input,
  )
  .handler(async ({ context, data }) =>
    byo.setForwardingStatus(context.supabase, context.userId, data),
  );