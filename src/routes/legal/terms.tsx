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
