import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Copy, ShieldCheck, Terminal } from "lucide-react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/AppShell";
import { ElevenLabsStatus } from "@/components/ElevenLabsStatus";
import { MessagingServicesSection } from "@/components/MessagingServices";
import { VoiceSetup } from "@/components/VoiceSetup";
import { Badge } from "@/components/ui/badge";
import { useBootstrap } from "@/hooks/useBootstrap";
import { errorMessage } from "@/lib/format";
import { accountOverview, webhookDiagnostics } from "@/lib/twilio.functions";

const TITLE = "Advanced — SixVox";
const DESCRIPTION = "Carrier account health, routing endpoints and the raw API console.";

export const Route = createFileRoute("/_authenticated/advanced")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvancedScreen,
});

function AdvancedScreen() {
  const boot = useBootstrap();
  const overview = useQuery({
    queryKey: ["account-overview"],
    queryFn: () => accountOverview(),
    enabled: boot.isAdmin,
    retry: false,
  });
  const diagnostics = useQuery({
    queryKey: ["webhook-diagnostics"],
    queryFn: () => webhookDiagnostics(),
    enabled: boot.isAdmin,
    retry: false,
    refetchInterval: 60_000,
  });

  if (!boot.isAdmin) {
    return (
      <div className="px-6 py-20 text-center text-sm text-muted-foreground">
        This area is for account administrators.
      </div>
    );
  }

  const balance = overview.data?.balance as { balance?: string; currency?: string } | null;
  const account = overview.data?.account as {
    directApi?: boolean;
    friendlyName?: string | null;
    status?: string | null;
    type?: string | null;
    sidSuffix?: string | null;
    credentialsOk?: boolean;
    credentialMessage?: string | null;
  } | null;

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Advanced"
        subtitle="Admin only — carrier plumbing"
        action={
          <Link
            to="/settings"
            className="key-raised grid size-9 place-items-center rounded-full text-muted-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" />
          </Link>
        }
      />

      <section className="space-y-3 px-4 py-4">
        <h2 className="font-display text-sm font-semibold">Account health</h2>
        {overview.isError ? (
          <p className="text-xs text-muted-foreground">{errorMessage(overview.error)}</p>
        ) : (
          <>
            <div className="glass-panel flex items-center gap-3 rounded-3xl px-4 py-3">
              <span
                className={
                  account?.credentialsOk
                    ? "h-2.5 w-2.5 shrink-0 rounded-full bg-success"
                    : "h-2.5 w-2.5 shrink-0 rounded-full bg-destructive"
                }
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {account?.friendlyName ?? "Carrier account"}
                </p>
                {account?.credentialsOk === false ? (
                  <p className="text-[0.7rem] text-destructive">
                    {account.credentialMessage ?? "Credentials rejected."}
                  </p>
                ) : (
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    {[
                      account?.type,
                      account?.status,
                      account?.sidSuffix ? `···${account.sidSuffix}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <Badge
                variant={account?.directApi ? "secondary" : "outline"}
                className="text-[0.6rem]"
              >
                {account?.directApi ? "full API" : "gateway only"}
              </Badge>
            </div>
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">Balance</p>
              <p className="tabular font-display mt-1 text-2xl font-semibold">
                {balance ? `${balance.balance} ${balance.currency}` : "—"}
              </p>
            </div>
            <ul className="space-y-1.5">
              {(overview.data?.usage ?? [])
                .slice(0, 8)
                .map((raw) => raw as { category: string; usage: string; price: string })
                .map((u) => (
                  <li key={u.category} className="flex items-center justify-between gap-2 text-xs">
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

      <VoiceSetup />

      <CallErrors data={diagnostics.data} />

      <ElevenLabsStatus />
      <MessagingServicesSection numbers={boot.numbers} />

      <section className="space-y-3 border-t border-border px-4 py-4">
        <h2 className="font-display text-sm font-semibold">Routing endpoints</h2>
        <p className="text-xs text-muted-foreground">
          Turning on SixVox answering for a line points it at these automatically.
        </p>
        {(
          [
            ["Messaging", boot.smsWebhook],
            ["Voice", boot.voiceWebhook],
            ["Status", boot.statusWebhook],
          ] as const
        ).map(([label, url]) => (
          <button
            key={label}
            type="button"
            className="glass-panel flex w-full items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left"
            onClick={() => {
              void navigator.clipboard.writeText(url ?? "");
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
          to="/a2p"
          className="glass-panel mb-3 flex items-center gap-3 rounded-2xl px-4 py-3"
        >
          <ShieldCheck className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">US texting registration</p>
            <p className="text-[0.7rem] text-muted-foreground">
              A2P 10DLC brand and campaign — required for US delivery
            </p>
          </div>
        </Link>
        <Link to="/console" className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3">
          <Terminal className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">API console</p>
            <p className="text-[0.7rem] text-muted-foreground">Raw carrier API requests</p>
          </div>
        </Link>
      </section>
    </div>
  );
}