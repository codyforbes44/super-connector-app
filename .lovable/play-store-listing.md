# SixVox Google Play Store listing

Prepared for package `app.sixvox` and host `https://sixvox.3bi.io`.

## Store listing text

### Title (max 30 characters)

SixVox: Business Phone AI

### Short description (max 80 characters)

One business number for calls, texts, voicemail and AI replies.

### Full description

SixVox gives your business a single professional phone number that works on every device. Make and receive calls, send texts, manage your shared inbox, and let an AI receptionist handle calls when you're busy.

Built for founders, small teams and service businesses that want a phone system without the hardware. SixVox runs in your browser and as an installable app, so your business line travels with you.

WHAT YOU CAN DO

• Call and text from your business number using your mobile device or desktop
• Shared inbox keeps the whole team on the same thread
• AI receptionist answers missed calls, takes messages, and transcribes voicemails
• Push notifications alert you to new messages and missed calls
• Bring your own number or choose a new one
• Voicemail, caller ID, and call history in one place
• Offline support so the app shell stays ready even when connectivity drops

SixVox is designed for mobile-first use: install it from Google Play, sign in, and your business phone is live in minutes.

## Category and tags

- Primary category: Business
- Secondary category: Communication
- Tags: business phone, VoIP, SMS, AI receptionist, virtual phone, business texting, voicemail, calls

## Content rating

- Communication app with phone calls and SMS
- Data shared: phone number, email, messages, call metadata, push tokens
- Requires: Contacts permission for phone dialing; Microphone permission for calls; Notifications permission for alerts
- Expected rating: PEGI 3 / ESRB Everyone

## Data safety disclosures

| Data type                    | Collected | Shared | Purpose                                     |
| ---------------------------- | --------- | ------ | ------------------------------------------- |
| Email address                | Yes       | No     | Account authentication and billing          |
| Phone number                 | Yes       | Yes*   | Core telephony service; carrier/SMS routing |
| Call and SMS metadata        | Yes       | Yes*   | Voice/SMS delivery via telephony providers  |
| Voice messages / transcripts | Yes       | No     | AI voicemail and user inbox                 |
| Push notification token      | Yes       | No     | Background alerts                           |
| Device ID                    | No        | No     | —                                           |
| Location                     | No        | No     | —                                           |

*Shared only with underlying telephony infrastructure providers required to deliver calls and messages. Not sold or used for advertising.

## Required Play Console policies

1. Privacy policy: `https://sixvox.3bi.io/legal/privacy`
2. Terms of service: `https://sixvox.3bi.io/legal/terms`
3. Login credentials for review: Provide a test account in Play Console (use codyforbes@gmail.com as the owner test account).
4. Core functionality declaration: The app is a phone/SMS communication service; telephony is the primary purpose.

## Screenshots

Use the existing generated assets:

- Phone: `public/screenshot-mobile.png` (1080x1920)
- Tablet / desktop preview: `public/screenshot-wide.png` (1920x1080)

For the Play Store, crop or upload the phone screenshot as the primary phone screenshot and the wide screenshot as a 7-inch / 10-inch tablet screenshot if desired.

## Feature graphic

Source file: `src/assets/play-feature-graphic.png` (1024x500)

A dark navy feature graphic with the SixVox mark, a neon cyan glow, and the tagline: "Your business number, everywhere."

## Build notes

- TWA wrapper uses Bubblewrap against `twa-manifest.json`
- Digital Asset Links file: `public/.well-known/assetlinks.json`
- Replace the SHA-256 placeholder in `assetlinks.json` with the Play Console app signing key fingerprint before publishing the web project
- After updating `assetlinks.json`, publish the web project so `https://sixvox.3bi.io/.well-known/assetlinks.json` is live
- Build the AAB with `npx @bubblewrap/cli build --skipPwaValidation` (or run `init` first if you need to regenerate the manifest from the web app manifest)
