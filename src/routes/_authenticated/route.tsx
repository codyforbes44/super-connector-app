import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Suspense } from "react";

import { AppShell } from "@/components/AppShell";
import { InCallScreen } from "@/components/InCallScreen";
import { VoiceProvider } from "@/lib/voice-device";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    if (!location.pathname.startsWith("/billing")) {
      const [{ data: roles }, { data: subs }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "super_admin"),
        supabase
          .from("subscriptions")
          .select("status, comped, suspended, current_period_end")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const sub = subs?.[0];
      const future =
        !sub?.current_period_end || new Date(sub.current_period_end) > new Date();
      const active =
        (roles?.length ?? 0) > 0 ||
        (!!sub &&
          !sub.suspended &&
          (sub.comped ||
            (["active", "trialing", "past_due", "canceled"].includes(sub.status) && future)));
      if (!active) throw redirect({ to: "/billing" });
    }

    if (
      !location.pathname.startsWith("/billing") &&
      !location.pathname.startsWith("/welcome")
    ) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_skipped")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile && !profile.onboarding_completed && !profile.onboarding_skipped) {
        throw redirect({ to: "/welcome" });
      }
    }

    return { user: data.user };
  },
  component: AuthenticatedLayout,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="font-display text-lg font-semibold">Not found</h1>
    </div>
  ),
});

function AuthenticatedLayout() {
  return (
    <VoiceProvider>
      <AppShell>
        <Suspense
          fallback={
            <div className="flex min-h-dvh items-center justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </AppShell>
      <InCallScreen />
    </VoiceProvider>
  );
}