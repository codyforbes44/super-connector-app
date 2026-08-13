import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Empty, Screen, Section } from "@/components/screen";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBootstrap } from "@/hooks/useBootstrap";
import { errorMessage } from "@/lib/format";
import { rawTwilioCall } from "@/lib/twilio.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/console")({
  head: () => ({
    meta: [
      { title: "API console — SixVox" },
      { name: "description", content: "Advanced REST console for your SixVox platform account." },
      { property: "og:title", content: "API console — SixVox" },
      {
        property: "og:description",
        content: "Advanced REST console for your SixVox platform account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConsoleScreen,
});

const HOSTS = [
  { value: "api", label: "api (account-scoped)" },
  { value: "api-direct", label: "api (full path)" },
  { value: "verify", label: "verify" },
  { value: "lookups", label: "lookups" },
  { value: "messaging", label: "messaging" },
  { value: "conversations", label: "conversations" },
  { value: "studio", label: "studio" },
  { value: "insights", label: "insights" },
  { value: "voice", label: "voice" },
  { value: "numbers", label: "numbers" },
  { value: "trusthub", label: "trusthub" },
  { value: "pricing", label: "pricing" },
  { value: "sync", label: "sync" },
  { value: "taskrouter", label: "taskrouter" },
  { value: "events", label: "events" },
];

function ConsoleScreen() {
  const boot = useBootstrap();
  const navigate = useNavigate();
  const [host, setHost] = useState("api");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/Messages.json");
  const [params, setParams] = useState('{"PageSize": 5}');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<{ ok: boolean; status: number; body: string } | null>(
    null,
  );

  if (!boot.isOwner) {
    return (
      <Empty
        title="Owners only"
        description="The raw API console is restricted to the account owner."
      />
    );
  }

  async function run() {
    setBusy(true);
    try {
      const result = await rawTwilioCall({ data: { host, method, path, params } });
      setResponse({
        ok: result.ok,
        status: result.status,
        body: JSON.stringify(result.result, null, 2),
      });
    } catch (error) {
      setResponse({ ok: false, status: 0, body: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh pb-6">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 backdrop-blur">
        <Button
          size="icon"
          variant="ghost"
          className="rounded-xl"
          onClick={() => void navigate({ to: "/settings" })}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to settings</span>
        </Button>
        <h1 className="font-display text-lg font-semibold tracking-tight">API console</h1>
      </header>

      <Screen className="space-y-4 pt-4">
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">api (account-scoped)</span> prefixes{" "}
          <code>/2010-04-01/Accounts/&#123;Sid&#125;</code> for you. Other hosts take the full path,
          e.g. <code>/v2/Services</code>.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Host</Label>
            <Select value={host} onValueChange={setHost}>
              <SelectTrigger className="h-11 w-full rounded-xl px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOSTS.map((h) => (
                  <SelectItem key={h.value} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-11 w-full rounded-xl px-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["GET", "POST", "PUT", "DELETE"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="path">Path</Label>
          <Input
            id="path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            maxLength={400}
            className="h-11 rounded-xl px-4 font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="params">Parameters (JSON)</Label>
          <Textarea
            id="params"
            value={params}
            onChange={(e) => setParams(e.target.value)}
            rows={4}
            maxLength={4000}
            className="rounded-2xl font-mono text-xs"
          />
        </div>

        <Button
          className="key-signal h-12 w-full rounded-xl font-semibold"
          onClick={run}
          disabled={busy}
        >
          {busy ? "Sending…" : "Send request"}
        </Button>

        {response ? (
          <Section title="Response">
            <p
              className={cn(
                "text-xs font-semibold",
                response.ok ? "text-success" : "text-destructive",
              )}
            >
              {response.status} {response.ok ? "OK" : "Error"}
            </p>
            <pre className="no-scrollbar mt-2 max-h-96 overflow-auto rounded-2xl border border-border bg-card p-3 font-mono text-[0.7rem] whitespace-pre-wrap">
              {response.body}
            </pre>
          </Section>
        ) : null}
      </Screen>
    </div>
  );
}