# Stripe billing package cleanup and repricing

## Catalog state today

Six products exist. Three are live: SixVox Solo, Team and Scale, each with a monthly and a yearly price, all classified as SaaS business-use. Three are dead leftovers from the Signalbox rename — Solo, Team and Scale with no price attached. They cannot be bought, but they sit in the catalog and sync to live on every publish.

Archiving those three is a dashboard action on your side: product IDs are permanent sync keys, so they cannot be renamed away or deleted from here.

## New pricing

| Plan | Monthly | Yearly (2 months free) |
| --- | --- | --- |
| Solo | $19 | $190 |
| Team | $59 | $590 |
| Scale | $129 | $1,290 |

New amounts are published against the existing price IDs (`solo_monthly`, `solo_yearly`, and so on) so the lookup keys carry over and current subscribers keep resolving to the right plan. No new product or price IDs are minted.

Marketing copy, plan cards, the comparison table and page titles all update to the new numbers, including the "from $29/mo" title on the pricing page.

## Free trial

A 14-day free trial on every plan, no card charged until it ends:

- Checkout starts the subscription in trial, so the first invoice lands after day 14.
- The trial end date is written to the subscription record from the webhook, so the existing trial banner counts down accurately.
- Billing screen shows "Trial — X days left, first charge on <date>" with the amount that will be charged.
- Pricing and plan cards state the trial and that cancelling before it ends costs nothing.
- Existing subscribers and comped accounts are unaffected; the trial only applies to a first-time subscription.

## Compliance handling at checkout

Checkout already sends compliance handling, so this is a verification and disclosure pass rather than new plumbing:

- Confirm the live checkout session carries it and that no conflicting tax parameters are sent alongside it.
- Confirm all three live products keep their SaaS tax code, which is what makes them eligible.
- Add the disclosure customers should see: tax calculated at checkout, currency, renewal terms, cancel any time, and a note that the card statement shows the payment-network descriptor.

## Tier gating audit for live safety

Plan entitlements must resolve from the human-readable plan code, never from environment-specific Stripe identifiers, so nothing silently breaks between test and live:

- Confirm the webhook resolves plan code from the price lookup key, with the legacy metadata fallback, and always tags the row with the correct environment.
- Confirm every subscription read filters by environment, including the realtime refetch path.
- Confirm seat and number limits, and the gated areas (AI receptionist, API console, messaging services), all key off plan code.
- Confirm past-due shows a payment-retry banner instead of revoking access, and that a cancelled plan keeps access until the period ends.

## Technical notes

- Repricing uses `create_price` against the existing price IDs; the replaced price is superseded and the lookup key transfers automatically.
- Plan amounts and the feature matrix live in `src/lib/plans.ts`; that stays the single source for all display copy.
- The trial is set via `subscription_data.trial_period_days` on the checkout session in `src/lib/payments.functions.ts`, alongside the existing compliance-handling flag.
- Trial state flows through the existing `trial_ends_at` column and `src/components/TrialBanner.tsx`.

## Order of work

1. Publish the new amounts on the existing six price IDs.
2. Update plan data and every public surface that quotes a price.
3. Add the 14-day trial to checkout, the webhook write and the billing screen.
4. Compliance verification and commerce disclosure copy.
5. Tier gating and environment-filter audit.

## What you do

Archive the three Signalbox products in the Stripe test dashboard.
