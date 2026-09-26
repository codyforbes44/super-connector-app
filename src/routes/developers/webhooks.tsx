import { createFileRoute } from "@tanstack/react-router";

import { Eyebrow, MarketingLayout, Section } from "@/components/MarketingLayout";
import { pageHead } from "@/lib/seo";

const TITLE = "Webhooks — SixVox";
const DESCRIPTION =
  "Verify SixVox outbound webhooks with HMAC-SHA256. Node and Python examples, event types, and the retry schedule.";

const NODE_EXAMPLE = `import { createHmac, timingSafeEqual } from "node:crypto";

const WINDOW_SECONDS = 300;

export function verifySixVoxWebhook(secret, rawBody, timestamp, signature) {
  const stamped = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(stamped) || Math.abs(now - stamped) > WINDOW_SECONDS) {
    return false;
  }
  const expected =
    "v1=" + createHmac("sha256", secret).update(timestamp + "." + rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Express: app.use(express.raw({ type: "application/json" }))
// const rawBody = req.body.toString("utf8");
// const ok = verifySixVoxWebhook(
//   process.env.SIXVOX_WEBHOOK_SECRET,
//   rawBody,
//   req.get("X-SixVox-Timestamp"),
//   req.get("X-SixVox-Signature"),
// );`;

const PYTHON_EXAMPLE = `import hashlib
import hmac
import time

WINDOW_SECONDS = 300

def verify_sixvox_webhook(secret: str, raw_body: str, timestamp: str, signature: str) -> bool:
    try:
        stamped = int(timestamp)
    except ValueError:
        return False
    if abs(int(time.time()) - stamped) > WINDOW_SECONDS:
        return False
    digest = hmac.new(
        secret.encode(),
        f"{timestamp}.{raw_body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    expected = f"v1={digest}"
    return hmac.compare_digest(expected, signature)`;

export const Route = createFileRoute("/developers/webhooks")({
  head: () => pageHead({ path: "/developers/webhooks", title: TITLE, description: DESCRIPTION }),
  component: WebhooksDocsPage,
});

function WebhooksDocsPage() {
  return (
    <MarketingLayout>
      <Section className="pb-8">
        <Eyebrow>Developers</Eyebrow>
        <h1 className="font-display mt-5 text-[2rem] leading-[1.06] font-semibold text-balance sm:text-4xl md:text-5xl">
          Outbound webhooks
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          SixVox POSTs JSON when something happens on a line. Each request is signed so you can
          reject anything that did not come from your workspace.
        </p>
      </Section>

      <Section className="space-y-8 py-4">
        <article>
          <h2 className="font-display text-lg font-semibold">Events</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>
              <code>call.missed</code> — inbound call ended with no answer, busy, or a failed dial
            </li>
            <li>
              <code>call.completed</code> — a call reached a terminal status
            </li>
            <li>
              <code>voicemail.transcribed</code> — a voicemail recording was transcribed
            </li>
            <li>
              <code>lead.captured</code> — a website enquiry was saved
            </li>
            <li>
              <code>booking.created</code> — a calendar booking was created
            </li>
            <li>
              <code>message.received</code> — an inbound SMS or WhatsApp message arrived
            </li>
          </ul>
        </article>

        <article>
          <h2 className="font-display text-lg font-semibold">Request</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The body is JSON: <code>id</code>, <code>type</code>, <code>created_at</code>,{" "}
            <code>workspace_id</code>, and <code>data</code>. Two headers travel with it:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>
              <code>X-SixVox-Timestamp</code> — unix seconds
            </li>
            <li>
              <code>X-SixVox-Signature</code> — <code>v1=</code> plus hex HMAC-SHA256 of{" "}
              <code>timestamp + "." + rawBody</code>
            </li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Reject timestamps more than 300 seconds from your clock. Compare the signature against
            the raw body bytes, before you parse JSON, so key order stays intact. Respond with any
            HTTP status from 200 to 299. Other 4xx responses are not retried. 408, 429, 5xx, and
            network errors retry after 60 seconds, 5 minutes, 30 minutes, 2 hours, and 6 hours, then
            the delivery is marked dead.
          </p>
        </article>

        <article data-testid="node-example">
          <h2 className="font-display text-lg font-semibold">Node</h2>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed">
            <code>{NODE_EXAMPLE}</code>
          </pre>
        </article>

        <article data-testid="python-example">
          <h2 className="font-display text-lg font-semibold">Python</h2>
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed">
            <code>{PYTHON_EXAMPLE}</code>
          </pre>
        </article>
      </Section>
    </MarketingLayout>
  );
}
