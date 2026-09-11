# Onward V1 0.6.0 / Web 0.8.0 — editorial design parity

Android 0.6.0/code28 and Web 0.8.0 now share the same Forest/Ivory/Sage visual tokens, editorial Serif display hierarchy, Product Sans body hierarchy, reduced radii, thin-divider lists, restrained sheets/chrome and Onward symbol assets. The Web remains phone-first and does not reintroduce a desktop dashboard. First run, Home, Opportunities/history, role Match/CV/Tracking, CV impact, task/result sheets, Profile/preferences/privacy and common loading/error/empty states follow the same presentation rules as native Android.

The cross-platform AI interaction remains one state contract: the established fast→slow ETA curve caps active work at 96%, real completion finishes at 100% and failure terminates it. Both clients now render that state as **Onward AI Liquid Progress**: a Forest surface with calm bottom-rising Sage/Leaf liquid; task-detail progress uses the same pattern rather than a separate generic indeterminate control. Web reduced-motion removes the decorative wave animation without changing progress semantics.

Brand parity includes Android adaptive launcher/splash/header and Web header/favicon/PWA 192/512/app-icon assets. Tailored CV generation remains source-layout preserving; the deterministic identity/contact/layout-family test is 6/6 PASS. Android/Web production builds pass. Product SHA **`cbd582b097425a13b78a94f75e2d06c875454a91`** is deployed on the isolated V1 stack; the root gate returned `V1_DEPLOY_OK`, and a fresh public phone-viewport inspection shows Onward/Ivory metadata and UI with zero console errors. Exact visual scope and rollout receipts are in `ONWARD_0_6_0_RELEASE.md`.

# Onward V1 0.5.0 / Web 0.7.0

Android and Web share the Onward icon/wordmark, automatic system UI language (FR/ZH, otherwise EN), automatic source-CV language detection with independently configurable insights/material language, collapsed optional language controls, city/all-France search scope, and no per-page walkthrough interruptions. Home focuses on strengths, directions and priority roles; role cards use one match scale and evidence-backed prepared-CV gains. The three role tabs remain Match / CV / Tracking. PDF comparison shows clean role/original versions; status, date, reply draft and notes autosave.

Both clients send authenticated, bounded product events and visible AI waiting segments. Logical CV/search progress includes presentation readiness. Normal result navigation is not abandonment; backgrounding ends visible wait segments. See PRODUCT_ANALYTICS.md for retention, reporting and measurement limits. Release validation and delivery receipts are in ONWARD_0_5_0_RELEASE.md.

# JobPilot Web 0.6.1 — Android-aligned product

## 2026-09-11 V1 0.4.8 — broad directions, unified role tabs and upload notice

Android 0.4.8/code22 and Web 0.6.8 share one Match/CV/Tracking surface for both discovery and saved jobs. Inferred direction names/queries are broadened while specialty evidence and explicit targets stay intact. CV remains a muted, clickable tab until explicit generation; Tracking saves without AI. The previously unshipped privacy/scoring extension is included: visible pre-upload notice, unchecked acknowledgement, server enforcement and four-dimension deductions. Android comparison reopening fetches the corrected server PDF instead of an older in-memory version. No main/Yifeng merge. Local gates have passed; exact rollout receipts and boundaries are recorded in `docs/V1_0_4_8_RELEASE.md`.


## 2026-09-11 V1 0.4.6 delivery completed

V1 Web 0.6.6 is live at source `7b85455ec339c986edf4583053969802cff2f6dc`; Samsung `.v1` 0.4.6/code20 was upgraded without clearing data, and the APK is in its Download folder. Live EN-source → ZH-insights → FR-role-CV acceptance, confirmed-contract first results, consistent reviewed scores and corrected real-PDF overlays passed. Details and native/Web verification boundaries: `docs/V1_0_4_6_RELEASE.md`. Production/Yifeng container IDs and start times unchanged. Ongoing parallel privacy/score-breakdown work is outside this release.


## 2026-09-11 V1 0.4.6 / Web 0.6.6 — first-run and role-CV continuity

Implemented in the independent V1 feature branch: required contract choice at upload; shared full-screen CV/search waves without approximate signs; simpler first-result deck; unified language settings with optional independent insights language; bilingual role recall without a document-language filter; prominent role-CV card/detail entries; frozen match basis and consistently reviewed draft scores; real-PDF change overlays with original-version comparison. Android 0.4.6/code20 and Web 0.6.6 remain paired.

Local Node/PDF/build/browser gates have passed; live rollout and phone receipts are recorded separately in `docs/V1_0_4_6_RELEASE.md`. The controlled-model browser check is not a live AI acceptance. Preserve main/Yifeng and existing private data.


## 2026-09-11 V1 0.4.5 rollout and phone email-entry fix

- User's screenshot showed the old invitation/simulated-Google UI submitting to the new email-only backend. Device inspection confirmed **0.4.4/code18**, while the existing V1 deploy had already completed for **081d26e603ae4f7f96a31da327c344952b9998c9** (`V1_DEPLOY_OK`, authenticated session/profile/logout, model-key and search-provider gates passed). This was an incomplete Android rollout, not another email form or PDF-parser defect.
- Installed the already-built **0.4.5/code19** APK with `adb install -r` to Samsung SM_S928U1, package `com.thegreatnovel.jobpilot.v1`; no uninstall or data clear. Device version readback and a 743ms successful cold launch were recorded. UI hierarchy **and visually inspected screenshot** show `邮箱` / `继续` and the unverified-test-access note, with no invitation/simulated-Google field. Phone was left on the empty email page for the user; no test identity was entered on the phone.
- Fresh public-browser inspection of `https://jobs-v1.thegreatnovel.com` shows the matching Email/Continue input (`preview-email`, type=email), without an invitation code or simulated Google action; no console/page/network errors in this inspection. Existing feature revision is pushed to origin. No product-source change, re-build, re-deploy, main merge or Yifeng change was required in this follow-up.
- The user reported replenishing API credit. **This follow-up did not submit a new paid AI analysis**, so it does not turn the earlier controlled-model acceptance into a live-model success claim. The prior successful local PDF/account/water-flow acceptance remains explicitly fixture-model testing. Existing invitation-era profiles are preserved, not automatically linked to an arbitrary newly entered email.
- Private device/deploy evidence: `.career-ops-web/v145-delivery/`; keep screenshots, runtime data and sessions out of Git. This release follow-up updates documentation, not application source.


## 2026-09-11 V1 0.4.5 — persistent test email and full-screen CV water

- V1-only login now asks for an email, without a simulated Google button or invitation code. Normalized email-to-Profile records persist on the V1 data volume; logout revokes a session, not the Profile. A returning email with a saved CV enters the normal workspace. An interrupted account that never uploaded a CV resumes at the picker. New emails have independent empty Profiles. Legacy anonymous sessions/data are preserved; email from CV contents is not treated as proof of account ownership.
- This is explicitly **unverified test access**, not production authentication. Use synthetic CVs. Existing session binding/foreign-Profile rejection remains intact; production and Yifeng are unchanged.
- The reported Amina PDF was already read and saved successfully. Actual VPS failures were the primary provider's HTTP429 `no credits remaining`. No parser change or silent model substitution is justified. The app now distinguishes extraction failure from saved-CV analysis/translation failure, with a direct Continue analysis action in both onboarding and normal Home.
- Android and Web fill the full viewport from below with two translucent waves. The displayed percentage is an estimate across upload/extraction, analysis and localized directions: it decelerates near 80–90%, caps at 96% while pending, freezes on failure and reaches 100% only when the result is display-ready. Completion fills quickly, holds briefly and opens the direction choices.
- Versions: Android **0.4.5/code19**, Web **0.6.5**, mobile contract **0.4.5**. Android keeps the independent `.v1` package and V1 URL.
- Validation before rollout: 29 focused Node assertions, TypeScript, production Web build and Android debug build passed. `scripts/qa-v1-email-water.mjs` used the actual Amina synthetic PDF/extractor/persistence with a deliberately controlled local model (not live AI); it verified moving full-screen waves, real state-gated 100%, directions, logout-to-email, case-normalized return to the same CV/workspace, another empty email and cross-Profile 403. Browser page errors: none. Initial QA failed because an API read omitted its locale header and unexpectedly requested French translation from the analysis fixture; the explicit test locale was corrected, then the full acceptance passed. No product behavior was bypassed.
- Deployment/device acceptance and the live-credit blocker are updated after rollout. Do not equate successful build/model-key presence with available API credit or live AI success.


## 2026-09-11 V1 0.4.4 / Web 0.6.4

Final app SHA `dd07f3e0f15cc85e6cd4b87eb4272f1adb2172d8` is deployed; final Android `0.4.4/code18` installed on the Samsung V1 package with existing account preserved. Actual phone Master CV is a visually verified one-page professional layout. Real Web liquid progress, four translated role cards, collapsed/expanded history, alias task reuse and CV score consistency (78 header / 78 baseline / 86 draft) passed. No main/Yifeng restart. Full facts and limits are in the V1 document.

Android and phone-first Web share one job-match score scale (current → estimated after CV edits), plain-language gaps, UI-language direction labels, collapsed history and estimated liquid-progress buttons. My retains logout but removes account-refresh/developer/status copy; the Home growth panel is removed. Master CV PDF uses the same server-side professional one-column template on both clients. New direction searches are grouped/cached conservatively and limited to six per Profile/day, while old results stay accessible. Full implementation/acceptance: `V1_STUDENT_MATCH_LOOP_2026-09-10.md`. Release does not merge or deploy main/Yifeng.


## 2026-09-11 V1 0.4.3 final acceptance

App `6b3093f063103eec5bc8528a8dd07f106b88ce70` is deployed to the isolated V1 site; Android `0.4.3/code17` final APK was installed successfully on Samsung. Real Yuki/Mehdi first-use, My logout/relogin, independent insight language, four fully prepared French role cards and Mehdi's rendered role PDF are verified. New targeted behavior regression: 9/9. V1 role-CV draft scores now use the same bounded gain as Keep, rather than displaying an unrelated writing-quality score. Full evidence/limits: `V1_STUDENT_MATCH_LOOP_2026-09-10.md`.


## 2026-09-11 V1 0.4.3 / Web 0.6.3

V1 now uses per-session empty preview Profiles rather than fixed `louis`. First run defaults to English, allows independent UI/CV/insight languages, saves the chosen source CV in the background without exposing an extraction textarea, and presents personal strengths/directions and the first four scored role cards only when analysis plus DeepSeek translation are complete. My ends with session-revoking logout; another simulated Google sign-in can test a different CV. No changes to production Google authentication. Old requests, old CV versions and another Profile's tasks cannot populate the new session's results. Current V1 product/data semantics and real acceptance: `V1_STUDENT_MATCH_LOOP_2026-09-10.md`.

## V1 AI/bootstrap parity recovery — 2026-09-11

- Android `0.4.1/code15` and Web `0.6.1` now share the same migration bootstrap: if a Master CV exists but the current candidate version has no V1-shaped analysis (`careerDirections/searchKeywords`), the snapshot reports `v1.needsBootstrap`. Each client sends one idempotent POST `bootstrapV1`; neither client starts model work from a presentation GET.
- Both clients therefore ignore the old pre-V1 completed analysis that caused the first preview to show `analysisState=completed` with zero directions. The same versioned analysis/search operation keys drive Android and Web, and both silently follow analysis → structured search → top-offer deep match.
- Real shared-backend acceptance produced 4 directions, 8 keywords, a live JSearch/France Travail search, Goldman Sachs at 82/100 and a completed deep match. The real Samsung Opportunities screen showed the same Goldman result/82 score that Web receives from the snapshot.
- Search-provider credentials remain server-only. V1 uses an isolated VPS runtime.env; Android and Web never contain JSearch/France Travail secrets.

## V1 student match loop parity — 2026-09-10 branch origin

- `feature/v1-student-match-loop-20260910` ships the same three primary surfaces on Android and Web: **首页 / 机会 / 我的**. The independent V1 preview is deployed separately; production main remains unchanged.
- Both clients render the same V1 0–100 exploration score and the same three-level contract: current match → truthful CV-presentation potential → genuine capability potential. The historical official 0–5 report remains a separate legacy object.
- Both clients treat CV confirmation/edit as the trigger for silent analysis, use explicit target roles before inferred directions, expose editable career/search suggestions, and keep silent tasks out of the user task centre / blocking launch overlay.
- Both clients open discovered offers read-only and expose the same primary explicit AI action: **查看我的 XX 分版本**. Only that action persists the offer and starts a Master-derived role CV.
- Both clients show role-specific versions under “我的”; tailored versions never chain. Tailored draft edits trigger a background reassessment automatically; Keep/Reject remains explicit.
- Detailed V1 architecture, scoring and data boundaries: `V1_STUDENT_MATCH_LOOP_2026-09-10.md`.

## Product decision — 2026-09-08

The Web client is now JobPilot, not a separate upstream Career-Ops workbench. The root route is the only product shell. There is no Classic/Advanced UI switch. The existing engine, profile files, evaluation reports, task history and authenticated gateway remain shared with native Android.

**Development repository:** `https://github.com/happyivanencoding/JPilot`. Native Android is the frontend product authority; Web parity follows Android rather than evolving independently. Historical Career-Ops upstream/release/update machinery is not part of the JPilot development path. See `PROJECT_STRUCTURE.md`.

**Hard parity release gate:** every Android UI/product behavior change must include and verify its equivalent phone-first Web behavior in the same development change/release. An Android release is not complete while the Web version is intentionally left behind. Backend-only changes are the normal exception.

## 0.5.2 parity delta — Android 0.3.9

- Web and Android use the same gateway login route. Once the private Google Web Client ID is configured, both flows open Google Identity Services in the system/browser surface; Cloudflare Access remains a compatibility fallback.
- `admin` accounts may switch across the current Profile registry. Ordinary `user` accounts receive exactly one Profile grant; Web and Android hide the Profile switch for them.
- If an ordinary user's canonical CV is empty, both clients keep that user on the Profile/CV screen and hide normal navigation until the existing upload/preview/confirm flow saves a canonical CV.
- The gateway and Web API both enforce Profile scope. `/api/profiles` is filtered as well, so unshared Profile names are not exposed to ordinary users.

## 0.4.6 parity delta — Android 0.3.8

- Web and Android both ship the same first-use welcome plus one-time five-tab onboarding. Web persists it in `localStorage`; Android uses app preferences.
- Skipping onboarding suppresses all remaining guides on both clients; normal start keeps one-time tab walkthroughs.
- User-facing Token/API-cost metrics are hidden on both clients, while ETA/progress remains visible and backend metrics stay intact for internal analysis.
- This release is layered on top of 0.4.5/0.3.7 and therefore retains collapsible interview plans, inline AI progress, CV draft review, localization and current application filters. Production `typecheck`/Next build pass; Node **325/325** pass; Chromium/Edge and WebKit synthetic browser QA both **25/25 PASS** including onboarding skip-all with zero production business writes. The persistent service was restarted; `127.0.0.1:3000/api/mobile` returns backend **0.3.8** and root HTTP 200 while gateway 3002 remains listening.

## 0.4.5 parity delta — Android 0.3.7

- Generated Job Detail interview plans now mirror native Android’s collapse/expand behavior. The plan starts expanded, keeps a visible **Interview preparation plan** header, exposes `aria-expanded`, and can remove/reveal the long Markdown body without changing the saved plan.
- The shared Web `AiProgressButton` mirrors the Android model-action surface: analysis, formal evaluation, tailored CV generation/review, plan generation/update, practice feedback, coach, and discovery/pasted-URL evaluation. While active, the button itself is filled with a translucent progress layer and displays `≈NN%` rather than leaving progress only in the task center.
- Progress remains an ETA visualization rather than pretending to be provider-reported completion. It uses the same `0.96 × (1 - exp(-3t/T))` curve as Android, caps at 96% while active, slows visibly near the end, and only jumps to 100% when the task snapshot is truly `completed`. Failed/interrupted tasks terminate the estimate and surface a visible error.
- The centered background-task ETA ring now uses the same non-linear curve and real-terminal completion snap. Web polling also clears a matching launch overlay when an active task becomes failed/interrupted, so a background failure is not hidden behind a stale “processing” card.
- Chromium/Edge and WebKit synthetic browser QA are both **24/24 PASS** and specifically exercise collapse→expand, active inline progress, completed 100% snap, and failure visibility. The fixture is fail-closed for production writes. Production `npm run build` passes for Web **0.4.5**.
- The persistent Web service was restarted through `web/scripts/start-mobile.ps1 -RestartWeb`; `127.0.0.1:3000/api/mobile` returns backend contract **0.3.7** while the existing gateway on 3002 stays up.

## 0.4.4 parity delta — Android 0.3.6

- The job CV tab now exposes the same pending tailored-CV proposal loop as native Android: current accepted version, candidate draft, 0–100 presentation comparison, ATS warnings, actual PDF preview, manual editing, reassessment, Keep and Reject. Generating a draft does not silently replace the accepted job-specific CV.
- The score comparison is explicitly presentation-only and shares a fixed baseline across subsequent edits. The visible draft score cannot fall below baseline; a worse/equal rewrite is displayed as `+0` with guidance to improve substantive evidence rather than keep polishing wording.
- `cv_review` is a separate lightweight assessment action after manual edits; it does not ask the model to regenerate the CV body. A deliberate “new candidate version” or reassessment can rerun completed work; concurrent duplicate clicks still reuse the active task.
- ATS audit warnings are non-terminal when a real PDF was generated. The UI surfaces the warning list instead of presenting a whole CV generation failure.
- Tailored-CV improvement prose is now part of display localization, while the actual draft CV payload is excluded from UI localization. Cached translation segments and new provider responses are validated against the requested target language; a `locale=fr` cache containing Chinese is invalid and automatically replaced.
- Synthetic browser QA: Chromium/Edge **23/23** and WebKit **23/23**, including `58 → 76`, manual edit, reassessment to `58 → 80`, real PDF rendering and Reject preserving the accepted fixture CV.

## 0.4.3 parity delta — Android 0.3.5

- Every sheet scroll surface now uses `overscroll-behavior:none`; horizontal chip/comparison/table/PDF scrollers do the same. Browser acceptance scrolls CV analysis to its bottom, sends another large wheel gesture, and asserts both `scrollTop` and sheet bounds remain unchanged.
- Applications exposes only chronological lifecycle categories as primary navigation: **All / Prepare / Applied / Replies / Interviews / Offer-Hired / Closed**. High match, follow-up and evaluated-to-apply remain quick filters rather than lifecycle states.
- A persistent **Filter & sort** entry is available in every category. Users can select all/evaluated/unrated roles and sort high→low score (default), low→high score or recently updated.
- Discovery evaluation now auto-saves the exact offer first. Single and bulk evaluation inputs carry the discovered offer to the shared backend; the saved URL remains recoverable even when evaluation later fails or is interrupted. The save path uses the canonical pipeline writer directly rather than localhost HTTP.
- Completed formal evaluations are projected by exact normalized URL onto stale candidature cards. This fixes the real case where two same-company/same-title France Travail postings were merged by legacy tracker identity: low-score completed evaluations no longer remain permanently “unrated”, valid 0.0 scores count as evaluated, and mismatched report links/details are removed.
- `Evaluate all unrated` now explicitly retries a previous failed/interrupted operation. Existing completed exact-URL tasks remain idempotently reused.
- Chromium/Edge and WebKit synthetic suites each pass **22/22** with assertions for stage ordering, score sorting/evaluation filtering, evaluate→save and drawer edge stability. TypeScript, production build, targeted **19/19** and full Node **321/321** pass.

## 0.4.2 parity delta — Android 0.3.4

- Active AI tasks now receive a concrete ETA range from the shared backend. Three or more comparable successful production runs for the same flow/model/reasoning override the fallback; otherwise the UI uses the latest verified direct-model flow baselines. The same `estimate.minSeconds/maxSeconds/targetSeconds/source` object is consumed by Android and Web.
- The centered background-task acknowledgement now includes a circular ETA indicator and live “estimated remaining” text. The task center uses the same indicator for each active task. This is not a model progress API: it visualizes elapsed time against the ETA, stops below 100% while the task is active, and switches to an explicit “estimated time exceeded, still processing” message after the target.
- Batch launches display the longest active task estimate in the centered acknowledgement; each task retains its own individual estimate after it enters the task center.
- Browser QA was rebuilt against the new code and now asserts the ETA ring/remaining-time contract. Chromium/Edge **22/22** and WebKit **22/22** isolated groups pass with the synthetic API and zero production Candidate writes. Production `next build` and TypeScript also pass.

## 0.4.1 parity delta — Android 0.3.3

- Offers now support select-all for the currently visible pending set, individual selection, bulk save and bulk formal evaluation. Applications exposes one action to evaluate every currently unrated saved role; existing queued/running evaluations are excluded and backend task identity remains idempotent.
- Every AI action now gives a strong centered acknowledgement. It states that processing continues in the background and that the task is in the top-right task center. Pressing the confirmation button shrinks/fades the card toward that task center; reduced-motion browser settings remain respected.
- A job-detail interview question's “Practice this question” action now scrolls directly to targeted practice and carries the selected question into the editor rather than changing invisible state above the fold.
- The main phone scroll surface disables elastic overscroll at its boundary, matching the native Offer-list fix and removing the bottom-edge bounce/jitter feedback.
- Tailored CV empty-keyword ATS handling and formal-evaluation post-run reconciliation were repaired in the shared backend; see `AI_BENCHMARK_2026-09-08.md`.
- Isolated browser acceptance now covers **22 groups in Edge/Chromium and 22 in WebKit**, including bulk actions, the background-task animation contract and practice auto-scroll. No production Candidate writes occur in that suite.

## AI runtime — transport-only ACP

The shared server-side AI runtime now treats AgentDock/ACP strictly as model transport. Product inference receives backend-assembled data and cannot use terminal/filesystem/web/browser/plugins/skills/sub-agents. Formal evaluation returns JSON and the backend owns report/tracker persistence. Structured providers, not ACP web search, are the discovery network layer. CV ingest is extracted locally before inference; tailored CV generation embeds the frozen Candidate version. This changes backend latency/security boundaries, not the phone-frame Web interaction contract. See `AI_BENCHMARK_2026-09-08.md` for the measured transport tax and quality comparison.

The reference is the current Android 0.3.8 implementation in `android/app/src/main/java/com/thegreatnovel/jobpilot/`, particularly `PilotApp`, `PilotDesign`, `CatalogScreens`, `PreparationScreens`, `DetailSheets`, `CvAnalysisScreens` and `CvPreview`. Do not infer current requirements from old Web screenshots or the historical upstream README.

## Layout and interaction

The connected reference phone reports 1440 × 3120 pixels at density 600: **384 × 832 logical units**. Desktop browsers render that exact portrait frame, centered and scaled down as a whole when necessary; a wide monitor does not expand it into an admin dashboard. Small-screen browsers use their real viewport and safe-area insets. Browser/OS status bars, file pickers, keyboard, sharing menus and font rasterization are platform-owned, not fake Android controls.

The shared navigation is Home / Offers / Applications / Prepare / Profile. The petroleum/teal palette, light/dark themes, 25/31 section headings, 48px primary controls, 10px cards, logo and rounded Material navigation icons follow the native design. Job detail uses the same Fit / CV / Interview / Tracking sections. Sheets stay inside the phone frame; Escape, browser Back, close and downward handle gestures dismiss them. Each main screen retains its form and scroll state while navigating.

The implementation is in `web/src/components/jobpilot/`. The old `AppShell` and old page bodies are not mounted by the root layout. Historical source utilities may remain for the engine; that does not provide a second reachable Web UI.

## Function parity and data authority

| Surface | Shared behavior |
| --- | --- |
| Home | Exact backend `dashboard.actionSets` for high-match, follow-up, decide and interview counts and destination filters; priorities and replies |
| Offers | Structured search, saved discovery, source/relevance/freshness metrics, save, URL evaluation, existing in-flight identity |
| Applications | Profile-scoped status/search filters, recorded scores only, 2–4 role comparison, persisted evaluations and reports |
| Job detail | Evidence, gaps, match requirements, tailored CV, interview plan/questions/practice, tracking, notes and employer reply records |
| Prepare | Job selection, daily time budget/date, saved checklist, plan, interview answer feedback and career coaching |
| Profile | Upload and review, master PDF, explicit CV editing, saved analysis, whole-page rewrite plan, material language and job preferences |
| Task center | All active tasks plus three latest distinct terminal results; completed tasks open their saved product destination rather than rerunning AI |
| CV preview | Actual backend PDF bytes, page rendering, zoom/pan, before/after, PDF download, supported browser file sharing, explicit draft accept/reject |

The browser does not recalculate compatibility, create a new candidate store or store canonical CV/application data in localStorage. Only UI language/theme preferences are stored there. Production calls use `/api/mobile`, `/api/mobile/upload`, `/api/mobile/cv`, `/api/candidatures/cv`, `/api/cv`, `/api/profile` and `/api/profiles`.

Every data request carries explicit `profileId` and the active locale. Direct CV and preference routes also honor explicit profile scope, so changing the shared cookie in another tab cannot redirect a save. Profile switching fully reloads the selected workspace. Stale profile/language responses are cancelled and ignored. CV edit/import uses the captured expected input version; a conflict keeps the edited text visible instead of overwriting the newer CV.

UI language (Chinese/French/English) is independent from the default language of new application documents (French/English). The existing shared localization cache and static dictionary are reused. Opening saved analysis, switching language or viewing a PDF is not an instruction to rerun a business analysis. Existing historical translation delays/failures remain the backend limitations documented in `ANDROID_LANGUAGE_SEPARATION.md`; this UI replacement does not claim to fix model cold starts.

## Old route retirement

`/explore` and `/portals` redirect to Offers. `/pipeline`, `/candidatures` and `/apply` redirect to Applications. `/followups` selects the due filter. `/cv` and `/config` open Profile; `/analytics` opens Home; `/jobs` opens the task center. `/pipeline/[id]` maps to a role sheet (including matching a historical report number); `/jobs/[id]` maps to a task detail. An identifier absent from the selected profile must never fall back to another profile.

The root title, app icon, favicon, manifest and home-screen name are JobPilot. No legacy sidebar, upstream marketing banner or alternative Classic workbench is served. Server APIs are retained where shared engine functionality depends on them.

## PDF and third-party assets

`pdfjs-dist` is pinned to 6.3.289. `web/scripts/prepare-web-assets.mjs` copies its worker, CMaps, standard font resources, WASM and license from the installed dependency into ignored `public/jobpilot-pdf/` before build/dev. No runtime CDN is used for private CV rendering. Canvas pages are rendered near the viewport, cancelled on close/source switch, and capped in resolution. The original PDF bytes, not a screenshot reconstruction, are used for download/share.

The six native navigation/task symbols use Google's unmodified Material Icons Rounded paths, matching `Icons.Rounded` names in Android. The Apache-2.0 license is included in `material-icons.LICENSE`; source repository is `google/material-design-icons`. JobPilot-authored material is AGPL-3.0-only; the inherited Career-Ops MIT notice is preserved separately in `LICENSES/career-ops-MIT.txt`. Independent product branding and the root AGPL license do not remove third-party attribution.

## Build, test and deployment

From `web/`:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

For an isolated production build and browser acceptance:

```powershell
$env:BUILD_DIST = '.next-web-parity-qa'
npm run build
node scripts/qa-jobpilot-web.mjs
$env:JOBPILOT_QA_ENGINE = 'webkit'
node node_modules/playwright-core/cli.js install webkit
node scripts/qa-jobpilot-web.mjs
Remove-Item Env:JOBPILOT_QA_ENGINE, Env:BUILD_DIST
```

The browser suite uses actual browser engines and a fail-closed synthetic API. It reads only registered profile identifiers from the local registry so SSR cookies are valid; all test CVs, offers, task results and writes are fictional and isolated. Unrecognized API calls fail the test instead of reaching real business routes. Its temporary server and browser are owned and cleaned up by the bounded test process. Synthetic action success is not evidence of a new successful production AI model run.

Regular deployment uses the existing `JobPilot web` Scheduled Task and `web/scripts/start-mobile.ps1 -RestartWeb`, not an AgentDock command child. Port 3000 stays loopback-only. The authenticated gateway on 3002, public Cloudflare protection, and opt-in trusted-LAN demo on 3003 remain unchanged. A standalone manifest adds a home-screen entry, not offline AI or independent cloud hosting.

## Acceptance status

**0.4.5 is built and deployed to the existing product service on 2026-09-09 together with Android source/APK 0.3.7/code11 and backend mobile contract 0.3.7.** The Samsung was not connected to ADB during this release, so its latest physically verified installed build remains 0.3.6/code10. The earlier 0.4.4/0.4.2/0.4.1/0.4.0 evidence below remains historical evidence for prior releases, not the current running Web build.

| Verification | Observed result |
| --- | --- |
| TypeScript and staged/actual production build | Passed |
| Final Node test suite | 507 total: 506 passed, 0 failed, 1 skipped |
| Isolated full browser action suite | 21 groups passed in Edge 151; 21 passed in WebKit 26.5; no JavaScript exceptions |
| Actual production GET-only smoke | 10 groups passed in Chrome 152; 10 in normal-window Edge 151; 10 in WebKit 26.5 |
| Real saved reference data | 13 roles, saved analysis, actual one-page master PDF; no business write request from the smoke |
| Routing and access | All ten historical top-level routes redirect; the existing LAN proxy serves JobPilot; unauthenticated gateway/public API access remains blocked |
| Viewports | Exact 384×832 desktop frame; 390×844 and 320×640 phone sizes; short desktop scales without widening |

Actual production smoke is implemented in `scripts/qa-jobpilot-live.mjs`. Use `JOBPILOT_QA_BROWSER` for an installed Chromium executable, `JOBPILOT_QA_HEADED=1` for a normal browser window, or `JOBPILOT_QA_ENGINE=webkit`. `JOBPILOT_QA_LABEL` selects the private evidence subdirectory. It loads the existing synthetic reference profile and blocks every non-GET API request. PDF validation is actual canvas rendering of the backend PDF, not merely a 200 response.

**Data integrity and concurrent use:** before deployment and during the complete Chrome smoke, all 16 captured CV/config/notes/candidature files across four profiles were byte-identical. Later, another profile gained search/evaluation tasks and its candidature file changed while the running product was being used. Those changes were preserved, not reverted. Final Edge/WebKit checks recorded 15/16 globally unchanged; the selected reference profile remained 4/4 unchanged with the same task inventory and zero smoke business writes. The QA explicitly distinguishes its selected profile from external concurrent activity. All captured master CV files remained unchanged at the final integrity check.

**Platform and experiment boundaries:** this release does not claim a new successful production AI search, evaluation, rewrite or model benchmark from the browser tests. Action tests used a fail-closed fictional API. Real Chrome, Edge and WebKit smoke used saved production results. Initial headless Edge 151 runs returned an empty 204 for a PDF that the backend returned as a valid 200 PDF; normal-window Edge, Chrome and WebKit subsequently rendered that same PDF successfully. No CV or browser security settings were changed to hide the anomaly; headless Edge's internal cause is not claimed resolved. The failing evidence remains private. WebKit engine coverage is not physical Mac/iPhone/Safari device acceptance. Browser/OS chrome, file pickers, sharing support and typography may differ from native Android.

**Operational boundaries:** the desktop PC and AgentDock still need to stay running. The prior historical-translation queue/cold-start limitations documented in `ANDROID_LANGUAGE_SEPARATION.md` remain separate backend work. No upstream update, reset, clean, stash, commit or push was performed; concurrent Android, language, ACP and LAN changes remain in the dirty worktree.

Private evidence root: `.career-ops-web/mobile-qa/web-parity-20260908/`. See `browser/`, `browser-webkit/`, `live-chrome/`, `live-edge-headed/`, `live-webkit/`, `tests-final.log`, and `build-production.log`. Never publish the directory: it also contains private backups, source-byte comparisons and saved CV screenshots. Old production build backup is retained privately for recovery, not served as an alternative UI.

## Isolated refactor acceptance — 2026-09-09

`refactor/jobpilot-simplify-20260909` includes the published 0.4.6 / Android 0.3.8 features, with shared candidature services and retired internal-HTTP/CLI paths. Current-code verification: Node 217/217; Next build passed; Chromium and WebKit fixture QA 25/25 each; both engines also passed five real-backend browser checks. Current CV draft generation/assessment and explicit re-review completed with a fictional Candidate, leaving the saved CV unchanged until confirmation. Android APK builds; unit tests remain `NO-SOURCE` and no device installation was performed.

This is **not deployed** and **not merged into main**. The user explicitly put main integration on hold. Lower Node counts reflect removal of tests exclusive to retired implementations, not skipped live-path failures. Full scope/evidence: `REFACTOR_2026-09-09.md`.

## Backend 0.5.0 ownership replacement

The Web/backend runtime is now JobPilot-owned: the root CLI/provider/mode/template execution engine has been removed after replacement and acceptance. Android remains 0.3.8/code12 and its source is unchanged; all 0.4.6 main product interactions are retained. The contract remains 0.3.8, so the installed app does not require replacement for this backend-only release.

Current evidence: 165 Node tests, production build, Chromium/WebKit each 25 UI checks and seven actual-backend browser checks, four deterministic PDF scenarios and eight real-model functional flows passed. Android packaging succeeded with up-to-date tasks; unit tests were NO-SOURCE. No phone installation or device test was performed. Details and data/ownership limitations: `OWNED_CORE.md`.


## Physical Android follow-up — 2026-09-10

The existing APK is now physically installed as 0.3.8/code12. Native navigation, language separation, saved-report reuse, one new assessed PDF draft, reject, profile isolation and interview controls were exercised. A literal-Markdown-emphasis issue found in the real tailored PDF is corrected by the shared renderer in Web/backend 0.5.1; both clients consume the corrected PDF. No Android/Web interface change was necessary. Current backend regression: 166/166 and production build passed. See `DEVICE_ACCEPTANCE_2026-09-10.md` for the exact physical evidence, interrupted intermediate run and untested boundaries.
