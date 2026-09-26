import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LEGAL_UPDATED } from "@/components/LegalPage";
import { pageHead } from "@/lib/seo";

const TITLE = "Privacy Policy — SixVox";
const DESCRIPTION =
  "How SixVox collects, uses, stores and protects your account, call, message and contact data.";

export const Route = createFileRoute("/legal/privacy")({
  head: () => pageHead({ path: "/legal/privacy", title: TITLE, description: DESCRIPTION }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <h2>What we collect</h2>
      <p>
        We collect the account details you give us (name, email address and workspace name), the
        business communications you send and receive through SixVox (call metadata, messages,
        voicemail recordings and their transcripts, and live call recordings when recording is
        turned on for a line), the contacts you save, the emergency service address you register for
        a number, and technical data such as device type and push notification tokens. Call
        recording is off for each line until you turn it on. When it is on, everyone on the call
        hears a recording notice before recording starts, including voicemail and the AI
        receptionist. Voicemail a caller chooses to leave is also stored.
      </p>

      <h2>Emergency calling</h2>
      <p>
        If you register an emergency address, SixVox sends that address to Twilio so 911 responders
        are directed to it. The address, its validation result, and each user&apos;s acknowledgment
        of the VoIP 911 limitations (47 CFR 9.11) are stored with your account. Registering an
        address costs $0.75 per number per month, billed by Twilio. A 911 call from a number with no
        registered address is routed to a national emergency call center at $75 per call.
      </p>

      <h2>Call recording</h2>
      <p>
        Recording of live calls is off until an admin turns it on for that line. Voicemail is always
        recorded. When a live call is recorded, SixVox plays “This call may be recorded and
        transcribed for note taking” to every party before the recording starts, including inbound
        calls, outbound calls, and the AI receptionist. The assistant&apos;s first message identifies
        it as an automated assistant, and includes the recording notice when that line records calls.
        SixVox uses this all-party notice everywhere, including one-party-consent states.
      </p>

      <h2>Text messages and opt-out</h2>
      <p>
        If someone texts STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, REVOKE, or OPTOUT, SixVox
        stops automated and app-sent texts to that number until they text START, UNSTOP, YES, or
        OPTIN. HELP and INFO are logged and are not treated as opt-out. Quiet hours, when you turn
        them on, hold follow-up, review, and marketing texts. A text you send yourself from the
        inbox is not held for quiet hours. Review and marketing texts also require a consent record
        for that number. SixVox does not place outbound AI voice calls. If that feature is added, it
        will stay blocked unless a prior-consent record exists for the number.
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
