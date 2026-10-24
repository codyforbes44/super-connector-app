import { createFileRoute, redirect } from "@tanstack/react-router";

// Moved into the platform admin area; keep old links working.
export const Route = createFileRoute("/_authenticated/subscribers")({
  beforeLoad: () => {
    throw redirect({ to: "/platform/accounts", replace: true });
  },
});
