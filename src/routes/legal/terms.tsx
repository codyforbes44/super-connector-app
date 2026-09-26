import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LEGAL_UPDATED } from "@/components/LegalPage";
import { pageHead } from "@/lib/seo";

const TITLE = "Terms of Service — SixVox business phone";
const DESCRIPTION =
  "Terms for your SixVox trial, plan, cancellation, call recording, AI receptionist, texting, and VoIP 911 limits.";

export const Route = createFileRoute("/legal/terms")({
  head: () => pageHead({ path: "/legal/terms", title: TITLE, description: DESCRIPTION }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <h2>Your account</h2>
      <p>
        You must provide accurate details, keep your credentials secure and be responsible for
        everything done under your workspace. You must be at least 18 years old and authorised to
        act for the business you register.
      </p>

      <h2>Trial and billing</h2>
      <p>
        New workspaces get a 14-day free trial. You choose a plan and enter payment details to start
        the trial, but nothing is charged until the trial ends. Prices are quoted in US dollars
        excluding tax; any applicable sales tax or VAT is calculated at checkout from your billing
        address. Subscriptions renew automatically at the then-current plan price each month or year
        until cancelled, and we email a receipt or invoice for every payment. You pay the plan price
        shown at checkout. Included numbers, seats, and AI receptionist calls are listed on the
        pricing page.
      </p>
      <p>
        Payments are processed by our payment network partner, whose descriptor may appear on your
        card statement alongside SixVox.
      </p>

      <h2>Cancellation and refunds</h2>
      <p>
        You can cancel at any time from Billing in the app or the customer portal. Cancelling during
        the trial costs nothing. After the trial, cancellation stops future renewals and you keep
        access until the end of the period you have already paid for. Fees already paid are
        non-refundable except where required by law. If a renewal payment fails we retry it and keep
        your workspace running while we do; if all retries fail the subscription is cancelled. We
        will give at least 30 days notice before any price change affecting your renewal.
      </p>

      <h2 id="recording">Call recording</h2>
      <p>
        Calls are only recorded if you turn on transcription for a line, and callers hear a
        recording notice first. Voicemail a caller leaves is stored so you can play it back. You are
        responsible for using recording in a way that follows the law where you and the caller are.
      </p>

      <h2 id="ai">AI receptionist</h2>
      <p>
        If you enable the AI receptionist, it will speak with callers using the voice and
        instructions you set. It can be wrong. You are responsible for what it is allowed to say and
        for confirming any job it captures before you rely on it. Booking that waits for your
        approval is not available yet.
      </p>

      <h2 id="emergency">Emergency calling</h2>
      <p>
        SixVox is an internet phone service. A 911 call may not reach your local emergency center
        and may not send your location. SixVox does not currently register an emergency address. Do
        not use SixVox as your only way to call emergency services. See{" "}
        <a href="https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-9/subpart-D">
          47 CFR 9.11
        </a>
        .
      </p>

      <h2 id="texting">Texting</h2>
      <p>
        US carriers require registration before they reliably deliver business texts. SixVox
        provides that registration flow on every plan. You must have permission to text people, you
        must honor STOP and other opt-out replies, and you may not send unsolicited bulk messages.
        Messages can fail until a carrier approves the registration.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You may not use SixVox to send unsolicited bulk messages, impersonate others, harass anyone,
        distribute malware, or break telecommunications, privacy or consumer-protection law. You are
        responsible for obtaining consent before contacting people and for complying with messaging
        registration requirements in your country. We may suspend a workspace that puts the platform
        or its users at risk.
      </p>

      <h2>Your content</h2>
      <p>
        Your messages, voicemail, contacts and other content remain yours. You grant us the limited
        licence needed to store, transmit, transcribe and display that content in order to run the
        service.
      </p>

      <h2>Availability</h2>
      <p>
        We work hard to keep SixVox available but the service is provided &quot;as is&quot; without
        warranties. Delivery of calls and messages depends on carrier networks outside our control.
      </p>

      <h2>Liability</h2>
      <p>
        To the maximum extent permitted by law, our total liability for any claim is limited to the
        amount you paid us in the three months before the claim. We are not liable for indirect or
        consequential losses.
      </p>

      <h2>Termination</h2>
      <p>
        You may close your workspace at any time from Settings. We may terminate an account for
        material breach of these terms, with notice where practical.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:support@bookme.bet">support@bookme.bet</a>.
      </p>
    </LegalPage>
  );
}
