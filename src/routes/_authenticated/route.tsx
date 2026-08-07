import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Suspense } from "react";

import { AppShell } from "@/components/AppShell";
import { InCallScreen } from "@/components/InCallScreen";
import { VoiceProvider } from "@/lib/voice-device";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
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