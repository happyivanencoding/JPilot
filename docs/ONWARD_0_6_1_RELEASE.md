# Onward V1 0.6.1 / Web 0.8.1 — Visual Refinement

Date: 2026-09-11  
Project: `C:\dev\jpilot-v1-student-20260910`  
Branch: `feature/v1-student-match-loop-20260910`

## Scope and isolation

This release is the second Onward visual refinement pass. It changes brand geometry, typography, composition, iconography, visual rhythm and motion while preserving the existing V1 product semantics and data contracts.

It does **not** change AI transport/providers, scoring logic, search providers, authentication, Profile isolation, Candidate storage, or introduce new model calls. Production `main` and Yifeng staging were not modified or merged.

Product commit: `05875bb248d1d1e7fd34253c7a7c036aa48fe5fb` (`feat(v1): refine Onward visual identity`).

## Canonical Onward brand assets

The previous header treatment approximated the mark and rendered `Onward` as live serif text. That is removed.

The Refined Identity reference supplied for this release was used as the source of truth. The visible Forest/Leaf silhouettes were traced from the reference identity artwork into canonical vector geometry, including the actual wordmark outline. The symbol/negative space and lockup were repeatedly compared against the reference at matched scale; the final traced silhouette overlap is approximately 96.5% IoU before antialiasing differences.

Canonical Web/source assets:

- `web/public/onward-symbol.svg` — standalone symbol.
- `web/public/onward-wordmark.svg` — vector wordmark; no font dependency.
- `web/public/onward-lockup.svg` — canonical header lockup.
- `web/scripts/generate_onward_assets.py` — derives Android vectors from the canonical SVG geometry.

Derived Android assets:

- `android/app/src/main/res/drawable/ic_onward.xml`
- `android/app/src/main/res/drawable/ic_onward_lockup.xml`
- `android/app/src/main/res/drawable/onward_launcher_foreground.xml`
- `android/app/src/main/res/drawable/onward_splash.xml`

PWA/icon derivatives are regenerated from the same symbol: `onward-192.png`, `onward-512.png`; favicon/manifest use `onward-symbol.svg`. The launcher and splash apply only safe-zone scale/placement and do not redraw or distort the symbol.

`web/src/components/jobpilot/onward-brand.tsx` and Android `OnwardBrand.kt` now render the vector lockup directly. There is no `Icon + Text("Onward")` implementation remaining in the branded header.

## Typography system

Latin typography now uses the same source files on Android and Web:

- Display/editorial: **Instrument Serif**.
- Product/body/UI: **Inter variable**.
- Chinese and Arabic continue through explicit platform/CJK/Arabic fallbacks rather than forcing unsupported Latin fonts.

Web fonts are in `web/public/fonts/`; Android copies are in `android/app/src/main/res/font/`. SIL Open Font License 1.1 notices are retained and documented in `THIRD_PARTY_NOTICES.md`.

## Composition and frontend visual elements

### Home

- Replaced the previous dashboard-like strength stack with an editorial hero: greeting → one deterministic identity statement derived from already-available analysis signals → directions → recommended roles.
- No new AI request is introduced for the identity statement.
- Generic background circles were removed; the low-opacity hero motif is the actual Onward symbol geometry.
- Direction rows use semantic medallions and tighter editorial rhythm.
- Recommended roles use company monograms, compact semantic match labels and dividers rather than large score blocks/cards.

### Opportunities

- Stronger page title and breathing space around search.
- Result count and Filters share one editorial row.
- Job results are flat divider rows: company tile / title / company / location-contract metadata / semantic match badge / chevron.
- Match labels are `Très bon match`, `Pertinent`, `À explorer` (localized); the large numeric score is reserved for detail.

### Job Detail / Match

- Company monogram, company/job/location/contract hero and low-opacity Onward motif.
- Large editorial 0–100 match score with animated count-up and proportion underline.
- Structured semantic sections: Correspondance, Why you fit, To strengthen, CV presentation, Suggested actions.
- Strengths use Sage checks; gaps stay neutral instead of red warning treatment.

### First-run CV upload

- Copy aligned to the supplied Onward reference: “Votre prochain chapitre commence ici.”
- Structured document dropzone with document medallion, choose-file CTA and file limits.
- Separate pale Sage data-security row with lock icon.
- Existing required contract/geography inputs remain because they are functional V1 requirements.

### Profile

- Large editorial profile title + short description + identity.
- Real-data summary strip for applications/tracking, saved roles and role-CV versions.
- Existing functional settings/career controls remain below; no fake statistics were added.

### CV / Impact

The existing Original-CV continuity chain is preserved: identity/contact data, sections, layout and renderer are not replaced by a UI-style template in this pass. Existing impact/CV comparison flows retain their document semantics.

## Motion system

Shared intent across Web/Android:

- Page entrance: ~210 ms fade + 4–8 px/dp vertical settle.
- Home section reveal: light 35–75 ms stagger.
- First job rows: light sequential enter on first render.
- Press: ~110–120 ms Sage wash; Web chevron moves ~3 px.
- Sheet/detail entrance: ~260 ms fade + vertical settle.
- Match score: 0 → actual over ~430 ms with eased underline reveal.
- Bottom navigation: active color/position transitions without Material pills.
- Web `prefers-reduced-motion` disables nonessential motion; Android AI wave respects system animator duration scale.

The Onward AI Liquid Progress contract is unchanged: estimated progress moves quickly then slows, active progress does not exceed 96%, only real completion reaches 100%, and failure stops. Visual treatment is refined to two low-amplitude, different-phase Sage/Leaf liquid layers with no glow, particles or neon styling.

## Validation receipts

### Web

- `npm run build` — PASS for `@jobpilot/web@0.8.1` (Next production build + TypeScript).
- Controlled browser visual/function QA — PASS:
  - `ONWARD_QA_OK`
  - 6 controlled model fixture calls
  - funnel: login → upload_cv → choose_direction → view_jobs → open_job → view_cv → generate_cv → tracking
- Final visual evidence is private under `.career-ops-web/onward-061-qa/web-final/` and includes first entry, upload, liquid wait, match, role-CV/PDF and Home.

The controlled browser QA uses local fixture/model controls; it is not evidence of a new paid-model benchmark.

### Android

- `./gradlew.bat :app:assembleDebug` — PASS for `0.6.1` / code `29`.
- Samsung `SM-S928U1` / `R5CXB0BSTVD`: `adb install -r` — PASS; no uninstall or data clear.
- Device package readback: versionName `0.6.1`, versionCode `29`.
- Physical screenshots visually inspected for Home, Opportunities, Job Detail, Profile, launcher and splash under `.career-ops-web/onward-061-qa/android/`.
- Launcher uses only canonical symbol; splash uses the same symbol at a separate safe-zone scale.

APK:

- Local: `.career-ops-web/onward-061/Onward-V1-0.6.1-code29.apk`
- Size: `20,449,907` bytes
- SHA-256: `55BD02C4EC7C64002C54DDEBF5E065460A60874921B4AF2B682DEEA0FF81C470`
- Phone copy: `/sdcard/Download/Onward-V1-0.6.1-code29.apk`

## Public deployment status

The product commit is pushed to `origin/feature/v1-student-match-loop-20260910`. The normal isolated V1 VPS deploy command was attempted, but the current tool safety layer blocked the privileged remote deployment invocation before execution. No V1 container was changed by that blocked attempt. The public V1 site therefore must **not** be described as 0.8.1/0.6.1 until a successful `V1_DEPLOY_OK <sha>` receipt is obtained.

Production and Yifeng were not touched. Their pre-attempt container IDs/StartedAt were read before the blocked V1 deployment attempt and remain the isolation baseline.

## Remaining visual differences vs supplied references

- Real job titles and evidence can be materially longer than the curated mockups, so line wrapping/density cannot be identical without hiding real data.
- Profile still exposes existing functional controls below the new editorial identity/summary; it is not as sparse as the reference mockup.
- First-run upload still needs V1’s required contract/geography inputs before the document dropzone, so its composition is intentionally not a literal one-screen clone.
- Role-CV/Impact rendering remains governed by the existing document data/layout chain; this pass did not replace the PDF/document renderer.
- Motion has been implemented and exercised in the controlled Web flow and native navigation, but not frame-by-frame captured for every native surface.

These are product/content constraints or consciously preserved scope, not hidden “done” claims.
