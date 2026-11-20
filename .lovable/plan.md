# Release review: where every phase stands, and what to do next

## Status by phase

| Phase | Status | Live version | Notes |
|---|---|---|---|
| 0 Data integrity (duplicates) | Done | phase0-call-identity | 32 confirmed duplicate pairs merged. 97 unproven pairs are parked for you. |
| 1 Calls, texts, delivery, MMS | Done | phase1-communications | Delivery receipts and picture messages work. Your live call/text test is still pending. |
| 2 Routing and live phone tests | Waiting on you | — | Routing for (580) 238-4777 and (214) 978-6445, and the self-forwarding change. |
| 3 Security | Partly done | phase3-security | New sign-ups can no longer see every plan's limits. A2P submission and E911 are waiting on you. |
| 4 Billing and plan limits | Code done | phase4-plan-limits | Upgrade prompts are live, and test payments can never buy a real eSIM. Live prices and the eSIM provider login are waiting on you. |
| 5 Pages and accessibility | Partly done | phase5-ux | Tap targets and screen-reader labels fixed. Not every page was reviewed one by one, and light mode was not checked. |
| 6 Reliability | Done | phase6-reliability | Automatic retries, failure alerts, number health, Status page, backup drill, tests for key flows. |
| 7 Launch polish | Done (except legal) | phase7-polish | Help page, setup checklist, speed check, install check. Legal review is waiting on you. |

## Honest gaps I found
1. **Page review is not finished.** The roadmap still lists Numbers, Calls, A2P, Welcome, eSIM, Contacts and the public pages as needing a one-by-one phone and desktop pass. Light mode was never checked.
2. **Security scan is out of date.** The last scan ran before steps 3–5. Run a fresh one before launch.
3. **Number health flags things you should know about:** (214) 978-6445 and (580) 238-4777 show "Not connected" (expected while parked). (817) 533-8844 has had no calls or texts in 14 days.
4. **Live checks only you can do:** a real inbound call, an inbound text and a picture message on the published app.
5. **Roadmap tidy-up:** a duplicate "step 4" line is still unchecked even though step 4 shipped.

## Recommended order
**A. Work I can do now (no decisions needed)**
1. Run a fresh security scan and fix anything it finds.
2. Finish the one-by-one page pass on the six long pages and the public pages, at phone and desktop width, in both light and dark mode, including empty, loading and error screens.
3. Clean up the roadmap.
4. Publish and report the version.

**B. Decisions only you can make (in suggested priority)**
1. Your live call/text/picture-message test on the published app (fastest, unblocks confidence).
2. Routing for (580) 238-4777 and (214) 978-6445.
3. Submitting the A2P texting registration (affects whether texts get delivered).
4. Moving prices into live payments, and adding the eSIM provider login.
5. E911 settings.
6. The 97 parked call pairs and the self-forwarding change. Low urgency: they're safe left alone.
7. Legal review, then the final release publish.

## Technical notes
- Version marker: `/api/public/version`; deployment ID from the `x-deployment-id` header.
- 308 tests pass. Key flow tests: `critical-flows`, `esim-checkout`, `toast-error`, `onboarding-checklist`, `number-health`, `provider-retry`.
- Approving this plan starts part A only. Nothing in part B is touched.
