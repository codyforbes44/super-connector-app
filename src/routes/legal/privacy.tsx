import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LEGAL_UPDATED } from "@/components/LegalPage";
import { pageHead } from "@/lib/seo";

const TITLE = "Privacy Policy — SixVox business phone";
const DESCRIPTION =
  "How SixVox handles account, call, message, voicemail, and contact data for your business line, including when calls are recorded.";

export const Route = createFileRoute("/legal/privacy")({
  head: () => pageHead({ path: "/legal/privacy", title: TITLE, description: DESCRIPTION }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <h2>What we collect</h2>
      <p>
        We collect the account details you give us (name, email address, and workspace name), the
        business communications you send and receive through SixVox (call metadata, messages,
        voicemail recordings and their transcripts, and call recordings when transcription is turned
        on for a line), the contacts you save, and technical data such as device type and push
        notification tokens. Calls are only recorded if you turn on transcription for a line, and
        callers hear a recording notice first. Voicemail a caller chooses to leave is also stored.
      </p>

      <h2>AI receptionist</h2>
      <p>
        If you turn on the AI receptionist for a number, the audio of that call is processed to
        generate the spoken reply and a transcript. That processing is used to run the feature you
        enabled. We do not sell those conversations and we do not use them to advertise to your
        callers.
      </p>

      <h2>Emergency calling</h2>
      <p>
        SixVox is a VoIP service and does not currently register an emergency address for 911. Do
        not treat it as a substitute for a traditional phone when you need emergency services.
      </p>

      <h2>How we use it</h2>
      <p>
        We use your data to deliver the service: routing calls and messages, storing your inbox,
        producing transcripts and summaries, sending you alerts, supporting your account and billing
        your subscription. We do not sell your data and we do not use your business communications
        for advertising.
      </p>

      <h2>Connected accounts</h2>
      <p>
        If you connect a Google account, SixVox requests only the permissions needed for the
        features you enable: your email address and profile, reading notification threads and
        sending mail on your behalf, and reading and creating calendar events. Access tokens are
        stored encrypted, used only for actions you trigger, and revoked immediately when you
        disconnect. SixVox&apos;s use of information received from Google APIs adheres to the Google
        API Services User Data Policy, including the Limited Use requirements.
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
        SixVox.
      </p>

      <h2>Changes</h2>
      <p>
        If we make a material change to this policy we will notify you in the app or by email before
        it takes effect.
      </p>
    </LegalPage>
  );
}
