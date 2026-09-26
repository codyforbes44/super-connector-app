# SixVox mobile-first experience refactor

## Goal
Make every public and signed-in **web page** feel like one dependable phone-first product for a trades owner who needs to answer calls, reply to customers, and manage a business line quickly. Give tablet and desktop the extra space they deserve without stretching phone layouts. Preserve the existing Slate & Electric Blue identity, current copy and prices, permissions, and working service behavior.

## What the review found
- The existing foundation already has a phone tab bar, shared screen primitives, a split inbox, mobile pricing comparisons, and accessible public navigation. Improve these rather than replace them.
- The inbox is the only signed-in page with a true list/detail layout on wider screens. The shell and screen primitives also impose overlapping width limits, so other screens cannot use available space consistently.
- Some older rounded/glass/glow treatments remain in public and signed-in presentation despite the newer flat visual direction. Long settings and utility pages use different local spacing, headers, and form patterns.
- Public pages have strong route-specific content and metadata; this is an experience pass, not a rewrite of product claims or account flows.

## Refactor plan

1. **Shared framework first.** Align the public and signed-in typography, semantic color tokens, spacing, focus treatment, buttons, fields, empty/error/loading states, and safe-area behavior. Keep the bottom tabs on phones and narrow tablets; make wider-screen navigation and content widths intentional. Add a reusable, accessible list/detail pattern for pages that actually have selectable records. Remove leftover visual-only glass/glow styling where it conflicts with the approved flat direction.
2. **Daily work, highest priority.** Refine Inbox and conversations, Calls and in-call surfaces, Contacts, and Numbers. On phones, keep one clear task per screen, thumb-reachable primary actions, readable status, and fast back navigation. On larger screens, use list/detail panes for conversations and suitable call/contact/number detail flows, with sensible empty selections. Preserve real call and message state; never manufacture summaries or hide errors behind indefinite loading.
3. **Setup and management.** Bring Receptionist, A2P/Trust, Tools, Connectors, Integrations, Insights, eSIM, Settings, Advanced, Billing, Welcome, and other signed-in user pages onto the same headers, sections, forms, notices, and feedback patterns. Use compact grouped rows on phones and appropriately wider layouts on tablets/desktops. Make long forms and tables usable with touch and keyboard; preserve role-gated admin pages and existing actions.
4. **Public journey.** Polish Home, trade/use-case pages, Features, Compare, How it works, Pricing, FAQ, Contact, Auth, legal, and developer pages as one coherent journey. Make the actual SixVox calling/receptionist experience visible immediately; keep copy, plan facts, disclosures, links, and route-specific sharing metadata accurate. Use restrained full-width sections, clear conversion paths, and mobile-friendly comparisons rather than nested decorative cards.
5. **Cross-device and accessibility pass.** Audit every page at 375, 430, 768, 1024, and 1440px plus a short landscape viewport. Check no clipped text or unintended horizontal scrolling, 44px touch targets, keyboard/focus and screen-reader labels, dark/light contrast where supported, reduced motion, safe areas, realistic loading/empty/error states, and navigation among pages. Exercise the signed-in primary workflows with a real session when available. Fix regressions found during that pass.

## Technical boundaries
- Scope is the TanStack web experience in `src/routes/`, `src/components/`, and `src/styles.css`; the separate Expo native app is not part of this web-page refactor.
- Prefer existing semantic tokens and design-system controls. Keep route-specific `head()` metadata intact or add it where a content page lacks it; do not move page images into the global head.
- This is presentation and interaction work: no database migrations, auth-policy changes, Twilio/ElevenLabs/Stripe/Resend mutations, number reassignment, price changes, or deployment. Only adjust client-side data presentation where required for honest, usable states.
- Implement in the order above, checking each page group before continuing. Nothing is published automatically.
