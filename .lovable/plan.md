# SixVox Play Console deployment — wait for AAB build

You are currently running Bubblewrap and it is downloading the JDK. The web side is already ready: `sixvox.3bi.io` serves the manifest, icons, and Digital Asset Links file.

## Plan

1. Wait for the current Bubblewrap `build` command to finish downloading the JDK and generating the Android App Bundle.
2. If the build succeeds and produces `app.sixvox.aab`, upload that file to the Play Console internal testing release you already created.
3. If the build fails or pauses, paste the full error output here and I will troubleshoot the next step.
4. After upload, continue in Play Console: add release notes, confirm the release, add internal testers, and run the internal test before promoting to production.
5. Run a fresh security scan before broad sharing or production promotion.

## Expected next action from you

Reply once `app.sixvox.aab` is generated (or if an error appears), and I will guide the Play Console upload and verification steps.
