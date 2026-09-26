import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

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
import { errorMessage } from "@/lib/format";
import {
  OUTBOUND_EVENT_TYPES,
  eventLabel,
  isOutboundEventType,
  type OutboundEventType,
} from "@/lib/outbound-webhooks";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookSettings,
  resendWebhookDelivery,
  sendWebhookTest,
  updateWebhookEndpoint,
} from "@/lib/webhook-settings.functions";

type Endpoint = {
  id: string;
  url: string;
  secret: string;
  enabled: boolean;
  events: OutboundEventType[];
  description: string | null;
};

type Delivery = {
  id: string;
  endpointId: string;
  eventType: string;
  eventLabel: string;
  status: string;
  attemptCount: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
};

const SAMPLE_ENDPOINTS: Endpoint[] = [
  {
    id: "preview-endpoint",
    url: "https://hook.example.com/sixvox",
    secret: "preview-secret-not-real",
    enabled: true,
    events: ["lead.captured", "call.missed"],
    description: "Make.com lead sheet",
  },
];

const SAMPLE_DELIVERIES: Delivery[] = [
  {
    id: "preview-delivery",
    endpointId: "preview-endpoint",
    eventType: "lead.captured",
    eventLabel: "Lead captured",
    status: "pending",
    attemptCount: 2,
    lastStatusCode: 503,
    lastError: "HTTP 503",
    createdAt: "2026-09-26T12:00:00.000Z",
  },
];

export function OutboundWebhooks({ preview = false }: { preview?: boolean }) {
  const query = useQuery({
    queryKey: ["outbound-webhooks"],
    queryFn: () => listWebhookSettings(),
    enabled: !preview,
  });
  const [url, setUrl] = useState("https://");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<OutboundEventType[]>(["call.missed", "lead.captured"]);
  const [testType, setTestType] = useState<OutboundEventType>("lead.captured");
  const [busy, setBusy] = useState(false);

  const endpoints = preview ? SAMPLE_ENDPOINTS : (query.data?.endpoints ?? []);
  const deliveries = preview ? SAMPLE_DELIVERIES : (query.data?.deliveries ?? []);

  function toggleEvent(type: OutboundEventType) {
    setEvents((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  async function create() {
    if (preview) {
      toast.success("Preview only — no endpoint was created.");
      return;
    }
    setBusy(true);
    try {
      const created = await createWebhookEndpoint({ data: { url, events, description } });
      toast.success("Endpoint saved. Copy the secret now — it signs every delivery.");
      setUrl("https://");
      setDescription("");
      await query.refetch();
      await navigator.clipboard.writeText(created.secret).catch(() => undefined);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 border-t border-border px-4 py-4" data-testid="outbound-webhooks">
      <div>
        <h2 className="font-display text-sm font-semibold">Outbound webhooks</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          SixVox signs each event with HMAC-SHA256.{" "}
          <Link to="/developers/webhooks" className="text-primary underline">
            Verification docs
          </Link>
        </p>
      </div>

      {query.error ? <p className="text-sm text-destructive">{errorMessage(query.error)}</p> : null}

      <div className="space-y-3 rounded-2xl border border-border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="hook-url">Endpoint URL</Label>
          <Input
            id="hook-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://hook.make.com/…"
            className="h-11 rounded-xl px-4"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hook-desc">Label</Label>
          <Input
            id="hook-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={120}
            className="h-11 rounded-xl px-4"
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Events</legend>
          {OUTBOUND_EVENT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={events.includes(type)}
                onChange={() => toggleEvent(type)}
              />
              {eventLabel(type)}
              <span className="text-xs text-muted-foreground">{type}</span>
            </label>
          ))}
        </fieldset>
        <Button className="h-11 rounded-xl" disabled={busy} onClick={() => void create()}>
          Add endpoint
        </Button>
      </div>

      <ul className="space-y-3">
        {endpoints.map((endpoint) => (
          <li key={endpoint.id} className="space-y-2 rounded-2xl border border-border p-4">
            <p className="break-all text-sm font-medium">{endpoint.url}</p>
            <p className="text-xs text-muted-foreground">{endpoint.description}</p>
            <p className="break-all font-mono text-xs" data-testid="webhook-secret">
              {endpoint.secret}
            </p>
            <p className="text-xs text-muted-foreground">{endpoint.events.join(", ")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  if (preview) return;
                  void updateWebhookEndpoint({
                    data: { id: endpoint.id, enabled: !endpoint.enabled },
                  })
                    .then(() => query.refetch())
                    .catch((error: unknown) => toast.error(errorMessage(error)));
                }}
              >
                {endpoint.enabled ? "Disable" : "Enable"}
              </Button>
              <Select
                value={testType}
                onValueChange={(value) => {
                  if (isOutboundEventType(value)) setTestType(value);
                }}
              >
                <SelectTrigger className="h-9 w-48 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTBOUND_EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {eventLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="rounded-full"
                data-testid="send-test-event"
                onClick={() => {
                  if (preview) {
                    toast.success("Preview only — no test event was sent.");
                    return;
                  }
                  void sendWebhookTest({ data: { endpointId: endpoint.id, type: testType } })
                    .then(async () => {
                      toast.success("Test event queued.");
                      await query.refetch();
                    })
                    .catch((error: unknown) => toast.error(errorMessage(error)));
                }}
              >
                Send test event
              </Button>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  if (preview) return;
                  if (!confirm("Delete this endpoint and its delivery log?")) return;
                  void deleteWebhookEndpoint({ data: { id: endpoint.id } })
                    .then(() => query.refetch())
                    .catch((error: unknown) => toast.error(errorMessage(error)));
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div data-testid="delivery-log">
        <h3 className="font-display text-sm font-semibold">Delivery log</h3>
        {deliveries.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {deliveries.map((delivery) => (
              <li
                key={delivery.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p>
                    {delivery.eventLabel} · {delivery.status}
                    {delivery.lastStatusCode ? ` · HTTP ${delivery.lastStatusCode}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {delivery.attemptCount} attempt{delivery.attemptCount === 1 ? "" : "s"}
                    {delivery.lastError ? ` · ${delivery.lastError}` : ""}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  data-testid="resend-delivery"
                  onClick={() => {
                    if (preview) {
                      toast.success("Preview only — nothing was re-sent.");
                      return;
                    }
                    void resendWebhookDelivery({ data: { deliveryId: delivery.id } })
                      .then(async () => {
                        toast.success("Delivery re-sent.");
                        await query.refetch();
                      })
                      .catch((error: unknown) => toast.error(errorMessage(error)));
                  }}
                >
                  Re-send
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
