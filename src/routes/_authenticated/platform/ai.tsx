import { createFileRoute } from "@tanstack/react-router";
import { Bot, Plug, SlidersHorizontal } from "lucide-react";

import { Screen } from "@/components/screen";
import { SettingsGroup, SettingsLink } from "@/components/settings/SettingsGroup";

export const Route = createFileRoute("/_authenticated/platform/ai")({
  head: () => ({ meta: [{ title: "AI & concierge — SixVox Platform" }, { name: "robots", content: "noindex" }] }),
  component: Ai,
});

function Ai() {
  return (
    <Screen className="space-y-4">
      <SettingsGroup title="Website concierge">
        <SettingsLink to="/concierge" icon={Bot} tone="amber" title="Vox conversations & leads" description="Chats, leads, callbacks and Sync agent" />
      </SettingsGroup>
      <SettingsGroup title="Platform tools">
        <SettingsLink to="/connectors" icon={Plug} tone="cyan" title="Connectors" description="AI voice, carrier and calendar status" />
        <SettingsLink to="/advanced" icon={SlidersHorizontal} tone="violet" title="Advanced" description="Credential health, routing endpoints, API console" />
      </SettingsGroup>
    </Screen>
  );
}
