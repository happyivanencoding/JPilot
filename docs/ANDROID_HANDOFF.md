# JobPilot Android — implementation handoff

## 2026-09-11 V1 0.4.3 final acceptance

App `6b3093f063103eec5bc8528a8dd07f106b88ce70` is deployed to the isolated V1 site; Android `0.4.3/code17` final APK was installed successfully on Samsung. Real Yuki/Mehdi first-use, My logout/relogin, independent insight language, four fully prepared French role cards and Mehdi's rendered role PDF are verified. New targeted behavior regression: 9/9. V1 role-CV draft scores now use the same bounded gain as Keep, rather than displaying an unrelated writing-quality score. Full evidence/limits: `V1_STUDENT_MATCH_LOOP_2026-09-10.md`.


## 2026-09-11 V1 0.4.3 / Web 0.6.3

V1 now uses per-session empty preview Profiles rather than fixed `louis`. First run defaults to English, allows independent UI/CV/insight languages, saves the chosen source CV in the background without exposing an extraction textarea, and presents personal strengths/directions and the first four scored role cards only when analysis plus DeepSeek translation are complete. My ends with session-revoking logout; another simulated Google sign-in can test a different CV. No changes to production Google authentication. Old requests, old CV versions and another Profile's tasks cannot populate the new session's results. Current V1 product/data semantics and real acceptance: `V1_STUDENT_MATCH_LOOP_2026-09-10.md`.

## 2026-09-11 V1 first-run CV upload runtime fix

- The Samsung V1 first-run `3/7` screen showed “这份简历没有成功读取” for `CV_Test_10_Yuki_Tanaka.pdf`. Raw VPS task evidence identified two server-runtime faults in sequence: first `spawn python ENOENT`, then `/usr/bin/python3: can't open file '/data/web/scripts/extract-mobile-cv.py'` after Python was added.
- The PDF itself is readable and extracts correctly on the development machine. The shared JobPilot Docker runtime now includes `python3` + `python3-fitz` and sets `JOBPILOT_PYTHON=/usr/bin/python3`; V1 backend resolves `extract-mobile-cv.py` from the Web process working directory instead of `CAREER_OPS_ROOT` (which is Candidate storage `/data` on VPS).
- No Android multipart/file-picker contract changed. The installed `0.4.2/code16` client can use the repaired server after deployment; a new APK is not required solely for this server-side fix.

## 2026-09-11 V1 first-run + retained search history — 0.4.2/code16

- V1 Android/Web now share the same first-run product journey: invite code → clearly labelled simulated Google account → real CV picker/ingest → editable extraction confirmation → real profile analysis → inferred/custom direction → real structured search → horizontally swipeable first 3–4 scored roles. Opening one of those cards exits onboarding into the normal offer detail instead of a parallel demo screen.
- The simulated Google step exists only in the isolated V1 preview package/site for owner testing; it does not replace production Google authentication. Android continues to use package `com.thegreatnovel.jobpilot.v1` / launcher `JobPilot V1` and `jobs-v1.thegreatnovel.com`.
- Home now leads with “这是你会闪光的地方。” and “你的优势在哪”. Repetitive `why`/qualification paragraphs were removed from the high-level strengths/direction cards and discovery cards; score, evidence, strengths/gaps and honest CV presentation potential remain.
- Ordinary V1 users no longer see the development-server URL or connection controls in “我的”. Account UI only explains automatic Android/Web sync, refresh and sign-out.
- The backend snapshot now exposes current search plus up to eight earlier completed V1 search groups for the same candidate version. Android and Web both render these under “之前看过的方向”, and historical cards still open their normal offer detail. Changing direction therefore no longer makes earlier results disappear.
- Release versions: Android `0.4.2/code16`, Web `0.6.2`, mobile contract `0.4.2`. Local Web typecheck/build and Android `assembleDebug` pass. The Samsung `SM_S928U1` has been upgraded in place and reports `versionCode=16 / versionName=0.4.2`; its UI hierarchy shows the new full-screen `1/7` invite page. Production/Yifeng apps are not overwritten.

## 2026-09-11 V1 AI bootstrap/search recovery — deployed preview

- V1 preview is now Android `0.4.1/code15`, Web `0.6.1`, mobile contract `0.4.1`, still isolated on `feature/v1-student-match-loop-20260910` and `jobs-v1.thegreatnovel.com`; it is not merged into production main.
- The first V1 preview falsely reused a pre-V1 completed analysis for the same candidate version, so `analysisState` looked complete while `careerDirections/searchKeywords` were empty. Analysis/search operation keys are now contract-versioned. Existing CV profiles expose `v1.needsBootstrap` until a current V1-shaped analysis exists; Android sends one idempotent background `bootstrapV1` POST per candidate version and Web mirrors the same behavior.
- V1 search also lacked server-side provider runtime variables. Its independent VPS runtime now has its own `jobpilot-v1/runtime.env`; France Travail and JSearch are configured without mounting production data or the production runtime.env path. An all-unconfigured search now fails explicitly rather than returning a fake successful zero-result task.
- Real `louis` acceptance: analysis completed in 37.809s / 11,185 tokens and persisted 4 directions + 8 keywords; JSearch returned 30 raw rows and the current ranking displayed Goldman Sachs 2027 Paris FICC & Equities Summer Analyst at 82/100; silent deep-match reached CV potential 87 / capability potential 94. A real tailored-CV request completed in 12.592s / 7,987 tokens and created a one-page pending draft.
- Samsung `SM_S928U1` was upgraded in place to `0.4.1/code15`. Real device UI showed the four generated directions; the Opportunities tab contained Goldman Sachs and score 82. Package remains `com.thegreatnovel.jobpilot.v1`, so production/Yifeng apps are not overwritten.

## 2026-09-10 V1 student match loop — branch origin

- Dedicated worktree: `C:\dev\jpilot-v1-student-20260910`; branch: `feature/v1-student-match-loop-20260910`, based on the then-current `origin/main@9c360e9`. This V1 was originally branch-only; the independent V1 preview is now deployed, still without merging production main.
- Android V1 began as `0.4.0/code14` and changes the primary IA to **首页 / 机会 / 我的**. Existing legacy screens remain in source for saved historical objects and later stages, but new V1 saved roles use a three-tab detail: **匹配 / CV / 跟踪**.
- Master CV confirmation/edit automatically starts silent profile analysis; explicit target roles remain authoritative. Analysis supplies career directions/search keywords, then a silent initial search. Every offer gets immediate deterministic 0–100 `fastMatch`; only the top five get read-only silent `deep_match` enrichment.
- Opening a discovered offer is read-only. The primary explicit AI action is **查看我的 XX 分版本**; only that action saves the offer and generates a role-specific CV. Role CVs always branch from the frozen Master input version and never chain from another tailored CV.
- Editing a tailored draft now triggers hidden `cv_review` automatically. Keep/reject remains explicit. Android task centre is secondary under “我的”; silent work never opens the old blocking launch overlay.
- Full product/data contract: `V1_STUDENT_MATCH_LOOP_2026-09-10.md`. Current preview parity is Web `0.6.1` / backend snapshot `0.4.1`.

Updated: 2026-09-10 (Europe/Paris). Samsung physically upgraded in place to **Android 0.3.8/code12**, existing session/data retained; **Web/backend 0.5.1**, contract **0.3.8**. Two explicitly selected instrumented methods passed on the real phone; the second confirmed actual PDF bitmap rendering and keyboard-visible input. A shared tailored-PDF emphasis bug was fixed and deployed. Full scope, data preservation, test interruption and untested paths: `DEVICE_ACCEPTANCE_2026-09-10.md`. Earlier release evidence below is historical.

**Repository authority:** `https://github.com/happyivanencoding/JPilot`. Android is the canonical frontend for JPilot product decisions. Web follows this native implementation; it is not a second desktop product. **Every Android UI/product update must ship and verify the equivalent Web behavior in the same development change/release; parity cannot be deferred and still be called complete.** Backend-only changes are the normal exception. `santifer/career-ops` is historical provenance only and its updater is no longer part of the JPilot development workflow. See `PROJECT_STRUCTURE.md`.

## Android 0.3.8 / Web 0.4.6 — onboarding + hide internal usage metrics

- Merged Yifeng's first-use onboarding on top of the current Android/Web product rather than replacing current main. Welcome + one-time guides cover Home, Offers, Applications, Prepare and Profile in zh/fr/en.
- "Skip guide" now suppresses all remaining tab guides; "Get started" keeps the per-tab first-visit walkthrough.
- Token counts and API-cost estimates are removed from user-facing task/search surfaces while internal metrics remain persisted. Existing ETA/progress UI remains user-visible.
- The collaboration branch is now `Yifeng`; CI and automatic PR maintenance follow `Yifeng → main`. Validation: Web Node **325/325**, Chromium/Edge **25/25**, WebKit **25/25**, Web typecheck/build PASS; Android `assembleDebug` PASS and `testDebugUnitTest` currently `NO-SOURCE`. The persistent Web service was restarted and local `/api/mobile` reports **0.3.8**; ADB had no connected device.

## Android 0.3.7 / Web 0.4.5 — collapsible interview plan + inline AI ETA progress

- A generated interview plan in Job Detail → Interview now has a persistent **Interview preparation plan / 面试准备计划** header with an explicit **Collapse / Expand** control. The plan is expanded by default; collapsing removes the long Markdown body from the reading flow while keeping the plan and its update action available. No plan data is rewritten by this UI action.
- Model-backed actions now use a shared `AiProgressButton`: CV/ability analysis, formal role evaluation, tailored CV generation, tailored-CV reassessment, interview-plan generation/update, practice feedback and career coach. Pasted-URL/discovery evaluation uses it as well. The button itself becomes a semi-transparent progress surface instead of leaving only a generic disabled button.
- The displayed percentage is deliberately **approximate ETA progress**, not model-reported completion. Given backend `targetSeconds=T` and elapsed `t`, the active UI uses `0.96 × (1 - exp(-3t/T))`; it moves faster early, visibly slows near the end, and never exceeds **96%** while the task is active. A real `completed` state makes the button quickly finish at **100% / Completed**. `failed/interrupted` ends the estimate and exposes the failure instead of letting the button appear stuck.
- The existing centered background-task ETA ring follows the same curve and now also snaps to `✓ / Completed` on a real terminal success. Android polling detects an active task becoming failed/interrupted, clears the launch overlay and opens the failed task/error surface so a background failure cannot disappear silently.
- Android `assembleDebug` passes for **0.3.7/code11**. The generated APK is `android/app/build/outputs/apk/debug/app-debug.apk`. At release verification time `adb devices` returned no connected device, so physical-install acceptance is intentionally deferred rather than fabricated.
- Web parity ships in **0.4.5** in the same change. Its synthetic Chromium/Edge and WebKit suites are both **24/24 PASS**, including real collapse/expand semantics, active inline `≈NN%` progress, completed 100% snap and failed-task error visibility. Production Next build passes. `start-mobile.ps1 -RestartWeb` restarted the persistent service and local `/api/mobile` reports backend contract **0.3.7**.

## Android 0.3.6 / Web 0.4.4 — tailored CV proposal/review loop

- Job-specific CV generation no longer writes directly into the accepted `job.cv`. The `cv` task now produces a **pending `job.cvDraft`** with a real PDF, ATS audit and a same-job presentation comparison. Only explicit **Keep this version / 保留这个版本** promotes that draft into the accepted job-specific CV; Reject leaves the previously accepted CV untouched.
- The comparison score is a **0–100 CV presentation score for the same candidate and the same job**, not hiring probability and not the official 0–5 job-fit score. It measures how clearly existing documented evidence is selected and surfaced. The master-CV baseline is frozen at the first assessment; later manual edits remain comparable to that same baseline.
- The visible presentation score is monotonic by product rule: a rewrite may improve the score or leave it unchanged, but it never displays a lower score than the original baseline. If the model judges a rewrite worse/equal, JobPilot shows **+0** and explains that further gains require substantive evidence such as experience, skills, language, location/start-date fit, rather than more wording polish. Regression: raw `60 → 49` is exposed as `60 → 60 (+0)`.
- Users can manually edit the tailored draft (summary, experience bullets, project/education descriptions and skills), save to regenerate the PDF locally, then launch `cv_review` to reassess the edited draft **without regenerating the CV content**. Explicit rerun semantics allow deliberate new CV candidates/reviews while repeated clicks still share an active task.
- ATS warnings no longer turn a successfully generated PDF into a failed CV task. The previously failing Yueyue synthetic case now completes with **ATS 72/100** plus contact/font warnings. A fresh v2 synthetic generation completed in about **28.6s**, produced **68 → 82 (+14)**, and did not invent the earlier unsupported relocation willingness.
- App-language switching localizes the **draft analysis layer** (`summary`, improvements, remaining gaps, ATS warning prose and change notes) while `cvDraft.payload` remains in the configured application-document language. A real French request now returns French analysis while the English draft CV stays byte-equivalent in language/content.
- A real bug was found in display localization cache validation: some `locale=fr` segment files contained unchanged Chinese text, so the UI treated Chinese as a completed French translation. Cached/new translations are now target-language validated; invalid cache is automatically retranslated and invalid provider output is never committed. The installed Samsung was force-reopened in French and its native CV page showed `Brouillon de CV adapté`, `CV actuel`, `Ce brouillon`, `D’où vient l’amélioration` and French analysis text.
- Android **0.3.6/code10** was built with a single-use Gradle daemon after one reused Gradle daemon process disappeared before compilation, then installed successfully with `adb install -r`; `dumpsys package` confirms versionCode 10 / versionName 0.3.6. Web/backend is **0.4.4 / 0.3.6**.

## Android 0.3.5 / Web 0.4.3 — stable drawers, chronological applications and exact evaluation identity

- The CV analysis drawer bug was traced beyond the visible overscroll effect: once the inner list reached its edge, Compose propagated the remaining nested-scroll delta to `ModalBottomSheet`, moving the whole sheet. All six current native BottomSheets now block **unconsumed vertical nested scroll/fling at the content boundary** while leaving direct handle/sheet dismissal intact. Their inner lists also disable edge overscroll. This covers CV analysis, job detail, task detail, task center, comparison and master-CV editing.
- Physical Samsung acceptance after installing **0.3.5/code9**: CV analysis was scrolled to the bottom and then swiped upward again; the before/after semantics had **0 visible bounds changes**. The same edge test on task center and job detail also had **0 bounds changes**. No AI task was started for this acceptance.
- Applications no longer mixes action reminders with lifecycle categories. Primary categories are chronological: **All → Prepare → Applied → Replies → Interviews → Offer/Hired → Closed**. `High match`, `Follow up` and the former `Decide` remain quick filters only; the latter is now labelled **Evaluated to apply / 已评估待投递**, not a lifecycle state.
- Every Applications category has a **Filter & sort / 筛选与排序** control. It can show all/evaluated/unrated roles and sort by score high→low (default), score low→high, or recently updated. Unrated roles sort after real scores in the default view.
- Discovery evaluation now means **save first, then evaluate**. Single-card and bulk evaluation carry the discovered offer to the shared backend; the backend persists the exact URL before creating/reusing the evaluation task, so a failed/interrupted evaluation remains recoverable and a later search knows the URL is already saved. The canonical pipeline writer is invoked directly in-process rather than through localhost loopback HTTP.
- The two Yueyue synthetic roles that remained forever in `Evaluate all unrated` were already successfully evaluated. The real bug was identity drift: legacy tracker reconciliation could merge distinct postings with the same company + role even when their URLs differed. JobPilot now treats an available normalized URL as authoritative, projects completed exact-URL evaluation tasks back onto stale candidature cards, accepts valid **0.0** scores, and removes mismatched report links/details instead of showing another posting's report.
- Existing synthetic data was repaired **without any model call**. The two stuck cards now project as evaluated at 1.0 and 0.5, and the public 0.3.5 backend reports **0 unrated Yueyue roles**. A separate same-title Salesforce card was corrected back to its own exact-URL 1.5 score instead of inheriting 1.0 from the other posting.
- `Evaluate all unrated` now sends an explicit retry for failed/interrupted prior evaluations instead of silently reusing the old terminal failure. Existing completed results remain idempotently reused.
- Verification: Web TypeScript and production build pass; targeted persistence/evaluation suite **19/19**; full Node suite **321/321**; Chromium/Edge and WebKit synthetic browser suites each **22/22**; Android `assembleDebug` passes; `git diff --check` passes.

## Android 0.3.4 / Web 0.4.2 — AI ETA + circular estimated progress

- Every active AI task now exposes a concrete estimated duration instead of a generic “few minutes” message whenever the current flow is known. With **3+ comparable successful production runs** for the same flow/model/reasoning, the estimate uses that profile’s recent production history. Until then, it falls back to conservative ranges derived from the verified direct-model acceptance: analysis/plan 20–45s, evaluation/practice 10–30s, tailored CV 5–20s, compare/coach 15–35s.
- The centered AI launch acknowledgement and the task-center row both render an **ETA ring** plus a live “预计剩余 …” label. The ring is explicitly elapsed-time-versus-ETA, not model-reported completion. It is capped below 100% while the task is active; once the estimate is exceeded the UI says the estimated time has been exceeded and that processing is still continuing instead of showing fake completion.
- Batch AI launches use the slowest active task’s estimate for the centered acknowledgement; every individual task keeps its own estimate in the task center. Android and the phone-first Web use the same backend `targetSeconds` contract.
- Physical Samsung acceptance on 2026-09-09: Android 0.3.4/code8 installed with `adb install -r`. A synthetic Yueyue plan showed **预计剩余 43 秒 → 21 秒** against **预计耗时 20–45 秒**, then completed in **40.0s / 9,451 tokens / ~$0.0056 API-equivalent**. A second synthetic practice task was deliberately left active while the task center was open; it showed **预计剩余 16 秒 / 预计耗时 10–30 秒** and completed in **12.894s / 12,085 tokens / ~$0.003727**. No real Candidate profile was used for this ETA acceptance.
- Web 0.4.2 production build passes. Isolated Chromium/Edge and WebKit browser suites each pass **22/22** and now assert that the AI launch overlay contains the ETA ring and estimated remaining time. Web TypeScript and the 16 targeted persistence/ETA checks also pass; Android `assembleDebug` passes.
- Project delivery rule changed: after any source-code modification, relevant checks → task-scoped commit → push to `origin/main` are now part of the task by default unless the user explicitly says not to push. Do not include unrelated parallel dirty work.

## Android 0.3.3 / Web 0.4.1 synchronized interaction release

- Applications has a one-tap **evaluate all unrated** action. Offers has **select all pending**, per-row selection, then bulk **save** or **evaluate**. Batch evaluation reuses the existing per-operation idempotence instead of creating a second evaluator path.
- AI actions now produce a centered “processing in the background” acknowledgement; after explicit confirmation it shrinks/fades toward the top-right task center. The task itself remains server-side and survives navigation.
- Job detail Interview → “Practice this question” fills the selected question and automatically scrolls to Targeted practice, including the answer field and feedback submit button.
- Offers disables edge overscroll. On the installed Samsung, repeated bottom swipes followed by an additional bottom-edge swipe produced byte-identical UI semantics with unchanged final-card bounds; the previous bottom-edge jitter was not reproduced.
- Tailored CV generation no longer passes an empty `--keywords` argument to ATS verification. A synthetic empty-keyword regression completed the model → PDF → ATS flow in 8.220s. Formal evaluation also removed a post-run loopback HTTP dependency after the full AI-call acceptance exposed it.
- Physical Samsung checks confirmed the new select-all control and `收藏 5 / 评估 5` bulk actions, the Applications `一键评估所有未评估岗位` control, practice auto-scroll, and the centered background-task acknowledgement. One synthetic-profile evaluation launched from the installed app completed in 12.602s and persisted its official report.
- Web 0.4.1 mirrors all of the above. Edge/Chromium and WebKit isolated action suites each pass 22/22 groups. Web TypeScript, the full 317-test Node suite, production build and Android assembleDebug all pass.

## Web counterpart — 0.4.1, 2026-09-08

The Web root now serves the JobPilot phone-first product, following this Android implementation, with a 384×832 desktop portrait frame and the same five core destinations. The old AppShell/sidebar/pages are retired; historical Web routes redirect into the new product. Do not reintroduce the original upstream workbench as an advanced or Classic option. Existing Android browser links therefore open the new Web experience too.

See `WEB_ANDROID_PARITY.md` for implementation and exact acceptance: 21 isolated action groups each in Edge/WebKit, and 10 real GET-only groups each in Chrome, normal-window Edge and WebKit. Shared saved data and real PDF rendering were verified. No Android source, APK or physical USB installation was changed by this Web release; WebKit tests are not Mac/iPhone device acceptance. The backend mobile contract stays 0.3.2. Existing language/AI latency limitations below remain applicable.

## Current language acceptance boundary

0.3.2 is installed and the public-phone document/locale safety test passes: Chinese UI, Synthetic Finance Profile French one-page PDF, Synthetic Marketing Profile English one-page PDF, zero new business tasks/score/CV-version changes, and cached Chinese/French/Chinese switching. Synthetic Finance Profile's analysis is visibly Chinese. **Do not report full translation acceptance:** Synthetic Marketing Profile still had 13 pending explanation segments at the successful safety snapshot, and some historical report translations remain failed/unverified because ACP cold-start/turn latency is long. Resume the existing profile-scoped localization operations rather than rerunning business AI. See `ANDROID_LANGUAGE_SEPARATION.md` and the new 0.3.2 section of `MOBILE_ACCEPTANCE.md`.

## Formal evaluation runtime — transport-only ACP

The public backend now treats AgentDock/ACP strictly as a model transport. Formal evaluation uses the current `FLOW_DEFAULTS.evaluate` choice (**gpt-5.6-luna / low** in current code), with no model terminal/filesystem/web/browser/plugins/skills/sub-agent access. The backend embeds frozen Candidate evidence and the available JD, validates the model JSON, then owns report numbering, Markdown/Machine Summary generation, tracker TSV and merge. This is server-side; Android 0.3.2/code6 does not need reinstalling.

The same fictional compact evaluation prompt through transport-only ACP took 23.537/22.624/22.508s (22.624s median), ~16.38k input/run and ~$0.00440/run, with zero tool events and 2.5/3.0/2.5 `conditional` decisions. A complete isolated formal-evaluation E2E took 22.298s, 16,652 input + 1,017 output and ~$0.00455, then persisted and merged a real synthetic report. Direct Luna remains faster (~10s on the same compact prompt), so ACP still carries Codex base-context overhead; that is now the remaining transport tax rather than repo/tool work.

The older Synthetic Marketing Profile Sol/medium product reports at 556.615s/~1.37M session tokens and 755.455s remain historical evidence of the former coding-agent architecture, not the current runtime. The new report deliberately marks research-only company/legitimacy/culture axes `not_evaluated` when the backend has not supplied them. Do not re-enable agent web/terminal access to enrich them; add deterministic backend evidence instead. Full measurements and the controlled same-prompt quality comparison are in `AI_BENCHMARK_2026-09-08.md`.

## Current 0.3.1 search patch

The search product now uses a contract-first soft-ranking model. An explicitly incompatible contract is removed; an unknown contract is retained and labelled for confirmation. Role family, seniority/experience, French level and geography are soft signals, with `strong`, `adjacent` and last-resort `closest` tiers. Do not reintroduce the old behavior where one seniority/location/language check empties Discovery.

Geography is intentionally flexible: Paris/Île-de-France first, then France, then other European countries / European remote, with outside-Europe only lower fallback. JSearch still makes at most three normal search requests; for flexible-European profiles the third existing probe is Europe-wide rather than country-locked. The Android card can surface `closest`, seniority, role-family, same-country, other-Europe, outside-Europe and unknown-contract labels.

The root Synthetic Marketing Profile failure is verified: the old phone task fetched 33 raw rows but removed 24 unknown-contract rows and returned zero. Current `search-v5-soft-ranking` native instrumentation on the authenticated public host created a new task and returned **6 CDI roles (3 strong, 3 adjacent, no AI fallback)** in about 6.9 s. The earlier `Chef de rayon produits` false strong-match was repaired before final acceptance. Latest targeted touched regressions: **44 pass / 0 fail**. Evidence lives in `.career-ops-web/mobile-qa/search-soft-ranking-20260908/` and profile-scoped task history.

## Current 0.3 continuation

Read `ANDROID_0_3_RELEASE.md` and `CV_ATTENTION_MODEL.md` before the historical notes below. The previous phone-disconnection gap is closed for the installed 0.3 app: exact home filters, four-profile isolation, Synthetic Finance Profile actual PDF draft reject/accept, v1→v2 history, automatic notice dismissal, native-started longitudinal analysis, saved view-only result reuse and the newly completed formal report after process reopening all have real device evidence. The final keyboard/light-dark check also passes; physical ambient-brightness/GPU measurements and all historic task types do not.

A new global CV plan allocates the whole page instead of expanding every paragraph. Native chrome uses restrained petroleum/teal tonal translucency (not real-time blur), while CV/job text stays opaque. Search uses one shared ranking stage across provider and AI results. The second synthetic Marketing persona remains isolated. Its **0.3.0 baseline** had only one French-heavy adjacent result; that search conclusion is superseded by the 0.3.1 section above. Store release remains unclaimed.

Post-0.3 provider update: France Travail and JSearch credentials are now configured only in the local Web runtime (never in the APK). A credentialed synthetic Paris Quant benchmark returned 84 raw rows, 82 deduplicated rows and 7 strong results in 3.66 seconds without Agent fallback; France Travail returned 54 rows in 573 ms and JSearch 30 in 3.60 s. All final rows had dates, but none was within 7 days, which the native metrics panel reports rather than concealing. See `JOB_SEARCH_ARCHITECTURE.md` for the quality and cost interpretation.

New official report #8 and the CV v2 longitudinal analysis are successful. Formal generation still took 12m35s and substantial tokens; startup latency remains variable. Earlier setup failures are retained. Full real measurements, recovery without extra AI, final QA paths and remaining limits are in the release document. The old benchmark matrix was not rerun.


## Historical 0.2 handoff — superseded by 0.3 where different

The authoritative release delta and verification boundaries are in `ANDROID_0_2_RELEASE.md`, `MOBILE_ACCEPTANCE.md` and `AI_BENCHMARK_2026-09-08.md`, subordinate to the root `DEEP_CONTEXT_HANDOFF_FINAL.md`.

The native app no longer exposes the embedded Web workbench. It uses a professional blue/slate palette, compact native lists and working home filters. The existing shared canonical data remains in place. Native task launches stay in the background; the task center links to saved results and exposes real timing/tokens with explicitly estimated API-equivalent dollars. No raw transcript is shown there.

Backend entry points use a cross-process, profile-scoped persistent task/result gate. CV analysis is versioned, reused when unchanged and split into expression edits versus real actions. A deterministic suggestion application creates a separate PDF-rendered draft with current/proposed views; acceptance changes the canonical CV with history, while rejection does not. Structured contract types participate in discovery.

Do not report final native UI tests as passing: `testDebugUnitTest` previously had NO-SOURCE. Build/install evidence and API acceptance records are in the ignored `.career-ops-web/mobile-qa/20260908-*` files. 0.2.1 builds, but its post-disconnection changes have not been exercised on the phone. Fresh formal-evaluation generation and live updated-CV continuity benchmarks did not reach verified success. Resolve those from existing artifacts rather than repeating all previous model calls.

### Search architecture added after the 0.2 release work

Job discovery now goes through the JobPilot-owned `web/src/lib/job-search/` boundary; see `JOB_SEARCH_ARCHITECTURE.md`. Android does not need to know whether a result came from France Travail, JSearch, a temporary inherited ATS adapter or the compact Agent fallback.

The Opportunities screen now displays per-search measurements: result count, strong vs adjacent relevance, wall time, date/freshness coverage, provider status and estimated API cost when non-zero. Each row can show source, posting age, deterministic search relevance and an `adjacent opportunity` label. This is search relevance only; no candidate fit score is assigned until the persisted formal evaluation.

The product intentionally ranks rather than exact-gates niche searches. Strong Quant/Systematic/Investment matches come first; when the market is sparse a small number of nearby Portfolio / Risk / Treasury / Financial Engineering roles may remain as explicitly adjacent candidates. Commercial/general-tech noise is still filtered. Dated structured results older than 120 days are removed from ordinary discovery by default.

France Travail and JSearch adapters are implemented but were not live-tested because their credentials were absent. The inherited tracked-ATS adapter is disabled by default because its current Paris-Quant cold benchmark is still slow and its company universe is weak for this target. With no production structured provider available, the compact Luna/low fallback still runs; its synthetic benchmark reduced input tokens from 298,316 to 163,653 and wall time from 54.6 s to 45.1 s while returning three clear Quant/Fixed-Income roles. This is a fallback, not the desired production latency.

The latest search UI changes were compiled into 0.2.1 after the USB device had disconnected. They are **not** device-tested yet. Current backend regression after this search change: 449 pass / 0 fail / 1 skipped; typecheck passed.

## Historical 0.1 implementation notes

The following section describes the original delivery. Its Web-workbench, visual and repeated-analysis behavior is superseded by the 0.2 section above; retain the infrastructure details where still applicable.

## Product and delivery boundary

The five primary journeys are native Jetpack Compose: overview, discovery, application tracking, preparation, and profile/CV. Advanced existing Web tools remain available through an authenticated in-app workbench. This is not a claim that every old Web screen has been rewritten in Compose.

The visual direction is indigo and apricot, rounded translucent cards, a floating bottom navigation, restrained transitions, pull-to-refresh, and keyboard-aware forms. French is the initial interface language; Chinese and English UI choices and light/dark/system appearances are implemented. Existing reports and some server progress labels retain their source language.

The current deployment serves one owner's private workspace with multiple candidate profiles. It is **not a hosted multi-tenant product**. Do not add another owner account to the gateway until all legacy report/file endpoints have had an authorization review. Profile switching separates candidate data inside the owner's workspace.

## Data authority

No mobile candidate database was added. Candidate CV/config/notes, inbox, tracker, reports and rich candidature files remain the existing profile-scoped authorities. The classic pipeline already projects rich-cockpit status and CV readiness; do not create a second competing status store.

Only operational mobile task records are new, under `.career-ops-web/profiles/<profileId>/mobile/tasks/`. These contain private inputs/results and must never enter Git. The app keeps its session in Android Keystore-backed encryption and its selected profile/appearance in app preferences. It does not persist a second full CV or application database.

A phone upload goes through Android's document picker, multipart upload, local extraction, editable preview, and explicit confirmation. Only confirmation calls the existing CV-save API, including its backup behavior. The original temporary upload is removed after extraction. PDF must contain selectable text; encrypted/scanned-only PDFs are rejected with an actionable message. PDF, DOCX, TXT and Markdown are supported up to 12 MiB, with extracted-text and document-size limits. The import does not invent, enrich or rewrite candidate facts. Confirming a replacement makes it the new reference; removed facts will no longer inform subsequent analysis.

Discovery proposes unconfirmed URLs and never assigns a fit score. Formal evaluation uses the existing detached evaluator and requires persisted report/tracker evidence. Existing scores are snapshots: importing a new CV does not silently rewrite old scores. Tailored CV generation uses the current candidate's documented evidence, the existing renderer, PDF and ATS checks.

Application notes, dates, status history, replies and preparation checklists are saved into the same rich candidature record used by the Web. Replies are entered manually, not automatically read from email. Automatic acknowledgments are excluded from the human response rate. An archived record retains its recorded sent/reply history. Follow-up dates use the Europe/Paris calendar.

## Runtime and networking

The network path is:

`Android / browser → Cloudflare → JobPilot gateway (127.0.0.1:3002) → existing Web (127.0.0.1:3000) → local files / AgentDock ACP`

The configured hostname is `jobs.thegreatnovel.com`. The existing tunnel and unrelated applications are preserved. Only the gateway is published, never the unauthenticated Web origin or AgentDock itself.

For an in-person demo on the owner's trusted LAN, `web/scripts/start-lan-demo.ps1` starts a separate on-demand HTTP reverse proxy (default `LAN_IP:3003`) to `127.0.0.1:3000`. It keeps the Web server loopback-only and leaves Cloudflare Access on the public hostname unchanged. The proxy translates only same-origin LAN request headers back to the loopback origin so the existing Web API origin/Host guard still rejects cross-site requests; a matching Windows Firewall rule is restricted to that local address/port and `LocalSubnet`. The LAN endpoint intentionally skips Cloudflare/application login, so use it only on a trusted local network and stop it with `web/scripts/stop-lan-demo.ps1` when the demo is over. It runs as the on-demand `JobPilot LAN Demo` Scheduled Task with no automatic trigger; runtime state is stored only in ignored `.career-ops-web/lan-demo.json`.

Cloudflare Access protects `/api/mobile-auth/bridge` with a JobPilot-specific audience and an allow policy. Other paths are protected by the gateway's own application session; do not bypass that session merely because a request reached Cloudflare. The gateway verifies the bridge JWT's signature, issuer, audience, expiry and allowed email. By default it is an owner-only workspace. An explicit `workspaceMode: "shared"` may add collaborators only when every account has the identical profile grants; it is not a multi-tenant authorization model. Native login uses an expiring request/verifier pair and explicit browser approval. Application sessions expire after 30 days and can be revoked by logout. The browser workbench uses an HttpOnly same-origin cookie.

Private configuration: `.career-ops-web/mobile-access.json`. Private session store: `.career-ops-web/mobile-sessions.json`. Provisioning credentials come from the existing current-user environment and are never written to public files or the APK.

`/api/mobile-auth/dev` is an optional USB debugging login. It requires `JOBPILOT_USB_LOGIN=1`, loopback Host and no Cloudflare/forwarded-origin markers. It is not a production login, and a public request must be rejected. Release builds do not expose the USB login button.

The PC, Web engine, gateway, Cloudflare tunnel and AgentDock must remain available. This is remote access to the user's PC, not independent cloud hosting or on-phone AI execution. Closing a phone screen does not cancel a running task. Results are persisted server-side. Restarting the Web process can interrupt mobile analysis/search; such tasks are explicitly marked interrupted, not completed. Detached formal evaluation may still finish and should be reconciled before retrying.

## Build and start

Use JDK 21 to run the Gradle wrapper. The current Android Studio bundled JDK 25 is not compatible with this project's Gradle/Groovy runtime. Android compile/target SDK is 36, minimum SDK 26; Kotlin is 2.2.20, AGP 8.13.0 and Gradle 8.14.3. `android/local.properties` must point to the local Android SDK and stays ignored.

```powershell
# From the project root
cd web
npm run typecheck
npm test
npm run build
cd ..\android
$env:JAVA_HOME = '<path-to-jdk-21>'
.\gradlew.bat :app:assembleDebug --console=plain --no-daemon
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`. This is a development/debug APK, not a signed Play Store release.

```powershell
# Initialize owner access from the existing default profile; preserves existing config.
node web\scripts\init-mobile-access.mjs

# Start or register persistent owner-logon services.
.\web\scripts\start-mobile.ps1
# After a Web build:
.\web\scripts\start-mobile.ps1 -RestartWeb
# Explicit local USB debugging only:
.\web\scripts\start-mobile.ps1 -RestartGateway -UsbDebug
```

The startup script creates `JobPilot web` and `JobPilot gateway` Windows Scheduled Tasks for the logged-in owner, with no execution time limit and bounded restart-on-failure. Services are independent of the command session that requested them. Logs live in `.career-ops-web/mobile-logs/`.

**Observed engineering issue:** launching servers directly as children of a bounded AgentDock command allowed the command job cleanup to terminate them. Windows PowerShell 5.1 also promoted native stderr to a terminating error when using `*>>` under `$ErrorActionPreference='Stop'`. The scheduled runner now uses `Start-Process -Wait` with separate stdout/stderr file redirection. Do not revert to the failed startup patterns.

Cloudflare provisioning is idempotent and separate from ordinary startup:

```powershell
.\web\scripts\configure-mobile-cloudflare.ps1          # inspect only
.\web\scripts\configure-mobile-cloudflare.ps1 -Apply   # explicitly provision
```

Do not rerun provisioning merely to restart the application. The script backs up the old tunnel config privately, preserves unrelated rules and checks the resulting DNS, policy and route.

## Source map

- `android/app/src/main/java/com/thegreatnovel/jobpilot/`: native UI, API client, state, session vault and secured workbench.
- `web/src/app/api/mobile/`: mobile snapshot/actions/upload API.
- `web/src/lib/mobile-engine.ts`: profile-scoped tasks and orchestration.
- `web/src/lib/mobile-domain.mjs`: pure status/dashboard/offer/update rules.
- `web/src/lib/job-search/`: JobPilot-owned structured discovery providers, ranking, provenance, freshness metrics and compact fallback prompt.
- `web/src/lib/explore-search.ts`: historical Web/ACP discovery prompt; mobile search no longer depends on it as the primary path.
- `web/src/lib/agentdock-acp.ts`: existing ACP transport, now with one process-global prompt queue.
- `web/src/lib/agentdock-result.mjs`: preserve MCP tool-level failures instead of turning them into empty successful objects.
- `web/scripts/extract-mobile-cv.py`: local CV text extraction, no OCR/network.
- `web/scripts/mobile-gateway.mjs`: app sessions, Cloudflare identity verification, profile selection and proxy.
- `web/scripts/*mobile*.ps1`: provisioning and persistent runtime startup.
- `web/tests/lib/mobile-domain.test.mjs`, `agentdock-result.test.mjs`, `web/tests/mobile-gateway.test.mjs`: regression coverage.

## Concurrency and truthfulness fixes

CV generation now rereads the candidature store after the AI turn and merges only the generated CV and related readiness flag. It must not overwrite status, replies or training edits made during generation. Newly saved discovery cards are hydrated from a later official report without overwriting manually curated analysis on unrelated cards.

Next can bundle the ACP helper separately for different routes. Its concurrency queue therefore lives on `globalThis`, with direct transfer of a reserved slot to the next waiter. MCP tool errors are parsed explicitly: quota/startup failures must not become an empty result followed by a misleading `no run id` or a successful zero-offer search. The mobile search calls the same shared prompt/ACP adapter directly, preserving its actual task result and error.

## Acceptance and next work

See `MOBILE_ACCEPTANCE.md` for concrete checks and remaining limits. Private evidence is in `.career-ops-web/mobile-qa/`; do not publish it. Keep the root `DEEP_CONTEXT_HANDOFF_FINAL.md` updated with live facts. Do not reset or clean a dirty worktree, and do not commit/push unrelated changes or private files.

## 0.5.0 backend-only replacement

The current Android 0.3.8/code12 interface and backend contract 0.3.8 are unchanged. Its shared server now runs JobPilot-owned ledger/inbox/PDF/search adapters without the former root Career-Ops execution engine. Do not reintroduce that engine or copy executable files into private Candidate directories. See `OWNED_CORE.md` for replacement scope and current validation. Android was built, not installed or tested on a device in this release.
