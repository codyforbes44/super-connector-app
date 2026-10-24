# Super Admin Panel + App Declutter

## Goal
Pull every platform-level (super admin) control out of everyday Settings into one dedicated **Admin** area, then simplify the customer-facing app so each page has one clear job and works great on phones first.

## What exists today
- Super admin items are mixed into Settings: Subscribers, Website concierge, plus Webhook Errors inside Advanced, and per-user detail at `/admin/$userId`.
- Settings also holds owner tools (Caller trust, Advanced), team, outbound webhooks, AI receptionist, Connectors, Integrations, Billing — one long list.
- Bottom nav: Inbox, Calls, Numbers, Tools, Settings. Tools is a grab-bag (Calendar, eSIM, Insights, Console, etc.).

## Part 1 — New Super Admin panel (`/admin`)
Visible only to super admins (checked on the server, not just hidden in the menu). Own layout with tabs (top tabs on phone, side rail on desktop):

1. **Overview** — accounts, active/trialing/comped/suspended counts, MRR from plans, numbers in use, calls/texts last 24h/7d, open webhook errors, A2P status summary.
2. **Accounts** — searchable list (replaces Subscribers); detail page (existing `/admin/$userId` moved in): plan, comp/suspend, workspace + members, roles, assigned numbers, recent activity.
3. **Workspaces** — all teams, owner, seats, numbers; assign/unassign a number to a workspace (with confirm).
4. **Numbers fleet** — every Twilio number, owner workspace, wiring state (read-only check), texting approval; protected numbers clearly flagged and locked.
5. **Health & errors** — webhook errors (incl. unattributed ones), failed deliveries, recent server error log, carrier/A2P issues.
6. **AI & concierge** — concierge conversations/leads, "Sync agent" action, allowed agent list (read-only).
7. **Billing ops** — plan prices as configured, Stripe link status, comped list.
8. **Audit log** — every admin action recorded (who, what, when) in a new table.

Old routes (`/subscribers`, `/concierge`, admin bits of `/advanced`) redirect into `/admin`.

## Part 2 — Declutter the customer app
- **Settings** becomes short groups: Profile, Team, Phone & AI (receptionist, connectors), Apps (integrations, webhooks), Billing, Owner tools. No admin items.
- **Tools** reorganized into clear cards: Calendar, Contacts, Insights, eSIM, Caller trust; developer stuff (Console, routing endpoints) moves to an "Advanced" section.
- Bottom nav stays 5 items; super admins get an "Admin" entry in the More/Settings header, not in the bottom bar.

## Part 3 — Mobile-first page pass (every page)
Apply the shared page frame and sizing to all signed-in and public pages:
- Single column on phones, 2–3 columns on tablet/desktop, no sideways scrolling at 360px.
- Sticky page header with title + one primary action; 44px tap targets; readable type.
- Consistent empty, loading (no endless spinners) and error states.
- Long pages (Numbers, Calls, A2P, Welcome, eSIM, Contacts) split into tabs or collapsible sections.
- Public pages: tighten hero/sections, consistent CTAs, check headers/meta per page.
- Verify each page at phone (390), tablet (820) and desktop (1280) widths with screenshots.

## Order of work
1. Admin panel shell, access check, Overview + Accounts + Health (moves existing features).
2. Workspaces, Numbers fleet, AI, Billing ops, Audit log.
3. Settings/Tools/nav cleanup + redirects.
4. Page-by-page mobile pass, signed-in pages first, then public.

## Guardrails
- No Twilio number setting changes, no Stripe price changes, no publishing.
- Protected EL-direct number stays excluded from any write action.
- Existing tests kept passing; add tests for admin-only access and audit logging.

## Technical details
- Routes: `src/routes/_authenticated/admin/route.tsx` (layout + client role gate) with children `index`, `accounts`, `accounts.$userId`, `workspaces`, `numbers`, `health`, `ai`, `billing`, `audit`. Remove `admin.$userId.tsx`, `subscribers.tsx`, `concierge.tsx` after moving; add redirect routes for old paths.
- Server: `src/lib/admin.functions.ts` with `requireSupabaseAuth` + `has_role(uid,'super_admin')` check in every handler; privileged reads via `client.server` imported inside handlers after the check.
- DB migration: `admin_audit_log` (actor_id, action, target_type, target_id, details jsonb, created_at) with grants, RLS select for super admins only, inserts via server.
- Reuse `src/components/screen.tsx` primitives and `AppShell.tsx`; add `AdminShell` tabs component.
