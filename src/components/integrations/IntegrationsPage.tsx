import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notRegisteredCopy } from "@/lib/integrations/automated-text";
import { HOUSECALL_ZAPIER_COPY } from "@/lib/integrations/housecall";
import type { PortDraft } from "@/lib/integrations/port-in";
import { CONNECT_TEST_KEY_MESSAGE } from "@/lib/integrations/stripe-connect";

import { PortInWizard } from "./PortInWizard";
import type { IntegrationsSnapshot, ReviewSettingsInput } from "./types";

function clock(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function IntegrationsPage({
  snapshot,
  busy,
  notice,
  onConnectJobber,
  onDisconnectJobber,
  onSaveHousecall,
  onDisconnectHousecall,
  onSaveReviews,
  onConnectStripe,
  onRefreshStripe,
  onSavePortDraft,
  onConfirmPort,
}: {
  snapshot: IntegrationsSnapshot;
  busy: string | null;
  notice: string | null;
  onConnectJobber: () => Promise<void> | void;
  onDisconnectJobber: () => Promise<void> | void;
  onSaveHousecall: (apiKey: string) => Promise<void> | void;
  onDisconnectHousecall: () => Promise<void> | void;
  onSaveReviews: (input: ReviewSettingsInput) => Promise<void> | void;
  onConnectStripe: () => Promise<void> | void;
  onRefreshStripe: () => Promise<void> | void;
  onSavePortDraft: (
    draft: PortDraft,
    bill: { filename: string; mime: string; base64: string },
  ) => Promise<{ id: string }>;
  onConfirmPort: (portId: string) => Promise<{ submitted: boolean; reason: string | null }>;
}) {
  const [apiKey, setApiKey] = useState("");
  const [reviews, setReviews] = useState<ReviewSettingsInput>(snapshot.reviews);

  useEffect(() => {
    setReviews({
      ...snapshot.reviews,
      quietStart: clock(snapshot.reviews.quietStart),
      quietEnd: clock(snapshot.reviews.quietEnd),
    });
  }, [snapshot.reviews]);

  return (
    <div className="space-y-4 px-4 py-4" data-testid="integrations-page">
      <p className="text-xs text-muted-foreground">
        {notRegisteredCopy(null)} Review requests and payment links use that line&apos;s Messaging
        Service ({snapshot.registeredTextingNumber}). Other lines show a not-registered state and do
        not send.
      </p>
      {notice ? <p className="text-sm text-primary">{notice}</p> : null}

      <section className="glass-panel space-y-3 rounded-3xl p-5" data-testid="jobber-section">
        <header>
          <h2 className="font-display text-base font-semibold">Jobber</h2>
          <p className="text-xs text-muted-foreground">
            Connect a Jobber account for this workspace, then create or match a client from a call.
          </p>
        </header>
        {snapshot.jobber.connected ? (
          <div className="space-y-3">
            <p className="text-sm">
              Connected{snapshot.jobber.accountName ? ` · ${snapshot.jobber.accountName}` : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy === "jobber"}
              onClick={() => void onDisconnectJobber()}
            >
              Disconnect Jobber
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {snapshot.jobber.configured ? (
              <p className="text-xs text-muted-foreground">
                You&apos;ll sign in with Jobber. Tokens stay on the server.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Jobber isn&apos;t configured yet. Add JOBBER_CLIENT_ID and JOBBER_CLIENT_SECRET,
                then connect a developer account.
              </p>
            )}
            <Button
              type="button"
              disabled={busy === "jobber" || !snapshot.jobber.configured}
              onClick={() => void onConnectJobber()}
            >
              Connect Jobber
            </Button>
          </div>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-3xl p-5" data-testid="housecall-section">
        <header>
          <h2 className="font-display text-base font-semibold">Housecall Pro</h2>
          <p className="text-xs text-muted-foreground">{snapshot.housecall.maxPlanCopy}</p>
        </header>
        <p className="text-xs text-muted-foreground">{HOUSECALL_ZAPIER_COPY}</p>
        {snapshot.housecall.connected ? (
          <div className="space-y-3">
            <p className="text-sm">API key saved {snapshot.housecall.keyHint ?? ""}</p>
            <Button
              type="button"
              variant="outline"
              disabled={busy === "housecall"}
              onClick={() => void onDisconnectHousecall()}
            >
              Disconnect Housecall Pro
            </Button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onSaveHousecall(apiKey);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="hcp-key">MAX plan API key</Label>
              <Input
                id="hcp-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste the API key"
              />
            </div>
            <Button type="submit" disabled={busy === "housecall"}>
              Save API key
            </Button>
          </form>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-3xl p-5" data-testid="reviews-section">
        <header>
          <h2 className="font-display text-base font-semibold">Review requests</h2>
          <p className="text-xs text-muted-foreground">
            When a job is marked done, SixVox sends one Google review text. Opt-out, quiet hours,
            and a per-contact cooldown are checked first. Each attempt is written to the consent
            log.
          </p>
        </header>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void onSaveReviews(reviews);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="review-url">Google review link</Label>
            <Input
              id="review-url"
              value={reviews.reviewUrl}
              onChange={(event) => setReviews({ ...reviews, reviewUrl: event.target.value })}
              placeholder="https://g.page/r/…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-name">Business name</Label>
            <Input
              id="review-name"
              value={reviews.businessName}
              onChange={(event) => setReviews({ ...reviews, businessName: event.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reviews.enabled}
              onChange={(event) => setReviews({ ...reviews, enabled: event.target.checked })}
            />
            Send a review text when a job is marked done
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="cooldown">Cooldown (days)</Label>
              <Input
                id="cooldown"
                inputMode="numeric"
                value={String(reviews.cooldownDays)}
                onChange={(event) =>
                  setReviews({ ...reviews, cooldownDays: Number(event.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Timezone</Label>
              <Input
                id="tz"
                value={reviews.timezone}
                onChange={(event) => setReviews({ ...reviews, timezone: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet-start">Quiet hours start</Label>
              <Input
                id="quiet-start"
                type="time"
                value={clock(reviews.quietStart)}
                onChange={(event) => setReviews({ ...reviews, quietStart: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet-end">Quiet hours end</Label>
              <Input
                id="quiet-end"
                type="time"
                value={clock(reviews.quietEnd)}
                onChange={(event) => setReviews({ ...reviews, quietEnd: event.target.value })}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy === "reviews"}>
            Save review settings
          </Button>
        </form>
      </section>

      <section className="glass-panel space-y-3 rounded-3xl p-5" data-testid="stripe-section">
        <header>
          <h2 className="font-display text-base font-semibold">Payment links</h2>
          <p className="text-xs text-muted-foreground">
            Stripe Connect test mode. Charges land on the tradesperson&apos;s connected account.
            SixVox does not keep the payment.
          </p>
        </header>
        <p className="text-xs text-muted-foreground">{CONNECT_TEST_KEY_MESSAGE}</p>
        {snapshot.connect.configured ? (
          <div className="space-y-3">
            <p className="text-sm">
              {snapshot.connect.accountId
                ? `Test account ${snapshot.connect.label ?? snapshot.connect.accountId}`
                : "No test account yet."}
            </p>
            <p className="text-xs text-muted-foreground">
              Card payments: {snapshot.connect.cardPayments}
              {snapshot.connect.chargesActive ? " · ready for test payment links" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy === "stripe"}
                onClick={() => void onConnectStripe()}
              >
                {snapshot.connect.accountId ? "Continue test onboarding" : "Start test onboarding"}
              </Button>
              {snapshot.connect.accountId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy === "stripe"}
                  onClick={() => void onRefreshStripe()}
                >
                  Refresh status
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add STRIPE_CONNECT_SECRET_KEY as a test key before onboarding. Live keys are refused.
          </p>
        )}
      </section>

      <section className="glass-panel space-y-3 rounded-3xl p-5" data-testid="port-section">
        <header>
          <h2 className="font-display text-base font-semibold">Port in a US local number</h2>
        </header>
        <PortInWizard
          port={snapshot.port}
          busy={busy === "port"}
          onSaveDraft={onSavePortDraft}
          onConfirm={onConfirmPort}
        />
      </section>
    </div>
  );
}
