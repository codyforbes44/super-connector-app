# Live payments hardening + a best-in-class public site

Two halves: make the now-live Stripe setup behave correctly and safely in production, and rebuild the public marketing pages so they actually sell SixVox.

## 1. Live payments best practices

- **Checkout starts from pricing.** Today every plan button on `/` and `/pricing` just sends people to signup with no memory of the plan. Carry the chosen plan and monthly/yearly cadence through signup so the user lands directly on checkout for that plan instead of re-picking it.
- **Environment safety.** The test-mode banner already hides itself in live; verify the live path end to end — client token, checkout session, webhook signature verification against the live secret, and subscription rows written with `environment = 'live'`. Any read that forgets the environment filter gets fixed.
- **Post-checkout truth.** After returning from checkout, confirm subscription state from the database (webhook-written) rather than assuming success, with a short poll and a clear "we're activating your workspace" state so a slow webhook never looks like a failed payment.
- **Billing screen completeness.** Current plan, renewal or cancellation date, trial days remaining, seats and numbers used against the plan, upgrade/downgrade, and a customer portal button that opens in a new tab. Failed payment (past due) shows a dunning banner instead of silently revoking access.
- **Commerce disclosure required for live selling.** Pricing shows that tax is calculated at checkout, currency, renewal terms and cancel-any-time; Terms gains billing, refund and cancellation clauses; footer gains a support contact route. These are what card networks and Stripe expect from a live storefront.
- No changes to prices or products — the six existing prices stay as-is.

## 2. Public site rebuild

Same Midnight Dialer palette, typography and glass surfaces — this is a content, hierarchy and craft upgrade, not a re-skin.

**Shared shell**

- Header gains a subtle scroll state, keyboard-accessible mobile menu, and a single clear primary action.
- Footer gains a compact support column and correct legal links.
- Reusable section pieces: stat band, proof band, FAQ accordion, comparison table, CTA band — so pages stop hand-rolling layout.

**Home** — restructured into: hero with a real product visual instead of a bullet list, a "replaces your…" band (separate business line, voicemail app, answering service, second phone), the six capability cards with sharper copy, an AI receptionist spotlight, a contrast section (SixVox vs. closed boxes like Talkyto, Toktiv and Mango), pricing teaser, FAQ preview, closing CTA.

**Features** — one anchored section per pillar (inbox, calling, numbers, AI receptionist, bring-your-own-number and forwarding, verification and caller insight, connected tools, roles and privacy), each written around concrete outcomes rather than feature nouns.

**Pricing** — plan cards get per-plan checkout intent, a clearly marked trial, tax and renewal disclosure, a billing FAQ block, and the comparison table restyled to work properly on mobile.

**How it works** — four distinct steps, each with what happens behind the scenes and how long it takes.

**FAQ** — expanded and grouped (billing, numbers and porting, AI receptionist, privacy and data, cancellation), rendered as an accordion with FAQPage structured data.

**Contact** — clearer intent split (sales vs. support), inline validation states, and a proper success state.

**Privacy / Terms** — refreshed with the billing, refund, cancellation and data-retention language that live payments require.

**Imagery** — generate a small set of on-brand product visuals (app hero shot, inbox and in-call vignettes) for the hero and feature sections, reused as the social preview image.

## 3. SEO, accessibility, performance

- Per-page unique title, description, `og:*`, `twitter:*`, self-referencing canonical and `og:url`; leaf-only `og:image` from the new hero asset.
- Structured data: SoftwareApplication + Organization on home, Product/Offer on pricing, FAQPage on FAQ, BreadcrumbList on deep pages.
- Single `<h1>` per page, semantic landmarks, labelled controls, AA contrast, visible focus rings, `prefers-reduced-motion` respected on all new motion.
- Images lazy-loaded with explicit dimensions; sitemap kept in sync with the route list.

## Technical notes

- Plan selection travels as validated search params (`plan`, `interval`) through `/pricing` → `/auth` → `/billing`, so checkout opens on the intended price without trusting client state.
- Checkout stays on the existing embedded flow in `src/lib/payments.functions.ts`; only the entry points and post-return verification change.
- The webhook route under `src/routes/api/public/payments/webhook.ts` keeps signature verification and gains explicit env-tagged writes plus idempotent handling of duplicate events.
- Marketing pages remain public SSR routes with no protected server functions in their loaders.

## Order of work

1. Plan-aware checkout entry points and post-checkout verification.
2. Billing screen and commerce disclosure (pricing, terms, footer).
3. Shared marketing shell and section primitives.
4. Home, features, pricing, how-it-works, FAQ, contact rebuilds.
5. Imagery, SEO metadata, structured data, accessibility pass.
