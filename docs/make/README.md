# Make.com scenarios for SixVox webhooks

Import these blueprints into Make (US zone: https://us2.make.com). Each one starts with a Custom Webhook trigger and checks the SixVox HMAC before it writes anywhere.

| File                               | Event                   | Destination                         |
| ---------------------------------- | ----------------------- | ----------------------------------- |
| `lead-captured-google-sheets.json` | `lead.captured`         | A row on a Google Sheet named Leads |
| `call-missed-email.json`           | `call.missed`           | An email alert                      |
| `voicemail-transcribed-slack.json` | `voicemail.transcribed` | A Slack message                     |

## Import

1. In Make, open your team and choose **Create a new scenario**.
2. Open the scenario menu (the three dots) and choose **Import Blueprint**.
3. Pick one of the JSON files in this folder.
4. Make will ask you to create or choose a **Custom webhook**. Create one and copy its URL.
5. In SixVox, open **Settings → Outbound webhooks**, add that URL, enable the matching event, and copy the signing secret.
6. Open the **Code** module. Set the `secret` input to that signing secret. Map `rawBody` to the webhook's raw request body (the unparsed string). Map `signature` to the `x-sixvox-signature` header and `timestamp` to the `x-sixvox-timestamp` header.
7. Reconnect the destination:
   - Google Sheets: pick the spreadsheet. The first row should be headers `name`, `email`, `company`, `message`, `phone`, `created_at`. Leave value input as USER_ENTERED.
   - Gmail: set the recipient.
   - Slack: pick the channel (the blueprint uses `#voicemail`).
8. Run the scenario once, then use **Send test event** in SixVox. A `2xx` response marks the delivery delivered. Anything else shows in the delivery log, where you can re-send it.

## Signature

The code module computes `v1=` + HMAC-SHA256 of `timestamp.rawBody` with the endpoint secret and rejects timestamps older than 300 seconds. Make often parses JSON before you see it. If you pass the parsed object instead of the raw body, key order changes and the signature will not match. Use the raw body string.

Do not commit the signing secret into the blueprint. The files ship with `REPLACE_WITH_WEBHOOK_SECRET`.
