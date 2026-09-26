# Public site refresh to match the new app design

The app screens just moved to a calmer, Beside-inspired language: floating pill headers, a detached tab pod with one primary action button, flat hairline-divided lists instead of stacked glass cards, colored rounded-square icon tiles (cyan / green / violet / amber), and plain-language status text. The marketing pages still use the older look — heavy glass cards everywhere, glossy raised keys, and a hero screenshot of the previous UI.

This pass brings the public pages in line and refreshes the imagery.

## Visual changes

- **Nav and footer**: the header becomes a floating rounded pill that detaches from the page edge on scroll, matching the in-app header. Mobile menu keeps its current accessible behavior.
- **Cards and lists**: feature lists, FAQ, "how it works" steps and comparison rows drop the full glass panel per item and use one grouped container with hairline dividers, like the new Settings and Inbox lists. Feature-level glass panels stay only where a card is genuinely standalone (pricing plans, hero demo).
- **Icon tiles**: every feature/benefit bullet gets the same colored rounded-square tile used in Settings, with tones assigned by theme — cyan for calling/texting, green for answered/booked outcomes, violet for AI, amber for billing and plan.
- **Buttons**: primary CTAs keep the green call treatment; secondary buttons flatten to a soft surface instead of the raised key look.
- **Spacing and type**: section rhythm and heading sizes matched to the app's new tighter scale, keeping the existing 44px+ touch targets and mobile-first behavior.

Pages touched: home, features, how it works, pricing, FAQ, contact, auth, and the two legal pages (spacing only).

## Image assets

Generated fresh so screenshots show the current UI, not the old one:

| Asset                                | Use                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `hero-app` (replaces current)        | Home hero — phone frame showing the new Inbox list with pill header, tab pod and FAB            |
| `ai-receptionist` (replaces current) | Feature section — the new call thread with an in-thread "Answered by receptionist" summary card |
| `settings-tiles` (new)               | Features page — the grouped settings rows with colored icon tiles                               |
| `og-default` (regenerated)           | 1200x630 social card using the refreshed hero and current logo                                  |

Each is emitted at the sizes the existing responsive `srcset` pipeline expects, with explicit width/height so nothing shifts on load. The SixVox logo is unchanged.

## Notes

- Presentation only — no copy rewrites beyond labels that reference removed UI, no pricing, routing, or backend changes.
- Existing SEO metadata, canonicals, JSON-LD and the sticky mobile signup bar stay as they are; only `og:image` / `twitter:image` point at the regenerated card.
