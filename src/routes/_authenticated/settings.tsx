import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, CreditCard, LogOut, Plug, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
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
import { AssistantSettings } from "@/components/intelligence/AssistantSettings";
import { CallerRules } from "@/components/intelligence/CallerRules";
import { EmailNotifications } from "@/components/EmailNotifications";
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

      <section className="space-y-3 px-4 py-4">
        <h2 className="font-display text-sm font-semibold">Your profile</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
            className="h-11 rounded-full px-4"
          />
        </div>
        <Button
          className="key-signal h-11 w-full rounded-full sm:w-auto sm:px-8"
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

      <AssistantSettings />

      <CallerRules />

      <section className="border-t border-border px-4 py-4">
        <Link to="/insights" className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Your week</p>
            <p className="text-[0.7rem] text-muted-foreground">
              Calls answered, missed, and what people wanted
            </p>
          </div>
        </Link>
      </section>

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
                      <SelectTrigger className="h-9 w-28 rounded-full px-3">
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
          <section className="border-t border-border px-4 py-4">
            <Link
              to="/advanced"
              className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3"
            >
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Advanced</p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Account health, routing endpoints and the API console
                </p>
              </div>
            </Link>
          </section>
          ) : null}
        </>
      ) : null}

      <section className="space-y-2 border-t border-border px-4 py-4">
        <Link
          to="/receptionist"
          className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3"
        >
          <Bot className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">AI receptionist</p>
            <p className="text-[0.7rem] text-muted-foreground">
              Voices, agents and per-number answering
            </p>
          </div>
        </Link>

        <Link to="/connectors" className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3">
          <Plug className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Connectors</p>
            <p className="text-[0.7rem] text-muted-foreground">
              Connection status and guided setup
            </p>
          </div>
        </Link>

        <Link to="/billing" className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3">
          <CreditCard className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Billing & plan</p>
            <p className="text-[0.7rem] text-muted-foreground">
              {billing.isSuperAdmin
                ? "Super admin — unlimited access"
                : billing.plan
                  ? `${billing.plan.name} · ${billing.subscription?.status ?? "active"}`
                  : "Choose a plan"}
            </p>
          </div>
        </Link>

        {billing.isSuperAdmin ? (
          <Link
            to="/subscribers"
            className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3"
          >
            <Users className="h-4 w-4 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Subscribers</p>
              <p className="text-[0.7rem] text-muted-foreground">
                Manage accounts, plans and access
              </p>
            </div>
          </Link>
        ) : null}
      </section>

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