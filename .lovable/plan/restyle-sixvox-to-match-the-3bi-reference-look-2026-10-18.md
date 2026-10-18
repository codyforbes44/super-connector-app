# Restyle SixVox to match the 3BI reference look

The whole app (public site and signed-in screens) gets the look from the screenshot. Only colors, fonts and surface styling change. Layouts, words, pricing, calling and texting stay exactly as they are.

## The look
- Background: near-black navy `#030B12`, raised surfaces `#0A1620`, hairline borders in a faint teal.
- Accent: bright cyan `#06B6D4` on buttons, links, active tabs and focus rings, with dark text on cyan buttons (like "Book a consult").
- Highlight word in headlines: soft cyan-to-teal tint (like "engineering").
- Text: off-white `#E6EDF3` for headings, muted grey-blue for body text.
- Fonts: Space Grotesk for headings, Inter for body text, and a monospace font for small labels and contact lines. The spaced-out uppercase eyebrow ("ENGINEERING · AUTOMATION · SECURITY") becomes a shared style.
- Backdrop: a faint grid pattern with a soft cyan glow behind the homepage and public page heroes. Signed-in screens stay plain dark so lists stay easy to read.
- Corners: tighter, about 8px, to match the squared buttons. Secondary buttons get an outline style like "Explore services".

## Scope
- Public pages: Home, Features, How it works, Use cases, Pricing, FAQ, Contact, Legal, sign-in.
- Signed-in app: all screens pick up the new colors automatically through the shared color settings. The side rail and bottom tab bar get cyan for the active tab.
- Installed-app bar color and the offline page switch to the new navy.
- The light theme on the public site gets matching cyan accents on white.
- The logo stays the same.

## Technical notes
- Replace the color values in `:root` and `.light` in `src/styles.css`. Add the `.grid-backdrop`, `.eyebrow` and `.text-highlight` utilities. Set `--radius` to 0.5rem.
- Swap the font links in `src/routes/__root.tsx` to Space Grotesk, Inter and JetBrains Mono, and update `--font-display`, `--font-sans` and `--font-mono`.
- Use the eyebrow, highlight and grid utilities in the hero in `src/routes/index.tsx` and the shared hero in `MarketingLayout.tsx`. Add an outline style for the secondary button.
- Update the theme colors in `src/lib/theme.ts`, `manifest.webmanifest` and `offline.html`.
- No changes to server code, the database, payments or phone numbers. Nothing is published.
- Check the result at 375, 768 and 1440 widths.
