# Public site polish — mobile-first best practices

The public pages already share the Midnight Dialer layout, one H1 each, alt text on every image, a skip link, and no horizontal scrolling at 390px. A live audit on a phone viewport surfaced a specific list of real gaps. This pass fixes those rather than restyling what already works.

## What's wrong today (measured, not assumed)

- **Pricing comparison table overflows the phone.** It's a `min-w-[34rem]` table in a horizontal scroller, so on a 390px screen most columns sit off-screen with no visual hint to swipe.
- **Tap targets below the 44px minimum.** Contact form inputs render 36px tall, the pricing Monthly/Yearly toggle 32px, the auth "No account yet? Start free" switch 20px, and the header/footer nav links 40px.
- **The auth page has no `main` landmark**, unlike every other public page.
- **Decorative glow orbs extend past the right edge** of the layout, relying on a single ancestor to clip them.
- **No mobile conversion anchor.** On a long phone scroll the only "Start free trial" buttons are at the very top and very bottom of each page.
- **Hero image weight.** The homepage hero loads eagerly at full size on phones with no width hints.

## What changes

### Pricing

Replace the wide comparison table on phones with a stacked per-plan card list (each feature as a labelled row), keeping the real table from `md:` up. Grow the billing toggle to a 44px segmented control.

### Contact

Inputs, textarea and select grow to a 48px touch height with 16px text so iOS never zooms on focus. Errors get `aria-invalid` plus `aria-describedby` wired to the message, and the form announces its result through a polite live region rather than only a toast.

### Auth

Wrap the card in `main`, give the sign-in/sign-up switch a 44px target, add an autocomplete set (`email`, `current-password`, `new-password`) so password managers work, and match the marketing gradient's safe-area padding.

### Shared marketing shell

- Header and footer links get 44px minimum touch height without changing their visual size.
- Glow orbs get clipped explicitly so they can never affect layout width.
- Add a compact sticky bottom CTA bar on phones only (appears after the hero scrolls past, respects the safe-area inset, hides on `/contact` and `/auth`), so the trial CTA is always one tap away.
- Section rhythm tightened for small screens: consistent vertical spacing scale and `text-balance` on headings so titles break cleanly at 375px.

### Performance and metadata

- Hero image gets explicit width/height plus `fetchpriority="high"`; all below-the-fold imagery stays lazy with `decoding="async"`.
- Preconnect the font origins earlier and confirm each public route keeps its self-referencing canonical, `og:url` and unique title/description (already true — verified, not re-derived).

## Files

- `src/components/MarketingLayout.tsx` — touch targets, orb clipping, sticky mobile CTA, spacing scale.
- `src/routes/pricing.tsx` — stacked mobile comparison, larger billing toggle.
- `src/routes/contact.tsx` — input sizing, ARIA error wiring, live region.
- `src/routes/auth.tsx` — `main` landmark, autocomplete, touch targets.
- `src/routes/index.tsx` — hero image hints, heading balance.
- `src/routes/features.tsx`, `how-it-works.tsx`, `faq.tsx`, `legal/*` — spacing and heading consistency only.

## Verification

Re-run the phone-viewport audit across all seven public routes and confirm: zero elements wider than the viewport, no interactive element under 44px, exactly one `main` and one `h1` per page, and no console errors.
