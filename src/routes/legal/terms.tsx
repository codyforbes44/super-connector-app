import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LEGAL_UPDATED } from "@/components/LegalPage";
import { pageHead } from "@/lib/seo";

const TITLE = "Terms of Service — SixVox";
const DESCRIPTION = "The terms that govern your SixVox account, trial, subscription, acceptable use and cancellation.";

export const Route = createFileRoute("/legal/terms")({
  head: () => pageHead({ path: "/legal/terms", title: TITLE, description: DESCRIPTION }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <h2>Your account</h2>
      <p>
        You must provide accurate details, keep your credentials secure and be responsible for everything done under
        your workspace. You must be at least 18 years old and authorised to act for the business you register.
      </p>

      <h2>Trial and billing</h2>
      <p>
        New workspaces get a 14-day free trial. You choose a plan and enter payment details to start the trial, but
        nothing is charged until the trial ends. Prices are quoted in US dollars excluding tax; any applicable sales tax
        or VAT is calculated at checkout from your billing address. Subscriptions renew automatically at the
        then-current plan price each month or year until cancelled, and we email a receipt or invoice for every payment.
        Communication usage (calls, messages and AI minutes) is billed at cost in addition to your plan.
      </p>
      <p>
        Payments are processed by our payment network partner, whose descriptor may appear on your card statement
        alongside SixVox.
      </p>

      <h2>Cancellation and refunds</h2>
      <p>
        You can cancel at any time from Billing in the app or the customer portal. Cancelling during the trial costs
        nothing. After the trial, cancellation stops future renewals and you keep access until the end of the period you
        have already paid for. Fees already paid are non-refundable except where required by law. If a renewal payment
        fails we retry it and keep your workspace running while we do; if all retries fail the subscription is
        cancelled. We will give at least 30 days notice before any price change affecting your renewal.
      </p>

      <h2>Emergency calling</h2>
      <p>
        SixVox is an interconnected VoIP service. 911 from a SixVox number can fail if power, the
        internet, or SixVox is down, and responders are sent to the service address registered for
        that number, not to wherever the handset is. You must acknowledge these limitations (47 CFR
        9.11) before placing calls, and you must update the address if the business moves. Emergency
        address registration is $0.75 per number per month. A 911 call with no registered address is
        $75 and is routed to a national emergency call center. Those Twilio fees are in addition to
        your plan.
      </p>

      <h2>Recording</h2>
      <p>
        Live call recording is off for each line until you turn it on. When it is on, every party
        hears a recording notice before recording starts. Voicemail always plays that notice. The AI
        receptionist identifies itself as an automated assistant on calls it answers. You are
        responsible for using recording in line with the law that applies to your business. SixVox
        applies the notice on every recorded leg, including in one-party-consent states.
      </p>

      <h2>Messages and AI calls</h2>
      <p>
        You must honor STOP and START. SixVox blocks further app and automated texts after STOP
        until START, and it can hold automated texts during quiet hours you configure. Review and
        marketing texts require a consent record. You may not place an outbound AI voice call to a
        person without recorded prior consent. This release does not place outbound AI voice calls
        at all.
      </p>

      <h2>Caller identity</h2>
      <p>
        SHAKEN/STIR, CNAM, and Voice Integrity are optional Trust Hub registrations. SixVox can save
        a draft of those registrations. Submitting them to Twilio is a separate step that this
        release does not perform. CNAM requires an EIN or a DUNS number. Branded Calling, at $0.12
        per call where offered, is not included.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You may not use SixVox to send unsolicited bulk messages, impersonate others, harass anyone, distribute malware,
        or break telecommunications, privacy or consumer-protection law. You are responsible for obtaining consent
        before contacting people and for complying with messaging registration requirements in your country. We may
        suspend a workspace that puts the platform or its users at risk.
      </p>

      <h2>Your content</h2>
      <p>
        Your messages, voicemail, contacts and other content remain yours. You grant us the limited licence needed to
        store, transmit, transcribe and display that content in order to run the service.
      </p>

      <h2>Availability</h2>
      <p>
        We work hard to keep SixVox available but the service is provided &quot;as is&quot; without warranties. Delivery
        of calls and messages depends on carrier networks outside our control.
      </p>

      <h2>Liability</h2>
      <p>
        To the maximum extent permitted by law, our total liability for any claim is limited to the amount you paid us
        in the three months before the claim. We are not liable for indirect or consequential losses.
      </p>

      <h2>Termination</h2>
      <p>
        You may close your workspace at any time from Settings. We may terminate an account for material breach of these
        terms, with notice where practical.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:support@bookme.bet">support@bookme.bet</a>.
      </p>
    </LegalPage>
  );
}
