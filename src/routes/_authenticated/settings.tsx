import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, Copy, CreditCard, LogOut, Plug, Terminal, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { CallingSettings } from "@/components/CallingSettings";
import { EmailNotifications } from "@/components/EmailNotifications";
import { VoiceSetup } from "@/components/VoiceSetup";
import { ElevenLabsStatus } from "@/components/ElevenLabsStatus";
import { accountOverview, listTeam, setTeamRole, updateMyProfile } from "@/lib/twilio.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SixVox" },
      { name: "description", content: "Profile, team roles, account usage and delivery endpoints." },
      { property: "og:title", content: "Settings — SixVox" },
      {
        property: "og:description",
        content: "Profile, team roles, account usage and delivery endpoints.",
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
  const [agentPhone, setAgentPhone] = useState(boot.profile?.agent_phone ?? "");

  const team = useQuery({ queryKey: ["team"], queryFn: () => listTeam(), enabled: boot.isAdmin });
  const overview = useQuery({
    queryKey: ["account-overview"],
    queryFn: () => accountOverview(),
    enabled: boot.isAdmin,
    retry: false,
  });

  const balance = overview.data?.balance as { balance?: string; currency?: string } | null;
  const account = overview.data?.account as {
    directApi?: boolean;
    friendlyName?: string | null;
    status?: string | null;
    type?: string | null;
    sidSuffix?: string | null;
  } | null;

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
        <div className="space-y-1.5">
          <Label htmlFor="agent-phone">Your phone (for click-to-call)</Label>
          <Input
            id="agent-phone"
            value={agentPhone}
            onChange={(e) => setAgentPhone(e.target.value)}
            inputMode="tel"
            maxLength={20}
            placeholder="+1 555 010 2030"
            className="h-11 rounded-full px-4"
          />
          <p className="text-[0.7rem] text-muted-foreground">
            SixVox rings this phone first, then bridges the contact.
          </p>
        </div>
        <Button
          className="key-signal h-11 w-full rounded-full"
          onClick={async () => {
            try {
              await updateMyProfile({ data: { displayName, agentPhone: agentPhone || null } });
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
        <EmailNotifications />
      </div>

      <CallingSettings />

      {boot.isAdmin ? (
        <>
          <VoiceSetup />
          <ElevenLabsStatus />
          <section className="space-y-3 border-t border-border px-4 py-4">
            <h2 className="font-display text-sm font-semibold">Number account</h2>
            {overview.isError ? (
              <p className="text-xs text-muted-foreground">{errorMessage(overview.error)}</p>
            ) : (
              <>
                <div className="glass-panel flex items-center gap-3 rounded-3xl px-4 py-3">
                  <span
                    className={
                      account?.status === "active"
                        ? "h-2.5 w-2.5 shrink-0 rounded-full bg-success"
                        : "h-2.5 w-2.5 shrink-0 rounded-full bg-destructive"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {account?.friendlyName ?? "Number account"}
                    </p>
                    <p className="truncate text-[0.7rem] text-muted-foreground">
                      {[
                        account?.type,
                        account?.status,
                        account?.sidSuffix ? `···${account.sidSuffix}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge variant={account?.directApi ? "secondary" : "outline"} className="text-[0.6rem]">
                    {account?.directApi ? "full API" : "gateway only"}
                  </Badge>
                </div>
                <div className="glass-panel rounded-3xl p-4">
                  <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                    Balance
                  </p>
                  <p className="tabular font-display mt-1 text-2xl font-semibold">
                    {balance ? `${balance.balance} ${balance.currency}` : "—"}
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {(overview.data?.usage ?? [])
                    .slice(0, 8)
                    .map((raw) => raw as { category: string; usage: string; price: string })
                    .map((u) => (
                      <li
                        key={u.category}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate text-muted-foreground">{u.category}</span>
                        <span className="tabular">
                          {u.usage} · ${u.price}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </section>

          <section className="space-y-3 border-t border-border px-4 py-4">
            <h2 className="font-display text-sm font-semibold">Team</h2>
            <ul className="space-y-2">
              {(team.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.display_name || member.email}
                    </p>
                    <p className="truncate text-[0.7rem] text-muted-foreground">{member.email}</p>
                  </div>
                  {boot.role === "owner" ? (
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

          <section className="space-y-3 border-t border-border px-4 py-4">
            <h2 className="font-display text-sm font-semibold">Webhooks</h2>
            <p className="text-xs text-muted-foreground">
              Wiring a number from the Numbers tab points it at these endpoints automatically.
            </p>
            {[
              ["Messaging", boot.smsWebhook],
              ["Voice", boot.voiceWebhook],
              ["Status", boot.statusWebhook],
            ].map(([label, url]) => (
              <button
                key={label}
                type="button"
                className="glass-panel flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left"
                onClick={() => {
                  void navigator.clipboard.writeText(url!);
                  toast.success(`${label} URL copied.`);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="truncate text-[0.65rem] text-muted-foreground">{url}</p>
                </div>
                <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </section>

          <section className="border-t border-border px-4 py-4">
            <Link
              to="/console"
              className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3"
            >
              <Terminal className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">API console</p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Open the advanced API console
                </p>
              </div>
            </Link>
          </section>
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
          className="key-end w-full rounded-full"
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
            await navigate({ to: "/auth" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </section>
    </div>
  );
}