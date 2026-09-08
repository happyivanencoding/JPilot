# JobPilot Web 0.4.0 — Android-aligned product

## Product decision — 2026-09-08

The Web client is now JobPilot, not a separate upstream Career-Ops workbench. The root route is the only product shell. There is no Classic/Advanced UI switch. The existing engine, profile files, evaluation reports, task history and authenticated gateway remain shared with native Android.

**Development repository:** `https://github.com/happyivanencoding/JPilot`. Native Android is the frontend product authority; Web parity follows Android rather than evolving independently. Historical Career-Ops upstream/release/update machinery is not part of the JPilot development path. See `PROJECT_STRUCTURE.md`.

## AI runtime — transport-only ACP

The shared server-side AI runtime now treats AgentDock/ACP strictly as model transport. Product inference receives backend-assembled data and cannot use terminal/filesystem/web/browser/plugins/skills/sub-agents. Formal evaluation returns JSON and the backend owns report/tracker persistence. Structured providers, not ACP web search, are the discovery network layer. CV ingest is extracted locally before inference; tailored CV generation embeds the frozen Candidate version. This changes backend latency/security boundaries, not the phone-frame Web interaction contract. See `AI_BENCHMARK_2026-09-08.md` for the measured transport tax and quality comparison.

The reference is the actual Android 0.3.2 implementation in `android/app/src/main/java/com/thegreatnovel/jobpilot/`, particularly `PilotApp`, `PilotDesign`, `CatalogScreens`, `PreparationScreens`, `DetailSheets`, `CvAnalysisScreens` and `CvPreview`. Do not infer current requirements from old Web screenshots or the historical upstream README.

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

**Deployed to the existing product URL on 2026-09-08.** Web package 0.4.0; production BUILD_ID `PZ9nmFnLTKFHtvNIuwks1`. The native APK and backend mobile contract remain 0.3.2/code6; this release does not replace the APK.

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
