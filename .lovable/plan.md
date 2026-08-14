# Make SMS fully working on the approved A2P number

Your Sole Proprietor campaign is approved (campaign CNH3AMA, status VERIFIED) and **+1 (580) 745-0045 is the only number attached to it**. Live checks show the app still has real gaps, so texting is not yet reliable end to end.

## What I verified

- Inbound is wired correctly: the number's SMS webhook points at the production endpoint, and the messaging service is set to defer inbound to the number, so replies reach the inbox.
- Delivery status callbacks are wired on both the number and the messaging service.
- Outbound is the problem. Every recent outbound attempt failed with carrier error 30034 ("unregistered number"), because the app sends **from the raw phone number** instead of through the approved messaging service, and because most test sends went from (817) 533-8844 and (580) 217-8444, which are not in the approved campaign at all.
- Scheduled sends are currently impossible: Twilio requires a messaging service for scheduling, and the app strips it out when sending from a number.

## What to change

1. **Send through the approved messaging service by default.** Every outbound SMS path — new message, inbox reply, and the AI assistant's "text them back" action — routes through the A2P messaging service tied to the sending number, instead of the bare number. WhatsApp keeps its current path.
2. **Register which numbers are cleared to text.** Store each number's messaging service and campaign status, refreshed from Twilio, so the app knows (580) 745-0045 is approved and the other two are not.
3. **Block bad sends before they burn a message.** If someone tries to text from a number with no approved campaign, show a clear message ("This number isn't approved for texting yet — use (580) 745-0045") instead of a silent undelivered message minutes later.
4. **Fix scheduled sends** by always attaching the messaging service when a send time is chosen.
5. **Handle opt-outs properly.** Detect STOP/UNSTOP/HELP replies, flag the conversation as opted out, hide the reply box with an explanation, and translate Twilio's opt-out rejection into plain language.
6. **Show failures where you'll see them.** Failed and undelivered texts get a visible red status in the conversation with a human explanation of the carrier error, instead of looking like they sent fine.
7. **Add a texting readiness card** on the A2P screen showing live brand, campaign, service and sender status pulled from Twilio, with a "recheck" action.

## Verification

After the changes, send a real test text from (580) 745-0045 to your mobile, confirm it reaches "delivered" in the app, reply from the phone, and confirm the reply lands in the inbox with a push notification. Then test STOP and HELP behaviour on the same thread.

## Technical notes

- `sendMessage` in `src/lib/twilio-ops.server.ts` gains automatic messaging-service resolution per sending number, keeps `From` only for WhatsApp, and always sets `MessagingServiceSid` when `SendAt` is present.
- New columns on `phone_numbers` for messaging service sid and campaign status, populated by a sync that reads `/v1/Services`, its sender pool, and `Compliance/Usa2p`.
- `messages` gets an opt-out aware error mapping; `src/routes/api/public/twilio/sms.ts` marks conversations opted out on STOP and clears on START/UNSTOP.
- Error codes mapped to copy: 30034, 21610, 21408, 30007, 21723.
