# JobPilot mobile — acceptance record

Date: 2026-09-09, Europe/Paris. Current installation: **Android 0.3.4/code8 on the Samsung USB device, with production backend build 0.3.4 and Web 0.4.2**. Language-specific acceptance and historical limits remain in `ANDROID_LANGUAGE_SEPARATION.md`; earlier release evidence below is retained. Private evidence remains in ignored `.career-ops-web/mobile-qa/` directories.

## 0.3.4 AI ETA / circular progress acceptance

| Verification | Observed result |
| --- | --- |
| Install | `adb install -r` succeeded; package reports versionName **0.3.4**, versionCode **8**. |
| ETA source | With fewer than 3 comparable production runs, the backend returns verified fallback ranges and `targetSeconds`; with 3+ comparable successful runs it switches to profile-specific production history. Targeted persistence/ETA suite: **16/16 pass**. |
| Central AI launch | On the physical Samsung, a synthetic Yueyue interview-plan task displayed `正在后台处理`, **预计剩余 43 秒**, **预计耗时 20–45 秒** and the existing task-center handoff. A later dump showed **预计剩余 21 秒**, proving the displayed remaining time is live rather than static. |
| Task center ETA | A separate synthetic practice task was started while the native task center was open. The active row displayed **预计剩余 16 秒 / 预计耗时 10–30 秒**. The task completed normally after **12.894s**, 12,085 tokens, estimated API-equivalent cost ~$0.003727. |
| First synthetic plan timing | The plan task completed normally after **40.0s**, 9,451 tokens, estimated API-equivalent cost ~$0.0056. No real Candidate profile was used for either ETA acceptance task. |
| Progress semantics | The circular indicator is elapsed-time-versus-ETA only; it is capped below 100% while active and changes to an “estimated time exceeded, still processing” state if the target elapses. No fake model-completion percentage is exposed. |
| Web parity | Web 0.4.2 isolated Chromium/Edge **22/22** and WebKit **22/22** pass. The background-task check now asserts an ETA ring plus estimated remaining time. |
| Build | Web TypeScript pass; Next production build pass; Android `assembleDebug` pass. |

## 0.3.3 interaction / batch / AI-feedback acceptance

| Verification | Observed result |
| --- | --- |
| Install | `adb install -r` succeeded; package reports versionName **0.3.3**, versionCode **7**; existing login/data remained available after force-stop/relaunch. |
| Offers bulk selection | Current synthetic profile shows `一键选中所有待处理岗位`; selecting it exposes `收藏 5` and `评估 5` on the physical device. No bulk action was fired merely to prove the controls. |
| Applications bulk evaluation | Physical device shows `一键评估所有未评估岗位` with the current live count. Active evaluations are excluded by task identity. |
| Practice navigation | On a real evaluated synthetic role, tapping `练习这道题` scrolled from the question card to `针对性模拟`; the chosen question, `我的回答` and `获取反馈` were all visible afterward. No feedback task was submitted for this navigation check. |
| Offer bottom stability | After reaching the Offer-list bottom, an additional bottom-edge swipe left the two captured UI semantic trees byte-identical, including unchanged final-card bounds. The former bottom bounce/jitter did not reproduce. |
| AI acknowledgement | A single formal evaluation was launched from the synthetic marketing profile. The physical device displayed centered `正在后台处理`, named the job evaluation, stated it was added to the top-right task list, and showed `知道了`; after confirmation the overlay disappeared and the task-center control remained. |
| Same synthetic evaluation | Completed in **12.602s wall / 11.811s model**, 6,168 tokens, estimated $0.002323 API equivalent, with an official persisted report. |
| Shared AI acceptance | Isolated fictional roots passed analysis, evaluation, tailored CV, plan, practice, compare, coach and DeepSeek display localization. See `AI_BENCHMARK_2026-09-08.md`. |
| Web parity | 0.4.1 Edge/Chromium **22/22** and WebKit **22/22** isolated browser groups passed, including bulk actions, task acknowledgement and practice auto-scroll; zero production Candidate writes. |
| Build/regression | Web TypeScript pass; **317/317** Node tests pass; production Next build pass; Android `assembleDebug` pass. |

## Web 0.4.0 replacement — 2026-09-08

This is Web acceptance, not a new Android device build. The original Web UI has been replaced at the existing root by the Android-aligned five-tab portrait experience. Production BUILD_ID: `PZ9nmFnLTKFHtvNIuwks1`. Details and private evidence locations: `WEB_ANDROID_PARITY.md`.

Final TypeScript/build checks passed; Node tests: 506 passed, 0 failed, 1 skipped. The full isolated action suite passed 21 groups in each of Edge 151 and WebKit 26.5. Real production GET-only smoke passed 10 groups each in Chrome 152, normal-window Edge 151 and WebKit 26.5, including saved results, actual PDF rendering, old route redirects, LAN and unauthenticated access checks. No real business AI write was submitted by that smoke. The selected reference profile retained all four source files and 21 tasks. Concurrent activity in a different profile was recorded and preserved, not rolled back.

The existing native language limitations remain separate. WebKit engine coverage does not establish physical Mac/iPhone acceptance. Initial headless Edge PDF transport anomalies and the successful normal-browser checks are recorded without claiming an unproven engine fix.

## 0.3.2 language separation — observed acceptance

`LanguageAcceptanceTest#documentAndLocaleSafetyWithoutWaitingForTranslation` passed on the installed app against the authenticated public backend: **OK (1 test), 29.011s**. This is a document/locale safety acceptance, not a claim that all historical translation calls completed.

| Requirement | Observed result |
|---|---|
| Independent UI/material settings | Chinese controls and separate French/English material preference; Synthetic Finance Profile reversible preference changes do not change Candidate/CV versions, scores or business tasks. |
| Synthetic Finance Profile | Three Chinese analysis tabs visibly reviewed; native master PDF remains French, one page. |
| Synthetic Marketing Profile | Chinese UI and native one-page English master PDF verified; 13 explanation segments were still pending at the successful test snapshot. |
| Locale roundtrip | Actual Chinese → French → Chinese sequence: 1.953s; zero new translation operations and zero new business tasks. |
| Business invariants | Synthetic Finance Profile 21 tasks / 13 jobs / CV v2; Synthetic Marketing Profile 17 tasks / 1 job / CV v2, unchanged before/after. |
| Original-file preservation | 93 files compared: 92 byte-identical; only synthetic Synthetic Finance Profile config adds explicit `cv.language: fr`. Canonical CVs, notes, candidatures, reports, tasks and CV histories unchanged. |
| Regression/build/install | 33 targeted tests pass; Web production/TypeScript and native APK/test build pass; actual USB installation 0.3.2/code6. |
| Remaining limit | Cold ACP session/turn latency prevented full historical-report/Synthetic Marketing Profile explanation acceptance. One visible Synthetic Finance Profile training job eventually localized in about575s; cached analysis reopens without another model turn. No fresh evaluation/analysis benchmark was used. |

Private evidence: `language-20260908/continuation-phone-safety-2.txt`, `device-final/`, `final-proof.json`, `continuation-business-after.json`, plus retained failing runs. The initial Activity-result-owner crash was fixed and Profile subsequently passed. Another native test was interrupted by concurrent Project OS QA on the same device, then passed when tested independently. Full failure/performance details and exact continuation scope: `ANDROID_LANGUAGE_SEPARATION.md`.

## 0.3.1 search acceptance

| Requirement | Final observed result |
|---|---|
| Synthetic Marketing Profile zero-result regression | Original phone search fetched 33 raw rows but over-filtered 24 unknown-contract rows and returned 0. New search operation identity prevents reuse of that stale result. |
| Contract semantics | CDI/CDD/Stage/Alternance all have targeted tests for confirmed match, confirmed mismatch, unknown contract and Stage/Alternance mixed postings. Known incompatible contract stays the hard gate; unknown remains `to confirm`. |
| Soft targeting | Seniority/2+ years experience, French requirement, role-family and geography are ranking/risk labels rather than one-condition deletions. `closest` is the bounded last-resort tier. |
| Flexible geography | Paris/France are priority, not a lock. Other Europe / European remote is retained with mobility/admin uncertainty; one of the existing three JSearch probes is Europe-wide. Outside-Europe results can remain as lower fallback. |
| Actual public-phone search | Native instrumentation on the installed app created a new `search-v5-soft-ranking` task and passed `OK (1 test)`: **6 CDI results, 3 strong + 3 adjacent, no AI fallback**, ~6.9 s, 180 structured raw rows. |
| Result quality regression | `Chef de rayon produits` no longer masquerades as `chef de produit` Marketing; explicit 2–4 years experience is labelled as seniority risk, while a two-year contract duration is not. |
| UI | Installed 0.3.1 search screen visibly says France first, then other European countries / European remote. Cards support `closest`, seniority, role and geography-risk labels. |

Current touched regression set: **44 pass / 0 fail**; latest Next production build/typecheck and Android builds pass. The live provider result count is a time-sensitive sample, not a guarantee that every future run returns six jobs. Evidence: `.career-ops-web/mobile-qa/search-soft-ranking-20260908/` and the profile-scoped immutable mobile task.

## Current 0.3 device acceptance

| Requirement | Final observed result |
|---|---|
| Installed version / public deployment | Actual APK 0.3.1/code5 installed over existing app; phone test asserts public jobs host and backend 0.3.1. |
| Home metric navigation | High, due, interview, decide and repeat high entry select the correct filter and exact canonical ID-set count. |
| Profile isolation | Four actual profile switches and profile-scoped task records; real CVs unchanged by synthetic draft actions. |
| Actual rendered draft | Current and proposed PDFs displayed on phone; Synthetic Finance Profile coordinated plan is one page, 37 lines, 11 bullets at fixed readable typography. |
| Reject / accept | Reject preserves bytes/version; accept advances v1→v2 once, retains history and resolves applied changes. |
| Transient success | Original failure was fixed in ViewModel; reject and accept feedback both disappear after the bounded real-device wait. |
| Input continuity | Accepted change exposes update; update started from native UI in background, then completed with prior changes and honest unchanged-experience conclusions. |
| Unchanged analysis | Only view-analysis after completion; repeated requests return the same persisted result without another task. |
| Task center | Actual search, analysis, draft and new formal result routes exercised; unexercised historical types are not generalized as passes. |
| Fresh formal evaluation | New Citi official report #8 persisted, 2.6/5, Skip; not just an old report reuse test. |
| Formal result after process reopen | Force-stop/reopen retains result, removes Discovery pending entry/evaluate CTA, updates automatic next-action wording and reuses repeated requests. |
| Light/dark and keyboard | Actual surfaces/screenshots inspected; keyboard hides bottom navigation and system Back restores it in both modes. |

Final logs: `device-draft-acceptance.log`, `device-longitudinal-start.log`, `device-task-routes-fixed.log`, `device-new-formal-reopen.log`, `device-keyboard-surfaces.log`, `release-events.jsonl`. Earlier failed attempts stay separate. `ANDROID_0_3_RELEASE.md` records timings, token estimates and unresolved limits: actual search supply, substantial formal-evaluation cost/startup delay, Synthetic Marketing Profile structural-only English plan, unexercised old task types, no ambient/GPU performance measurement and no store submission.


## Historical 0.2 acceptance matrix (not the current 0.3 result)

| Requirement | Actual evidence | Boundary |
|---|---|---|
| Repeated formal evaluation | Eight concurrent real existing-report requests reuse the persisted result; task count unchanged. Cross-process task claim and queued reuse regression passes. | A fresh formal evaluation did not complete in the model benchmark; rapid taps were not fully re-exercised on the phone. |
| Discovery lifecycle | Existing evaluated jobs are excluded and in-flight jobs are marked evaluating; backend regression and real API check pass. | Full close/reopen lifecycle after a newly generated evaluation not device-verified. |
| Structured search / relevance | JobPilot-owned provider layer, dedup, known-role removal, contract/date/location filtering, strong-vs-adjacent ranking, provenance and metrics are implemented. Compact fallback benchmark returned 3 clear Quant/Fixed-Income roles with 45% fewer input tokens than the old Agent-first search. | France Travail/JSearch credentials are absent, so their live latency/recall is not yet accepted. The inherited ATS adapter is benchmark-only/default-off. New search UI is built but not USB-tested on 0.2.1. |
| Unchanged CV analysis | Eight concurrent real requests return the same authoritative analysis without an agent or new task. Saved-analysis-only entry seen on device. | Old historical records are retained, not deleted. |
| Changed CV / history | Synthetic accept advances CV version once; stale/update state, old/new input, old analysis and resolved edits are verified. | Actual updated-analysis model runs failed during ACP setup; no claim of successful semantic continuity generation. |
| CV draft accept/reject | Actual rendered one-page PDF produced through the backend route; rejection preserves canonical bytes/version; repeated acceptance is idempotent and resolves only selected issues. | These decision tests used isolated synthetic data, not phone taps or real Candidate mutations. |
| Real CV preview | Actual one-page master-CV PDF displayed through native PdfRenderer on USB device. | Original imported Word layout and universal ATS compatibility are not certified. |
| Non-blocking task center | Native background launch, compact transient notice, recent business events and result routes implemented; no raw transcript in API task projections. | Complete start-to-result task-center journey after every operation not USB-verified. |
| Enregistré feedback | Success notice timeout is 3.5 seconds; persistent error and transient success are separate. | Exact disappearance timing not manually completed on the disconnected phone. |
| Home actionable filters | Actual high-match metric opened the correctly filtered list on USB device. Repeat-navigation fix included in 0.2.1. | 0.2.1 was not installed after the phone disconnected; remaining filter journeys not fully rechecked. |
| Profile isolation | Real three-profile snapshots, cross-profile job/task/report rejection and unchanged canonical CV bytes pass; deterministic version/draft tests are profile-scoped. | Full three-profile phone-switching pass belongs to remaining acceptance. |

Sixteen targeted regression checks and twenty-nine ATS self-checks from the 0.2 release work passed. Seven real API/isolated-backend acceptance checks are recorded in `20260908-acceptance.json`. After the structured-search integration, the complete Web suite reports **449 passed, 0 failed, 1 skipped** and typecheck passes. Native build passes; NO-SOURCE is not a UI test pass. 0.2.0 was installed, then the USB device disconnected; 0.2.1 build remains uninstalled, including the new search-metrics UI. See `ANDROID_0_2_RELEASE.md`, `AI_BENCHMARK_2026-09-08.md` and `JOB_SEARCH_ARCHITECTURE.md` for mechanisms, measurements and explicit failures.

## Historical 0.1 acceptance (not fresh evidence for 0.2.1)

## Verified on the connected Android phone

A Samsung Galaxy S24 Ultra, Android API 36, accepted the debug APK via USB install. The running package is `com.thegreatnovel.jobpilot`. The existing health application was not modified.

- Native home loads the selected profile's actual dashboard and applications.
- Profile switching clears the previous profile's display and shows the chosen candidate's CV/preferences.
- Android's system document picker opens the phone's Downloads directory. Selecting a synthetic DOCX returns to JobPilot with an editable, locally extracted preview. The preview was discarded, not saved as a real candidate's CV.
- The device switched from the debug loopback server to `https://jobs.thegreatnovel.com`. ADB reverse for port 3002 was removed. Profile switching and dashboard loading still succeeded through the remote host.
- Native application details display the saved match score, evidence and CV changes.
- A real existing tailored CV downloads through the authenticated gateway and opens Android's system share sheet as a PDF. The share sheet was dismissed; no email, message or application was sent.
- The authenticated in-app Web workbench opens the real Analytics screen and its navigation without a separate data store.

The installed APK is a debug build, not a Play Store release. Complete release signing, store publication, all screen sizes, all translated text, all keyboard states and every possible ATS page have not been certified by these checks.

## Verified API/data behavior

| Check | Evidence/result |
| --- | --- |
| Local and remote snapshots | Authenticated requests returned matching profile and application data. |
| PDF/DOCX/TXT upload | All three actual multipart uploads produced usable preview text. |
| Preview safety | Canonical CV stayed byte-for-byte unchanged before confirmation. |
| Confirmation path | A reviewed preview edited back to the original CV was saved through the existing backup API; canonical content remained unchanged. |
| Unsupported upload | An unsupported file extension was rejected. |
| Discovery | A real ACP web-search task completed and persisted three unscored, explicitly unconfirmed job URLs. |
| Candidate analysis | A real ACP profile analysis completed and persisted a structured answer. |
| Formal evaluation | A newly discovered official job was saved, evaluated and reconciled into the rich candidature from a persisted report: 3.7/5, with explicit documented gaps. |
| Fresh tailored CV | A new PDF was generated for that evaluated job. The actual PDF has one page and 2,704 readable characters; the existing ATS format checker returned 97/100. |
| Targeted interview plan | A real ACP plan for an existing job completed, including seven checklist actions and practice questions, and merged into the candidature. |
| Authentication boundary | Guest API requests are rejected. Public requests cannot use the optional local USB login. |
| Gateway isolation | A local HTTP integration test exercised profile allowlists, cross-origin write rejection, upstream credential stripping and session revocation. |
| Persistence | Web and gateway run as independent owner-logon Windows Scheduled Tasks rather than tool-session children. |

A search result is not proof of hiring compatibility or ongoing availability. Initial discovery included a contract-type mismatch; the shared prompt was tightened to respect explicit contract/seniority constraints rather than filling a quota with an internship for an experienced permanent-role search. That prompt change does not retroactively certify the old discovery results.

## Implemented but not yet independently certified by every path

Native comparison, answer feedback, manual reply/status/date editing, preparation checklists and advanced workbench routes are connected to real APIs. The pure-domain and gateway tests cover their common data/authentication rules, but every individual UI action, candidate/template combination and interview answer has not been exercised. One complete real discovery → saved offer → persisted official evaluation → fresh tailored PDF chain has been verified. A saved discovery card without its official report remains unrated.

Cloudflare DNS, tunnel ingress, owner-only bridge policy, signed application-specific identity verification and native pairing are configured. Remote authenticated API use from the actual phone has been verified. A fresh native login opened the correct protected Cloudflare page and reached its email/one-time-code form. No email code was requested or entered, so the complete OTP approval/exchange is not recorded as passed. The phone was restored to its working owner session and remote server afterwards. User-entered OTP approval remains a distinct manual acceptance step.

## Regression checks and observed repairs

The final Web type check and production build passed. The complete Web suite reported **428 passed, 0 failed, 1 skipped**. This includes the native-Node detached-helper import check, unscored-offer projection, mobile domain rules and authenticated gateway integration tests. Missing keyword inputs are displayed as unmeasured, not as a fictitious 0% keyword match; ATS format quality is distinct from role fit.

Observed issues fixed during integration:

1. A bounded command session could terminate child Web/gateway services. Scheduled Tasks now own them.
2. PowerShell's native stderr handling could terminate the service runner. Separate native stdout/stderr redirection avoids that failure.
3. MCP tool failures had been reduced to an empty result and a generic missing-run-ID error. The transport now preserves the actual tool failure and uses a process-global prompt queue across Next route bundles.
4. A Next-only import alias in the shared helper broke the detached evaluator's native Node loader. It is now a relative import, with a dedicated regression test.
5. A long CV-generation turn could overwrite intervening status/reply/preparation edits. The save now rereads and merges the latest candidature.
6. Newly saved discovery cards did not receive full analysis when an official report arrived. Report-backed hydration now updates those cards while preserving other curated data.
7. Dashboard response rate counted automatic acknowledgments and could lose history after archiving. Both cases now have deterministic tests.

## Data and user-action limits

Replies are manually recorded; the app does not silently synchronize or send email. Final application submission remains human-controlled. Scanned-only PDFs need a text-containing export; no OCR is silently invented. The PC, AgentDock and services must stay available for remote AI work. Closing a phone screen preserves task results; restarting the server can interrupt a non-detached mobile task, which is shown honestly as interrupted.
