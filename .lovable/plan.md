# Change support phone 580-238-4777 to 580-217-8444

Replace every occurrence (display text, `tel:`/`sms:` links, structured data) with 580-217-8444 / +15802178444:

- `src/components/MarketingLayout.tsx` — footer call/text link
- `src/routes/contact.tsx` — Call and Text buttons
- `src/routes/legal/terms.tsx` — contact line
- `src/lib/seo.ts` — Organization telephone `+1-580-217-8444`
- `src/lib/concierge/knowledge.ts` — concierge support text
- `src/components/line/BringYourOwnNumber.tsx` — input placeholder
- `src/lib/elevenlabs-agent-sync.test.ts` — test fixture number

Then re-run the search to confirm zero remaining matches and run the affected test.

Note: the live website concierge only learns the new number after a "Sync agent" run; the website changes go live when you publish.
