import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./a2p.server";

export const a2pStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ops.a2pStatus(context.supabase, context.userId));

export const submitBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ops.BusinessInput) => input)
  .handler(async ({ context, data }) =>
    ops.submitBusinessProfile(context.supabase, context.userId, data),
  );

export const submitBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmFees: boolean }) => input)
  .handler(async ({ context, data }) => ops.submitBrand(context.supabase, context.userId, data));

export const submitCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ops.CampaignInput) => input)
  .handler(async ({ context, data }) => ops.submitCampaign(context.supabase, context.userId, data));
