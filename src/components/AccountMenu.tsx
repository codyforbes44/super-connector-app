import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LogOut } from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Clean teardown so the back button can't restore a signed-in shell. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  };
}

/**
 * Session-aware public-site actions. Renders the same footprint in both
 * states so the header never shifts once the session resolves.
 */
export function AccountActions({ className, stacked }: { className?: string; stacked?: boolean }) {
  const { status, user } = useSession();
  const signOut = useSignOut();

  if (status === "signedIn") {
    return (
      <div className={cn(stacked ? "grid gap-2" : "flex items-center gap-2", className)}>
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            "items-center justify-center rounded-full px-4 text-sm text-muted-foreground transition-colors hover:text-foreground",
            stacked
              ? "key-raised flex min-h-14 text-base font-semibold"
              : "hidden min-h-11 sm:inline-flex",
          )}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Sign out
        </button>
        <Link
          to="/inbox"
          className={cn(
            "key-call items-center justify-center gap-2 rounded-full px-4 font-semibold",
            stacked ? "flex min-h-14 text-base" : "hidden min-h-11 text-sm sm:inline-flex",
          )}
          title={user?.email ?? undefined}
        >
          Open app
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(stacked ? "grid gap-2" : "flex items-center gap-2", className)}>
      <Link
        to="/auth"
        search={{ mode: "signin" }}
        className={cn(
          "items-center justify-center rounded-full px-4 text-muted-foreground transition-colors hover:text-foreground",
          stacked
            ? "key-raised flex min-h-14 text-base font-semibold"
            : "hidden min-h-11 text-sm sm:inline-flex",
        )}
      >
        Sign in
      </Link>
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className={cn(
          "key-call items-center justify-center gap-2 rounded-full px-4 font-semibold",
          stacked ? "flex min-h-14 text-base" : "hidden min-h-11 text-sm sm:inline-flex",
        )}
      >
        {stacked ? "Start free trial" : "Start free"}
        <ArrowRight className={cn("h-4 w-4", stacked ? "" : "hidden")} aria-hidden />
      </Link>
    </div>
  );
}
