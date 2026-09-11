# JobPilot 0.3.2 — display language and application documents

## 2026-09-11 V1 0.4.6 delivery completed

V1 Web 0.6.6 is live at source `7b85455ec339c986edf4583053969802cff2f6dc`; Samsung `.v1` 0.4.6/code20 was upgraded without clearing data, and the APK is in its Download folder. Live EN-source → ZH-insights → FR-role-CV acceptance, confirmed-contract first results, consistent reviewed scores and corrected real-PDF overlays passed. Details and native/Web verification boundaries: `docs/V1_0_4_6_RELEASE.md`. Production/Yifeng container IDs and start times unchanged. Ongoing parallel privacy/score-breakdown work is outside this release.


## 2026-09-11 V1 0.4.6 / Web 0.6.6 — first-run and role-CV continuity

Implemented in the independent V1 feature branch: required contract choice at upload; shared full-screen CV/search waves without approximate signs; simpler first-result deck; unified language settings with optional independent insights language; bilingual role recall without a document-language filter; prominent role-CV card/detail entries; frozen match basis and consistently reviewed draft scores; real-PDF change overlays with original-version comparison. Android 0.4.6/code20 and Web 0.6.6 remain paired.

Local Node/PDF/build/browser gates have passed; live rollout and phone receipts are recorded separately in `docs/V1_0_4_6_RELEASE.md`. The controlled-model browser check is not a live AI acceptance. Preserve main/Yifeng and existing private data.


## V1 override — 2026-09-11 / Android 0.4.3 / Web 0.6.3

The isolated V1 line supersedes the historical two-language UI rule below: **UI language** controls menus/buttons and starts in English for new installations; **insight language** (`config.display.analysis_language`) independently controls strengths, growth suggestions, directions and role-match explanations; **CV/source language** is chosen during upload, with the existing application-document language kept separate from display translation. English and French source/document choices, and Chinese/French/English UI/insight choices are available. A source upload initializes document preference to its selected source language; My can change later document preference.

V1 generates orientation/role insights in English, then uses the existing DeepSeek translation transport to prepare the selected insight language. The API withholds each section/batch until its current-CV analysis and translation are complete. Language-only preference changes are presentation changes, not new Candidate evidence. Real acceptance: English UI + French insights + English rendered Mehdi CV; Chinese UI/insights for Yuki. No production Google-login or main release migration is implied by this V1 override.


Date: 2026-09-08 (Europe/Paris). Continuation task: `tsk_80f0b40792c1d4db`; original task: `tsk_309034c71b513440`.

## Authority and recovery

The original request was recovered from the shared conversation `6aa023ff-2d28-83eb-9808-f55ced2557e1`, not inferred from its failed final assistant message. The previous task had already implemented much of the language contract, persistent display localization and native settings. This continuation retained those files and the parallel AI-runtime/LAN work. No reset, clean, stash, upstream update, commit or push was performed.

## Independent language contracts

| Concept | Authority | Effects |
|---|---|---|
| App/display language | Android local `language` preference, sent as `X-JobPilot-Locale`; `zh`, `fr`, `en` | Product chrome, errors/status, analysis/explanations, evaluation/report prose, preparation, comparison and task-result presentation. Never derived from the CV. |
| Default application material language | Profile `cv.language`; `fr` or `en`, otherwise the existing CV language | Explicit future tailored-document generation. Changing this preference does not translate or overwrite existing CVs. |
| Existing document language | Detected canonical CV language, with profile default as fallback | Evidence-based rewrites, saved global-plan application and master PDF keep this language, even when the UI/default material setting differs. |

Legacy `language.output` is not a shared authority. `candidateVersion` ignores a preference-only `cv.language` change; business operation keys ignore UI language, while genuinely new tailored materials distinguish the material language. New prompts explicitly separate explanatory prose from `before`, `after`, source quotations and `targetBlocks.text`.

## Historical display localization

`display-localization.ts` projects cloned saved results through an allowlist. Source CVs/JDs, IDs, numbers/scores, original machine-state enums, user notes, accepted resolutions, before/after replacements and material text are not translation targets. Numbers, dates, URLs, CEFR levels, code and explicit source quotations are protected tokens; an incomplete or altered token set rejects the entire response before any segment is cached.

Persistent cache: profile-scoped `mobile/localizations/<locale>/{segments,operations,results}`. Source-addressed segments are reused by multiple views; result manifests bind source content, identity and locale. This hash replaces an expensive model call, not the business result identity. Translation operations are separate from `mobile/tasks`: opening a report or changing the display language cannot masquerade as a new evaluation, CV analysis or search. Failed/interrupted translations expose a localized retry notice and preserve the original record; they are not silently retried in a loop.

The main snapshot translates visible analysis/discovery/follow-up explanations. Full historical job prose is lazy: a job detail, the selected training job, or the jobs currently being compared request it. Task-result routes now fetch the relevant job details. Reopening an already localized result uses disk cache. PDF metadata can update/retry without downloading or regenerating the document again.

The single fixed product dictionary is `web/shared/jobpilot-i18n.json`. Both the backend and Android assets read that file. It must remain inside the pinned Web Turbopack root; a static import from the former repository-root `shared/` directory passed Node tests but failed the production build.

## Additional defects repaired during continuation

- CV authority test now JSON-decodes the embedded source instead of falsely requiring raw newlines inside JSON.
- Training/comparison and saved evaluation/plan task-result entry points now actually request missing job translations, rather than leaving perpetual placeholders.
- Selecting another job cancels the old detail request; generation checks keep late responses from crossing profile/locale boundaries.
- PDF layout/warning metadata has the same pending/error/retry lifecycle as other explanations; metadata refresh does not reset the before/after tab.
- Chinese report-table headers, locations/contracts and strong/partial/gap/unknown labels are parsed explicitly. An unknown or Chinese gap is no longer incorrectly defaulted to a strong match. The formal prompt retains section letters and `## Machine Summary` keys for parsers.
- French template prefixes around Chinese facts are not incorrectly treated as already-Chinese sentences.
- Real-device testing caught `No ActivityResultRegistryOwner` on entering Profile: `createConfigurationContext` lost the Activity chain. The localized context now uses `ContextThemeWrapper` over the original Activity context, preserving native file-picker ownership while localizing Material resources.

## Verified results and evidence boundary

Private evidence directory: `.career-ops-web/mobile-qa/language-20260908/`. Do not publish that directory: it includes source conversations, candidate snapshots and prior task outputs.

- Targeted regression: **33 pass, 0 fail** (`continuation-regression.txt`): contract, cache concurrency, profile isolation, protected evidence, explicit failure/retry, report parsing and prior mobile persistence/CV protections.
- Web production build and TypeScript: passed (`continuation-web-build.txt`). Persistent `JobPilot web` service restarted through `start-mobile.ps1 -RestartWeb`; gateway authentication left intact.
- Android app and instrumentation APKs: built successfully using JDK 21. Physical Samsung USB install reports **versionName 0.3.2 / versionCode 6**, preserving application data and authentication.
- Synthetic Finance Profile saved CV analysis: real Luna/low translation completed in **99.338 seconds**, one localization operation. Original CV, candidature and business-task bytes unchanged; reopening created **zero** additional localization operations (`synthetic-finance-analysis-zh.json`). This is a display-translation measurement, not a new CV analysis or a speed guarantee.
- Synthetic Marketing Profile standalone translation attempt: cold setup took **131.867 seconds**, then the run was cancelled without a final answer. Read-only run observation confirmed cancellation; no invented result or automatic benchmark rerun was used. This failed attempt is retained and is not counted as a completed translation.
- Initial native test exposed the Activity-result-owner crash before language acceptance; that failure is retained in `continuation-phone.txt` and repaired in source.
- Native document/locale safety **passed on the authenticated public host**: `LanguageAcceptanceTest#documentAndLocaleSafetyWithoutWaitingForTranslation`, **OK (1 test), 29.011 seconds**, recorded in `continuation-phone-safety-2.txt`. This test deliberately does not count a pending translation as translated.
- Synthetic Finance Profile: real Chinese analysis overview, rewrite explanations and action tabs were captured and visually checked. Native French master PDF renders **1 page**. Chinese/French/Chinese switching took **1.953 seconds** in the recorded sequence and created **0 new localization operations**, in addition to **0 new business tasks**.
- Synthetic Marketing Profile: Chinese native navigation/settings and English master PDF render correctly, **1 page**. At the successful safety-test snapshot, **13 explanatory segments were still pending**. This is not full Chinese-analysis acceptance.
- Both phone-downloaded PDFs were separately text-extracted and rendered with PyMuPDF. Synthetic Finance Profile retained French content (2,399 extracted characters); Synthetic Marketing Profile retained English content (2,106 characters); neither contains Chinese characters. The native screenshots and rendered pages are under `device-final/`.
- Native before/after assertions preserve CV text/version, job IDs/scores/report IDs/status and task IDs/kinds/status: Synthetic Finance Profile **21 tasks / 13 jobs / CV v2**; Synthetic Marketing Profile **17 tasks / 1 job / CV v2**. Reversible material-preference edits were also exercised on Synthetic Finance Profile without changing those business invariants.
- The 93-file filesystem comparison has **no new files and 92 byte-identical files**. The sole change is Synthetic Finance Profile's synthetic `profile.yml`: it now explicitly stores `cv.language: fr`, previously inferred as French. Semantic comparison confirms no other config field changed. All inspected canonical CVs, notes, candidatures, saved reports, business tasks and CV-history files remain byte-identical. Evidence: `continuation-business-after.json` and `final-proof.json`.
- A separate native run was interrupted by concurrent **Project OS QA instrumentation on the same phone**, visible in Android ActivityTaskManager logs at 18:06:27 local time. It was not stopped or modified; the later independent safety run passed. Do not misclassify that `No compose hierarchies` failure as a JobPilot crash.

## Remaining acceptance and performance boundary

**The language feature is implemented, built and installed, but full historical-language acceptance has not passed.** The new `LanguageAcceptanceTest` is restricted to synthetic Synthetic Finance Profile/Synthetic Marketing Profile, existing results, source PDFs and reversible material preferences. Invoke individual methods; do not run the entire older instrumentation class, because some methods start business AI or accept CV drafts.

The first Synthetic Finance Profile historical-job translation failed after a **232.240-second cold setup** and the former 180-second model budget. Its result is preserved as failed, with no fabricated cache entries. The translation-only budget now uses the existing bounded **480-second** ACP budget instead of cancelling slow queued turns prematurely. This is a completion safeguard, **not a latency optimization**. Another actually visible Synthetic Finance Profile training job, `jpm-2027-sales-summer-paris`, subsequently completed its 19-segment Chinese translation: **212.259 seconds setup + 362.218 seconds agent**, about **575 seconds total**. That cache completion is backend evidence, not a screenshot proving every historical report view.

At the 18:17 local status check, Synthetic Marketing Profile's 13-segment Chinese snapshot translation was still queued; the older cancelled standalone operation was recorded as interrupted. A separate French snapshot request also exists. Resume these exact saved operations and inspect their actual outputs; do not blindly launch a second analysis/evaluation or replace source files. Pending/failed views provide localized notices and translation-only retry. Already-cached Synthetic Finance Profile analysis is usable without another model turn.

At the final 18:20 check, that same Synthetic Marketing Profile Chinese operation had advanced to **running** after **240.774s setup**, without creating a replacement operation. It still had no completed output. Its saved identity is `a6304976780cbd6592a20e1f10f85f3bb7812d83252d811170ac5da647ada9f3`; ACP session `acps_5aa466f63108e1fa19b6c94a`. Do not restart the backend or rerun the analysis merely to resume this pending display result. Final `git diff --check` passes and the phone still reports 0.3.2/code6.

Still not verified end-to-end: every existing formal report in Chinese, Synthetic Marketing Profile's fully translated explanations/global-layout advice, all historical task-result types, and new live-model rewrite output under every language pair. The unit contracts cover these boundaries, but they do not substitute for real output review. The long model queue/cold-start behavior remains a material usability issue.

No fresh formal evaluation, search, CV analysis, interview generation or tailored-CV AI benchmark was started for this language continuation. Existing master PDFs were rendered mechanically for preview; they are not newly invented application content. App UI operation, document preservation and display-translation readiness are reported separately.
