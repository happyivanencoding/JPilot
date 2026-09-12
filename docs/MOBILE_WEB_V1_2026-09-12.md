# Onward V1 — Mobile Web Only handoff (2026-09-12)

## Web 0.9.1 — onboarding localization / search hotfix

The first real French Mobile Web walkthrough after 0.9.0 exposed three reachable defects that did not appear in the earlier synthetic browser path. The synthetic Hugo Pelletier supply-chain CV (`C:\dev\jobpilot-cv-testset-20260911\CV_Test_04_Hugo_Pelletier.pdf`) was replayed through the public VPS with a French UI. The orientation model itself finished normally in about 7.6s and returned French prose, but the persisted orientation had the legacy `outputLocale=en` marker. Display localization therefore treated already-French content as English. The configured DeepSeek translation call then returned Chinese for a number of segments even though the target was French; the old validator also let short all-Chinese labels such as a direction title through as valid French. The UI consequently mixed French and Chinese.

0.9.1 fixes this at the presentation boundary rather than hard-coding translations. Orientation source language is inferred from the complete structured result (summary, strengths, growth actions and directions), stale `outputLocale` metadata no longer wins over the actual text, and all-Chinese output is rejected for French/English display even when the string is short. Display/history translation is now **OpenAI direct `gpt-5.6-luna` with `reasoning=none`**; the DeepSeek translation path is no longer used by V1. Existing valid display cache entries remain reusable, while wrong-language cache entries are invalidated by target-language validation. The active Web source no longer contains a DeepSeek translation transport or DeepSeek credential dependency. The V1 privacy notice is version **2026-09-12.1** and now accurately identifies OpenAI as the analysis/translation AI interface.

The same public walkthrough also proved that the recurring “Pas encore d’offre adaptée à cette piste” was not simply a thin market. `Supply Planner Paris` received **8 raw France Travail offers**, while JSearch returned HTTP 429; all eight France Travail rows were then removed by the old English-centric relevance layer. Supply planning, procurement/approvisionnement, logistics and continuous-improvement families now have conservative French/English market aliases used for recall/relevance, and the V1 search revision is **`v12-market-vocabulary`**, so the previous zero-result cache cannot be silently reused. These are search semantics, not UI translations; they remain distinct from display localization.

The full-screen CV/search water also had a visible horizontal seam where the rectangular liquid fill began under the SVG wave. The fill now starts a few pixels below the wave and the SVG uses the same translucent liquid fill, removing the separate hard boundary without changing the bottom-up progress behavior.

Targeted regressions cover the wrong-locale legacy orientation, short Chinese translation rejection, OpenAI translation transport/model/reasoning, the four supply-chain market families and distinct search identities, and the wave/fill boundary. Web typecheck and production build are release gates for this hotfix. The final VPS/mobile-browser evidence is recorded in the Deployment section below.

## Product decision

For the first commercial-validation cohort, Onward V1 has one official tester client: **Mobile Web**. Testers receive one canonical link or QR code and use the product directly in iPhone Safari or Android Chrome. APK/TestFlight/Expo/native installation is not part of the V1 test.

This decision is scoped to `feature/v1-mobile-web-only-20260912`:

- Worktree: `C:\dev\onward-v1-mobile-web-20260912`
- Base: `feature/v1-student-match-loop-20260910@2cffc680959aaa37bbdf59efb5b5455e93ea62e8`
- Branch: `feature/v1-mobile-web-only-20260912`
- Web version: `0.9.1`
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

The PNG has been visually inspected and machine-decoded back to `https://jobs-v1.thegreatnovel.com/`; both files are generated directly from the canonical URL.

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

Samsung `SM-S928U1 / R5CXB0BSTVD` is **physical-device PASS against the deployed VPS**. Before rollout, opening the old public V1 from Android Chrome exposed a real P0: top-level external navigation carried `Sec-Fetch-Site: cross-site` and the old root middleware returned `{"error":"cross-origin request refused ..."}` instead of Onward. The Mobile Web branch now allows only `GET/HEAD` document navigation to `/` while keeping the strict origin guard on API/non-navigation requests. After deployment, the same public external-navigation contract returns **200**, while a cross-site `/api/v1/session` request remains **403**.

On the real Samsung Chrome session, `https://jobs-v1.thegreatnovel.com/` restored the existing Youness workspace after a cold browser restart. Actual viewport metrics were `384×741` CSS px at DPR `3.75`; root/body widths were both `384`, and the three bottom-nav targets measured about `122.7×55.2` CSS px. Opportunities rendered without horizontal overflow; focusing the role search field opened Gboard, shrank `visualViewport` to about `356px`, applied `jp-keyboard` and hid the Onward bottom navigation. A read-only existing `Consultant FinOps - CDI (H/F)` result was opened through the live DOM; its sheet remained within the viewport, exposed `Match / CV / Suivi`, switched to CV, then opened its already-generated targeted CV. The public PDF.js renderer displayed **1 rendered page**, with two original/targeted compare controls and no horizontal overflow. Tracking opened read-only and remained on `jobTab=2` after a real page refresh. No APK was installed or modified, no AI task was started, and no CV/Tracking data was changed.

### Soft keyboard boundary

The Web uses `interactive-widget=resizes-content`, modern dynamic viewport units and `visualViewport` only to detect an actual focused-input height reduction and hide the bottom nav when appropriate. Mobile inputs are forced to a computed 16px to avoid Safari focus zoom. The deployed VPS version passed the physical Samsung Chrome/Gboard check. Physical iOS keyboard behavior remains untested.

## Analytics

Existing V1 Product Analytics remains enabled: page lifecycle, click, scroll, funnel and visible AI-wait telemetry continue to POST to `/api/analytics`. Chrome and WebKit full-flow acceptance both produce the ordered legacy funnel through Tracking, while the current server-backed commercial funnel (`cv_ready`, Jobs Seen, Job Opened, Analysis Read, CV Generate Started/Completed) remains unchanged.

The Safari/WebKit acceptance exposed and fixed an actual upload milestone race: browser unload could strand `upload_cv` while another analytics POST was in flight. The upload API now persists that milestone using authenticated server context plus the browser analytics session/event id; business upload success/failure never depends on telemetry persistence.

## Known limitations

- Physical iPhone Safari has not been run in this environment; current Safari evidence is Playwright WebKit only.
- System Files/iCloud Drive/Google Drive provider pickers cannot be faithfully automated from desktop Playwright. The browser file-input/upload path is verified end-to-end, but no physical provider file was selected on the connected Samsung because doing so would overwrite the user's current Youness master CV; that provider-selection surface remains the only Android upload-device limitation.
- Add to Home Screen metadata is present, but no offline service worker is provided or promised.
- Android source remains in-tree for history/compatibility; it is not the V1 tester release target and receives no new UI parity work on this branch.

## Deployment

The V1-only deployment channel tracks `feature/v1-mobile-web-only-20260912`. The localization/search/wave hotfix was implemented in **`10e1231dd1c447bd4ec71115ce11e727164aa642`**; a small follow-up **`63667cea43aff70f633e6d4dc43c02716ceca680`** localizes the CV-privacy upload errors that were exposed while re-running the French public flow. The final deployed product SHA is therefore **`63667cea43aff70f633e6d4dc43c02716ceca680`**. The V1 root deploy completed its session/Profile isolation, logout, model-key, search-provider and internal-analytics gates and returned **`V1_DEPLOY_OK 63667cea43aff70f633e6d4dc43c02716ceca680`**. `jobpilot-v1-web-1` is healthy on image `jobpilot-v1:63667cea43aff70f633e6d4dc43c02716ceca680`.

Public entry checks after the final rollout: normal root navigation **200**; simulated external top-level document navigation (`Sec-Fetch-Site: cross-site`, `mode=navigate`, `dest=document`) **200**; cross-site `/api/v1/session` remains **403**. The live mobile-width Chrome session re-entered the synthetic tester workspace with `test.prénom@g.com` and the Hugo Pelletier fixture. The Home/orientation surface was consistently French despite the old DeepSeek-era Chinese cache files still existing on disk. A new localization operation created on the VPS records **`gpt-5.6-luna` / `reasoning=none` / `openai-direct`**. The stale Chinese cache is therefore retained only as history and is no longer accepted as the French display projection.

The same public session selected **Planification supply chain**. The new `v12-market-vocabulary` search queried `planificateur supply chain`: France Travail returned **62 raw offers**, the relevance layer removed **55**, and **1 offer survived** instead of the old false zero. The UI rendered **`M Supply Planner (F/H) - Industrie Pharmaceutique`**, `75 - Paris`, `CDI`, proving that the recurring empty state was fixed in the real search pipeline rather than hidden by copy. JSearch still returned HTTP 429 in this run; the successful France Travail path continued normally. The related deep-match task also completed with `gpt-5.6-luna`.

The final browser replay also deliberately exercised the stale-consent upload guard. The backend correctly returned **428**, and the French UI now presents the notice-required error in French instead of leaking the raw English server message. The full-screen wave/fill seam fix is deployed and covered by the targeted CSS regression; this final pass did not claim a new physical 89%-progress screenshot.

Production and Yifeng were not rebuilt or restarted. Their five Web/gateway/tunnel container IDs and `StartedAt` values remained exactly equal to the pre-hotfix baseline; only the isolated V1 Web/tunnel were recreated. Physical iPhone Safari remains the outstanding device boundary already described above.


## 2026-09-12 AI search correction (v13)

The tester's credit / fixed-income empty screens exposed two independent failures: JSearch repeatedly returns HTTP 429, and the old deterministic occupational vocabulary rejects relevant multilingual/adjacent offers before AI match analysis. Product search now calls the bounded model transport (`gpt-5.6-luna`, reasoning `none`) to translate market probes and classify actual provider results. No new occupation dictionary was added. The AI plan supplies English/French queries directly; AI classification replaces the old lexical relevance gate on this product path. Responses must cover each supplied index exactly once; fabricated IDs/URLs and malformed responses fail validation. Offers are deduplicated and classified in batches of 40 with bounded descriptions; contract, location, freshness and known-URL checks remain deterministic. The final result is not re-filtered through the old lexical ranker. Search model metrics and the query plan are retained in the private task, with no CV sent to search providers.

`v13-ai-market-search` invalidates old direction caches without deleting history. Incomplete empty searches caused by unavailable sources can be retried rather than reused as definitive zeros. Both onboarding and Offers explain incomplete source coverage. Provider availability is not repaired by this code: JSearch was still returning 429 in live checks. Live bounded AI/provider validation returned the EDF ALM internship via two source listings for the credit query; fixed-income internship probes still returned no eligible offers. These are source-coverage limitations, not proof that no such jobs exist.

The full-screen water now uses one continuous SVG path extending to the bottom, removing the translucent wave/rectangle overlap seam. Bottom-up progress remains. A controlled Chrome 390×844 render at 52% was visually inspected with no horizontal seam; this is not a physical iPhone acceptance claim.

Deployment: product commit `e4bd1b9d0419429e491b5303159ee6dff917d16b` pushed only to `origin/feature/v1-mobile-web-only-20260912`, then deployed by the existing isolated V1 root script. It returned `V1_DEPLOY_OK`; session/Profile isolation, logout, model-key, provider-config and internal-analytics gates passed. The other production/staging containers kept the same IDs. Local verification: 52 targeted tests passed with provider credentials removed from the unit-test process, TypeScript and production build passed. (The initial unit run was contaminated by live France Travail environment credentials; isolating the test process restored deterministic fixture-only results.)

A Chrome UI search on the public deployed site for `Stage analyste crédit Paris` created a completed server task with `model=gpt-5.6-luna`, three English/French AI probes and two provider entries. The page showed the localized incomplete-source notice while preparing deep matches. This confirms the deployed product path, beyond the earlier module-level probe.

Final Chrome acceptance: the public Offers page completed deep-match preparation and rendered both ALM source cards with Stage and Paris locations, with the search button enabled again and the French incomplete-source notice still visible. The two cards are provider entries for the same titled internship, not a claim of two distinct vacancies.


## Additional search sources — 2026-09-12

Product search now enables Jooble France and public SmartRecruiters employer boards alongside France Travail/JSearch. SmartRecruiters starts with the verified Wavestone1 and Sia public boards, configurable through `JOBPILOT_SMARTRECRUITERS_COMPANIES`; all role terms still come from the AI plan. Public list/detail calls are bounded and interleaved across employers. Jooble uses its France-specific endpoint and the newly registered private API key. A source failure is independent: successful results from any configured production source can continue. Hard location/contract exclusions are applied before AI classification to avoid spending model calls on definitively ineligible offers.

Adzuna and Jobicy adapters are implemented and tested but not enabled for in-app results. The user explicitly chose no additional provider attribution/logo/link UI. Adzuna credentials were registered and installed privately; Adzuna requires its specific on-screen attribution. Jobicy also requires visible source attribution. Neither is counted as a live product source while that display requirement is unmet. Existing application URLs remain, and source IDs, latency, call counts, raw counts and errors stay in backend diagnostics. No source-brand UI change remains in the diff.

Live endpoint checks on the VPS: Jooble France HTTP 200 / 30 entries, including Credit Risk Analyst (Internship); Adzuna France HTTP 200 / 10 entries for a credit query; Jobicy HTTP 200 / 200 feed entries. These are raw source responses, not final eligible vacancy counts. SmartRecruiters public finance queries returned Wavestone1 totalFound 30 / Sia 24; the adapter smoke returned four normalized public postings. Secrets are in the existing `/etc/server-infra/secrets/jobpilot-v1/runtime.env`, never in repository files.

Provider references: https://developers.smartrecruiters.com/reference/v1listpostings ; https://developers.smartrecruiters.com/reference/v1getposting ; https://help.jooble.org/fr/support/solutions/articles/60001448238-documentation-de-la-jooble-rest-api ; https://developer.adzuna.com/docs/search ; https://developer.adzuna.com/docs/terms_of_service ; https://github.com/Jobicy/remote-jobs-api . Remotive free API and La bonne alternance were assessed but not added to this commercial email-login flow under their documented usage restrictions.

The first additional-source deployment (`d6010ee`) exposed a second cache below the direction cache: `operationKey` did not include `searchRevision`, so it could reuse old completed tasks despite the new direction revision. The follow-up includes the revision in the V1 search operation identity and adds a regression proving v13 cannot satisfy a v14 request. Relevant tests, typecheck and production build passed.

Final deployed product SHA: `2c2942c9a4227b32b17323ceb405a345a75d6c3d`; root deploy returned `V1_DEPLOY_OK` with all standard gates passing. A fresh public Chrome search created a v14 task (not a cached v13 task): Jooble `ok / rawCount 60 / apiCalls 2`, SmartRecruiters `ok / rawCount 26 / apiCalls 38`, France Travail `ok / rawCount 90`, JSearch still `429`, and Adzuna/Jobicy explicitly `disabled`. Final retrieval retained three offers including Jooble's `Credit Risk Analyst (Internship)`. These provider diagnostics are backend-only. No frontend branding changes are present.

The final page replay rendered iBanFirst Credit Risk Analyst (Internship), but also exposed a Jooble title/metadata conflict: an Alternant.e posting was labelled internship by the provider. Jooble normalization now gives an explicit apprenticeship/internship title precedence over contradictory generic source metadata; regression passes. Revision v15-source-contract-evidence prevents reuse of that misleading batch. This corrects the earlier three-offer intermediate acceptance count.

Final release is `dcb11df5256f05dce4e9a735dce7a8529d11eac9` (`V1_DEPLOY_OK`). The fresh v15 public search completed with exactly two eligible Stage entries: Jooble/iBanFirst Credit Risk Analyst (Internship) and the France Travail ALM internship. The contradictory apprenticeship is excluded. No new provider-logo/source-link UI was shipped.


## Test-code gate and verified Google login — 2026-09-12

Initial and logged-out users first enter a server-verified test code. ONWARDV1 enables the existing Google Identity Services flow, with server verification adapted from the main gateway (RS256/JWKS, issuer/audience/expiry, verified email, Google subject), now bound to a one-time random gate nonce. ANSHUN enables arbitrary non-empty test IDs, without email syntax validation. Both require a short-lived HttpOnly gate cookie; unauthenticated API requests and attempts to use a Google gate for manual-ID login are denied. Logout revokes both session and gate. Codes can be overridden by JOBPILOT_V1_TEST_CODE and JOBPILOT_V1_ADMIN_CODE. The Google client ID uses JOBPILOT_GOOGLE_CLIENT_ID.

Google profiles are keyed by verified subject and kept separate from admin/legacy unverified IDs. Admin mode can reopen legacy test-email spaces; neither mode clears CV or journey data. New identities reach the full-screen CV upload. Existing identities retain their saved journey. Old pre-gate cookies require reauthentication (session authVersion 2); no account/CV files are deleted.

User approved adding https://jobs-v1.thegreatnovel.com to the existing Google Web client's authorized JavaScript origins; Google Cloud displayed OAuth client saved. Existing production origin retained. No OAuth scopes or client secrets were added. Local checks include generated RSA token fixtures and actual HTTP tests against the built Web server for mode separation, forged credentials, arbitrary IDs, logout, profile isolation and cross-site refusal. Public Google/browser acceptance follows deployment.
