# Remaining phases to a production-ready release

Phases 0 (no duplicate records) and 1 (calls and texts work correctly) are live. Here's what's left, in a suggested order.

## Phase 2 — Make sure customers get every call and text
- Set up the remaining numbers so they actually send calls and texts to SixVox. Today (580) 238-4777 sends to the AI service and (214) 978-6445 sends to magnoliamaids.pro. Each change needs your OK first.
- Decide what to do with the 97 call pairs I couldn't prove were duplicates, and with the self-forwarding setup. Both are on hold until you decide.
- Owner tests on the live site: one real call and one real text per number, then confirm each shows up once with its delivery status, recording and summary.
- Sending iMessage from SixVox (today we only receive replies).

## Phase 3 — Texting approval, emergency calling and compliance
- Finish texting approval (A2P) for every number that texts, and block texts from unapproved numbers with a clear message.
- Emergency (E911) address check for each number, plus handling for opt-out words like STOP and HELP.
- Fix the security warning: right now anyone who signs up can see every plan's limits.

## Phase 4 — Billing and plans in the live payment account
- Move the Solo $29 / $290 prices, which so far exist only in test mode, to the live payment account. Then confirm checkout, upgrade, downgrade, cancellation and free-plan grants work from start to finish.
- Enforce plan limits (number of phone lines, team seats, AI calls) and show clear upgrade prompts.
- Check the eSIM checkout end to end.

## Phase 5 — Finish the mobile-first page review
- Review each remaining page on phones and computers: Numbers, Calls, A2P, Welcome, eSIM, Contacts, Settings, Tools, Platform admin and all public pages.
- Accessibility pass: buttons big enough to tap, text contrast, screen-reader labels, keyboard use.
- Every page gets a clear message when it's empty, loading or broken. No endless spinners.

## Phase 6 — Reliability and monitoring
- Retries and alerts when phone-provider updates fail, health checks for each number, and a status page.
- Backup and restore drill, plus a review of slow database requests.
- Automated tests for sign-up, sending a text, answering a call and checkout.

## Phase 7 — Launch polish
- Search and share info on every public page, a speed budget, and a check that the app installs well on phones and shows notifications.
- Help pages and onboarding checklist, final legal page review, then the release publish.

## Needs your decision
Phase 2 routing changes, the call pairs on hold, live-mode pricing in Phase 4, and anything that touches texting approval or emergency calling.
