# Web-server Codex prompt: Jukebox guest locale and branding

Work only on the server-owned source serving `https://radiotedu.com/juke-local/controller/`. Do not rebuild the mobile app on the web server. Fetch the correct source repository first, preserve newer/unrelated work, read its AGENTS.md/GEMINI.md, and make timestamped backups before edits or deployment. Never delete files, reset work, alter real accounts/Gold balances or run destructive database commands.

Reproduced September 13, 2026 in production-signed Android source b63037c and independently in fresh desktop Chrome:

- Requested URL `https://radiotedu.com/juke-local/controller/?lang=en`, fresh browser locale `en-US`, HTTP 200. Final URL retains `lang=en`.
- Visible guest page still says `Kampüs ritmini seç…`, `HIZLI BAŞLA`, `ÜYE GİRİŞİ`, `KAYIT OL`.
- Brand is `RADİOTEDU` with dotted capital İ. Required brand is `RadioTEDU` or `RADIOTEDU` with Latin I, regardless of locale.
- Observed live entry assets: `assets/index-DNLqxdK7.js`, `assets/index-BZLk3l07.css` under `/juke-local/controller/`. Locate the actual source/build owner; do not patch generated bundles blindly or deploy the older recovery archive.

The mobile client already sends the normalized language parameter in `mobile/src/services/jukeLocalWebViewService.ts`; `JukeLocalWebViewScreen.tsx` passes the active resolved app language. This is not fixed by relabeling the native tab or hiding web content with injected CSS.

Required work:

1. Trace locale parsing, saved guest preferences and initialization order. Honor the explicit supported `lang` parameter on entry for `en`, `tr`, `ru`, `ar`, `de`, `fr`, with documented fallback behavior. Keep the choice consistent through guest entry, sign-in/registration screens and the controller. Never manufacture a session or bypass login for testing.
2. Translate the user-facing guest entry controls and messages. Preserve the Jukebox account/device/session/queue/Gold contracts; no API or database migration is requested.
3. Correct the source brand spelling and locale-sensitive capitalization. Check both actual text and CSS text-transform effects. Preserve intentional mixed-case RadioTEDU names.
4. Add focused locale/brand regression coverage in the owning frontend and test desktop plus Android WebView dimensions. Capture screenshots for the six entry languages. Exercise guest navigation only; do not submit registration, login, queue actions, emails or rewards against real users for this task.
5. Build and deploy only the changed frontend through the established release process, with backup and rollback instructions. Verify the live `?lang=en` page in a fresh English browser and the other supported languages. Push source as the authorized account and return source commit, deployed release path, asset hashes, checks and screenshots to the APK build computer. Do not publish a mobile GitHub/Play release from this task.

Evidence: [fresh-browser screenshot](images/release-1.3.9/juke-locale/guest-controller.png), [requested locale, final URL and visible text](images/release-1.3.9/juke-locale/result.json). Local Android screenshots are in `output/b630-guest-check/`.

Separate blocker: isolated authenticated APK/Gold testing and full Android Auto projection remain governed by [the device handoff](RELEASE_1_3_9_DEVICE_TEST_HANDOFF.md). This frontend correction alone does not close those gates.
