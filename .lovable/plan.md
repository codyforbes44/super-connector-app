# New homepage share image

Replace the homepage's link-preview image (shown when the site is shared on iMessage, WhatsApp, LinkedIn, X, Slack, Facebook) with a polished, high-impact version in the current 3BI navy + cyan look.

## What it will look like (1200 x 630)
- Deep navy background with the faint grid and a soft cyan glow, matching the homepage top section.
- Left: the 3BI badge logo, large and crisp.
- Wordmark "SixVox by 3ʙɪ" (small-caps suffix, same as the site header).
- Headline: "The business line that picks up when you can't." with "picks up" in cyan.
- Small spaced-uppercase label above the headline: "BUSINESS PHONE · SHARED INBOX · AI RECEPTIONIST".
- Right side: a simple phone-screen card showing an incoming call ringing, with an "AI answered" chip, to make the product obvious at a glance.
- Bottom strip: "From $29/mo" and "sixvox.3bi.io".
- All text kept inside the center safe area so nothing gets cropped in square previews (WhatsApp, Slack thumbnails), and large enough to read at small sizes.

## Steps
1. Draw the image precisely (exact fonts, colors and logo, not AI-generated, so text is sharp and correct), saved as a fresh file name so social sites don't show the old cached version.
2. Keep it small (well under 300 KB) so every platform shows it.
3. Point the homepage's share tags (og:image and twitter:image, plus width/height and alt text) to the new file.
4. Check it at full size and as small square/rectangle thumbnails, and confirm the homepage serves it.

## Not changing
Other pages' share images, page text, prices, layouts. Nothing published — after you publish, platforms may need a refresh via their link-preview debugger.

## Technical details
- Render with PIL from /tmp/zbi-pad.svg mark + Space Grotesk / Inter / JetBrains Mono; output public/og-home-2026-10.jpg (JPEG q≈88).
- Update src/routes/index.tsx head(): og:image, twitter:image, og:image:width 1200, og:image:height 630, og:image:alt, twitter:card summary_large_image.
- Add the generator to scripts/regen-brand.py so it stays reproducible.
