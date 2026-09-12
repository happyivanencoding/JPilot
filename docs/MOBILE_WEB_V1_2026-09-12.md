# Onward V1 — Mobile Web Only handoff (2026-09-12)

## Product decision

For the first commercial-validation cohort, Onward V1 has one official tester client: **Mobile Web**. Testers receive one canonical link or QR code and use the product directly in iPhone Safari or Android Chrome. APK/TestFlight/Expo/native installation is not part of the V1 test.

This decision is scoped to `feature/v1-mobile-web-only-20260912`:

- Worktree: `C:\dev\onward-v1-mobile-web-20260912`
- Base: `feature/v1-student-match-loop-20260910@2cffc680959aaa37bbdf59efb5b5455e93ea62e8`
- Branch: `feature/v1-mobile-web-only-20260912`
- Web version: `0.9.0`
- Canonical tester URL: `https://jobs-v1.thegreatnovel.com/`
- Android V1 source is retained and frozen; this branch does not maintain Web→Android UI parity.
- No iOS client is created. Safari/PWA is the iPhone path.
- Desktop keeps the same mobile product surface; the old Career-Ops dashboard is not restored.

## Mobile Web changes

The V1 browser shell now treats the phone viewport as the primary layout rather than scaling the 384×832 desktop reference. Mobile height uses `dvh/svh` with safe-area insets instead of a JavaScript CSS-height override; `visualViewport` remains only for soft-keyboard detection. Main navigation, job tabs, filters and compact controls use mobile-sized touch targets, and the bottom navigation accounts for the iPhone home indicator / Android gesture area.

The primary scroll surfaces remain one vertical context per screen/sheet. Job Match/CV/Tracking tabs reset their own detail scroll to the top when changing tab instead of inheriting the previous tab's offset. Mobile sheets, onboarding, privacy copy and PDF surfaces are bounded to the viewport and use contained overscroll.

## CV upload

The browser upload input accepts PDF, DOCX, TXT and MD, up to 12 MB. The selected `File` is retained while the asynchronous upload is running and the input is reset only after the upload promise settles, avoiding Safari re-render/reset loss. The API returns localized, specific format/empty/size/contract errors.

The upload attempt analytics milestone is persisted by the upload API using the authenticated Profile and the browser analytics session/event ids. This avoids losing `upload_cv` when Safari/WebKit reloads immediately after the file request. Analytics persistence remains non-blocking for the business result.

Synthetic end-to-end acceptance used a real PDF file chooser and the real `/api/mobile/upload`/extract/import path in both Chrome and Playwright WebKit.

## PDF preview

The main path is the existing local PDF.js renderer, not `<iframe>`/`<object>` and not a new editing framework. It fetches exact PDF bytes, checks `%PDF-`, uses the repository-pinned local worker/CMaps/fonts/WASM, lazily renders multi-page canvases and keeps download/share as secondary actions.

Acceptance covers targeted CV preview, original-CV switch, a real generated PDF response and browser rendering in Chrome and WebKit. A dedicated 360×800 assertion prevents PDF controls/root layout from creating horizontal overflow.

## Session and refresh recovery

The preview email session remains the existing 30-day HttpOnly / SameSite=Lax contract. The same normalized email reuses the same persisted Profile. Re-authentication no longer mutates an unfinished `journey.json` into `completed:true`; only the explicit onboarding completion action may complete the journey.

The browser QA intentionally reloads during CV analysis, search and role-CV generation, then closes/reopens the page in the same browser context. Persisted Profile/CV/tasks/offers/CV draft/tracking survive and the user returns to the same workspace.

## PWA / Add to Home Screen

PWA remains optional. `manifest.webmanifest` now declares a stable `/` id, Onward name/short name/description, portrait standalone display, Forest/Ivory theme/background and 192/512/SVG icons. The Apple touch icon is 180×180 and `viewport-fit=cover` remains enabled.

There is **no mandatory install prompt** and no claim of offline support/service-worker caching. Add to Home Screen is only an optional app-like shell around the same canonical Web workspace/session.

## Recruitment QR assets

Canonical assets:

- `web/public/release/onward-v1-mobile-web/onward-v1-qr.svg`
- `web/public/release/onward-v1-mobile-web/onward-v1-qr.png`

Both encode `https://jobs-v1.thegreatnovel.com/` and display:

> Scan to try Onward  
> No app installation required.

The PNG has been visually inspected and machine-decoded back to the canonical URL.

## Browser acceptance

### Chrome / Chromium

Automated real-browser production QA: **PASS**. It covers the full synthetic V1 path, actual upload/PDF endpoints, PDF.js rendering, refresh recovery, returning session, Analytics, PWA metadata and all target viewports:

- 375×812
- 390×844
- 393×852
- 430×932
- 360×800
- 384×854
- 412×915

### iPhone Safari

**WebKit simulated PASS.** The same full acceptance suite passes in Playwright WebKit, including upload-after-refresh recovery and PDF rendering. No physical iPhone/Mac Safari environment was available in this Runtime session, so this must not be reported as a real iPhone Safari PASS.

### Android Chrome physical device

Not physically validated in this task because ADB reported no connected device. No APK was installed or modified. Chromium mobile/touch QA is PASS; a real Samsung Chrome pass remains a device-level follow-up when the phone is connected.

### Soft keyboard boundary

The Web uses `interactive-widget=resizes-content`, modern dynamic viewport units and `visualViewport` only to detect an actual focused-input height reduction and hide the bottom nav when appropriate. Browser layout/viewport QA passes, but a physical iOS/Android soft keyboard was not available, so physical keyboard behavior is not claimed as device-PASS.

## Analytics

Existing V1 Product Analytics remains enabled: page lifecycle, click, scroll, funnel and visible AI-wait telemetry continue to POST to `/api/analytics`. Chrome and WebKit full-flow acceptance both produce the ordered legacy funnel through Tracking, while the current server-backed commercial funnel (`cv_ready`, Jobs Seen, Job Opened, Analysis Read, CV Generate Started/Completed) remains unchanged.

The Safari/WebKit acceptance exposed and fixed an actual upload milestone race: browser unload could strand `upload_cv` while another analytics POST was in flight. The upload API now persists that milestone using authenticated server context plus the browser analytics session/event id; business upload success/failure never depends on telemetry persistence.

## Known limitations

- Physical iPhone Safari has not been run in this environment; current Safari evidence is Playwright WebKit only.
- Physical Android Chrome has not been run because no ADB device was connected.
- System Files/iCloud Drive/Google Drive provider pickers cannot be faithfully automated from desktop Playwright; the browser file-input path is verified, but those OS picker surfaces remain physical-device checks.
- Add to Home Screen metadata is present, but no offline service worker is provided or promised.
- Android source remains in-tree for history/compatibility; it is not the V1 tester release target and receives no new UI parity work on this branch.

## Deployment

Deployment is intentionally performed only after the Mobile Web branch is committed and pushed. It must use the existing isolated V1 deploy channel, replace only the current `jobpilot-v1` Web release behind `jobs-v1.thegreatnovel.com`, and verify production/Yifeng containers are unchanged. Final deployed SHA and live verification are appended after rollout.
