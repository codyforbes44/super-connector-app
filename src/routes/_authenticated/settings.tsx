import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, CreditCard, LogOut, Plug, ShieldCheck, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { PullToRefresh } from "@/components/screen";
import { SettingsGroup, SettingsLink } from "@/components/settings/SettingsGroup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useBootstrap } from "@/hooks/useBootstrap";
import { useSubscription } from "@/hooks/useSubscription";
import { errorMessage } from "@/lib/format";
import { PushNotifications } from "@/components/PushNotifications";
import { DeviceAccess } from "@/components/DeviceAccess";
import { CallingSettings } from "@/components/CallingSettings";
import { QuietHoursSettings } from "@/components/compliance/QuietHoursSettings";
import { AssistantSettings } from "@/components/intelligence/AssistantSettings";
import { CallerRules } from "@/components/intelligence/CallerRules";
import { EmailNotifications } from "@/components/EmailNotifications";
import { OutboundWebhooks } from "@/components/settings/OutboundWebhooks";
import { Badge } from "@/components/ui/badge";
import { listTeam, setTeamRole, updateMyProfile } from "@/lib/twilio.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SixVox" },
      {
        name: "description",
        content: "Your profile, alerts, calling preferences and plan in one place.",
      },
      { property: "og:title", content: "Settings — SixVox" },
      {
        property: "og:description",
        content: "Your profile, alerts, calling preferences and plan in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const boot = useBootstrap();
  const billing = useSubscription();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(boot.profile?.display_name ?? "");
  const team = useQuery({ queryKey: ["team"], queryFn: () => listTeam(), enabled: boot.isAdmin });

  return (
    <div className="pb-6">
      <ScreenHeader title="Settings" subtitle={`Signed in as ${boot.profile?.email ?? ""}`} />

      <PullToRefresh
        onRefresh={async () => {
          await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
          if (boot.isAdmin) await team.refetch();
        }}
      />

      <section className="space-y-3 px-4 py-4">
        <h2 className="font-display text-sm font-semibold">Your profile</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            className="h-11 rounded-xl px-4"
          />
        </div>
        <Button
          className="key-signal h-11 w-full rounded-xl sm:w-auto sm:px-8"
          onClick={async () => {
            try {
              await updateMyProfile({ data: { displayName } });
              await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
              toast.success("Profile saved.");
            } catch (error) {
              toast.error(errorMessage(error));
            }
          }}
        >
          Save profile
        </Button>
      </section>

      <div className="border-t border-border">
        <PushNotifications />
        <DeviceAccess />
        <EmailNotifications />
      </div>

      <CallingSettings />

      <QuietHoursSettings />

      <AssistantSettings />

      <CallerRules />

      <SettingsGroup title="Your week">
        <SettingsLink
          to="/contacts"
          icon={Users}
          tone="cyan"
          title="Contacts"
          description="Save people and sync your device address book"
        />
        <SettingsLink
          to="/insights"
          icon={Sparkles}
          tone="violet"
          title="Insights"
          description="Calls answered, missed, and what people wanted"
        />
      </SettingsGroup>

      {boot.isAdmin ? (
        <>
          <section className="space-y-3 border-t border-border px-4 py-4">
            <h2 className="font-display text-sm font-semibold">Team</h2>
            <ul className="space-y-2">
              {(team.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center gap-2">
                  <Link
                    to="/admin/$userId"
                    params={{ userId: member.id }}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-medium">
                      {member.display_name || member.email}
                    </p>
                    <p className="truncate text-[0.7rem] text-muted-foreground">{member.email}</p>
                  </Link>
                  {boot.isOwner ? (
                    <Select
                      value={member.roles[0] ?? "agent"}
                      onValueChange={async (value) => {
                        try {
                          await setTeamRole({
                            data: {
                              targetUserId: member.id,
                              role: value as "owner" | "admin" | "agent",
                            },
                          });
                          await team.refetch();
                          toast.success("Role updated.");
                        } catch (error) {
                          toast.error(errorMessage(error));
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 w-28 rounded-xl px-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{member.roles[0] ?? "agent"}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {boot.isOwner ? (
            <SettingsGroup title="Owner">
              <SettingsLink
                to="/trust"
                icon={ShieldCheck}
                tone="green"
                title="Caller trust"
                description="SHAKEN/STIR, CNAM, and Voice Integrity. Nothing is submitted yet."
              />
              <SettingsLink
                to="/advanced"
                icon={SlidersHorizontal}
                tone="amber"
                title="Advanced"
                description="Account health, routing endpoints and the API console"
              />
            </SettingsGroup>
          ) : null}
          <OutboundWebhooks />
        </>
      ) : null}

      <SettingsGroup title="Your account">
        <SettingsLink
          to="/receptionist"
          icon={Bot}
          tone="violet"
          title="AI receptionist"
          description="Voices, agents and per-number answering"
        />
        <SettingsLink
          to="/connectors"
          icon={Plug}
          tone="cyan"
          title="Connectors"
          description="Connection status and guided setup"
        />
        <SettingsLink
          to="/billing"
          icon={CreditCard}
          tone="amber"
          title="Billing & plan"
          description={
            billing.isSuperAdmin
              ? "Super admin — unlimited access"
              : billing.plan
                ? `${billing.plan.name} · ${billing.subscription?.status ?? "active"}`
                : "Choose a plan"
          }
        />
        {billing.isSuperAdmin ? (
          <>
            <SettingsLink
              to="/subscribers"
              icon={Users}
              tone="green"
              title="Subscribers"
              description="Manage accounts, plans and access"
            />
            <SettingsLink
              to="/concierge"
              icon={Bot}
              tone="amber"
              title="Website concierge"
              description="Vox conversations, leads and callbacks"
            />
          </>
        ) : null}
      </SettingsGroup>

      <section className="border-t border-border px-4 py-4">
        <Button
          variant="ghost"
          className="key-end w-full rounded-full sm:w-auto sm:px-8"
          onClick={async () => {
            await queryClient.cancelQueries();
            queryClient.clear();
            await supabase.auth.signOut();
            await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </section>
    </div>
  );
}
