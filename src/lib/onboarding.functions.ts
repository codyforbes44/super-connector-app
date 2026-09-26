import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as onboarding from "./onboarding.server";

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => onboarding.onboardingState(context.userId));

export const startPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ context, data }) =>
    onboarding.startPhoneVerification(context.userId, data.phone),
  );

export const checkPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string; code: string }) => input)
  .handler(async ({ context, data }) =>
    onboarding.checkPhoneVerification(context.userId, data.phone, data.code),
  );

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { name: string; website?: string | null; hours?: string | null }) => input,
  )
  .handler(async ({ context, data }) => onboarding.createWorkspace(context.userId, data));
