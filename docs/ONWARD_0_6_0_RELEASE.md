# Onward V1 0.6.0 — Editorial visual system release

Date: 2026-09-11

Scope: isolated V1 only (`feature/v1-student-match-loop-20260910`). This release does not merge or deploy production `main` or Yifeng staging.

## Versions

- Android: **0.6.0 / code 28** — package `com.thegreatnovel.jobpilot.v1`
- Web: **0.8.0**
- Mobile snapshot contract: **0.6.0**
- V1 Web target: `https://jobs-v1.thegreatnovel.com`

## Visual system

The previous blue/gray JobPilot/Material treatment is replaced by one Onward design system shared by Android and phone-first Web:

- Forest `#0A4438`, deep forest `#06372F`, Ivory `#FAF8F1`, Paper `#FFFDF8`, Sage `#E9EFDB`, Leaf `#DDE77E`, warm gray/line and restrained error tones.
- Editorial Serif for display/headline/numerical hierarchy; product Sans for body, labels and controls. Platform/CJK/Arabic fallbacks remain in the stack rather than forcing a Latin-only bundled font.
- Content structure now relies on whitespace, baseline hierarchy and thin separators. Generic information cards, large corner radii, elevation and decorative shadows were removed where they did not communicate a real state.
- Buttons remain capsule-shaped where action affordance benefits from it; inputs, sheets and informational surfaces use smaller radii.
- Home gets the restrained Onward halo/arc motif; it is not repeated as decoration on every page.
- Bottom navigation is flat and typography-led rather than using a Material selected pill.

## Page coverage

The visual refactor covers the full reachable V1 journey on both clients: email entry, privacy notice, CV upload, CV analysis/search waiting, first strengths/directions/results, Home, Opportunities/search/history/filter surfaces, role details, Match, Company/localization content, role CV, original/optimized comparison, CV generation/review/impact, Tracking, Profile/My, applications, preferences, language, account/privacy, task/result sheets, dialogs, empty/loading/error states and bottom navigation.

The information architecture, data model, scoring, search, authentication, Profile isolation, analytics and AI/provider contracts were not rewritten for this release.

## Onward AI Liquid Progress

The existing estimated-progress semantics remain authoritative: active work follows the established fast-to-slow curve, stays below 100% (maximum 96%) until the backend reports a real terminal success, then finishes at 100%; failure stops the estimate.

The visual treatment is now an Onward motion token on Android and Web: Forest processing surface, low-frequency bottom-rising Sage/Leaf liquid layers, readable localized status copy, restrained success/error states and reduced-motion support on Web. Active task-detail status now uses the same pattern rather than an unrelated indefinite spinner/bar.

## CV continuity

This release does not replace the document renderer or regenerate a user CV into an unrelated app template. The role-CV view continues to branch from the original/reference layout and may change wording, bullet selection/order and emphasis while retaining identity/contact/layout-family information. The visible impact treatment is now `Initial CV → Optimised CV` with a restrained score uplift.

Targeted deterministic regression `node --test tests/v1-cv-consistency.test.mjs` passes **6/6**, including the assertion that tailored CV output keeps the original identity, email, phone, language content and template font family while wording changes.

## Branding assets

- Android app name: `Onward`.
- Android launcher uses a dedicated adaptive icon: Ivory background + standalone Forest/Leaf Onward symbol.
- Android 12+ splash uses a separately scaled Onward symbol so the mark is not oversized.
- App header uses the same symbol and editorial Onward wordmark treatment.
- Web header, app icon route, favicon, PWA 192/512 icons and legacy icon aliases all resolve to the Onward symbol. Old blue JobPilot/old Onward wordmark assets are no longer used by the V1 visual shell.

## Pre-rollout verification

Actual checks run for this revision:

- Android `:app:assembleDebug`: **PASS** after the final dedicated splash asset was added.
- Web `npm run build`: **PASS** for exact current Web source (`@jobpilot/web@0.8.0`).
- Targeted CV continuity test: **6/6 PASS**, no model/API call.
- Source search for the old blue visual tokens `#293F68`, `#64748B`, `#E8EDF6` in Android UI/resources and Web source/public assets: no remaining reachable visual-token usage.
- Local production Web at phone viewport: Onward title/brand, Ivory background and editorial first-entry layout rendered with no page/console error in the captured inspection.
- Samsung SM-S928U1 installed in place with `adb install -r`; package readback is **0.6.0/code28** and existing V1 data was not cleared. Physical screenshots confirm the Onward in-app header, Home/editorial hierarchy, launcher icon and recent-app icon. A dedicated splash capture confirmed the final smaller Onward symbol on Ivory.

## Final delivery receipts

- Product commit **`cbd582b097425a13b78a94f75e2d06c875454a91`** was pushed to `feature/v1-student-match-loop-20260910` and deployed by the existing isolated V1 root script. The deployment rebuilt only the `jobpilot-v1` image/stack and returned **`V1_DEPLOY_OK cbd582b097425a13b78a94f75e2d06c875454a91`**.
- The VPS gate rebuilt Web **0.8.0** successfully and then passed V1 session/Profile isolation + logout, model-key readiness and structured search-provider configuration checks. Production main and Yifeng deployment commands were not invoked.
- Public `https://jobs-v1.thegreatnovel.com` was opened after deployment at a phone viewport. It reports title/application name **Onward**, runtime theme color **`#FAF8F1`**, Onward SVG/favicon/PWA links, and no console errors. The captured first-entry screen was visually inspected: Ivory surface, Forest/Leaf branding, editorial headline and the minimal email entry are live.
- Samsung **SM-S928U1** was upgraded in place with `adb install -r`. Package `com.thegreatnovel.jobpilot.v1` reads back **versionName 0.6.0 / versionCode 28**; no uninstall/data clear occurred. Physical captures verify the in-app Onward header/Home, launcher icon, recent-app icon and the final dedicated smaller splash symbol.
- Final APK: `C:\dev\jpilot-v1-student-20260910\.career-ops-web\onward-060\Onward-V1-0.6.0-code28.apk`, **19,876,483 bytes**, SHA-256 **`FEEB492B5D2BC621B4EF2BAB90A4B3663133065BF4917D241725AB4D2515FFF0`**. The same versioned APK was copied to the phone at `Download/Onward-V1-0.6.0-code28.apk`.
- No paid AI benchmark or bulk model rerun was performed for this visual release. Existing data and already-working business/AI contracts were reused; the deterministic CV continuity regression and build/deployment gates are the relevant release evidence.
