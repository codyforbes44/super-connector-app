# Signalbox: super admin, subscriptions, and public marketing site

Three pieces: make codyforbes@gmail.com the permanent super admin, turn signup into a real subscription flow with Stripe, and build a multi-page marketing website that funnels visitors into checkout.

## 1. Super admin

- Add a `super_admin` role above owner/admin/agent.
- Grant it to codyforbes@gmail.com (that account already exists as owner) and keep it granted automatically on that verified email if the account is ever recreated.
- Super admin bypasses every access check: sees all numbers, conversations, calls, billing and the full member list, and is the only role that can manage subscribers, plans and comped accounts.
- Super admin cannot be revoked from inside the app.

## 2. Subscriptions and access

Everyone shares the platform Twilio account; subscribers are assigned numbers from your pool.

- Enable Lovable's built-in Stripe payments (test environment first, no Stripe account or keys needed from you).
- Three plans, monthly and yearly:
  - **Solo** - 1 number, 1 seat, SMS/MMS and calling, voicemail.
  - **Team** - 3 numbers, 5 seats, WhatsApp, shared inbox, AI voicemail assistant, Verify and Lookup.
  - **Scale** - 10 numbers, unlimited seats, messaging services, API console, priority alerts.
- Subscription state is stored per account and refreshed from Stripe webhooks, so it survives reloads and stays correct after cancellation or payment failure.
- New signup flow: create account, confirm email, choose a plan, Stripe checkout, land in the app. Until a subscription is active the app shows a billing screen instead of the inbox, with a "Continue to checkout" button. Super admin and any comped account are exempt.
- Plan limits enforced where they matter: number provisioning, seat invites and the gated tabs (AI assistant, API console) show an upgrade prompt on lower plans.
- Settings gains a **Billing** section: current plan, renewal date, seats and numbers used vs included, upgrade or downgrade, and a link to the Stripe customer portal for invoices and cancellation.
- Super admin gains a **Subscribers** screen: every account with plan, status, MRR and signup date, plus actions to comp, suspend or change role.

## 3. Public marketing website

Desktop-responsive and SEO-tuned, using the existing Midnight Dialer palette. The app keeps its mobile shell; marketing pages get a wide layout with a real header and footer.

Pages:

- **Home** - hero with product shot, the problem (Talkyto, Toktiv and Mango are closed boxes), six capability cards, proof band, CTAs to pricing.
- **Features** - deep sections for the inbox, calling and the TwiML app, numbers, AI voicemail assistants, Verify and Lookup, integrations (Gmail, Calendar, Maps, email alerts) and the unrestricted API console.
- **Pricing** - three plan cards with a monthly/yearly toggle, comparison table, and per-plan checkout buttons that go straight to Stripe.
- **How it works** - four steps: sign up, pick a plan, claim a number, start messaging.
- **FAQ** - billing, number porting, WhatsApp approval, data ownership, cancellation.
- **Contact** - form that emails you through the existing Resend sender on bookme.bet and logs the enquiry.
- **Privacy** and **Terms** - wired into the footer.

Every page gets its own title, description and social preview tags; home and pricing also get structured data so search engines can read the plans.

## Technical notes

- New enum value `super_admin` on `app_role`; `is_admin()` and `can_see_number()` extended to treat it as all-access. `handle_new_user()` stops auto-granting `owner` and grants `agent` instead, with a separate verified-email trigger granting `super_admin` to codyforbes@gmail.com.
- New tables: `subscriptions` (user, stripe customer and subscription id, plan, status, period end, seats), `plan_limits` (seeded plan definitions), `leads` (contact form). All with GRANTs, RLS scoped to the owning user plus super-admin read, and service-role access for webhooks.
- Stripe: enable built-in payments, create the three plans with tax codes, checkout through a server function, and a webhook route under `src/routes/api/public/` that verifies the signature before writing subscription state.
- Access gating: a `useSubscription` hook plus a check in `_authenticated/route.tsx` that redirects to `/billing` when there is no active subscription and the user is not super admin or comped.
- Marketing pages are top-level public routes (`/features`, `/pricing`, `/how-it-works`, `/faq`, `/contact`, `/privacy`, `/terms`) sharing a `MarketingLayout`, SSR on, no auth gate, no protected server functions in their loaders.
- The existing `/` landing page is rebuilt as the marketing home rather than duplicated.

## Order of work

1. Migration: super_admin role, subscription/plan/lead tables, updated role functions.
2. Enable Stripe payments and create the three plans.
3. Checkout, webhook, subscription state, billing screen, gating.
4. Subscribers admin screen.
5. Marketing site pages, shared layout, SEO, contact form wiring.
