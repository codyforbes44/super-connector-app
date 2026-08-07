import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LEGAL_UPDATED } from "@/components/LegalPage";

const TITLE = "Terms of Service — SignalBox";
const DESCRIPTION =
  "The terms that govern your SignalBox account, trial, subscription, acceptable use and cancellation.";

export const Route = createFileRoute("/legal/terms")({
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
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <h2>Your account</h2>
      <p>
        You must provide accurate details, keep your credentials secure and be responsible for
        everything done under your workspace. You must be at least 16 years old and authorised to
        act for the business you register.
      </p>

      <h2>Trial and billing</h2>
      <p>
        New workspaces get a 14-day free trial with no card required. After the trial you choose a
        plan; subscriptions renew automatically each period until cancelled. Communication usage
        (calls, messages and AI minutes) is billed at cost in addition to your plan. You can cancel
        at any time and keep access until the end of the current period. Fees already paid are
        non-refundable except where required by law.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You may not use SignalBox to send unsolicited bulk messages, impersonate others, harass
        anyone, distribute malware, or break telecommunications, privacy or consumer-protection
        law. You are responsible for obtaining consent before contacting people and for complying
        with messaging registration requirements in your country. We may suspend a workspace that
        puts the platform or its users at risk.
      </p>

      <h2>Your content</h2>
      <p>
        Your messages, recordings, contacts and other content remain yours. You grant us the
        limited licence needed to store, transmit, transcribe and display that content in order to
        run the service.
      </p>

      <h2>Availability</h2>
      <p>
        We work hard to keep SignalBox available but the service is provided &quot;as is&quot;
        without warranties. Delivery of calls and messages depends on carrier networks outside our
        control.
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