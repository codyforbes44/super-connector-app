# Homepage hero: make it the best-in-class first impression

## What's wrong today

Captured the live hero at 1280px. It reads well, but it under-sells the product:

- The hero band is visually flat and light — the app itself is a graphite + amber product, so the first screen doesn't look like the thing you're buying.
- The phone demo's "ring" scene is mostly empty space; the panel is tall with a large dead zone above and below the caller card.
- Scenario tabs, scrubber and caption sit *outside* the device as loose UI, so the eye lands on controls instead of the story.
- No proof: no channel badges, no "what it replaces at a glance", no trust row above the fold.
- Headline/subhead/CTAs are strong but the value ladder stops there — nothing tells you *what happens next* while the demo plays.

## The rebuild

### 1. A hero band that looks like the app
- Wrap the hero in a graphite band (dark surface even in light mode) with the amber signal glow, hairline top/bottom edges, and a faint concentric "signal ring" motif behind the phone — pure CSS/SVG, no image weight.
- Amber gradient on the headline accent, brighter contrast for the eyebrow pill and CTAs so the primary button is unmistakably the one action.

### 2. Tighten the copy ladder
- Keep the headline promise; sharpen the subhead to one line plus a second line of concrete outcome.
- Replace the four flat checks with a compact trust row: no card · keep your number · live in a minute · cancel any time, with amber check marks on the dark band.
- Add a single line of "who it's for" under the CTAs linking to /use-cases (trades, solo, small teams, remote), so the hero connects to the use-case page.

### 3. Make the demo the hero, not a widget
- Move the scenario tabs to a small segmented pill *docked to the top of the device frame* and the play/scrub controls to a slim bar docked at the bottom edge — one object instead of three.
- Fill the ring scene: live waveform under the caller card, "SixVox is answering" status chip, and an animated timer so the frame never looks idle.
- Add 2-3 floating glass call-out chips anchored around the phone that swap with the scene ("AI answered in 1.2s", "Booked Tue 9:30am", "Summary in your inbox") — they carry the narrative for people who never watch the whole loop.
- Reduce the device's fixed height and let scenes flow, killing the dead space.

### 4. Above-the-fold proof
- Channel strip directly under the CTAs: Calls · SMS · MMS · WhatsApp · Voicemail · AI receptionist as small amber-tinted icon chips.
- Pull the stat band up tight against the hero and restyle it as part of the dark band (14 days · <1 min · 3 channels · 24/7).

### 5. Mobile-first
- On phones: eyebrow, headline, subhead, primary CTA, then the device, then trust row — CTA above the fold on a 390px screen.
- Full-width device, controls sized for thumbs, reduced-motion honoured (freeze on the outcome frame, as today).

## Technical notes

- `src/routes/index.tsx` — hero section markup, new trust/channel strips, dark band wrapper, stat band placement.
- `src/components/marketing/LivePhoneDemo.tsx` — dock tabs/controls into the frame, add waveform + status chip to the ring scene, add scene-synced floating call-out chips, trim fixed heights.
- New tokens/utilities in `src/styles.css` only if needed (signal-ring motif, dark hero band surface); no hardcoded colours, all semantic tokens.
- No backend, routing, pricing or content-model changes. SEO head, JSON-LD and existing sections below the hero stay as they are.
