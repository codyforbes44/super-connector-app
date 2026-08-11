# Wire +1 580-745-0045 into messaging service MGa587e0…f708c3

This is an operational change on the Twilio side, not new app code. The app already has everything needed: the Messaging Services screen under Numbers can add a number to a service pool, and the composer can send through a service instead of a single number.

## What happens

1. Look up the Twilio phone number record for +1 580-745-0045 to get its number SID.
2. Add that SID to the pool of messaging service `MGa587e06b182e721862d7017660f708c3`.
3. Confirm the service's inbound webhook points back to SixVox so replies still land in the inbox (the service should route inbound to the app's SMS endpoint, and the number should not be left with a stale app SID override).
4. Re-read the pool and the A2P campaign status for that service, and report both back: which numbers are in the pool, and whether the campaign is approved, pending, or rejected.

## Notes

- If the service's campaign is not yet approved, US messages stay blocked by carriers even after the number is in the pool. The A2P screen shows that state, and I'll say plainly which stage it's at after wiring.
- Sending through the service is selected per message in the composer's sender picker; adding the number to the pool does not by itself change the default sender.
- No database schema changes and no UI changes are part of this.
