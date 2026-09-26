import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { E911Gate } from "@/components/compliance/E911Gate";
import { InCallScreen } from "@/components/InCallScreen";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { EnableNotificationsPrompt } from "@/components/EnableNotificationsPrompt";
import { markAnswerIntent } from "@/lib/call-answer-intent";
import { VoiceProvider } from "@/lib/voice-device";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Trust the persisted session first: an installed app opened offline (or a
    // cold start on a flaky connection) must stay signed in. Only a genuinely
    // missing session sends someone back to /auth.
    const { data: sessionResult } = await supabase.auth.getSession();
    const session = sessionResult.session;
    if (!session?.user) {
      throw redirect({ to: "/auth", search: { mode: "signin", redirect: location.href } });
    }
    const user = session.user;
    let online = true;

    if (!location.pathname.startsWith("/billing")) {
      const [{ data: roles, error: rolesError }, { data: subs, error: subsError }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin"),
        supabase
          .from("subscriptions")
          .select("status, comped, suspended, current_period_end")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      // A failed entitlement lookup (offline, transient 5xx) must never look
      // like "no subscription" and bounce a paying user out of the app.
      online = !rolesError && !subsError;
      const sub = subs?.[0];
      const future =
        !sub?.current_period_end || new Date(sub.current_period_end) > new Date();
      const active =
        (roles?.length ?? 0) > 0 ||
        (!!sub &&
          !sub.suspended &&
          (sub.comped ||
            (["active", "trialing", "past_due", "canceled"].includes(sub.status) && future)));
      if (online && !active) throw redirect({ to: "/billing" });
    }

    if (
      online &&
      !location.pathname.startsWith("/billing") &&
      !location.pathname.startsWith("/welcome")
    ) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_skipped")
        .eq("id", user.id)
        .maybeSingle();
      if (profile && !profile.onboarding_completed && !profile.onboarding_skipped) {
        throw redirect({ to: "/welcome" });
      }
    }

    return { user };
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
  useNotificationRouting();
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
      <WelcomeDialog />
      <EnableNotificationsPrompt />
      <E911Gate />
    </VoiceProvider>
  );
}

/**
 * Tapping a notification focuses this window and the worker posts the target
 * here, so we route client-side instead of reloading the document (which would
 * drop a ringing call).
 */
function useNotificationRouting() {
  const navigate = useNavigate();
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string; answer?: boolean } | null;
      if (!data || data.type !== "open-url" || !data.url) return;
      if (data.answer) markAnswerIntent();
      const target = new URL(data.url, window.location.origin);
      void navigate({
        to: target.pathname,
        search: Object.fromEntries(target.searchParams.entries()) as never,
      });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);
}