# Release work that needs no owner decision

Five steps, in this order. After each one: publish, check the live version and report what shipped and the test results.

## 1. Security fix (Phase 3, this item only)
- Only signed-in admins and the app itself can read the plan limits table. Pricing pages keep their numbers because they read them from the app's own price list. A new sign-up can no longer list every plan's limits.
- Test: a regular user's read is blocked and a super admin's still works.

## 2. Page review on phones and computers (Phase 5)
- Pages: Numbers, Calls, A2P, Welcome, eSIM, Contacts, Settings, Tools, Platform admin, and every public page. Checked at phone, tablet and desktop sizes.
- Accessibility: buttons at least 44px to tap, text contrast, screen-reader labels on icon buttons, keyboard focus, one main area per page.
- Every page gets clear empty, loading and error messages with a "Try again" button. Loading gives up after a time limit, so no endless spinners.
- A screenshot pass of each page in both themes.

## 3. Reliability and monitoring (Phase 6)
- Failed updates to the phone carrier or AI voice service are queued, retried with growing waits, and show up as alerts in Platform admin.
- Per-number health check: whether it's set up to send calls and texts to SixVox, recent errors, last time it was used. This only reads settings and never changes routing.
- A public status page plus a health check address.
- Backup and restore drill: back up a copy of the important tables, restore it into a scratch copy, compare record counts, and write down the steps.
- Review slow database requests and add indexes where needed.
- Automated tests for sign-up, sending a text, answering a call and checkout. These use stand-in services, so no real calls, texts or charges happen.

## 4. Plan limits and eSIM checkout (Phase 4, app side only)
- Enforce phone lines, seats and AI calls on the server when someone adds a number, invites a member or makes an AI call. When a team hits a limit, show a clear upgrade prompt.
- Tests for each limit, using the current plan values.
- Walk through eSIM checkout end to end in test mode. Live prices stay where they are.

## 5. Launch polish (Phase 7, partial)
- Search and share info on every public page, a speed budget (page size and load timing checks), and a check that the app installs on phones and shows notifications.
- Help pages and a step-by-step setup checklist for new users.
- Held for you: final legal review and the release publish.

## Not started and not queued
- Routing changes for (580) 238-4777 or (214) 978-6445
- The 97 call pairs on hold
- Self-forwarding changes
- Live-mode pricing
- A2P submissions
- E911 changes
- iMessage sending

## Technical notes
- Security fix: change the access rules on the plan limits table so only super admins can read it; server code reads it with full access.
- Version marker updated each phase (phase3-security, phase5-ux, phase6-reliability, phase4-limits, phase7-polish).
- roadmap.md gets these five tasks when work begins.
