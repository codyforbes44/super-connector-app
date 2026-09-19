import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";

import { Empty } from "@/components/screen";

export const Route = createFileRoute("/_authenticated/inbox/")({
  head: () => ({
    meta: [
      { title: "Inbox — SixVox" },
      {
        name: "description",
        content: "Every text conversation for your business number in one thread list.",
      },
      { property: "og:title", content: "Inbox — SixVox" },
      {
        property: "og:description",
        content: "Every text conversation for your business number in one thread list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InboxIndex,
});

/**
 * Right pane placeholder. The conversation list itself lives in the inbox
 * layout, so on phones this route renders nothing visible.
 */
function InboxIndex() {
  return (
    <div className="hidden h-full place-items-center md:grid">
      <Empty
        icon={MessagesSquare}
        title="Pick a conversation"
        description="Choose a thread on the left to read it and reply here."
      />
    </div>
  );
}
