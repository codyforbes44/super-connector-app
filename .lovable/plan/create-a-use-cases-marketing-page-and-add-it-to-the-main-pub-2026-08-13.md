Create a `/use-cases` marketing page and add it to the main public navigation.

What we will build

- A new public route at `/use-cases` rendered with the existing `MarketingLayout` and shared components (`Section`, `Eyebrow`, `Reveal`, `FeatureGroup`, `IconTile`, `CtaBand`).
- The page will present four top use cases that benefit from SixVox, each as a concrete persona + problem + outcome card.
- Add "Use Cases" to the main site navigation (`MarketingLayout` `NAV` array) and footer "Product" column.
- Route-specific SEO metadata using the existing `pageHead` helper.

Page structure

1. Hero section: short punchy headline, subheadline, and primary CTA to `/auth` signup.
2. Four use case cards in a responsive grid:
   - "Solopreneurs & side businesses" — separate business and personal life with a second line, business voicemail, and transcripts.
   - "Trades & service professionals" — AI receptionist answers while on the job, qualifies callers, and books appointments.
   - "Small teams & agencies" — shared inbox with real-time assignment, internal notes, and role-based access.
   - "Remote & mobile workers" — keep your existing number via forwarding, global eSIM data, and calls/texts from anywhere.
3. Supporting proof points (2-3 stats or outcomes).
4. CTA band to start the free trial.

Files to create/modify

- `src/routes/use-cases.tsx` — new route file.
- `src/components/MarketingLayout.tsx` — insert "Use Cases" into the `NAV` array and footer links.
- `src/routeTree.gen.ts` will auto-regenerate from the new route file; no manual edits.

Design & content constraints

- Reuse the Graphite & Amber design system (no new colors, no glass panels unless using existing `glass-panel` utility).
- Keep language benefit-driven and concrete, not feature-list style.
- All CTAs lead to `/auth?mode=signup` or `/pricing`.
- SEO: unique title, description, og:title, og:description, og:type, twitter:card.

No backend changes required; no auth or data changes.
