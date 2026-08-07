import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LEGAL_UPDATED } from "@/components/LegalPage";

const TITLE = "Privacy Policy — SignalBox";
const DESCRIPTION =
  "How SignalBox collects, uses, stores and protects your account, call, message and contact data.";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <h2>What we collect</h2>
      <p>
        We collect the account details you give us (name, email address and workspace name), the
        business communications you send and receive through SignalBox (calls, messages, voicemail,
        recordings, transcripts and their metadata), the contacts you save, and technical data such
        as device type and push notification tokens.
      </p>

      <h2>How we use it</h2>
      <p>
        We use your data to deliver the service: routing calls and messages, storing your inbox,
        producing transcripts and summaries, sending you alerts, supporting your account and
        billing your subscription. We do not sell your data and we do not use your business
        communications for advertising.
      </p>

      <h2>Connected accounts</h2>
      <p>
        If you connect a Google account, SignalBox requests only the permissions needed for the
        features you enable: your email address and profile, reading notification threads and
        sending mail on your behalf, and reading and creating calendar events. Access tokens are
        stored encrypted, used only for actions you trigger, and revoked immediately when you
        disconnect. SignalBox&apos;s use of information received from Google APIs adheres to the
        Google API Services User Data Policy, including the Limited Use requirements.
      </p>

      <h2>Sharing</h2>
      <p>
        We share data only with the infrastructure providers required to run the service — cloud
        hosting and database, telecommunications delivery, AI voice processing, email delivery and
        payment processing — each acting on our instructions under contract.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your workspace is active. You can delete individual conversations
        and contacts at any time. When you close your account we delete your workspace data within
        30 days, except records we must keep for legal, tax or fraud-prevention reasons.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest. Access inside your workspace is enforced at the
        database level by role, so teammates only see the numbers and conversations assigned to
        them.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request a copy of your data, correct it, or ask us to delete it by emailing{" "}
        <a href="mailto:privacy@bookme.bet">privacy@bookme.bet</a>. Children under 16 may not use
        SignalBox.
      </p>

      <h2>Changes</h2>
      <p>
        If we make a material change to this policy we will notify you in the app or by email
        before it takes effect.
      </p>
    </LegalPage>
  );
}