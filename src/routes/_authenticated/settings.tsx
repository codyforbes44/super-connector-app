import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, LogOut, Terminal } from "lucide-react";
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
import { errorMessage } from "@/lib/format";
import { accountOverview, listTeam, setTeamRole, updateMyProfile } from "@/lib/twilio.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Signalbox" },
      { name: "description", content: "Profile, team roles, Twilio account usage and webhooks." },
      { property: "og:title", content: "Settings — Signalbox" },
      {
        property: "og:description",
        content: "Profile, team roles, Twilio account usage and webhooks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const boot = useBootstrap();
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
            className="h-11"
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
            className="h-11"
          />
          <p className="text-[0.7rem] text-muted-foreground">
            Twilio rings this phone first, then bridges the contact.
          </p>
        </div>
        <Button
          className="h-11 w-full"
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

      {boot.isAdmin ? (
        <>
          <section className="space-y-3 border-t border-border px-4 py-4">
            <h2 className="font-display text-sm font-semibold">Twilio account</h2>
            {overview.isError ? (
              <p className="text-xs text-muted-foreground">{errorMessage(overview.error)}</p>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-card p-4">
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
                      <SelectTrigger className="h-9 w-28">
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
              Wiring a number from the Numbers tab points Twilio at these endpoints automatically.
            </p>
            {[
              ["Messaging", boot.smsWebhook],
              ["Voice", boot.voiceWebhook],
              ["Status", boot.statusWebhook],
            ].map(([label, url]) => (
              <button
                key={label}
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
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
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <Terminal className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">API console</p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Call any Twilio endpoint directly
                </p>
              </div>
            </Link>
          </section>
        </>
      ) : null}

      <section className="border-t border-border px-4 py-4">
        <Button
          variant="ghost"
          className="w-full text-destructive"
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