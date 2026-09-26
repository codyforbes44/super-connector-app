import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { InboxList } from "@/components/inbox/InboxList";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({ meta: [
    { title: "Messages — SixVox" },
    { name: "description", content: "Read and reply to conversations across your SixVox business lines." },
    { property: "og:title", content: "Messages — SixVox" },
    { property: "og:description", content: "Read and reply to conversations across your SixVox business lines." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: InboxLayout,
});

/**
 * Split-screen inbox: the thread list is always mounted from `md:` up with the
 * open conversation beside it; on phones only one pane shows at a time.
 */
function InboxLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = /^\/inbox\/([^/]+)/.exec(pathname);
  const activeId = match?.[1];
  const showingDetail = Boolean(activeId);

  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
      <div
        className={cn("min-w-0 md:block md:border-r md:border-border", showingDetail && "hidden")}
      >
        <InboxList {...(activeId ? { activeId } : {})} />
      </div>
      <div className={cn("min-w-0", !showingDetail && "hidden md:block")}>
        <Outlet />
      </div>
    </div>
  );
}
